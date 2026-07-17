import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const profileDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'config', 'qualification-profiles');
const profileFiles = Object.freeze(['restaurant-furniture.json']);
const compact = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
const normalized = value => compact(value).toLowerCase();

function loadProfiles() {
  return profileFiles.map(file => JSON.parse(readFileSync(join(profileDirectory, file), 'utf8')));
}

const profiles = Object.freeze(loadProfiles());

export function qualificationProfileForTarget(targetCustomerType) {
  const target = normalized(targetCustomerType);
  return profiles.find(profile => profile.targetCustomerTypes.some(value => normalized(value) === target)) || null;
}

function termMatch(text, term) {
  const haystack = normalized(text);
  const needle = normalized(term);
  if (!needle) return -1;
  return haystack.indexOf(needle);
}

function snippetAt(value, index, termLength, maximum = 240) {
  const source = compact(value);
  if (!source) return '';
  const start = Math.max(0, index - 90);
  const end = Math.min(source.length, Math.max(index + termLength + 110, start + maximum));
  return source.slice(start, end).trim();
}

function evidenceKey(item) {
  return `${item.evidenceType}|${item.type}|${item.url}|${normalized(item.snippet)}`;
}

export function classifyEvidenceText(profile, { text, url, pageType, capturedAt }) {
  if (!profile || !text) return [];
  const evidence = [];
  for (const [evidenceType, definitions] of Object.entries(profile.evidenceGroups || {})) {
    for (const definition of definitions) {
      for (const term of definition.terms || []) {
        const index = termMatch(text, term);
        if (index < 0) continue;
        evidence.push({
          evidenceType,
          type: definition.type,
          matchedTerm: term,
          pageType,
          url,
          capturedAt,
          snippet: snippetAt(text, index, term.length)
        });
        break;
      }
    }
  }
  return [...new Map(evidence.map(item => [evidenceKey(item), item])).values()];
}

function distinctTypes(evidence, evidenceType) {
  return new Set(evidence.filter(item => item.evidenceType === evidenceType).map(item => item.type)).size;
}

function firstByType(evidence, evidenceType, maximum) {
  const selected = new Map();
  for (const item of evidence) {
    if (item.evidenceType !== evidenceType || selected.has(item.type)) continue;
    selected.set(item.type, item);
    if (selected.size >= maximum) break;
  }
  return [...selected.values()];
}

function missingInformation(profile, facts) {
  const output = [];
  for (const rule of profile.missingInformationRules || []) {
    if (rule.when === 'no_positive_evidence' && !facts.positiveCount) output.push(rule.message);
    if (rule.when === 'no_verified_website' && !facts.verifiedWebsite) output.push(rule.message);
    if (rule.when === 'no_public_contact' && !facts.publicContact) output.push(rule.message);
  }
  return output;
}

export function evaluateQualificationProfile(profile, {
  evidence = [],
  enrichmentStatus,
  verifiedWebsite = false,
  publicContact = false
} = {}) {
  if (!profile) throw new Error('Qualification Profile is required.');
  const positiveCount = distinctTypes(evidence, 'positive_target');
  const generalCount = distinctTypes(evidence, 'general_furniture');
  const exclusionCount = distinctTypes(evidence, 'exclusion');
  const weights = profile.weights;
  const thresholds = profile.thresholds;
  const positivePoints = Math.min(weights.positiveEvidenceMaximum, positiveCount * weights.positiveEvidence);
  const generalPoints = Math.min(weights.generalEvidenceMaximum, generalCount * weights.generalEvidence);
  const exclusionPoints = Math.max(weights.exclusionEvidenceMaximumPenalty, exclusionCount * weights.exclusionEvidence);
  let score = weights.base + positivePoints + generalPoints + exclusionPoints;
  if (verifiedWebsite) score += weights.verifiedWebsite;
  if (publicContact) score += weights.publicContact;
  if (!positiveCount) score = Math.min(score, thresholds.maximumWithoutPositiveEvidence);
  const evidenceInsufficient = !evidence.length || ['Pending', 'Needs Review', 'No Reliable Website', 'Failed'].includes(enrichmentStatus);
  if (evidenceInsufficient) score = Math.min(Math.max(score, thresholds.notRecommendedBelow), thresholds.maximumWhenEvidenceInsufficient);
  score = Math.max(0, Math.min(100, Math.round(score)));
  let recommendation = score >= thresholds.recommended && positiveCount ? 'recommended' : score < thresholds.notRecommendedBelow ? 'not_recommended' : 'needs_confirmation';
  if (!positiveCount && recommendation === 'recommended') recommendation = 'needs_confirmation';
  if (evidenceInsufficient && recommendation === 'not_recommended' && !exclusionCount) recommendation = 'needs_confirmation';
  const facts = { positiveCount, generalCount, exclusionCount, verifiedWebsite, publicContact };
  const missing = missingInformation(profile, facts);
  const keyEvidence = firstByType(evidence, 'positive_target', 3);
  const negativeEvidence = firstByType(evidence, 'exclusion', 5);
  const scoringReason = [
    `Profile ${profile.name} ${profile.version}`,
    `正向目标证据 ${positiveCount} 类`,
    `普通家具证据 ${generalCount} 类`,
    `排除证据 ${exclusionCount} 类`,
    verifiedWebsite ? '官网已验证' : '官网未验证',
    publicContact ? '有公开联系方式' : '缺少公开联系方式'
  ].join('；');
  return {
    profileKey: profile.key,
    profileVersion: profile.version,
    score,
    recommendation,
    keyEvidence,
    negativeEvidence,
    missingInformation: missing,
    scoringReason,
    evidenceCounts: { positive: positiveCount, general: generalCount, exclusion: exclusionCount },
    evidenceInsufficient
  };
}

export function reclassifySavedEvidence(profile, enrichment = {}) {
  const current = Array.isArray(enrichment.businessEvidence) ? enrichment.businessEvidence : [];
  const classified = current.flatMap(item => item.evidenceType
    ? [item]
    : classifyEvidenceText(profile, {
        text: item.snippet,
        url: item.url,
        pageType: item.pageType,
        capturedAt: item.capturedAt || enrichment.capturedAt
      }));
  return [...new Map(classified.map(item => [evidenceKey(item), item])).values()];
}
