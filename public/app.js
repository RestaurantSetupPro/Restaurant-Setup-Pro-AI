import { getLocale, getSupportedLocales, localeForIntl, setLocale, t } from './i18n.js';
import { uniqueNavigationItems } from './navigation.js';

const state = {
  user: null,
  route: 'dashboard',
  dashboard: null,
  products: null,
  productDetail: null,
  knowledgeDashboard: null,
  opportunities: null,
  imports: null,
  proposals: null,
  team: null,
  foundation: null,
  foundationTab: 'configs',
  debugCenter: null,
  opportunityIntelligence: null,
  opportunityView: 'dashboard',
  showArchivedStrategies: false,
  customerDetail: null
  ,salesWorkspace: null, salesInquiry: null, salesQuote: null
};

const icons = {
  dashboard: '<path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z"/>',
  products: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 21v-8.9"/>',
  imports: '<path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 17v3h14v-3"/>',
  images: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-4.5-4.5L8 19"/>',
  proposals: '<path d="M6 3h9l4 4v14H6V3Z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>',
  cases: '<path d="M4 6h6l2 2h8v11H4V6Z"/><path d="M8 6V4h7v4"/>',
  crm: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2M16 4.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 4.8V20"/>',
  'sales-ai': '<path d="M4 19V9m5 10V5m5 14v-7m5 7V3"/><path d="m3 6 5-3 5 5 7-6"/>',
  'content-ai': '<path d="M4 4h16v16H4V4Z"/><path d="M8 8h8M8 12h5M8 16h7"/><path d="m18 14 .7 1.3L20 16l-1.3.7L18 18l-.7-1.3L16 16l1.3-.7L18 14Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  'core-foundation': '<path d="M4 5h7v6H4V5Zm9 0h7v6h-7V5ZM4 13h7v6H4v-6Zm9 0h7v6h-7v-6Z"/>',
  'debug-center': '<path d="M9 3h6v3H9V3ZM8 8h8a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-5a4 4 0 0 1 4-4Z"/><path d="M9 13h.01M15 13h.01M9 17h6M4 13H2M22 13h-2"/>',
  'opportunity-intelligence': '<path d="M4 20V9l8-6 8 6v11H4Z"/><path d="M8 20v-6h8v6M8 10h.01M12 10h.01M16 10h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 8.5h18C21 15 18 15 18 8Z"/><path d="M10 20h4"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m7 10 5 5 5-5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  eye: '<path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  eyeoff: '<path d="m4 4 16 16M10.5 6.7c.5-.1 1-.2 1.5-.2 6 0 9.5 5.5 9.5 5.5a17 17 0 0 1-2.2 2.8M6.3 7.5A17.7 17.7 0 0 0 2.5 12S6 17.5 12 17.5c1.5 0 2.8-.3 3.9-.8M9.8 9.8a3 3 0 0 0 4.4 4.4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.3 2.1c-.7.3-1.1.8-1.1 1.7M12 16.5h.01"/>',
  logout: '<path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  money: '<circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.7-.7-1.7-1-3-1-1.7 0-3 .9-3 2s1 1.8 3 2.3 3 1.2 3 2.5-1.3 2.2-3 2.2c-1.3 0-2.5-.4-3.3-1.2M12 5.5v13"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2"/>',
  sparkles: '<path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3ZM18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2ZM5.5 13l.8 2.2 2.2.8-2.2.8L5.5 19l-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  upload: '<path d="M12 16V4m0 0L8 8m4-4 4 4"/><path d="M4 15v5h16v-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18h1.5a1.5 1.5 0 0 0 0-3H12a1.6 1.6 0 0 1 0-3h2a7 7 0 0 0 0-14h-2Z"/><circle cx="7.5" cy="10" r=".8"/><circle cx="9" cy="6.5" r=".8"/><circle cx="14" cy="6" r=".8"/><circle cx="17" cy="9" r=".8"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  document: '<path d="M6 3h9l4 4v14H6V3Z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2M16 4.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 4.8V20"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  building: '<path d="M4 21V5l8-3 8 3v16M8 8h1M15 8h1M8 12h1M15 12h1M8 16h1M15 16h1M10 21v-4h4v4"/>',
  dots: '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'
};

function icon(name, className = '') {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.dashboard}</svg>`;
}

const navItems = [
  { groupKey: 'common.workspace', route: 'new-inquiry', labelKey: 'nav.newInquiry' },
  { groupKey: 'common.workspace', route: 'sales-customers', labelKey: 'nav.salesCustomers' },
  { groupKey: 'common.workspace', route: 'sales-quotes', labelKey: 'nav.salesQuotes' },
  { groupKey: 'common.workspace', route: 'sales-orders', labelKey: 'nav.salesOrders' },
  { groupKey: 'common.workspace', route: 'sales-tasks', labelKey: 'nav.salesTasks' },
  { groupKey: 'common.workspace', route: 'dashboard', labelKey: 'nav.dashboard' },
  { groupKey: 'common.workspace', route: 'products', labelKey: 'nav.products', hidden: true },
  { groupKey: 'common.productLibrary', route: 'product-library-products', labelKey: 'nav.libraryProducts', icon: 'products' },
  { groupKey: 'common.productLibrary', route: 'product-library-categories', labelKey: 'nav.libraryCategories', icon: 'briefcase' },
  { groupKey: 'common.productLibrary', route: 'product-library-tags', labelKey: 'nav.libraryTags', icon: 'tag' },
  { groupKey: 'common.productLibrary', route: 'product-library-attributes', labelKey: 'nav.libraryAttributes', icon: 'filter' },
  { groupKey: 'common.productLibrary', route: 'product-library-variants', labelKey: 'nav.libraryVariants', icon: 'palette' },
  { groupKey: 'common.workspace', route: 'knowledge-dashboard', labelKey: 'nav.knowledgeDashboard' },
  { groupKey: 'common.growth', route: 'opportunity-intelligence', labelKey: 'nav.opportunityIntelligence' },
  { groupKey: 'common.workspace', route: 'imports', labelKey: 'nav.imports' },
  { groupKey: 'common.workspace', route: 'images', labelKey: 'nav.images' },
  { groupKey: 'common.workspace', route: 'proposals', labelKey: 'nav.proposals', badge: '3' },
  { groupKey: 'common.workspace', route: 'cases', labelKey: 'nav.cases' },
  { groupKey: 'common.growth', route: 'crm', labelKey: 'nav.crm', badge: '12' },
  { groupKey: 'common.growth', route: 'sales-ai', labelKey: 'nav.salesAi' },
  { groupKey: 'common.growth', route: 'content-ai', labelKey: 'nav.contentAi' },
  { groupKey: 'common.system', route: 'core-foundation', labelKey: 'nav.coreFoundation' },
  { groupKey: 'common.system', route: 'debug-center', labelKey: 'nav.debugCenter' },
  { groupKey: 'common.system', route: 'settings', labelKey: 'nav.settings' }
];
const uniqueNavItems = Object.freeze(uniqueNavigationItems(navItems.map(item => ({ ...item, id: item.id || item.route }))).map(item => Object.freeze(item)));

const roleEmails = {
  Admin: 'admin@rspro.ai', Owner: 'owner@rspro.ai', 'Sales Admin': 'salesadmin@rspro.ai', Sales: 'sales@rspro.ai', Designer: 'designer@rspro.ai', VA: 'va@rspro.ai'
};
let demoMode = true;

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[char]);
const money = value => new Intl.NumberFormat(localeForIntl(), { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value || 0));
const quoteMoney = (value, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: ['USD','CNY','MYR','THB','EUR','GBP'].includes(currency) ? currency : 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
const shortMoney = value => Number(value) >= 1_000_000 ? `$${(Number(value) / 1_000_000).toFixed(2)}M` : `$${Math.round(Number(value) / 1000)}K`;
const titleForRoute = route => t(uniqueNavItems.find(item => item.route === route)?.labelKey || 'nav.dashboard');
const allowed = route => state.user?.permissions.includes(route);
const statusClass = status => String(status || '').toLowerCase().replaceAll('_', '-').replaceAll(' ', '-');
const statusKey = status => ({
  'new lead': 'newLead', qualified: 'qualified', proposal: 'proposal', negotiation: 'negotiation', won: 'won', lost: 'lost',
  approved: 'approved', review: 'review', draft: 'draft', archived: 'archived', completed: 'completed', failed: 'failed',
  queued: 'queued', validating: 'validating', 'internal review': 'internalReview', sent: 'sent', published: 'published',
  active: 'active', inactive: 'inactive', invited: 'invited', disabled: 'disabled', idea: 'idea', ready: 'ready', generating: 'generating'
})[String(status || '').replaceAll('_', ' ').toLowerCase()];
const statusLabel = status => statusKey(status) ? t(`status.${statusKey(status)}`) : String(status || '').replaceAll('_', ' ');

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: options.body ? { 'Content-Type': 'application/json', ...(options.headers || {}) } : options.headers,
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Something went wrong.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function toast(message) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  $('#toast-root').append(node);
  setTimeout(() => node.remove(), 3200);
}

function setupStaticIcons() {
  $('#password-toggle').innerHTML = icon('eye');
  $('#sidebar-close').innerHTML = icon('close');
  $('#sidebar-open').innerHTML = icon('menu');
  $('#search-icon').innerHTML = icon('search');
  $('#modal-search-icon').innerHTML = icon('search');
  $('#bell-icon').innerHTML = icon('bell');
  $('#support-icon').innerHTML = icon('help');
  $('#language-icon').innerHTML = icon('globe');
  $('#language-chevron').innerHTML = icon('down');
}

function updateStaticLocale() {
  const text = {
    '#login-story-eyebrow': 'login.storyEyebrow', '#login-story-title': 'login.storyTitle', '#login-story-body': 'login.storyBody',
    '#login-proof-title': 'login.proofTitle', '#login-proof-body': 'login.proofBody', '#login-kicker': 'login.kicker',
    '#login-welcome': 'login.welcome', '#login-subtitle': 'login.subtitle', '#login-email-label': 'login.email',
    '#login-password-label': 'login.password', '#login-submit-label': 'login.signIn', '#login-demo-label': 'login.demoRoles',
    '#login-demo-password': 'login.demoPassword', '#login-footer': 'login.privateWorkspace', '#support-title': 'shell.supportTitle',
    '#support-body': 'shell.supportBody', '#global-search-label': 'common.searchWorkspace', '#command-navigate': 'common.navigate', '#command-open': 'common.open'
  };
  Object.entries(text).forEach(([selector, key]) => { const node = $(selector); if (node) node.textContent = t(key); });
  $('#command-query').placeholder = t('common.searchPlaceholder');
  $('#password-toggle').ariaLabel = $('#password').type === 'password' ? t('login.showPassword') : t('login.hidePassword');
  $('#notifications').ariaLabel = t('shell.notifications');
  $('#language-current').textContent = getSupportedLocales().find(locale => locale.code === getLocale())?.name || 'English';
  $('#language-menu').dataset.label = t('common.language');
  document.title = `${t('nav.dashboard')} · Restaurant Setup Pro`;
  renderDemoRoles();
  renderLanguageMenu();
}

function renderDemoRoles() {
  $('.demo-login')?.classList.toggle('is-hidden', !demoMode);
  if (!demoMode) return;
  $('#demo-roles').innerHTML = Object.keys(roleEmails).map(role => `<button type="button" class="demo-role" data-demo-role="${role}">${t(`roles.${role}`)}</button>`).join('');
}

function renderLanguageMenu() {
  $('#language-menu').innerHTML = getSupportedLocales().map(locale => `<button type="button" class="language-option ${locale.code === getLocale() ? 'is-active' : ''}" data-language="${locale.code}"><span>${esc(locale.name)}</span>${locale.code === getLocale() ? icon('check') : ''}</button>`).join('');
}

async function changeLanguage(locale) {
  if (!setLocale(locale)) return;
  updateStaticLocale();
  $('#language-menu').classList.add('is-hidden');
  $('#language-button').setAttribute('aria-expanded', 'false');
  if (state.user) {
    buildShell();
    await navigate(state.route, true);
  }
}

function setupLogin() {
  renderDemoRoles();
  $('#demo-roles').addEventListener('click', event => {
    const button = event.target.closest('[data-demo-role]');
    if (!button) return;
    $('#email').value = roleEmails[button.dataset.demoRole];
    $('#password').value = 'Welcome123!';
    $('#login-error').textContent = '';
  });
  $('#password-toggle').addEventListener('click', () => {
    const password = $('#password');
    password.type = password.type === 'password' ? 'text' : 'password';
    $('#password-toggle').innerHTML = icon(password.type === 'password' ? 'eye' : 'eyeoff');
    $('#password-toggle').ariaLabel = password.type === 'password' ? t('login.showPassword') : t('login.hidePassword');
  });
  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('#login-submit');
    $('#login-error').textContent = '';
    button.disabled = true;
    button.firstElementChild.textContent = t('login.signingIn');
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: $('#email').value, password: $('#password').value }) });
      state.user = data.user;
      enterApp();
    } catch (error) {
      $('#login-error').textContent = error.status === 401 ? t('login.invalidCredentials') : t('access.genericError');
    } finally {
      button.disabled = false;
      button.firstElementChild.textContent = t('login.signIn');
    }
  });
}

function enterApp() {
  $('#login-view').classList.add('is-hidden');
  $('#app-view').classList.remove('is-hidden');
  buildShell();
  const requested = location.hash.slice(1);
  const defaultRoute = state.user.role === 'Sales' ? 'new-inquiry' : 'dashboard';
  navigate(requested && uniqueNavItems.some(item => item.route === requested) && allowed(requested) ? requested : defaultRoute, true);
}

function exitApp() {
  state.user = null;
  Object.keys(state).filter(key => !['user', 'route'].includes(key)).forEach(key => state[key] = null);
  $('#app-view').classList.add('is-hidden');
  $('#login-view').classList.remove('is-hidden');
  $('#profile-menu').classList.add('is-hidden');
  history.replaceState(null, '', location.pathname);
  updateStaticLocale();
}

function buildShell() {
  const salesRoutes = new Set(['new-inquiry','sales-customers','sales-quotes','sales-orders','sales-tasks']);
  const renderedItems = uniqueNavItems.filter(item => !item.hidden && allowed(item.route) && (state.user.role !== 'Sales' || salesRoutes.has(item.route) || item.route === 'knowledge-dashboard' || item.route.startsWith('product-library-')));
  const renderedIds = new Set(renderedItems.map(item => item.id));
  if (renderedIds.size !== renderedItems.length) throw new Error('Navigation menu IDs must be unique.');
  let lastGroup = '';
  const template=document.createElement('template');
  template.innerHTML = renderedItems.map(item => {
    const group = item.groupKey !== lastGroup ? `<div class="nav-label">${t(item.groupKey)}</div>` : '';
    lastGroup = item.groupKey;
    return `${group}<a class="nav-item" href="#${item.route}" data-route="${item.route}">${icon(item.icon||item.route)}<span>${t(item.labelKey)}</span>${item.badge ? `<em class="nav-badge">${item.badge}</em>` : ''}</a>`;
  }).join('');
  $('#main-nav').replaceChildren(template.content.cloneNode(true));
  $('#sidebar-user').innerHTML = `<span class="avatar">${esc(state.user.initials)}</span><span class="sidebar-user-copy"><strong>${esc(state.user.name)}</strong><small>${t(`roles.${state.user.role}`)} · ${t('common.workspace')}</small></span><button class="icon-button" data-action="profile" aria-label="${t('shell.accountMenu')}">${icon('dots')}</button>`;
  $('#profile-button').innerHTML = `<span class="avatar">${esc(state.user.initials)}</span>${icon('down')}`;
  $('#profile-menu').innerHTML = `<div class="profile-summary"><strong>${esc(state.user.name)}</strong><small>${esc(state.user.email)} · ${t(`roles.${state.user.role}`)}</small></div><button data-action="my-profile">${icon('users')} ${t('shell.myProfile')}</button><button data-action="logout">${icon('logout')} ${t('shell.signOut')}</button>`;
}

function closeSidebar() {
  $('#sidebar').classList.remove('is-open');
  $('#sidebar-scrim').classList.remove('is-open');
}

async function navigate(route, replace = false) {
  const known = uniqueNavItems.some(item => item.route === route);
  route = known ? route : 'dashboard';
  state.route = route;
  if (replace) history.replaceState(null, '', `#${route}`);
  else if (location.hash !== `#${route}`) location.hash = route;
  closeSidebar();
  $('#profile-menu').classList.add('is-hidden');
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('is-active', item.dataset.route === route));
  $('#breadcrumbs').innerHTML = `<span>${t('common.workspace')}</span>${icon('chevron')}<strong>${esc(titleForRoute(route))}</strong>`;
  document.title = `${titleForRoute(route)} · Restaurant Setup Pro`;
  if (!allowed(route)) return renderRestricted(route);
  $('#page').innerHTML = `<div class="skeleton"></div><div class="metrics-grid section-gap"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`;
  $('#page').focus({ preventScroll: true });
  const renderers = {
    dashboard: renderDashboard,
    products: renderProducts,
    'product-library-products': renderProductLibraryProducts,
    'product-library-categories': renderProductLibraryCategories,
    'product-library-tags': renderProductLibraryTags,
    'product-library-attributes': renderProductLibraryAttributes,
    'product-library-variants': renderProductLibraryVariants,
    'knowledge-dashboard': renderKnowledgeDashboard,
    'opportunity-intelligence': renderOpportunityIntelligence,
    imports: renderImports,
    images: renderImages,
    proposals: renderProposals,
    cases: renderCases,
    crm: renderCrm,
    'sales-ai': renderSalesAI,
    'content-ai': renderContentAI,
    'core-foundation': renderFoundation,
    'debug-center': renderDebugCenter,
    settings: renderSettings
    ,'new-inquiry': renderNewInquiry, 'sales-customers': renderSalesCustomers, 'sales-quotes': renderSalesQuotes,
    'sales-orders': renderSalesOrders, 'sales-tasks': renderSalesTasks
  };
  try {
    await renderers[route]();
  } catch (error) {
    if (error.status === 401) return exitApp();
    if (error.status === 403) return renderRestricted(route);
    $('#page').innerHTML = `<div class="restricted"><div class="restricted-card"><span class="metric-icon">${icon('help')}</span><h1>${t('access.loadError')}</h1><p>${t('access.genericError')}</p><button class="button button--soft" data-action="retry">${t('common.retry')}</button></div></div>`;
  }
}

function pageHeader(title, description, action = '', secondary = '') {
  return `<div class="page-header"><div class="page-title"><h1>${title}</h1><p>${description}</p></div><div class="page-actions">${secondary}${action}</div></div>`;
}

function panelHeader(title, subtitle = '', actionLabel = '', route = '') {
  return `<div class="panel-header"><div class="panel-title"><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${actionLabel ? `<button class="text-button" ${route ? `data-route="${route}"` : ''}>${actionLabel}${icon('arrow')}</button>` : ''}</div>`;
}

function badge(status) {
  return `<span class="stage stage--${statusClass(status)}">${esc(statusLabel(status))}</span>`;
}

function userAvatar(initials, name = '') {
  return `<span class="owner-cell"><span class="mini-avatar">${esc(initials || '--')}</span>${name ? `<span>${esc(name)}</span>` : ''}</span>`;
}

async function renderDashboard() {
  const { metrics, pipeline, knowledge, productIntelligence, opportunityIntelligence } = await api('/api/dashboard');
  state.dashboard = { metrics, pipeline, knowledge, productIntelligence, opportunityIntelligence };
  const today = new Intl.DateTimeFormat(localeForIntl(), { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
  const firstName = state.user.name.split(' ')[0];
  $('#page').innerHTML = `
    ${pageHeader(t('dashboard.greeting', { name: esc(firstName) }), t(state.user.role === 'Sales' ? 'dashboard.subtitleSales' : 'dashboard.subtitleAll'), '', `<span class="date-chip">${icon('calendar')}${today}</span>`)}
    <section class="metrics-grid">
      ${metricCard(t('dashboard.openPipeline'), shortMoney(metrics.openPipeline), '+12.4%', 'money')}
      ${metricCard(t('dashboard.activeOpportunities'), metrics.activeOpportunities, t('dashboard.acrossStages'), 'briefcase', 'gold', true)}
      ${metricCard(t('dashboard.proposalsInProgress'), metrics.proposals, t('dashboard.dueThisWeek'), 'proposals', 'blue', true)}
      ${metricCard(t('dashboard.salesReadyProducts'), metrics.approvedProducts, t('dashboard.addedThisMonth'), 'products', 'purple')}
    </section>
    <article class="panel section-gap">
      ${panelHeader('Opportunity Intelligence Metrics', 'Today’s customer intelligence and sales handoff readiness', 'Open Engine', 'opportunity-intelligence')}
      <div class="module-grid intelligence-dashboard-grid">${[['totalCustomers','Total Customers','users'],['importedToday','Imported Today','imports'],['aiProcessed','AI Processed','sparkles'],['gradeAPlus','A+ Opportunities','briefcase'],['gradeA','A Opportunities','briefcase'],['readyForSales','Ready for Sales','sales-ai'],['missingDecisionMaker','Missing Decision Maker','users'],['missingEmail','Missing Email','mail'],['missingWhatsApp','Missing WhatsApp','help'],['salesAcceptedLeads','Sales Accepted Leads','check']].map(([key,label,iconName]) => `<article class="stat-tile"><span class="metric-icon">${icon(iconName)}</span><div><strong>${opportunityIntelligence[key] || 0}</strong><small>${label}</small></div></article>`).join('')}</div>
    </article>
    <article class="panel section-gap">
      ${panelHeader(t('intelligence.libraryStatus'), t('intelligence.libraryStatusSub'))}
      <div class="module-grid intelligence-dashboard-grid">
        ${[['totalProducts','products'],['proposalReadyProducts','check'],['productsNeedReview','document'],['missingImages','images'],['missingPrice','money'],['missingAiTags','sparkles']].map(([key, iconName]) => `<article class="stat-tile"><span class="metric-icon">${icon(iconName)}</span><div><strong>${productIntelligence[key]}</strong><small>${t(`intelligence.${key}`)}</small></div></article>`).join('')}
      </div>
    </article>
    <section class="dashboard-grid">
      <div class="stack">
        <article class="panel">
          ${panelHeader(t('dashboard.priorityPipeline'), t('dashboard.priorityPipelineSub'), t('dashboard.viewCrm'), 'crm')}
          <div class="table-scroll"><table class="data-table"><thead><tr><th>${t('fields.opportunity')}</th><th>${t('fields.stage')}</th><th>${t('fields.value')}</th><th>${t('fields.owner')}</th><th>${t('fields.nextAction')}</th><th></th></tr></thead><tbody>
            ${pipeline.map(opportunityRow).join('') || `<tr><td colspan="6">${t('dashboard.noOpportunities')}</td></tr>`}
          </tbody></table></div>
        </article>
        <article class="panel">
          ${panelHeader(t('dashboard.recentProductActivity'), t('dashboard.recentProductActivitySub'), t('dashboard.openProducts'), 'products')}
          <div class="task-list">
            ${activityRow(t('dashboard.productApproved'), t('dashboard.productApprovedMeta'), 'products')}
            ${activityRow(t('dashboard.specUpdated'), t('dashboard.specUpdatedMeta'), 'document')}
            ${activityRow(t('dashboard.importCompleted'), t('dashboard.importCompletedMeta'), 'imports')}
          </div>
        </article>
      </div>
      <aside class="stack">
        <article class="panel">
          ${panelHeader(t('dashboard.readiness'), t('dashboard.readinessSub'))}
          <div class="readiness">
            <div class="readiness-score"><div class="score-ring" style="--score:${knowledge.knowledgeScore}" data-score="${knowledge.knowledgeScore}"></div><div class="score-copy"><strong>${t('knowledge.completion')}</strong><small>${t('knowledge.scoreSummary', { count: knowledge.productCount })}</small></div></div>
            <div class="progress-list">
              ${progressRow(t('knowledge.withImages'), knowledge.productCount ? Math.round((knowledge.productCount - knowledge.missingImages) / knowledge.productCount * 100) : 0)}
              ${progressRow(t('knowledge.withSizes'), knowledge.productCount ? Math.round((knowledge.productCount - knowledge.missingSizes) / knowledge.productCount * 100) : 0)}
              ${progressRow(t('knowledge.withCases'), knowledge.productCount ? Math.round((knowledge.productCount - knowledge.missingCases) / knowledge.productCount * 100) : 0)}
            </div>
            <button class="button button--soft knowledge-open" data-route="knowledge-dashboard">${t('knowledge.openDashboard')}</button>
          </div>
        </article>
        <article class="panel">
          ${panelHeader(t('dashboard.myFocus'), t('dashboard.myFocusSub'))}
          <div class="task-list">
            ${taskRow(t('dashboard.reviewFinish'), t('common.dueToday'), 'high')}
            ${taskRow(t('dashboard.confirmFreight'), t('common.dueTomorrow'), '')}
            ${taskRow(t('dashboard.approveCopy'), t('common.friday'), '')}
          </div>
        </article>
        <article class="panel insight-card">
          <div class="insight-label">${icon('sparkles')} ${t('dashboard.aiSignal')}</div>
          <h3>${t('dashboard.signalTitle')}</h3>
          <p>${t('dashboard.signalBody')}</p>
          <button data-route="sales-ai">${t('dashboard.draftFollowups')} →</button>
        </article>
      </aside>
    </section>`;
}

function metricCard(label, value, trend, iconName, color = '', neutral = false) {
  return `<article class="metric-card"><div class="metric-head"><span>${label}</span><span class="metric-icon ${color ? `metric-icon--${color}` : ''}">${icon(iconName)}</span></div><div class="metric-value"><strong>${value}</strong><span class="trend ${neutral ? 'trend--neutral' : ''}">${trend}</span></div></article>`;
}

function opportunityRow(row) {
  return `<tr><td class="primary-cell"><strong>${esc(row.company_name)}</strong><small>${esc(row.project_name)}</small></td><td>${badge(row.stage)}</td><td class="money">${money(row.estimated_value)}</td><td>${userAvatar(row.owner_initials, row.owner_name)}</td><td>${esc(row.next_action || '—')}</td><td><button class="icon-button row-menu" aria-label="${t('common.moreActions')}">${icon('dots')}</button></td></tr>`;
}

function activityRow(title, meta, iconName) {
  return `<div class="task-row"><span class="metric-icon">${icon(iconName)}</span><span class="task-copy"><strong>${title}</strong><small>${meta}</small></span><button class="icon-button row-menu">${icon('chevron')}</button></div>`;
}

function progressRow(label, value) {
  return `<div class="progress-row"><strong>${label}</strong><span>${value}%</span><span class="progress-track"><i style="width:${value}%"></i></span></div>`;
}

function taskRow(title, date, priority) {
  return `<div class="task-row"><button class="task-check" data-action="complete-task" aria-label="${t('dashboard.taskComplete')}"></button><span class="task-copy"><strong>${title}</strong><small>${date}</small></span><i class="priority-dot ${priority ? `priority-dot--${priority}` : ''}"></i></div>`;
}

function knowledgeScoreBadge(score) {
  const tone = score >= 85 ? 'high' : score >= 60 ? 'medium' : 'low';
  return `<span class="knowledge-score knowledge-score--${tone}"><strong>${score}</strong><small>/100</small></span>`;
}

async function renderKnowledgeDashboard() {
  const [data, center] = await Promise.all([state.knowledgeDashboard || api('/api/knowledge/dashboard'), api('/api/knowledge-center')]);
  state.knowledgeDashboard = data;
  state.knowledgeCenter = center;
  const metric = data.metrics;
  const knowledgeRow = product => `<tr><td class="primary-cell"><strong>${esc(product.name)}</strong><small>${esc(product.sku)} · ${esc(product.category)}</small></td><td>${knowledgeScoreBadge(product.knowledge_score)}</td><td>${product.media_count}</td><td>${product.case_count}</td><td>${product.related_count}</td><td><button class="button button--compact" data-action="view-product" data-id="${product.id}">${t('knowledge.open')}</button></td></tr>`;
  $('#page').innerHTML = `
    ${pageHeader(t('knowledge.title'), t('knowledge.subtitle'), `<button class="button button--primary" data-route="products">${icon('products')} ${t('knowledge.openProducts')}</button>`)}
    <section class="knowledge-metrics">
      ${metricCard(t('knowledge.averageScore'), `${metric.knowledgeScore}%`, t('knowledge.completion'), 'sparkles')}
      ${metricCard(t('knowledge.products'), metric.productCount, t('knowledge.activeLibrary'), 'products', 'blue', true)}
      ${metricCard(t('knowledge.missingImages'), metric.missingImages, t('knowledge.needsAttention'), 'images', 'gold', true)}
      ${metricCard(t('knowledge.missingSizes'), metric.missingSizes, t('knowledge.needsAttention'), 'document', 'purple', true)}
      ${metricCard(t('knowledge.missingCases'), metric.missingCases, t('knowledge.needsAttention'), 'cases', 'gold', true)}
    </section>
    <section class="split-grid section-gap knowledge-lists">
      <article class="panel">${panelHeader(t('knowledge.top100'), t('knowledge.top100Sub'))}<div class="table-scroll"><table class="data-table"><thead><tr><th>${t('fields.product')}</th><th>${t('knowledge.score')}</th><th>${t('knowledge.media')}</th><th>${t('knowledge.cases')}</th><th>${t('knowledge.related')}</th><th></th></tr></thead><tbody>${data.top.map(knowledgeRow).join('')}</tbody></table></div></article>
      <article class="panel">${panelHeader(t('knowledge.incomplete'), t('knowledge.incompleteSub'))}<div class="table-scroll"><table class="data-table"><thead><tr><th>${t('fields.product')}</th><th>${t('knowledge.score')}</th><th>${t('knowledge.media')}</th><th>${t('knowledge.cases')}</th><th>${t('knowledge.related')}</th><th></th></tr></thead><tbody>${data.incomplete.map(knowledgeRow).join('')}</tbody></table></div></article>
    </section>
    <section class="panel section-gap knowledge-center-workspace">
      <div class="panel-header"><div><h2>AI Knowledge Center</h2><p>Approved business knowledge for safe AI context.</p></div><button class="button" data-action="knowledge-context-preview">Context Preview</button></div>
      <div class="knowledge-tabs"><button class="is-active" data-knowledge-filter="">All</button><button data-knowledge-filter="company">Company Knowledge</button><button data-knowledge-filter="target_customer_profile">Target Customer Profiles</button></div>
      ${center.capabilities.canCreate ? `<form id="knowledge-create-form" class="form-grid section-gap">
        <label class="field"><span>Knowledge Type</span><select name="knowledge_type"><option value="company">Company Knowledge</option><option value="target_customer_profile">Target Customer Profile</option></select></label>
        <label class="field"><span>Knowledge Key</span><input name="knowledge_key" required placeholder="company-core or restaurant-chain-us"></label>
        <label class="field"><span>Title</span><input name="title" required></label>
        <label class="field field--wide"><span>Summary</span><textarea name="summary" rows="2"></textarea></label>
        <label class="field field--wide"><span>Introduction / Profile Description</span><textarea name="description" rows="3"></textarea></label>
        <label class="field"><span>Target Countries</span><input name="target_countries" placeholder="United States, Canada"></label>
        <label class="field"><span>Categories / Customer Types</span><input name="categories" placeholder="Dining Chairs, Restaurant Chains"></label>
        <label class="field field--wide"><span>Strengths / Business Signals</span><textarea name="signals" rows="2"></textarea></label>
        <label class="field field--wide"><span>Limits, exclusions, or prohibited promises</span><textarea name="limits" rows="2"></textarea></label>
        <button class="button button--primary">Save Draft</button>
      </form>` : ''}
      <div class="table-scroll section-gap"><table class="data-table"><thead><tr><th>Knowledge</th><th>Type</th><th>Revision</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody id="knowledge-center-rows">${center.items.map(item => `<tr data-knowledge-type="${esc(item.knowledge_type)}"><td class="primary-cell"><strong>${esc(item.title)}</strong><small>${esc(item.knowledge_key)} · ${esc(item.summary || '')}</small></td><td>${esc(item.knowledge_type === 'company' ? 'Company' : 'Target Customer')}</td><td>v${item.revision_no}</td><td>${badge(item.status)}</td><td>${formatDateTime(item.updated_at)}</td><td><div class="row-actions">${item.status === 'Draft' ? `<button class="button button--compact" data-action="knowledge-submit" data-id="${item.id}">Submit Review</button>` : ''}${item.status === 'Needs Review' && center.capabilities.canApprove ? `<button class="button button--compact" data-action="knowledge-approve" data-id="${item.id}">Approve</button><button class="button button--compact" data-action="knowledge-request-changes" data-id="${item.id}">Request Changes</button>` : ''}${item.status === 'Active' ? `<button class="button button--compact" data-action="knowledge-new-revision" data-id="${item.id}">New Revision</button>${center.capabilities.canApprove ? `<button class="button button--compact" data-action="knowledge-outdated" data-id="${item.id}">Mark Outdated</button>` : ''}` : ''}${item.status === 'Outdated' && center.capabilities.canApprove ? `<button class="button button--compact" data-action="knowledge-archive" data-id="${item.id}">Archive</button>` : ''}<button class="icon-button" data-action="knowledge-history" data-id="${item.id}" title="History">${icon('clock')}</button></div></td></tr>`).join('') || '<tr><td colspan="6"><div class="empty-state">No knowledge records yet.</div></td></tr>'}</tbody></table></div>
    </section>`;
  document.querySelectorAll('[data-knowledge-filter]').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('[data-knowledge-filter]').forEach(item => item.classList.toggle('is-active', item === button)); document.querySelectorAll('#knowledge-center-rows tr[data-knowledge-type]').forEach(row => row.hidden = Boolean(button.dataset.knowledgeFilter) && row.dataset.knowledgeType !== button.dataset.knowledgeFilter); }));
  $('#knowledge-create-form')?.addEventListener('submit', async event => { event.preventDefault(); const form = new FormData(event.currentTarget); const list = name => String(form.get(name) || '').split(',').map(value => value.trim()).filter(Boolean); const type = String(form.get('knowledge_type')); const content = type === 'company' ? { company_introduction: form.get('description'), target_countries: list('target_countries'), main_product_categories: list('categories'), company_strengths: form.get('signals'), prohibited_sales_promises: form.get('limits') } : { profile_name: form.get('title'), target_countries: list('target_countries'), customer_types: list('categories'), target_business_signals: form.get('signals'), exclusions: form.get('limits') }; await api('/api/knowledge-center', { method: 'POST', body: JSON.stringify({ knowledge_type: type, knowledge_key: form.get('knowledge_key'), title: form.get('title'), summary: form.get('summary'), content_json: content, tags_json: [] }) }); toast('Knowledge Draft saved'); await renderKnowledgeDashboard(); });
}

async function knowledgeAction(id, action, reviewNote = '') { await api(`/api/knowledge-center/${id}/${action}`, { method: 'POST', body: JSON.stringify({ review_note: reviewNote }) }); toast('Knowledge status updated'); await renderKnowledgeDashboard(); }
async function knowledgeContextPreview() { const data = await api('/api/knowledge-center/context-preview'); document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="knowledge-preview"><div class="modal-card"><div class="panel-header"><div><h2>Knowledge Context Preview</h2><p>Deterministic preview · $0 AI cost</p></div><button class="icon-button" data-action="close-knowledge-preview">${icon('close')}</button></div><div class="stack"><p><strong>Company Knowledge:</strong> ${data.context.companyKnowledge.length}</p><p><strong>Target Profiles:</strong> ${data.context.targetCustomerProfiles.length}</p><p><strong>Redaction:</strong> ${esc(data.redactionLevel)}</p>${data.context.warnings.map(value => `<p class="form-error">${esc(value)}</p>`).join('')}<div class="debug-table-list">${data.sourceReferences.map(ref => `<code>${esc(ref.knowledgeKey)} · v${ref.revision}</code>`).join('')}</div></div></div></div>`); }

async function renderProducts() {
  const data = state.products || await api('/api/products');
  state.products = data;
  $('#page').innerHTML = `
    ${pageHeader(t('products.title'), t('products.subtitle'), `<button class="button" data-action="manage-product-foundation">Manage Categories & Attributes</button><button class="button button--primary" data-action="add-product">${icon('plus')} ${t('products.add')}</button>`)}
    <section class="module-grid--4 module-grid">
      ${data.categories.map((category, index) => `<article class="stat-tile"><span class="metric-icon ${index === 1 ? 'metric-icon--gold' : index === 2 ? 'metric-icon--blue' : index === 3 ? 'metric-icon--purple' : ''}">${icon(['products','briefcase','cases','images'][index])}</span><div><strong>${category.product_count}</strong><small>${esc(category.name)}</small></div></article>`).join('')}
    </section>
    <article class="panel section-gap">
      ${panelHeader(t('products.library'), t('products.librarySub', { count: data.products.length }))}
      <div class="filter-bar knowledge-filter"><label class="filter-search">${icon('search')}<input id="product-search" placeholder="${t('knowledge.keywordSearch')}" /></label><select id="product-category-filter" class="select-control"><option value="">${t('intelligence.allCategories')}</option>${data.categories.map(category => `<option>${esc(category.name)}</option>`).join('')}</select><input id="product-material-filter" class="select-control" placeholder="${t('fields.material')}" /><select id="product-store-filter" class="select-control"><option value="">${t('knowledge.allStoreTypes')}</option>${data.knowledgeTerms.filter(term => term.term_type === 'store_type').map(term => `<option>${esc(term.name)}</option>`).join('')}</select><select id="product-style-filter" class="select-control"><option value="">${t('knowledge.allStyles')}</option>${data.knowledgeTerms.filter(term => term.term_type === 'style').map(term => `<option>${esc(term.name)}</option>`).join('')}</select><select id="product-budget-filter" class="select-control"><option value="">${t('intelligence.allBudgetLevels')}</option>${data.intelligenceOptions.budgetLevels.map(level => `<option>${esc(level)}</option>`).join('')}</select><select id="product-ready-filter" class="select-control"><option value="">${t('intelligence.allReadiness')}</option><option>Proposal Ready</option><option>Needs Review</option></select><input id="product-ai-tag-filter" class="select-control" placeholder="${t('intelligence.aiTags')}" /><input id="product-sku-filter" class="select-control" placeholder="${t('fields.sku')}" /><select id="product-feature-filter" class="select-control"><option value="">${t('knowledge.allFeatures')}</option>${data.knowledgeTerms.filter(term => term.term_type === 'feature').map(term => `<option>${esc(term.name)}</option>`).join('')}</select><select id="product-tag-filter" class="select-control"><option value="">${t('products.allTags')}</option>${data.tags.map(tag => `<option>${esc(tag.tag_name)}</option>`).join('')}</select><button class="button button--compact" data-action="clear-product-filters">${t('knowledge.clear')}</button></div>
      <div class="table-scroll"><table id="products-table" class="data-table"><thead><tr><th>${t('fields.productName')}</th><th>${t('fields.sku')}</th><th>${t('fields.category')}</th><th>${t('fields.material')}</th><th>${t('intelligence.readinessScore')}</th><th>${t('knowledge.storeTypes')}</th><th>${t('knowledge.styles')}</th><th>${t('intelligence.aiTags')}</th><th>${t('intelligence.proposalStatus')}</th><th></th></tr></thead><tbody>
        ${data.products.map(product => `<tr data-product-row data-sku="${esc(product.sku.toLowerCase())}" data-category="${esc(String(product.category || '').toLowerCase())}" data-material="${esc(String(product.materials || '').toLowerCase())}" data-budget="${esc(String(product.budget_level || '').toLowerCase())}" data-ready="${esc(product.proposal_ready_status.toLowerCase())}" data-ai-tags="${esc(product.ai_tags.join('|').toLowerCase())}" data-stores="${esc(product.knowledge.store_type.join('|').toLowerCase())}" data-styles="${esc(product.knowledge.style.join('|').toLowerCase())}" data-features="${esc(product.knowledge.feature.join('|').toLowerCase())}" data-tags="${esc(product.tag_names.join('|').toLowerCase())}"><td class="primary-cell"><strong>${esc(product.name)}</strong><small>${esc(product.summary)}</small></td><td><code>${esc(product.sku)}</code></td><td>${esc(product.category)}</td><td>${esc(product.materials)}</td><td>${knowledgeScoreBadge(product.product_readiness_score)}</td><td><div class="product-tags">${product.knowledge.store_type.map(name => `<span>${esc(name)}</span>`).join('') || '—'}</div></td><td><div class="product-tags">${product.knowledge.style.map(name => `<span>${esc(name)}</span>`).join('') || '—'}</div></td><td><div class="product-tags">${product.ai_tags.map(name => `<span>${esc(name)}</span>`).join('') || '—'}</div></td><td>${badge(product.proposal_ready_status)}</td><td><div class="row-actions"><button class="button button--compact" data-action="view-product" data-id="${product.id}">${t('knowledge.open')}</button><button class="icon-button row-menu" data-action="edit-product" data-id="${product.id}" aria-label="${t('common.edit')}">${icon('dots')}</button></div></td></tr>`).join('')}
      </tbody></table></div>
    </article>`;
  ['product-search', 'product-sku-filter', 'product-category-filter', 'product-material-filter', 'product-store-filter', 'product-style-filter', 'product-budget-filter', 'product-ready-filter', 'product-ai-tag-filter', 'product-feature-filter', 'product-tag-filter'].forEach(id => $(`#${id}`).addEventListener(['product-search','product-sku-filter','product-material-filter','product-ai-tag-filter'].includes(id) ? 'input' : 'change', applyProductFilters));
}

async function renderLibraryProductDetail(id,tab='general'){
  const data=await api(`/api/products/${id}`);state.productDetail=data;const p=data.product,f=data.foundation;
  let pricingDetail=null,pricingRules={rules:[]};
  if(tab==='pricing'){
    pricingDetail=await api(`/api/product-intelligence/products/${id}`);
    if(pricingDetail.capabilities?.canViewSensitive)try{pricingRules=await api('/api/price-rules')}catch(error){pricingRules={rules:[]}}
  }
  const tabs=[['general','Overview'],['images','Images'],['variants','Variants'],['attributes','Attributes'],['pricing','Pricing'],['related','Related Products'],['fbt','Frequently Bought Together']];
  const tabbar=`<div class="knowledge-tabs library-detail-tabs">${tabs.map(([key,label])=>`<button class="${tab===key?'is-active':''}" data-action="library-product-tab" data-id="${id}" data-tab="${key}">${label}</button>`).join('')}</div>`;
  let content='';
  if(tab==='general') content=`<article class="panel library-general"><div class="library-product-hero"><div>${p.main_image_url?`<img src="${esc(p.main_image_url)}" alt="${esc(p.name)}">`:'<span class="library-image-empty large">No image</span>'}</div><div><h2>${esc(p.name)}</h2><p>${esc(p.sku)} · ${esc(p.category||'—')}</p><div class="product-tags">${badge(p.library_status||'Active')}<span>${esc(p.visibility||'Website + Quote')}</span></div></div><div class="row-actions"><button class="button" data-action="edit-product" data-id="${p.id}">Edit Product</button><button class="button" data-action="delete-library-product" data-id="${p.id}" data-name="${esc(p.name)}">Delete Product</button></div></div><div class="library-field-grid">${[['Category',p.category],['Material',p.materials],['Default Size',p.size],['Default Finish',p.finish],['Default Color',p.color],['Reference Price',p.reference_price==null?'Request Quote':quoteMoney(p.reference_price)],['Website Price',p.website_price_display],['Updated',p.updated_at]].map(([label,value])=>`<p><b>${label}</b>${esc(value||'—')}</p>`).join('')}</div><h3>Descriptions</h3><p><b>Short:</b> ${esc(p.short_description||'—')}</p><p><b>Website:</b> ${esc(p.website_description||'—')}</p><p><b>Quote:</b> ${esc(p.quote_description||'—')}</p></article>`;
  if(tab==='variants') content=`<article class="panel"><h2>Variants</h2><div class="table-scroll"><table class="data-table"><thead><tr><th>Name</th><th>SKU</th><th>Dimensions</th><th>Reference Price</th><th>Cost Price</th><th>Status</th><th></th></tr></thead><tbody>${f.variants.map(v=>`<tr><td>${esc(v.variant_name)}</td><td>${esc(v.variant_sku||'—')}</td><td>${esc(v.dimensions||'—')}</td><td>${v.reference_price==null?'—':quoteMoney(v.reference_price)}</td><td>${v.cost_price==null?'—':quoteMoney(v.cost_price)}</td><td>${badge(v.status)}</td><td><button class="button button--compact" data-action="library-edit-variant" data-product-id="${id}" data-id="${v.id}" data-name="${esc(v.variant_name)}" data-price="${v.reference_price??''}" data-cost="${v.cost_price??''}" data-dimensions="${esc(v.dimensions||'')}" data-sku="${esc(v.variant_sku||'')}" data-status="${esc(v.status)}">Edit</button><button class="button button--compact" data-action="library-delete-variant" data-product-id="${id}" data-id="${v.id}">Delete</button></td></tr>`).join('')}</tbody></table></div><form id="detail-variant-create" class="form-grid inline-create-form"><label class="field"><span>Variant Name</span><input name="variant_name" required></label><label class="field"><span>SKU</span><input name="variant_sku"></label><label class="field"><span>Dimensions</span><input name="dimensions"></label><label class="field"><span>Reference Price</span><input name="reference_price" type="number" step=".01"></label><label class="field"><span>Cost Price</span><input name="cost_price" type="number" step=".01"></label><label class="field"><span>Status</span><select name="status"><option>Active</option><option>Hidden</option><option>Coming Soon</option><option>Discontinued</option></select></label><button class="button button--primary">Add Variant</button></form></article>`;
  if(tab==='attributes') content=`<article class="panel"><h2>Configurable Attributes</h2><form id="detail-attributes-form" class="attribute-value-grid">${f.attributeDefinitions.map(a=>`<label class="field"><span>${esc(a.name)}${a.unit?` (${esc(a.unit)})`:''}</span><input data-attribute-id="${a.id}" value="${esc(f.attributeValues.find(v=>v.attribute_id===a.id&&!v.variant_id)?.value||'')}"></label>`).join('')||'<p>No matching attribute definitions. Create them on the Attributes page.</p>'}<button class="button button--primary">Save Attributes</button></form></article>`;
  if(tab==='images') content=`<article class="panel"><div class="panel-header"><div><h2>Product Images</h2><p>Main, gallery, dimension, CAD, packaging, and installation.</p></div><button class="button button--primary" data-action="add-product-image" data-ai="false">Upload Image</button></div><div class="product-image-grid">${p.media.map(m=>`<article class="product-image-card"><div class="product-image-preview">${m.file_url?`<img src="${esc(m.file_url)}" alt="${esc(m.file_name)}">`:icon('images')}</div><strong>${esc(m.file_name)}</strong><small>${esc(m.image_type)} · ${esc(m.image_status)}</small><div>${m.is_primary?badge('Main Image'):`<button class="button button--compact" data-action="mark-main-image" data-id="${m.id}">Mark Main</button>`}<button class="button button--compact" data-action="edit-product-image" data-id="${m.id}">Edit</button></div></article>`).join('')||'<p>No images uploaded.</p>'}</div></article>`;
  if(tab==='pricing'){
    const pricing=pricingDetail.product.pricing_summary,canViewSensitive=Boolean(pricingDetail.capabilities?.canViewSensitive),ruleMap=new Map((pricingRules.rules||[]).map(rule=>[Number(rule.id),rule])),ruleRows=[...new Set((pricing.variants||[]).map(variant=>Number(variant.pricing_rule_id)).filter(Boolean))].map(id=>ruleMap.get(id)).filter(Boolean);
    content=`<section class="pricing-detail"><article class="panel pricing-summary-panel"><div class="panel-header"><div><h2>Pricing Summary</h2><p>Quote and PI use selling price only. Supplier cost remains internal.</p></div>${pricingStatusPill(pricing.pricing_status)}</div><div class="library-field-grid pricing-field-grid">${[['Reference Selling Price',pricing.reference_price_min==null?'Request Quote':pricing.reference_price_min===pricing.reference_price_max?pricingAmount(pricing.reference_price_min,pricing.selling_currency):`${pricingAmount(pricing.reference_price_min,pricing.selling_currency)} - ${pricingAmount(pricing.reference_price_max,pricing.selling_currency)}`],['Selling Currency',pricing.selling_currency||'USD'],['Pricing Status',pricing.pricing_status],['Last Updated',p.updated_at]].map(([label,value])=>`<p><b>${label}</b>${esc(value||'—')}</p>`).join('')}</div></article><article class="panel"><div class="panel-header"><div><h2>Variant Price Grid</h2><p>${canViewSensitive?'Internal cost columns are visible to your role.':'Sales-safe view: supplier cost and margin data are hidden.'}</p></div></div><div class="table-scroll"><table class="data-table pricing-variant-table"><thead><tr><th>Variant SKU</th><th>Variant Name</th>${canViewSensitive?'<th>Supplier Cost</th><th>Supplier Currency</th><th>Converted Cost</th>':''}<th>Recommended Selling Price</th><th>Selling Currency</th><th>Pricing Status</th><th>Last Updated</th></tr></thead><tbody>${(pricing.variants||[]).map(variant=>`<tr><td><code>${esc(variant.variant_sku||'—')}</code></td><td><strong>${esc(variant.variant_name||'Default')}</strong></td>${canViewSensitive?`<td>${pricingAmount(variant.supplier_cost,variant.supplier_currency||'USD')}</td><td>${esc(variant.supplier_currency||'—')}</td><td>${pricingAmount(variant.converted_cost,variant.converted_cost_currency||'USD')}</td>`:''}<td>${pricingAmount(variant.recommended_selling_price,variant.selling_currency||'USD')}</td><td>${esc(variant.selling_currency||'USD')}</td><td>${pricingStatusPill(variant.pricing_status||pricing.pricing_status)}</td><td>${esc(variant.updated_at||p.updated_at||'—')}</td></tr>`).join('')||'<tr><td colspan="9"><div class="empty-state">No variants available for pricing.</div></td></tr>'}</tbody></table></div></article><article class="panel pricing-rule-summary"><div class="panel-header"><div><h2>Pricing Rule Summary</h2><p>${canViewSensitive?'Internal rule details for pricing review.':'Pricing rules are internal and hidden from this role.'}</p></div></div>${canViewSensitive?`<div class="table-scroll"><table class="data-table"><thead><tr><th>Rule Name</th><th>Calculation Method</th><th>Multiplier / Margin</th><th>Rounding</th><th>Status</th></tr></thead><tbody>${ruleRows.map(rule=>`<tr><td><strong>${esc(rule.rule_name)}</strong></td><td>Cost Multiplier</td><td>×${esc(rule.multiplier)}${Number(rule.fixed_addon||0)?` + ${pricingAmount(rule.fixed_addon,rule.currency||'USD')}`:''}</td><td>${esc(rule.rounding_rule||'—')}</td><td>${badge(rule.active?'Active':'Inactive')}</td></tr>`).join('')||'<tr><td colspan="5">No matching pricing rule recorded. Product may need pricing review.</td></tr>'}</tbody></table></div>`:'<div class="empty-state">Internal pricing rule details are hidden for this role.</div>'}</article></section>`;
  }  if(tab==='related'||tab==='fbt'){const related=tab==='related',selected=(related?f.relatedProducts:f.frequentlyBoughtTogether).map(x=>x.id);content=`<article class="panel"><h2>${related?'Related Products':'Frequently Bought Together'}</h2><p>${related?'Recommendations only; combinations are never forced.':'Manual recommendations for website, Sales, and AI.'}</p><form id="detail-relationships-form">${knowledgeChecks('relationship_ids',data.options.products,selected,row=>`${row.name} · ${row.sku}`)}<button class="button button--primary">Save</button></form></article>`}
  $('#page').innerHTML=`${pageHeader(p.name,`${p.sku} · Product Library`,`<button class="button" data-route="product-library-products">Back to Products</button>`)}${tabbar}${content}`;
  if(tab==='variants'){const form=$('#detail-variant-create');form.querySelector('button').insertAdjacentHTML('beforebegin',variantPimFields());form.querySelector('button').insertAdjacentHTML('beforebegin',f.attributeDefinitions.map(attribute=>productAttributeEditor(attribute,'').replaceAll('data-create-attribute','data-variant-attribute')).join(''));form.addEventListener('submit',async event=>{event.preventDefault();const body=Object.fromEntries(new FormData(form));const saved=await api(`/api/products/${id}/variants`,{method:'POST',body:JSON.stringify(body)});const attribute_values=[...f.attributeValues.map(value=>({attribute_id:value.attribute_id,variant_id:value.variant_id,value:value.value})),...[...form.querySelectorAll('[data-variant-attribute]')].map(input=>({attribute_id:Number(input.dataset.attributeId),variant_id:saved.variant.id,value:input.type==='checkbox'?String(input.checked):input.multiple?[...input.selectedOptions].map(option=>option.value).join(', '):input.value}))];await saveLibraryFoundation(id,f,{attribute_values});await renderLibraryProductDetail(id,'variants')})}
  if(tab==='attributes')$('#detail-attributes-form').addEventListener('submit',async e=>{e.preventDefault();const values=[...e.currentTarget.querySelectorAll('[data-attribute-id]')].map(input=>({attribute_id:Number(input.dataset.attributeId),value:input.value}));await saveLibraryFoundation(id,f,{attribute_values:values});await renderLibraryProductDetail(id,'attributes')});
  if(tab==='related'||tab==='fbt')$('#detail-relationships-form').addEventListener('submit',async e=>{e.preventDefault();const ids=[...e.currentTarget.querySelectorAll('[name="relationship_ids"]:checked')].map(input=>Number(input.value));await saveLibraryFoundation(id,f,tab==='related'?{related_product_ids:ids}:{frequently_bought_together_ids:ids});await renderLibraryProductDetail(id,tab)});
}
async function saveLibraryFoundation(id,f,changes={}){return api(`/api/products/${id}/foundation`,{method:'PUT',body:JSON.stringify({attribute_values:changes.attribute_values??f.attributeValues.map(v=>({attribute_id:v.attribute_id,variant_id:v.variant_id,value:v.value})),related_product_ids:changes.related_product_ids??f.relatedProducts.map(x=>x.id),frequently_bought_together_ids:changes.frequently_bought_together_ids??f.frequentlyBoughtTogether.map(x=>x.id)})})}

function variantPimFields(record={}){const field=(name,label,type='text',step='')=>`<label class="field"><span>${label}</span><input name="${name}" type="${type}" ${step?`step="${step}"`:''} value="${esc(record[name]??'')}"></label>`,supplier=state.products?.capabilities?.canViewSensitive?`${field('default_supplier','Default Supplier')}${field('supplier_sku','Supplier SKU')}${field('supplier_cost','Supplier Cost','number','.01')}${field('supplier_lead_time_days','Supplier Lead Time (days)','number')}${field('supplier_moq','Supplier MOQ','number','.01')}<label class="field"><span>Supplier Notes</span><textarea name="supplier_notes">${esc(record.supplier_notes||'')}</textarea></label>`:'';return `<details class="variant-pim-fields" open><summary>Production & Logistics${supplier?' / Confidential Supplier':''}</summary><div class="form-grid">${field('material','Material')}${field('finish','Finish')}${field('color','Color')}${field('moq','MOQ','number','.01')}${field('lead_time_days','Lead Time (days)','number')}${field('cbm','CBM','number','.0001')}${field('gross_weight_kg','Gross Weight (kg)','number','.001')}${field('net_weight_kg','Net Weight (kg)','number','.001')}${field('packing_info','Packing Info')}${supplier}</div></details>`}

function applyProductFilters() {
  const query = $('#product-search').value.trim().toLowerCase();
  const sku = $('#product-sku-filter').value.trim().toLowerCase();
  const category = $('#product-category-filter').value.toLowerCase();
  const material = $('#product-material-filter').value.trim().toLowerCase();
  const store = $('#product-store-filter').value.toLowerCase();
  const style = $('#product-style-filter').value.toLowerCase();
  const feature = $('#product-feature-filter').value.toLowerCase();
  const tag = $('#product-tag-filter').value.toLowerCase();
  const budget = $('#product-budget-filter').value.toLowerCase();
  const ready = $('#product-ready-filter').value.toLowerCase();
  const aiTag = $('#product-ai-tag-filter').value.trim().toLowerCase();
  document.querySelectorAll('[data-product-row]').forEach(row => {
    row.hidden = !((!query || row.textContent.toLowerCase().includes(query)) && (!sku || row.dataset.sku.includes(sku)) && (!category || row.dataset.category === category) && (!material || row.dataset.material.includes(material)) && (!store || row.dataset.stores.split('|').includes(store)) && (!style || row.dataset.styles.split('|').includes(style)) && (!budget || row.dataset.budget === budget) && (!ready || row.dataset.ready === ready) && (!aiTag || row.dataset.aiTags.includes(aiTag)) && (!feature || row.dataset.features.split('|').includes(feature)) && (!tag || row.dataset.tags.split('|').includes(tag)));
  });
}

function productSkuPreview(categoryId, style, currentId = 0) {
  const category = state.products.categories.find(item => item.id === Number(categoryId));
  const categoryCode = state.products.skuRules.categoryCodes[category?.name] || String(category?.name||'').split(/\s+/).map(word=>word[0]).join('').slice(0,3).toUpperCase();
  const styleCode = state.products.skuRules.styleCodes[style];
  if (!categoryCode || !styleCode) return '';
  const prefix = `${categoryCode}-${styleCode}-`;
  const highest = state.products.products.reduce((max, product) => {
    if (product.id === Number(currentId)) return max;
    const match = product.sku.toUpperCase().match(new RegExp(`^${prefix}(\\d{3,})$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}

function productAttributeEditor(attribute,value=''){const options=attribute.options.filter(option=>option.active).map(option=>option.option_value),base=`data-create-attribute data-attribute-id="${attribute.id}"`;if(attribute.data_type==='Boolean')return `<label><input ${base} type="checkbox" ${String(value)==='true'||String(value)==='1'?'checked':''}> ${esc(attribute.name)}</label>`;if(attribute.data_type==='Select')return `<label class="field"><span>${esc(attribute.name)}</span><select ${base}><option value=""></option>${options.map(option=>`<option ${option===value?'selected':''}>${esc(option)}</option>`).join('')}</select></label>`;if(attribute.data_type==='Multi-select')return `<label class="field"><span>${esc(attribute.name)}</span><select ${base} multiple>${options.map(option=>`<option ${String(value).split(',').includes(option)?'selected':''}>${esc(option)}</option>`).join('')}</select></label>`;const type=attribute.data_type==='Number'?'number':attribute.data_type==='Color'?'color':attribute.data_type==='Image'?'url':'text';return `<label class="field"><span>${esc(attribute.name)}${attribute.unit?` (${esc(attribute.unit)})`:''}</span><input ${base} type="${type}" value="${esc(value)}"></label>`}

function renderProductCategoryAttributes(form,product){const categoryId=Number(form.elements.category_id.value),values=new Map((product.foundation?.attributeValues||[]).filter(value=>!value.variant_id).map(value=>[Number(value.attribute_id),value.value])),attributes=(state.products.attributeDefinitions||[]).filter(attribute=>!attribute.category_ids.length||attribute.category_ids.includes(categoryId));let section=form.querySelector('#product-category-attributes');if(!section){section=document.createElement('section');section.id='product-category-attributes';section.className='product-foundation-fields';form.querySelector('.foundation-form').append(section)}section.innerHTML=`<h3>Category Attributes <small>(optional)</small></h3>${attributes.length?attributes.map(attribute=>productAttributeEditor(attribute,values.get(attribute.id)||'')).join(''):'<p>No attributes configured for this category.</p>'}`}

function openProductModal(id = null) {
  const product = id ? state.products.products.find(item => item.id === Number(id)) : {};
  const groups = ['Store Type Tags', 'Style Tags', 'Business Tags'];
  const backdrop = document.createElement('div');
  backdrop.id = 'product-modal';
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="command-modal foundation-modal product-modal" role="dialog" aria-modal="true"><form id="product-form" data-id="${id || ''}"><div class="foundation-modal-head"><div><h2>${t(id ? 'products.editTitle' : 'products.addTitle')}</h2><p>${t('products.skuHelp')}</p></div><button type="button" class="icon-button" data-action="product-close" aria-label="${t('common.close')}">${icon('close')}</button></div><div class="foundation-form">
    <div class="field-row"><label class="field"><span>${t('fields.productName')}</span><input name="name" value="${esc(product.name || '')}" required /></label><label class="field"><span>${t('fields.category')}</span><select name="category_id" required>${state.products.categories.map(item => `<option value="${item.id}" ${item.id === product.category_id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label></div>
    <div class="field-row"><label class="field"><span>${t('intelligence.subCategory')}</span><input name="sub_category" value="${esc(product.sub_category || '')}" /></label><label class="field"><span>${t('intelligence.productSeries')}</span><input name="product_series" value="${esc(product.product_series || '')}" /></label></div>
<div class="field-row"><label class="field"><span>${t('products.skuStyle')}</span><select name="sku_style">${Object.keys(state.products.skuRules.styleCodes).map(style => `<option ${product.tag_names?.includes(style) ? 'selected' : ''}>${esc(style)}</option>`).join('')}</select></label><label class="field"><span>${t('fields.sku')}</span><span class="sku-control"><input name="sku" required value="${esc(product.sku || '')}" placeholder="${t('products.autoGenerated')}" /><button type="button" class="button button--compact" data-action="generate-sku">${t('products.generate')}</button></span></label></div>
    <label class="field"><span>${t('products.summary')}</span><textarea name="summary" rows="2">${esc(product.summary || '')}</textarea></label>
    <div class="field-row"><label class="field"><span>${t('fields.material')}</span><input name="materials" value="${esc(product.materials || '')}" /></label><label class="field"><span>${t('fields.size')}</span><input name="size" value="${esc(product.size || '')}" /></label></div>
    <div class="field-row"><label class="field"><span>${t('intelligence.color')}</span><input name="color" value="${esc(product.color || '')}" /></label><label class="field"><span>${t('intelligence.finish')}</span><input name="finish" value="${esc(product.finish || '')}" /></label></div>
    <div class="field-row"><label class="field"><span>${t('intelligence.budgetLevel')}</span><select name="budget_level"><option value="">${t('common.none')}</option>${state.products.intelligenceOptions.budgetLevels.map(level => `<option ${level === product.budget_level ? 'selected' : ''}>${esc(level)}</option>`).join('')}</select></label><label class="field"><span>${t('intelligence.recommendedUsage')}</span><input name="recommended_usage" value="${esc(product.recommended_usage || '')}" /></label></div>
    <div class="field-row"><label class="field"><span>${t('fields.priceRange')}</span><input name="price_range" value="${esc(product.price_range || '')}" /></label><label class="field"><span>${t('fields.status')}</span><select name="status">${['draft','review','approved','archived'].map(status => `<option value="${status}" ${status === product.status ? 'selected' : ''}>${esc(statusLabel(status))}</option>`).join('')}</select></label></div>
    <div class="field-row"><label class="field"><span>${t('fields.leadTime')}</span><input name="lead_time_days" type="number" min="0" value="${esc(product.lead_time_days || '')}" /></label><label class="field"><span>${t('fields.moq')}</span><input name="moq" type="number" min="0" value="${esc(product.moq || '')}" /></label></div>
    <div class="tag-selector">${groups.map(group => `<fieldset><legend>${esc(group)}</legend><div>${state.products.tags.filter(tag => tag.tag_type === group).map(tag => `<label><input type="checkbox" name="tag_ids" value="${tag.id}" ${product.tag_ids?.includes(tag.id) ? 'checked' : ''} /><span>${esc(tag.tag_name)}</span></label>`).join('')}</div></fieldset>`).join('')}</div>
    <p id="product-form-error" class="form-error" role="alert"></p></div><div class="foundation-modal-actions product-modal-actions"><button type="button" class="button" data-action="product-close">Cancel</button><button type="submit" class="button button--soft" data-submit-intent="draft">Save Draft</button><button type="submit" class="button button--primary" data-submit-intent="create">${id?'Save Product':'Create Product'}</button></div></form></div>`;
  document.body.append(backdrop);
  const foundationFields=document.createElement('section');foundationFields.className='product-foundation-fields';foundationFields.innerHTML=`<h3>Product Foundation</h3><div class="field-row"><label class="field"><span>Product Status</span><select name="library_status" required>${state.products.intelligenceOptions.libraryStatuses.map(value=>`<option ${value===(product.library_status||'Active')?'selected':''}>${esc(value)}</option>`).join('')}</select></label><label class="field"><span>Visibility</span><select name="visibility" required>${state.products.intelligenceOptions.visibilities.map(value=>`<option ${value===(product.visibility||'Website + Quote')?'selected':''}>${esc(value)}</option>`).join('')}</select></label></div><label class="field"><span>Short Description</span><textarea name="short_description" rows="2">${esc(product.short_description||'')}</textarea></label><label class="field"><span>Website Description</span><textarea name="website_description" rows="3">${esc(product.website_description||'')}</textarea></label><label class="field"><span>Quote Description</span><textarea name="quote_description" rows="2">${esc(product.quote_description||'')}</textarea></label><label class="field"><span>Website Price Display</span><select name="website_price_display">${['Starting From','Price Range','Request Quote'].map(value=>`<option ${value===(product.website_price_display||'Request Quote')?'selected':''}>${value}</option>`).join('')}</select></label>`;$('#product-form .foundation-form').append(foundationFields);
  $('#product-form').noValidate=true;
  renderProductCategoryAttributes($('#product-form'),product);
  if(state.products?.capabilities?.canViewSensitive){const supplierFields=document.createElement('details');supplierFields.className='product-foundation-fields';supplierFields.innerHTML=`<summary>Supplier Reserved Fields (confidential)</summary><div class="form-grid"><label class="field"><span>Default Supplier</span><input name="default_supplier" value="${esc(product.default_supplier||'')}"></label><label class="field"><span>Supplier SKU</span><input name="supplier_sku" value="${esc(product.supplier_sku||'')}"></label><label class="field"><span>Supplier Cost</span><input name="supplier_cost" type="number" step=".01" value="${esc(product.supplier_cost??'')}"></label><label class="field"><span>Supplier Lead Time (days)</span><input name="supplier_lead_time_days" type="number" value="${esc(product.supplier_lead_time_days??'')}"></label><label class="field"><span>Supplier MOQ</span><input name="supplier_moq" type="number" step=".01" value="${esc(product.supplier_moq??'')}"></label><label class="field"><span>Supplier Notes</span><textarea name="supplier_notes">${esc(product.supplier_notes||'')}</textarea></label></div>`;$('#product-form .foundation-form').append(supplierFields)}
  $('#product-form').elements.category_id.addEventListener('change',()=>{const form=$('#product-form');renderProductCategoryAttributes(form,product);if(!id)form.elements.sku.value=productSkuPreview(form.elements.category_id.value,form.elements.sku_style.value)});
  $('#product-form').addEventListener('submit', saveProductForm);
  if (!id) $('#product-form [data-action="generate-sku"]').click();
}

async function saveProductForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  form.querySelectorAll('.is-invalid').forEach(input => input.classList.remove('is-invalid'));
  const missing = [...form.querySelectorAll('[required]')].filter(input => !String(input.value || '').trim());
  if (missing.length) {
    missing.forEach(input => input.classList.add('is-invalid'));
    $('#product-form-error').textContent = 'Please complete the highlighted required fields before saving.';
    missing[0].focus();
    return;
  }
  const payload = Object.fromEntries(new FormData(form));
  const intent = event.submitter?.dataset.submitIntent || 'create';
  payload.status = intent === 'draft' ? 'draft' : 'approved';
  payload.tag_ids = [...form.querySelectorAll('[name="tag_ids"]:checked')].map(input => Number(input.value));
  const buttons = [...form.querySelectorAll('[type="submit"]')];
  buttons.forEach(button => { button.disabled = true; });
  try {
    const saved=await api(`/api/products${form.dataset.id ? `/${form.dataset.id}` : ''}`, { method: form.dataset.id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    const current=state.products.products.find(item=>item.id===Number(form.dataset.id));
    const attribute_values=[...form.querySelectorAll('[data-create-attribute]')].map(input=>({attribute_id:Number(input.dataset.attributeId),value:input.type==='checkbox'?String(input.checked):input.multiple?[...input.selectedOptions].map(option=>option.value).join(', '):input.value}));
    await api(`/api/products/${saved.product.id}/foundation`,{method:'PUT',body:JSON.stringify({attribute_values,related_product_ids:(current?.foundation?.relatedProducts||[]).map(item=>item.id),frequently_bought_together_ids:(current?.foundation?.frequentlyBoughtTogether||[]).map(item=>item.id)})});
    $('#product-modal').remove();
    state.products = null;
    toast(form.dataset.id ? 'Product updated successfully.' : intent === 'draft' ? 'Product draft saved successfully.' : 'Product created successfully.');
    await navigate(state.route.startsWith('product-library-')?'product-library-products':'products', true);
  } catch (error) {
    $('#product-form-error').textContent = error.status === 409 ? t('products.duplicateSku') : error.message;
    buttons.forEach(button => { button.disabled = false; });
  }
}

function knowledgeChecks(name, rows, selectedIds, label = row => row.name) {
  return `<div class="knowledge-checks">${rows.map(row => `<label><input type="checkbox" name="${name}" value="${row.id}" ${selectedIds.includes(row.id) ? 'checked' : ''} /><span>${esc(label(row))}</span></label>`).join('')}</div>`;
}

function factoryStatusLabel(status) {
  const key = { no_content: 'noContent', draft_generated: 'draftGenerated', pending_review: 'pendingReview', approved: 'approved', rejected: 'rejected', applied: 'applied' }[status] || 'noContent';
  return t(`factory.${key}`);
}

function renderAiImageTask(task, capabilities) {
  const editable = capabilities.canRunImageTasks && ['draft', 'pending', 'failed'].includes(task.status);
  const runnable = capabilities.canRunImageTasks && ['draft', 'pending'].includes(task.status);
  const retryable = capabilities.canRunImageTasks && task.status === 'failed';
  const reviewable = capabilities.canReviewImages && ['generated', 'pending_review', 'approved'].includes(task.status);
  const applicable = capabilities.canApplyImages && task.status === 'approved';
  return `<article class="ai-image-task" data-image-task="${task.id}">
    <div class="ai-image-task-head">${runnable ? `<label class="task-select"><input type="checkbox" data-image-task-select value="${task.id}" /><span></span></label>` : ''}<div><strong>${esc(task.image_type)}</strong><small>${esc(task.scene_type || t('common.none'))} · ${esc(task.generation_mode)} · $${Number(task.cost_estimate).toFixed(2)}</small></div>${badge(task.status)}</div>
    <div class="ai-image-task-body">
      <div class="ai-image-output">${task.output_url ? `<img src="${esc(task.output_url)}" alt="${esc(task.image_type)}" />` : `<span>${icon('images')}<small>${t('imageGeneration.outputPreview')}</small></span>`}</div>
      <div class="foundation-form ai-image-task-fields">
        <label class="field"><span>${t('imageGeneration.prompt')}</span><textarea data-task-prompt rows="4" ${editable ? '' : 'disabled'}>${esc(task.prompt || '')}</textarea></label>
        <label class="field"><span>${t('imageGeneration.negativePrompt')}</span><textarea data-task-negative rows="2" ${editable ? '' : 'disabled'}>${esc(task.negative_prompt || '')}</textarea></label>
        <div class="field-row"><label class="field"><span>${t('factory.provider')}</span><select data-task-provider ${editable ? '' : 'disabled'}>${['mock','openai'].map(provider => `<option ${provider === task.provider ? 'selected' : ''}>${provider}</option>`).join('')}</select></label><label class="field"><span>${t('imageGeneration.reviewNotes')}</span><input data-task-review-notes value="${esc(task.review_notes || '')}" ${reviewable ? '' : 'disabled'} /></label></div>
        ${task.error_message ? `<div class="debug-error"><strong>${t('imageGeneration.lastError')}</strong><pre>${esc(task.error_message)}</pre></div>` : ''}
        <div class="task-metadata"><span>${t('imageGeneration.dimensions')}: ${task.output_width ? `${task.output_width}×${task.output_height}` : '—'}</span><span>${t('imageGeneration.requestId')}: ${esc(task.provider_request_id || '—')}</span><span>Prompt v${task.prompt_version || 1}</span></div>
        <div class="row-actions">${editable ? `<button type="button" class="button button--compact" data-action="save-image-task" data-id="${task.id}">${t('imageGeneration.savePrompt')}</button>` : ''}${runnable ? `<button type="button" class="button button--primary button--compact" data-action="run-image-task" data-id="${task.id}">${t('imageGeneration.runTask')}</button><button type="button" class="button button--compact" data-action="cancel-image-task" data-id="${task.id}">${t('imageGeneration.cancel')}</button>` : ''}${retryable ? `<button type="button" class="button button--primary button--compact" data-action="retry-image-task" data-id="${task.id}">${t('imageGeneration.retry')}</button>` : ''}${task.output_url ? `<button type="button" class="button button--compact" data-action="preview-image-task" data-id="${task.id}">${t('imageGeneration.preview')}</button>` : ''}${reviewable && task.status !== 'approved' ? `<button type="button" class="button button--compact" data-action="reject-image-task" data-id="${task.id}">${t('imageGeneration.reject')}</button><button type="button" class="button button--primary button--compact" data-action="approve-image-task" data-id="${task.id}">${t('imageGeneration.approve')}</button>` : ''}${applicable ? `<button type="button" class="button button--primary button--compact" data-action="apply-image-task" data-id="${task.id}">${t('imageGeneration.apply')}</button>` : ''}</div>
      </div>
    </div>
  </article>`;
}

function renderAiFactoryPane(data) {
  const factory = data.aiContentFactory;
  if (!factory?.capabilities.canView) return '';
  const product = data.product;
  const validMedia = product.media.filter(media => media.image_status !== 'Rejected');
  const latest = factory.drafts[0];
  const editable = Boolean(latest && factory.capabilities.canEdit && ['draft', 'pending_review', 'rejected'].includes(latest.status));
  const sourceId = latest?.source_media_id || validMedia.find(item => item.is_primary)?.id || validMedia[0]?.id || '';
  const source = validMedia.find(item => item.id === Number(sourceId));
  const textFields = [
    ['analysis_summary','analyze',3], ['generated_description_en','descriptionEn',4], ['generated_description_zh','descriptionZh',4],
    ['generated_short_sales_description','shortSales',2], ['generated_seo_title','seoTitle',2], ['generated_seo_description','seoDescription',3],
    ['generated_meta_keywords','metaKeywords',2], ['generated_llm_summary','llmSummary',4], ['generated_faq','faq',5],
    ['generated_buying_guide','buyingGuide',4], ['generated_sales_talking_points','salesPoints',4], ['generated_proposal_notes','proposalNotes',4]
  ];
  const estimatedTotal = Number(latest?.cost_estimate || 0) + factory.imageTasks.reduce((sum, task) => sum + Number(task.cost_estimate || 0), 0);
  return `<div class="knowledge-pane is-hidden" data-knowledge-pane="factory">
    <section class="factory-hero panel">
      <div><span class="metric-icon">${icon('sparkles')}</span><div><span class="eyebrow-label">${t('factory.title')}</span><h2>${factoryStatusLabel(factory.status)}</h2><p>${t('factory.humanReview')}</p></div></div>
      <div class="factory-cost"><small>${t('factory.totalCost')}</small><strong>$${estimatedTotal.toFixed(2)}</strong></div>
    </section>
    <article class="panel section-gap provider-status"><div class="panel-header"><div class="panel-title"><h2>${t('imageGeneration.providerStatus')}</h2><p>${factory.imageProvider.fallbackReason ? esc(factory.imageProvider.fallbackReason) : t('factory.humanReview')}</p></div>${badge(factory.imageProvider.providerAvailable ? t('imageGeneration.available') : t('debug.error'))}</div><div class="provider-status-grid"><span><small>${t('imageGeneration.currentProvider')}</small><strong>${esc(factory.imageProvider.currentProvider)}</strong></span><span><small>${t('imageGeneration.apiKey')}</small><strong>${factory.imageProvider.apiKeyConfigured}</strong></span><span><small>${t('imageGeneration.model')}</small><strong>${esc(factory.imageProvider.model)}</strong></span><span><small>${t('imageGeneration.size')}</small><strong>${esc(factory.imageProvider.size)}</strong></span><span><small>${t('imageGeneration.maxPerRun')}</small><strong>${factory.imageProvider.maxPerRun}</strong></span></div></article>
    <section class="factory-layout">
      <article class="panel factory-source"><div class="panel-title"><h2>${t('factory.sourceImage')}</h2><p>${t('factory.subtitle')}</p></div>
        <div class="factory-source-preview">${source?.file_url ? `<img src="${esc(source.file_url)}" alt="${esc(source.file_name)}" />` : icon('images')}</div>
        ${factory.capabilities.canGenerate ? `<div class="foundation-form"><label class="field"><span>${t('factory.sourceImage')}</span><select id="factory-source-media"><option value="">${t('common.none')}</option>${validMedia.map(media => `<option value="${media.id}" ${media.id === Number(sourceId) ? 'selected' : ''}>${esc(media.file_name)} · ${esc(media.image_type)}</option>`).join('')}</select></label><label class="field"><span>${t('factory.generationMode')}</span><select id="factory-mode"><option value="fast">${t('factory.fast')}</option><option value="standard" selected>${t('factory.standard')}</option><option value="premium">${t('factory.premium')}</option></select></label><div class="factory-mode-help"><small>${t('factory.fastHelp')}</small><small>${t('factory.standardHelp')}</small><small>${t('factory.premiumHelp')}</small></div><button type="button" class="button button--primary button--wide" data-action="generate-ai-factory" ${validMedia.length ? '' : 'disabled'}>${icon('sparkles')} ${t('factory.generateEverything')}</button>${validMedia.length ? '' : `<p class="form-error">${t('factory.sourceRequired')}</p>`}</div>` : ''}
      </article>
      <article class="panel factory-draft"><div class="panel-header"><div class="panel-title"><h2>${t('factory.generatedDraft')}</h2><p>${latest ? `${t('factory.mode')}: ${esc(latest.generation_mode)} · $${Number(latest.cost_estimate).toFixed(2)}` : t('factory.noContent')}</p></div>${latest ? badge(factoryStatusLabel(factory.status)) : ''}</div>
        ${latest ? `<div class="foundation-form" data-factory-draft="${latest.id}">
          <div class="field-row"><label class="field"><span>${t('factory.styles')}</span><input data-draft-field="generated_style" value="${esc(latest.generated_style.join(', '))}" ${editable ? '' : 'disabled'} /></label><label class="field"><span>${t('factory.storeTypes')}</span><input data-draft-field="generated_store_types" value="${esc(latest.generated_store_types.join(', '))}" ${editable ? '' : 'disabled'} /></label></div>
          <label class="field"><span>${t('factory.aiTags')}</span><input data-draft-field="generated_ai_tags" value="${esc(latest.generated_ai_tags.join(', '))}" ${editable ? '' : 'disabled'} /></label>
          ${textFields.map(([name,key,rows]) => `<label class="field"><span>${t(`factory.${key}`)}</span><textarea data-draft-field="${name}" rows="${rows}" ${editable ? '' : 'disabled'}>${esc(latest[name] || '')}</textarea></label>`).join('')}
          <label class="field"><span>${t('factory.reviewNotes')}</span><textarea data-draft-field="review_notes" rows="2" ${editable ? '' : 'disabled'}>${esc(latest.review_notes || '')}</textarea></label>
          <div class="row-actions factory-actions">${editable ? `<button type="button" class="button button--soft" data-action="save-ai-draft" data-id="${latest.id}">${t('factory.saveDraft')}</button>` : ''}${factory.capabilities.canReview && latest.status !== 'applied' && latest.status !== 'rejected' ? `<button type="button" class="button button--soft" data-action="reject-ai-draft" data-id="${latest.id}">${t('factory.rejectDraft')}</button>` : ''}${factory.capabilities.canReview && ['draft', 'pending_review', 'rejected'].includes(latest.status) ? `<button type="button" class="button button--primary" data-action="approve-ai-draft" data-id="${latest.id}">${t('factory.approveDraft')}</button>` : ''}${factory.capabilities.canApply && latest.status === 'approved' ? `<button type="button" class="button button--primary" data-action="apply-ai-draft" data-id="${latest.id}">${t('factory.applyProduct')}</button>` : ''}</div>
        </div>` : `<div class="empty-state">${t('factory.noContent')}</div>`}
      </article>
    </section>
    <article class="panel section-gap"><div class="panel-header"><div class="panel-title"><h2>${t('factory.imageTasks')}</h2><p>${t('factory.humanReview')}</p></div><div class="row-actions"><strong>${factory.imageTasks.length}</strong>${factory.capabilities.canRunImageTasks ? `<button type="button" class="button button--soft button--compact" data-action="run-selected-image-tasks">${t('imageGeneration.runSelected')}</button><button type="button" class="button button--primary button--compact" data-action="run-all-image-tasks">${t('imageGeneration.runAll')}</button>` : ''}</div></div>
      ${factory.imageTasks.length ? `<div class="ai-image-task-list">${factory.imageTasks.map(task => renderAiImageTask(task, factory.capabilities)).join('')}</div>` : `<div class="empty-state">${t('factory.noTasks')}</div>`}
    </article>
  </div>`;
}

async function renderProductDetail(id, activeTab = 'knowledge') {
  const data = await api(`/api/products/${id}`);
  state.productDetail = data;
  const product = data.product;
  const terms = type => data.options.terms.filter(term => term.term_type === type);
  const selectedRelated = product.recommended_products.map(item => item.id);
  const selectedAiRelated = product.ai_related_products.map(item => item.id);
  const selectedCases = product.related_cases.map(item => item.id);
  const selectedMedia = product.media.map(item => item.id);
  const selectedRelatedCategories = product.related_categories.map(item => item.id);
  $('#page').innerHTML = `<form id="knowledge-form" data-id="${product.id}">
    ${pageHeader(esc(product.name), `${esc(product.sku)} · ${esc(product.category)}`, `<button type="button" class="button button--soft" data-action="generate-intelligence" data-type="product-info">${icon('sparkles')} ${t('intelligence.generateProductInfo')}</button><button type="submit" class="button button--primary">${t('knowledge.saveKnowledge')}</button>`, `<button type="button" class="button" data-route="products">${t('knowledge.backProducts')}</button>`)}
    <section class="knowledge-hero panel"><div>${knowledgeScoreBadge(product.product_readiness_score)}<div><span class="eyebrow-label">${t('intelligence.readinessScore')}</span><strong>${esc(product.proposal_ready_status)}</strong><small>${t('intelligence.readinessSummary')}</small></div></div><div class="knowledge-hero-summary"><span>${t('knowledge.aiSummary')}</span><p>${esc(product.ai_summary || t('knowledge.notSet'))}</p></div></section>
    <nav class="knowledge-tabs" role="tablist"><button type="button" class="is-active" data-action="knowledge-tab" data-tab="knowledge" role="tab">${t('knowledge.knowledgeTab')}</button><button type="button" data-action="knowledge-tab" data-tab="media" role="tab">${t('knowledge.mediaTab')} <span>${product.media.length}</span></button><button type="button" data-action="knowledge-tab" data-tab="products" role="tab">${t('knowledge.relatedProducts')} <span>${product.recommended_products.length}</span></button><button type="button" data-action="knowledge-tab" data-tab="cases" role="tab">${t('knowledge.relatedCases')} <span>${product.related_cases.length}</span></button><button type="button" data-action="knowledge-tab" data-tab="seo" role="tab">${t('intelligence.seoGeo')}</button>${data.aiContentFactory?.capabilities.canView ? `<button type="button" data-action="knowledge-tab" data-tab="factory" role="tab">${t('factory.title')} <span>${data.aiContentFactory.drafts.length}</span></button>` : ''}</nav>
    <div class="knowledge-pane" data-knowledge-pane="knowledge">
      <section class="knowledge-detail-grid">
        <article class="panel knowledge-section"><h2>${t('knowledge.suitableStoreTypes')}</h2><p>${t('knowledge.multiSelect')}</p>${knowledgeChecks('term_ids', terms('store_type'), product.knowledge_term_ids)}</article>
        <article class="panel knowledge-section"><h2>${t('knowledge.suitableStyles')}</h2><p>${t('knowledge.multiSelect')}</p>${knowledgeChecks('term_ids', terms('style'), product.knowledge_term_ids)}</article>
        <article class="panel knowledge-section"><h2>${t('knowledge.features')}</h2><p>${t('knowledge.featureSub')}</p>${knowledgeChecks('term_ids', terms('feature'), product.knowledge_term_ids)}</article>
        <article class="panel knowledge-section"><h2>${t('knowledge.customerTypes')}</h2><p>${t('knowledge.customerSub')}</p>${knowledgeChecks('term_ids', terms('customer_type'), product.knowledge_term_ids)}</article>
      </section>
      <section class="panel knowledge-fields"><div class="panel-header"><div class="panel-title"><h2>${t('intelligence.productProfile')}</h2><p>${t('intelligence.productProfileSub')}</p></div></div><div class="foundation-form">
        <div class="field-row"><label class="field"><span>${t('intelligence.subCategory')}</span><input name="sub_category" value="${esc(product.sub_category || '')}" /></label><label class="field"><span>${t('intelligence.productSeries')}</span><input name="product_series" value="${esc(product.product_series || '')}" /></label></div>
        <div class="field-row"><label class="field"><span>${t('intelligence.color')}</span><input name="color" value="${esc(product.color || '')}" /></label><label class="field"><span>${t('intelligence.finish')}</span><input name="finish" value="${esc(product.finish || '')}" /></label></div>
        <div class="field-row"><label class="field"><span>${t('intelligence.budgetLevel')}</span><select name="budget_level"><option value="">${t('common.none')}</option>${data.options.budgetLevels.map(level => `<option ${level === product.budget_level ? 'selected' : ''}>${esc(level)}</option>`).join('')}</select></label><label class="field"><span>${t('intelligence.recommendedUsage')}</span><input name="recommended_usage" value="${esc(product.recommended_usage || '')}" /></label></div>
        <label class="field"><span>${t('intelligence.englishDescription')}</span><textarea name="english_description" rows="4">${esc(product.english_description || '')}</textarea></label>
        <label class="field"><span>${t('intelligence.shortSalesDescription')}</span><textarea name="short_sales_description" rows="2">${esc(product.short_sales_description || '')}</textarea></label>
        <div class="field-row"><label class="field"><span>${t('intelligence.salesNotes')}</span><textarea name="sales_notes" rows="4">${esc(product.sales_notes || '')}</textarea></label><label class="field"><span>${t('intelligence.salesTalkingPoints')}</span><textarea name="sales_talking_points" rows="4">${esc(product.sales_talking_points || '')}</textarea></label></div>
        <div class="field-row"><label class="field"><span>${t('intelligence.commonQuestions')}</span><textarea name="common_questions" rows="4">${esc(product.common_questions || '')}</textarea></label><label class="field"><span>${t('intelligence.commonObjections')}</span><textarea name="common_objections" rows="4">${esc(product.common_objections || '')}</textarea></label></div>
        <label class="field"><span>${t('intelligence.proposalUsageNotes')}</span><textarea name="proposal_usage_notes" rows="3">${esc(product.proposal_usage_notes || '')}</textarea></label>
      </div></section>
      <section class="panel knowledge-fields"><div class="panel-header"><div class="panel-title"><h2>${t('knowledge.aiReady')}</h2><p>${t('knowledge.aiReadySub')}</p></div></div><div class="foundation-form">
        <label class="field"><span>${t('knowledge.aiSummary')}</span><textarea name="ai_summary" rows="3">${esc(product.ai_summary || '')}</textarea></label>
        <div class="field-row"><label class="field"><span>${t('knowledge.aiKeywords')}</span><input name="ai_keywords" value="${esc(product.ai_keywords.join(', '))}" /></label><label class="field"><span>${t('knowledge.aiSearchKeywords')}</span><input name="ai_search_keywords" value="${esc(product.ai_search_keywords.join(', '))}" /></label></div>
        <label class="field"><span>${t('knowledge.knowledgePrompt')}</span><textarea name="knowledge_prompt" rows="3">${esc(product.knowledge_prompt || '')}</textarea></label>
        <div class="field-row"><label class="field"><span>${t('knowledge.aiNotes')}</span><textarea name="ai_notes" rows="4">${esc(product.ai_notes || '')}</textarea></label><label class="field"><span>${t('knowledge.internalNotes')}</span><textarea name="internal_notes" rows="4">${esc(product.internal_notes || '')}</textarea></label></div>
        <label class="field"><span>${t('knowledge.recommendationWeight')}</span><input name="ai_recommendation_weight" type="number" min="0" max="100" value="${product.ai_recommendation_weight}" /></label>
      </div></section>
    </div>
    <div class="knowledge-pane is-hidden" data-knowledge-pane="media"><article class="panel knowledge-section"><div class="panel-header"><div class="panel-title"><h2>${t('intelligence.productImages')}</h2><p>${t('intelligence.productImagesSub')}</p></div><div class="row-actions"><button type="button" class="button button--soft" data-action="add-product-image" data-ai="false">${icon('upload')} ${t('intelligence.uploadImage')}</button><button type="button" class="button button--primary" data-action="add-product-image" data-ai="true">${icon('sparkles')} ${t('intelligence.addAiImage')}</button></div></div><div class="product-image-grid">${product.media.map(media => `<article class="product-image-card"><div class="product-image-preview">${media.file_url ? `<img src="${esc(media.file_url)}" alt="${esc(product.image_alt || media.file_name)}" />` : icon('images')}</div><div><strong>${esc(media.file_name)}</strong><small>${esc(media.image_type || 'Detail Image')} · ${esc(media.image_status || 'Uploaded')}</small></div><div class="row-actions">${media.is_primary ? badge('Main Image') : `<button type="button" class="button button--compact" data-action="mark-main-image" data-id="${media.id}">${t('intelligence.markMain')}</button>`}<button type="button" class="icon-button" data-action="edit-product-image" data-id="${media.id}">${icon('dots')}</button></div></article>`).join('') || `<div class="empty-state">${t('knowledge.noMedia')}</div>`}</div><details class="media-library-details"><summary>${t('intelligence.linkExistingMedia')}</summary>${data.options.media.length ? knowledgeChecks('media_ids', data.options.media, selectedMedia, row => `${row.file_name} · ${row.image_type || row.media_category}`) : `<div class="empty-state">${t('knowledge.noMedia')}</div>`}</details></article></div>
    <div class="knowledge-pane is-hidden" data-knowledge-pane="products"><section class="knowledge-detail-grid"><article class="panel knowledge-section"><h2>${t('knowledge.recommendedProducts')}</h2><p>${t('knowledge.recommendedSub')}</p>${knowledgeChecks('recommended_product_ids', data.options.products, selectedRelated, row => `${row.name} · ${row.sku}`)}</article><article class="panel knowledge-section"><h2>${t('knowledge.aiRelatedProducts')}</h2><p>${t('knowledge.aiRelatedSub')}</p>${knowledgeChecks('ai_related_product_ids', data.options.products, selectedAiRelated, row => `${row.name} · ${row.sku}`)}</article><article class="panel knowledge-section"><h2>${t('intelligence.relatedCategories')}</h2><p>${t('intelligence.relatedCategoriesSub')}</p>${knowledgeChecks('related_category_ids', data.options.categories, selectedRelatedCategories)}</article></section></div>
    <div class="knowledge-pane is-hidden" data-knowledge-pane="cases"><article class="panel knowledge-section"><h2>${t('knowledge.usedInProjects')}</h2><p>${t('knowledge.casesSub')}</p>${data.options.cases.length ? knowledgeChecks('case_ids', data.options.cases, selectedCases, row => `${row.title} · ${row.location}`) : `<div class="empty-state">${t('knowledge.noCases')}</div>`}</article></div>
    <div class="knowledge-pane is-hidden" data-knowledge-pane="seo"><section class="panel knowledge-fields"><div class="panel-header"><div class="panel-title"><h2>${t('intelligence.seoGeo')}</h2><p>${t('intelligence.seoGeoSub')}</p></div><div class="row-actions">${[['seo','generateSeo'],['geo','generateGeo'],['faq','generateFaq'],['buying-guide','generateBuyingGuide']].map(([type,key]) => `<button type="button" class="button button--compact" data-action="generate-intelligence" data-type="${type}">${t(`intelligence.${key}`)}</button>`).join('')}</div></div><div class="foundation-form">
      <div class="field-row"><label class="field"><span>${t('intelligence.seoTitle')}</span><input name="seo_title" value="${esc(product.seo_title || '')}" /></label><label class="field"><span>${t('intelligence.slug')}</span><input name="slug" value="${esc(product.slug || '')}" /></label></div>
      <label class="field"><span>${t('intelligence.seoDescription')}</span><textarea name="seo_description" rows="3">${esc(product.seo_description || '')}</textarea></label>
      <div class="field-row"><label class="field"><span>${t('intelligence.metaKeywords')}</span><input name="meta_keywords" value="${esc(product.meta_keywords || '')}" /></label><label class="field"><span>${t('intelligence.canonicalUrl')}</span><input name="canonical_url" value="${esc(product.canonical_url || '')}" /></label></div>
      <div class="field-row"><label class="field"><span>${t('intelligence.imageAlt')}</span><input name="image_alt" value="${esc(product.image_alt || '')}" /></label><label class="field"><span>${t('intelligence.imageCaption')}</span><input name="image_caption" value="${esc(product.image_caption || '')}" /></label></div>
      <label class="field"><span>${t('intelligence.productKeywords')}</span><textarea name="product_keywords" rows="2">${esc(product.product_keywords || '')}</textarea></label>
      ${[['llm_summary','llmSummary'],['use_cases','useCases'],['best_for','bestFor'],['not_recommended_for','notRecommendedFor'],['comparison','comparison'],['advantages','advantages'],['disadvantages','disadvantages'],['faq','faq'],['buying_guide','buyingGuide'],['installation_guide','installationGuide'],['maintenance_guide','maintenanceGuide'],['common_problems','commonProblems'],['suggested_prompt','suggestedPrompt']].map(([name,key]) => `<label class="field"><span>${t(`intelligence.${key}`)}</span><textarea name="${name}" rows="3">${esc(product[name] || '')}</textarea></label>`).join('')}
    </div></section></div>
    ${renderAiFactoryPane(data)}
    <p id="knowledge-form-error" class="form-error"></p>
  </form>`;
  const foundation=data.foundation;const foundationPane=document.querySelector('[data-knowledge-pane="products"]');
  foundationPane.insertAdjacentHTML('beforeend',`<section class="panel product-foundation-panel"><div class="panel-header"><div class="panel-title"><h2>Product Foundation</h2><p>Variants, configurable attributes, related products, and frequently bought together.</p></div></div><h3>Variants</h3><div class="variant-grid">${foundation.variants.map(v=>`<article><strong>${esc(v.variant_name)}</strong><small>${esc(v.variant_sku||'No variant SKU')} · ${esc(v.dimensions||'No dimensions')} · ${v.reference_price==null?'Request Quote':quoteMoney(v.reference_price)}</small>${badge(v.status)}</article>`).join('')||'<p>No variants yet.</p>'}</div><form id="variant-form" class="form-grid"><label class="field"><span>Variant Name</span><input name="variant_name" required placeholder="700Ø"></label><label class="field"><span>Variant SKU</span><input name="variant_sku"></label><label class="field"><span>Dimensions</span><input name="dimensions"></label><label class="field"><span>Reference Price</span><input name="reference_price" type="number" step=".01"></label><label class="field"><span>Cost Price</span><input name="cost_price" type="number" step=".01"></label><label class="field"><span>Status</span><select name="status">${data.options.variantStatuses.map(value=>`<option>${value}</option>`).join('')}</select></label><button class="button button--primary" type="submit">Add Variant</button></form><form id="foundation-form"><h3>Configurable Attributes</h3><div class="attribute-value-grid">${foundation.attributeDefinitions.map(attribute=>`<label class="field"><span>${esc(attribute.name)}${attribute.unit?` (${esc(attribute.unit)})`:''}</span><input data-attribute-id="${attribute.id}" value="${esc(foundation.attributeValues.find(value=>value.attribute_id===attribute.id&&!value.variant_id)?.value||'')}"></label>`).join('')||'<p>Create attribute definitions through the Product Attributes API.</p>'}</div><h3>Related Products</h3>${knowledgeChecks('foundation_related_ids',data.options.products,foundation.relatedProducts.map(p=>p.id),row=>`${row.name} · ${row.sku}`)}<h3>Frequently Bought Together</h3>${knowledgeChecks('foundation_fbt_ids',data.options.products,foundation.frequentlyBoughtTogether.map(p=>p.id),row=>`${row.name} · ${row.sku}`)}<button class="button button--primary" type="submit">Save Product Foundation</button></form></section>`);
  $('#variant-form').addEventListener('submit',saveProductVariant);$('#foundation-form').addEventListener('submit',saveProductFoundation);
  $('#knowledge-form').addEventListener('submit', saveProductKnowledge);
  if (activeTab !== 'knowledge') {
    document.querySelectorAll('[data-action="knowledge-tab"]').forEach(tab => tab.classList.toggle('is-active', tab.dataset.tab === activeTab));
    document.querySelectorAll('[data-knowledge-pane]').forEach(pane => pane.classList.toggle('is-hidden', pane.dataset.knowledgePane !== activeTab));
  }
}

async function saveProductKnowledge(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const checked = name => [...form.querySelectorAll(`[name="${name}"]:checked`)].map(input => Number(input.value));
  const payload = Object.fromEntries(new FormData(form));
  for (const name of ['term_ids', 'recommended_product_ids', 'ai_related_product_ids', 'case_ids', 'media_ids', 'related_category_ids']) payload[name] = checked(name);
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const result = await api(`/api/products/${form.dataset.id}/knowledge`, { method: 'PUT', body: JSON.stringify(payload) });
    state.products = null;
    state.knowledgeDashboard = null;
    toast(t('knowledge.saved'));
    await renderProductDetail(result.product.id);
  } catch (error) {
    $('#knowledge-form-error').textContent = error.message;
    button.disabled = false;
  }
}

async function applyIntelligenceGeneration(type) {
  const form = $('#knowledge-form');
  const result = await api(`/api/products/${form.dataset.id}/generate/${type}`, { method: 'POST' });
  for (const [name, value] of Object.entries(result.generated)) {
    if (name === 'term_ids') {
      const selected = new Set(value.map(Number));
      form.querySelectorAll('[name="term_ids"]').forEach(input => { input.checked = selected.has(Number(input.value)); });
      continue;
    }
    if (name === 'ai_keywords') {
      const input = form.elements.ai_keywords;
      if (input) input.value = value.join(', ');
      continue;
    }
    const input = form.elements[name];
    if (input) input.value = value ?? '';
  }
  toast(t('intelligence.generatedReview'));
}

function openProductImageModal(mediaId = null, aiGenerated = false) {
  const detail = state.productDetail;
  const product = detail.product;
  const media = mediaId ? product.media.find(item => item.id === Number(mediaId)) : {};
  const isAi = aiGenerated || Boolean(media.is_ai_generated);
  const backdrop = document.createElement('div');
  backdrop.id = 'product-image-modal';
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="command-modal foundation-modal" role="dialog" aria-modal="true"><form id="product-image-form" data-id="${mediaId || ''}" data-product-id="${product.id}"><div class="foundation-modal-head"><div><h2>${t(isAi ? 'intelligence.addAiImage' : 'intelligence.uploadImage')}</h2><p>${t('intelligence.imageEntryNote')}</p></div><button type="button" class="icon-button" data-action="product-image-close">${icon('close')}</button></div><div class="foundation-form">
    <label class="field"><span>${t('foundation.fileName')}</span><input name="file_name" value="${esc(media.file_name || (isAi ? 'AI image placeholder' : ''))}" required /></label>
    <label class="field"><span>${t('foundation.fileUrl')}</span><input name="file_url" value="${esc(media.file_url || '')}" placeholder="https://..." /></label>
    <div class="field-row"><label class="field"><span>${t('intelligence.imageType')}</span><select name="image_type">${detail.options.imageTypes.map(type => `<option ${type === (media.image_type || 'Detail Image') ? 'selected' : ''}>${esc(type)}</option>`).join('')}</select></label><label class="field"><span>${t('intelligence.imageStatus')}</span><select name="image_status">${detail.options.imageStatuses.map(status => `<option ${status === (media.image_status || (isAi ? 'AI Generated' : 'Uploaded')) ? 'selected' : ''}>${esc(status)}</option>`).join('')}</select></label></div>
    <div class="field-row"><label class="field"><span>Variant (optional)</span><select name="variant_id"><option value="">Product level</option>${(detail.foundation?.variants||[]).map(variant=>`<option value="${variant.id}" ${Number(media.variant_id)===variant.id?'selected':''}>${esc(variant.variant_name)}</option>`).join('')}</select></label><label class="field"><span>Document Type</span><input name="document_type" value="${esc(media.document_type||'')}" placeholder="Specification PDF, Test Report..."></label></div>
    <label class="field checkbox-field"><input name="mark_main" type="checkbox" ${media.is_primary ? 'checked' : ''} /><span>${t('intelligence.markMain')}</span></label>
    <input type="hidden" name="is_ai_generated" value="${isAi}" /><p id="product-image-error" class="form-error"></p></div><div class="foundation-modal-actions"><button type="button" class="button" data-action="product-image-close">${t('common.cancel')}</button><button type="submit" class="button button--primary">${t('common.save')}</button></div></form></div>`;
  document.body.append(backdrop);
  $('#product-image-form').addEventListener('submit', saveProductImage);
}

async function saveProductImage(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form));
  payload.mark_main = form.elements.mark_main.checked;
  payload.is_ai_generated = payload.is_ai_generated === 'true';
  try {
    await api(`/api/products/${form.dataset.productId}/images${form.dataset.id ? `/${form.dataset.id}` : ''}`, { method: form.dataset.id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    $('#product-image-modal').remove();
    toast(t('intelligence.imageSaved'));
    if(state.route==='product-library-products')await renderLibraryProductDetail(form.dataset.productId,'images');else await renderProductDetail(form.dataset.productId);
  } catch (error) {
    $('#product-image-error').textContent = error.message;
  }
}

async function markMainImage(mediaId) {
  const productId = state.productDetail.product.id;
  await api(`/api/products/${productId}/images/${mediaId}`, { method: 'PUT', body: JSON.stringify({ mark_main: true }) });
  toast(t('intelligence.imageSaved'));
  if(state.route==='product-library-products')await renderLibraryProductDetail(productId,'images');else await renderProductDetail(productId);
}

function aiDraftPayload() {
  const container = $('[data-factory-draft]');
  const payload = { status: 'pending_review' };
  container?.querySelectorAll('[data-draft-field]').forEach(input => { payload[input.dataset.draftField] = input.value; });
  return payload;
}

async function generateAiFactory() {
  const productId = state.productDetail.product.id;
  const sourceMediaId = Number($('#factory-source-media')?.value);
  const generationMode = $('#factory-mode')?.value || 'standard';
  if (!window.confirm('Estimated text cost: $0.01. Generate this AI content draft?')) return;
  await api(`/api/products/${productId}/ai-content/generate`, { method: 'POST', body: JSON.stringify({ source_media_id: sourceMediaId, generation_mode: generationMode, confirmed: true }) });
  toast(t('factory.generated'));
  await renderProductDetail(productId, 'factory');
}

async function saveAiDraft(draftId) {
  const productId = state.productDetail.product.id;
  await api(`/api/products/${productId}/ai-content/drafts/${draftId}`, { method: 'PUT', body: JSON.stringify(aiDraftPayload()) });
  toast(t('factory.saved'));
  await renderProductDetail(productId, 'factory');
}

async function reviewAiDraft(draftId, decision) {
  const productId = state.productDetail.product.id;
  const reviewNotes = $('[data-draft-field="review_notes"]')?.value || '';
  await api(`/api/products/${productId}/ai-content/drafts/${draftId}/${decision}`, { method: 'POST', body: JSON.stringify({ review_notes: reviewNotes }) });
  toast(t('factory.reviewed'));
  await renderProductDetail(productId, 'factory');
}

async function applyAiDraft(draftId) {
  const productId = state.productDetail.product.id;
  await api(`/api/products/${productId}/ai-content/drafts/${draftId}/apply`, { method: 'POST' });
  state.products = null;
  state.knowledgeDashboard = null;
  toast(t('factory.appliedMessage'));
  await renderProductDetail(productId, 'factory');
}

function imageTaskNode(taskId) {
  return document.querySelector(`[data-image-task="${taskId}"]`);
}

async function saveImageTask(taskId) {
  const node = imageTaskNode(taskId);
  await api(`/api/products/${state.productDetail.product.id}/image-generation-tasks/${taskId}`, {
    method: 'PUT', body: JSON.stringify({ prompt: node.querySelector('[data-task-prompt]').value, negative_prompt: node.querySelector('[data-task-negative]').value, provider: node.querySelector('[data-task-provider]').value })
  });
  toast(t('imageGeneration.taskUpdated'));
  await renderProductDetail(state.productDetail.product.id, 'factory');
}

function confirmImageRun() {
  return window.confirm(t('imageGeneration.confirmRun'));
}

async function runImageTask(taskId, retry = false) {
  if (!confirmImageRun()) return;
  const productId = state.productDetail.product.id;
  await api(`/api/products/${productId}/image-generation-tasks/${taskId}/${retry ? 'retry' : 'run'}`, { method: 'POST', body: JSON.stringify({ confirmed: true }) });
  toast(t('imageGeneration.runComplete'));
  await renderProductDetail(productId, 'factory');
}

async function runSelectedImageTasks(all = false) {
  if (!confirmImageRun()) return;
  const productId = state.productDetail.product.id;
  let path = 'run-all';
  let payload = { confirmed: true };
  if (!all) {
    const taskIds = [...document.querySelectorAll('[data-image-task-select]:checked')].map(input => Number(input.value));
    if (!taskIds.length) return toast(t('imageGeneration.selectedRequired'));
    path = 'run-selected';
    payload = { ...payload, task_ids: taskIds };
  }
  await api(`/api/products/${productId}/image-generation-tasks/${path}`, { method: 'POST', body: JSON.stringify(payload) });
  toast(t('imageGeneration.runComplete'));
  await renderProductDetail(productId, 'factory');
}

async function cancelImageTask(taskId) {
  const productId = state.productDetail.product.id;
  await api(`/api/products/${productId}/image-generation-tasks/${taskId}/cancel`, { method: 'POST' });
  toast(t('imageGeneration.taskUpdated'));
  await renderProductDetail(productId, 'factory');
}

async function reviewImageTask(taskId, decision) {
  const productId = state.productDetail.product.id;
  const reviewNotes = imageTaskNode(taskId)?.querySelector('[data-task-review-notes]')?.value || '';
  await api(`/api/products/${productId}/image-generation-tasks/${taskId}/${decision}`, { method: 'POST', body: JSON.stringify({ review_notes: reviewNotes }) });
  toast(t('imageGeneration.reviewSaved'));
  await renderProductDetail(productId, 'factory');
}

async function applyImageTask(taskId) {
  const productId = state.productDetail.product.id;
  await api(`/api/products/${productId}/image-generation-tasks/${taskId}/apply`, { method: 'POST' });
  state.products = null;
  toast(t('imageGeneration.imageApplied'));
  await renderProductDetail(productId, 'factory');
}

function previewImageTask(taskId) {
  const task = state.productDetail.aiContentFactory.imageTasks.find(item => item.id === Number(taskId));
  if (!task?.output_url) return;
  const backdrop = document.createElement('div');
  backdrop.id = 'generated-image-preview';
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="command-modal generated-preview" role="dialog" aria-modal="true"><div class="foundation-modal-head"><div><h2>${esc(task.image_type)}</h2><p>${esc(task.status)} · ${esc(task.provider)}</p></div><button type="button" class="icon-button" data-action="close-image-preview">${icon('close')}</button></div><img src="${esc(task.output_url)}" alt="${esc(task.image_type)}" /><div class="task-metadata"><span>${t('imageGeneration.dimensions')}: ${task.output_width || '—'}×${task.output_height || '—'}</span><span>${t('imageGeneration.requestId')}: ${esc(task.provider_request_id || '—')}</span></div></div>`;
  document.body.append(backdrop);
}

function opportunityScore(score, grade) {
  return `<span class="knowledge-score ${Number(score) >= 75 ? 'is-ready' : ''}"><strong>${Number(score || 0)}</strong><small>${esc(grade || 'D')}</small></span>`;
}

function opportunityScoreDetails(customer) {
  const score = Number(customer.opportunity_score || customer.sales_priority_score || 0);
  const positives = [];
  const missing = [];
  if (/hospitality|restaurant|coffee|bar|cafe|bubble|furniture|design/i.test(`${customer.business_type || ''} ${customer.customer_type || ''}`)) positives.push('Hospitality related business');
  if (customer.email || customer.phone || customer.website || customer.whatsapp) positives.push('Contact channel available'); else missing.push('Contact person');
  if (customer.purchase_timing && customer.purchase_timing !== 'Unknown') positives.push(`Purchase timing: ${customer.purchase_timing}`); else missing.push('Purchase timing');
  if (/renovation|remodel|upgrade|refresh/i.test(`${customer.opportunity_notes || ''} ${customer.ai_summary || ''}`)) positives.push('Renovation signal'); else missing.push('Renovation signal');
  if (Number(customer.sales_priority_score || 0) >= 70 || Number(customer.opportunity_score || 0) >= 75) positives.push('High sales priority score');
  const action = score >= 75 ? 'Prioritize follow-up. Confirm decision maker, timing, and quote requirements.' : score >= 45 ? 'Follow up after completing missing contact and timing information.' : 'Do not prioritize yet. Collect more information.';
  return `<article class="panel soft-panel section-gap"><div class="panel-header"><div class="panel-title"><h3>Opportunity Analysis</h3><p>${esc(customer.company_name)}</p></div>${badge(customer.opportunity_grade || customer.customer_value_grade || 'Review')}</div>
    <div class="debug-list"><div><span>Score</span><strong>${score}</strong></div><div><span>Customer Source</span><strong>${esc(customer.customer_source || 'Manual Import')}</strong></div><div><span>Recommended Action</span><strong>${esc(action)}</strong></div></div>
    <section class="detail-grid"><article><h4>Positive Signals</h4><ul class="compact-list">${positives.map(item => `<li>✓ ${esc(item)}</li>`).join('') || '<li>None yet</li>'}</ul></article>
    <article><h4>Missing Information</h4><ul class="compact-list">${missing.map(item => `<li>✕ ${esc(item)}</li>`).join('') || '<li>No major gaps detected</li>'}</ul></article></section>
    <p><strong>Recommended Products Reason:</strong> ${esc(customer.recommended_product_reason || 'Run analysis or confirm customer type to prepare product matching.')}</p></article>`;
}

let productLibraryPage=1;
const productListPageSize=10;

function productIntelligenceScoreBadge(score, label) {
  const value = Math.max(0, Math.min(100, Number(score || 0)));
  const status = value >= 80 ? 'ready' : value >= 50 ? 'review' : 'missing';
  return `<span class="pic-score-badge is-${status}"><strong>${value}</strong><small>${esc(label || (value >= 80 ? 'Ready' : 'Needs Review'))}</small></span>`;
}

function productPricingStatusBadge(product) {
  const status = product.pricing_status || (product.reference_price_display && product.reference_price_display !== 'Request Quote' ? 'Ready' : 'Missing Price');
  const tone = status === 'Ready' || status === 'Calculated' || status === 'Manual Override' ? 'ready' : 'review';
  return `<span class="pic-status-pill is-${tone}">${esc(status).toUpperCase()}</span><small>${esc(product.reference_price_display || 'Request Quote')}</small>`;
}

function pricingAmount(value, currency = 'USD') {
  if (value == null || value === '') return '—';
  const amount = Number(value);
  return Number.isFinite(amount) ? `${esc(currency || 'USD')} ${amount.toLocaleString(localeForIntl(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
}

function pricingStatusPill(status) {
  const value = status || 'Missing Price';
  const tone = /ready|calculated|manual override/i.test(value) ? 'ready' : 'review';
  return `<span class="pic-status-pill is-${tone}">${esc(value).toUpperCase()}</span>`;
}

function productIntelligenceDashboard(products) {
  const total = products.length;
  const active = products.filter(product => ['Active','Approved','approved'].includes(product.library_status || product.status)).length;
  const quoteReady = products.filter(product => ['Proposal Ready','Quote Ready'].includes(product.proposal_ready_status) || Number(product.data_quality || 0) >= 80).length;
  const aiReady = products.filter(product => Number(product.ai_readiness_score || 0) >= 80).length;
  const missingInfo = products.filter(product => Number(product.data_quality || 0) < 80).length;
  const needReview = products.filter(product => /review|draft|incomplete/i.test(`${product.data_quality_status || ''} ${product.library_status || ''} ${product.status || ''}`)).length;
  const missingImages = products.filter(product => !product.main_image_url).length;
  const missingAttributes = products.filter(product => (product.missing_fields || []).some(field => ['material','size','color','finish'].includes(field))).length;
  const missingVariants = products.filter(product => Number(product.variant_count || 0) === 0).length;
  const missingPricing = products.filter(product => product.pricing_status === 'Missing Price' || product.pricing_status === 'Needs Pricing Review' || product.reference_price_display === 'Request Quote').length;
  const statuses = products.reduce((acc, product) => {
    const status = product.library_status || product.status || 'Incomplete';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const metric = (label, value, sub, iconName, tone='green') => metricCard(label, value, sub, iconName, tone, true);
  return `<section class="pic-dashboard">
    <div class="pic-hero panel">
      <div><span class="eyebrow-label">Product Intelligence Center</span><h2>Product data workspace for AI Sales OS</h2><p>Review product readiness for sales, quotes, PI, and future AI matching. Product Library remains the single source of truth.</p></div>
      <div class="pic-hero-actions"><button class="button button--primary" data-action="add-product">${icon('plus')} New Product</button></div>
    </div>
    <div class="metrics-grid pic-metrics">
      ${metric('Total Products', total, 'All Product Library records', 'products')}
      ${metric('Active Products', active, 'Available product records', 'check')}
      ${metric('Products Ready for Quote', quoteReady, 'Data quality 80+', 'document')}
      ${metric('Products Ready for AI', aiReady, 'AI readiness 80+', 'sparkles')}
      ${metric('Products Missing Information', missingInfo, 'Needs product data work', 'help', 'gold')}
      ${metric('Products Need Review', needReview, 'Draft / review / incomplete', 'filter', 'gold')}
    </div>
    <section class="pic-summary-grid">
      <article class="panel pic-quality-panel"><div class="panel-title"><h2>Data Quality Summary</h2><p>Missing fields that block quote and AI readiness.</p></div>
        <div class="pic-quality-list">
          ${[['Missing images',missingImages],['Missing attributes',missingAttributes],['Missing variants',missingVariants],['Missing pricing information',missingPricing]].map(([label,value])=>`<span><small>${label}</small><strong>${value}</strong></span>`).join('')}
        </div>
      </article>
      <article class="panel pic-quality-panel"><div class="panel-title"><h2>Product Status Summary</h2><p>Current Product Library workflow states.</p></div>
        <div class="pic-status-list">${Object.entries(statuses).map(([label,value])=>`<span>${badge(label)}<strong>${value}</strong></span>`).join('') || '<p>No product statuses yet.</p>'}</div>
      </article>
    </section>
  </section>`;
}

function productIntelligenceRows(products) {
  return products.map(product => `<tr data-library-product
    data-search="${esc(`${product.product_name || product.name || ''} ${product.sku || ''}`.toLowerCase())}"
    data-category="${esc(product.category || '')}"
    data-status="${esc(product.library_status || product.status || '')}"
    data-quality="${Number(product.data_quality || 0)}"
    data-ai="${Number(product.ai_readiness_score || 0)}"
    data-pricing="${esc(product.pricing_status || '')}">
    <td>${product.main_image_url ? `<img src="${esc(product.main_image_url)}" alt="${esc(product.product_name || product.name)}">` : '<span class="library-image-empty">No image</span>'}</td>
    <td class="pic-product-name"><strong>${esc(product.product_name || product.name)}</strong><small>${esc(product.sku || 'No SKU')} · ${esc(product.category || 'Uncategorized')}</small></td>
    <td><code>${esc(product.sku || '—')}</code></td>
    <td>${esc(product.category || '—')}</td>
    <td><strong>${Number(product.variant_count || 0)}</strong></td>
    <td>${badge(product.library_status || product.status || 'Incomplete')}</td>
    <td>${productIntelligenceScoreBadge(product.data_quality, product.data_quality_status)}</td>
    <td>${productIntelligenceScoreBadge(product.ai_readiness_score, product.ai_readiness_status)}</td>
    <td>${productPricingStatusBadge(product)}</td>
    <td><div class="row-actions"><button class="button button--compact" data-action="open-library-product" data-id="${product.id}">View</button><button class="button button--compact" data-action="edit-product" data-id="${product.id}">Edit</button><button class="button button--compact" data-action="open-library-product" data-id="${product.id}">Review</button><button class="button button--compact" data-action="delete-library-product" data-id="${product.id}" data-name="${esc(product.product_name || product.name)}">Delete</button></div></td>
  </tr>`).join('');
}

function productIntelligenceApplyFilters() {
  const q = $('#library-product-search')?.value.toLowerCase() || '';
  const category = $('#library-category-filter')?.value || '';
  const status = $('#library-status-filter')?.value || '';
  const quality = $('#library-quality-filter')?.value || '';
  const pricing = $('#library-pricing-filter')?.value || '';
  document.querySelectorAll('[data-library-product]').forEach(row => {
    const passesQuality = !quality || (quality === 'ready' ? Number(row.dataset.quality) >= 80 : Number(row.dataset.quality) < 80);
    const passesPricing = !pricing || (pricing === 'ready' ? /ready|calculated|manual override/i.test(row.dataset.pricing) : /missing|review|request quote/i.test(row.dataset.pricing));
    row.hidden = !((!q || row.dataset.search.includes(q)) && (!category || row.dataset.category === category) && (!status || row.dataset.status === status) && passesQuality && passesPricing);
  });
}

async function renderProductLibraryProducts(){
  const [productIntelligence, libraryData] = await Promise.all([api('/api/product-intelligence/products'), api('/api/products')]);
  state.products = libraryData;
  const products = productIntelligence.products || [];
  const categories = [...new Set(products.map(product => product.category).filter(Boolean))].sort();
  const statuses = [...new Set(products.map(product => product.library_status || product.status).filter(Boolean))].sort();
  const totalPages = Math.max(1, Math.ceil(products.length / productListPageSize));
  productLibraryPage = Math.min(productLibraryPage, totalPages);
  const rows = products.slice((productLibraryPage - 1) * productListPageSize, productLibraryPage * productListPageSize);
  $('#page').innerHTML = `${pageHeader('Product Intelligence Center','Professional product dashboard and product list for sales, quote, PI, and AI readiness.',`<button class="button button--primary" data-action="add-product">${icon('plus')} New Product</button>`)}
    ${productIntelligenceDashboard(products)}
    <article class="panel pic-product-list">
      <div class="panel-header"><div class="panel-title"><h2>Products</h2><p>Professional Product Library table powered by Product Intelligence API.</p></div><span class="pic-source-note">${esc(productIntelligence.source || 'Product Library')}</span></div>
      <div class="filter-bar pic-filter-bar">
        <label class="filter-search">${icon('search')}<input id="library-product-search" placeholder="Search product name or SKU"></label>
        <select id="library-category-filter" class="select-control"><option value="">All Categories</option>${categories.map(category=>`<option>${esc(category)}</option>`).join('')}</select>
        <select id="library-status-filter" class="select-control"><option value="">All Statuses</option>${statuses.map(status=>`<option>${esc(status)}</option>`).join('')}</select>
        <select id="library-quality-filter" class="select-control"><option value="">All Data Quality</option><option value="ready">Data Quality 80+</option><option value="review">Needs Improvement</option></select>
        <select id="library-pricing-filter" class="select-control"><option value="">All Pricing</option><option value="ready">Pricing Ready</option><option value="review">Needs Pricing</option></select>
      </div>
      <div class="table-scroll"><table class="data-table product-library-table pic-product-table"><thead><tr><th>Product Image</th><th>Product Name</th><th>SKU / Product Code</th><th>Category</th><th>Variant Count</th><th>Product Status</th><th>Data Quality Score</th><th>AI Readiness Status</th><th>Pricing Status</th><th>Actions</th></tr></thead><tbody>${productIntelligenceRows(rows) || '<tr><td colspan="10"><div class="empty-state">No products yet.</div></td></tr>'}</tbody></table></div>
      <div class="library-pagination"><button class="button" data-action="library-page" data-page="${productLibraryPage-1}" ${productLibraryPage===1?'disabled':''}>Previous</button><span>Page ${productLibraryPage} of ${totalPages}</span><button class="button" data-action="library-page" data-page="${productLibraryPage+1}" ${productLibraryPage===totalPages?'disabled':''}>Next</button></div>
    </article>`;
  ['library-product-search','library-category-filter','library-status-filter','library-quality-filter','library-pricing-filter'].forEach(id=>$(`#${id}`)?.addEventListener(id==='library-product-search'?'input':'change',productIntelligenceApplyFilters));
}

async function renderProductLibraryCategoriesLegacy(){const data=await api('/api/product-categories');$('#page').innerHTML=`${pageHeader('Categories','Unlimited editable Product Library categories.')}<section class="library-management-grid"><article class="panel"><h2>New Category</h2><form id="library-category-create" class="foundation-form"><label class="field"><span>Name</span><input name="name" required></label><label class="field"><span>Slug</span><input name="slug" placeholder="auto-generated"></label><label class="field"><span>Description</span><textarea name="description"></textarea></label><button class="button button--primary">Create Category</button></form></article><article class="panel"><h2>Categories</h2><div class="foundation-manager-list">${data.categories.map(c=>`<article><span><strong>${esc(c.name)}</strong><small>${c.product_count} products · ${esc(c.slug)}</small></span><div><button class="button button--compact" data-action="library-edit-category" data-id="${c.id}" data-name="${esc(c.name)}" data-slug="${esc(c.slug)}">Edit</button><button class="button button--compact" data-action="library-delete-category" data-id="${c.id}">Delete</button></div></article>`).join('')}</div></article></section>`;$('#library-category-create').addEventListener('submit',async e=>{e.preventDefault();await api('/api/product-categories',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});state.products=null;await renderProductLibraryCategories()})}

async function renderProductLibraryAttributesLegacy(){const [attributes,categories]=await Promise.all([api('/api/product-attributes'),api('/api/product-categories')]);$('#page').innerHTML=`${pageHeader('Attributes','Configurable product and variant attributes.')}<section class="library-management-grid"><article class="panel"><h2>New Attribute</h2><form id="library-attribute-create" class="foundation-form"><label class="field"><span>Name</span><input name="name" required></label><label class="field"><span>Code</span><input name="code" required></label><label class="field"><span>Category</span><select name="category_id"><option value="">All Categories</option>${categories.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><label class="field"><span>Data Type</span><select name="data_type"><option>Text</option><option>Number</option><option>Boolean</option></select></label><label class="field"><span>Unit</span><input name="unit"></label><button class="button button--primary">Create Attribute</button></form></article><article class="panel"><h2>Attributes</h2><div class="foundation-manager-list">${attributes.attributes.map(a=>`<article><span><strong>${esc(a.name)}</strong><small>${esc(a.category||'All Categories')} · ${esc(a.data_type)} ${esc(a.unit||'')}</small></span><div><button class="button button--compact" data-action="library-edit-attribute" data-id="${a.id}" data-name="${esc(a.name)}" data-code="${esc(a.code)}">Edit</button><button class="button button--compact" data-action="library-delete-attribute" data-id="${a.id}">Delete</button></div></article>`).join('')||'<p>No attributes.</p>'}</div></article></section>`;$('#library-attribute-create').addEventListener('submit',async e=>{e.preventDefault();await api('/api/product-attributes',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});await renderProductLibraryAttributes()})}

async function renderProductLibraryVariants(){const data=await api('/api/product-variants');$('#page').innerHTML=`${pageHeader('Variants','Create and maintain product-specific variants.')}<section class="library-management-grid"><article class="panel"><h2>New Variant</h2><form id="library-variant-create" class="foundation-form"><label class="field"><span>Product</span><select name="product_id" required>${data.products.map(p=>`<option value="${p.id}">${esc(p.name)} · ${esc(p.sku)}</option>`).join('')}</select></label><label class="field"><span>Variant Name</span><input name="variant_name" required></label><label class="field"><span>SKU</span><input name="variant_sku"></label><label class="field"><span>Dimensions</span><input name="dimensions"></label><div class="field-row"><label class="field"><span>Reference Price</span><input name="reference_price" type="number" step=".01"></label><label class="field"><span>Cost Price</span><input name="cost_price" type="number" step=".01"></label></div><label class="field"><span>Status</span><select name="status"><option>Active</option><option>Hidden</option><option>Coming Soon</option><option>Discontinued</option></select></label><button class="button button--primary">Create Variant</button></form></article><article class="panel"><h2>All Variants</h2><div class="table-scroll"><table class="data-table"><thead><tr><th>Product</th><th>Variant</th><th>SKU</th><th>Dimensions</th><th>Reference Price</th><th>Cost Price</th><th>Status</th><th></th></tr></thead><tbody>${data.variants.map(v=>`<tr><td>${esc(v.product_name)}</td><td><strong>${esc(v.variant_name)}</strong></td><td>${esc(v.variant_sku||'—')}</td><td>${esc(v.dimensions||'—')}</td><td>${v.reference_price==null?'—':quoteMoney(v.reference_price)}</td><td>${v.cost_price==null?'—':quoteMoney(v.cost_price)}</td><td>${badge(v.status)}</td><td><button class="button button--compact" data-action="library-edit-variant" data-product-id="${v.product_id}" data-id="${v.id}" data-name="${esc(v.variant_name)}" data-price="${v.reference_price??''}" data-cost="${v.cost_price??''}" data-dimensions="${esc(v.dimensions||'')}" data-sku="${esc(v.variant_sku||'')}" data-status="${esc(v.status)}">Edit</button><button class="button button--compact" data-action="library-delete-variant" data-product-id="${v.product_id}" data-id="${v.id}">Delete</button></td></tr>`).join('')}</tbody></table></div></article></section>`;$('#library-variant-create').querySelector('button').insertAdjacentHTML('beforebegin',variantPimFields());$('#library-variant-create').addEventListener('submit',async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget));const productId=b.product_id;delete b.product_id;await api(`/api/products/${productId}/variants`,{method:'POST',body:JSON.stringify(b)});await renderProductLibraryVariants()})}

async function openProductFoundationManager(){const [categoryData,attributeData]=await Promise.all([api('/api/product-categories'),api('/api/product-attributes')]);const modal=document.createElement('div');modal.id='product-foundation-manager';modal.className='modal-backdrop';modal.innerHTML=`<div class="command-modal foundation-modal product-foundation-manager"><div class="foundation-modal-head"><div><h2>Product Categories & Attributes</h2><p>Administrator-managed Product Library structure.</p></div><button class="icon-button" data-action="close-product-foundation-manager">${icon('close')}</button></div><div class="foundation-manager-grid"><section><h3>Categories</h3><div class="foundation-manager-list">${categoryData.categories.map(category=>`<article><span><strong>${esc(category.name)}</strong><small>${category.product_count} products</small></span><div><button class="button button--compact" data-action="edit-product-category" data-id="${category.id}" data-name="${esc(category.name)}" data-slug="${esc(category.slug)}">Edit</button><button class="button button--compact" data-action="delete-product-category" data-id="${category.id}">Delete</button></div></article>`).join('')}</div><form id="product-category-form" class="foundation-form"><label class="field"><span>Name</span><input name="name" required></label><label class="field"><span>Slug</span><input name="slug" placeholder="auto-generated"></label><button class="button button--primary">Add Category</button></form></section><section><h3>Configurable Attributes</h3><div class="foundation-manager-list">${attributeData.attributes.map(attribute=>`<article><span><strong>${esc(attribute.name)}</strong><small>${esc(attribute.category||'All Categories')} · ${esc(attribute.data_type)} ${esc(attribute.unit||'')}</small></span><div><button class="button button--compact" data-action="edit-product-attribute" data-id="${attribute.id}" data-name="${esc(attribute.name)}" data-code="${esc(attribute.code)}">Edit</button><button class="button button--compact" data-action="delete-product-attribute" data-id="${attribute.id}">Delete</button></div></article>`).join('')||'<p>No attributes yet.</p>'}</div><form id="product-attribute-form" class="foundation-form"><label class="field"><span>Name</span><input name="name" required></label><label class="field"><span>Code</span><input name="code" required></label><label class="field"><span>Category</span><select name="category_id"><option value="">All Categories</option>${categoryData.categories.map(category=>`<option value="${category.id}">${esc(category.name)}</option>`).join('')}</select></label><label class="field"><span>Data Type</span><select name="data_type"><option>Text</option><option>Number</option><option>Boolean</option></select></label><label class="field"><span>Unit</span><input name="unit"></label><button class="button button--primary">Add Attribute</button></form></section></div></div>`;document.body.append(modal);$('#product-category-form').addEventListener('submit',async event=>{event.preventDefault();await api('/api/product-categories',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))});modal.remove();state.products=null;await openProductFoundationManager()});$('#product-attribute-form').addEventListener('submit',async event=>{event.preventDefault();await api('/api/product-attributes',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))});modal.remove();await openProductFoundationManager()})}

async function saveProductVariant(event){event.preventDefault();const productId=state.productDetail.product.id;const body=Object.fromEntries(new FormData(event.currentTarget));await api(`/api/products/${productId}/variants`,{method:'POST',body:JSON.stringify(body)});toast('Variant added');await renderProductDetail(productId,'products')}
async function saveProductFoundation(event){event.preventDefault();const productId=state.productDetail.product.id;const form=event.currentTarget;const checked=name=>[...form.querySelectorAll(`[name="${name}"]:checked`)].map(input=>Number(input.value));const attribute_values=[...form.querySelectorAll('[data-attribute-id]')].map(input=>({attribute_id:Number(input.dataset.attributeId),value:input.value}));await api(`/api/products/${productId}/foundation`,{method:'PUT',body:JSON.stringify({attribute_values,related_product_ids:checked('foundation_related_ids'),frequently_bought_together_ids:checked('foundation_fbt_ids')})});toast('Product foundation saved');await renderProductDetail(productId,'products')}

async function renderProductLibraryTags(){const data=await api('/api/product-tags');const groupOptions=data.groups.map(group=>`<option>${esc(group)}</option>`).join('');$('#page').innerHTML=`${pageHeader('Tags','Admin-managed Store Type, Style, and Business tags.')}<section class="library-management-grid"><article class="panel"><h2>New Tag</h2><form id="library-tag-create" class="foundation-form"><label class="field"><span>Name</span><input name="tag_name" required></label><label class="field"><span>Code</span><input name="code" required></label><label class="field"><span>Group</span><select name="tag_type">${groupOptions}</select></label><label class="field"><span>Sort Order</span><input name="sort_order" type="number" value="0"></label><label><input name="active" type="checkbox" checked> Active</label><button class="button button--primary">Create Tag</button></form></article><article class="panel"><h2>Tags</h2><div class="foundation-manager-list">${data.tags.map(tag=>`<article><span><strong>${esc(tag.tag_name)}</strong><small>${esc(tag.tag_type)} · ${tag.usage_count} products · ${tag.active?'Active':'Disabled'}</small></span><div><button class="button button--compact" data-action="library-edit-tag" data-id="${tag.id}" data-name="${esc(tag.tag_name)}" data-code="${esc(tag.code)}" data-group="${esc(tag.tag_type)}" data-sort="${tag.sort_order||0}">Edit</button><button class="button button--compact" data-action="library-toggle-tag" data-id="${tag.id}" data-active="${tag.active?1:0}">${tag.active?'Disable':'Enable'}</button><button class="button button--compact" data-action="library-delete-tag" data-id="${tag.id}">Delete</button></div></article>`).join('')}</div></article></section>`;$('#library-tag-create').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,body=Object.fromEntries(new FormData(form));body.active=form.active.checked;await api('/api/product-tags',{method:'POST',body:JSON.stringify(body)});await renderProductLibraryTags()})}

async function renderProductLibraryCategories(){const data=await api('/api/product-categories');$('#page').innerHTML=`${pageHeader('Categories','Admin-managed Product Library categories.')}<section class="library-management-grid"><article class="panel"><h2>New Category</h2><form id="library-category-create" class="foundation-form"><label class="field"><span>Name</span><input name="name" required></label><label class="field"><span>Slug</span><input name="slug"></label><label class="field"><span>Description</span><textarea name="description"></textarea></label><label class="field"><span>Sort Order</span><input name="sort_order" type="number" value="0"></label><label><input name="active" type="checkbox" checked> Active</label><button class="button button--primary">Create Category</button></form></article><article class="panel"><h2>Categories</h2><div class="foundation-manager-list">${data.categories.map(category=>`<article><span><strong>${esc(category.name)}</strong><small>${category.product_count} products · ${category.active?'Active':'Disabled'} · Sort ${category.sort_order||0}</small></span><div><button class="button button--compact" data-action="library-edit-category" data-id="${category.id}" data-name="${esc(category.name)}" data-slug="${esc(category.slug)}" data-sort="${category.sort_order||0}">Edit</button><button class="button button--compact" data-action="library-toggle-category" data-id="${category.id}" data-active="${category.active?1:0}">${category.active?'Disable':'Enable'}</button><button class="button button--compact" data-action="library-delete-category" data-id="${category.id}">Delete</button></div></article>`).join('')}</div></article></section>`;$('#library-category-create').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,body=Object.fromEntries(new FormData(form));body.active=form.active.checked;await api('/api/product-categories',{method:'POST',body:JSON.stringify(body)});state.products=null;await renderProductLibraryCategories()})}

function attributeMasterForm(categories){return `<label class="field"><span>Name</span><input name="name" required></label><label class="field"><span>Code</span><input name="code" required></label><label class="field"><span>Categories (Ctrl/Cmd for multiple)</span><select name="category_ids" multiple size="5">${categories.filter(category=>category.active).map(category=>`<option value="${category.id}">${esc(category.name)}</option>`).join('')}</select></label><label class="field"><span>Data Type</span><select name="data_type">${['Text','Number','Select','Multi-select','Color','Image','Boolean'].map(type=>`<option>${type}</option>`).join('')}</select></label><label class="field"><span>Options (one per line)</span><textarea name="options"></textarea></label><div class="field-row"><label class="field"><span>Unit</span><input name="unit"></label><label class="field"><span>Sort Order</span><input name="sort_order" type="number" value="0"></label></div><fieldset><legend>Display</legend>${[['show_in_library','Product Library',true],['show_on_website','Website'],['show_in_quote','Quote'],['show_in_pi','PI'],['internal_only','Internal only']].map(([name,label,checked])=>`<label><input type="checkbox" name="${name}" ${checked?'checked':''}> ${label}</label>`).join(' ')}</fieldset><label><input name="active" type="checkbox" checked> Active</label>`}

async function renderProductLibraryAttributes(){const [data,categoryData]=await Promise.all([api('/api/product-attributes'),api('/api/product-categories')]);const categoryName=id=>categoryData.categories.find(category=>category.id===Number(id))?.name;$('#page').innerHTML=`${pageHeader('Attributes','Category-specific product and variant attributes.')}<section class="library-management-grid"><article class="panel"><h2>New Attribute</h2><form id="library-attribute-create" class="foundation-form">${attributeMasterForm(categoryData.categories)}<button class="button button--primary">Create Attribute</button></form></article><article class="panel"><h2>Attributes</h2><div class="foundation-manager-list">${data.attributes.map(attribute=>`<article><span><strong>${esc(attribute.name)}</strong><small>${esc(attribute.category_ids.map(categoryName).filter(Boolean).join(', ')||'All Categories')} · ${esc(attribute.data_type)} · ${attribute.active?'Active':'Disabled'}${attribute.options.length?` · ${attribute.options.map(option=>esc(option.option_value)).join(', ')}`:''}</small></span><div><button class="button button--compact" data-action="library-edit-attribute" data-id="${attribute.id}">Edit</button><button class="button button--compact" data-action="library-delete-attribute" data-id="${attribute.id}">Delete</button></div></article>`).join('')||'<p>No attributes.</p>'}</div></article></section>`;$('#library-attribute-create').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,body=Object.fromEntries(new FormData(form));body.category_ids=[...form.category_ids.selectedOptions].map(option=>Number(option.value));body.options=String(body.options||'').split(/\r?\n|,/).map(value=>value.trim()).filter(Boolean);for(const name of ['show_in_library','show_on_website','show_in_quote','show_in_pi','internal_only','active'])body[name]=form.elements[name].checked;await api('/api/product-attributes',{method:'POST',body:JSON.stringify(body)});await renderProductLibraryAttributes()})}

function opportunityTabs(active, counts = {}) {
  const tabs = [
    ['dashboard', 'Opportunity Dashboard'], ['discovery', 'AI Discovery'], ['search-strategies', `Search Strategies (${counts.searchStrategies || 0})`], ['search-tasks', `Search Tasks (${counts.searchTasks || 0})`], ['lead-pool', `Lead Pool (${counts.leads || 0})`],
    ['customers', `Customers (${counts.customers || 0})`], ['priority', `Priority View (${counts.priority || 0})`]
  ];
  return `<nav class="knowledge-tabs opportunity-tabs" role="tablist">${tabs.map(([key, label]) => `<button type="button" class="${active === key ? 'is-active' : ''}" data-action="opportunity-tab" data-tab="${key}" role="tab">${label}</button>`).join('')}</nav>`;
}

function opportunityMetricsCards(metrics) {
  const cards = [
    ['Total Customers', metrics.totalCustomers, 'users'], ['Imported Today', metrics.importedToday, 'imports'],
    ['AI Processed', metrics.aiProcessed, 'sparkles'], ['A+ Opportunities', metrics.gradeAPlus, 'briefcase'],
    ['A Opportunities', metrics.gradeA, 'briefcase'], ['Ready for Sales', metrics.readyForSales, 'sales-ai'],
    ['Missing Decision Maker', metrics.missingDecisionMaker, 'users'], ['Missing Email', metrics.missingEmail, 'mail'],
    ['Missing WhatsApp', metrics.missingWhatsApp, 'help'], ['Sales Accepted Leads', metrics.salesAcceptedLeads, 'check']
  ];
  return `<section class="metrics-grid opportunity-metrics">${cards.map(([label, value, iconName], index) => metricCard(label, value, index < 3 ? 'Live' : '', iconName, index % 3 === 1 ? 'gold' : 'blue')).join('')}</section>`;
}

function customerTable(customers, capabilities, queue = false) {
  const scorePanel = state.customerScoreDetail ? opportunityScoreDetails(state.customerScoreDetail) : '';
  return `<div class="table-scroll"><table class="data-table" id="opportunity-customer-table"><thead><tr>
    ${capabilities.canRunAi && !queue ? '<th></th>' : ''}<th>Customer</th><th>Source</th><th>Country / City</th><th>Business Type</th><th>Customer Value</th><th>Buying Opportunity</th><th>Sales Priority</th><th>Score</th><th>Grade</th><th>Recommended Products</th><th>Next Action</th><th>Contact</th><th>Assigned Sales</th><th></th>
    </tr></thead><tbody>${customers.map(customer => `<tr data-source="${esc(customer.customer_source || 'Manual Import')}" data-type="${esc(customer.customer_type || customer.business_type || '')}" data-grade="${esc(customer.opportunity_grade || '')}" data-priority="${Number(customer.sales_priority_score || 0)}" data-status="${esc(customer.opportunity_status || '')}" data-search="${esc(`${customer.company_name || ''} ${customer.brand_name || ''} ${customer.customer_source || ''} ${customer.customer_type || ''} ${customer.business_type || ''} ${customer.country || ''} ${customer.city || ''} ${customer.opportunity_status || ''}`.toLowerCase())}">
      ${capabilities.canRunAi && !queue ? `<td><input type="checkbox" data-customer-select value="${customer.id}" aria-label="Select ${esc(customer.company_name)}" /></td>` : ''}
      <td class="primary-cell"><strong>${esc(customer.brand_name || customer.company_name)}</strong><small>${customer.is_test_data ? `${badge('TEST')} ` : ''}${esc(customer.source)} · ${esc(customer.opportunity_status)}</small></td><td>${badge(customer.customer_source || 'Manual Import')}</td>
      <td>${esc([customer.country, customer.city].filter(Boolean).join(' / ') || '·')}</td><td>${esc(customer.business_type || '·')}</td>
      <td>${Number(customer.customer_value_score || 0)}</td><td>${Number(customer.buying_opportunity_score || 0)}</td><td>${Number(customer.sales_priority_score || 0)}</td>
      <td><button class="button button--compact" data-action="show-score-detail" data-id="${customer.id}">${Number(customer.opportunity_score || 0)}</button></td><td>${badge(customer.opportunity_grade)}</td>
      <td>${esc(customer.recommended_products || customer.recommended_categories || '·')}</td><td>${esc(customer.next_action || 'Run AI to generate')}</td>
      <td>${esc(customer.email || customer.whatsapp || customer.website || customer.decision_maker || 'Missing')}</td><td>${esc(customer.assigned_sales_name || 'Unassigned')}</td>
      <td><button class="button button--compact" data-action="view-customer" data-id="${customer.id}">Open</button></td>
    </tr>`).join('') || '<tr><td colspan="15"><div class="empty-state">No customers yet.</div></td></tr>'}</tbody></table></div>${scorePanel}`;
}

function leadPoolTable(leads) {
  const sourceLink=lead=>/^https?:\/\//i.test(String(lead.source_url||''))?`<a class="evidence-link" href="${esc(lead.source_url)}" target="_blank" rel="noopener noreferrer">View Source</a>`:`<span class="lead-muted">${esc(lead.reference_note||lead.website||'Not provided')}</span>`;
  return `<div class="table-scroll lead-pool-scroll"><table class="data-table lead-pool-table" id="opportunity-lead-table"><colgroup><col class="lead-col"><col class="source-col"><col class="location-col"><col class="type-col"><col class="score-col"><col class="potential-col"><col class="recommendation-col"><col class="evidence-col"><col class="status-col"><col class="actions-col"></colgroup><thead><tr>
    <th>Lead</th><th>Source</th><th>Location</th><th>Customer Type</th><th>Score</th><th>Potential</th><th>AI Recommendation</th><th>Evidence</th><th>Status</th><th></th>
  </tr></thead><tbody>${leads.map(lead => `<tr data-search="${esc(`${lead.company_name || ''} ${lead.customer_type || ''} ${lead.country || ''} ${lead.city || ''} ${lead.source_type || ''} ${lead.status || ''}`.toLowerCase())}">
    <td class="primary-cell lead-name-cell"><strong>${esc(lead.company_name)}</strong><small>${esc(lead.task_name || 'Search Result Lead')}</small></td>
    <td>${badge(lead.source_type || 'Manual')}</td><td>${esc([lead.country, lead.city].filter(Boolean).join(' / ') || '—')}</td><td>${esc(lead.customer_type || '—')}</td>
    <td>${Number(lead.opportunity_score || 0)}</td><td>${esc(lead.purchase_potential || 'Unknown')}</td><td class="lead-recommendation">${esc(lead.recommended_next_action || 'Review lead')}</td>
    <td class="lead-evidence-cell">${sourceLink(lead)}</td><td>${badge(lead.status || 'reviewed')}</td>
    <td class="lead-actions-cell"><button class="button button--compact" data-action="view-search-result" data-id="${lead.id}">Open</button></td>
  </tr>`).join('') || '<tr><td colspan="10"><div class="empty-state">No leads yet. Create Search Results from Search Tasks first.</div></td></tr>'}</tbody></table></div>`;
}

function renderLeadDetail(lead) {
  if (!lead) return '';
  const contact = [lead.contact_person, lead.email, lead.phone, lead.linkedin, lead.instagram].filter(Boolean).join(' · ') || 'No contact information yet';
  const evidence=lead.evidence_json||{},aiStatus=lead.ai_qualification_status||'Pending';
  const sourceUrl=lead.source_url||evidence.sourceUrl||'';
  const sourceLink=/^https?:\/\//i.test(String(sourceUrl))?`<a class="evidence-link" href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">View Source</a>`:'Not provided';
  const websiteLink=/^https?:\/\//i.test(String(lead.website||''))?`<a class="detail-value-link" href="${esc(lead.website)}" target="_blank" rel="noopener noreferrer">${esc(lead.website)}</a>`:esc(lead.website||'Missing');
  const aiLabel=aiStatus==='Qualified'?'AI Qualified':aiStatus==='Failed'?'AI Qualification Failed':aiStatus==='Blocked'?'AI Qualification Blocked':aiStatus==='Running'?'AI Qualification Running':'AI Qualification Pending';
  const history = [
    ['Lead Created', lead.created_at],
    [aiLabel, lead.ai_qualification_at || lead.created_at]
  ];
  if(lead.review_audit_id)history.push([`Reviewed by ${lead.reviewed_by||'User'}`,lead.reviewed_at]);
  else history.push([lead.status==='reviewed'?'Reviewed (legacy status)':`Status: ${lead.status||'new'}`,lead.updated_at||lead.created_at]);
  if (lead.status === 'converted') history.push(['Converted to Customer', lead.updated_at]);
  return `<article class="panel lead-detail-panel">
    <div class="panel-header"><div class="panel-title"><h2>${esc(lead.company_name)}</h2><p>Lead Detail · ${esc(lead.task_name || 'Search Result')}</p></div><div class="row-actions">${badge(lead.status || 'reviewed')}<button class="button" data-action="back-lead-pool">Back to Lead Pool</button></div></div>
    <section class="detail-grid">
      <article><h3>AI Summary</h3>${badge(aiLabel)}<small class="qualification-source">${esc(lead.qualification_source||'Initial Rules / Manual Data')}${lead.ai_qualification_provider?` · ${esc(lead.ai_qualification_provider)}`:''}</small><p>${esc(lead.opportunity_summary || (aiStatus==='Failed'?'AI qualification failed. Review the lead or retry.':'AI qualification summary is pending.'))}</p><dl class="lead-field-list"><div><dt>Score</dt><dd>${Number(lead.opportunity_score || 0)}</dd></div><div><dt>Purchase Potential</dt><dd>${esc(lead.purchase_potential || 'Unknown')}</dd></div></dl></article>
      <article><h3>Website & Contact</h3><dl class="lead-field-list"><div><dt>Website</dt><dd>${websiteLink}</dd></div><div><dt>Contact</dt><dd>${esc(contact)}</dd></div></dl></article>
      <article><h3>Product Matching</h3><p>${esc(lead.recommended_product_reason || 'Run qualification to prepare product direction.')}</p></article>
    </section>
    <details class="source-evidence-card section-gap" open><summary>Source & Evidence</summary><dl class="lead-field-list evidence-field-list"><div><dt>Connector</dt><dd>${esc(lead.connector_key||lead.source_type||'Manual')}</dd></div><div><dt>Connector Version</dt><dd>${esc(lead.connector_version||evidence.connectorVersion||'—')}</dd></div><div><dt>External ID</dt><dd>${esc(lead.external_id||evidence.externalId||'—')}</dd></div><div><dt>Source URL</dt><dd>${sourceLink}</dd></div><div><dt>Captured Time</dt><dd>${esc(lead.captured_at||evidence.capturedTime||'—')}</dd></div><div><dt>Search Execution</dt><dd>${lead.search_execution_id?`#${Number(lead.search_execution_id)}`:'—'}</dd></div><div><dt>Normalization Version</dt><dd>${esc(lead.normalization_version||evidence.normalizationVersion||'—')}</dd></div><div><dt>Duplicate Status</dt><dd>${lead.duplicate_of_search_result_id?`Review candidate · Result #${Number(lead.duplicate_of_search_result_id)}`:'No duplicate detected'}</dd></div><div class="evidence-note-row"><dt>Reference Note</dt><dd>${esc(lead.reference_note||'—')}</dd></div></dl></details>
    <section class="detail-grid section-gap">
      <article><h3>AI Recommendation</h3><p>${esc(lead.recommended_next_action || 'Review the lead and decide whether to convert.')}</p><h3>Qualification Reason</h3><p>${esc(lead.qualification_reason || 'No qualification reason yet.')}</p></article>
      <article><h3>Customer Intelligence</h3><p>This lead is still before CRM conversion. Use AI qualification, evidence, and product matching to decide whether it should become a Customer.</p><div class="row-actions"><button class="button" data-action="run-lead-ai" data-id="${lead.id}" ${aiStatus==='Running'?'disabled':''}>${aiStatus==='Running'?'AI Running…':'Run AI'}</button><button class="button" data-action="edit-search-result" data-id="${lead.id}">Update Intelligence</button></div></article>
    </section>
    <article class="panel section-gap">${panelHeader('Activity History', 'Lead workflow history before CRM conversion')}<div class="activity-list">${history.map(([label, date]) => `<div class="activity-item"><span></span><div><strong>${esc(label)}</strong><p>${esc(date || '')}</p></div></div>`).join('')}</div></article>
    <div class="row-actions section-gap">${lead.status !== 'converted' ? `${!['reviewed','discarded'].includes(lead.status)?`<button class="button" data-action="review-search-result" data-id="${lead.id}">Mark Reviewed</button>`:''}<button class="button button--primary" data-action="convert-search-result" data-id="${lead.id}">Convert to Customer</button><button class="button" data-action="discard-search-result" data-id="${lead.id}">Discard</button>` : `<button class="button button--primary" data-action="view-customer" data-id="${lead.customer_id}">Open Customer</button>`}</div>
  </article>`;
}

function applyCustomerListFilters() {
  const table = $('#opportunity-customer-table');
  if (!table) return;
  const q = String($('#customer-search-filter')?.value || '').trim().toLowerCase();
  const source = $('#customer-source-filter')?.value || '';
  const type = $('#customer-type-filter')?.value || '';
  const grade = $('#customer-grade-filter')?.value || '';
  const priority = $('#customer-priority-filter')?.value || '';
  const status = $('#customer-status-filter')?.value || '';
  table.querySelectorAll('tbody tr').forEach(row => {
    if (!row.dataset.search) return;
    const priorityValue = Number(row.dataset.priority || 0);
    const priorityPass = !priority || (priority === 'high' && priorityValue >= 75) || (priority === 'medium' && priorityValue >= 40 && priorityValue < 75) || (priority === 'low' && priorityValue < 40);
    row.hidden = Boolean(
      (q && !row.dataset.search.includes(q)) ||
      (source && row.dataset.source !== source) ||
      (type && row.dataset.type !== type) ||
      (grade && row.dataset.grade !== grade) ||
      (status && row.dataset.status !== status) ||
      !priorityPass
    );
  });
}

function discoveryPlanResult(result) {
  if (!result) return `<div class="empty-state">Describe your ideal customer, then click Analyze Requirement to create a structured Customer Discovery Plan.</div>`;
  const plan = result.plan || {};
  const guidance = result.guidance || {};
  const scoring = result.scoring_profile || {};
  const list = values => (values || []).map(value => `<li>${esc(value)}</li>`).join('');
  const generated = result.generated_search_plan || null;
  return `<section class="discovery-result-grid">
    <article class="panel discovery-plan-card"><div class="panel-header"><div class="panel-title"><h2>Customer Discovery Plan</h2><p>AI/rules generated, human-reviewed before search execution.</p></div>${badge(guidance.needs_more_information ? 'Needs More Info' : 'Ready to Search')}</div>
      <div class="debug-list discovery-fields">
        <div><span>Target Customer Type</span><strong>${esc(plan.target_customer_type || 'Needs Clarification')}</strong></div>
        <div><span>Industry</span><strong>${esc(plan.industry || 'Hospitality Furniture')}</strong></div>
        <div><span>Country</span><strong>${esc(plan.country || 'Needs Clarification')}</strong></div>
        <div><span>Region / City</span><strong>${esc(plan.region_city || 'Needs Clarification')}</strong></div>
        <div><span>Company Size</span><strong>${esc(plan.company_size || 'Unknown')}</strong></div>
        <div><span>Confidence</span><strong>${Number(plan.confidence_score || 0)}%</strong></div>
      </div>
      <h3>Recommended Keywords</h3><ul class="compact-list">${list(plan.recommended_keywords)}</ul>
      <h3>Recommended Search Sources</h3><ul class="compact-list">${list(plan.recommended_search_sources)}</ul>
      <h3>Exclude</h3><ul class="compact-list">${list(plan.excluded_customers)}</ul></article>
    <article class="panel discovery-plan-card"><h2>Search Guidance</h2><p>${esc(guidance.message || '')}</p>
      <h3>Suggested Filters</h3><ul class="compact-list">${list(guidance.suggestions)}</ul>
      <h3>Recommended Next Step</h3><p>${esc(guidance.recommended_next_step || '')}</p>
      <h3>Dynamic Scoring Profile</h3><p><strong>${esc(scoring.customer_type || plan.target_customer_type || 'Needs Clarification')}</strong></p>
      <div class="score-dimension-list">${(scoring.dimensions || []).map(dimension => `<div><span>${esc(dimension.name)}</span><strong>${Number(dimension.weight || 0)}%</strong></div>`).join('') || '<p>No scoring profile selected yet.</p>'}</div></article>
  </section>${generated ? generatedSearchPlanSection(generated) : ''}`;
}

function generatedSearchPlanSection(plan) {
  const list = values => (values || []).map(value => `<li>${esc(value)}</li>`).join('');
  const createAction = state.discoveryPlan?.request?.id ? '<button class="button button--primary" data-action="create-search-strategy-from-plan">Create Strategy Draft</button>' : '';
  return `<article class="panel generated-search-plan"><div class="panel-header"><div class="panel-title"><h2>Generated Search Plan</h2><p>Review this draft before any future customer discovery execution.</p></div><div class="row-actions">${badge(plan.status || 'Draft Search Plan')}${createAction}</div></div>
    <div class="debug-list discovery-fields">
      <div><span>Target Customer</span><strong>${esc(plan.target_customer || 'Needs Clarification')}</strong></div>
      <div><span>Customer Type</span><strong>${esc(plan.customer_type || 'Needs Clarification')}</strong></div>
      <div><span>Industry</span><strong>${esc(plan.industry || 'Hospitality Furniture')}</strong></div>
      <div><span>Location</span><strong>${esc(plan.location || 'Needs Clarification')}</strong></div>
      <div><span>Company Size</span><strong>${esc(plan.company_size || 'Unknown')}<br><small>${esc(plan.company_size_detail || '')}</small></strong></div>
      <div><span>Recommended Search Volume</span><strong>${esc(plan.recommended_search_volume || '50 companies')}</strong></div>
      <div><span>Priority</span><strong>${esc(plan.priority || 'Medium')}</strong></div>
    </div>
    <h3>Reason</h3><ul class="compact-list">${list(plan.priority_reasons)}</ul>
    <h3>Search Objective</h3><p>${esc(plan.search_objective || '')}</p>
    <section class="generated-search-grid">
      <div><h3>Recommended Filters</h3><ul class="compact-list">${list(plan.recommended_filters)}</ul></div>
      <div><h3>Search Keywords</h3><ul class="compact-list">${list(plan.search_keywords)}</ul></div>
      <div><h3>Recommended Data Fields</h3><ul class="compact-list">${list(plan.recommended_data_fields)}</ul></div>
      <div><h3>Exclude</h3><ul class="compact-list">${list(plan.exclude)}</ul></div>
    </section></article>`;
}

function renderCustomerDiscoveryPane(data) {
  const latest = state.discoveryPlan || data.discoveryRequests?.[0] && { plan: data.discoveryRequests[0].search_plan, guidance: data.discoveryRequests[0].guidance, scoring_profile: data.discoveryRequests[0].scoring_profile };
  return `<section class="discovery-assistant">
    <article class="panel"><div class="panel-header"><div class="panel-title"><h2>Describe your ideal customer</h2><p>Example: I want to find small restaurant furniture distributors in California.</p></div>${badge('No external search API')}</div>
      <label class="field"><span>Target customer description</span><textarea id="customer-discovery-input" rows="5" placeholder="I want to find small restaurant furniture distributors in California.&#10;I want to find restaurant design companies in Texas.&#10;I want to find coffee shop owners planning renovation.">${esc(state.discoveryPrompt || '')}</textarea></label>
      <div class="button-row"><button class="button button--primary" data-action="analyze-discovery-requirement">Analyze Requirement</button><button class="button" data-action="generate-discovery-plan">Generate Search Plan</button></div>
      <p class="muted">AI Cost Control is active. The system only analyzes when you click a button; page loading does not call external AI.</p></article>
    ${discoveryPlanResult(latest)}
    <article class="panel"><h2>Customer Type System</h2><p>Dynamic customer categories and scoring weights prepared for future expansion.</p>
      <div class="opportunity-card-grid">${(data.discoveryConfig?.customerTypes || []).map(profile => `<div class="opportunity-card"><strong>${esc(profile.customer_type)}</strong><small>${esc(profile.industry)}</small><div class="score-dimension-list">${profile.dimensions.map(dimension => `<div><span>${esc(dimension.name)}</span><strong>${Number(dimension.weight)}%</strong></div>`).join('')}</div></div>`).join('')}</div></article>
  </section>`;
}

function searchTaskRows(tasks) {
  return tasks.map(task => `<tr><td class="primary-cell"><strong>${esc(task.task_name)}</strong><small>Target: ${esc(task.target_customer || task.customer_type || '—')}</small></td>
    <td>${esc(task.customer_type || '—')}</td><td>${esc(task.location || '—')}</td><td>${esc(task.company_size || '—')}</td><td>${Number(task.target_quantity || 0)} companies</td>
    <td>${badge(task.priority || 'Medium')}</td><td>${badge(task.status || 'Draft')}</td><td>${esc(task.created_at || '')}</td>
    <td><div class="row-actions"><button class="button button--compact" data-action="view-search-task" data-id="${task.id}">View</button>${task.status === 'Draft' && ['Admin','Owner'].includes(state.user?.role) ? `<button class="button button--compact button--primary" data-action="start-search-task" data-id="${task.id}">Mark Ready</button>` : ''}<button class="button button--compact" data-action="cancel-search-task" data-id="${task.id}">Cancel</button></div></td></tr>`).join('');
}

function renderSearchTaskDetail(task) {
  if (state.searchResultDetail && !state.searchResultEdit) return renderLeadDetail(state.searchResultDetail);
  const list = values => (values || []).map(value => `<li>${esc(value)}</li>`).join('');
  const results = task.search_results || [];
  const summary = task.search_result_summary || { total: results.length };
  const editing = state.searchResultEdit || null;
  const executions=task.executions||[],execution=executions[0]||null,isAdmin=['Admin','Owner'].includes(state.user?.role);
  const resultRows = results.map(result => `<tr><td class="primary-cell"><strong>${esc(result.company_name)}</strong><small>${esc(result.website || result.email || 'No website/contact yet')}</small></td>
    <td>${esc(result.customer_type || '-')}<small>${badge(result.connector_key||result.source_type||'Manual')}</small></td><td>${esc([result.city, result.country].filter(Boolean).join(', ') || '-')}</td><td>${Number(result.opportunity_score || 0)}</td><td>${esc(result.purchase_potential || '-')}</td><td>${badge(result.status || 'new')}</td>
    <td><div class="row-actions"><button class="button button--compact button--primary" data-action="view-search-result" data-id="${result.id}">Open</button><button class="button button--compact" data-action="edit-search-result" data-id="${result.id}">Edit</button>${result.status !== 'converted' ? `<button class="button button--compact" data-action="discard-search-result" data-id="${result.id}">Discard</button>` : ''}</div></td></tr>`).join('');
  const detail = state.searchResultDetail ? `<article class="panel soft-panel"><div class="panel-header"><div class="panel-title"><h3>${esc(state.searchResultDetail.company_name)}</h3><p>${esc(state.searchResultDetail.opportunity_summary || '')}</p></div><div class="row-actions">${badge('AI Analysis Completed')}${badge(state.searchResultDetail.status)}</div></div><div class="debug-list"><div><span>Why this customer matters</span><strong>${esc(state.searchResultDetail.why_customer_matters || '-')}</strong></div><div><span>Recommended products</span><strong>${esc(state.searchResultDetail.recommended_product_reason || '-')}</strong></div><div><span>Recommended next action</span><strong>${esc(state.searchResultDetail.recommended_next_action || '-')}</strong></div><div><span>Qualification reason</span><strong>${esc(state.searchResultDetail.qualification_reason || '-')}</strong></div><div><span>Source URL</span><strong>${esc(state.searchResultDetail.source_url || '-')}</strong></div><div><span>Reference Note</span><strong>${esc(state.searchResultDetail.reference_note || '-')}</strong></div></div></article>` : '';
  const value = name => esc(editing?.[name] || '');
  const sourceTypes = ['Google Maps','Website','Instagram','Facebook','LinkedIn','Manual','Other'];
  const executionActions=task.status==='Ready'&&!execution?`<button class="button button--primary" data-action="estimate-execution" data-id="${task.id}">Estimate Execution</button>`:'';
  const lifecycle=execution?`${execution.status==='Awaiting Approval'&&isAdmin?`<button class="button button--primary" data-action="execution-approve" data-id="${execution.id}">Approve</button>`:''}${execution.status==='Approved'&&isAdmin?`<button class="button button--primary" data-action="execution-start" data-id="${execution.id}">Start</button>`:''}${['Paused','Interrupted'].includes(execution.status)&&isAdmin?`<button class="button button--primary" data-action="execution-resume" data-id="${execution.id}">Resume</button>`:''}${execution.status==='Running'&&isAdmin?`<button class="button" data-action="execution-pause" data-id="${execution.id}">Pause</button>`:''}${['Approved','Running','Paused','Interrupted'].includes(execution.status)&&isAdmin?`<button class="button button--risk" data-action="execution-stop" data-id="${execution.id}">Stop</button>`:''}`:'';
  const displayPhase=execution?.status==='Completed'?'Complete':execution?.status==='Partially Completed'?'Partial Complete':execution?.phase||'-';
  const executionPanel=`<section class="panel execution-panel section-gap"><div class="panel-header"><div class="panel-title"><h3>Search Execution</h3><p>Controlled Rules/Mock execution. No external platform is called.</p></div><div class="row-actions">${execution?badge(execution.status):badge('Not Estimated')}${executionActions}${lifecycle}</div></div>${execution?`<dl class="execution-stat-grid"><div><dt>Connector</dt><dd>${esc(execution.connector_key)}</dd></div><div><dt>Version</dt><dd>${esc(execution.connector_version)}</dd></div><div><dt>Phase</dt><dd>${esc(displayPhase)}</dd></div><div><dt>Pages</dt><dd>${Number(execution.page_count)}</dd></div><div><dt>Received</dt><dd>${Number(execution.received_count)}</dd></div><div><dt>Normalized</dt><dd>${Number(execution.normalized_count)}</dd></div><div><dt>Inserted</dt><dd>${Number(execution.inserted_count)}</dd></div><div><dt>Duplicates</dt><dd>${Number(execution.duplicate_count)}</dd></div><div><dt>Estimated Cost</dt><dd>$${Number(execution.estimated_cost_usd||0).toFixed(2)}</dd></div><div><dt>Approved Limit</dt><dd>$${Number(execution.approved_cost_limit_usd||0).toFixed(2)}</dd></div></dl><div class="debug-list execution-summary"><div><span>Last heartbeat</span><strong>${esc(execution.heartbeat_at||'-')}</strong></div><div><span>Stop reason</span><strong>${esc(execution.stop_reason||'-')}</strong></div><details><summary>Checkpoint and last error</summary><p>${esc(JSON.stringify(execution.checkpoint_json||{}))}</p><p>${esc(execution.last_error_message||'No error')}</p></details></div>`:`<div class="empty-state">Complete Task Review, then create a zero-cost execution estimate.</div>`}</section>`;
  return `<article class="panel search-task-detail"><div class="panel-header"><div class="panel-title"><h2>${esc(task.task_name)}</h2><p>${esc(task.search_objective || '')}</p></div><div class="row-actions">${badge(task.status)}<button class="button" data-action="back-search-tasks">Back to Search Tasks</button>${task.status === 'Draft'&&isAdmin ? `<button class="button button--primary" data-action="start-search-task" data-id="${task.id}">Mark Ready</button>` : ''}</div></div>
    <section class="detail-grid">
      <article><h3>Search Criteria</h3><div class="debug-list discovery-fields"><div><span>Customer Type</span><strong>${esc(task.customer_type || '—')}</strong></div><div><span>Location</span><strong>${esc(task.location || '—')}</strong></div><div><span>Company Size</span><strong>${esc(task.company_size || '—')}</strong></div><div><span>Priority</span><strong>${esc(task.priority || 'Medium')}</strong></div><div><span>Target Volume</span><strong>${Number(task.target_quantity || 0)} companies</strong></div></div></article>
      <article><h3>Keywords</h3><ul class="compact-list">${list(task.keywords)}</ul></article>
      <article><h3>Required Data Fields</h3><ul class="compact-list">${list(task.required_data_fields)}</ul></article>
      <article><h3>Filters</h3><ul class="compact-list">${list(task.filters)}</ul></article>
    </section>
    ${executionPanel}
    <section class="section-gap">${panelHeader('Search Results', 'Store manually discovered leads before they enter the Lead Pool')}
      <div class="metrics-grid compact-metrics"><div class="metric-card"><span>Total Results</span><strong>${Number(summary.total || 0)}</strong><small>Stored candidates</small></div><div class="metric-card"><span>Converted</span><strong>${Number(summary.converted || 0)}</strong><small>Moved to Customers CRM</small></div><div class="metric-card"><span>Lead Pool</span><strong>${Number((summary.new || 0) + (summary.reviewed || 0))}</strong><small>Open leads</small></div></div>
      ${detail}
      <form id="search-result-form" class="foundation-form section-gap" data-edit-id="${editing?.id || ''}">
        <div class="panel-header"><div class="panel-title"><h3>${editing ? 'Edit Search Result' : 'Add Search Result'}</h3><p>30-second entry. AI Qualification runs after saving; no external search API is connected.</p></div>${editing ? '<button class="button" type="button" data-action="cancel-search-result-edit">Cancel Edit</button>' : ''}</div>
        <label class="field"><span>Company Name *</span><input name="company_name" required value="${value('company_name')}"></label>
        <label class="field"><span>Customer Type *</span><input name="customer_type" required value="${value('customer_type') || esc(task.customer_type || '')}"></label>
        <label class="field"><span>Country *</span><input name="country" required value="${value('country')}"></label>
        <label class="field"><span>City *</span><input name="city" required value="${value('city')}"></label>
        <label class="field"><span>Source Type *</span><select name="source_type" required>${sourceTypes.map(type => `<option ${((editing?.source_type || 'Manual') === type) ? 'selected' : ''}>${esc(type)}</option>`).join('')}</select></label>
        <label class="field"><span>Website</span><input name="website" value="${value('website')}"></label>
        <details class="field field--full optional-section"><summary>Contact Information (Optional)</summary><div class="foundation-form">
          <label class="field"><span>Contact Person</span><input name="contact_person" value="${value('contact_person')}"></label>
          <label class="field"><span>Email</span><input name="email" type="email" value="${value('email')}"></label>
          <label class="field"><span>Phone</span><input name="phone" value="${value('phone')}"></label>
          <label class="field"><span>LinkedIn</span><input name="linkedin" value="${value('linkedin')}"></label>
          <label class="field"><span>Instagram</span><input name="instagram" value="${value('instagram')}"></label>
        </div></details>
        <fieldset class="field field--full evidence-card"><legend>Customer Evidence</legend>
          <label class="field"><span>Source URL</span><input name="source_url" value="${value('source_url') || value('source_reference')}" placeholder="Google Maps, Instagram, Website, or LinkedIn URL"></label>
          <label class="field"><span>Reference Note</span><input name="reference_note" value="${value('reference_note')}" placeholder="Short note for future handoff"></label>
          <p class="form-hint">Screenshot / Attachment: future. Save the source link or note here for now.</p>
        </fieldset>
        <button class="button button--primary" type="submit">Save Search Result</button>
      </form>
      <div class="table-scroll section-gap"><table class="data-table"><thead><tr><th>Company</th><th>Customer Type</th><th>Location</th><th>Score</th><th>Potential</th><th>Status</th><th>Actions</th></tr></thead><tbody>${resultRows || '<tr><td colspan="7"><div class="empty-state">Total Results: 0. Click Save Search Result after manually finding a company.</div></td></tr>'}</tbody></table></div>
    </section></article>`;
}

function renderSearchTasksPane(data) {
  if (state.searchTaskDetail) return renderSearchTaskDetail(state.searchTaskDetail);
  return `<article class="panel">${panelHeader('Search Tasks', 'Convert AI Search Plans into executable discovery tasks. External search execution is not connected in this MVP.')}
    <div class="table-scroll"><table class="data-table"><thead><tr><th>Task</th><th>Customer Type</th><th>Location</th><th>Company Size</th><th>Volume</th><th>Priority</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>${searchTaskRows(data.searchTasks || []) || '<tr><td colspan="9"><div class="empty-state">No search tasks yet. Generate a Search Plan, then click Create Search Task.</div></td></tr>'}</tbody></table></div></article>`;
}

function strategyCsv(value) { return esc((Array.isArray(value) ? value : []).join(', ')); }
function strategyLines(value) { return esc((Array.isArray(value) ? value : []).join('\n')); }
function strategyBadge(status) { return `<span class="stage stage--${statusClass(status)}">${esc(status)}</span>`; }
function strategyKeywordTags(values) { return `<div class="strategy-keyword-tags">${(values || []).map(value => `<span>${esc(value)}</span>`).join('') || '<small>No keywords defined</small>'}</div>`; }
function renderSearchStrategyDetail(strategy, capabilities, contextOutdated = false) {
  const data = strategy.strategy_data_json || {}, draft = strategy.status === 'Draft';
  const primaryAction = draft ? `<button class="button button--primary" data-action="strategy-submit" data-id="${strategy.id}">Submit Review</button>` : strategy.status === 'Needs Review' && capabilities.canApprove ? `<button class="button button--primary" data-action="strategy-approve" data-id="${strategy.id}">Approve</button>` : strategy.status === 'Approved' && capabilities.canCreateSearchTask && !strategy.linked_search_task_id ? `<button class="button button--primary" data-action="strategy-create-task" data-id="${strategy.id}">Create Draft Search Task</button>` : '';
  const secondaryActions = `${draft && capabilities.canGenerate ? `<button class="button button--soft" data-action="strategy-generate" data-id="${strategy.id}">AI Generate</button>` : ''}${draft ? `<button class="button" data-action="strategy-estimate" data-id="${strategy.id}">Planning Estimate</button>` : ''}${strategy.status === 'Needs Review' && capabilities.canApprove ? `<button class="button" data-action="strategy-request-changes" data-id="${strategy.id}">Request Changes</button>` : ''}`;
  const archiveAction = strategy.status === 'Approved' && capabilities.canApprove ? strategy.linked_search_task_id ? `<span class="strategy-disabled-action"><button class="button button--risk" disabled>Archive</button><small>Unavailable while Search Task #${strategy.linked_search_task_id} is active</small></span>` : `<button class="button button--risk" data-action="strategy-archive" data-id="${strategy.id}">Archive</button>` : '';
  return `<article class="panel strategy-detail"><div class="panel-header strategy-detail-header"><div class="panel-title"><h2>${esc(strategy.title)}</h2><p>${strategyBadge(strategy.status)} <span>Revision ${strategy.revision_no}${contextOutdated ? ' · Context updated since generation' : ''}</span></p></div><div class="row-actions strategy-actions"><button class="button" data-action="strategy-back">Back</button>${primaryAction}${secondaryActions}<button class="button" data-action="strategy-history" data-id="${strategy.id}">History</button>${archiveAction}</div></div>
    <form id="search-strategy-form" class="foundation-form" data-id="${strategy.id}">
      <label class="field"><span>Title</span><input name="title" value="${esc(strategy.title)}" ${draft ? '' : 'disabled'} required></label>
      <label class="field field--full"><span>Search Objective</span><textarea name="searchObjective" ${draft ? '' : 'disabled'} required>${esc(data.searchObjective || strategy.objective || '')}</textarea></label>
      <label class="field"><span>Countries</span><input name="countries" value="${strategyCsv(data.targetMarket?.countries)}" ${draft ? '' : 'disabled'}></label>
      <label class="field"><span>Cities</span><input name="cities" value="${strategyCsv(data.targetMarket?.cities)}" ${draft ? '' : 'disabled'}></label>
      <label class="field"><span>Customer Types</span><input name="customerTypes" value="${strategyCsv(data.targetCustomerProfile?.customerTypes)}" ${draft ? '' : 'disabled'}></label>
      <label class="field"><span>Platforms</span><input name="platforms" value="${strategyCsv(data.platforms)}" ${draft ? '' : 'disabled'}></label>
      <label class="field field--full"><span>Search Keywords</span>${draft ? `<textarea name="searchKeywords" rows="6" placeholder="One keyword per line">${strategyLines(data.searchKeywords)}</textarea><small class="field-help">Use one focused search phrase per line.</small>` : strategyKeywordTags(data.searchKeywords)}</label>
      <label class="field"><span>Expected Results</span><input name="expectedCount" type="number" min="0" value="${Number(data.resultTarget?.expectedCount || 0)}" ${draft ? '' : 'disabled'}></label>
      <label class="field"><span>Minimum Qualified</span><input name="minimumQualifiedCount" type="number" min="0" value="${Number(data.resultTarget?.minimumQualifiedCount || 0)}" ${draft ? '' : 'disabled'}></label>
      ${draft ? '<button class="button button--primary" type="submit">Save Draft</button>' : ''}
    </form>
    <section class="detail-grid section-gap"><article><h3>Knowledge & Context</h3><p>${strategy.knowledge_references_json?.length || 0} fixed references</p><small>Snapshot ${esc(strategy.context_snapshot_id || 'Not generated')} · ${contextOutdated ? 'Updated context available' : 'Current at last check'}</small></article><article><h3>AI Cost</h3><p>USD ${Number(strategy.ai_cost_estimate || 0).toFixed(6)}</p><small>All AI calls pass Cost Control</small></article><article><h3>Search Planning Estimate</h3><p>USD ${Number(strategy.search_cost_estimate || 0).toFixed(6)}</p><small>Planning only. No connector or actual charge.</small></article><article><h3>Review</h3><p>${esc(strategy.review_note || 'No review note')}</p><small>${strategy.linked_search_task_id ? `Linked Search Task #${strategy.linked_search_task_id}` : 'No linked Search Task'}</small></article></section></article>`;
}

function renderSearchStrategiesPane(data) {
  if (state.searchStrategyDetail) return renderSearchStrategyDetail(state.searchStrategyDetail, data.strategyCapabilities, state.searchStrategyContextOutdated);
  const all=data.searchStrategies||[], archivedCount=all.filter(item=>item.status==='Archived').length, visible=all.filter(item=>state.showArchivedStrategies?item.status==='Archived':item.status!=='Archived');
  const rows=visible.map(item=>`<tr><td class="primary-cell strategy-name-cell"><strong title="${esc(item.title)}">${esc(item.title)}</strong><small title="${esc(item.strategy_key)}">${esc(item.strategy_key)}</small></td><td>v${item.revision_no}</td><td>${strategyBadge(item.status)}</td><td>USD ${Number(item.search_cost_estimate||0).toFixed(4)}</td><td>${formatDateTime(item.updated_at)}</td><td class="strategy-table-action"><button class="button button--compact" data-action="strategy-view" data-id="${item.id}">Open</button></td></tr>`).join('');
  return `<section class="detail-grid strategy-intro-grid"><form id="search-strategy-create" class="panel foundation-form"><h2>Create Blank Draft</h2><label class="field"><span>Title</span><input name="title" required></label><label class="field field--full"><span>Objective</span><textarea name="objective" rows="4" required></textarea></label><button class="button button--primary" type="submit">Create Draft</button></form><article class="panel strategy-boundary"><h2>Human Approval Boundary</h2><p>AI creates Drafts only. Admin or Owner approval is required before a Draft Search Task can be created.</p></article></section><article class="panel section-gap strategy-list-panel"><div class="panel-header"><div class="panel-title"><h2>Search Strategies</h2><p>Archived records remain available without crowding the active workflow.</p></div><div class="strategy-list-filter"><button class="button button--compact ${state.showArchivedStrategies?'':'button--soft'}" data-action="strategy-filter" data-filter="current">Current (${all.length-archivedCount})</button><button class="button button--compact ${state.showArchivedStrategies?'button--soft':''}" data-action="strategy-filter" data-filter="archived">Archived (${archivedCount})</button></div></div><div class="table-scroll"><table class="data-table strategy-table"><thead><tr><th>Strategy</th><th>Revision</th><th>Status</th><th>Planning Estimate</th><th>Updated</th><th>Actions</th></tr></thead><tbody>${rows||`<tr><td colspan="6"><div class="empty-state">No ${state.showArchivedStrategies?'archived':'current'} Search Strategies.</div></td></tr>`}</tbody></table></div></article>`;
}

function renderOpportunityPane(data) {
  const view = state.opportunityView || 'dashboard';
  const counts = { customers: data.customers.length, priority: data.priority.length, queue: data.queue.length, handoff: data.handoff.length, searchTasks: data.searchTasks?.length || 0, searchStrategies: data.searchStrategies?.length || 0 };
  const capabilities = data.capabilities;
  const sourceOptions = data.sources.map(source => `<option>${esc(source)}</option>`).join('');
  const customerFilterOptions = field => [...new Set(data.customers.map(customer => customer[field]).filter(Boolean))].sort().map(value => `<option>${esc(value)}</option>`).join('');
  if (view === 'dashboard') return `${opportunityMetricsCards(data.metrics)}
    <section class="detail-grid section-gap"><article class="panel">${panelHeader('Today’s Priority Queue', 'Highest-value A+/A opportunities ready for human action')}${customerTable(data.queue.slice(0, 5), capabilities, true)}</article>
    <article class="panel"><div class="panel-header"><div class="panel-title"><h2>AI Pipeline Status</h2><p>Rule provider is active; external AI remains optional.</p></div>${badge(data.debug.scoring_engine_status)}</div>
      <div class="debug-list"><div><span>Product Matching</span><strong>${esc(data.debug.product_matching_status)}</strong></div><div><span>Duplicate Check</span><strong>${esc(data.debug.duplicate_check_status)}</strong></div><div><span>Open Data Gaps</span><strong>${data.debug.gaps_open}</strong></div><div><span>Last AI Run</span><strong>${esc(data.debug.last_ai_run_at || 'Not run')}</strong></div></div></article></section>`;
  if (view === 'discovery') return renderCustomerDiscoveryPane(data);
  if (view === 'search-strategies') return renderSearchStrategiesPane(data);
  if (view === 'search-tasks') return renderSearchTasksPane(data);
  if (view === 'lead-pool') return state.searchResultEdit && state.searchTaskDetail
    ? renderSearchTaskDetail(state.searchTaskDetail)
    : state.searchResultDetail
    ? renderLeadDetail(state.searchResultDetail)
    : `<article class="panel">${panelHeader('Lead Pool', 'Review AI-qualified leads before converting them into CRM customers')}${leadPoolTable(data.leads || [])}</article>`;
  if (view === 'import') return `<section class="opportunity-import-grid">
    <form id="customer-manual-form" class="panel opportunity-form"><h2>Manual Customer</h2><p>Create one sourced customer record.</p>
      <div class="foundation-form"><label class="field"><span>Company Name</span><input name="company_name" required /></label><label class="field"><span>Business Type</span><input name="business_type" placeholder="Coffee Shop" /></label>
      <label class="field"><span>Country</span><input name="country" /></label><label class="field"><span>City</span><input name="city" /></label><label class="field"><span>Email</span><input name="email" type="email" /></label>
      <label class="field"><span>Website</span><input name="website" /></label><label class="field"><span>Store Count</span><input name="store_count" type="number" min="0" /></label>
      <label class="field"><span>Source</span><select name="source">${sourceOptions}</select></label></div><button class="button button--primary" type="submit">Import Customer</button></form>
    <form id="customer-csv-form" class="panel opportunity-form"><h2>CSV Paste Import</h2><p>Header example: company_name,business_type,city,country,email,website</p><label class="field"><span>Source</span><select name="source"><option>CSV</option>${sourceOptions}</select></label><label class="field"><span>CSV Data</span><textarea name="csv" rows="10" required></textarea></label><button class="button button--primary" type="submit">Import CSV</button></form>
    <form id="customer-text-form" class="panel opportunity-form"><h2>Batch Text Import</h2><p>One line: Company | Type | City | Country | Email | Website</p><label class="field"><span>Source</span><select name="source">${sourceOptions}</select></label><label class="field"><span>Customer Lines</span><textarea name="text" rows="10" required></textarea></label><button class="button button--primary" type="submit">Import Text</button></form>
    </section>`;
  if (view === 'customers') return `<article class="panel">${panelHeader('Customers', 'CRM records after lead conversion. Use this page for sales follow-up, quotes, PI, orders, and customer work.')}
    <div class="filter-bar">
      <label class="filter-search">${icon('search')}<input id="customer-search-filter" placeholder="Search customers" /></label>
      <select id="customer-source-filter" class="select-control"><option value="">All Sources</option>${customerFilterOptions('customer_source')}</select>
      <select id="customer-type-filter" class="select-control"><option value="">All Customer Types</option>${customerFilterOptions('customer_type')}</select>
      <select id="customer-grade-filter" class="select-control"><option value="">All Grades</option>${customerFilterOptions('opportunity_grade')}</select>
      <select id="customer-priority-filter" class="select-control"><option value="">All Sales Priority</option><option value="high">High 75+</option><option value="medium">Medium 40-74</option><option value="low">Low Below 40</option></select>
      <select id="customer-status-filter" class="select-control"><option value="">All Statuses</option>${customerFilterOptions('opportunity_status')}</select>
      ${capabilities.canRunAi ? '<button class="button button--primary" data-action="run-selected-customers">Analyze Selected Customers</button>' : ''}
    </div>${customerTable(data.customers, capabilities)}</article>`;
  if (view === 'priority') return `<article class="panel">${panelHeader('Customer Intelligence Priority View', 'Sorted by Sales Priority Score from Phase 2A dual scoring')}${customerTable(data.priority, capabilities, true)}</article>`;
  if (view === 'queue') return `<article class="panel">${panelHeader('AI Opportunity Queue', 'A+/A opportunities ordered by score, contactability, decision maker, and due date')}${customerTable(data.queue, capabilities, true)}</article>`;
  if (view === 'outreach') return `<article class="panel">${panelHeader('Outreach Drafts', 'Draft-only messages; sending always requires a human and happens outside this platform')}
    <div class="opportunity-card-grid">${data.customers.filter(customer => customer.last_ai_run_at).map(customer => `<button class="opportunity-card" data-action="view-customer" data-id="${customer.id}"><span>${badge(customer.opportunity_grade)}</span><strong>${esc(customer.company_name)}</strong><small>${esc(customer.ai_recommendation || 'Open to review outreach')}</small></button>`).join('') || '<div class="empty-state">Run AI to create reviewable outreach drafts.</div>'}</div></article>`;
  return `<article class="panel">${panelHeader('Sales Handoff', 'Qualified opportunities that meet grade and contactability rules')}${customerTable(data.handoff, capabilities, true)}</article>`;
}

async function renderOpportunityIntelligence() {
  const [dashboard, customersData, priorityData, queueData, handoffData, discoveryConfig, discoveryHistory, searchTasksData, strategyData] = await Promise.all([
    api('/api/opportunity/dashboard'), api('/api/customers'), api('/api/customer-intelligence/priority'), api('/api/opportunity-queue'), api('/api/customers/sales-handoff'),
    api('/api/customer-discovery/config'), api('/api/customer-discovery/requests'), api('/api/search-tasks'), api('/api/search-strategies')
  ]);
  const searchTaskDetails = await Promise.all((searchTasksData.tasks || []).slice(0, 50).map(task => api(`/api/search-tasks/${task.id}`)));
  const leads = searchTaskDetails.flatMap(detail => (detail.task.search_results || []).map(result => ({
    ...result,
    task_name: detail.task.task_name,
    search_objective: detail.task.search_objective,
    search_task_status: detail.task.status
  }))).filter(lead => !['converted', 'discarded'].includes(lead.status));
  state.opportunityIntelligence = {
    metrics: dashboard.metrics, debug: dashboard.debug, capabilities: dashboard.capabilities,
    customers: customersData.customers, priority: priorityData.customers, sources: customersData.sources, statuses: customersData.statuses,
    queue: queueData.customers, handoff: handoffData.customers, discoveryConfig, discoveryRequests: discoveryHistory.requests, searchTasks: searchTasksData.tasks, leads,
    searchStrategies: strategyData.strategies, strategyCapabilities: strategyData.capabilities
  };
  $('#page').innerHTML = `${pageHeader('Opportunity Intelligence', 'Turn sourced customer data into clean, scored, product-matched, human-approved sales opportunities.',
    dashboard.capabilities.canImport ? '<button class="button button--primary" data-action="opportunity-tab" data-tab="import">Import Customers</button>' : '')}
    ${opportunityTabs(state.opportunityView, { leads: leads.length, customers: customersData.customers.length, priority: priorityData.customers.length, queue: queueData.customers.length, handoff: handoffData.customers.length, searchTasks: searchTasksData.tasks.length, searchStrategies: strategyData.strategies.length })}
    <div class="opportunity-pane">${renderOpportunityPane(state.opportunityIntelligence)}</div>`;
  $('#customer-manual-form')?.addEventListener('submit', submitManualCustomer);
  $('#customer-csv-form')?.addEventListener('submit', event => submitCustomerImport(event, 'csv'));
  $('#customer-text-form')?.addEventListener('submit', event => submitCustomerImport(event, 'text'));
  $('#search-result-form')?.addEventListener('submit', submitSearchResult);
  $('#search-strategy-create')?.addEventListener('submit', createBlankSearchStrategy);
  $('#search-strategy-form')?.addEventListener('submit', saveSearchStrategy);
  ['customer-search-filter','customer-source-filter','customer-type-filter','customer-grade-filter','customer-priority-filter','customer-status-filter']
    .forEach(id => $(`#${id}`)?.addEventListener(id === 'customer-search-filter' ? 'input' : 'change', applyCustomerListFilters));
}

async function submitManualCustomer(event) {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(event.currentTarget));
  await api('/api/customers', { method: 'POST', body: JSON.stringify(body) });
  toast('Customer imported.'); state.opportunityView = 'customers'; await renderOpportunityIntelligence();
}

async function submitCustomerImport(event, type) {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(event.currentTarget));
  const result = await api('/api/customers/import', { method: 'POST', body: JSON.stringify({ source: body.source, [type]: body[type] }) });
  toast(`${result.imported} imported; ${result.duplicates} duplicates skipped.`); state.opportunityView = 'customers'; await renderOpportunityIntelligence();
}

async function runCustomerDiscovery(action) {
  const prompt = String($('#customer-discovery-input')?.value || '').trim();
  if (!prompt) return toast('Please describe your ideal customer first.');
  state.discoveryPrompt = prompt;
  const endpoint = action === 'generate' ? '/api/customer-discovery/generate-plan' : '/api/customer-discovery/analyze';
  const result = await api(endpoint, { method: 'POST', body: JSON.stringify({ request_text: prompt }) });
  state.discoveryPlan = result;
  toast(action === 'generate' ? 'Search plan generated.' : 'Requirement analyzed.');
  await renderOpportunityIntelligence();
}

async function createSearchStrategyFromPlan() {
  const discoveryId = state.discoveryPlan?.request?.id;
  if (!discoveryId) return toast('Generate a Search Plan first.');
  const plan=state.discoveryPlan.generated_search_plan||{};
  const result = await api('/api/search-strategies', {
    method: 'POST',
    body: JSON.stringify({ customer_discovery_request_id: discoveryId, title: `Search Strategy - ${plan.target_customer||'Target Market'}`, objective: plan.search_objective||'Build an approved search strategy' })
  });
  state.searchStrategyDetail = result.strategy;
  state.opportunityView = 'search-strategies';
  toast('Strategy Draft created.');
  await renderOpportunityIntelligence();
}

const strategyList=value=>String(value||'').split(/\r?\n|,/).map(item=>item.trim()).filter(Boolean);
async function createBlankSearchStrategy(event){event.preventDefault();const body=Object.fromEntries(new FormData(event.currentTarget));const result=await api('/api/search-strategies',{method:'POST',body:JSON.stringify(body)});state.searchStrategyDetail=result.strategy;await renderOpportunityIntelligence()}
async function viewSearchStrategy(id){const result=await api(`/api/search-strategies/${id}`);state.searchStrategyDetail=result.strategy;state.searchStrategyContextOutdated=result.context_outdated;await renderOpportunityIntelligence()}
async function saveSearchStrategy(event){event.preventDefault();const strategy=state.searchStrategyDetail,current=strategy.strategy_data_json||{},form=Object.fromEntries(new FormData(event.currentTarget));const expected=Number(form.expectedCount||0),minimum=Number(form.minimumQualifiedCount||0);const data={...current,targetMarket:{...(current.targetMarket||{}),countries:strategyList(form.countries),cities:strategyList(form.cities),regions:current.targetMarket?.regions||[]},targetCustomerProfile:{...(current.targetCustomerProfile||{}),customerTypes:strategyList(form.customerTypes)},searchObjective:form.searchObjective,searchKeywords:strategyList(form.searchKeywords),platforms:strategyList(form.platforms),resultTarget:{expectedCount:expected,minimumQualifiedCount:Math.min(minimum,expected)}};const result=await api(`/api/search-strategies/${strategy.id}`,{method:'PUT',body:JSON.stringify({title:form.title,objective:form.searchObjective,strategy_data_json:data})});state.searchStrategyDetail=result.strategy;toast('Strategy Draft saved.');await renderOpportunityIntelligence()}
async function searchStrategyAction(id,action,body={}){const result=await api(`/api/search-strategies/${id}/${action}`,{method:'POST',body:JSON.stringify(body)});if(result.strategy)state.searchStrategyDetail=result.strategy;if(result.task){state.searchTaskDetail=result.task;state.searchStrategyDetail=null;state.opportunityView='search-tasks'}toast(action.replaceAll('-',' '));await renderOpportunityIntelligence()}
function openStrategyArchiveConfirmation(id){const modal=document.createElement('div');modal.className='modal-backdrop';modal.id='strategy-archive-modal';modal.innerHTML=`<div class="command-modal strategy-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="strategy-archive-title"><div class="strategy-confirm-body"><span class="strategy-risk-mark">${icon('document')}</span><div><h2 id="strategy-archive-title">Archive Search Strategy?</h2><p>This action will not delete the record. It will archive the Strategy and preserve its complete history.</p></div></div><div class="strategy-confirm-actions"><button class="button" data-action="strategy-archive-cancel">Cancel</button><button class="button button--risk" data-action="strategy-archive-confirm" data-id="${id}">Archive Strategy</button></div></div>`;document.body.append(modal)}

async function viewSearchTask(id) {
  const [result,executionData] = await Promise.all([api(`/api/search-tasks/${id}`),api(`/api/search-tasks/${id}/executions`)]);
  state.searchTaskDetail = result.task;
  state.searchTaskDetail.executions=executionData.executions||[];
  await renderOpportunityIntelligence();
}

async function startSearchTask(id) {
  const result = await api(`/api/search-tasks/${id}/ready`, { method: 'POST', body: JSON.stringify({connectorKey:'rules-mock'}) });
  state.searchTaskDetail = result.task;
  toast('Search Task marked Ready.');
  await renderOpportunityIntelligence();
}

async function estimateExecution(taskId){await api(`/api/search-tasks/${taskId}/estimate-execution`,{method:'POST',body:JSON.stringify({connectorKey:'rules-mock'})});const created=await api(`/api/search-tasks/${taskId}/create-execution`,{method:'POST',body:JSON.stringify({connectorKey:'rules-mock'})});toast('Zero-cost execution estimate created. Approval is still required.');await viewSearchTask(taskId);return created;}
async function executionAction(id,action){await api(`/api/search-executions/${id}/${action}`,{method:'POST',body:'{}'});toast(`Execution ${action} completed.`);await viewSearchTask(state.searchTaskDetail.id);}

async function submitSearchResult(event) {
  event.preventDefault();
  const taskId = state.searchTaskDetail.id;
  const editId = event.currentTarget.dataset.editId;
  const body = Object.fromEntries(new FormData(event.currentTarget));
  const result = editId
    ? await api(`/api/search-results/${editId}`, { method: 'PUT', body: JSON.stringify(body) })
    : await api(`/api/search-tasks/${taskId}/results`, { method: 'POST', body: JSON.stringify(body) });
  const detail = await api(`/api/search-tasks/${taskId}`);
  state.searchTaskDetail = detail.task;
  state.searchResultEdit = null;
  state.searchResultDetail = result.result;
  toast(editId ? 'Search Result updated. AI Analysis Completed.' : 'Search Result saved. AI Analysis Completed.');
  await renderOpportunityIntelligence();
}

async function viewSearchResult(id) {
  const result = await api(`/api/search-results/${id}`);
  state.searchResultDetail = result.result;
  state.searchResultEdit = null;
  state.opportunityView = 'lead-pool';
  await renderOpportunityIntelligence();
}

async function editSearchResult(id) {
  const result = await api(`/api/search-results/${id}`);
  if (!state.searchTaskDetail || Number(state.searchTaskDetail.id) !== Number(result.result.search_task_id)) {
    const task = await api(`/api/search-tasks/${result.result.search_task_id}`);
    state.searchTaskDetail = task.task;
  }
  state.searchResultEdit = result.result;
  state.searchResultDetail = result.result;
  await renderOpportunityIntelligence();
}

async function runLeadAi(id) {
  const button=document.querySelector(`[data-action="run-lead-ai"][data-id="${id}"]`);
  if(button?.disabled)return;
  if(button){button.disabled=true;button.textContent='AI Running…';}
  try{
    await api(`/api/search-results/${id}/run-ai-qualification`, { method: 'POST', body: '{}' });
    const refreshed=await api(`/api/search-results/${id}`);
    state.searchResultDetail=refreshed.result;
    state.searchResultEdit=null;
    toast('AI Qualification completed.');
    await renderOpportunityIntelligence();
  }catch(error){
    const refreshed=await api(`/api/search-results/${id}`).catch(()=>null);
    if(refreshed?.result)state.searchResultDetail=refreshed.result;
    toast(error.message||'AI Qualification failed.');
    await renderOpportunityIntelligence();
  }
}

async function reviewSearchResult(id){
  const reviewed=await api(`/api/search-results/${id}/review`,{method:'POST',body:'{}'});
  state.searchResultDetail=reviewed.result;
  state.searchResultEdit=null;
  toast('Lead marked Reviewed.');
  await renderOpportunityIntelligence();
}

async function convertSearchResult(id) {
  try {
    const result = await api(`/api/search-results/${id}/convert`, { method: 'POST', body: '{}' });
    const taskId = state.searchTaskDetail?.id || result.result.search_task_id;
    if (taskId) {
      const detail = await api(`/api/search-tasks/${taskId}`);
      state.searchTaskDetail = detail.task;
    }
    state.searchResultDetail = result.result;
    state.searchResultEdit = null;
    state.opportunityView = 'lead-pool';
    toast('Lead converted to Customer.');
    await renderOpportunityIntelligence();
  } catch (error) {
    toast(error.message || 'Possible existing customer found. Review before converting.');
  }
}

async function discardSearchResult(id) {
  const result = await api(`/api/search-results/${id}/discard`, { method: 'POST', body: '{}' });
  const taskId = state.searchTaskDetail?.id || result.result.search_task_id;
  if (taskId) {
    const detail = await api(`/api/search-tasks/${taskId}`);
    state.searchTaskDetail = detail.task;
  }
  state.searchResultDetail = null;
  state.searchResultEdit = null;
  state.opportunityView = 'lead-pool';
  toast('Lead discarded.');
  await renderOpportunityIntelligence();
}

async function renderCustomerDetail(id) {
  const data = await api(`/api/customers/${id}`);
  const customer = data.customer;
  state.customerDetail = customer;
  const recommendations = customer.recommended_products.map(item => `<article class="knowledge-related-card"><span>${esc(item.category || '')}</span><strong>${esc(item.product_name || item.category)}</strong><small>${esc(item.recommendation_reason)}</small><p>${esc(item.sales_angle || '')}</p></article>`).join('') || '<div class="empty-state">Run AI to match products.</div>';
  $('#page').innerHTML = `${pageHeader(esc(customer.company_name), `${esc(customer.business_type || 'Hospitality')} · ${esc(customer.city || '')} ${esc(customer.country || '')}`,
    data.capabilities.canRunAi ? `<button class="button button--primary" data-action="run-customer-ai" data-id="${id}">${icon('sparkles')} Run AI</button>` : '', '<button class="button" data-action="back-opportunities">Back</button>')}
    <section class="knowledge-hero panel"><div>${opportunityScore(customer.opportunity_score, customer.opportunity_grade)}<div><span class="eyebrow-label">Opportunity Status</span><strong>${esc(customer.opportunity_status)}</strong><small>Data quality ${customer.data_quality_score}% · confidence ${customer.confidence_score}%</small></div></div><div class="knowledge-hero-summary"><span>AI Summary</span><p>${esc(customer.ai_summary || 'Run AI to generate an opportunity summary.')}</p></div></section>
    <section class="detail-grid section-gap"><article class="panel knowledge-section"><h2>Basic Info</h2><div class="debug-list"><div><span>Source</span><strong>${esc(customer.source)}</strong></div><div><span>Website</span><strong>${esc(customer.website || 'Missing')}</strong></div><div><span>Email</span><strong>${esc(customer.email || 'Missing')}</strong></div><div><span>WhatsApp</span><strong>${esc(customer.whatsapp || 'Missing')}</strong></div><div><span>Stores</span><strong>${customer.store_count || 'Unknown'}</strong></div><div><span>Years</span><strong>${customer.years_in_business || 'Unknown'}</strong></div></div></article>
    <article class="panel knowledge-section"><h2>Next Action</h2><p>${esc(customer.next_action || 'Run AI to calculate next action.')}</p><strong>${esc(customer.next_action_date || '')}</strong><h3>AI Recommendation</h3><p>${esc(customer.ai_recommendation || '—')}</p></article></section>
    <article class="panel section-gap">${panelHeader('Recommended Products', 'Live references from Product Intelligence Center—no product data is copied')}<div class="knowledge-related-grid">${recommendations}</div></article>
    <section class="detail-grid section-gap"><article class="panel">${panelHeader('Contacts', 'Decision makers and contact confidence')}${customer.contacts.map(contact => `<div class="list-row"><div><strong>${esc(contact.full_name)}</strong><small>${esc(contact.role)} · ${esc(contact.email || contact.whatsapp || 'No direct channel')}</small></div>${contact.is_primary_decision_maker ? badge('Decision Maker') : ''}</div>`).join('') || '<div class="empty-state">No contacts.</div>'}</article>
    <article class="panel">${panelHeader('Missing Data', 'VA workflow for research gaps')}${customer.gaps.map(gap => `<div class="list-row"><div><strong>${esc(gap.gap_type)}</strong><small>${esc(gap.priority)} priority</small></div>${badge(gap.status)}</div>`).join('') || '<div class="empty-state">No open data gaps.</div>'}</article></section>
    <article class="panel section-gap">${panelHeader('Outreach Drafts', 'Editable drafts only—no automatic sending')}${customer.outreach_drafts.map(draft => `<div class="outreach-editor" data-draft="${draft.id}"><div class="panel-header"><div><strong>${esc(draft.channel)} · ${esc(draft.draft_type)}</strong><small>${esc(draft.status)}</small></div></div><input name="subject" value="${esc(draft.subject || '')}" /><textarea name="body" rows="8">${esc(draft.body)}</textarea><div class="row-actions">${data.capabilities.canEditDraft ? `<button class="button" data-action="save-outreach" data-id="${draft.id}">Save Draft</button>` : ''}${data.capabilities.canApproveDraft && draft.status !== 'Approved' ? `<button class="button button--primary" data-action="approve-outreach" data-id="${draft.id}">Approve</button>` : ''}${data.capabilities.canEditDraft ? `<button class="button button--soft" data-action="sent-outreach" data-id="${draft.id}">Mark Sent Manually</button>` : ''}</div></div>`).join('') || '<div class="empty-state">Run AI to generate a personalized first-touch draft.</div>'}</article>
    <section class="detail-grid section-gap"><article class="panel">${panelHeader('Activity History', 'Immutable workflow events')}${customer.activity.map(item => `<div class="activity-item"><span></span><div><strong>${esc(item.activity_type)}</strong><p>${esc(item.description)}</p><small>${esc(item.created_at)}</small></div></div>`).join('')}</article>
    <article class="panel">${panelHeader('Sales Handoff', 'A+/A plus at least one contactability signal')}<p>${esc(customer.ai_recommendation || '')}</p>${data.capabilities.canAcceptLead && ['Ready for Sales', 'Contacted', 'In Progress'].includes(customer.opportunity_status) ? `<button class="button button--primary" data-action="accept-lead" data-id="${id}">Accept Lead</button>` : `<p class="empty-state">${['A+', 'A'].includes(customer.opportunity_grade) ? 'Add a contact method to qualify handoff.' : 'Customer must reach grade A or A+.'}</p>`}</article></section>`;
}

async function runCustomerAi(id) {
  await api(`/api/customers/${id}/run-ai`, { method: 'POST', body: JSON.stringify({ confirmed: true }) }); toast('Opportunity AI completed.'); await renderCustomerDetail(id);
}

async function runCustomerIntelligence(id, payload = {}) {
  await api(`/api/customers/${id}/customer-intelligence/run`, { method: 'POST', body: JSON.stringify(payload) });
  toast('Customer Intelligence completed.');
  await renderCustomerDetail(id);
}

async function submitCustomerIntelligence(event) {
  event.preventDefault();
  const customerId = state.customerDetail.id;
  const body = Object.fromEntries(new FormData(event.currentTarget));
  await runCustomerIntelligence(customerId, body);
}

async function submitCustomerIntelligenceFeedback(event) {
  event.preventDefault();
  const customerId = state.customerDetail.id;
  const body = Object.fromEntries(new FormData(event.currentTarget));
  await api(`/api/customers/${customerId}/customer-intelligence/feedback`, { method: 'POST', body: JSON.stringify(body) });
  toast('Customer feedback saved.');
  await renderCustomerDetail(customerId);
}

async function submitCustomerIntelligenceUpdate(event) {
  event.preventDefault();
  const customerId = state.customerDetail.id;
  const body = Object.fromEntries(new FormData(event.currentTarget));
  await api(`/api/customers/${customerId}/customer-intelligence/updates`, { method: 'POST', body: JSON.stringify(body) });
  toast('Customer Intelligence update saved.');
  event.currentTarget.reset();
  await renderCustomerDetail(customerId);
}

var renderCustomerDetailOriginal = renderCustomerDetail;
renderCustomerDetail = async function renderCustomerDetailPhase2A(id) {
  const data = await api(`/api/customers/${id}`);
  const customer = data.customer;
  state.customerDetail = customer;
  const recommendations = customer.recommended_products.map(item => `<article class="knowledge-related-card"><span>${esc(item.category || '')}</span><strong>${esc(item.product_name || item.category)}</strong><small>${esc(item.recommendation_reason)}</small><p>${esc(item.sales_angle || '')}</p></article>`).join('') || '<div class="empty-state">Run AI to match products.</div>';
  const customerTypes = ['Hospitality Furniture Distributor','Commercial Furniture Dealer','Hospitality Design Firm','Restaurant Group','Independent Restaurant Owner','Multi-location Restaurant Group','Cafe Owner','Bar Owner','Bubble Tea Shop Owner'];
  const feedbackOptions = ['Interested','Not interested','Wrong customer','Purchased','Future opportunity','No response'];
  const updateReasons = ['New salesperson handoff','Customer follow-up restart','New customer requirement','New information obtained','Manual update'];
  const updateHistory = (customer.intelligence_updates || []).map(item => `<div class="activity-item"><span></span><div><strong>${esc(item.update_reason)}</strong><p>${esc(item.ai_summary || '')}</p><small>${esc(item.created_at)}${item.created_by_name ? ` · ${esc(item.created_by_name)}` : ''}</small></div></div>`).join('') || '<div class="empty-state">No manual intelligence updates yet.</div>';
  const evidenceHistory = `<div class="debug-list"><div><span>Original Source</span><strong>${esc(customer.customer_source || customer.source || 'Manual Import')}</strong></div><div><span>Source URL</span><strong>${esc(customer.source_url || customer.website || 'Not provided')}</strong></div></div><div class="section-gap">${(customer.intelligence_updates || []).map(item => `<div class="list-row"><div><strong>${esc(item.update_reason)}</strong><small>Updated by ${esc(item.created_by_name || 'System')} · ${esc(item.created_at || '')}</small><p>${esc(item.original_input || item.ai_summary || '')}</p></div></div>`).join('') || '<div class="empty-state">No evidence updates recorded yet.</div>'}</div>`;
  const actions = `${data.capabilities.canRunCustomerIntelligence ? `<button class="button button--soft" data-action="run-customer-intelligence" data-id="${id}">${icon('sparkles')} Run Customer Intelligence</button>` : ''}${data.capabilities.canRunAi ? `<button class="button button--primary" data-action="run-customer-ai" data-id="${id}">${icon('sparkles')} Run AI</button>` : ''}`;
  $('#page').innerHTML = `${pageHeader(esc(customer.company_name), `${esc(customer.business_type || 'Hospitality')} · ${esc(customer.city || '')} ${esc(customer.country || '')}`, actions, '<button class="button" data-action="back-opportunities">Back</button>')}
    <section class="knowledge-hero panel"><div>${opportunityScore(customer.opportunity_score, customer.opportunity_grade)}<div><span class="eyebrow-label">Opportunity Status</span><strong>${esc(customer.opportunity_status)}</strong><small>Data quality ${customer.data_quality_score}% · confidence ${customer.confidence_score}%</small></div></div><div class="knowledge-hero-summary"><span>AI Summary</span><p>${esc(customer.ai_summary || 'Run AI to generate an opportunity summary.')}</p></div></section>
    <section class="detail-grid section-gap"><article class="panel knowledge-section">${panelHeader('Customer Intelligence Card', 'Phase 2A dual-score model')}
      <div class="metrics-grid compact-metrics">
        ${metricCard('Customer Value', Number(customer.customer_value_score || 0), esc(customer.customer_value_grade || 'D'), 'users', 'green', true)}
        ${metricCard('Buying Opportunity', Number(customer.buying_opportunity_score || 0), esc(customer.buying_opportunity_grade || 'D'), 'briefcase', customer.purchase_timing_confidence === 'Low' ? 'gold' : 'green', true)}
        ${metricCard('Sales Priority', Number(customer.sales_priority_score || 0), 'Action priority', 'sparkles', 'green', true)}
      </div>
      <div class="debug-list section-gap"><div><span>Customer Type</span><strong>${esc(customer.customer_type || 'Not classified')}</strong></div><div><span>Industry</span><strong>${esc(customer.industry || 'Hospitality Furniture')}</strong></div><div><span>Purchase Timing</span><strong>${esc(customer.purchase_timing || 'Unknown')}</strong></div><div><span>Confidence</span><strong>${esc(customer.purchase_timing_confidence || 'Low')}</strong></div></div>
      <h3>AI Recommendation</h3><p>${esc(customer.ai_recommendation || 'Run Customer Intelligence to generate a reviewable recommendation.')}</p><small>${esc(customer.sales_priority_explanation || '')}</small>
    </article>
    <article class="panel knowledge-section">${panelHeader('Manual Intelligence Input', 'Sales can add project notes without external data')}
      <form id="customer-intelligence-form" class="foundation-form">
        <label class="field"><span>Customer Type</span><select name="customer_type"><option value="">Auto classify</option>${customerTypes.map(type => `<option ${customer.customer_type === type ? 'selected' : ''}>${esc(type)}</option>`).join('')}</select></label>
        <label class="field"><span>Industry</span><input name="industry" value="${esc(customer.industry || 'Hospitality Furniture')}"></label>
        <label class="field"><span>Project Information</span><textarea name="project_information" rows="2">${esc(customer.project_information || '')}</textarea></label>
        <label class="field"><span>Customer Comments</span><textarea name="customer_comments" rows="2">${esc(customer.customer_comments || '')}</textarea></label>
        <label class="field"><span>Expected Purchase Timing</span><input name="expected_purchase_timing" value="${esc(customer.expected_purchase_timing || '')}" placeholder="Unknown / Near term / Future opportunity"></label>
        <label class="field"><span>Opportunity Notes</span><textarea name="opportunity_notes" rows="2">${esc(customer.opportunity_notes || '')}</textarea></label>
        ${data.capabilities.canRunCustomerIntelligence ? '<button class="button button--primary" type="submit">Save & Run Customer Intelligence</button>' : ''}
      </form>
    </article></section>
    <article class="panel section-gap">${panelHeader('Update Customer Intelligence', 'Record new customer information without overwriting previous history')}
      ${data.capabilities.canRunCustomerIntelligence ? `<form id="customer-intelligence-update-form" class="foundation-form">
        <label class="field"><span>Update Reason</span><select name="update_reason">${updateReasons.map(reason => `<option>${esc(reason)}</option>`).join('')}</select></label>
        <label class="field"><span>New Information</span><textarea name="original_input" rows="4" placeholder="Example: Customer is planning a second restaurant location and asked about booth seating."></textarea></label>
        <label class="field"><span>Reference / Future Attachment</span><input name="reference_note" placeholder="Optional link, file name, or note for future attachment"></label>
        <button class="button button--primary" type="submit">${icon('sparkles')} Update Customer Intelligence</button>
      </form>` : '<div class="empty-state">You can view updates, but this role cannot run Customer Intelligence updates.</div>'}
      <div class="section-gap">${updateHistory}</div>
    </article>
    <article class="panel section-gap">${panelHeader('Customer Evidence History', 'Original source and manual intelligence update trail')}${evidenceHistory}</article>
    <section class="detail-grid section-gap"><article class="panel knowledge-section"><h2>Basic Info</h2><div class="debug-list"><div><span>Source</span><strong>${esc(customer.source)}</strong></div><div><span>Website</span><strong>${esc(customer.website || 'Missing')}</strong></div><div><span>Email</span><strong>${esc(customer.email || 'Missing')}</strong></div><div><span>WhatsApp</span><strong>${esc(customer.whatsapp || 'Missing')}</strong></div><div><span>Stores</span><strong>${customer.store_count || 'Unknown'}</strong></div><div><span>Years</span><strong>${customer.years_in_business || 'Unknown'}</strong></div></div></article>
    <article class="panel knowledge-section"><h2>Next Action</h2><p>${esc(customer.next_action || 'Run AI to calculate next action.')}</p><strong>${esc(customer.next_action_date || '')}</strong><h3>AI Recommendation</h3><p>${esc(customer.ai_recommendation || '—')}</p></article></section>
    <article class="panel section-gap">${panelHeader('Recommended Products', 'Live references from Product Intelligence Center — no product data is copied')}<div class="knowledge-related-grid">${recommendations}</div></article>
    <section class="detail-grid section-gap"><article class="panel">${panelHeader('Contacts', 'Decision makers and contact confidence')}${customer.contacts.map(contact => `<div class="list-row"><div><strong>${esc(contact.full_name)}</strong><small>${esc(contact.role)} · ${esc(contact.email || contact.whatsapp || 'No direct channel')}</small></div>${contact.is_primary_decision_maker ? badge('Decision Maker') : ''}</div>`).join('') || '<div class="empty-state">No contacts.</div>'}</article>
    <article class="panel">${panelHeader('Missing Data', 'VA workflow for research gaps')}${customer.gaps.map(gap => `<div class="list-row"><div><strong>${esc(gap.gap_type)}</strong><small>${esc(gap.priority)} priority</small></div>${badge(gap.status)}</div>`).join('') || '<div class="empty-state">No open data gaps.</div>'}</article></section>
    <article class="panel section-gap">${panelHeader('Outreach Drafts', 'Editable drafts only — no automatic sending')}${customer.outreach_drafts.map(draft => `<div class="outreach-editor" data-draft="${draft.id}"><div class="panel-header"><div><strong>${esc(draft.channel)} · ${esc(draft.draft_type)}</strong><small>${esc(draft.status)}</small></div></div><input name="subject" value="${esc(draft.subject || '')}" /><textarea name="body" rows="8">${esc(draft.body)}</textarea><div class="row-actions">${data.capabilities.canEditDraft ? `<button class="button" data-action="save-outreach" data-id="${draft.id}">Save Draft</button>` : ''}${data.capabilities.canApproveDraft && draft.status !== 'Approved' ? `<button class="button button--primary" data-action="approve-outreach" data-id="${draft.id}">Approve</button>` : ''}${data.capabilities.canEditDraft ? `<button class="button button--soft" data-action="sent-outreach" data-id="${draft.id}">Mark Sent Manually</button>` : ''}</div></div>`).join('') || '<div class="empty-state">Run AI to generate a personalized first-touch draft.</div>'}</article>
    <article class="panel section-gap">${panelHeader('Customer Intelligence Feedback', 'Used for future AI learning preparation; no automatic model training')}
      ${data.capabilities.canSubmitFeedback ? `<form id="customer-intelligence-feedback" class="foundation-form"><label class="field"><span>Feedback</span><select name="feedback_type">${feedbackOptions.map(type => `<option>${esc(type)}</option>`).join('')}</select></label><label class="field"><span>Note</span><textarea name="feedback_note" rows="3"></textarea></label><button class="button button--primary">Save Feedback</button></form>` : ''}
      <div class="section-gap">${customer.intelligence_feedback.map(item => `<div class="list-row"><div><strong>${esc(item.feedback_type)}</strong><small>${esc(item.feedback_note || '')} ${esc(item.created_at)}</small></div></div>`).join('') || '<div class="empty-state">No feedback yet.</div>'}</div>
    </article>
    <section class="detail-grid section-gap"><article class="panel">${panelHeader('Activity History', 'Immutable workflow events')}${customer.activity.map(item => `<div class="activity-item"><span></span><div><strong>${esc(item.activity_type)}</strong><p>${esc(item.description)}</p><small>${esc(item.created_at)}</small></div></div>`).join('')}</article>
    <article class="panel">${panelHeader('Sales Handoff', 'A+/A plus at least one contactability signal')}<p>${esc(customer.ai_recommendation || '')}</p>${data.capabilities.canAcceptLead && ['Ready for Sales', 'Contacted', 'In Progress'].includes(customer.opportunity_status) ? `<button class="button button--primary" data-action="accept-lead" data-id="${id}">Accept Lead</button>` : `<p class="empty-state">${['A+', 'A'].includes(customer.opportunity_grade) ? 'Add a contact method to qualify handoff.' : 'Customer must reach grade A or A+.'}</p>`}</article></section>`;
  $('#customer-intelligence-form')?.addEventListener('submit', submitCustomerIntelligence);
  $('#customer-intelligence-update-form')?.addEventListener('submit', submitCustomerIntelligenceUpdate);
  $('#customer-intelligence-feedback')?.addEventListener('submit', submitCustomerIntelligenceFeedback);
}

async function runSelectedCustomers() {
  const ids = [...document.querySelectorAll('[data-customer-select]:checked')].map(input => Number(input.value));
  if (!ids.length) return toast('Select at least one customer.');
  const message = `AI Customer Analysis

Selected customers:
${ids.length}

AI will generate:
- Customer Score
- Buying Opportunity
- Recommended Products
- Next Action

Estimated AI Cost:
$0/customer (Rule-based analysis)

Total Estimated Cost:
$0

Warning:
AI analysis will update scoring fields.
Existing customer information will not be deleted.

Continue?

Cancel / Start Analysis`;
  if (!window.confirm(message)) return;
  await api('/api/customers/run-ai-selected', { method: 'POST', body: JSON.stringify({ customer_ids: ids, confirmed: true }) }); toast(`${ids.length} customers analyzed.`); await renderOpportunityIntelligence();
}

async function saveOutreach(id, action = null) {
  const customerId = state.customerDetail.id;
  if (action) await api(`/api/customers/${customerId}/outreach-drafts/${id}/${action}`, { method: 'POST', body: '{}' });
  else {
    const editor = document.querySelector(`[data-draft="${id}"]`);
    await api(`/api/customers/${customerId}/outreach-drafts/${id}`, { method: 'PUT', body: JSON.stringify({ subject: editor.querySelector('[name="subject"]').value, body: editor.querySelector('[name="body"]').value }) });
  }
  toast('Outreach draft updated.'); await renderCustomerDetail(customerId);
}

async function acceptLead(id) {
  await api(`/api/customers/${id}/accept-lead`, { method: 'POST', body: '{}' }); toast('Lead accepted by sales.'); await renderCustomerDetail(id);
}

async function renderImportsLegacy() {
  const data = state.imports || await api('/api/imports');
  state.imports = data;
  $('#page').innerHTML = `
    ${pageHeader(t('imports.title'), t('imports.subtitle'), `<button class="button button--primary" data-action="browse-file">${icon('upload')} ${t('imports.newImport')}</button>`)}
    <section class="split-grid">
      <div class="upload-panel"><span class="upload-icon">${icon('upload')}</span><h3>${t('imports.dropTitle')}</h3><p>${t('imports.dropBody')}</p><button class="button button--soft" data-action="browse-file">${t('imports.browseFiles')}</button></div>
      <article class="panel">
        ${panelHeader(t('imports.checklist'), t('imports.checklistSub'))}
        <div class="task-list">
          ${checklistRow(t('imports.template'), t('imports.templateSub'))}
          ${checklistRow(t('imports.oneRow'), t('imports.oneRowSub'))}
          ${checklistRow(t('imports.reviewFlagged'), t('imports.reviewFlaggedSub'))}
        </div>
      </article>
    </section>
    <article class="panel section-gap">
      ${panelHeader(t('imports.history'), t('imports.historySub'))}
      <div class="table-scroll"><table class="data-table"><thead><tr><th>${t('fields.file')}</th><th>${t('fields.startedBy')}</th><th>${t('fields.rows')}</th><th>${t('fields.imported')}</th><th>${t('fields.issues')}</th><th>${t('fields.status')}</th></tr></thead><tbody>
        ${data.imports.map(job => `<tr><td class="primary-cell"><strong>${esc(job.filename)}</strong><small>${formatDateTime(job.created_at)}</small></td><td>${esc(job.created_by_name)}</td><td>${job.total_rows}</td><td class="money">${job.imported_rows}</td><td>${job.error_rows ? `<span style="color:var(--red)">${t('imports.toReview', { count: job.error_rows })}</span>` : t('common.none')}</td><td>${badge(job.status)}</td></tr>`).join('')}
      </tbody></table></div>
    </article>`;
}

function importConfidence(label,value){return `<div class="import-confidence"><span>${label}</span><strong>${Number(value||0)}%</strong><i><b style="width:${Number(value||0)}%"></b></i></div>`}
function importDraftCard(draft,data){const categories=data.categories.map(category=>`<option value="${category.id}" ${category.id===draft.suggested_category_id?'selected':''}>${esc(category.name)}</option>`).join('');return `<article class="panel import-draft-card" data-import-draft="${draft.id}"><header><label><input type="checkbox" data-import-select value="${draft.id}" ${draft.status==='Imported'||draft.status==='Rejected'?'disabled':''}> Select</label>${badge(draft.status)}<span>${esc(draft.image_status)}</span></header><div class="import-draft-main">${draft.main_image_url?`<img src="${esc(draft.main_image_url)}" alt="Extracted supplier image">`:'<div class="library-image-empty">Image Assets Needed</div>'}<div class="foundation-form"><label class="field"><span>Product Name</span><input name="product_name" value="${esc(draft.product_name||'')}"></label><label class="field"><span>SKU / Product Code</span><input name="product_sku" value="${esc(draft.product_sku||'')}"></label><label class="field"><span>Suggested Category</span><select name="suggested_category_id"><option value="">Needs Review</option>${categories}</select></label></div></div><div class="import-confidence-grid">${importConfidence('Product Group',draft.product_group_confidence)}${importConfidence('Variant',draft.variant_confidence)}${importConfidence('Attribute Mapping',draft.attribute_mapping_confidence)}${importConfidence('Image Matching',draft.image_matching_confidence)}</div><details><summary>${draft.suggested_variants.length} detected variants · ${draft.source_rows.length} source rows</summary><div class="import-variant-list">${draft.suggested_variants.map(variant=>`<p><strong>${esc(variant.variant_name)}</strong><span>${esc(variant.dimensions||'')} · ${variant.reference_price??'Price TBC'} ${esc(variant.currency||'')}</span></p>`).join('')||'<p>Independent product row</p>'}</div><pre>${esc(JSON.stringify(draft.original_values,null,2))}</pre></details>${draft.possible_match_product_id?`<label class="field"><span>Possible existing product match</span><select name="resolution_action"><option value="create_new">Create new product</option><option value="update_existing">Update existing product</option><option value="add_variant">Add as new variant</option><option value="ignore">Ignore</option></select></label>`:''}<p class="import-missing">${draft.missing_fields.length?`Missing / review: ${esc(draft.missing_fields.join(', '))}`:'Required fields recognized'}</p><div class="row-actions">${draft.suggested_variants.length>1?`<button class="button" data-action="split-import-draft" data-id="${draft.id}">Split into Products</button>`:'' }<button class="button button--soft" data-action="save-import-draft" data-id="${draft.id}">Save Draft</button>${data.capabilities.canApprove&&draft.status!=='Imported'?`<button class="button button--primary" data-action="approve-import-draft" data-id="${draft.id}">Approve & Import</button><button class="button" data-action="reject-import-draft" data-id="${draft.id}">Reject</button>`:''}</div></article>`}

async function renderImports(batchId=null){const data=await api(`/api/imports${batchId?`?batch_id=${batchId}`:''}`);state.imports=data;const batch=data.batch;$('#page').innerHTML=`${pageHeader('AI Product Import Center','Excel / CSV → Smart Recognition → Product Draft → Human Approval')}<nav class="import-steps">${['1 Upload File','2 Import Settings','3 Smart Analysis','4 Draft Review','5 Import Result'].map((label,index)=>`<span class="${batch&&(index<4||batch.status==='Completed')?'is-complete':index===0&&!batch?'is-active':''}">${label}</span>`).join('')}</nav><section class="import-workspace"><form id="product-import-form" class="panel"><h2>Upload & Import Settings</h2><label class="file-drop"><input name="spreadsheet" type="file" accept=".xlsx,.xls,.csv" required><strong>Select supplier spreadsheet</strong><span>.xlsx, .xls, or .csv · embedded XLSX images will be extracted</span></label><div class="form-grid"><label class="field"><span>Import Mode</span><select name="import_mode">${data.modes.map(mode=>`<option>${mode}</option>`).join('')}</select></label><label class="field"><span>Default Category (optional)</span><select name="default_category_id"><option value="">Smart detect</option>${data.categories.map(category=>`<option value="${category.id}">${esc(category.name)}</option>`).join('')}</select></label><label class="field"><span>Supplier Name</span><input name="supplier_name"></label><label class="field"><span>Supplier Contact</span><input name="supplier_contact"></label><label class="field"><span>Supplier Country</span><input name="supplier_country"></label><label class="field"><span>Supplier Currency</span><select name="supplier_currency">${data.currencies.map(currency=>`<option>${currency}</option>`).join('')}</select></label><label class="field"><span>Exchange Rate</span><input name="exchange_rate" type="number" step=".000001"></label><label class="field"><span>Import Remark</span><input name="import_remark"></label></div><button class="button button--primary" ${data.capabilities.canUpload?'':'disabled'}>Analyze Spreadsheet</button><p id="import-error" class="form-error"></p></form>${batch?`<section class="panel import-analysis"><div class="panel-header"><div><h2>Smart Analysis Result</h2><p>${esc(batch.source_file_name)} · ${esc(batch.import_mode)}</p></div>${badge(batch.status)}</div><div class="metrics-grid"><article><strong>${batch.analysis_summary.detected_products||0}</strong><span>Detected Products</span></article><article><strong>${batch.analysis_summary.detected_variants||0}</strong><span>Detected Variants</span></article><article><strong>${batch.detected_columns.length}</strong><span>Mapped Columns</span></article><article><strong>${batch.analysis_summary.images||0}</strong><span>Embedded Images</span></article></div><p><b>Detected columns:</b> ${esc(batch.detected_columns.join(', ')||'None')}</p>${batch.error_message?`<p class="form-error">${esc(batch.error_message)}</p>`:''}</section>`:''}</section>${batch?`<section class="section-gap"><div class="panel-header"><div><h2>Draft Review</h2><p>Edit mappings before importing into the Product Library.</p></div>${data.capabilities.canApprove?'<div class="row-actions"><button class="button" data-action="merge-selected-imports">Merge Selected</button><button class="button button--primary" data-action="approve-selected-imports">Approve Selected</button></div>':''}</div><div class="import-filter-bar"><button class="button button--compact" data-action="filter-import-drafts" data-status="all">All (${batch.drafts.length})</button><button class="button button--compact" data-action="filter-import-drafts" data-status="Needs Review">Needs Review (${batch.drafts.filter(draft=>draft.status==='Needs Review').length})</button></div><div class="import-draft-grid">${batch.drafts.map(draft=>importDraftCard(draft,data)).join('')||'<div class="empty-state">No drafts detected.</div>'}</div></section><article class="panel section-gap"><h2>Import Result</h2><div class="metrics-grid"><article><strong>${batch.created_products}</strong><span>Created Products</span></article><article><strong>${batch.created_variants}</strong><span>Created Variants</span></article><article><strong>${batch.skipped_rows}</strong><span>Skipped Rows</span></article><article><strong>${batch.error_count}</strong><span>Errors</span></article></div></article>`:''}<article class="panel section-gap"><h2>Import Batches</h2><div class="foundation-manager-list">${data.batches.map(item=>`<article><span><strong>${esc(item.source_file_name)}</strong><small>${esc(item.import_mode)} · ${esc(item.status)} · ${item.draft_count} drafts</small></span><button class="button button--compact" data-action="open-import-batch" data-id="${item.id}">Open</button></article>`).join('')||'<p>No import batches yet.</p>'}</div></article>`;$('#product-import-form').addEventListener('submit',submitProductImport)}

const renderImportsModule08B=renderImports;
renderImports=async function(batchId=null){
  await renderImportsModule08B(batchId);const data=state.imports,batch=data.batch,form=$('#product-import-form');
  const supplierName=form?.elements.supplier_name;if(supplierName&&!form.elements.supplier_code){const field=document.createElement('label');field.className='field';field.innerHTML='<span>Supplier Code</span><input name="supplier_code" placeholder="Internal supplier code">';supplierName.closest('.field').after(field)}
  if(batch){
    const s=batch.statistics||{},result=[['Products Created',s.products_created],['Variants Created',s.variants_created],['Needs Review',s.needs_review],['Approved',s.approved],['Rejected',s.rejected],['Duplicate Matches',s.duplicate_matches],['Images Imported',s.images_imported],['Images Missing',s.images_missing],['Missing Attributes',s.missing_attributes],['Import Duration',`${((s.import_duration_ms||0)/1000).toFixed(2)}s`]];
    const old=[...document.querySelectorAll('.panel.section-gap')].find(node=>node.querySelector('h2')?.textContent==='Import Result');if(old)old.innerHTML=`<div class="panel-header"><div><h2>Import Result</h2><p>Permanent source traceability and review statistics</p></div><a class="button" href="/api/imports/${batch.id}/errors.xlsx">Export Error Report</a></div><div class="metrics-grid">${result.map(([label,value])=>`<article><strong>${value??0}</strong><span>${label}</span></article>`).join('')}</div>`;
    const analysis=$('.import-analysis');if(analysis&&data.capabilities.canViewSensitive)analysis.insertAdjacentHTML('beforeend',`<p><b>Supplier:</b> ${esc(batch.supplier_name||'Not set')} ${batch.supplier_code?`(${esc(batch.supplier_code)})`:''} · <b>Currency:</b> ${esc(batch.supplier_currency||'—')} · <b>Exchange Rate:</b> ${esc(batch.exchange_rate||'—')}</p>`);
  }
  if(batch)batch.drafts.forEach(draft=>{const card=document.querySelector(`[data-import-draft="${draft.id}"]`);if(!card)return;const p=draft.mapped_product||{};card.querySelector('.import-confidence-grid')?.insertAdjacentHTML('afterend',`<div class="import-pricing-result"><strong>Reference Selling Price: ${p.reference_price==null?'Needs Pricing Review':`USD ${Number(p.reference_price).toFixed(2)}`}</strong><span>Rule: ${esc(p.pricing_rule_applied||'No matching rule')} · Confidence: ${Number(p.pricing_confidence||0)}%</span>${data.capabilities.canViewSensitive?`<small>Supplier Cost: ${esc(p.supplier_currency||'')} ${p.supplier_cost??p.cost_price??'—'} · Converted Cost: USD ${p.converted_cost??'—'}</small>`:''}</div>`)});
  if(batch){const analysis=$('.import-analysis'),ranges=Array.isArray(batch.analysis_summary?.header_ranges)?batch.analysis_summary.header_ranges:[],possible=Array.isArray(batch.analysis_summary?.diagnostics)?batch.analysis_summary.diagnostics.flatMap(item=>Array.isArray(item.possibleHeaderRows)?item.possibleHeaderRows.map(range=>`${item.sheet||'Sheet'}: ${range.startRow===range.endRow?`Row ${range.startRow}`:`Rows ${range.startRow}-${range.endRow}`}`):[]):[],grouping=Array.isArray(batch.analysis_summary?.grouping_result)?batch.analysis_summary.grouping_result:[],debug=batch.analysis_summary?.workbook_debug||{},debugSheets=Array.isArray(debug.sheets)?debug.sheets:[];if(analysis)analysis.insertAdjacentHTML('beforeend',`<p><b>Detected header area:</b> ${esc(ranges.length?ranges.map(range=>`${range.sheet}: ${range.label}`).join(' · '):(possible.join(' · ')||'Not detected'))}</p>${grouping.length?`<p><b>Grouping result:</b> ${esc(grouping.map(item=>`${item.product_code||'Unknown'}: ${item.variant_count||0} variants`).join(' · '))}</p>`:''}${debugSheets.length?`<details class="import-raw-debug" open><summary>XLSX Raw Read Debug</summary><p><b>Workbook sheet names:</b> ${esc((debug.sheet_names||[]).join(', ')||'None')}</p><p><b>Active sheet:</b> ${esc(debug.active_sheet_name||'Unknown')} · <b>Image objects:</b> ${debug.image_objects_count||0}</p>${debugSheets.map(sheet=>`<article><h3>${esc(sheet.sheet_name)}</h3><p>Rows: <b>${sheet.row_count||0}</b> · Columns: <b>${sheet.column_count||0}</b> · Merged ranges: <b>${(sheet.merged_ranges||[]).length}</b></p><p><b>Detected headers:</b> ${esc((sheet.detected_headers||[]).map(item=>`${item.source} → ${item.target}`).join(', ')||'None')}</p><p><b>Header candidates:</b> ${esc((sheet.header_candidates||[]).slice(0,5).map(item=>`Rows ${item.startRow}-${item.endRow}: ${(item.mappedColumns||[]).join(', ')}`).join(' · ')||'None')}</p><pre>${esc(JSON.stringify((sheet.first_10_rows||[]).slice(0,10),null,2))}</pre></article>`).join('')}</details>`:''}`)}
  if(data.capabilities.canApprove){const header=$('.page-header__actions')||$('.page-header');if(header&&!document.querySelector('[data-action="clear-product-demo-data"]'))header.insertAdjacentHTML('beforeend','<button class="button" data-action="clear-product-demo-data">Clear Demo Data</button>')}
  if(state.user?.role==='Owner'){const pricing=await api('/api/price-rules');const panel=document.createElement('article');panel.className='panel section-gap';panel.innerHTML=`<div class="panel-header"><div><h2>Reference Price Rules</h2><p>Owner-only cost-to-reference pricing. Quote prices remain editable snapshots.</p></div><button class="button" data-action="preview-price-recalculation">Recalculate Prices</button></div><form id="price-rule-form" class="form-grid"><label class="field"><span>Rule Name</span><input name="rule_name" required></label><label class="field"><span>Supplier (optional)</span><input name="supplier_name"></label><label class="field"><span>Category (optional)</span><select name="category_id"><option value="">Global</option>${pricing.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><label class="field"><span>Multiplier</span><input name="multiplier" type="number" step=".01" min=".01" required></label><label class="field"><span>Fixed Add-on</span><input name="fixed_addon" type="number" step=".01" value="0"></label><label class="field"><span>Rounding</span><select name="rounding_rule">${pricing.roundingRules.map(r=>`<option>${esc(r)}</option>`).join('')}</select></label><label class="field"><span>Currency</span><select name="currency">${pricing.currencies.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label><label class="field"><span>Effective Date</span><input name="effective_date" type="date" value="${new Date().toISOString().slice(0,10)}"></label><button class="button button--primary">Add Price Rule</button></form><div class="foundation-manager-list">${pricing.rules.map(r=>`<article><span><strong>${esc(r.rule_name)}</strong><small>${esc(r.supplier_name||'All suppliers')} · ${esc(r.category_name||'All categories')} · ×${r.multiplier} + ${r.fixed_addon} · ${esc(r.rounding_rule)}</small></span>${badge(r.active?'Active':'Inactive')}</article>`).join('')||'<p>No pricing rules. Imports will be marked Needs Pricing Review.</p>'}</div><div id="pricing-preview"></div>`;$('#page').append(panel);$('#price-rule-form').addEventListener('submit',async event=>{event.preventDefault();await api('/api/price-rules',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))});toast('Price rule created.');await renderImports(batchId)})}
};

function importIssueChips(draft){const issues=[...(draft.missing_fields||[])];if(draft.possible_match_product_id)issues.push('Duplicate Candidate');if(Number(draft.attribute_mapping_confidence||0)<70)issues.push('Low Mapping Confidence');return `<div class="import-issue-chips">${issues.length?issues.map(issue=>`<span>${esc(issue)}</span>`).join(''):'<span class="is-ok">Ready for approval</span>'}</div>`}
function importQualityScore(draft){const missing=(draft.missing_fields||[]).filter(item=>item!=='Image Assets Needed').length,score=Math.max(0,Math.min(100,100-missing*12-(draft.main_image_url?0:10)));return `<div class="import-quality"><strong>${score}%</strong><small>Product Completeness</small></div>`}
function importCategorySelect(draft,data){return `<select name="suggested_category_id"><option value="">Needs Review</option>${data.categories.map(category=>`<option value="${category.id}" ${category.id===draft.suggested_category_id?'selected':''}>${esc(category.name)}</option>`).join('')}</select>`}
function importAttributeSummary(draft){const mapped=draft.mapped_product||{},summary=mapped.normalization_summary||{},attributes=[['Material',mapped.material],['Color',mapped.color],['Finish',mapped.finish],['Size',summary.dimensions||mapped.dimensions],['Length',summary.length_mm?`${summary.length_mm}mm`:null],['Width',summary.width_mm?`${summary.width_mm}mm`:null],['Height',summary.height_mm?`${summary.height_mm}mm`:mapped.height],['Packing',mapped.packing_info],['MOQ',mapped.moq]].filter(([,value])=>value!=null&&value!=='');return `<details class="import-review-details"><summary>Attributes (${attributes.length})</summary><div class="import-attribute-chips">${attributes.map(([label,value])=>`<span><b>${esc(label)}</b>${esc(value)}</span>`).join('')||'<span>No mapped attributes</span>'}</div>${Array.isArray(summary.unknown_columns)&&summary.unknown_columns.length?`<div class="import-unknown-columns"><strong>Needs Human Review</strong>${summary.unknown_columns.map(item=>`<p>${esc(item.column)}: ${esc(item.value)} <small>${Number(item.confidence||45)}% confidence</small></p>`).join('')}</div>`:''}</details>`}
function importVariantSummary(draft){const variants=draft.suggested_variants||[];return `<details class="import-review-details"><summary>${variants.length||1} variant${(variants.length||1)>1?'s':''}</summary><div class="import-variant-table"><table class="data-table"><thead><tr><th>Variant</th><th>Size</th><th>Material</th><th>Cost</th><th>Selling</th></tr></thead><tbody>${variants.length?variants.map(variant=>`<tr><td>${esc(variant.variant_name||variant.variant_sku||'Default')}</td><td>${esc(variant.normalized_dimensions||variant.dimensions||'—')}</td><td>${esc(variant.material||draft.mapped_product?.material||'—')}</td><td>${variant.supplier_cost??variant.cost_price??'—'} ${esc(variant.supplier_currency||draft.mapped_product?.supplier_currency||'')}</td><td>${variant.reference_price??'Needs Review'}</td></tr>`).join(''):`<tr><td>${esc(draft.product_name||'Default')}</td><td>${esc(draft.mapped_product?.normalized_dimensions||draft.mapped_product?.dimensions||'—')}</td><td>${esc(draft.mapped_product?.material||'—')}</td><td>${draft.mapped_product?.supplier_cost??draft.mapped_product?.cost_price??'—'} ${esc(draft.mapped_product?.supplier_currency||'')}</td><td>${draft.mapped_product?.reference_price??'Needs Review'}</td></tr>`}</tbody></table></div></details>`}
function importPricingCell(draft,data){const p=draft.mapped_product||{};return `<div class="import-pricing-cell"><strong>${p.reference_price==null?'Needs Pricing Review':`USD ${Number(p.reference_price).toFixed(2)}`}</strong><small>${esc(p.pricing_status||'Needs Pricing Review')}</small>${data.capabilities.canViewSensitive?`<span>Supplier: ${esc(p.supplier_currency||'')} ${p.supplier_cost??p.cost_price??'—'}</span>`:''}</div>`}
function importReviewRow(draft,data){const p=draft.mapped_product||{},imageSource=p.image_source||draft.image_status||'Supplier image evidence pending';return `<tr data-import-draft="${draft.id}"><td><label class="import-select-cell"><input type="checkbox" data-import-select value="${draft.id}" ${draft.status==='Imported'||draft.status==='Rejected'?'disabled':''}></label></td><td class="import-product-image-cell">${draft.main_image_url?`<img src="${esc(draft.main_image_url)}" alt="Imported product image">`:'<div class="library-image-empty">Image Assets Needed</div>'}<small>${esc(imageSource)}</small><small>Image confidence: ${Number(p.image_confidence||draft.image_matching_confidence||0)}%</small></td><td class="import-product-info-cell"><input name="product_name" value="${esc(draft.product_name||'')}" aria-label="Product Name"><input name="product_sku" value="${esc(draft.product_sku||'')}" aria-label="SKU"><small>${data.capabilities.canViewSensitive?esc(p.default_supplier||'Supplier not set'):'Supplier hidden by role'}</small></td><td>${importCategorySelect(draft,data)}</td><td>${importAttributeSummary(draft)}</td><td>${importVariantSummary(draft)}</td><td>${importPricingCell(draft,data)}</td><td>${importQualityScore(draft)}${importIssueChips(draft)}</td><td>${badge(draft.status)}${draft.possible_match_product_id?`<select name="resolution_action"><option value="create_new">Create Product</option><option value="update_existing">Update Existing</option><option value="add_variant">Add Variant</option><option value="ignore">Ignore</option></select>`:'<input type="hidden" name="resolution_action" value="create_new">'}</td><td><div class="row-actions vertical">${draft.suggested_variants.length>1?`<button class="button button--compact" data-action="split-import-draft" data-id="${draft.id}">Split</button>`:''}<button class="button button--compact" data-action="save-import-draft" data-id="${draft.id}">Save</button>${data.capabilities.canApprove&&draft.status!=='Imported'?`<button class="button button--compact button--primary" data-action="approve-import-draft" data-id="${draft.id}">Approve</button><button class="button button--compact" data-action="reject-import-draft" data-id="${draft.id}">Reject</button>`:''}</div></td></tr>`}
function enhanceImportReviewPIC2C(){const data=state.imports,batch=data?.batch;if(!batch)return;const review=[...document.querySelectorAll('.section-gap')].find(node=>node.querySelector('h2')?.textContent==='Draft Review');if(!review)return;review.classList.add('pic2c-import-review');review.innerHTML=`<div class="panel-header"><div><h2>Product Import Review</h2><p>Review normalized products, variants, attributes, pricing, and image evidence before approval.</p></div>${data.capabilities.canApprove?'<div class="row-actions"><button class="button" data-action="merge-selected-imports">Merge Selected</button><button class="button button--primary" data-action="approve-selected-imports">Approve Selected</button></div>':''}</div><div class="import-workflow-status"><span>Imported</span><span>AI Processing</span><span>Needs Review</span><span>Approved</span><span>Product Library</span></div><div class="import-filter-bar"><button class="button button--compact" data-action="filter-import-drafts" data-status="all">All (${batch.drafts.length})</button><button class="button button--compact" data-action="filter-import-drafts" data-status="Needs Review">Needs Review (${batch.drafts.filter(draft=>draft.status==='Needs Review').length})</button></div><div class="table-scroll"><table class="data-table import-review-table"><thead><tr><th></th><th>Image Evidence</th><th>Basic Product Information</th><th>Category</th><th>Attributes</th><th>Variants</th><th>Pricing</th><th>Quality / Issues</th><th>Status</th><th>Actions</th></tr></thead><tbody>${batch.drafts.map(draft=>importReviewRow(draft,data)).join('')||'<tr><td colspan="10"><div class="empty-state">No drafts detected.</div></td></tr>'}</tbody></table></div>`}
const renderImportsPIC2CBase=renderImports;
renderImports=async function(batchId=null){await renderImportsPIC2CBase(batchId);enhanceImportReviewPIC2C()};

async function submitProductImport(event){
  event.preventDefault();const form=event.currentTarget,file=form.elements.spreadsheet.files[0];if(!file)return;const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let index=0;index<bytes.length;index+=0x8000)binary+=String.fromCharCode(...bytes.subarray(index,index+0x8000));const body=Object.fromEntries(new FormData(form));delete body.spreadsheet;body.filename=file.name;body.file_base64=btoa(binary);
  try{const result=await api('/api/imports/analyze',{method:'POST',body:JSON.stringify(body)});toast('Spreadsheet analyzed. Review drafts before approval.');await renderImports(result.batch.id)}
  catch(error){toast(error.message);await renderImports();const errorNode=$('#import-error');if(errorNode)errorNode.textContent=`Analysis failed: ${error.message}. The failed batch and error report are available below.`}
}
async function saveImportDraft(id,refresh=true){const card=document.querySelector(`[data-import-draft="${id}"]`),body={product_name:card.querySelector('[name="product_name"]').value,product_sku:card.querySelector('[name="product_sku"]').value,suggested_category_id:Number(card.querySelector('[name="suggested_category_id"]').value)||null,resolution_action:card.querySelector('[name="resolution_action"]')?.value||null};await api(`/api/imports/drafts/${id}`,{method:'PUT',body:JSON.stringify(body)});toast('Draft saved.');if(refresh)await renderImports(state.imports.batch.id);return body}
async function reviewImportDraft(id,action){const body=await saveImportDraft(id,false);await api(`/api/imports/drafts/${id}/${action}`,{method:'POST',body:JSON.stringify({resolution_action:body.resolution_action||'create_new'})});toast(action==='approve'?'Draft imported into Product Library.':'Draft rejected.');await renderImports(state.imports.batch.id)}
async function approveSelectedImports(){const draft_ids=[...document.querySelectorAll('[data-import-select]:checked')].map(input=>Number(input.value));if(!draft_ids.length)return toast('Select at least one draft.');await api('/api/imports/approve-selected',{method:'POST',body:JSON.stringify({batch_id:state.imports.batch.id,draft_ids,resolution_action:'create_new'})});toast('Selected drafts imported.');await renderImports(state.imports.batch.id)}
async function splitImportDraft(id){await api(`/api/imports/drafts/${id}/split`,{method:'POST',body:'{}'});toast('Variant group split into independent product drafts.');await renderImports(state.imports.batch.id)}
async function mergeSelectedImports(){const draft_ids=[...document.querySelectorAll('[data-import-select]:checked')].map(input=>Number(input.value));if(draft_ids.length<2)return toast('Select at least two drafts to merge.');await api('/api/imports/merge',{method:'POST',body:JSON.stringify({draft_ids})});toast('Draft rows merged into one product with variants.');await renderImports(state.imports.batch.id)}

function checklistRow(title, description) {
  return `<div class="task-row"><span class="permission-check">✓</span><span class="task-copy"><strong>${title}</strong><small>${description}</small></span></div>`;
}

function formatDateTime(value) {
  if (!value) return '—';
  const parsed = new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z'));
  return new Intl.DateTimeFormat(localeForIntl(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(parsed);
}

async function renderImages() {
  $('#page').innerHTML = `
    ${pageHeader(t('images.title'), t('images.subtitle'), `<button class="button">${icon('cases')} ${t('images.viewLibrary')}</button>`)}
    <section class="split-grid">
      <article class="panel prompt-panel">
        <div class="panel-title" style="margin-bottom:17px"><h2>${t('images.createScene')}</h2><p>${t('images.createSceneSub')}</p></div>
        <form id="image-form" class="form-grid">
          <label class="field">${t('fields.projectPrompt')}<textarea rows="5" placeholder="${t('images.promptPlaceholder')}"></textarea></label>
          <div class="field-row"><label class="field">${t('fields.spaceType')}<select><option>${t('images.restaurantDining')}</option><option>${t('images.outdoorPatio')}</option><option>${t('images.hotelRestaurant')}</option><option>${t('images.cafe')}</option></select></label><label class="field">${t('fields.aspectRatio')}<select><option>${t('images.presentation')}</option><option>${t('images.proposalFormat')}</option><option>${t('images.social')}</option></select></label></div>
          <label class="field">${t('fields.visualDirection')}<div class="style-options"><button type="button" class="style-option is-active">${t('images.photoreal')}</button><button type="button" class="style-option">${t('images.editorial')}</button><button type="button" class="style-option">${t('images.concept')}</button></div></label>
          <button class="button button--primary button--wide" type="submit"><span>${icon('sparkles')} ${t('images.generate')}</span><span>→</span></button>
        </form>
      </article>
      <div class="image-canvas"><div class="image-placeholder"><span class="metric-icon">${icon('images')}</span><strong>${t('images.placeholderTitle')}</strong><small>${t('images.placeholderBody')}</small></div></div>
    </section>
    <section class="module-grid section-gap">
      ${aiTip(t('images.productAware'), t('images.productAwareBody'), 'products')}
      ${aiTip(t('images.proposalReady'), t('images.proposalReadyBody'), 'proposals')}
      ${aiTip(t('images.brandSafe'), t('images.brandSafeBody'), 'check')}
    </section>`;
  $('#image-form').addEventListener('submit', event => {
    event.preventDefault();
    toast(t('images.integrationReady'));
  });
}

function aiTip(title, description, iconName) {
  return `<article class="stat-tile"><span class="metric-icon">${icon(iconName)}</span><div><strong style="font-size:11px">${title}</strong><small>${description}</small></div></article>`;
}

async function salesData(refresh = false) {
  if (refresh) state.salesWorkspace = null;
  return state.salesWorkspace || (state.salesWorkspace = await api('/api/sales-workspace'));
}

async function renderNewInquiry() {
  const data = await salesData();
  if (state.salesInquiry) return renderSalesInquiryDetail(state.salesInquiry.id);
  $('#page').innerHTML = `${pageHeader('+ New Inquiry', 'Paste the customer’s original message. AI handles classification and recommendations.')}
    <form id="sales-inquiry-form" class="panel sales-simple-form">
      <fieldset class="customer-choice"><legend>Customer *</legend><label><input type="radio" name="customer_mode" value="existing" checked> Select Existing Customer</label><label><input type="radio" name="customer_mode" value="new"> Create New Customer</label></fieldset>
      <div data-customer-mode="existing" class="form-grid"><label class="field"><span>Customer *</span><select name="customer_id" required><option value="">Select customer</option>${data.customers.map(c=>`<option value="${c.id}">${esc(c.company_name)}${c.country?` · ${esc(c.country)}`:''}</option>`).join('')}</select></label>
      <label class="field"><span>Company</span><input name="company" /></label><label class="field"><span>Country</span><input name="country" /></label></div>
      <div data-customer-mode="new" class="form-grid is-hidden"><label class="field"><span>Customer / Restaurant Name *</span><input name="new_customer_name"></label><label class="field"><span>Company</span><input name="new_company"></label><label class="field"><span>Country</span><input name="new_country"></label><label class="field"><span>Contact Name</span><input name="new_contact_name"></label><label class="field"><span>Email</span><input name="new_email" type="email"></label><label class="field"><span>WhatsApp / Phone</span><input name="new_phone"></label><label class="field"><span>Source</span><select name="new_source">${['Manual','Website','Google Maps','Facebook','Instagram','LinkedIn','CSV','Apollo','Other'].map(x=>`<option>${x}</option>`).join('')}</select></label></div>
      <div class="form-grid"><label class="field"><span>Inquiry Type *</span><select name="inquiry_type" required>${data.inquiryTypes.map(x=>`<option>${x}</option>`).join('')}</select></label></div>
      <label class="field"><span>Customer Message *</span><textarea name="customer_message" rows="9" required placeholder="Paste the customer’s original message, e.g. We are opening a coffee shop and need 60 chairs with DDP Malaysia."></textarea></label>
      <div class="form-grid"><label class="field"><span>Attachments</span><input name="attachments" placeholder="File links, one per line" /></label><label class="field"><span>Priority</span><select name="priority"><option>Normal</option><option>High</option><option>Urgent</option><option>Low</option></select></label></div>
      <label class="field"><span>Sales Notes</span><textarea name="sales_notes" rows="3"></textarea></label>
      <div class="form-actions"><button class="button button--primary" type="submit">Create Inquiry</button></div>
    </form>
    ${data.inquiries?.length ? `<article class="panel section-gap"><div class="panel-header"><div><h2>Recent Inquiries</h2><p>Continue an inquiry already in progress.</p></div></div><div class="version-list">${data.inquiries.slice(0,5).map(i=>`<button class="button" data-action="open-sales-inquiry" data-id="${i.id}">${esc(i.customer_name)} · ${esc(i.status)}</button>`).join('')}</div></article>` : ''}`;
  const form=$('#sales-inquiry-form');
  const syncCustomerMode=()=>{const mode=form.elements.customer_mode.value;form.querySelectorAll('[data-customer-mode]').forEach(section=>section.classList.toggle('is-hidden',section.dataset.customerMode!==mode));form.elements.customer_id.required=mode==='existing';form.elements.new_customer_name.required=mode==='new'};
  form.querySelectorAll('[name="customer_mode"]').forEach(input=>input.addEventListener('change',syncCustomerMode));syncCustomerMode();form.addEventListener('submit', createSalesInquiry);
}

async function createSalesInquiry(event) {
  event.preventDefault(); const form = event.currentTarget; const payload = Object.fromEntries(new FormData(form));
  payload.attachments = String(payload.attachments||'').split('\n').map(x=>x.trim()).filter(Boolean);
  if(payload.customer_mode==='new'){payload.new_customer={customer_name:payload.new_customer_name,company:payload.new_company,country:payload.new_country,contact_name:payload.new_contact_name,email:payload.new_email,phone:payload.new_phone,source:payload.new_source};payload.company=payload.new_company||payload.new_customer_name;payload.country=payload.new_country;}
  const result = await api('/api/sales-inquiries', { method:'POST', body:JSON.stringify(payload) }); state.salesInquiry=result.inquiry; state.salesWorkspace=null; await renderSalesInquiryDetail(result.inquiry.id);
}

async function renderSalesInquiryDetail(id) {
  const { inquiry } = await api(`/api/sales-inquiries/${id}`); state.salesInquiry=inquiry;
  const a=inquiry.analysis; const cards=a?`<section class="sales-analysis-grid">
    ${salesResultCard('Customer Intent',a.customer_intent)}${salesResultCard('Estimated Opportunity',a.opportunity_size)}
    ${salesResultCard('Missing Information',a.missing_information.join(' · ')||'Complete')}${salesResultCard('Suggested Next Question',a.suggested_next_question)}
    ${salesResultCard('Recommended Furniture Package',a.recommended_package)}
  </section>`:'';
  const products=inquiry.products.map(p=>`<article class="sales-product-card ${p.selected?'is-selected':''}"><div class="product-image-preview">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`:icon('products')}</div><div><strong>${esc(p.name)}</strong><small>${esc(p.sku)} · ${esc(p.category)}</small><p>${esc(p.materials||'—')} · ${esc(p.size||'—')}</p><p>MOQ ${p.moq||'—'} · ${p.lead_time_days||'—'} days · ${esc(p.price_range||'—')}</p><label class="recommendation-select"><input type="checkbox" data-sales-product="${p.product_id}" ${p.selected?'checked':''}> ${p.selected?'AI selected':'Select'}</label><div class="quote-inputs"><input type="number" min="1" value="${p.quantity}" data-qty="${p.product_id}" aria-label="Quantity"><input type="number" min="0" step="0.01" value="${p.proposed_unit_price||0}" data-price="${p.product_id}" aria-label="Unit price"></div></div></article>`).join('');
  $('#page').innerHTML=`${pageHeader(inquiry.customer_name,`${esc(inquiry.inquiry_type)} · ${esc(inquiry.status)}`,`<button class="button" data-action="sales-back">Back</button>`)}
    <article class="panel inquiry-message"><small>Original Customer Message</small><p>${esc(inquiry.customer_message)}</p><button class="button button--primary" data-action="analyze-sales-inquiry" data-id="${id}">${a?'Regenerate Analysis':'Analyze Inquiry'}</button></article>${cards}
    ${a?`<article class="panel section-gap">${panelHeader('Possible Products','Live data from Product Library')}<div class="sales-products">${products||'<div class="empty-state">No matching products found.</div>'}</div></article>
    <div class="sales-five-actions"><button class="button button--primary" data-action="generate-sales-quote" data-id="${id}">Generate Quote</button><button class="button" data-action="generate-sales-proposal">Generate Furniture Package</button><button class="button" data-action="generate-freight-quote" data-id="${id}">Generate Freight Quote</button><button class="button" data-action="ask-customer" data-question="${esc(a.suggested_next_question)}">Ask Customer</button><button class="button" data-action="convert-sales-order" data-id="${id}">Convert to Order</button></div>`:''}
    <article class="panel section-gap">${panelHeader('Customer Timeline','All sales activity')}<div class="debug-events">${inquiry.timeline.map(e=>`<div class="debug-event"><span class="stage stage--active">${esc(e.event_type)}</span><div><strong>${esc(e.description)}</strong><small>${formatDateTime(e.created_at)}</small></div></div>`).join('')}</div></article>`;
}
function salesResultCard(title,value){return `<article class="panel sales-result-card"><small>${esc(title)}</small><strong>${esc(value||'—')}</strong></article>`}

async function saveSelectedSalesProducts(id){const products=[...document.querySelectorAll('[data-sales-product]')].map(c=>({product_id:Number(c.dataset.salesProduct),selected:c.checked,quantity:Number(document.querySelector(`[data-qty="${c.dataset.salesProduct}"]`).value),unit_price:Number(document.querySelector(`[data-price="${c.dataset.salesProduct}"]`).value)})); await api(`/api/sales-inquiries/${id}/products`,{method:'PUT',body:JSON.stringify({products})});}
async function analyzeSalesInquiryUi(id){await api(`/api/sales-inquiries/${id}/analyze`,{method:'POST',body:JSON.stringify({regenerate:Boolean(state.salesInquiry?.analysis)})});await renderSalesInquiryDetail(id)}
async function generateSalesQuoteUi(id,freight=false){await saveSelectedSalesProducts(id);const result=await api(`/api/sales-inquiries/${id}/quote`,{method:'POST',body:JSON.stringify({quote_type:freight?'Freight Quote':'Quote',destination:freight?state.salesInquiry.country:null,trade_term:freight?'DDP':null})});toast(`${result.quote.quote_number} generated`);state.salesWorkspace=null;await renderQuoteBuilder(result.quote.id)}
async function renderSalesCustomers(){const d=await salesData();$('#page').innerHTML=`${pageHeader('Customers','Customers connected to your sales workflow')}<article class="panel"><div class="table-scroll"><table class="data-table"><thead><tr><th>Customer</th><th>Country</th><th>City</th></tr></thead><tbody>${d.customers.map(c=>`<tr><td class="money">${esc(c.company_name)}</td><td>${esc(c.country||'—')}</td><td>${esc(c.city||'—')}</td></tr>`).join('')}</tbody></table></div></article>`}
async function renderSalesQuotes(){if(state.salesQuote)return renderQuoteBuilder(state.salesQuote.id);const d=await salesData();$('#page').innerHTML=`${pageHeader('Quotes','Your quotations and PI versions')}<article class="panel"><div class="table-scroll"><table class="data-table"><thead><tr><th>Quote</th><th>Customer</th><th>Status</th><th>Total</th></tr></thead><tbody>${d.quotes.map(q=>`<tr class="clickable-row" data-action="open-sales-quote" data-id="${q.id}"><td>${esc(q.quote_number)}</td><td>${esc(q.customer_name)}</td><td>${badge(q.status)}</td><td>${money(q.total)}</td></tr>`).join('')}</tbody></table></div></article>`}
async function renderSalesOrders(){const d=await salesData();renderSalesTable('Orders',d.orders,['order_number','customer_name','status','total'])}
async function renderSalesTasks(){const d=await salesData();renderSalesTable('Tasks',d.tasks,['title','customer_name','status','due_at'])}
function renderSalesTable(title,rows,fields){$('#page').innerHTML=`${pageHeader(title,`Your ${title.toLowerCase()}`)}<article class="panel"><div class="table-scroll"><table class="data-table"><thead><tr>${fields.map(f=>`<th>${esc(f.replaceAll('_',' '))}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${fields.map(f=>`<td>${f==='total'?money(r[f]):esc(r[f]||'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></article>`}

async function renderQuoteBuilder(id){const {quote}=await api(`/api/sales-quotes/${id}`);state.salesQuote=quote;const s=quote.summary;const tbc=v=>v==null?'TBC':Number(v).toFixed(2);$('#page').innerHTML=`${pageHeader(`PI ${quote.quote_number}`,`Version ${quote.current_version} · ${quote.status}`,`<button class="button" data-action="back-sales-quotes">Back</button><button class="button button--primary" data-action="save-sales-quote" data-id="${id}">Generate PI</button>`)}
<form id="quote-builder-form" class="quote-builder">
<section class="panel quote-section"><h2>1. Customer Information</h2><div class="quote-info-grid"><label>Customer<strong>${esc(quote.customer_name)}</strong></label><label>Company<strong>${esc(quote.company||quote.customer_name)}</strong></label><label>Country<strong>${esc(quote.country||'—')}</strong></label><label>Currency<select name="currency"><option>${esc(quote.currency)}</option><option>USD</option><option>CNY</option><option>MYR</option></select></label><label>Salesperson<strong>${esc(quote.salesperson)}</strong></label><label>Quote Date<strong>${esc(quote.quote_date||'—')}</strong></label><label>Valid Until<input type="date" name="valid_until" value="${esc(quote.valid_until||'')}"></label></div><div class="form-grid pi-manual-fields"><label class="field"><span>Project Name</span><input name="project_name" value="${esc(quote.project_name||'')}"></label><label class="field"><span>Buyer Reference No.</span><input name="buyer_reference_no" value="${esc(quote.buyer_reference_no||'')}"></label><label class="field"><span>Contact Person</span><input name="contact_person" value="${esc(quote.contact_person||'')}"></label><label class="field"><span>Phone / WhatsApp</span><input name="buyer_phone" value="${esc(quote.buyer_phone||'')}"></label><label class="field"><span>Email</span><input name="buyer_email" value="${esc(quote.buyer_email||'')}"></label><label class="field"><span>Billing Address</span><input name="billing_address" value="${esc(quote.billing_address||'')}"></label></div></section>
<section class="panel quote-section"><div class="quote-section-title"><h2>2. Product Table</h2><div><button type="button" class="button" data-action="add-library-quote-item">Add Product from Library</button><button type="button" class="button button--soft" data-action="add-custom-quote-item">Add Custom Item</button></div></div><div class="table-scroll"><table class="data-table quote-table quote-table--simple"><thead><tr><th>Image</th><th>Product Name</th><th>Quantity</th><th>Unit Price</th><th>Line Total</th><th>Remark</th><th></th></tr></thead><tbody>${quote.items.map(i=>`<tr data-quote-item="${i.id}"><td>${i.image_url?`<img src="${esc(i.image_url)}" alt="${esc(i.name)}">`:'<span class="quote-image-empty">No image</span>'}</td><td class="quote-product-cell"><strong>${esc(i.name)}</strong><small>${esc(i.sku)} · Product Library</small><details class="quote-item-details"><summary>Product details</summary><div><span><b>Category</b>${esc(i.category||'—')}</span><span><b>Specification</b>${esc(i.specification||'—')}</span><span><b>Material</b>${esc(i.materials||'—')}</span><span><b>Size</b>${esc(i.size||'—')}</span><span><b>CBM</b>${tbc(i.cbm)}</span><span><b>Gross Weight</b>${tbc(i.gross_weight_kg)}</span><span><b>Net Weight</b>${tbc(i.net_weight_kg)}</span><span><b>MOQ</b>${i.moq||'—'}</span><span><b>Lead Time</b>${i.lead_time_days?`${i.lead_time_days} days`:'—'}</span><label><b>Discount %</b><input data-item-field="discount_percent" type="number" min="0" max="100" value="${i.discount_percent||0}"></label></div></details></td><td><input data-item-field="quantity" type="number" min="1" value="${i.quantity}"></td><td><input data-item-field="unit_price" type="number" min="0" step=".01" value="${i.unit_price}"></td><td class="quote-line-total" data-line-total>${money(i.line_total)}</td><td><input class="quote-remark" data-item-field="remark" value="${esc(i.remark||'')}" placeholder="Add remark"></td><td><button type="button" class="button button--compact" data-action="duplicate-quote-item" data-id="${i.id}" data-item-type="library">Duplicate</button></td></tr>`).join('')}${quote.custom_items.map(i=>`<tr data-custom-item="${i.id}" class="custom-quote-row"><td>${i.reference_image_url?`<img src="${esc(i.reference_image_url)}" alt="${esc(i.item_name)}">`:'<span class="quote-image-empty">Reference image</span>'}</td><td class="quote-product-cell"><input class="quote-product-name" data-custom-field="item_name" value="${esc(i.item_name)}"><small>Custom Quote Item</small><details class="quote-item-details"><summary>Custom item details</summary><div><label><b>Reference Image URL</b><input data-custom-field="reference_image_url" value="${esc(i.reference_image_url||'')}" placeholder="Image URL"></label><label><b>Category</b><input data-custom-field="category" value="${esc(i.category||'')}"></label><label><b>Specification</b><input data-custom-field="specification" value="${esc(i.specification||'')}"></label><label><b>Material</b><input data-custom-field="material" value="${esc(i.material||'')}"></label><label><b>Color / Finish</b><input data-custom-field="color_finish" value="${esc(i.color_finish||'')}"></label><label><b>Size</b><input data-custom-field="size_dimensions" value="${esc(i.size_dimensions||'')}"></label><label><b>CBM</b><input data-custom-field="cbm" type="number" step=".0001" value="${i.cbm??''}" placeholder="TBC"></label><label><b>Gross Weight</b><input data-custom-field="gross_weight_kg" type="number" step=".001" value="${i.gross_weight_kg??''}" placeholder="TBC"></label><label><b>Net Weight</b><input data-custom-field="net_weight_kg" type="number" step=".001" value="${i.net_weight_kg??''}" placeholder="TBC"></label><label><b>Discount %</b><input data-custom-field="discount_percent" type="number" min="0" max="100" value="${i.discount_percent||0}"></label></div></details></td><td><input data-custom-field="quantity" type="number" min="1" value="${i.quantity}"></td><td><input data-custom-field="unit_price" type="number" min="0" step=".01" value="${i.unit_price}"></td><td class="quote-line-total" data-line-total>${money(i.line_total)}</td><td><input class="quote-remark" data-custom-field="remark" value="${esc(i.remark||'')}" placeholder="Add remark"></td><td><button type="button" class="button button--compact" data-action="duplicate-quote-item" data-id="${i.id}" data-item-type="custom">Duplicate</button></td></tr>`).join('')}</tbody></table></div><div class="quote-totals-strip"><span>Total Quantity <strong data-live-total="quantity">${s.total_quantity}</strong></span><span>Product Total <strong data-live-total="product">${money(s.product_total)}</strong></span><span>Total CBM <strong>${tbc(s.total_cbm)}</strong></span><span>Gross Weight <strong>${tbc(s.total_gross_weight)}</strong></span><span>Net Weight <strong>${tbc(s.total_net_weight)}</strong></span></div></section>
<section class="panel quote-section payment-freight-section"><h2>3. Payment Terms & Freight</h2><div class="payment-terms-grid"><label class="field"><span>Deposit %</span><input name="deposit_percent" type="number" min="0" max="100" value="${quote.deposit_percent??30}"></label><label class="field"><span>Balance %</span><input name="balance_percent" type="number" min="0" max="100" value="${quote.balance_percent??70}"></label><label class="field"><span>Payment Method</span><input name="payment_method" value="${esc(quote.payment_method||'TT Bank Transfer')}"></label><label class="field payment-note-field"><span>Payment Note</span><input name="payment_note" value="${esc(quote.payment_note||`${quote.deposit_percent??30}% deposit before production. ${quote.balance_percent??70}% balance before shipment.`)}"></label><label class="field"><span>Receiving Bank Account</span><select name="bank_account_id"><option value="">Bank information provided separately</option>${quote.bank_accounts.map(account=>`<option value="${account.id}" ${quote.selected_bank_account?.id===account.id?'selected':''}>${esc(account.account_name)} · ${esc(account.payment_currency||quote.currency)}</option>`).join('')}</select></label></div><div class="freight-divider"><strong>Freight</strong><span>Select a common trade term</span></div><div class="trade-term-buttons">${['EXW','FOB','CIF','DDP'].map(x=>`<button type="button" class="trade-term-button ${quote.trade_term===x?'is-active':''}" data-action="select-trade-term" data-term="${x}">${x}</button>`).join('')}<input type="hidden" name="trade_term" value="${esc(quote.trade_term||'')}"></div><div class="form-grid freight-fields"><label class="field"><span>Shipping Method</span><select name="shipping_method">${['','Sea','Air','Express','Truck'].map(x=>`<option ${quote.shipping_method===x?'selected':''}>${x}</option>`).join('')}</select></label><label class="field"><span>Destination</span><input name="destination" value="${esc(quote.destination||'')}"></label><label class="field"><span>Origin Port</span><input name="origin_port" value="${esc(quote.origin_port||'')}"></label><label class="field"><span>Destination Port</span><input name="destination_port" value="${esc(quote.destination_port||'')}"></label><label class="field"><span>Delivery Address</span><input name="destination_address" value="${esc(quote.destination_address||'')}"></label><label class="field"><span>Total Packages / Cartons</span><input name="total_packages" type="number" min="0" value="${quote.total_packages??''}"></label><label class="field"><span>Estimated Production Time</span><input name="production_time" value="${esc(quote.production_time||'')}"></label><label class="field"><span>Estimated Shipping Time</span><input name="transit_time" value="${esc(quote.transit_time||'')}"></label><label class="field"><span>Freight Cost</span><input name="freight_cost" type="number" step=".01" value="${quote.freight_cost??''}" placeholder="Freight To Be Quoted"></label><label class="field"><span>Freight Remark</span><input name="freight_remark" value="${esc(quote.freight_remark||'')}"></label></div></section>
<section class="panel quote-section quote-summary"><h2>4. Summary</h2><div><span>Product Total <strong data-live-total="product">${money(s.product_total)}</strong></span><span>Discount <strong data-live-total="discount">${money(s.discount)}</strong></span><span>Freight <strong data-live-total="freight">${s.freight_cost==null?'Freight To Be Quoted':money(s.freight_cost)}</strong></span><label>Other Charges <input name="other_charges" type="number" value="${quote.other_charges||0}"></label><span class="grand-total-card">Grand Total <strong data-live-total="grand">${money(s.grand_total)}</strong></span><span>Deposit <strong data-payment-amount="deposit">${money(s.deposit_amount)}</strong></span><span>Balance <strong data-payment-amount="balance">${money(s.balance_amount)}</strong></span></div><label class="field"><span>General Remarks</span><textarea name="other_remark">${esc(quote.other_remark||'')}</textarea></label><label class="field"><span>Special Terms</span><textarea name="special_terms">${esc(quote.special_terms||'')}</textarea></label></section></form>
<div class="sales-five-actions"><button class="button button--primary" data-action="preview-sales-quote" data-id="${id}">Preview PI</button><button class="button" data-action="export-sales-quote" data-id="${id}" data-type="pdf">Export PDF</button><button class="button" data-action="export-sales-quote" data-id="${id}" data-type="excel">Export Excel</button><button class="button" data-action="sales-message" data-id="${id}" data-type="whatsapp">WhatsApp</button><button class="button" data-action="sales-message" data-id="${id}" data-type="email">Email</button><button class="button button--soft" data-action="convert-sales-order" data-id="${quote.inquiry_id}">Convert to Order</button></div>
<article class="panel section-gap">${panelHeader('Version History','No data loss')}<div class="version-list">${quote.versions.map(v=>`<button class="button" data-action="view-quote-version" data-id="${id}" data-version="${v.version_number}">Version ${v.version_number}</button>`).join('')}</div></article>`;
  const confirmedSection=document.createElement('section');confirmedSection.className='panel quote-section confirmed-specifications';confirmedSection.innerHTML=`<h2>Customer Confirmed Specifications</h2><p class="section-note">These selections are saved with this quote only and never change Product Library defaults.</p><div class="confirmed-spec-list">${quote.all_items.map(i=>`<article data-confirmed-item="${i.id}" data-confirmed-type="${i.item_type}"><strong>${esc(i.name)}</strong><div class="form-grid"><label class="field"><span>Material</span><input data-confirmed-field="confirmed_material" value="${esc(i.confirmed_material||'')}"></label><label class="field"><span>Finish</span><input data-confirmed-field="confirmed_finish" value="${esc(i.confirmed_finish||'')}"></label><label class="field"><span>Color Name</span><input data-confirmed-field="confirmed_color_name" value="${esc(i.confirmed_color_name||'')}"></label><label class="field"><span>Approved Swatch Image URL</span><input data-confirmed-field="swatch_image_url" value="${esc(i.swatch_image_url||'')}"></label><label class="field full-span"><span>Customer Remark</span><input data-confirmed-field="customer_remark" value="${esc(i.customer_remark||'')}"></label></div></article>`).join('')}</div>`;const paymentSection=$('.payment-freight-section');paymentSection.parentNode.insertBefore(confirmedSection,paymentSection);
  const packingInputs=document.createElement('div');packingInputs.className='form-grid packing-overrides';packingInputs.innerHTML=`<label class="field"><span>Total CBM</span><input name="total_cbm_override" type="number" min="0" step=".0001" value="${quote.total_cbm_override??''}" placeholder="TBC"></label><label class="field"><span>Total Gross Weight (kg)</span><input name="total_gross_weight_override" type="number" min="0" step=".001" value="${quote.total_gross_weight_override??''}" placeholder="TBC"></label><label class="field"><span>Total Net Weight (kg)</span><input name="total_net_weight_override" type="number" min="0" step=".001" value="${quote.total_net_weight_override??''}" placeholder="TBC"></label>`;paymentSection.querySelector('.freight-fields').append(packingInputs);
  const depositInput=$('[name="deposit_percent"]');const balanceInput=$('[name="balance_percent"]');const noteInput=$('[name="payment_note"]');let paymentNoteEdited=false;
  noteInput.addEventListener('input',()=>{paymentNoteEdited=true});
  const syncPayment=(source)=>{const primary=source==='deposit'?depositInput:balanceInput;const secondary=source==='deposit'?balanceInput:depositInput;const value=Math.min(100,Math.max(0,Number(primary.value||0)));primary.value=value;secondary.value=100-value;if(!paymentNoteEdited)noteInput.value=`${depositInput.value}% deposit before production. ${balanceInput.value}% balance before shipment.`;recalculateQuoteBuilder()};
  depositInput.addEventListener('input',()=>syncPayment('deposit'));balanceInput.addEventListener('input',()=>syncPayment('balance'));
  $('#quote-builder-form').addEventListener('input',event=>{if(event.target.matches('[data-item-field="quantity"],[data-item-field="unit_price"],[data-item-field="discount_percent"],[data-custom-field="quantity"],[data-custom-field="unit_price"],[data-custom-field="discount_percent"],[name="freight_cost"],[name="other_charges"]'))recalculateQuoteBuilder()});
  recalculateQuoteBuilder();
}
function recalculateQuoteBuilder(){const form=$('#quote-builder-form');if(!form)return;let quantity=0,subtotal=0,discount=0;const rows=[...form.querySelectorAll('[data-quote-item],[data-custom-item]')];for(const row of rows){const custom=row.hasAttribute('data-custom-item');const field=name=>row.querySelector(`[${custom?'data-custom-field':'data-item-field'}="${name}"]`);const qty=Math.max(0,Number(field('quantity')?.value||0));const price=Math.max(0,Number(field('unit_price')?.value||0));const rate=Math.min(100,Math.max(0,Number(field('discount_percent')?.value||0)));const gross=qty*price;const itemDiscount=gross*rate/100;const line=gross-itemDiscount;quantity+=qty;subtotal+=gross;discount+=itemDiscount;const output=row.querySelector('[data-line-total]');if(output)output.textContent=money(line)}const productTotal=subtotal-discount;const freightInput=form.elements.freight_cost;const freightKnown=freightInput&&String(freightInput.value).trim()!=='';const freight=freightKnown?Math.max(0,Number(freightInput.value||0)):0;const other=Math.max(0,Number(form.elements.other_charges?.value||0));const grand=productTotal+freight+other;const deposit=grand*Math.min(100,Math.max(0,Number(form.elements.deposit_percent?.value||0)))/100;const balance=grand-deposit;document.querySelectorAll('[data-live-total="quantity"]').forEach(node=>node.textContent=String(quantity));document.querySelectorAll('[data-live-total="product"]').forEach(node=>node.textContent=money(productTotal));document.querySelectorAll('[data-live-total="discount"]').forEach(node=>node.textContent=money(discount));document.querySelectorAll('[data-live-total="freight"]').forEach(node=>node.textContent=freightKnown?money(freight):'Freight To Be Quoted');document.querySelectorAll('[data-live-total="grand"]').forEach(node=>node.textContent=money(grand));$('[data-payment-amount="deposit"]').textContent=money(deposit);$('[data-payment-amount="balance"]').textContent=money(balance);return{quantity,subtotal,discount,productTotal,freight,other,grand,deposit,balance}}
function quoteBuilderPayload(){const form=$('#quote-builder-form');const b=Object.fromEntries(new FormData(form));const confirmed=new Map([...document.querySelectorAll('[data-confirmed-item]')].map(row=>[`${row.dataset.confirmedType}:${row.dataset.confirmedItem}`,Object.fromEntries([...row.querySelectorAll('[data-confirmed-field]')].map(x=>[x.dataset.confirmedField,x.value]))]));b.items=[...document.querySelectorAll('[data-quote-item]')].map(row=>({id:Number(row.dataset.quoteItem),...Object.fromEntries([...row.querySelectorAll('[data-item-field]')].map(x=>[x.dataset.itemField,x.value])),...(confirmed.get(`library:${row.dataset.quoteItem}`)||{})}));b.custom_items=[...document.querySelectorAll('[data-custom-item]')].map(row=>({id:Number(row.dataset.customItem),...Object.fromEntries([...row.querySelectorAll('[data-custom-field]')].map(x=>[x.dataset.customField,x.value])),...(confirmed.get(`custom:${row.dataset.customItem}`)||{})}));return b}
async function saveQuoteBuilder(id){const result=await api(`/api/sales-quotes/${id}`,{method:'PUT',body:JSON.stringify(quoteBuilderPayload())});toast(`Version ${result.quote.current_version} saved`);await renderQuoteBuilder(id)}
async function persistQuoteBuilder(id){const result=await api(`/api/sales-quotes/${id}`,{method:'PUT',body:JSON.stringify(quoteBuilderPayload())});state.salesQuote=result.quote;return result.quote}
async function previewCurrentQuote(id){await persistQuoteBuilder(id);previewQuote()}
async function exportCurrentQuote(id,type){await persistQuoteBuilder(id);const link=document.createElement('a');link.href=`/api/sales-quotes/${id}/export/${type}`;link.download='';document.body.append(link);link.click();link.remove()}
function previewQuote(){const q=state.salesQuote;const s=q.summary;const company=q.company_settings||{};const bank=q.selected_bank_account;const tbc=v=>v==null?'TBC':Number(v).toFixed(2);const blank=v=>esc(v||'____________________________');const cm=v=>quoteMoney(v,q.currency);const modal=document.createElement('div');modal.className='modal-backdrop';modal.id='pi-preview';modal.innerHTML=`<div class="modal-card pi-preview pi-global"><button class="icon-button modal-close" data-action="close-pi-preview">${icon('close')}</button>
  <header class="pi-global-header"><div>${company.company_logo?`<img src="${esc(company.company_logo)}" alt="${esc(company.company_name||'Company')} logo">`:''}<strong>${esc(company.company_name||'')}</strong><small>${[company.address,company.city_state_zip,company.country].filter(Boolean).map(esc).join(' · ')}</small><small>${[company.phone,company.email,company.website].filter(Boolean).map(esc).join(' · ')}</small>${company.registration_no?`<small>Registration No.: ${esc(company.registration_no)}</small>`:''}</div><div><h1>PROFORMA INVOICE</h1><p><b>PI No.:</b> ${esc(q.quote_number)}</p></div></header>
  <section class="pi-meta-grid"><p><b>Issue Date</b>${blank(q.quote_date)}</p><p><b>Valid Until</b>${blank(q.valid_until)}</p><p><b>Sales Representative</b>${blank(q.salesperson)}</p><p><b>Currency</b>${blank(q.currency)}</p><p><b>Trade Term</b>${blank(q.trade_term)}</p><p><b>Payment Terms</b>${Number(q.deposit_percent)}% deposit / ${Number(q.balance_percent)}% balance</p><p><b>Buyer Reference No.</b>${blank(q.buyer_reference_no)}</p><p><b>Project Name</b>${blank(q.project_name)}</p></section>
  <section class="pi-document-section"><h2>Buyer Information</h2><div class="pi-buyer-grid"><p><b>Customer / Restaurant Name</b>${blank(q.customer_name)}</p><p><b>Company Name</b>${blank(q.company||q.customer_name)}</p><p><b>Contact Person</b>${blank(q.contact_person)}</p><p><b>Phone / WhatsApp</b>${blank(q.buyer_phone)}</p><p><b>Email</b>${blank(q.buyer_email)}</p><p><b>Country</b>${blank(q.country)}</p><p><b>Billing Address</b>${blank(q.billing_address)}</p><p><b>Delivery Address</b>${blank(q.destination_address||q.destination)}</p></div></section>
  <section class="pi-document-section"><h2>Product Details</h2><div class="pi-table-scroll"><table class="pi-global-table"><thead><tr><th>No.</th><th>Product Image</th><th>SKU / Item Code</th><th>Product Name / Description</th><th>Material / Finish</th><th>Dimensions</th><th>Color / Upholstery</th><th>Qty</th><th>Unit Price</th><th>Amount</th><th>Remarks</th></tr></thead><tbody>${q.all_items.map((i,index)=>`<tr><td>${index+1}</td><td class="pi-product-image">${i.image_url?`<img src="${esc(i.image_url)}" alt="${esc(i.name)}">`:'<span>Reference image pending</span>'}</td><td>${esc(i.sku||'CUSTOM')}</td><td><strong>${esc(i.name)}</strong><small>${esc(i.specification||'')}</small><small>CBM ${tbc(i.cbm)} · Gross ${tbc(i.gross_weight_kg)} kg · Net ${tbc(i.net_weight_kg)} kg · Lead Time ${i.lead_time_days?`${i.lead_time_days} days`:'TBC'} · Packaging ${esc(i.packaging||'TBC')}</small></td><td>${esc([i.materials,i.finish].filter(Boolean).join(' / ')||'—')}</td><td>${esc(i.size||'—')}</td><td>${esc(i.color||'—')}</td><td>${i.quantity}</td><td>${cm(i.unit_price)}</td><td><strong>${cm(i.line_total)}</strong></td><td>${esc(i.remark||'')}</td></tr>`).join('')}</tbody></table></div></section>
  <section class="pi-two-column"><div class="pi-document-section"><h2>Packing / Logistics Summary</h2><p>Total Quantity: <b>${s.total_quantity}</b></p><p>Total Packages / Cartons: <b>${q.total_packages??'TBC'}</b></p><p>Total CBM: <b>${tbc(s.total_cbm)}</b></p><p>Total Gross Weight: <b>${tbc(s.total_gross_weight)}</b></p><p>Total Net Weight: <b>${tbc(s.total_net_weight)}</b></p></div><div class="pi-document-section pi-commercial"><h2>Commercial Summary</h2><p>Product Subtotal <b>${cm(s.product_subtotal)}</b></p><p>Discount <b>-${cm(s.discount)}</b></p><p>Freight Cost <b>${s.freight_cost==null?'Freight cost to be quoted separately.':cm(s.freight_cost)}</b></p><p>Other Charges <b>${cm(s.other_charges)}</b></p><p class="pi-grand">Grand Total <b>${cm(s.grand_total)}</b></p><p>Deposit Amount (${Number(q.deposit_percent)}%) <b>${cm(s.deposit_amount)}</b></p><p>Balance Amount <b>${cm(s.balance_amount)}</b></p></div></section>
  <section class="pi-two-column"><div class="pi-document-section"><h2>Payment Terms</h2><p>${esc(q.payment_note||`${q.deposit_percent}% deposit before production. ${q.balance_percent}% balance before shipment.`)}</p><p>Payment Method: ${esc(q.payment_method||'TT Bank Transfer')}</p><h2>Bank Information</h2>${bank?`<p>Beneficiary Name: ${blank(bank.beneficiary_name)}</p><p>Bank Name: ${blank(bank.bank_name)}</p><p>Bank Address: ${blank(bank.bank_address)}</p><p>Account Number: ${blank(bank.account_number)}</p><p>SWIFT / BIC: ${blank(bank.swift_bic)}</p><p>Routing Number: ${blank(bank.routing_number)}</p><p>IBAN: ${blank(bank.iban)}</p><p>Bank Country: ${blank(bank.bank_country)}</p><p>Payment Currency: ${blank(bank.payment_currency)}</p>`:'<p><b>Bank information to be provided separately.</b></p>'}</div><div class="pi-document-section"><h2>Shipping Information</h2><p>Trade Term: ${blank(q.trade_term)}</p><p>Shipping Method: ${blank(q.shipping_method)}</p><p>Origin Port: ${blank(q.origin_port)}</p><p>Destination Port: ${blank(q.destination_port)}</p><p>Delivery Address: ${blank(q.destination_address||q.destination)}</p><p>Estimated Production Time: ${blank(q.production_time)}</p><p>Estimated Shipping Time: ${blank(q.transit_time)}</p><p>Freight Remark: ${blank(q.freight_remark)}</p></div></section>
  <section class="pi-document-section"><h2>Remarks</h2><p>${blank(q.other_remark)}</p>${q.special_terms?`<p><b>Special Terms:</b> ${esc(q.special_terms)}</p>`:''}<h2>Terms & Conditions</h2><ol>${q.pi_terms.map(term=>`<li>${esc(term)}</li>`).join('')}</ol></section>
  <footer class="pi-signatures"><p><b>Prepared By</b>${blank(q.salesperson)}</p><p><b>Approved By</b>Company Representative<br>Signature: ____________________</p><p><b>Buyer Confirmation</b>Name / Signature / Date<br>____________________</p><p><b>Company Stamp</b><br><span class="pi-stamp-space"></span></p></footer>
  </div>`;document.body.append(modal)}
function openLibraryQuoteItem(){const q=state.salesQuote;const modal=document.createElement('div');modal.className='modal-backdrop';modal.id='quote-item-modal';modal.innerHTML=`<div class="modal-card small-modal"><button class="icon-button modal-close" data-action="close-quote-item-modal">${icon('close')}</button><h2>Add Product from Library</h2><form id="library-item-form"><label class="field"><span>Product</span><select name="product_id" required>${q.library_options.map(p=>`<option value="${p.id}">${esc(p.sku)} · ${esc(p.name)} · ${esc(p.category||'')}</option>`).join('')}</select></label><div class="form-actions"><button class="button button--primary">Add Product</button></div></form></div>`;document.body.append(modal);$('#library-item-form').addEventListener('submit',async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.currentTarget));await api(`/api/sales-quotes/${q.id}/items/library`,{method:'POST',body:JSON.stringify(body)});modal.remove();await renderQuoteBuilder(q.id)})}
function openCustomQuoteItem(){const q=state.salesQuote;const modal=document.createElement('div');modal.className='modal-backdrop';modal.id='quote-item-modal';const fields=[['reference_image_url','Product image / reference URL'],['item_name','Product name *'],['category','Product category'],['specification','Specification / parameters'],['material','Material'],['color_finish','Color / finish'],['size_dimensions','Size / dimensions'],['quantity','Quantity','number'],['unit_price','Unit price','number'],['cbm','CBM (optional)','number'],['gross_weight_kg','Gross weight kg (optional)','number'],['net_weight_kg','Net weight kg (optional)','number'],['remark','Remark']];modal.innerHTML=`<div class="modal-card custom-item-modal"><button class="icon-button modal-close" data-action="close-quote-item-modal">${icon('close')}</button><h2>Add Custom Item</h2><p>No Product Library record is required.</p><form id="custom-item-form" class="form-grid">${fields.map(([name,label,type])=>`<label class="field"><span>${label}</span><input name="${name}" type="${type||'text'}" ${name==='item_name'?'required':''} ${name==='quantity'?'min="1" value="1"':''} ${name==='unit_price'?'min="0" step=".01" value="0"':''}></label>`).join('')}<div class="form-actions full-span"><button class="button button--primary">Add Custom Item</button></div></form></div>`;document.body.append(modal);$('#custom-item-form').addEventListener('submit',async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.currentTarget));await api(`/api/sales-quotes/${q.id}/items/custom`,{method:'POST',body:JSON.stringify(body)});modal.remove();await renderQuoteBuilder(q.id)})}

async function renderProposals() {
  const data = state.proposals || await api('/api/proposals');
  state.proposals = data;
  $('#page').innerHTML = `
    ${pageHeader(t('proposals.title'), t('proposals.subtitle'), `<button class="button button--primary" data-action="new-proposal">${icon('plus')} ${t('proposals.newProposal')}</button>`, `<span class="date-chip">${t('proposals.pdfLanguage')}: <strong>${t('proposals.pdfEnglish')}</strong></span>`)}
    <div class="eyebrow"><span></span>${t('proposals.templateEyebrow')}</div>
    <section class="module-grid">
      ${templateCard(t('proposals.fullTitle'), t('proposals.fullBody'), '', t('proposals.mostUsed'))}
      ${templateCard(t('proposals.selectionTitle'), t('proposals.selectionBody'), 'sand', t('proposals.designLed'))}
      ${templateCard(t('proposals.quickTitle'), t('proposals.quickBody'), 'blue', t('proposals.salesReady'))}
    </section>
    <article class="panel section-gap">
      ${panelHeader(t('proposals.recent'), t('proposals.recentSub', { count: data.proposals.length }), t('common.browseAll'))}
      <div class="table-scroll"><table class="data-table"><thead><tr><th>${t('status.proposal')}</th><th>${t('fields.client')}</th><th>${t('fields.market')}</th><th>${t('fields.owner')}</th><th>${t('fields.validUntil')}</th><th>${t('fields.status')}</th><th></th></tr></thead><tbody>
        ${data.proposals.map(row => `<tr><td class="primary-cell"><strong>${esc(row.project_name)}</strong><small>${esc(row.proposal_number)}</small></td><td>${esc(row.client_name)}</td><td>${esc(row.market)}</td><td>${userAvatar(row.owner_initials, row.owner_name)}</td><td>${formatDate(row.valid_until)}</td><td>${badge(row.status)}</td><td><button class="icon-button row-menu">${icon('dots')}</button></td></tr>`).join('')}
      </tbody></table></div>
    </article>`;
}

function templateCard(title, description, style = '', kicker) {
  return `<article class="template-card" data-action="new-proposal"><div class="template-cover ${style ? `template-cover--${style}` : ''}"><small>RSP / ${kicker}</small><strong>${title}</strong></div><div class="template-copy"><div><strong>${t('proposals.useTemplate')}</strong><small>${description}</small></div>${icon('arrow')}</div></article>`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(localeForIntl(), { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

async function renderCases() {
  const cases = [
    { title: 'Luma Coastal Kitchen', location: 'San Diego, CA', type: 'Full-service restaurant', tone: '', productCount: 6 },
    { title: 'Field & Finch Bistro', location: 'Austin, TX', type: 'Neighborhood bistro', tone: 'green', productCount: 4 },
    { title: 'Northline Rooftop', location: 'Brooklyn, NY', type: 'Rooftop hospitality', tone: 'blue', productCount: 5 }
  ];
  $('#page').innerHTML = `
    ${pageHeader(t('cases.title'), t('cases.subtitle'), `<button class="button button--primary" data-action="add-case">${icon('plus')} ${t('cases.add')}</button>`)}
    <div class="filter-bar panel" style="border-radius:11px"><label class="filter-search">${icon('search')}<input placeholder="${t('cases.search')}" /></label><select class="select-control"><option>${t('cases.allVenueTypes')}</option><option>${t('cases.restaurant')}</option><option>${t('cases.hotel')}</option><option>${t('cases.outdoor')}</option></select><select class="select-control"><option>${t('cases.allMarkets')}</option><option>${t('cases.unitedStates')}</option><option>${t('cases.canada')}</option></select></div>
    <section class="module-grid section-gap">
      ${cases.map(item => `<article class="case-card"><div class="case-visual ${item.tone ? `case-visual--${item.tone}` : ''}"><div class="case-scene"></div><span class="case-tag">${t('cases.publishedCase')}</span></div><div class="case-copy"><h3>${item.title}</h3><p>${item.type} · ${item.location}</p><div class="case-meta"><span>${t('cases.productFamilies', { count: item.productCount })}</span><span>${t('cases.viewCase')} →</span></div></div></article>`).join('')}
    </section>
    <article class="panel section-gap">
      ${panelHeader(t('cases.coverage'), t('cases.coverageSub'))}
      <div class="module-grid--4 module-grid" style="padding:16px">
        ${[[t('cases.restaurants'), 12], [t('cases.cafes'), 7], [t('cases.hotels'), 5], [t('cases.outdoor'), 4]].map(([label, count], index) => `<div class="stat-tile"><span class="metric-icon ${index ? `metric-icon--${['gold','blue','purple'][index-1]}` : ''}">${icon('cases')}</span><div><strong>${count}</strong><small>${label}</small></div></div>`).join('')}
      </div>
    </article>`;
}

async function renderCrm() {
  const data = state.opportunities || await api('/api/opportunities');
  state.opportunities = data;
  const stages = ['New Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won'];
  $('#page').innerHTML = `
    ${pageHeader(t('crm.title'), t(state.user.role === 'Sales' ? 'crm.subtitleSales' : 'crm.subtitleAll'), `<button class="button button--primary" data-action="add-opportunity">${icon('plus')} ${t('crm.add')}</button>`, `<button class="button">${icon('filter')} ${t('common.filter')}</button>`)}
    <section class="metrics-grid">
      ${metricCard(t('dashboard.openPipeline'), shortMoney(data.opportunities.filter(row => !['Won','Lost'].includes(row.stage)).reduce((sum, row) => sum + row.estimated_value, 0)), t('crm.active', { count: data.opportunities.filter(row => !['Won','Lost'].includes(row.stage)).length }), 'money')}
      ${metricCard(t('crm.weighted'), shortMoney(data.opportunities.reduce((sum, row) => sum + row.estimated_value * row.probability / 100, 0)), t('crm.probabilityAdjusted'), 'briefcase', 'gold', true)}
      ${metricCard(t('crm.proposalStage'), data.opportunities.filter(row => row.stage === 'Proposal').length, t('crm.needsFollowup'), 'proposals', 'blue', true)}
      ${metricCard(t('crm.wonPeriod'), shortMoney(data.opportunities.filter(row => row.stage === 'Won').reduce((sum, row) => sum + row.estimated_value, 0)), t('crm.teamResult'), 'check', 'purple')}
    </section>
    <section class="pipeline-board section-gap">
      ${stages.map(stage => {
        const rows = data.opportunities.filter(row => row.stage === stage);
        return `<div class="pipeline-column"><div class="pipeline-head"><span>${statusLabel(stage)}</span><span>${rows.length}</span></div>${rows.map(row => `<article class="opportunity-card"><strong>${esc(row.company_name)}</strong><small>${esc(row.project_name)}</small><div class="opportunity-meta"><span class="money">${money(row.estimated_value)}</span>${userAvatar(row.owner_initials)}</div></article>`).join('')}</div>`;
      }).join('')}
    </section>`;
}

async function renderSalesAI() {
  $('#page').innerHTML = `
    ${pageHeader(t('salesAi.title'), t('salesAi.subtitle'), `<button class="button">${icon('cases')} ${t('salesAi.playbooks')}</button>`)}
    <section class="module-grid">
      ${aiFeature(t('salesAi.brief'), t('salesAi.briefBody'), 'briefcase', t('salesAi.createBrief'))}
      ${aiFeature(t('salesAi.followup'), t('salesAi.followupBody'), 'mail', t('salesAi.draftFollowup'))}
      ${aiFeature(t('salesAi.recommender'), t('salesAi.recommenderBody'), 'products', t('salesAi.recommend'))}
      ${aiFeature(t('salesAi.objection'), t('salesAi.objectionBody'), 'sparkles', t('salesAi.openCoach'))}
      ${aiFeature(t('salesAi.notes'), t('salesAi.notesBody'), 'document', t('salesAi.processNotes'))}
      ${aiFeature(t('salesAi.research'), t('salesAi.researchBody'), 'search', t('salesAi.startResearch'))}
    </section>
    <article class="panel section-gap">
      ${panelHeader(t('salesAi.recommended'), t('salesAi.recommendedSub'))}
      <div class="task-list">
        ${activityRow(t('salesAi.followPacific'), t('salesAi.followPacificMeta'), 'mail')}
        ${activityRow(t('salesAi.prepareFreight'), t('salesAi.prepareFreightMeta'), 'sparkles')}
        ${activityRow(t('salesAi.shortlist'), t('salesAi.shortlistMeta'), 'products')}
      </div>
    </article>`;
}

function aiFeature(title, description, iconName, action) {
  return `<article class="ai-feature"><span class="metric-icon">${icon(iconName)}</span><h3>${title}</h3><p>${description}</p><button class="button button--soft" data-action="ai-tool">${action} ${icon('arrow')}</button></article>`;
}

async function renderContentAI() {
  const contentItems = ['LinkedIn: Project reveal', '', 'Email: Outdoor guide', '', 'LinkedIn: Material story', '', ''];
  const tones = ['', '', 'gold', '', 'purple', '', ''];
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(2026, 5, 29 + index);
    return [new Intl.DateTimeFormat(localeForIntl(), { weekday: 'short' }).format(date), date.getDate(), contentItems[index], tones[index]];
  });
  $('#page').innerHTML = `
    ${pageHeader(t('contentAi.title'), t('contentAi.subtitle'), `<button class="button button--primary" data-action="create-content">${icon('sparkles')} ${t('contentAi.create')}</button>`)}
    <section class="module-grid">
      ${aiFeature(t('contentAi.linkedin'), t('contentAi.linkedinBody'), 'content-ai', t('contentAi.startPost'))}
      ${aiFeature(t('contentAi.caseStory'), t('contentAi.caseStoryBody'), 'cases', t('contentAi.buildStory'))}
      ${aiFeature(t('contentAi.buyerGuide'), t('contentAi.buyerGuideBody'), 'document', t('contentAi.createGuide'))}
    </section>
    <article class="panel section-gap">
      ${panelHeader(t('contentAi.calendar'), t('contentAi.calendarPeriod'), t('contentAi.fullCalendar'))}
      <div class="calendar-strip">${dates.map(date => `<div class="calendar-day"><span>${date[0]}</span><strong>${date[1]}</strong>${date[2] ? `<div class="calendar-item ${date[3] ? `calendar-item--${date[3]}` : ''}">${date[2]}</div>` : ''}</div>`).join('')}</div>
      <div class="task-list">
        ${activityRow('Restaurant seating trends buyers are asking about', 'Draft · LinkedIn · Assigned to Casey Rivera', 'content-ai')}
        ${activityRow('How to specify commercial-grade outdoor furniture', 'In review · Buyer guide · Due July 6', 'document')}
      </div>
    </article>`;
}

const foundationMeta = {
  configs: { title: 'foundation.configs', subtitle: 'foundation.configsSub', typeField: 'config_type', list: 'configs', canView: null, canEdit: 'canEditConfigs' },
  tags: { title: 'foundation.tags', subtitle: 'foundation.tagsSub', typeField: 'tag_type', list: 'tags', canView: null, canEdit: 'canEditTags' },
  media: { title: 'foundation.media', subtitle: 'foundation.mediaSub', typeField: 'media_category', list: 'media', canView: 'canViewMedia', canEdit: 'canEditMedia' },
  prompts: { title: 'foundation.prompts', subtitle: 'foundation.promptsSub', typeField: 'prompt_type', list: 'prompts', canView: 'canViewPrompts', canEdit: 'canEditPrompts' }
};

async function renderFoundation() {
  const data = state.foundation || await api('/api/foundation');
  state.foundation = data;
  const tab = state.foundationTab;
  const meta = foundationMeta[tab];
  const canView = !meta.canView || data.capabilities[meta.canView];
  const canEdit = data.capabilities[meta.canEdit];
  const rows = data[meta.list];
  const typeOptions = data.types[tab].map(type => `<option value="${esc(type)}">${esc(type)}</option>`).join('');
  const action = canEdit ? `<button class="button button--primary" data-action="foundation-add" data-entity="${tab}">${icon('plus')} ${t('foundation.add')}</button>` : '';
  $('#page').innerHTML = `
    ${pageHeader(t('foundation.title'), t('foundation.subtitle'), action)}
    <div class="foundation-tabs" role="tablist">
      ${Object.entries(foundationMeta).map(([key, item]) => `<button class="foundation-tab ${key === tab ? 'is-active' : ''}" data-action="foundation-tab" data-tab="${key}" role="tab" aria-selected="${key === tab}">${t(item.title)}</button>`).join('')}
    </div>
    ${canView ? `<article class="panel foundation-panel">
      ${panelHeader(t(meta.title), t(meta.subtitle, { count: rows.length }))}
      <div class="filter-bar">
        <label class="filter-search">${icon('search')}<input id="foundation-search" placeholder="${t('foundation.search')}" aria-label="${t('foundation.search')}" /></label>
        <select id="foundation-type-filter" class="select-control" aria-label="${t('foundation.typeFilter')}"><option value="">${t('foundation.allTypes')}</option>${typeOptions}</select>
        <select id="foundation-status-filter" class="select-control" aria-label="${t('fields.status')}"><option value="">${t('foundation.allStatuses')}</option><option value="1">${t('status.active')}</option><option value="0">${t('status.inactive')}</option></select>
        ${!canEdit ? `<span class="read-only-note">${icon('lock')} ${t('foundation.readOnly')}</span>` : ''}
      </div>
      <div class="table-scroll">${foundationTable(tab, rows, canEdit)}</div>
      <div id="foundation-empty" class="empty-state is-hidden"><strong>${t('foundation.noMatches')}</strong><small>${t('foundation.adjustFilters')}</small></div>
    </article>` : foundationAccessPanel()}`;
  if (canView) {
    $('#foundation-search').addEventListener('input', applyFoundationFilters);
    $('#foundation-type-filter').addEventListener('change', applyFoundationFilters);
    $('#foundation-status-filter').addEventListener('change', applyFoundationFilters);
  }
}

function foundationAccessPanel() {
  return `<div class="restricted foundation-restricted"><div class="restricted-card"><span class="metric-icon metric-icon--gold">${icon('lock')}</span><h1>${t('foundation.sectionLimited')}</h1><p>${t('foundation.sectionLimitedBody')}</p></div></div>`;
}

function foundationTable(entity, rows, canEdit) {
  const headers = {
    configs: ['foundation.name', 'foundation.code', 'foundation.type', 'foundation.description', 'foundation.sortOrder', 'fields.status'],
    tags: ['foundation.tagName', 'foundation.code', 'foundation.type', 'foundation.description', 'fields.status'],
    media: ['foundation.fileName', 'foundation.mediaCategory', 'foundation.relatedTo', 'foundation.flags', 'fields.status'],
    prompts: ['foundation.promptName', 'foundation.type', 'foundation.version', 'foundation.variables', 'fields.status']
  }[entity];
  return `<table id="foundation-table" class="data-table"><thead><tr>${headers.map(key => `<th>${t(key)}</th>`).join('')}<th></th></tr></thead><tbody>${rows.map(row => foundationRow(entity, row, canEdit)).join('')}</tbody></table>`;
}

function foundationRow(entity, row, canEdit) {
  const type = row[foundationMeta[entity].typeField] || '';
  const shared = `data-foundation-row data-type="${esc(type)}" data-active="${row.active}"`;
  const actions = canEdit ? `<td class="foundation-actions"><button class="button button--compact" data-action="foundation-edit" data-entity="${entity}" data-id="${row.id}">${t('common.edit')}</button><button class="switch ${row.active ? 'is-active' : ''}" data-action="foundation-toggle" data-entity="${entity}" data-id="${row.id}" data-active="${row.active}" aria-label="${t(row.active ? 'foundation.deactivate' : 'foundation.activate')}"><span></span></button></td>` : '<td></td>';
  if (entity === 'configs') return `<tr ${shared}><td class="primary-cell"><strong>${esc(row.name)}</strong></td><td><code>${esc(row.code)}</code></td><td>${esc(type)}</td><td class="truncate-cell">${esc(row.description || '—')}</td><td>${row.sort_order}</td><td>${badge(row.active ? 'active' : 'inactive')}</td>${actions}</tr>`;
  if (entity === 'tags') return `<tr ${shared}><td class="primary-cell"><strong>${esc(row.tag_name)}</strong></td><td><code>${esc(row.code)}</code></td><td>${esc(type)}</td><td class="truncate-cell">${esc(row.description || '—')}</td><td>${badge(row.active ? 'active' : 'inactive')}</td>${actions}</tr>`;
  if (entity === 'media') return `<tr ${shared}><td class="primary-cell"><strong>${esc(row.file_name)}</strong><small>${esc(row.file_type)}</small></td><td>${esc(type)}</td><td>${esc(row.related_module || '—')} ${row.related_record_id ? `#${esc(row.related_record_id)}` : ''}</td><td>${row.is_ai_generated ? `<span class="ai-warning">${t('foundation.aiGenerated')}</span>` : ''}${row.is_verified ? `<span class="stage stage--active">${t('foundation.verified')}</span>` : ''}</td><td>${badge(row.active ? 'active' : 'inactive')}</td>${actions}</tr>`;
  return `<tr ${shared}><td class="primary-cell"><strong>${esc(row.prompt_name)}</strong><small>${esc(row.prompt_content).slice(0, 80)}</small></td><td>${esc(type)}</td><td>v${row.version}</td><td>${esc(row.variables || '—')}</td><td>${badge(row.active ? 'active' : 'inactive')}</td>${actions}</tr>`;
}

function applyFoundationFilters() {
  const query = $('#foundation-search').value.trim().toLowerCase();
  const type = $('#foundation-type-filter').value;
  const active = $('#foundation-status-filter').value;
  let visible = 0;
  document.querySelectorAll('[data-foundation-row]').forEach(row => {
    const show = (!query || row.textContent.toLowerCase().includes(query)) && (!type || row.dataset.type === type) && (active === '' || row.dataset.active === active);
    row.hidden = !show;
    if (show) visible += 1;
  });
  $('#foundation-table').classList.toggle('is-hidden', visible === 0);
  $('#foundation-empty').classList.toggle('is-hidden', visible !== 0);
}

function foundationFields(entity, record = {}) {
  const data = state.foundation;
  const select = (name, options, value) => `<select name="${name}" required>${options.map(option => `<option value="${esc(option)}" ${option === value ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select>`;
  const input = (name, value = '', type = 'text', required = false) => `<input name="${name}" type="${type}" value="${esc(value)}" ${required ? 'required' : ''} />`;
  const field = (label, control) => `<label class="field"><span>${t(label)}</span>${control}</label>`;
  const description = field('foundation.description', `<textarea name="description" rows="3">${esc(record.description || '')}</textarea>`);
  const active = `<label class="check-field"><input name="active" type="checkbox" ${record.active !== 0 ? 'checked' : ''} /> <span>${t('status.active')}</span></label>`;
  if (entity === 'configs') return `${field('foundation.type', select('config_type', data.types.configs, record.config_type))}<div class="field-row">${field('foundation.name', input('name', record.name, 'text', true))}${field('foundation.code', input('code', record.code, 'text', true))}</div>${description}${field('foundation.sortOrder', input('sort_order', record.sort_order ?? 0, 'number', true))}${active}`;
  if (entity === 'tags') return `${field('foundation.type', select('tag_type', data.types.tags, record.tag_type))}<div class="field-row">${field('foundation.tagName', input('tag_name', record.tag_name, 'text', true))}${field('foundation.code', input('code', record.code, 'text', true))}</div>${description}${active}`;
  if (entity === 'media') return `${field('foundation.mediaCategory', select('media_category', data.types.media, record.media_category))}<div class="field-row">${field('foundation.fileName', input('file_name', record.file_name, 'text', true))}${field('foundation.fileType', input('file_type', record.file_type, 'text', true))}</div><div class="field-row">${field('foundation.fileUrl', input('file_url', record.file_url))}${field('foundation.storageProvider', input('storage_provider', record.storage_provider))}</div><div class="field-row">${field('foundation.relatedModule', input('related_module', record.related_module))}${field('foundation.relatedRecordId', input('related_record_id', record.related_record_id))}</div>${field('foundation.usageNote', `<textarea name="usage_note" rows="3">${esc(record.usage_note || '')}</textarea>`)}<div class="check-row"><label class="check-field"><input name="is_verified" type="checkbox" ${record.is_verified ? 'checked' : ''} /> ${t('foundation.verified')}</label><label class="check-field"><input name="is_ai_generated" type="checkbox" ${record.is_ai_generated ? 'checked' : ''} /> ${t('foundation.aiGenerated')}</label>${active}</div><p class="ai-notice">${esc(data.aiPreviewNotice)}</p>`;
  return `${field('foundation.type', select('prompt_type', data.types.prompts, record.prompt_type))}<div class="field-row">${field('foundation.promptName', input('prompt_name', record.prompt_name, 'text', true))}${field('foundation.version', input('version', record.version ?? 1, 'number', true))}</div>${field('foundation.promptContent', `<textarea name="prompt_content" rows="8" required>${esc(record.prompt_content || '')}</textarea>`)}${field('foundation.variables', input('variables', record.variables))}${active}`;
}

function openFoundationModal(entity, id = null) {
  const record = id ? state.foundation[foundationMeta[entity].list].find(item => item.id === Number(id)) : {};
  const backdrop = document.createElement('div');
  backdrop.id = 'foundation-modal';
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="command-modal foundation-modal" role="dialog" aria-modal="true" aria-labelledby="foundation-modal-title"><form id="foundation-form" data-entity="${entity}" data-id="${id || ''}"><div class="foundation-modal-head"><div><h2 id="foundation-modal-title">${t(id ? 'foundation.editTitle' : 'foundation.addTitle')}</h2><p>${t(foundationMeta[entity].title)}</p></div><button type="button" class="icon-button" data-action="foundation-close" aria-label="${t('common.close')}">${icon('close')}</button></div><div class="foundation-form">${foundationFields(entity, record)}<p id="foundation-form-error" class="form-error"></p></div><div class="foundation-modal-actions"><button type="button" class="button" data-action="foundation-close">${t('common.cancel')}</button><button type="submit" class="button button--primary">${t('common.save')}</button></div></form></div>`;
  document.body.append(backdrop);
  $('#foundation-form').addEventListener('submit', saveFoundationForm);
}

async function saveFoundationForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form));
  ['active', 'is_verified', 'is_ai_generated'].forEach(name => { if (form.elements[name]) payload[name] = form.elements[name].checked; });
  const id = form.dataset.id;
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    await api(`/api/foundation/${form.dataset.entity}${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    $('#foundation-modal').remove();
    state.foundation = null;
    toast(t('foundation.saved'));
    await navigate('core-foundation', true);
  } catch (error) {
    $('#foundation-form-error').textContent = error.status === 409 ? t('foundation.duplicate') : error.message;
    button.disabled = false;
  }
}

async function renderDebugCenter() {
  const data = state.debugCenter || await api('/api/debug/system');
  state.debugCenter = data;
  const databaseHealthy = data.database.connected && data.database.migration && !data.database.error;
  $('#page').innerHTML = `
    ${pageHeader(t('debug.title'), t('debug.subtitle'), `<button class="button button--primary" data-action="refresh-debug">${icon('debug-center')} ${t('debug.refresh')}</button>`)}
    <section class="metrics-grid">
      ${metricCard(t('debug.http'), data.status === 'ok' ? t('debug.healthy') : t('debug.error'), `${esc(data.http.host)}:${esc(data.http.port)}`, 'globe', data.status === 'ok' ? 'green' : 'gold', true)}
      ${metricCard(t('debug.database'), databaseHealthy ? t('debug.connected') : t('debug.error'), esc(data.database.status), 'building', databaseHealthy ? 'green' : 'gold', true)}
      ${metricCard(t('debug.migration'), data.database.migration ? t('debug.verified') : t('debug.missing'), t('debug.tableCount', { count: data.database.tables.length }), 'check', data.database.migration ? 'green' : 'gold', true)}
      ${metricCard(t('debug.uptime'), `${data.runtime.uptimeSeconds}s`, `${esc(data.runtime.node)} · ${esc(data.deployment.provider)}`, 'sparkles', '', true)}
    </section>
    <article class="panel section-gap">
      ${panelHeader(t('intelligence.libraryStatus'), `${t('debug.migration')}: ${esc(data.database.migrationVersion || '—')}`)}
      <div class="metrics-grid compact-metrics">
        ${[['totalProducts','products'],['proposalReadyProducts','check'],['productsNeedReview','document'],['missingImages','images'],['missingPrice','money'],['missingAiTags','sparkles']].map(([key, iconName]) => metricCard(t(`intelligence.${key}`), data.productIntelligence?.[key] ?? 0, t('intelligence.libraryStatusSub'), iconName, key.startsWith('missing') ? 'gold' : 'green', true)).join('')}
      </div>
    </article>
    <article class="panel section-gap">
      ${panelHeader(t('factory.debugTitle'), t('factory.humanReview'))}
      <div class="metrics-grid compact-metrics">
        ${[['totalDrafts','totalDrafts','document'],['pendingReview','pendingReview','clock'],['appliedDrafts','appliedDrafts','check'],['imageTasks','imageTaskCount','images'],['pendingImageTasks','pendingImageTasks','sparkles'],['failedImageTasks','failedImageTasks','warning']].map(([key,label,iconName]) => metricCard(t(`factory.${label}`), data.aiProductFactory?.[key] ?? 0, t('factory.subtitle'), iconName, key.startsWith('failed') ? 'gold' : 'green', true)).join('')}
      </div>
    </article>
    <article class="panel section-gap">
      ${panelHeader(t('imageGeneration.debugTitle'), `${t('imageGeneration.currentProvider')}: ${esc(data.aiImageGeneration.currentProvider)} · ${t('imageGeneration.model')}: ${esc(data.aiImageGeneration.model)}`)}
      <div class="provider-status-grid debug-provider-grid"><span><small>${t('imageGeneration.available')}</small><strong>${data.aiImageGeneration.providerAvailable}</strong></span><span><small>${t('imageGeneration.apiKey')}</small><strong>${data.aiImageGeneration.apiKeyConfigured}</strong></span><span><small>${t('imageGeneration.maxPerRun')}</small><strong>${data.aiImageGeneration.maxPerRun}</strong></span><span><small>${t('imageGeneration.size')}</small><strong>${esc(data.aiImageGeneration.size)}</strong></span></div>
      <div class="metrics-grid compact-metrics section-gap">
        ${[['totalTasks','totalTasks'],['pendingTasks','pendingTasks'],['runningTasks','runningTasks'],['generatedTasks','generatedTasks'],['failedTasks','failedTasks'],['approvedTasks','approvedTasks'],['appliedTasks','appliedTasks']].map(([key,label]) => metricCard(t(`imageGeneration.${label}`), data.aiImageGeneration[key] ?? 0, t('imageGeneration.providerStatus'), key === 'failedTasks' ? 'warning' : 'images', key === 'failedTasks' ? 'gold' : 'green', true)).join('')}
      </div>
      ${data.aiImageGeneration.lastError ? `<div class="debug-error section-gap"><strong>${t('imageGeneration.lastError')}</strong><pre>${esc(data.aiImageGeneration.lastError)}</pre></div>` : ''}
    </article>
    <article class="panel section-gap">
      ${panelHeader('Opportunity Intelligence Status', `${esc(data.opportunityIntelligence.provider)} · ${esc(data.opportunityIntelligence.engine_version)}`)}
      <div class="provider-status-grid debug-provider-grid"><span><small>Scoring Engine</small><strong>${esc(data.opportunityIntelligence.scoring_engine_status)}</strong></span><span><small>Product Matching</small><strong>${esc(data.opportunityIntelligence.product_matching_status)}</strong></span><span><small>Duplicate Check</small><strong>${esc(data.opportunityIntelligence.duplicate_check_status)}</strong></span><span><small>Last AI Run</small><strong>${esc(data.opportunityIntelligence.last_ai_run_at || 'Not run')}</strong></span></div>
      <div class="metrics-grid compact-metrics section-gap">${[['customers_count','Customers'],['contacts_count','Contacts'],['gaps_open','Open Gaps'],['outreach_drafts_count','Outreach Drafts'],['opportunity_queue_count','Opportunity Queue']].map(([key,label]) => metricCard(label, data.opportunityIntelligence[key] || 0, 'Module 06A', 'briefcase', key === 'gaps_open' ? 'gold' : 'green', true)).join('')}</div>
      ${data.opportunityIntelligence.last_error ? `<div class="debug-error"><strong>Last Error</strong><pre>${esc(data.opportunityIntelligence.last_error)}</pre></div>` : ''}
    </article>
    <article class="panel section-gap">
      ${panelHeader('AI Cost Control', `${esc(data.aiCostControl.providerMode)} · unified budget guard`)}
      <div class="metrics-grid compact-metrics">
        ${metricCard('AI Brain Status', data.aiBusinessBrain?.status || 'not initialized', `${esc(data.aiBusinessBrain?.providers?.active || 'mock')} provider`, 'sparkles', data.aiBusinessBrain?.status === 'ready' ? 'green' : 'gold', true)}
        ${metricCard('AI Executions', data.aiBusinessBrain?.executionLogs || 0, `${data.aiBusinessBrain?.contextSnapshots || 0} context snapshots`, 'document', 'green', true)}
        ${metricCard('Prompt Templates', data.aiBusinessBrain?.promptTemplates || 0, 'Phase 1 prompt foundation', 'briefcase', 'green', true)}
        ${metricCard('Today AI Cost', `$${Number(data.aiCostControl.dashboard.todayAiCost || 0).toFixed(4)}`, 'Daily spend', 'money', 'green', true)}
        ${metricCard('Monthly AI Cost', `$${Number(data.aiCostControl.dashboard.monthlyAiCost || 0).toFixed(4)}`, 'Monthly spend', 'money', 'green', true)}
        ${metricCard('Budget Remaining', `$${Number(data.aiCostControl.budgetRemaining || 0).toFixed(2)}`, 'Effective remaining budget', 'check', 'green', true)}
        ${metricCard('Cost Logs', data.aiCostControl.logsCount || 0, 'All AI operations', 'document', 'green', true)}
        ${metricCard('Cache Records', data.aiCostControl.cacheRecordsCount || 0, 'Active cache entries', 'sparkles', 'green', true)}
        ${metricCard('Blocked Runs', data.aiCostControl.dashboard.blockedRuns || 0, 'Paid runs protected', 'warning', data.aiCostControl.dashboard.blockedRuns ? 'gold' : 'green', true)}
      </div>
      ${data.aiCostControl.lastBlockedRun ? `<div class="debug-error section-gap"><strong>Last Blocked Run</strong><pre>${esc(data.aiCostControl.lastBlockedRun.blocked_reason)}</pre></div>` : ''}
    </article>
    <article class="panel section-gap">
      ${panelHeader('AI Knowledge Center', `Single Active constraint: ${data.knowledgeCenter?.singleActiveValid ? 'healthy' : 'error'}`)}
      <div class="metrics-grid compact-metrics">${metricCard('Active', data.knowledgeCenter?.active || 0, 'Approved revisions', 'check', 'green', true)}${metricCard('Needs Review', data.knowledgeCenter?.needsReview || 0, 'Human approval required', 'clock', data.knowledgeCenter?.needsReview ? 'gold' : 'green', true)}${metricCard('Outdated', data.knowledgeCenter?.outdated || 0, 'Historical revisions', 'document', '', true)}${metricCard('Missing Active', data.knowledgeCenter?.missingActive?.length || 0, 'Draft-only knowledge keys', 'warning', data.knowledgeCenter?.missingActive?.length ? 'gold' : 'green', true)}</div>
    </article>
    <article class="panel section-gap">
      ${panelHeader('Sales Intelligence Part 1', esc(data.salesIntelligence.workflow))}
      <div class="metrics-grid compact-metrics">${[['inquiries','Inquiries'],['analyses','AI Analyses'],['quotes','Quotes'],['orders','Orders'],['openTasks','Open Tasks']].map(([k,l])=>metricCard(l,data.salesIntelligence[k]||0,'Module 07 Part 1','briefcase','green',true)).join('')}</div>
    </article>
    <section class="split-grid section-gap">
      <div class="stack">
        <article class="panel">
          ${panelHeader(t('debug.runtime'), t('debug.runtimeSub'))}
          <div class="table-scroll"><table class="data-table"><tbody>
            <tr><td>${t('debug.environment')}</td><td class="money">${esc(data.runtime.environment)}</td></tr>
            <tr><td>${t('debug.platform')}</td><td class="money">${esc(data.runtime.platform)}</td></tr>
            <tr><td>${t('debug.process')}</td><td class="money">PID ${esc(data.runtime.pid)}</td></tr>
            <tr><td>${t('debug.memory')}</td><td class="money">${esc(data.runtime.memoryMb.rss)} MB RSS · ${esc(data.runtime.memoryMb.heapUsed)} MB heap</td></tr>
            <tr><td>${t('debug.commit')}</td><td class="money"><code>${esc(data.deployment.commit ? data.deployment.commit.slice(0, 12) : '—')}</code></td></tr>
          </tbody></table></div>
        </article>
        <article class="panel">
          ${panelHeader(t('debug.tables'), t('debug.tablesSub', { count: data.database.tables.length }))}
          <div class="debug-table-list">${data.database.tables.map(table => `<code>${esc(table)}</code>`).join('') || `<span>${t('common.none')}</span>`}</div>
        </article>
      </div>
      <article class="panel">
        ${panelHeader(t('debug.events'), t('debug.eventsSub'))}
        ${data.database.error ? `<div class="debug-error"><strong>${t('debug.latestError')}</strong><pre>${esc(data.database.error)}</pre></div>` : ''}
        <div class="debug-events">
          ${data.events.map(event => `<div class="debug-event"><span class="stage stage--${event.level === 'error' ? 'failed' : 'active'}">${esc(event.level)}</span><div><strong>${esc(event.message)}</strong><small>${formatDateTime(event.timestamp)}</small>${event.details ? `<pre>${esc(JSON.stringify(event.details, null, 2))}</pre>` : ''}</div></div>`).join('') || `<div class="empty-state">${t('debug.noEvents')}</div>`}
        </div>
      </article>
    </section>`;
}

async function renderSettings() {
  const data = state.team || await api('/api/team');
  state.team = data;
  const roles = ['Admin', 'Owner', 'Sales', 'Designer', 'VA'];
  const permissions = [
    ['nav.dashboard', 'dashboard'], ['nav.products', 'products'], ['nav.imports', 'imports'], ['nav.images', 'images'], ['nav.proposals', 'proposals'],
    ['nav.cases', 'cases'], ['nav.opportunityIntelligence', 'opportunity-intelligence'], ['nav.crm', 'crm'], ['nav.salesAi', 'sales-ai'], ['nav.contentAi', 'content-ai'], ['nav.coreFoundation', 'core-foundation'], ['nav.debugCenter', 'debug-center'], ['nav.settings', 'settings']
  ];
  $('#page').innerHTML = `
    ${pageHeader(t('settings.title'), t('settings.subtitle'), `<button class="button button--primary" data-action="invite-user">${icon('plus')} ${t('settings.invite')}</button>`)}
    <section class="settings-layout">
      <nav class="panel settings-nav"><button class="is-active">${icon('users')} ${t('settings.teamMembers')}</button><button>${icon('lock')} ${t('settings.rolesPermissions')}</button><button>${icon('building')} ${t('settings.organization')}</button><button>${icon('settings')} ${t('settings.defaults')}</button></nav>
      <div class="stack">
        <article class="panel">
          ${panelHeader(t('settings.teamMembers'), t('settings.teamSub', { count: data.users.length }))}
          <div class="table-scroll"><table class="data-table"><thead><tr><th>${t('fields.teamMember')}</th><th>${t('fields.role')}</th><th>${t('fields.status')}</th><th>${t('fields.lastActive')}</th><th></th></tr></thead><tbody>
            ${data.users.map(user => `<tr><td>${userAvatar(user.initials, '')}<span class="primary-cell" style="display:inline-block;vertical-align:middle;margin-left:7px"><strong>${esc(user.name)}</strong><small>${esc(user.email)}</small></span></td><td><span class="role-chip role-chip--${user.role.toLowerCase()}">${t(`roles.${user.role}`)}</span></td><td>${badge(user.status)}</td><td>${user.last_login_at ? formatDateTime(user.last_login_at) : t('common.notYet')}</td><td><button class="icon-button row-menu" aria-label="${t('common.moreActions')}">${icon('dots')}</button></td></tr>`).join('')}
          </tbody></table></div>
        </article>
        <article class="panel">
          ${panelHeader(t('settings.accessOverview'), t('settings.accessOverviewSub'))}
          <div class="table-scroll"><table class="data-table permission-table"><thead><tr><th>${t('fields.module')}</th>${roles.map(role => `<th>${t(`roles.${role}`)}</th>`).join('')}</tr></thead><tbody>
            ${permissions.map(([labelKey, permission]) => `<tr><td class="money">${t(labelKey)}</td>${roles.map(role => `<td>${data.permissions[role].includes(permission) ? '<span class="permission-check">✓</span>' : '<span class="permission-none">—</span>'}</td>`).join('')}</tr>`).join('')}
          </tbody></table></div>
        </article>
      </div>
    </section>`;
}

function renderRestricted(route) {
  $('#page').innerHTML = `<div class="restricted"><div class="restricted-card"><span class="metric-icon metric-icon--gold">${icon('lock')}</span><h1>${t('access.title')}</h1><p>${t('access.body', { role: t(`roles.${state.user.role}`), module: esc(titleForRoute(route)) })}</p><button class="button button--primary" data-route="dashboard">${t('access.back')}</button></div></div>`;
}

function setupInteractions() {
  document.addEventListener('click', event => {
    const routeTarget = event.target.closest('[data-route]');
    if (routeTarget) {
      event.preventDefault();
      navigate(routeTarget.dataset.route);
      return;
    }
    const actionTarget = event.target.closest('[data-action]');
    if (actionTarget) handleAction(actionTarget.dataset.action, actionTarget);
    if (!event.target.closest('#profile-menu') && !event.target.closest('#profile-button')) $('#profile-menu').classList.add('is-hidden');
    if (!event.target.closest('#language-menu') && !event.target.closest('#language-button')) $('#language-menu').classList.add('is-hidden');
  });
  window.addEventListener('hashchange', () => state.user && navigate(location.hash.slice(1), true));
  $('#sidebar-open').addEventListener('click', () => { $('#sidebar').classList.add('is-open'); $('#sidebar-scrim').classList.add('is-open'); });
  $('#sidebar-close').addEventListener('click', closeSidebar);
  $('#sidebar-scrim').addEventListener('click', closeSidebar);
  $('#profile-button').addEventListener('click', event => {
    event.stopPropagation();
    const menu = $('#profile-menu');
    menu.classList.toggle('is-hidden');
    $('#profile-button').setAttribute('aria-expanded', String(!menu.classList.contains('is-hidden')));
  });
  $('#language-button').addEventListener('click', event => {
    event.stopPropagation();
    $('#profile-menu').classList.add('is-hidden');
    const menu = $('#language-menu');
    menu.classList.toggle('is-hidden');
    $('#language-button').setAttribute('aria-expanded', String(!menu.classList.contains('is-hidden')));
  });
  $('#language-menu').addEventListener('click', event => {
    const option = event.target.closest('[data-language]');
    if (option) changeLanguage(option.dataset.language);
  });
  $('#notifications').addEventListener('click', () => toast(t('shell.allCaughtUp')));
  $('#global-search').addEventListener('click', openSearch);
  $('#search-modal').addEventListener('click', event => { if (event.target === $('#search-modal')) closeSearch(); });
  $('#command-query').addEventListener('input', renderSearchResults);
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
    if (event.key === 'Escape') { closeSearch(); $('#profile-menu').classList.add('is-hidden'); $('#language-menu').classList.add('is-hidden'); }
  });
  document.addEventListener('input', event => {
    const input = event.target.closest('[data-filter-table]');
    if (!input) return;
    const query = input.value.toLowerCase();
    document.querySelectorAll(`#${input.dataset.filterTable} tbody tr`).forEach(row => row.hidden = !row.textContent.toLowerCase().includes(query));
  });
}

async function handleAction(action, node) {
  if (action === 'logout') {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => null);
    exitApp();
  } else if (action === 'sales-back') {
    state.salesInquiry = null; await renderNewInquiry();
  } else if (action === 'open-sales-inquiry') {
    await renderSalesInquiryDetail(node.dataset.id);
  } else if (action === 'analyze-sales-inquiry') {
    await analyzeSalesInquiryUi(node.dataset.id);
  } else if (action === 'generate-sales-quote') {
    await generateSalesQuoteUi(node.dataset.id, false);
  } else if (action === 'generate-freight-quote') {
    await generateSalesQuoteUi(node.dataset.id, true);
  } else if (action === 'convert-sales-order') {
    const result=await api(`/api/sales-inquiries/${node.dataset.id}/convert-order`,{method:'POST',body:'{}'}); toast(`${result.order.order_number} created`); state.salesWorkspace=null; await renderSalesInquiryDetail(node.dataset.id);
  } else if (action === 'ask-customer') {
    navigator.clipboard?.writeText(node.dataset.question); toast(`Suggested question copied: ${node.dataset.question}`);
  } else if (action === 'generate-sales-proposal') {
    toast('Furniture package is ready for review.');
  } else if(action==='open-sales-quote'){await renderQuoteBuilder(node.dataset.id);
  } else if(action==='back-sales-quotes'){state.salesQuote=null;await renderSalesQuotes();
  } else if(action==='save-sales-quote'){await saveQuoteBuilder(node.dataset.id);
  } else if(action==='add-library-quote-item'){openLibraryQuoteItem();
  } else if(action==='add-custom-quote-item'){openCustomQuoteItem();
  } else if(action==='duplicate-quote-item'){const q=state.salesQuote;await api(`/api/sales-quotes/${q.id}`,{method:'PUT',body:JSON.stringify(quoteBuilderPayload())});await api(`/api/sales-quotes/${q.id}/items/duplicate`,{method:'POST',body:JSON.stringify({item_id:Number(node.dataset.id),item_type:node.dataset.itemType})});toast('Line item duplicated');await renderQuoteBuilder(q.id);
  } else if(action==='select-trade-term'){document.querySelectorAll('.trade-term-button').forEach(button=>button.classList.toggle('is-active',button===node));$('[name="trade_term"]').value=node.dataset.term;
  } else if(action==='close-quote-item-modal'){$('#quote-item-modal')?.remove();
  } else if(action==='preview-sales-quote'){await previewCurrentQuote(node.dataset.id);
  } else if(action==='export-sales-quote'){await exportCurrentQuote(node.dataset.id,node.dataset.type);
  } else if(action==='close-pi-preview'){$('#pi-preview')?.remove();
  } else if(action==='sales-message'){await persistQuoteBuilder(node.dataset.id);const m=await api(`/api/sales-quotes/${node.dataset.id}/${node.dataset.type}`);const text=m.message||`${m.subject}\n\n${m.body}`;await navigator.clipboard?.writeText(text);toast(`${node.dataset.type} message copied`);
  } else if(action==='view-quote-version'){const v=await api(`/api/sales-quotes/${node.dataset.id}/versions/${node.dataset.version}`);const current=state.salesQuote;state.salesQuote=v.version.snapshot;previewQuote();state.salesQuote=current;
  } else if (action === 'retry') {
    navigate(state.route, true);
  } else if (action === 'complete-task') {
    node.classList.toggle('is-done');
    toast(node.classList.contains('is-done') ? t('dashboard.taskComplete') : t('dashboard.taskReopened'));
  } else if (action === 'profile') {
    $('#profile-button').click();
  } else if (action === 'my-profile') {
    toast(t('shell.profileNext'));
  } else if (action === 'refresh-debug') {
    state.debugCenter = null;
    await renderDebugCenter();
    toast(t('debug.refreshed'));
  } else if (action === 'knowledge-submit') {
    await knowledgeAction(node.dataset.id, 'submit-review');
  } else if (action === 'knowledge-approve') {
    await knowledgeAction(node.dataset.id, 'approve');
  } else if (action === 'knowledge-request-changes') {
    await knowledgeAction(node.dataset.id, 'request-changes', prompt('Review note') || 'Changes requested');
  } else if (action === 'knowledge-outdated') {
    await knowledgeAction(node.dataset.id, 'mark-outdated');
  } else if (action === 'knowledge-archive') {
    await knowledgeAction(node.dataset.id, 'archive');
  } else if (action === 'knowledge-new-revision') {
    const detail = await api(`/api/knowledge-center/${node.dataset.id}`); await api(`/api/knowledge-center/${node.dataset.id}`, { method: 'PUT', body: JSON.stringify(detail.item) }); toast('New Draft revision created'); await renderKnowledgeDashboard();
  } else if (action === 'knowledge-history') {
    const data = await api(`/api/knowledge-center/${node.dataset.id}/history`); alert(data.history.map(item => `v${item.revision_no} · ${item.status} · ${item.updated_at}`).join('\n'));
  } else if (action === 'knowledge-context-preview') {
    await knowledgeContextPreview();
  } else if (action === 'close-knowledge-preview') {
    $('#knowledge-preview')?.remove();
  } else if (action === 'opportunity-tab') {
    state.opportunityView = node.dataset.tab;
    await renderOpportunityIntelligence();
  } else if (action === 'analyze-discovery-requirement') {
    await runCustomerDiscovery('analyze');
  } else if (action === 'generate-discovery-plan') {
    await runCustomerDiscovery('generate');
  } else if (action === 'create-search-strategy-from-plan') {
    await createSearchStrategyFromPlan();
  } else if (action === 'strategy-view') {
    await viewSearchStrategy(node.dataset.id);
  } else if (action === 'strategy-back') {
    state.searchStrategyDetail=null; state.searchStrategyContextOutdated=false; await renderOpportunityIntelligence();
  } else if (action === 'strategy-filter') {
    state.showArchivedStrategies=node.dataset.filter==='archived'; await renderOpportunityIntelligence();
  } else if (action === 'strategy-generate') {
    await searchStrategyAction(node.dataset.id,'generate',{provider:'rules'});
  } else if (action === 'strategy-estimate') {
    await searchStrategyAction(node.dataset.id,'estimate-search-cost');
  } else if (action === 'strategy-submit') {
    await searchStrategyAction(node.dataset.id,'submit-review');
  } else if (action === 'strategy-approve') {
    await searchStrategyAction(node.dataset.id,'approve');
  } else if (action === 'strategy-request-changes') {
    await searchStrategyAction(node.dataset.id,'request-changes',{review_note:prompt('Review note')||'Changes requested'});
  } else if (action === 'strategy-archive') {
    openStrategyArchiveConfirmation(node.dataset.id);
  } else if (action === 'strategy-archive-cancel') {
    $('#strategy-archive-modal')?.remove();
  } else if (action === 'strategy-archive-confirm') {
    $('#strategy-archive-modal')?.remove(); await searchStrategyAction(node.dataset.id,'archive');
  } else if (action === 'strategy-create-task') {
    await searchStrategyAction(node.dataset.id,'create-search-task');
  } else if (action === 'strategy-history') {
    const result=await api(`/api/search-strategies/${node.dataset.id}/history`);alert(result.history.map(item=>`v${item.revision_no} · ${item.status} · ${item.updated_at}`).join('\n'));
  } else if (action === 'view-search-task') {
    await viewSearchTask(node.dataset.id);
  } else if (action === 'start-search-task') {
    await startSearchTask(node.dataset.id);
  } else if(action==='estimate-execution'){
    await estimateExecution(node.dataset.id);
  } else if(action.startsWith('execution-')){
    await executionAction(node.dataset.id,action.replace('execution-',''));
  } else if (action === 'back-search-tasks') {
    state.searchTaskDetail = null;
    state.searchResultDetail = null;
    state.searchResultEdit = null;
    await renderOpportunityIntelligence();
  } else if (action === 'back-lead-pool') {
    state.searchResultDetail = null;
    state.searchResultEdit = null;
    state.opportunityView = 'lead-pool';
    await renderOpportunityIntelligence();
  } else if (action === 'cancel-search-task') {
    toast('Use Stop inside the controlled Search Execution panel.');
  } else if (action === 'view-search-result') {
    await viewSearchResult(node.dataset.id);
  } else if (action === 'edit-search-result') {
    await editSearchResult(node.dataset.id);
  } else if (action === 'cancel-search-result-edit') {
    state.searchResultEdit = null;
    await renderOpportunityIntelligence();
  } else if (action === 'convert-search-result') {
    await convertSearchResult(node.dataset.id);
  } else if (action === 'discard-search-result') {
    await discardSearchResult(node.dataset.id);
  } else if (action === 'run-lead-ai') {
    await runLeadAi(node.dataset.id);
  } else if (action === 'review-search-result') {
    await reviewSearchResult(node.dataset.id);
  } else if (action === 'show-score-detail') {
    const id = Number(node.dataset.id);
    state.customerScoreDetail = (state.opportunityIntelligence?.customers || []).find(customer => Number(customer.id) === id)
      || (state.opportunityIntelligence?.priority || []).find(customer => Number(customer.id) === id)
      || (state.opportunityIntelligence?.queue || []).find(customer => Number(customer.id) === id)
      || null;
    await renderOpportunityIntelligence();
  } else if (action === 'view-customer') {
    await renderCustomerDetail(node.dataset.id);
  } else if (action === 'back-opportunities') {
    state.customerDetail = null;
    await renderOpportunityIntelligence();
  } else if (action === 'run-customer-ai') {
    await runCustomerAi(node.dataset.id);
  } else if (action === 'run-customer-intelligence') {
    await runCustomerIntelligence(node.dataset.id);
  } else if (action === 'run-selected-customers') {
    await runSelectedCustomers();
  } else if (action === 'save-outreach') {
    await saveOutreach(node.dataset.id);
  } else if (action === 'approve-outreach') {
    await saveOutreach(node.dataset.id, 'approve');
  } else if (action === 'sent-outreach') {
    await saveOutreach(node.dataset.id, 'mark-sent-manually');
  } else if (action === 'accept-lead') {
    await acceptLead(node.dataset.id);
  } else if (action === 'generate-intelligence') {
    await applyIntelligenceGeneration(node.dataset.type);
  } else if (action === 'generate-ai-factory') {
    await generateAiFactory();
  } else if (action === 'save-ai-draft') {
    await saveAiDraft(node.dataset.id);
  } else if (action === 'approve-ai-draft') {
    await reviewAiDraft(node.dataset.id, 'approve');
  } else if (action === 'reject-ai-draft') {
    await reviewAiDraft(node.dataset.id, 'reject');
  } else if (action === 'apply-ai-draft') {
    await applyAiDraft(node.dataset.id);
  } else if (action === 'save-image-task') {
    await saveImageTask(node.dataset.id);
  } else if (action === 'run-image-task') {
    await runImageTask(node.dataset.id);
  } else if (action === 'retry-image-task') {
    await runImageTask(node.dataset.id, true);
  } else if (action === 'run-selected-image-tasks') {
    await runSelectedImageTasks(false);
  } else if (action === 'run-all-image-tasks') {
    await runSelectedImageTasks(true);
  } else if (action === 'cancel-image-task') {
    await cancelImageTask(node.dataset.id);
  } else if (action === 'preview-image-task') {
    previewImageTask(node.dataset.id);
  } else if (action === 'close-image-preview') {
    $('#generated-image-preview')?.remove();
  } else if (action === 'approve-image-task') {
    await reviewImageTask(node.dataset.id, 'approve');
  } else if (action === 'reject-image-task') {
    await reviewImageTask(node.dataset.id, 'reject');
  } else if (action === 'apply-image-task') {
    await applyImageTask(node.dataset.id);
  } else if (action === 'add-product-image') {
    openProductImageModal(null, node.dataset.ai === 'true');
  } else if (action === 'edit-product-image') {
    openProductImageModal(node.dataset.id);
  } else if (action === 'mark-main-image') {
    await markMainImage(node.dataset.id);
  } else if (action === 'product-image-close') {
    $('#product-image-modal')?.remove();
  } else if (action === 'foundation-tab') {
    state.foundationTab = node.dataset.tab;
    await renderFoundation();
  } else if (action === 'foundation-add') {
    openFoundationModal(node.dataset.entity);
  } else if (action === 'foundation-edit') {
    openFoundationModal(node.dataset.entity, node.dataset.id);
  } else if (action === 'foundation-close') {
    $('#foundation-modal')?.remove();
  } else if (action === 'foundation-toggle') {
    node.disabled = true;
    try {
      await api(`/api/foundation/${node.dataset.entity}/${node.dataset.id}`, { method: 'PUT', body: JSON.stringify({ active: node.dataset.active !== '1' }) });
      state.foundation = null;
      toast(t('foundation.saved'));
      await navigate('core-foundation', true);
    } catch (error) {
      toast(error.message);
      node.disabled = false;
    }
  } else if (action === 'add-product') {
    openProductModal();
  } else if(action==='open-library-product'){
    await renderLibraryProductDetail(node.dataset.id,'general');
  } else if(action==='library-product-tab'){
    await renderLibraryProductDetail(node.dataset.id,node.dataset.tab);
  } else if(action==='library-page'){
    productLibraryPage=Math.max(1,Number(node.dataset.page));await renderProductLibraryProducts();
  } else if(action==='delete-library-product'){
    if(!window.confirm(`Delete ${node.dataset.name}? Historical quotes and orders will be preserved.`))return;const result=await api(`/api/products/${node.dataset.id}`,{method:'DELETE'});toast(result.message||'Product deleted');state.products=null;await navigate('product-library-products',true);
  } else if(action==='library-edit-tag'){
    const tag_name=window.prompt('Tag name',node.dataset.name);if(!tag_name)return;const code=window.prompt('Tag code',node.dataset.code);if(!code)return;const tag_type=window.prompt('Tag group',node.dataset.group);if(!tag_type)return;const sort_order=Number(window.prompt('Sort order',node.dataset.sort)||0);await api(`/api/product-tags/${node.dataset.id}`,{method:'PUT',body:JSON.stringify({tag_name,code,tag_type,sort_order})});state.products=null;await renderProductLibraryTags();
  } else if(action==='library-toggle-tag'){
    await api(`/api/product-tags/${node.dataset.id}`,{method:'PUT',body:JSON.stringify({active:node.dataset.active!=='1'})});state.products=null;await renderProductLibraryTags();
  } else if(action==='library-delete-tag'){
    if(!window.confirm('Delete this unused tag?'))return;await api(`/api/product-tags/${node.dataset.id}`,{method:'DELETE'});state.products=null;await renderProductLibraryTags();
  } else if(action==='library-edit-category'){
    const name=window.prompt('Category name',node.dataset.name);if(!name)return;const slug=window.prompt('Category slug',node.dataset.slug);if(!slug)return;const sort_order=Number(window.prompt('Sort order',node.dataset.sort)||0);await api(`/api/product-categories/${node.dataset.id}`,{method:'PUT',body:JSON.stringify({name,slug,sort_order})});state.products=null;await renderProductLibraryCategories();
  } else if(action==='library-toggle-category'){
    await api(`/api/product-categories/${node.dataset.id}`,{method:'PUT',body:JSON.stringify({active:node.dataset.active!=='1'})});state.products=null;await renderProductLibraryCategories();
  } else if(action==='library-delete-category'){
    if(!window.confirm('Delete this unused category?'))return;await api(`/api/product-categories/${node.dataset.id}`,{method:'DELETE'});state.products=null;await renderProductLibraryCategories();
  } else if(action==='library-edit-attribute'){
    const [data,categories]=await Promise.all([api('/api/product-attributes'),api('/api/product-categories')]),attribute=data.attributes.find(item=>item.id===Number(node.dataset.id));if(!attribute)return;const name=window.prompt('Attribute name',attribute.name);if(!name)return;const code=window.prompt('Attribute code',attribute.code);if(!code)return;const data_type=window.prompt('Type: Text, Number, Select, Multi-select, Color, Image, or Boolean',attribute.data_type);if(!data_type)return;const options=window.prompt('Options, comma separated',attribute.options.map(option=>option.option_value).join(', '));if(options===null)return;const categoryHelp=categories.categories.map(category=>`${category.id}=${category.name}`).join(', '),categoryInput=window.prompt(`Category IDs, comma separated; blank means all. ${categoryHelp}`,attribute.category_ids.join(','));if(categoryInput===null)return;const display=window.prompt('Display in: library, website, quote, pi, internal (comma separated)',[['library',attribute.show_in_library],['website',attribute.show_on_website],['quote',attribute.show_in_quote],['pi',attribute.show_in_pi],['internal',attribute.internal_only]].filter(([,enabled])=>enabled).map(([key])=>key).join(','));if(display===null)return;const flags=display.toLowerCase().split(',').map(value=>value.trim());await api(`/api/product-attributes/${node.dataset.id}`,{method:'PUT',body:JSON.stringify({name,code,data_type,category_ids:categoryInput.split(',').map(Number).filter(Boolean),options:options.split(',').map(value=>value.trim()).filter(Boolean),show_in_library:flags.includes('library'),show_on_website:flags.includes('website'),show_in_quote:flags.includes('quote'),show_in_pi:flags.includes('pi'),internal_only:flags.includes('internal')})});await renderProductLibraryAttributes();
  } else if(action==='library-delete-attribute'){
    if(!window.confirm('Delete this unused attribute?'))return;await api(`/api/product-attributes/${node.dataset.id}`,{method:'DELETE'});await renderProductLibraryAttributes();
  } else if(action==='library-edit-variant'){
    const variant_name=window.prompt('Variant name',node.dataset.name);if(!variant_name)return;const variant_sku=window.prompt('Variant SKU',node.dataset.sku)||'';const dimensions=window.prompt('Dimensions',node.dataset.dimensions)||'';const reference_price=window.prompt('Reference price',node.dataset.price);if(reference_price===null)return;const cost_price=window.prompt('Cost price',node.dataset.cost);if(cost_price===null)return;await api(`/api/products/${node.dataset.productId}/variants/${node.dataset.id}`,{method:'PUT',body:JSON.stringify({variant_name,variant_sku,dimensions,reference_price,cost_price,status:node.dataset.status})});state.route==='product-library-variants'?await renderProductLibraryVariants():await renderLibraryProductDetail(node.dataset.productId,'variants');
  } else if(action==='library-delete-variant'){
    if(!window.confirm('Delete this variant?'))return;await api(`/api/products/${node.dataset.productId}/variants/${node.dataset.id}`,{method:'DELETE'});state.route==='product-library-variants'?await renderProductLibraryVariants():await renderLibraryProductDetail(node.dataset.productId,'variants');
  } else if(action==='manage-product-foundation'){
    await openProductFoundationManager();
  } else if(action==='close-product-foundation-manager'){
    $('#product-foundation-manager')?.remove();
  } else if(action==='edit-product-category'){
    const name=window.prompt('Category name',node.dataset.name);if(!name)return;const slug=window.prompt('Category slug',node.dataset.slug);if(!slug)return;await api(`/api/product-categories/${node.dataset.id}`,{method:'PUT',body:JSON.stringify({name,slug})});$('#product-foundation-manager')?.remove();state.products=null;await openProductFoundationManager();
  } else if(action==='delete-product-category'){
    if(!window.confirm('Delete this unused category?'))return;await api(`/api/product-categories/${node.dataset.id}`,{method:'DELETE'});$('#product-foundation-manager')?.remove();state.products=null;await openProductFoundationManager();
  } else if(action==='edit-product-attribute'){
    const name=window.prompt('Attribute name',node.dataset.name);if(!name)return;const code=window.prompt('Attribute code',node.dataset.code);if(!code)return;await api(`/api/product-attributes/${node.dataset.id}`,{method:'PUT',body:JSON.stringify({name,code})});$('#product-foundation-manager')?.remove();await openProductFoundationManager();
  } else if(action==='delete-product-attribute'){
    if(!window.confirm('Delete this unused attribute?'))return;await api(`/api/product-attributes/${node.dataset.id}`,{method:'DELETE'});$('#product-foundation-manager')?.remove();await openProductFoundationManager();
  } else if (action === 'view-product') {
    await renderProductDetail(node.dataset.id);
  } else if (action === 'edit-product') {
    openProductModal(node.dataset.id);
  } else if (action === 'product-close') {
    $('#product-modal')?.remove();
  } else if (action === 'generate-sku') {
    const form = node.closest('form');
    form.elements.sku.value = productSkuPreview(form.elements.category_id.value, form.elements.sku_style.value, form.dataset.id);
  } else if (action === 'knowledge-tab') {
    document.querySelectorAll('[data-action="knowledge-tab"]').forEach(tab => tab.classList.toggle('is-active', tab === node));
    document.querySelectorAll('[data-knowledge-pane]').forEach(pane => pane.classList.toggle('is-hidden', pane.dataset.knowledgePane !== node.dataset.tab));
  } else if (action === 'clear-product-filters') {
    node.closest('.filter-bar').querySelectorAll('input,select').forEach(control => { control.value = ''; });
    applyProductFilters();
  } else if(action==='open-import-batch'){
    await renderImports(Number(node.dataset.id));
  } else if(action==='save-import-draft'){
    await saveImportDraft(Number(node.dataset.id));
  } else if(action==='approve-import-draft'){
    await reviewImportDraft(Number(node.dataset.id),'approve');
  } else if(action==='reject-import-draft'){
    await reviewImportDraft(Number(node.dataset.id),'reject');
  } else if(action==='approve-selected-imports'){
    await approveSelectedImports();
  } else if(action==='split-import-draft'){
    await splitImportDraft(Number(node.dataset.id));
  } else if(action==='merge-selected-imports'){
    await mergeSelectedImports();
  } else if(action==='filter-import-drafts'){
    document.querySelectorAll('[data-import-draft]').forEach(card=>card.hidden=node.dataset.status!=='all'&&card.querySelector('.status-badge')?.textContent.trim()!==node.dataset.status);
  } else if(action==='preview-price-recalculation'){
    const result=await api('/api/pricing/recalculate/preview');const target=$('#pricing-preview');target.innerHTML=`<h3>Recalculation Preview</h3><div class="table-scroll"><table class="data-table"><thead><tr><th>Product / Variant</th><th>Old</th><th>New</th><th>Difference</th><th>Rule</th></tr></thead><tbody>${result.preview.map(row=>`<tr><td>${esc(row.product_name)} · ${esc(row.variant_name)}</td><td>${row.old_reference_price??'—'}</td><td>${row.new_reference_price??'Needs Review'}</td><td>${row.difference??'—'}</td><td>${esc(row.rule_applied||'No rule')}${row.manual_override?' · Manual Override':''}</td></tr>`).join('')}</tbody></table></div><button class="button button--primary" data-action="apply-price-recalculation" data-ids="${result.preview.map(row=>row.variant_id).join(',')}">Confirm Recalculate</button>`;
  } else if(action==='apply-price-recalculation'){
    if(!window.confirm('Apply the previewed reference prices? Manual overrides will remain unchanged.'))return;await api('/api/pricing/recalculate/apply',{method:'POST',body:JSON.stringify({confirm:true,variant_ids:node.dataset.ids.split(',').map(Number)})});toast('Reference prices recalculated.');await renderImports(state.imports?.batch?.id||null);
  } else if(action==='clear-product-demo-data'){
    if(!window.confirm('Clear all current Product Library and import trial data? Categories, attribute templates, master data, price rules, users, settings, Quote and PI templates will be kept.'))return;
    const confirmation=window.prompt('Type CLEAR DEMO DATA to confirm');if(confirmation!=='CLEAR DEMO DATA')return;
    const result=await api('/api/products/clear-demo-data',{method:'POST',body:JSON.stringify({confirm:confirmation})});toast(result.message);state.products=null;state.imports=null;await renderImports();
  } else {
    const messages = {
      'browse-file': t('imports.integrationReady'),
      'new-proposal': t('proposals.editorReady'),
      'add-case': t('cases.nextBuild'),
      'add-opportunity': t('crm.nextBuild'),
      'ai-tool': t('salesAi.integrationReady'),
      'create-content': t('contentAi.integrationReady'),
      'invite-user': t('settings.inviteReady')
    };
    toast(messages[action] || t('common.actionNoted'));
  }
}

function openSearch() {
  $('#search-modal').classList.remove('is-hidden');
  $('#command-query').value = '';
  renderSearchResults();
  setTimeout(() => $('#command-query').focus(), 20);
}

function closeSearch() {
  $('#search-modal').classList.add('is-hidden');
}

function renderSearchResults() {
  const query = $('#command-query').value.trim().toLowerCase();
  const accessible = uniqueNavItems.filter(item => allowed(item.route) && (!query || t(item.labelKey).toLowerCase().includes(query)));
  $('#command-results').innerHTML = `<div class="command-group-label">${t('common.pages')}</div>${accessible.map((item, index) => `<div class="command-result ${index === 0 ? 'is-active' : ''}" data-route="${item.route}"><span class="metric-icon">${icon(item.route)}</span><span>${t(item.labelKey)}</span><small>${t(item.groupKey)}</small></div>`).join('') || `<div class="empty-state" style="padding:25px">${t('common.noMatches')}</div>`}`;
}

async function bootstrap() {
  setupStaticIcons();
  try { demoMode = Boolean((await api('/api/config')).demo_mode); } catch { demoMode = false; }
  updateStaticLocale();
  setupLogin();
  setupInteractions();
  try {
    const data = await api('/api/auth/me');
    state.user = data.user;
    enterApp();
  } catch {
    $('#login-view').classList.remove('is-hidden');
  }
}

bootstrap();

// Module 07 final PI presentation: keep the workflow, replace only the customer-facing item table.
const legacyPiPreview=previewQuote;
previewQuote=function(){
  legacyPiPreview();
  const q=state.salesQuote,modal=$('#pi-preview'),table=modal?.querySelector('.pi-global-table');if(!table)return;
  const format=value=>`${q.currency} ${new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0))}`;
  const sku=item=>item.variant_sku||item.variant_snapshot?.sku||item.sku||'CUSTOM';
  const variantSize=item=>item.variant_snapshot?.dimensions||item.variant_dimensions||item.size||item.size_dimensions||'TBC';
  const finishMaterial=item=>[item.display_finish||item.finish,item.display_material||item.materials].filter(Boolean).join(' / ')||'TBC';
  const finishColor=item=>[item.display_finish||item.finish,item.display_color||item.color].filter(Boolean).join(' / ')||'TBC';
  table.classList.add('pi-product-table-final');
  table.innerHTML=`<thead><tr><th>Image</th><th>SKU / Model</th><th>Product Name</th><th>Variant Size</th><th>Finish / Material</th><th>Quantity</th><th>Unit Price</th><th>Total Price</th></tr></thead><tbody>${q.all_items.map(item=>`<tr><td class="pi-product-image">${item.image_url?`<img src="${esc(item.image_url)}" alt="${esc(item.name)}">`:'<span>Reference image pending</span>'}</td><td>${esc(sku(item))}</td><td class="pi-short-description"><strong>${esc(item.name)}</strong>${item.customer_remark?`<small>${esc(item.customer_remark)}</small>`:''}</td><td>${esc(variantSize(item))}</td><td>${esc(finishMaterial(item))}</td><td>${item.quantity}</td><td>${format(item.unit_price)}</td><td><strong>${format(item.line_total)}</strong></td></tr>`).join('')}</tbody>`;
  const productSection=table.closest('.pi-document-section');
  if(productSection)productSection.insertAdjacentHTML('afterend',`<section class="pi-two-column pi-variant-finish"><div class="pi-document-section"><h2>Variant Breakdown</h2><table class="pi-compact-table"><thead><tr><th>Product</th><th>Variant / Size</th><th>SKU</th><th>Qty</th><th>Total</th></tr></thead><tbody>${q.all_items.map(item=>`<tr><td>${esc(item.name)}</td><td>${esc(variantSize(item))}</td><td>${esc(sku(item))}</td><td>${item.quantity}</td><td>${format(item.line_total)}</td></tr>`).join('')}</tbody></table></div><div class="pi-document-section"><h2>Finish / Color Section</h2><table class="pi-compact-table"><thead><tr><th>Product</th><th>Material</th><th>Finish / Color</th><th>Remark</th></tr></thead><tbody>${q.all_items.map(item=>`<tr><td>${esc(item.name)}</td><td>${esc(item.display_material||item.materials||'TBC')}</td><td>${item.swatch_image_url?`<span class="pi-swatch"><img src="${esc(item.swatch_image_url)}" alt="Approved finish color swatch">${esc(finishColor(item))}</span>`:esc(finishColor(item))}</td><td>${esc(item.customer_remark||item.remark||'')}</td></tr>`).join('')}</tbody></table></div></section>`);
  const packingHeading=[...modal.querySelectorAll('h2')].find(node=>node.textContent.includes('Packing / Logistics'));if(packingHeading)packingHeading.textContent='Packing Summary';
  const commercial=modal.querySelector('.pi-commercial');commercial.innerHTML=`<h2>Commercial Summary</h2><p>Product Subtotal <b>${format(q.summary.product_subtotal)}</b></p><p>Discount <b>-${format(q.summary.discount)}</b></p><p>Freight Cost <b>${q.summary.freight_cost==null?'Freight cost to be quoted separately.':format(q.summary.freight_cost)}</b></p><p>Other Charges <b>${format(q.summary.other_charges)}</b></p><p class="pi-grand">Grand Total <b>${format(q.summary.grand_total)}</b></p><p>Deposit Amount (${Number(q.deposit_percent)}%) <b>${format(q.summary.deposit_amount)}</b></p><p>Balance Amount <b>${format(q.summary.balance_amount)}</b></p>`;
  const footer=document.createElement('footer');footer.className='pi-professional-footer';footer.innerHTML='<strong>Restaurant Setup Pro</strong><span>Commercial Furniture Solutions</span><span>www.restaurantsetuppro.com</span><span>Page 1 of 1</span>';modal.querySelector('.pi-global').append(footer);
};

openLibraryQuoteItem=function(){const q=state.salesQuote;const modal=document.createElement('div');modal.className='modal-backdrop';modal.id='quote-item-modal';const options=q.library_options.flatMap(product=>product.variants.length?product.variants.map(variant=>`<option value="${product.id}|${variant.id}">${esc(product.name)} · ${esc(variant.variant_name)} · ${esc(variant.dimensions||'')} · ${variant.reference_price==null?'Request Quote':quoteMoney(variant.reference_price,q.currency)}</option>`):[`<option value="${product.id}|"></option>`]).join('');modal.innerHTML=`<div class="modal-card small-modal"><button class="icon-button modal-close" data-action="close-quote-item-modal">${icon('close')}</button><h2>Add Product from Library</h2><p>Select a product variant when available.</p><form id="library-item-form"><label class="field"><span>Product / Variant</span><select name="selection" required>${options}</select></label><div class="form-actions"><button class="button button--primary">Add Product</button></div></form></div>`;document.body.append(modal);$('#library-item-form').addEventListener('submit',async event=>{event.preventDefault();const [product_id,variant_id]=event.currentTarget.elements.selection.value.split('|');await api(`/api/sales-quotes/${q.id}/items/library`,{method:'POST',body:JSON.stringify({product_id:Number(product_id),variant_id:variant_id?Number(variant_id):null})});modal.remove();await renderQuoteBuilder(q.id)})};
