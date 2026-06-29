import en from './locales/en.js';
import zhCN from './locales/zh-CN.js';

const STORAGE_KEY = 'rsp.locale';
const DEFAULT_LOCALE = 'en';
const resources = Object.freeze({ en, 'zh-CN': zhCN });

let activeLocale = resources[localStorage.getItem(STORAGE_KEY)] ? localStorage.getItem(STORAGE_KEY) : DEFAULT_LOCALE;

function readPath(object, path) {
  return path.split('.').reduce((value, segment) => value?.[segment], object);
}

export function t(key, variables = {}) {
  const template = readPath(resources[activeLocale], key) ?? readPath(resources[DEFAULT_LOCALE], key) ?? key;
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, name) => variables[name] ?? `{{${name}}}`);
}

export function getLocale() {
  return activeLocale;
}

export function setLocale(locale) {
  if (!resources[locale]) return false;
  activeLocale = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = resources[locale].meta.htmlLang;
  return true;
}

export function getSupportedLocales() {
  return Object.keys(resources).map(code => ({ code, name: resources[code].meta.name }));
}

export function localeForIntl() {
  return activeLocale === 'zh-CN' ? 'zh-CN' : 'en-US';
}

setLocale(activeLocale);
