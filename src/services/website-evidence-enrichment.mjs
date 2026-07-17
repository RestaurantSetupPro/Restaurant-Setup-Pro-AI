import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { classifyEvidenceText, qualificationProfileForTarget } from './qualification-profile.mjs';

export const enrichmentResultStatuses = Object.freeze([
  'Pending',
  'Verified Website',
  'Needs Review',
  'No Reliable Website',
  'Completed',
  'Failed'
]);

export const enrichmentJobStatuses = Object.freeze([
  'Pending',
  'Running',
  'Paused',
  'Completed',
  'Failed'
]);

const businessPattern = /\b(restaurant|hospitality|hotel|commercial|contract|furniture|furnishings|interior|design|seating|chair|table|booth|banquette|upholstery|project)\b/i;
const companyStopWords = new Set(['and', 'the', 'of', 'inc', 'llc', 'ltd', 'company', 'co', 'corp', 'corporation', 'store', 'home']);
const pageMatchers = Object.freeze({
  about: /\b(about|company|our-story|who-we-are)\b/i,
  products: /\b(products?|services?|collections?|catalog|furniture|solutions?)\b/i,
  contact: /\b(contact|locations?|showroom|visit-us|get-in-touch)\b/i
});

const text = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
const json = (value, fallback = {}) => {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value || ''); } catch { return fallback; }
};
const now = () => new Date().toISOString();

function decodeHtmlText(value) {
  return text(String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\b(?:srcset|sizes|width|height|class|style|loading|decoding|data-[\w-]+)\s*=\s*["'][^"']*["']/gi, ' ')
    .replace(/(?:https?:)?\/\/\S+/gi, ' ')
    .replace(/\b\S+\.(?:png|jpe?g|gif|webp|svg)(?:\?\S*)?/gi, ' '));
}

export function cleanWebsiteText(value) {
  let html = String(value || '');
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    || html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    || html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]
    || html;
  html = main
    .replace(/<(nav|footer|header|aside|menu|form|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(button|select|option)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/?(?:div|section|p|li|ul|ol|h[1-6]|br|tr|td|th)\b[^>]*>/gi, '\n');
  const lines = html.split(/\n+/).map(decodeHtmlText).map(line => text(line
    .replace(/\bsrcset\s*=\s*"[^"]*"/gi, ' ')
    .replace(/\bsrcset\s*=\s*'[^']*'/gi, ' ')
    .replace(/\b(?:alt|fetchpriority)\s*=\s*["'][^"']*["']/gi, ' ')
    .replace(/(?:\b\d+w\b\s*,?\s*){3,}/gi, ' ')))
    .filter(line =>
    line.length >= 3 &&
    !/^(?:add anything here|menu title|newsletter|privacy|wishlist|login\s*\/\s*register)/i.test(line) &&
    !/lorem ipsum/i.test(line));
  const seen = new Set();
  const unique = [];
  for (const line of lines) {
    const key = line.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(line);
  }
  return text(unique.join(' '));
}

const htmlText = decodeHtmlText;

function absoluteUrl(value, base = null) {
  const candidate = text(value);
  if (!candidate || /^(mailto|tel|javascript|data):/i.test(candidate)) return null;
  try {
    const url = new URL(candidate, base || undefined);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    return url.toString();
  } catch { return null; }
}

function canonicalOrigin(value) {
  const normalized = absoluteUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  url.hostname = url.hostname.toLowerCase();
  return url.origin;
}

