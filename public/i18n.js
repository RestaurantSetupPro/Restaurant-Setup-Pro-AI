import en from './locales/en.js';
import zhCN from './locales/zh-CN.js';

const STORAGE_KEY = 'rsp.locale';
const DEFAULT_LOCALE = 'en';
const resources = Object.freeze({ en, 'zh-CN': zhCN });
const storage = globalThis.localStorage || { getItem: () => null, setItem: () => {} };

let activeLocale = resources[storage.getItem(STORAGE_KEY)] ? storage.getItem(STORAGE_KEY) : DEFAULT_LOCALE;

function readPath(object, path) {
  return path.split('.').reduce((value, segment) => value?.[segment], object);
}

function flattenStrings(object, prefix = '', output = []) {
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') output.push([path, value]);
    else if (value && typeof value === 'object') flattenStrings(value, path, output);
  }
  return output;
}

const englishSourceKeys = new Map(flattenStrings(resources[DEFAULT_LOCALE]).map(([key, value]) => [value, key]));

function readableFallback(key) {
  const leaf = String(key).split('.').at(-1) || '';
  return leaf.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/^./, value => value.toUpperCase());
}

export function t(key, variables = {}) {
  const template = readPath(resources[activeLocale], key) ?? readPath(resources[DEFAULT_LOCALE], key);
  if (template == null) {
    if (['localhost', '127.0.0.1'].includes(globalThis.location?.hostname)) console.warn(`[i18n] Missing translation: ${key}`);
    return readableFallback(key);
  }
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, name) => variables[name] ?? `{{${name}}}`);
}

export function translateVisibleText(value) {
  const source = String(value ?? '');
  const key = englishSourceKeys.get(source.trim());
  if (key) return source.replace(source.trim(), t(key));
  const counted = source.trim().match(/^(.*?)\s*\((\d+)\)$/);
  if (counted) {
    const labelKey = englishSourceKeys.get(counted[1]);
    if (labelKey) return activeLocale === 'zh-CN' ? `${t(labelKey)}（${counted[2]}）` : `${t(labelKey)} (${counted[2]})`;
  }
  return source;
}

export function localizeDom(root = document) {
  if (!root) return;
  const nodes = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const pending = [];
  while (nodes.nextNode()) pending.push(nodes.currentNode);
  for (const node of pending) {
    if (node.parentElement?.closest('script,style,pre,code,textarea,[data-no-translate]')) continue;
    const translated = translateVisibleText(node.nodeValue);
    if (translated !== node.nodeValue) node.nodeValue = translated;
  }
  const elements = root.querySelectorAll?.('[placeholder],[title],[aria-label]') || [];
  for (const element of elements) {
    for (const attribute of ['placeholder', 'title', 'aria-label']) {
      if (element.hasAttribute(attribute)) element.setAttribute(attribute, translateVisibleText(element.getAttribute(attribute)));
    }
  }
}

export function getLocale() {
  return activeLocale;
}

export function setLocale(locale) {
  if (!resources[locale]) return false;
  activeLocale = locale;
  storage.setItem(STORAGE_KEY, locale);
  if (globalThis.document) document.documentElement.lang = resources[locale].meta.htmlLang;
  return true;
}

export function getSupportedLocales() {
  return Object.keys(resources).map(code => ({ code, name: resources[code].meta.name }));
}

export function localeForIntl() {
  return activeLocale === 'zh-CN' ? 'zh-CN' : 'en-US';
}

function parseUtc(value) {
  if (!value) return null;
  const source = String(value);
  const parsed = new Date(source.includes('T') ? source : `${source.replace(' ', 'T')}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatLocalDateTime(value, options = {}) {
  const parsed = parseUtc(value);
  if (!parsed) return '—';
  const defaults = activeLocale === 'zh-CN'
    ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }
    : { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  return new Intl.DateTimeFormat(localeForIntl(), { ...defaults, ...options }).format(parsed).replaceAll('/', '-');
}

export function formatLocalDate(value) {
  if (!value) return '—';
  const parsed = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return new Intl.DateTimeFormat(localeForIntl(), activeLocale === 'zh-CN'
    ? { year: 'numeric', month: '2-digit', day: '2-digit' }
    : { year: 'numeric', month: 'short', day: 'numeric' }).format(parsed).replaceAll('/', '-');
}

export function formatLocalMoney(value, currency = 'USD', options = {}) {
  const safeCurrency = ['USD', 'CNY', 'MYR', 'THB', 'EUR', 'GBP'].includes(currency) ? currency : 'USD';
  return new Intl.NumberFormat(localeForIntl(), { style: 'currency', currency: safeCurrency, currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2, ...options }).format(Number(value || 0));
}

export function formatLocalQuantity(value, unitKey = 'salesOs.units.companies') {
  return t(unitKey, { count: new Intl.NumberFormat(localeForIntl()).format(Number(value || 0)) });
}

export function formatLocalPercent(value) {
  return new Intl.NumberFormat(localeForIntl(), { style: 'percent', maximumFractionDigits: 1 }).format(Number(value || 0) / 100);
}

setLocale(activeLocale);
