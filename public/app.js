import { getLocale, getSupportedLocales, localeForIntl, setLocale, t } from './i18n.js';

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
  customerDetail: null
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
  { groupKey: 'common.workspace', route: 'dashboard', labelKey: 'nav.dashboard' },
  { groupKey: 'common.workspace', route: 'products', labelKey: 'nav.products' },
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

const roleEmails = {
  Admin: 'admin@rspro.ai', Owner: 'owner@rspro.ai', Sales: 'sales@rspro.ai', Designer: 'designer@rspro.ai', VA: 'va@rspro.ai'
};

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[char]);
const money = value => new Intl.NumberFormat(localeForIntl(), { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value || 0));
const shortMoney = value => Number(value) >= 1_000_000 ? `$${(Number(value) / 1_000_000).toFixed(2)}M` : `$${Math.round(Number(value) / 1000)}K`;
const titleForRoute = route => t(navItems.find(item => item.route === route)?.labelKey || 'nav.dashboard');
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
  navigate(requested && navItems.some(item => item.route === requested) ? requested : 'dashboard', true);
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
  let lastGroup = '';
  $('#main-nav').innerHTML = navItems.filter(item => allowed(item.route)).map(item => {
    const group = item.groupKey !== lastGroup ? `<div class="nav-label">${t(item.groupKey)}</div>` : '';
    lastGroup = item.groupKey;
    return `${group}<a class="nav-item" href="#${item.route}" data-route="${item.route}">${icon(item.route)}<span>${t(item.labelKey)}</span>${item.badge ? `<em class="nav-badge">${item.badge}</em>` : ''}</a>`;
  }).join('');
  $('#sidebar-user').innerHTML = `<span class="avatar">${esc(state.user.initials)}</span><span class="sidebar-user-copy"><strong>${esc(state.user.name)}</strong><small>${t(`roles.${state.user.role}`)} · ${t('common.workspace')}</small></span><button class="icon-button" data-action="profile" aria-label="${t('shell.accountMenu')}">${icon('dots')}</button>`;
  $('#profile-button').innerHTML = `<span class="avatar">${esc(state.user.initials)}</span>${icon('down')}`;
  $('#profile-menu').innerHTML = `<div class="profile-summary"><strong>${esc(state.user.name)}</strong><small>${esc(state.user.email)} · ${t(`roles.${state.user.role}`)}</small></div><button data-action="my-profile">${icon('users')} ${t('shell.myProfile')}</button><button data-action="logout">${icon('logout')} ${t('shell.signOut')}</button>`;
}

function closeSidebar() {
  $('#sidebar').classList.remove('is-open');
  $('#sidebar-scrim').classList.remove('is-open');
}

