const POSTGRES_BOOLEAN_COLUMNS = Object.freeze({
  ai_cost_settings: ['allow_paid_provider'],
  ai_prompt_templates: ['active'],
  customer_contacts: ['is_primary_decision_maker'],
  customer_type_profiles: ['active'],
  customers: ['is_test_data'],
  lead_enrichment_jobs: ['retry_failed'],
  organization_bank_accounts: ['active', 'is_default'],
  product_attribute_category_links: [
    'required', 'filterable', 'show_on_product', 'show_on_quote', 'show_on_pi',
    'internal_only', 'can_be_variant_axis', 'searchable', 'show_on_storefront'
  ],
  product_attribute_definitions: [
    'active', 'show_in_library', 'show_on_website', 'show_in_quote', 'show_in_pi', 'internal_only'
  ],
  product_attribute_options: ['active'],
  product_categories: ['active'],
  product_price_rules: ['active'],
  product_variant_axes: ['active'],
  product_variants: ['price_manual_override'],
  products: ['request_quote_enabled', 'customization_available'],
  sales_inquiry_products: ['selected'],
  supplier_import_mapping_profiles: ['active']
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tableNames(sql) {
  const names = new Set();
  const pattern = /\b(?:INSERT\s+(?:OR\s+IGNORE\s+)?INTO|UPDATE|FROM|JOIN)\s+["`]?([a-z_][a-z0-9_]*)["`]?/gi;
  for (const match of String(sql).matchAll(pattern)) names.add(match[1].toLowerCase());
  return names;
}

function questionMarkOrdinal(sql, position) {
  let ordinal = 0;
  let quote = null;
  for (let index = 0; index < position; index += 1) {
    const character = sql[index];
    if ((character === "'" || character === '"') && sql[index - 1] !== '\\') {
      quote = quote === character ? null : (quote || character);
    } else if (character === '?' && !quote) ordinal += 1;
  }
  return ordinal;
}

function booleanParameterOrdinals(sql, columns) {
  const ordinals = new Set();
  for (const column of columns) {
    const name = escapeRegex(column);
    const patterns = [
      new RegExp(`\\b(?:[a-z_][a-z0-9_]*\\.)?${name}\\b\\s*=\\s*\\?`, 'gi')
    ];
    for (const pattern of patterns) {
      for (const match of sql.matchAll(pattern)) {
        const questionMark = match.index + match[0].lastIndexOf('?');
        ordinals.add(questionMarkOrdinal(sql, questionMark));
      }
    }
  }

  const insert = /^\s*INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+["`]?[a-z_][a-z0-9_]*["`]?\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/is.exec(sql);
  if (insert) {
    const insertColumns = insert[1].split(',').map(value => value.trim().replace(/^["`]|["`]$/g, '').toLowerCase());
    const values = insert[2].split(',').map(value => value.trim());
    const valuesOffset = insert.index + insert[0].indexOf(insert[2]);
    let cursor = 0;
    values.forEach((value, index) => {
      const localOffset = insert[2].indexOf(value, cursor);
      cursor = localOffset + value.length;
      if (columns.has(insertColumns[index]) && value === '?') {
        ordinals.add(questionMarkOrdinal(sql, valuesOffset + localOffset));
      }
    });
  }
  return ordinals;
}

function replaceBooleanLiterals(sql, columns) {
  let normalized = sql;
  for (const column of columns) {
    const name = escapeRegex(column);
    normalized = normalized
      .replace(new RegExp(`(\\b(?:[a-z_][a-z0-9_]*\\.)?${name}\\b\\s*(?:=|<>|!=)\\s*)1\\b`, 'gi'), '$1TRUE')
      .replace(new RegExp(`(\\b(?:[a-z_][a-z0-9_]*\\.)?${name}\\b\\s*(?:=|<>|!=)\\s*)0\\b`, 'gi'), '$1FALSE');
  }
  return normalized;
}

function replaceInsertBooleanLiterals(sql, columns) {
  const insert = /^(\s*INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+["`]?[a-z_][a-z0-9_]*["`]?\s*\()([^)]+)(\)\s*VALUES\s*\()([^)]+)(\))/is.exec(sql);
  if (!insert) return sql;
  const insertColumns = insert[2].split(',').map(value => value.trim().replace(/^["`]|["`]$/g, '').toLowerCase());
  const values = insert[4].split(',').map(value => value.trim());
  const normalizedValues = values.map((value, index) => {
    if (!columns.has(insertColumns[index])) return value;
    if (value === '1') return 'TRUE';
    if (value === '0') return 'FALSE';
    return value;
  });
  return `${insert[1]}${insert[2]}${insert[3]}${normalizedValues.join(',')}${insert[5]}${sql.slice(insert[0].length)}`;
}

function placeholders(sql) {
  let index = 0;
  let quote = null;
  let output = '';
  for (let position = 0; position < sql.length; position += 1) {
    const character = sql[position];
    if ((character === "'" || character === '"') && sql[position - 1] !== '\\') {
      quote = quote === character ? null : (quote || character);
    }
    output += character === '?' && !quote ? `$${++index}` : character;
  }
  return output;
}

export function normalizePostgresQuery(value, inputParams = []) {
  let sql = String(value).trim().replace(/COLLATE\s+NOCASE/gi, '');
  const ignore = /^INSERT\s+OR\s+IGNORE\s+INTO/i.test(sql);
  const tables = tableNames(sql);
  const columns = new Set([...tables].flatMap(table => POSTGRES_BOOLEAN_COLUMNS[table] || []));
  const booleanParams = booleanParameterOrdinals(sql, columns);
  const params = [...inputParams];
  for (const ordinal of booleanParams) {
    if (params[ordinal] === 0 || params[ordinal] === 1) params[ordinal] = params[ordinal] === 1;
  }
  sql = replaceInsertBooleanLiterals(sql, columns);
  sql = replaceBooleanLiterals(sql, columns);
  if (ignore) {
    sql = sql.replace(/^INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');
    sql = `${sql.replace(/;$/, '')} ON CONFLICT DO NOTHING`;
  }
  if (/^BEGIN\s+IMMEDIATE$/i.test(sql)) sql = 'BEGIN';
  return { sql: placeholders(sql), params };
}

export { POSTGRES_BOOLEAN_COLUMNS };
