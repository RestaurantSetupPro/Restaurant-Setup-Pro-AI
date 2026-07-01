export const opportunityEngineVersion = 'rules-1.0';

export const customerSources = ['Google Maps', 'Facebook', 'Instagram', 'LinkedIn', 'Website', 'Manual', 'CSV', 'Apollo', 'Other'];
export const contactRoles = ['Owner', 'Founder', 'Co-Founder', 'Purchasing', 'Operations', 'Manager', 'Designer', 'Other'];
export const gapRules = [
  ['website', 'Missing Website', 'Medium'], ['email', 'Missing Email', 'High'], ['whatsapp', 'Missing WhatsApp', 'Medium'],
  ['decision_maker', 'Missing Decision Maker', 'High'], ['linkedin_url', 'Missing LinkedIn', 'Low'],
  ['instagram_url', 'Missing Instagram', 'Low'], ['store_count', 'Missing Store Count', 'Medium'], ['opening_year', 'Missing Opening Year', 'Low']
];

const businessTypes = ['Coffee Shop', 'Restaurant', 'Bubble Tea', 'Bar', 'Bakery', 'Hotel', 'Food Court'];

function titleCase(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function normalizeUrl(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  return /^https?:\/\//i.test(text) ? text : `https://${text.replace(/^\/+/, '')}`;
}

function normalizePhone(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const plus = text.startsWith('+') ? '+' : '';
  return plus + text.replace(/\D/g, '');
}

function inferBusinessType(value) {
  const text = String(value || '').toLowerCase();
  const match = businessTypes.find(type => text.includes(type.toLowerCase()));
  return match || (value ? titleCase(value) : null);
}

export function normalizeCustomer(input) {
  const openingYear = Number(input.opening_year) || null;
  const currentYear = new Date().getUTCFullYear();
  return {
    ...input,
    company_name: titleCase(input.company_name || input.brand_name),
    brand_name: input.brand_name ? titleCase(input.brand_name) : null,
    business_type: inferBusinessType(input.business_type || input.company_name),
    country: input.country ? titleCase(input.country) : null,
    city: input.city ? titleCase(input.city) : null,
    website: normalizeUrl(input.website),
    google_maps_url: normalizeUrl(input.google_maps_url), facebook_url: normalizeUrl(input.facebook_url),
    instagram_url: normalizeUrl(input.instagram_url), linkedin_url: normalizeUrl(input.linkedin_url), tiktok_url: normalizeUrl(input.tiktok_url),
    phone: normalizePhone(input.phone), whatsapp: normalizePhone(input.whatsapp),
    email: input.email ? String(input.email).trim().toLowerCase() : null,
    store_count: Number(input.store_count) || null,
    opening_year: openingYear,
    years_in_business: Number(input.years_in_business) || (openingYear && openingYear <= currentYear ? currentYear - openingYear : null),
    expansion_probability: Math.max(0, Math.min(100, Number(input.expansion_probability) || 0)),
    renovation_probability: Math.max(0, Math.min(100, Number(input.renovation_probability) || 0)),
    furniture_need_probability: Math.max(0, Math.min(100, Number(input.furniture_need_probability) || 0))
  };
}

export function detectGaps(customer, hasDecisionMaker = false) {
  return gapRules.filter(([field]) => field === 'decision_maker' ? !hasDecisionMaker : !customer[field])
    .map(([, gap_type, priority]) => ({ gap_type, priority }));
}

export function dataQualityScore(customer, hasDecisionMaker = false) {
  const fields = ['company_name', 'business_type', 'country', 'city', 'website', 'email', 'phone', 'whatsapp', 'store_count', 'opening_year'];
  const complete = fields.filter(field => customer[field] !== null && customer[field] !== undefined && customer[field] !== '').length + (hasDecisionMaker ? 1 : 0);
  return Math.round((complete / 11) * 100);
}

export function scoreOpportunity(customer, { hasDecisionMaker = false, productMatchCount = 0 } = {}) {
  const fit = businessTypes.includes(customer.business_type) ? 15 : (customer.business_type ? 7 : 0);
  const years = Number(customer.years_in_business) >= 3 ? 15 : (Number(customer.years_in_business) > 0 ? 7 : 0);
  const stores = Number(customer.store_count) >= 2 ? 15 : (Number(customer.store_count) === 1 ? 7 : 0);
  const contactSignals = [customer.email, customer.whatsapp, customer.website, hasDecisionMaker].filter(Boolean).length;
  const contactability = contactSignals * 5;
  const signalAverage = (Number(customer.expansion_probability || 0) + Number(customer.renovation_probability || 0) + Number(customer.furniture_need_probability || 0)) / 3;
  const signals = Math.round(signalAverage * 0.2);
  const productMatch = productMatchCount > 0 ? 10 : 0;
  const dataQuality = Math.round(Number(customer.data_quality_score || 0) * 0.05);
  const dimensions = { businessFit: fit, yearsInBusiness: years, storeCount: stores, contactability, signals, productMatch, dataQuality };
  const score = Math.min(100, Object.values(dimensions).reduce((sum, value) => sum + value, 0));
  const grade = score >= 90 ? 'A+' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
  return { score, grade, dimensions };
}

export function nextActionFor(grade) {
  const days = grade === 'A+' ? 0 : grade === 'A' ? 3 : grade === 'B' ? 7 : 30;
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  const next_action = {
    'A+': 'Transfer to sales immediately; contact today with a personalized first message.',
    A: 'Contact within 3 days and identify the primary decision maker.',
    B: 'Add to follow-up pool; enrich missing data before contact within 7 days.',
    C: 'Low priority; monitor for stronger expansion or renovation signals.',
    D: 'Do not allocate active sales time; retain for nurture only.'
  }[grade];
  return { next_action, next_action_date: date.toISOString().slice(0, 10) };
}

export function buildOutreachDraft(customer, recommendations = []) {
  const categories = [...new Set(recommendations.map(item => item.category).filter(Boolean))];
  const location = [customer.city, customer.country].filter(Boolean).join(', ');
  const multiStore = Number(customer.store_count) >= 2 ? `your ${customer.store_count}-location operation` : 'your hospitality business';
  const products = categories.length ? categories.slice(0, 3).join(', ') : 'restaurant furniture packages';
  return {
    channel: customer.email ? 'Email' : customer.whatsapp ? 'WhatsApp' : customer.linkedin_url ? 'LinkedIn' : 'Facebook',
    draft_type: 'First Touch',
    subject: `Furniture ideas for ${customer.brand_name || customer.company_name}`,
    body: `Hi ${customer.brand_name || customer.company_name} team,\n\nI noticed ${multiStore}${location ? ` in ${location}` : ''}. We help hospitality brands with factory-direct ${products}, including booth seating, tables and chairs, custom modular furniture, and complete project furniture packages. Based on your profile, these options may support a future opening, expansion, or remodel. DDP service is available where applicable.\n\nWould it be useful if I prepared a short product direction and budget range for your team?\n\nBest regards,\nRestaurant Setup Pro`,
    language: 'English',
    personalization_summary: `${customer.business_type || 'Hospitality'} prospect in ${location || 'an unconfirmed market'}; grade ${customer.opportunity_grade || 'pending'}.`,
    recommended_products_snapshot: categories
  };
}

export function parseImportPayload(body) {
  if (Array.isArray(body.customers)) return body.customers;
  const text = String(body.csv || body.text || '').trim();
  if (!text) return [];
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  if (body.csv) {
    const headers = lines.shift().split(',').map(value => value.trim().toLowerCase().replace(/\s+/g, '_'));
    return lines.map(line => Object.fromEntries(line.split(',').map((value, index) => [headers[index], value.trim()])));
  }
  return lines.map(line => {
    const parts = line.split('|').map(value => value.trim());
    return { company_name: parts[0], business_type: parts[1], city: parts[2], country: parts[3], email: parts[4], website: parts[5] };
  });
}