function privateIp(address) {
  if (!address) return true;
  if (address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:')) return true;
  if (!address.includes('.')) return false;
  const parts = address.split('.').map(Number);
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

async function assertPublicUrl(value, lookupImpl = lookup) {
  const normalized = absoluteUrl(value);
  if (!normalized) throw Object.assign(new Error('Website URL is invalid.'), { code: 'INVALID_URL' });
  const url = new URL(normalized);
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw Object.assign(new Error('Private website targets are not allowed.'), { code: 'PRIVATE_TARGET' });
  }
  if (isIP(hostname)) {
    if (privateIp(hostname)) throw Object.assign(new Error('Private website targets are not allowed.'), { code: 'PRIVATE_TARGET' });
    return normalized;
  }
  const addresses = await lookupImpl(hostname, { all: true });
  if (!addresses.length || addresses.some(item => privateIp(item.address))) {
    throw Object.assign(new Error('Website did not resolve to a public address.'), { code: 'PRIVATE_TARGET' });
  }
  return normalized;
}

function companyTokens(companyName) {
  return text(companyName).toLowerCase().split(/[^\p{L}\p{N}]+/u)
    .filter(token => token.length >= 3 && !companyStopWords.has(token));
}

export function domainCandidatesForCompany(companyName) {
  const rawTokens = text(companyName).toLowerCase().replace(/['’]/g, '').split(/[^\p{L}\p{N}]+/u)
    .filter(token => token.length >= 2 && !['of', 'inc', 'llc', 'ltd', 'company', 'co', 'corp', 'corporation'].includes(token));
  if (!rawTokens.length) return [];
  const withoutLeadingArticle = rawTokens[0] === 'the' ? rawTokens.slice(1) : rawTokens;
  const withoutConjunction = withoutLeadingArticle.filter(token => token !== 'and');
  const withoutGenericSuffix = withoutConjunction.filter((token, index) =>
    index !== withoutConjunction.length - 1 || !['furniture', 'furnishings', 'home', 'interiors', 'mattress', 'store', 'shop'].includes(token));
  const names = [
    rawTokens.join(''),
    withoutLeadingArticle.join(''),
    withoutConjunction.join(''),
    withoutGenericSuffix.join(''),
    withoutLeadingArticle.slice(0, 2).join(''),
    `${withoutGenericSuffix.join('')}furniture`
  ].filter(value => value.length >= 4);
  return [...new Set(names)].flatMap(name => [`https://${name}.com/`, `https://www.${name}.com/`]).slice(0, 8);
}

function nameMatch(companyName, pageText, hostname = '') {
  const tokens = companyTokens(companyName);
  if (!tokens.length) return 0;
  const haystack = `${pageText} ${hostname}`.toLowerCase();
  return tokens.filter(token => haystack.includes(token)).length / tokens.length;
}

function locationMatch(lead, pageText) {
  const values = [lead.city, lead.country, lead.address].map(text).filter(Boolean);
  if (!values.length) return false;
  const haystack = pageText.toLowerCase();
  return values.some(value => value.toLowerCase().split(',').some(part => part.trim().length >= 3 && haystack.includes(part.trim())));
}

function extractMeta(html, name) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, 'i')
  ];
  for (const pattern of patterns) {
    const match = String(html || '').match(pattern);
    if (match) return htmlText(match[1]);
  }
  return null;
}

function extractTitle(html) {
  return htmlText(String(html || '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
}

function extractLinks(html, base) {
  const links = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of String(html || '').matchAll(pattern)) {
    const url = absoluteUrl(match[1], base);
    if (url) links.push({ url, label: htmlText(match[2]) });
  }
  return links;
}

function extractEmails(pageText, html) {
  const values = new Set();
  for (const match of `${pageText} ${html}`.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)) {
    const email = match[0].toLowerCase();
    if (!/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(email) && !/@example\.(com|org|net)$/i.test(email) && !/emailprotected/i.test(email)) values.add(email);
  }
  return [...values].slice(0, 10);
}

function extractPhones(pageText) {
  const values = new Set();
  for (const match of pageText.matchAll(/(?:\+?1[\s().-]*)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]*\d{4}\b/g)) {
    const phone = text(match[0]);
    if (phone.replace(/\D/g, '').length >= 10) values.add(phone);
  }
  return [...values].slice(0, 10);
}

function evidenceSignals(page, pageType, profile) {
  return classifyEvidenceText(profile, {
    text: page.text,
    pageType,
    url: page.url,
    capturedAt: page.capturedAt
  });
}

function pageDescription(page) {
  return page.description || page.text.slice(0, 500) || null;
}

