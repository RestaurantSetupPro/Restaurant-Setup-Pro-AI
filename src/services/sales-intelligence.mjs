export const inquiryTypes = ['Product Inquiry', 'Restaurant Project', 'Freight Quote', 'Mixed Inquiry'];
export const inquiryStatuses = ['New', 'Waiting Customer', 'Preparing Quote', 'Quoted', 'Negotiating', 'Won', 'Lost', 'Closed'];

export function analyzeInquiry(inquiry) {
  const message = String(inquiry.customer_message || '').toLowerCase();
  const project = inquiry.inquiry_type === 'Restaurant Project' || inquiry.inquiry_type === 'Mixed Inquiry' || /opening|renovat|restaurant|coffee shop|cafe|layout/.test(message);
  const freight = inquiry.inquiry_type === 'Freight Quote' || inquiry.inquiry_type === 'Mixed Inquiry' || /ddp|fob|freight|shipping|delivery/.test(message);
  const categoryMap = [
    [/chair|seat/, 'Dining Chair'], [/table/, 'Restaurant Table'], [/booth|banquette/, 'Booth Seating'],
    [/bar|stool/, 'Bar Stool'], [/outdoor|patio/, 'Outdoor Furniture'], [/counter/, 'Counter / Service Bar'], [/partition|divider/, 'Partition / Divider']
  ];
  let categories = categoryMap.filter(([pattern]) => pattern.test(message)).map(([, category]) => category);
  if (!categories.length && project) categories = ['Dining Chair', 'Restaurant Table', 'Booth Seating'];
  if (!categories.length && !freight) categories = ['Dining Chair', 'Restaurant Table'];
  const quantity = Number(message.match(/\b(\d{1,4})\b/)?.[1] || 0);
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
    notes: 'Rules-based first-pass analysis. Sales review is required before customer use.'
  };
}
