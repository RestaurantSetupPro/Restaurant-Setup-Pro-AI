export const inquiryTypes = ['Product Inquiry', 'Restaurant Project', 'Freight Quote', 'Mixed Inquiry'];
export const inquiryStatuses = ['New', 'Waiting Customer', 'Preparing Quote', 'Quoted', 'Negotiating', 'Won', 'Lost', 'Closed'];

const numberWords = Object.freeze({ one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12 });

function extractCategoryQuantity(message, nounPattern) {
  const quantityPattern = `(\\d{1,4}|${Object.keys(numberWords).join('|')})`;
  const match = message.match(new RegExp(`\\b${quantityPattern}\\s+(?:[a-z-]+\\s+){0,2}${nounPattern}\\b`, 'i'));
  if (!match) return 1;
  return Math.max(1, Number(match[1]) || numberWords[String(match[1]).toLowerCase()] || 1);
}

export function extractInquiryCommercialDetails(customerMessage) {
  const original = String(customerMessage || '');
  const message = original.toLowerCase();
  const category_quantities = {
    'Dining Chair': extractCategoryQuantity(message, '(?:dining\\s+)?chairs?'),
    'Restaurant Table': extractCategoryQuantity(message, '(?:restaurant\\s+)?tables?'),
    'Booth Seating': extractCategoryQuantity(message, '(?:custom\\s+)?(?:booth\\s+seating|booths?|banquettes?)'),
    'Bar Stool': extractCategoryQuantity(message, '(?:bar\\s+)?stools?'),
    'Outdoor Furniture': extractCategoryQuantity(message, '(?:outdoor\\s+)?furniture'),
    'Counter / Service Bar': extractCategoryQuantity(message, '(?:service\\s+)?counters?'),
    'Partition / Divider': extractCategoryQuantity(message, '(?:partitions?|dividers?)')
  };
  const tradeTerm = original.match(/\b(DDP|FOB|CIF|EXW)\b/i)?.[1]?.toUpperCase() || null;
  const destinationMatch = tradeTerm ? original.match(new RegExp(`\\b${tradeTerm}\\b\\s+(?:to\\s+)?([^,.;\\n]+)`, 'i')) : null;
  const destination = destinationMatch?.[1]?.trim().replace(/\s+(?:please|thank you|thanks)$/i, '').trim() || null;
  return { category_quantities, trade_term: tradeTerm, destination, shipping_method: tradeTerm ? 'Sea' : null };
}

export function analyzeInquiry(inquiry) {
  const message = String(inquiry.customer_message || '').toLowerCase();
  const commercial = extractInquiryCommercialDetails(inquiry.customer_message);
  const project = inquiry.inquiry_type === 'Restaurant Project' || inquiry.inquiry_type === 'Mixed Inquiry' || /opening|renovat|restaurant|coffee shop|cafe|layout/.test(message);
  const freight = inquiry.inquiry_type === 'Freight Quote' || inquiry.inquiry_type === 'Mixed Inquiry' || /ddp|fob|freight|shipping|delivery/.test(message);
  const categoryMap = [
    [/chair|seat/, 'Dining Chair'], [/table/, 'Restaurant Table'], [/booth|banquette/, 'Booth Seating'],
    [/bar|stool/, 'Bar Stool'], [/outdoor|patio/, 'Outdoor Furniture'], [/counter/, 'Counter / Service Bar'], [/partition|divider/, 'Partition / Divider']
  ];
  let categories = categoryMap.filter(([pattern]) => pattern.test(message)).map(([, category]) => category);
  if (!categories.length && project) categories = ['Dining Chair', 'Restaurant Table', 'Booth Seating'];
  if (!categories.length && !freight) categories = ['Dining Chair', 'Restaurant Table'];
  const quantity = categories.reduce((sum, category) => sum + Number(commercial.category_quantities[category] || 0), 0);
  const missing = [];
  if (!quantity && !freight) missing.push('Need quantity');
  if (project && !/layout|dimension|sqm|sq ft|square/.test(message)) missing.push('Need restaurant layout or dimensions');
  if (freight && !inquiry.country && !/malaysia|usa|canada|australia|singapore|uk|dubai/.test(message)) missing.push('Need delivery address');
  if (!/ddp|fob|cif|exw/.test(message) && freight) missing.push('Need trade term');
  const size = project || quantity >= 100 ? 'Large' : quantity >= 30 || categories.length >= 2 ? 'Medium' : 'Small';
  const restaurantType = /coffee|cafe/.test(message) ? 'Coffee Shop' : /bar/.test(message) ? 'Bar' : /bakery/.test(message) ? 'Bakery Cafe' : project ? 'Restaurant' : null;
  return {
    customer_intent: project ? `Opening or renovating ${restaurantType || 'Restaurant'}` : freight ? 'Freight quotation request' : `Product sourcing: ${categories.join(', ')}`,
    opportunity_size: size, restaurant_type: restaurantType,
    estimated_budget: size === 'Large' ? '$30,000+' : size === 'Medium' ? '$8,000–$30,000' : 'Under $8,000',
    furniture_categories: categories, missing_information: missing,
    suggested_next_question: missing[0] === 'Need quantity' ? 'May I know the required quantity for each product?' :
      missing[0] === 'Need restaurant layout or dimensions' ? 'Could you share the restaurant layout or space dimensions?' :
      missing[0] === 'Need delivery address' ? 'Could you share the complete delivery city and postal code?' :
      missing[0] === 'Need trade term' ? 'Would you prefer FOB, CIF, or DDP pricing?' : 'When would you like the products delivered?',
    recommended_package: project ? `${restaurantType || 'Restaurant'} furniture starter package: ${categories.join(', ')}` : categories.join(', '),
    notes: 'Rules-based first-pass analysis. Sales review is required before customer use.',
    ...commercial
  };
}