export function createDuckDuckGoWebsiteDiscoveryProvider({ fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  return {
    key: 'duckduckgo-html',
    costType: 'free',
    async findCandidates(lead) {
      if (String(process.env.WEBSITE_ENRICHMENT_DISCOVERY_PROVIDER || 'duckduckgo-html').toLowerCase() === 'disabled') return [];
      const query = [lead.company_name, lead.city, lead.country, lead.business_type || lead.source_category, 'official website'].filter(Boolean).join(' ');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
          headers: { 'User-Agent': 'Restaurant-AI-Sales-OS/1.0 website-evidence-enrichment' },
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`Website discovery returned HTTP ${response.status}.`);
        const html = await response.text();
        const candidates = [];
        for (const match of html.matchAll(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["']/gi)) {
          let candidate = match[1].replace(/&amp;/g, '&');
          try {
            const redirect = new URL(candidate, 'https://duckduckgo.com');
            candidate = redirect.searchParams.get('uddg') || candidate;
          } catch {}
          const url = absoluteUrl(candidate);
          if (url && !/duckduckgo\.com/i.test(new URL(url).hostname)) candidates.push(url);
          if (candidates.length >= 5) break;
        }
        return [...new Set(candidates)];
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}

export function createWebsiteFetcher({
  fetchImpl = globalThis.fetch,
  lookupImpl = lookup,
  timeoutMs = Number(process.env.WEBSITE_ENRICHMENT_REQUEST_TIMEOUT_MS || 8000),
  maxBytes = Number(process.env.WEBSITE_ENRICHMENT_MAX_RESPONSE_BYTES || 1_500_000)
} = {}) {
  return {
    async fetchPage(value) {
      const url = await assertPublicUrl(value, lookupImpl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, {
          redirect: 'follow',
          headers: {
            Accept: 'text/html,application/xhtml+xml',
            'User-Agent': 'Restaurant-AI-Sales-OS/1.0 website-evidence-enrichment'
          },
          signal: controller.signal
        });
        if (!response.ok) throw Object.assign(new Error(`Website returned HTTP ${response.status}.`), { code: `HTTP_${response.status}` });
        const contentType = String(response.headers.get('content-type') || '');
        if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) throw Object.assign(new Error('Website did not return HTML.'), { code: 'NOT_HTML' });
        const bytes = new Uint8Array(await response.arrayBuffer());
        const html = new TextDecoder().decode(bytes.slice(0, maxBytes));
        const finalUrl = absoluteUrl(response.url || url) || url;
        return {
          url: finalUrl,
          html,
          text: cleanWebsiteText(html),
          title: extractTitle(html),
          description: extractMeta(html, 'description') || extractMeta(html, 'og:description'),
          links: extractLinks(html, finalUrl),
          capturedAt: now(),
          truncated: bytes.length > maxBytes
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}

export function createWebsiteEvidenceEnrichmentService({
  db,
  audit,
  qualifyResult,
  discoveryProvider = createDuckDuckGoWebsiteDiscoveryProvider(),
  websiteFetcher = createWebsiteFetcher(),
  maxAttempts = Number(process.env.WEBSITE_ENRICHMENT_MAX_ATTEMPTS || 3)
}) {
  const activeRuns = new Map();

  function normalizeRecord(row) {
    if (!row) return null;
    return {
      ...row,
      evidence_json: json(row.evidence_json, {}),
      public_emails_json: json(row.public_emails_json, []),
      source_urls_json: json(row.source_urls_json, []),
      extracted_json: json(row.extracted_json, {}),
      status_history_json: json(row.status_history_json, [])
    };
  }

  function readRecord(searchResultId) {
    return normalizeRecord(db.prepare('SELECT * FROM lead_enrichment_records WHERE search_result_id=?').get(searchResultId));
  }

  function readJob(id) {
    const row = db.prepare('SELECT * FROM lead_enrichment_jobs WHERE id=?').get(id);
    if (!row) return null;
    return { ...row, checkpoint_json: json(row.checkpoint_json, {}) };
  }

  function taskProgress(taskId) {
    const rows = db.prepare(`SELECT enrichment_status AS status,COUNT(*) AS count
      FROM search_results WHERE search_task_id=? GROUP BY enrichment_status`).all(taskId);
    const statuses = Object.fromEntries(enrichmentResultStatuses.map(status => [status, 0]));
    for (const row of rows) statuses[row.status || 'Pending'] = Number(row.count || 0);
    const total = Object.values(statuses).reduce((sum, value) => sum + value, 0);
    const processed = total - statuses.Pending;
    return { total, processed, complete: total > 0 && processed === total, statuses };
  }

  function statusHistory(existing, status, detail = null) {
    return [...(existing?.status_history_json || []), { status, at: now(), detail }].slice(-30);
  }

  function saveStatus(searchResultId, status, detail = null, error = null) {
    if (!enrichmentResultStatuses.includes(status)) throw new Error(`Unsupported enrichment status: ${status}`);
    const existing = readRecord(searchResultId);
    const history = statusHistory(existing, status, detail);
    db.prepare(`INSERT INTO lead_enrichment_records
      (search_result_id,status,attempt_count,last_error,status_history_json,updated_at)
      VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(search_result_id) DO UPDATE SET status=excluded.status,
        attempt_count=lead_enrichment_records.attempt_count+CASE WHEN excluded.status='Pending' THEN 1 ELSE 0 END,
        last_error=excluded.last_error,status_history_json=excluded.status_history_json,updated_at=CURRENT_TIMESTAMP`)
      .run(searchResultId, status, status === 'Pending' ? 1 : 0, error, JSON.stringify(history));
    db.prepare('UPDATE search_results SET enrichment_status=?,enrichment_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, searchResultId);
  }

  function lead(id) {
    return db.prepare(`SELECT search_results.*,search_tasks.customer_type AS target_customer_type
      FROM search_results JOIN search_tasks ON search_tasks.id=search_results.search_task_id
      WHERE search_results.id=?`).get(id);
  }

  async function fetchCandidate(candidate, leadRow, providerSupplied) {
    const home = await websiteFetcher.fetchPage(candidate);
    const hostname = new URL(home.url).hostname.replace(/^www\./, '');
    const companyScore = nameMatch(leadRow.company_name, `${home.title} ${home.description} ${home.text.slice(0, 5000)}`, hostname);
    const location = locationMatch(leadRow, home.text);
    const business = businessPattern.test(`${home.title} ${home.description} ${home.text.slice(0, 12000)}`);
    const score = Math.min(100, Math.round(companyScore * 65 + (location ? 15 : 0) + (business ? 20 : 0)));
    const verified = companyScore >= (providerSupplied ? 0.34 : 0.5) && (business || location || providerSupplied);
    return { home, hostname, companyScore, location, business, score, verified, providerSupplied };
  }

  function selectedInternalPages(home) {
    const origin = canonicalOrigin(home.url);
    const selected = [];
    for (const [pageType, pattern] of Object.entries(pageMatchers)) {
      const match = home.links.find(link => canonicalOrigin(link.url) === origin && pattern.test(`${link.url} ${link.label}`));
      if (match) selected.push({ pageType, url: match.url });
    }
    return selected.slice(0, 3);
  }

  async function enrichOne(searchResultId, user, { retry = false, refresh = false } = {}) {
    const leadRow = lead(searchResultId);
    if (!leadRow) throw Object.assign(new Error('Search Result not found.'), { status: 404 });
    const previous = readRecord(searchResultId);
    if (!retry && !refresh && previous && ['Completed', 'No Reliable Website'].includes(previous.status)) return previous;
    if (Number(previous?.attempt_count || 0) >= maxAttempts && retry && !refresh) throw Object.assign(new Error('Enrichment retry limit reached.'), { status: 409 });
    saveStatus(searchResultId, 'Pending', refresh ? 'Evidence refresh requested' : retry ? 'Retry requested' : 'Enrichment started');
    const startedAt = now();
    const qualificationProfile = qualificationProfileForTarget(leadRow.target_customer_type);
    const providerCandidates = [leadRow.website, leadRow.canonical_website, json(leadRow.evidence_json, {}).sourceUrl]
      .map(value => absoluteUrl(value)).filter(Boolean);
    let discovered = [];
    const failures = [];
    try {
      if (!providerCandidates.length) {
        const inferredCandidates = domainCandidatesForCompany(leadRow.company_name);
        try { discovered = [...inferredCandidates, ...(await discoveryProvider.findCandidates(leadRow))]; }
        catch (error) { failures.push({ stage: 'website-discovery', error: text(error.message) }); }
        if (!discovered.length) discovered = inferredCandidates;
      }
      const candidates = [...new Set([...providerCandidates, ...discovered])].slice(0, 6);
      let best = null;
      for (const candidate of candidates) {
        try {
          const checked = await fetchCandidate(candidate, leadRow, providerCandidates.includes(candidate));
          if (!best || checked.score > best.score) best = checked;
          if (checked.verified) { best = checked; break; }
        } catch (error) {
          failures.push({ stage: 'website-verification', url: candidate, error: text(error.message), code: error.code || null });
        }
      }
      if (!best) {
        const unreliableOnly = failures.length > 0 && failures.every(item =>
          /ENOTFOUND|EAI_AGAIN|INVALID_URL|PRIVATE_TARGET|NOT_HTML|HTTP_4\d\d/i.test(`${item.code || ''} ${item.error || ''}`));
        const status = !candidates.length || unreliableOnly ? 'No Reliable Website' : 'Failed';
        const existingEvidence = json(leadRow.evidence_json, {});
        const enrichmentEvidence = {
          version: 'website-evidence-v2',
          status,
          officialWebsite: null,
          businessEvidence: [],
          sourceUrls: [],
          capturedAt: now(),
          failures
        };
        db.prepare('UPDATE search_results SET evidence_json=?,enrichment_status=?,enrichment_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?')
          .run(JSON.stringify({ ...existingEvidence, enrichment: enrichmentEvidence }), status, searchResultId);
        saveStatus(searchResultId, status, candidates.length ? 'All website candidates failed.' : 'No website candidate found.', failures.at(-1)?.error || null);
        db.prepare('UPDATE lead_enrichment_records SET evidence_json=?,extracted_json=?,source_urls_json=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE search_result_id=?')
          .run(JSON.stringify(enrichmentEvidence), JSON.stringify(enrichmentEvidence), '[]', searchResultId);
        audit(user?.id || null, 'complete_lead_enrichment', 'search_results', String(searchResultId), { status, candidateCount: candidates.length, failures });
        if (qualifyResult) await qualifyResult(searchResultId, user, { force: true, evidenceOnly: true });
        return readRecord(searchResultId);
      }
      if (!best.verified) {
        const signals = evidenceSignals(best.home, 'home', qualificationProfile);
        const sources = [{ url: best.home.url, pageType: 'home', title: best.home.title, capturedAt: best.home.capturedAt }];
        const extracted = {
          candidateWebsite: best.home.url,
          businessDescription: pageDescription(best.home),
          businessEvidence: signals,
          sourceUrls: sources,
          capturedAt: now(),
          verification: { score: best.score, companyNameMatch: best.companyScore, locationMatch: best.location, businessMatch: best.business },
          failures
        };
        const existingEvidence = json(leadRow.evidence_json, {});
        const evidence = { ...existingEvidence, enrichment: { version: 'website-evidence-v2', status: 'Needs Review', qualificationProfile: qualificationProfile?.key || null, ...extracted, capturedAt: startedAt } };
        db.prepare(`UPDATE lead_enrichment_records SET status='Needs Review',official_website=?,verification_score=?,
          evidence_json=?,extracted_json=?,source_urls_json=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE search_result_id=?`)
          .run(best.home.url, best.score, JSON.stringify(evidence.enrichment), JSON.stringify(extracted), JSON.stringify(sources), searchResultId);
        db.prepare("UPDATE search_results SET evidence_json=?,enrichment_status='Needs Review',enrichment_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify(evidence), searchResultId);
        saveStatus(searchResultId, 'Needs Review', 'Website candidate could not be verified automatically.');
        audit(user?.id || null, 'complete_lead_enrichment', 'search_results', String(searchResultId), { status: 'Needs Review', verificationScore: best.score });
        if (qualifyResult) await qualifyResult(searchResultId, user, { force: true, evidenceOnly: true });
        return readRecord(searchResultId);
      }

      saveStatus(searchResultId, 'Verified Website', best.home.url);
      const pages = [{ ...best.home, pageType: 'home' }];
      for (const target of selectedInternalPages(best.home)) {
        try { pages.push({ ...(await websiteFetcher.fetchPage(target.url)), pageType: target.pageType }); }
        catch (error) { failures.push({ stage: 'page-fetch', pageType: target.pageType, url: target.url, error: text(error.message) }); }
      }
      const emails = [...new Set(pages.flatMap(page => extractEmails(page.text, page.html)))];
      const phones = [...new Set(pages.flatMap(page => extractPhones(page.text)))];
      const contactPage = pages.find(page => page.pageType === 'contact')?.url || null;
      const signals = [...new Map(pages.flatMap(page => evidenceSignals(page, page.pageType, qualificationProfile))
        .map(item => [`${item.evidenceType}|${item.type}|${item.url}|${item.snippet.toLowerCase()}`, item])).values()];
      const sources = pages.map(page => ({ url: page.url, pageType: page.pageType, title: page.title, capturedAt: page.capturedAt }));
      const extracted = {
        officialWebsite: best.home.url,
        phone: leadRow.phone || phones[0] || null,
        publicEmails: emails,
        contactPage,
        businessDescription: pages.map(pageDescription).find(Boolean) || null,
        businessEvidence: signals,
        verification: {
          score: best.score,
          companyNameMatch: best.companyScore,
          locationMatch: best.location,
          businessMatch: best.business,
          providerWebsiteUsed: best.providerSupplied
        },
        sourceUrls: sources,
        capturedAt: now(),
        failures
      };
      const existingEvidence = json(leadRow.evidence_json, {});
      const enrichmentEvidence = { version: 'website-evidence-v2', status: 'Completed', qualificationProfile: qualificationProfile?.key || null, ...extracted };
      const evidence = { ...existingEvidence, enrichment: enrichmentEvidence };
      db.prepare(`UPDATE lead_enrichment_records SET status='Completed',official_website=?,phone=?,public_emails_json=?,
        contact_page_url=?,business_description=?,verification_score=?,evidence_json=?,extracted_json=?,source_urls_json=?,
        last_error=NULL,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE search_result_id=?`)
        .run(best.home.url, extracted.phone, JSON.stringify(emails), contactPage, extracted.businessDescription, best.score,
          JSON.stringify(enrichmentEvidence), JSON.stringify(extracted), JSON.stringify(sources), searchResultId);
      db.prepare(`UPDATE search_results SET website=?,canonical_website=?,phone=COALESCE(phone,?),email=COALESCE(email,?),
        evidence_json=?,enrichment_status='Completed',enrichment_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(best.home.url, new URL(best.home.url).hostname.replace(/^www\./, ''), extracted.phone, emails[0] || null, JSON.stringify(evidence), searchResultId);
      saveStatus(searchResultId, 'Completed', `Captured ${sources.length} website pages.`);
      audit(user?.id || null, 'complete_lead_enrichment', 'search_results', String(searchResultId), { status: 'Completed', verificationScore: best.score, sourceCount: sources.length, signalCount: signals.length });
      if (qualifyResult) await qualifyResult(searchResultId, user, { force: true, evidenceOnly: true });
      return readRecord(searchResultId);
    } catch (error) {
      saveStatus(searchResultId, 'Failed', 'Enrichment failed.', text(error.message));
      audit(user?.id || null, 'fail_lead_enrichment', 'search_results', String(searchResultId), { error: text(error.message), startedAt });
      return readRecord(searchResultId);
    }
  }

  function createJob(taskId, user, { executionId = null, retryFailed = false } = {}) {
    const task = db.prepare('SELECT id FROM search_tasks WHERE id=?').get(taskId);
    if (!task) throw Object.assign(new Error('Search Task not found.'), { status: 404 });
    const active = db.prepare("SELECT id FROM lead_enrichment_jobs WHERE search_task_id=? AND status IN ('Pending','Running','Paused') ORDER BY id DESC LIMIT 1").get(taskId);
    if (active) return readJob(active.id);
    const eligibility = retryFailed
      ? "AND enrichment_status IN ('Pending','Failed','Needs Review','No Reliable Website')"
      : "AND enrichment_status='Pending'";
    const total = Number(db.prepare(`SELECT COUNT(*) AS count FROM search_results WHERE search_task_id=?
      AND status NOT IN ('converted','discarded') ${executionId ? 'AND search_execution_id=?' : ''} ${eligibility}`).get(...(executionId ? [taskId, executionId] : [taskId])).count || 0);
    const row = db.prepare(`INSERT INTO lead_enrichment_jobs
      (search_task_id,search_execution_id,status,total_count,retry_failed,created_by)
      VALUES (?,?, 'Pending',?,?,?) RETURNING id`).get(taskId, executionId, total, retryFailed ? 1 : 0, user?.id || null);
    audit(user?.id || null, 'create_lead_enrichment_job', 'lead_enrichment_jobs', String(row.id), { taskId, executionId, total, retryFailed });
    return readJob(row.id);
  }

  async function runJob(id, user) {
    if (activeRuns.has(id)) return activeRuns.get(id);
    const run = (async () => {
      let job = readJob(id);
      if (!job) throw Object.assign(new Error('Enrichment Job not found.'), { status: 404 });
      if (!['Pending', 'Paused', 'Failed'].includes(job.status)) return job;
      db.prepare("UPDATE lead_enrichment_jobs SET status='Running',pause_requested_at=NULL,started_at=COALESCE(started_at,CURRENT_TIMESTAMP),last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
      audit(user?.id || null, 'start_lead_enrichment_job', 'lead_enrichment_jobs', String(id), { resumed: job.status === 'Paused' });
      const params = [job.search_task_id];
      let executionFilter = '';
      if (job.search_execution_id) { executionFilter = ' AND search_execution_id=?'; params.push(job.search_execution_id); }
      const retryFilter = job.retry_failed ? " AND enrichment_status IN ('Pending','Failed','Needs Review','No Reliable Website')" : " AND enrichment_status='Pending'";
      const rows = db.prepare(`SELECT id FROM search_results WHERE search_task_id=?${executionFilter}
        AND status NOT IN ('converted','discarded')${retryFilter} ORDER BY id`).all(...params);
      let failed = 0, processed = 0, completed = 0;
      for (const row of rows) {
        job = readJob(id);
        if (job.pause_requested_at) {
          db.prepare("UPDATE lead_enrichment_jobs SET status='Paused',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
          audit(user?.id || null, 'pause_lead_enrichment_job', 'lead_enrichment_jobs', String(id));
          return readJob(id);
        }
        const result = await enrichOne(row.id, user, { retry: Boolean(job.retry_failed) });
        processed += 1;
        if (result?.status === 'Completed') completed += 1;
        if (result?.status === 'Failed') failed += 1;
        db.prepare(`UPDATE lead_enrichment_jobs SET processed_count=?,completed_count=?,failed_count=?,
          checkpoint_json=?,heartbeat_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
          .run(processed, completed, failed, JSON.stringify({ lastSearchResultId: row.id }), id);
      }
      const progress = taskProgress(job.search_task_id);
      const finalStatus = failed && processed === failed ? 'Failed' : 'Completed';
      db.prepare(`UPDATE lead_enrichment_jobs SET status=?,processed_count=?,completed_count=?,failed_count=?,
        completed_at=CURRENT_TIMESTAMP,heartbeat_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(finalStatus, processed, completed, failed, id);
      audit(user?.id || null, 'complete_lead_enrichment_job', 'lead_enrichment_jobs', String(id), { ...progress, failed });
      return readJob(id);
    })().finally(() => activeRuns.delete(id));
    activeRuns.set(id, run);
    return run;
  }

  function pauseJob(id, user) {
    const job = readJob(id);
    if (!job) throw Object.assign(new Error('Enrichment Job not found.'), { status: 404 });
    if (!['Pending', 'Running'].includes(job.status)) throw Object.assign(new Error('Only Pending or Running jobs can be paused.'), { status: 409 });
    db.prepare('UPDATE lead_enrichment_jobs SET pause_requested_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(id);
    audit(user?.id || null, 'request_pause_lead_enrichment_job', 'lead_enrichment_jobs', String(id));
    return readJob(id);
  }

  function recoverInterrupted() {
    const rows = db.prepare("SELECT id FROM lead_enrichment_jobs WHERE status='Running'").all();
    for (const row of rows) db.prepare("UPDATE lead_enrichment_jobs SET status='Paused',last_error='Server Restart',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id);
    return rows.length;
  }

  return {
    createJob,
    runJob,
    pauseJob,
    enrichOne,
    readJob,
    readRecord,
    taskProgress,
    recoverInterrupted,
    statuses: enrichmentResultStatuses,
    jobStatuses: enrichmentJobStatuses
  };
}