async function navigate(route, replace = false) {
  const known = navItems.some(item => item.route === route);
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
  const data = state.knowledgeDashboard || await api('/api/knowledge/dashboard');
  state.knowledgeDashboard = data;
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
    </section>`;
}

async function renderProducts() {
  const data = state.products || await api('/api/products');
  state.products = data;
  $('#page').innerHTML = `
    ${pageHeader(t('products.title'), t('products.subtitle'), `<button class="button button--primary" data-action="add-product">${icon('plus')} ${t('products.add')}</button>`)}
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
  const categoryCode = state.products.skuRules.categoryCodes[category?.name];
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

function openProductModal(id = null) {
  const product = id ? state.products.products.find(item => item.id === Number(id)) : {};
  const groups = ['Store Type Tags', 'Style Tags', 'Business Tags'];
  const backdrop = document.createElement('div');
  backdrop.id = 'product-modal';
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="command-modal foundation-modal product-modal" role="dialog" aria-modal="true"><form id="product-form" data-id="${id || ''}"><div class="foundation-modal-head"><div><h2>${t(id ? 'products.editTitle' : 'products.addTitle')}</h2><p>${t('products.skuHelp')}</p></div><button type="button" class="icon-button" data-action="product-close" aria-label="${t('common.close')}">${icon('close')}</button></div><div class="foundation-form">
    <div class="field-row"><label class="field"><span>${t('fields.productName')}</span><input name="name" value="${esc(product.name || '')}" required /></label><label class="field"><span>${t('fields.category')}</span><select name="category_id" required>${state.products.categories.filter(item => state.products.skuRules.categoryCodes[item.name]).map(item => `<option value="${item.id}" ${item.id === product.category_id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label></div>
    <div class="field-row"><label class="field"><span>${t('intelligence.subCategory')}</span><input name="sub_category" value="${esc(product.sub_category || '')}" /></label><label class="field"><span>${t('intelligence.productSeries')}</span><input name="product_series" value="${esc(product.product_series || '')}" /></label></div>
    <div class="field-row"><label class="field"><span>${t('products.skuStyle')}</span><select name="sku_style">${Object.keys(state.products.skuRules.styleCodes).map(style => `<option ${product.tag_names?.includes(style) ? 'selected' : ''}>${esc(style)}</option>`).join('')}</select></label><label class="field"><span>${t('fields.sku')}</span><span class="sku-control"><input name="sku" value="${esc(product.sku || '')}" placeholder="${t('products.autoGenerated')}" /><button type="button" class="button button--compact" data-action="generate-sku">${t('products.generate')}</button></span></label></div>
    <label class="field"><span>${t('products.summary')}</span><textarea name="summary" rows="2">${esc(product.summary || '')}</textarea></label>
    <div class="field-row"><label class="field"><span>${t('fields.material')}</span><input name="materials" value="${esc(product.materials || '')}" /></label><label class="field"><span>${t('fields.size')}</span><input name="size" value="${esc(product.size || '')}" /></label></div>
    <div class="field-row"><label class="field"><span>${t('intelligence.color')}</span><input name="color" value="${esc(product.color || '')}" /></label><label class="field"><span>${t('intelligence.finish')}</span><input name="finish" value="${esc(product.finish || '')}" /></label></div>
    <div class="field-row"><label class="field"><span>${t('intelligence.budgetLevel')}</span><select name="budget_level"><option value="">${t('common.none')}</option>${state.products.intelligenceOptions.budgetLevels.map(level => `<option ${level === product.budget_level ? 'selected' : ''}>${esc(level)}</option>`).join('')}</select></label><label class="field"><span>${t('intelligence.recommendedUsage')}</span><input name="recommended_usage" value="${esc(product.recommended_usage || '')}" /></label></div>
    <div class="field-row"><label class="field"><span>${t('fields.priceRange')}</span><input name="price_range" value="${esc(product.price_range || '')}" /></label><label class="field"><span>${t('fields.status')}</span><select name="status">${['draft','review','approved','archived'].map(status => `<option value="${status}" ${status === product.status ? 'selected' : ''}>${esc(statusLabel(status))}</option>`).join('')}</select></label></div>
    <div class="field-row"><label class="field"><span>${t('fields.leadTime')}</span><input name="lead_time_days" type="number" min="0" value="${esc(product.lead_time_days || '')}" /></label><label class="field"><span>${t('fields.moq')}</span><input name="moq" type="number" min="0" value="${esc(product.moq || '')}" /></label></div>
    <div class="tag-selector">${groups.map(group => `<fieldset><legend>${esc(group)}</legend><div>${state.products.tags.filter(tag => tag.tag_type === group).map(tag => `<label><input type="checkbox" name="tag_ids" value="${tag.id}" ${product.tag_ids?.includes(tag.id) ? 'checked' : ''} /><span>${esc(tag.tag_name)}</span></label>`).join('')}</div></fieldset>`).join('')}</div>
    <p id="product-form-error" class="form-error"></p></div><div class="foundation-modal-actions"><button type="button" class="button" data-action="product-close">${t('common.cancel')}</button><button type="submit" class="button button--primary">${t('common.save')}</button></div></form></div>`;
  document.body.append(backdrop);
  $('#product-form').addEventListener('submit', saveProductForm);
  if (!id) $('#product-form [data-action="generate-sku"]').click();
}

async function saveProductForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form));
  payload.tag_ids = [...form.querySelectorAll('[name="tag_ids"]:checked')].map(input => Number(input.value));
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    await api(`/api/products${form.dataset.id ? `/${form.dataset.id}` : ''}`, { method: form.dataset.id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    $('#product-modal').remove();
    state.products = null;
    toast(t('products.saved'));
    await navigate('products', true);
  } catch (error) {
    $('#product-form-error').textContent = error.status === 409 ? t('products.duplicateSku') : error.message;
    button.disabled = false;
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
    await renderProductDetail(form.dataset.productId);
  } catch (error) {
    $('#product-image-error').textContent = error.message;
  }
}

async function markMainImage(mediaId) {
  const productId = state.productDetail.product.id;
  await api(`/api/products/${productId}/images/${mediaId}`, { method: 'PUT', body: JSON.stringify({ mark_main: true }) });
  toast(t('intelligence.imageSaved'));
  await renderProductDetail(productId);
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

function opportunityTabs(active, counts = {}) {
  const tabs = [
    ['dashboard', 'Opportunity Dashboard'], ['import', 'Import Customers'], ['customers', `Customer List (${counts.customers || 0})`],
    ['queue', `AI Opportunity Queue (${counts.queue || 0})`], ['outreach', 'Outreach Drafts'], ['handoff', `Sales Handoff (${counts.handoff || 0})`]
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
  return `<div class="table-scroll"><table class="data-table" id="opportunity-customer-table"><thead><tr>
    ${capabilities.canRunAi && !queue ? '<th></th>' : ''}<th>Customer</th><th>Country / City</th><th>Business Type</th><th>Score</th><th>Grade</th><th>Recommended Products</th><th>Next Action</th><th>Contact</th><th>Assigned Sales</th><th></th>
    </tr></thead><tbody>${customers.map(customer => `<tr>
      ${capabilities.canRunAi && !queue ? `<td><input type="checkbox" data-customer-select value="${customer.id}" aria-label="Select ${esc(customer.company_name)}" /></td>` : ''}
      <td class="primary-cell"><strong>${esc(customer.brand_name || customer.company_name)}</strong><small>${esc(customer.source)} · ${esc(customer.opportunity_status)}</small></td>
      <td>${esc([customer.country, customer.city].filter(Boolean).join(' / ') || '—')}</td><td>${esc(customer.business_type || '—')}</td>
      <td>${Number(customer.opportunity_score || 0)}</td><td>${badge(customer.opportunity_grade)}</td>
      <td>${esc(customer.recommended_products || customer.recommended_categories || '—')}</td><td>${esc(customer.next_action || 'Run AI to generate')}</td>
      <td>${esc(customer.email || customer.whatsapp || customer.website || customer.decision_maker || 'Missing')}</td><td>${esc(customer.assigned_sales_name || 'Unassigned')}</td>
      <td><button class="button button--compact" data-action="view-customer" data-id="${customer.id}">Open</button></td>
    </tr>`).join('') || '<tr><td colspan="11"><div class="empty-state">No customers yet.</div></td></tr>'}</tbody></table></div>`;
}

function renderOpportunityPane(data) {
  const view = state.opportunityView || 'dashboard';
  const counts = { customers: data.customers.length, queue: data.queue.length, handoff: data.handoff.length };
  const capabilities = data.capabilities;
  const sourceOptions = data.sources.map(source => `<option>${esc(source)}</option>`).join('');
  if (view === 'dashboard') return `${opportunityMetricsCards(data.metrics)}
    <section class="detail-grid section-gap"><article class="panel">${panelHeader('Today’s Priority Queue', 'Highest-value A+/A opportunities ready for human action')}${customerTable(data.queue.slice(0, 5), capabilities, true)}</article>
    <article class="panel"><div class="panel-header"><div class="panel-title"><h2>AI Pipeline Status</h2><p>Rule provider is active; external AI remains optional.</p></div>${badge(data.debug.scoring_engine_status)}</div>
      <div class="debug-list"><div><span>Product Matching</span><strong>${esc(data.debug.product_matching_status)}</strong></div><div><span>Duplicate Check</span><strong>${esc(data.debug.duplicate_check_status)}</strong></div><div><span>Open Data Gaps</span><strong>${data.debug.gaps_open}</strong></div><div><span>Last AI Run</span><strong>${esc(data.debug.last_ai_run_at || 'Not run')}</strong></div></div></article></section>`;
  if (view === 'import') return `<section class="opportunity-import-grid">
    <form id="customer-manual-form" class="panel opportunity-form"><h2>Manual Customer</h2><p>Create one sourced customer record.</p>
      <div class="foundation-form"><label class="field"><span>Company Name</span><input name="company_name" required /></label><label class="field"><span>Business Type</span><input name="business_type" placeholder="Coffee Shop" /></label>
      <label class="field"><span>Country</span><input name="country" /></label><label class="field"><span>City</span><input name="city" /></label><label class="field"><span>Email</span><input name="email" type="email" /></label>
      <label class="field"><span>Website</span><input name="website" /></label><label class="field"><span>Store Count</span><input name="store_count" type="number" min="0" /></label>
      <label class="field"><span>Source</span><select name="source">${sourceOptions}</select></label></div><button class="button button--primary" type="submit">Import Customer</button></form>
    <form id="customer-csv-form" class="panel opportunity-form"><h2>CSV Paste Import</h2><p>Header example: company_name,business_type,city,country,email,website</p><label class="field"><span>Source</span><select name="source"><option>CSV</option>${sourceOptions}</select></label><label class="field"><span>CSV Data</span><textarea name="csv" rows="10" required></textarea></label><button class="button button--primary" type="submit">Import CSV</button></form>
    <form id="customer-text-form" class="panel opportunity-form"><h2>Batch Text Import</h2><p>One line: Company | Type | City | Country | Email | Website</p><label class="field"><span>Source</span><select name="source">${sourceOptions}</select></label><label class="field"><span>Customer Lines</span><textarea name="text" rows="10" required></textarea></label><button class="button button--primary" type="submit">Import Text</button></form>
    </section>`;
  if (view === 'customers') return `<article class="panel">${panelHeader('Customer List', 'Clean, score, and route customer records through one governed workflow')}
    <div class="filter-bar"><label class="filter-search">${icon('search')}<input data-filter-table="opportunity-customer-table" placeholder="Search customers" /></label>${capabilities.canRunAi ? '<button class="button button--primary" data-action="run-selected-customers">Run AI for Selected</button>' : ''}</div>${customerTable(data.customers, capabilities)}</article>`;
  if (view === 'queue') return `<article class="panel">${panelHeader('AI Opportunity Queue', 'A+/A opportunities ordered by score, contactability, decision maker, and due date')}${customerTable(data.queue, capabilities, true)}</article>`;
  if (view === 'outreach') return `<article class="panel">${panelHeader('Outreach Drafts', 'Draft-only messages; sending always requires a human and happens outside this platform')}
    <div class="opportunity-card-grid">${data.customers.filter(customer => customer.last_ai_run_at).map(customer => `<button class="opportunity-card" data-action="view-customer" data-id="${customer.id}"><span>${badge(customer.opportunity_grade)}</span><strong>${esc(customer.company_name)}</strong><small>${esc(customer.ai_recommendation || 'Open to review outreach')}</small></button>`).join('') || '<div class="empty-state">Run AI to create reviewable outreach drafts.</div>'}</div></article>`;
  return `<article class="panel">${panelHeader('Sales Handoff', 'Qualified opportunities that meet grade and contactability rules')}${customerTable(data.handoff, capabilities, true)}</article>`;
}

async function renderOpportunityIntelligence() {
  const [dashboard, customersData, queueData, handoffData] = await Promise.all([
    api('/api/opportunity/dashboard'), api('/api/customers'), api('/api/opportunity-queue'), api('/api/customers/sales-handoff')
  ]);
  state.opportunityIntelligence = {
    metrics: dashboard.metrics, debug: dashboard.debug, capabilities: dashboard.capabilities,
    customers: customersData.customers, sources: customersData.sources, statuses: customersData.statuses,
    queue: queueData.customers, handoff: handoffData.customers
  };
  $('#page').innerHTML = `${pageHeader('Opportunity Intelligence', 'Turn sourced customer data into clean, scored, product-matched, human-approved sales opportunities.',
    dashboard.capabilities.canImport ? '<button class="button button--primary" data-action="opportunity-tab" data-tab="import">Import Customers</button>' : '')}
    ${opportunityTabs(state.opportunityView, { customers: customersData.customers.length, queue: queueData.customers.length, handoff: handoffData.customers.length })}
    <div class="opportunity-pane">${renderOpportunityPane(state.opportunityIntelligence)}</div>`;
  $('#customer-manual-form')?.addEventListener('submit', submitManualCustomer);
  $('#customer-csv-form')?.addEventListener('submit', event => submitCustomerImport(event, 'csv'));
  $('#customer-text-form')?.addEventListener('submit', event => submitCustomerImport(event, 'text'));
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

async function runSelectedCustomers() {
  const ids = [...document.querySelectorAll('[data-customer-select]:checked')].map(input => Number(input.value));
  if (!ids.length) return toast('Select at least one customer.');
  if (!window.confirm(`Estimated cost: $${(ids.length * 0.001).toFixed(3)}. Run AI for ${ids.length} selected customers?`)) return;
  await api('/api/customers/run-ai-selected', { method: 'POST', body: JSON.stringify({ customer_ids: ids, confirmed: true }) }); toast(`${ids.length} customers processed.`); await renderOpportunityIntelligence();
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

async function renderImports() {
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
        ${metricCard('Today AI Cost', `$${Number(data.aiCostControl.dashboard.todayAiCost || 0).toFixed(4)}`, 'Daily spend', 'money', 'green', true)}
        ${metricCard('Monthly AI Cost', `$${Number(data.aiCostControl.dashboard.monthlyAiCost || 0).toFixed(4)}`, 'Monthly spend', 'money', 'green', true)}
        ${metricCard('Budget Remaining', `$${Number(data.aiCostControl.budgetRemaining || 0).toFixed(2)}`, 'Effective remaining budget', 'check', 'green', true)}
        ${metricCard('Cost Logs', data.aiCostControl.logsCount || 0, 'All AI operations', 'document', 'green', true)}
        ${metricCard('Cache Records', data.aiCostControl.cacheRecordsCount || 0, 'Active cache entries', 'sparkles', 'green', true)}
        ${metricCard('Blocked Runs', data.aiCostControl.dashboard.blockedRuns || 0, 'Paid runs protected', 'warning', data.aiCostControl.dashboard.blockedRuns ? 'gold' : 'green', true)}
      </div>
      ${data.aiCostControl.lastBlockedRun ? `<div class="debug-error section-gap"><strong>Last Blocked Run</strong><pre>${esc(data.aiCostControl.lastBlockedRun.blocked_reason)}</pre></div>` : ''}
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
  } else if (action === 'opportunity-tab') {
    state.opportunityView = node.dataset.tab;
    await renderOpportunityIntelligence();
  } else if (action === 'view-customer') {
    await renderCustomerDetail(node.dataset.id);
  } else if (action === 'back-opportunities') {
    state.customerDetail = null;
    await renderOpportunityIntelligence();
  } else if (action === 'run-customer-ai') {
    await runCustomerAi(node.dataset.id);
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
  const accessible = navItems.filter(item => allowed(item.route) && (!query || t(item.labelKey).toLowerCase().includes(query)));
  $('#command-results').innerHTML = `<div class="command-group-label">${t('common.pages')}</div>${accessible.map((item, index) => `<div class="command-result ${index === 0 ? 'is-active' : ''}" data-route="${item.route}"><span class="metric-icon">${icon(item.route)}</span><span>${t(item.labelKey)}</span><small>${t(item.groupKey)}</small></div>`).join('') || `<div class="empty-state" style="padding:25px">${t('common.noMatches')}</div>`}`;
}

async function bootstrap() {
  setupStaticIcons();
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
