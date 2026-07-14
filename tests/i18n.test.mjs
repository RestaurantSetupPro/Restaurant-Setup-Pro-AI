import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import en from '../public/locales/en.js';
import zh from '../public/locales/zh-CN.js';
import { formatLocalDateTime, formatLocalMoney, formatLocalPercent, formatLocalQuantity, getSupportedLocales, setLocale, t, translateVisibleText } from '../public/i18n.js';

const appSource = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const i18nSource = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

function flatten(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' ? flatten(value, path) : [path];
  });
}

test('English and Chinese resources have identical key coverage', () => {
  assert.deepEqual(flatten(zh).sort(), flatten(en).sort());
});

test('all requested navigation modules and product fields are localized', () => {
  const navigation = ['dashboard', 'myTasks', 'inquiries', 'salesCustomers', 'imports', 'aiKnowledgeCenter', 'images', 'proposals', 'salesQuotesPi', 'salesOrders', 'cases', 'salesAi', 'contentAi', 'coreFoundation', 'debugCenter', 'settings', 'help'];
  const fields = ['sku', 'productName', 'category', 'material', 'size', 'priceRange', 'leadTime', 'moq', 'tags', 'status'];
  for (const key of navigation) {
    assert.ok(en.nav[key]);
    assert.ok(zh.nav[key]);
    assert.notEqual(en.nav[key], zh.nav[key]);
  }
  for (const key of fields) {
    assert.ok(en.fields[key]);
    assert.ok(zh.fields[key]);
  }
});

test('the app uses the shared i18n module and exposes a language switcher', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(appSource, /from '\.\/i18n\.js'/);
  assert.match(html, /id="language-button"/);
  assert.match(html, /id="language-menu"/);
});

test('Sales OS menus, Opportunity tabs, actions, terms, statuses, and history are bilingual', () => {
  for (const group of ['workspace','opportunities','products','commercial','system']) assert.ok(en.salesOs.groups[group] && zh.salesOs.groups[group]);
  for (const tab of ['dashboard','discovery','strategies','tasks','leads','customers','priority']) assert.ok(en.salesOs.tabs[tab] && zh.salesOs.tabs[tab]);
  for (const action of ['saveDraft','submitReview','approve','markReady','estimateExecution','runAi','markReviewed','convertCustomer','discard','viewSource']) assert.ok(en.salesOs.actions[action] && zh.salesOs.actions[action]);
  for (const status of ['needsReview','superseded','new','reviewed','running','paused','partiallyCompleted','failed','interrupted','aiQualified','aiPending','aiRunning','aiFailed','aiBlocked']) assert.ok(en.salesOs.status[status] && zh.salesOs.status[status]);
  assert.equal(new Set(Object.values(zh.roles)).size, 5);
});

test('five internal roles have the approved bilingual display names', () => {
  assert.deepEqual(Object.fromEntries(['Admin','Owner','Sales','Designer','VA'].map(role => [role, en.roles[role]])), {
    Admin: 'System Administrator', Owner: 'Business Administrator', Sales: 'Sales Representative', Designer: 'Solution Specialist', VA: 'Operations Specialist'
  });
  assert.deepEqual(Object.fromEntries(['Admin','Owner','Sales','Designer','VA'].map(role => [role, zh.roles[role]])), {
    Admin: '系统管理员', Owner: '企业管理员', Sales: '销售人员', Designer: '方案专员', VA: '运营专员'
  });
});

test('language selector exposes only English and Simplified Chinese once each', () => {
  assert.deepEqual(getSupportedLocales(), [
    { code: 'en', name: 'English' },
    { code: 'zh-CN', name: '简体中文' }
  ]);
  assert.equal(new Set(getSupportedLocales().map(locale => locale.code)).size, 2);
  assert.equal(new Set(getSupportedLocales().map(locale => locale.name)).size, 2);
});

test('language option names are not retranslated by the legacy DOM localizer',()=>{
  assert.match(appSource,/data-language="\$\{locale\.code\}" data-no-translate/);
});

test('missing keys are humanized and never exposed as internal translation paths', () => {
  setLocale('en');
  assert.equal(t('internal.missing_key'), 'Missing key');
  assert.doesNotMatch(t('internal.missing_key'), /internal\.|_/);
});

test('visible legacy text and counted Opportunity tabs localize without unresolved keys', () => {
  setLocale('zh-CN');
  assert.equal(translateVisibleText('Search Tasks (6)'), '搜索任务（6）');
  assert.equal(translateVisibleText('AI Qualification Pending'), 'AI评估待处理');
  assert.equal(translateVisibleText('Unknown'), '未知');
  setLocale('en');
  assert.equal(translateVisibleText('Search Tasks (6)'), 'Search Tasks (6)');
});

test('dates, money, quantities, and percentages follow the active locale', () => {
  setLocale('zh-CN');
  assert.match(formatLocalDateTime('2026-07-13T22:30:00Z'), /2026-07-13/);
  assert.match(formatLocalMoney(0.18), /USD\s*0\.18/);
  assert.equal(formatLocalQuantity(50), '50家公司');
  assert.equal(formatLocalPercent(80), '80%');
  setLocale('en');
  assert.match(formatLocalDateTime('2026-07-13T22:30:00Z'), /Jul 13, 2026/);
  assert.equal(formatLocalQuantity(50), '50 companies');
});

test('language preference persists and user preference is applied before shell rendering', () => {
  assert.match(i18nSource, /STORAGE_KEY = 'rsp\.locale'/);
  assert.match(i18nSource, /storage\.setItem\(STORAGE_KEY, locale\)/);
  assert.match(appSource, /state\.user\?\.preferred_locale \|\| state\.user\?\.locale/);
  assert.match(appSource, /if \(preferredLocale\) setLocale\(preferredLocale\)/);
});

test('render boundary localizes legacy templates and no Chinese copy is hardcoded in app.js', () => {
  assert.match(appSource, /startLocalizationObserver\(\)/);
  assert.match(appSource, /localizeDom\(\$\('#page'\)\)/);
  assert.doesNotMatch(appSource, /[\u3400-\u9fff]/);
});

test('known legacy labels, empty states, and Workflow 1C copy have centralized bilingual mappings', () => {
  for (const key of ['addProduct','createCategory','createAttribute','createVariant','pricingSummary','productFoundation','noProducts','noVariants','importReview','approveImport']) {
    assert.ok(en.salesOs.legacyUi[key] && zh.salesOs.legacyUi[key]);
  }
  setLocale('zh-CN');
  assert.equal(translateVisibleText('No products yet.'), '暂无产品。');
  assert.equal(translateVisibleText('Back to Lead Pool'), '返回潜在线索池');
  assert.equal(translateVisibleText('Controlled Rules/Mock execution. No external platform is called.'), '受控Rules/Mock执行，不调用外部平台。');
});

test('desktop and mobile layout contracts preserve wrapping and safe horizontal scrolling', () => {
  assert.match(stylesSource, /\.page \{ max-width: 1540px/);
  assert.match(stylesSource, /@media\(max-width:1440px\)/);
  assert.match(stylesSource, /@media\(max-width:1280px\)/);
  assert.match(stylesSource, /\.table-scroll \{ overflow-x: auto; \}/);
  assert.match(stylesSource, /\.nav-item span \{[^}]*overflow-wrap: anywhere;/);
  assert.match(stylesSource, /\.page-title h1,[^{]*\.button,[^{]*\{overflow-wrap:anywhere/);
});
