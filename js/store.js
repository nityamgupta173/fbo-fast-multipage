/* Shared state + page shell for FedEx FAST (multi-page).
   State lives in sessionStorage so it survives navigation between pages. */

const TDS_MAX_PERCENT = 2;

const DEFAULT_STATE = {
  loggedIn: false,
  view: 'ALL',
  promoSeen: false,
  payments: [
    { id: 'EFT-A45-1', date: '2 May 2026', amount: 10000, department: 'Marketing Dept.' },
    { id: 'EFT-B12-8', date: '3 May 2026', amount: 8950, department: 'Logistics Division' },
    { id: 'EFT-EXACT-1', date: '4 May 2026', amount: 4200, department: 'APAC Region' }
  ],
  invoices: [
    { id: 'INV-20240876', acctId: '9876543210', date: '14 Apr 2026', ts: 1713052800, status: 'overdue', label: 'Overdue', full: 5200 },
    { id: 'INV-20240891', acctId: '1122334455', date: '28 Apr 2026', ts: 1714262400, status: 'due', label: 'Due soon', full: 4200 },
    { id: 'INV-20240902', acctId: '9876543210', date: '12 May 2026', ts: 1715472000, status: 'current', label: 'Current', full: 3750 },
    { id: 'INV-20240918', acctId: '9876543210', date: '24 May 2026', ts: 1716508800, status: 'current', label: 'Current', full: 4500 },
    { id: 'INV-20240933', acctId: '1122334455', date: '3 Jun 2026', ts: 1717372800, status: 'current', label: 'Current', full: 2300 },
    { id: 'INV-20240945', acctId: '1122334455', date: '10 Jun 2026', ts: 1717977600, status: 'current', label: 'Current', full: 1800 },
    { id: 'INV-20240988', acctId: '1122334455', date: '15 Jun 2026', ts: 1718409600, status: 'current', label: 'Current', full: 4200 }
  ],
  disputes: [],
  confirmation: null
};

const KEY = 'fedex-fast-state';

function loadState() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* storage unavailable */ }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}
function saveState() {
  try { sessionStorage.setItem(KEY, JSON.stringify(State)); } catch (e) { /* ignore */ }
}
function resetState() {
  window.State = JSON.parse(JSON.stringify(DEFAULT_STATE));
  saveState();
}
window.State = loadState();

const fmt = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const randId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

/* Safe wrapper around GA4 custom events (no-op if gtag is blocked). */
function track(eventName, params) {
  if (typeof window.gtag === 'function') window.gtag('event', eventName, params || {});
}

function requireLogin() {
  if (!State.loggedIn) { window.location.replace('index.html'); return false; }
  return true;
}

function visibleInvoices() {
  return State.invoices
    .map((inv, i) => ({ inv, i }))
    .filter(({ inv }) => State.view === 'ALL' || inv.acctId === State.view);
}

/* ---------- Page shell (topbar, wallet card, tabs) ---------- */
const TABS = [
  { id: 'dashboard', href: 'dashboard.html', label: 'Allocate Funds' },
  { id: 'make-payment', href: 'make-payment.html', label: 'Make a Payment' },
  { id: 'disputes', href: 'disputes.html', label: 'Disputes / Under Inquiry' },
  { id: 'add-payment', href: 'add-payment.html', label: 'Add My Payment' }
];

function logoHtml() {
  return `<div class="fedex-logo"><span class="fed">Fed</span><span class="ex">Ex</span></div>
          <div class="brand-divider"></div><div class="brand-sub">FAST</div>`;
}

function renderShell(activeTab, opts) {
  opts = opts || {};
  const top = document.getElementById('shell-top');
  if (!top) return;
  top.innerHTML = `
  <header class="topbar">
    <a class="brand brand-link" href="dashboard.html" aria-label="FedEx FAST home">${logoHtml()}</a>
    <div class="topbar-sep"></div>
    <div class="acct-context-wrap">
      <div class="acct-context-label">
        <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        Viewing
      </div>
      <select id="acct-select" class="topbar-acct-select" aria-label="Account view">
        <option value="ALL">All Linked Accounts (Parent)</option>
        <option value="9876543210">Acct: 9876543210</option>
        <option value="1122334455">Acct: 1122334455</option>
      </select>
    </div>
    <button class="btn-logout" id="logout-btn">Log out</button>
  </header>`;
  document.getElementById('acct-select').value = State.view;
  document.getElementById('acct-select').addEventListener('change', e => {
    State.view = e.target.value;
    saveState();
    track('switch_account_view', { view: State.view });
    renderWallet();
    if (typeof window.onViewChange === 'function') window.onViewChange();
  });
  document.getElementById('logout-btn').addEventListener('click', () => {
    track('logout');
    resetState();
    window.location.href = 'index.html';
  });

  const body = document.getElementById('shell-body');
  if (body && opts.wallet !== false) {
    body.innerHTML = `
    <div class="wallet-card">
      <div class="wc-main">
        <div class="wc-eyebrow">Funds On-Account</div>
        <div class="wc-amount" id="wc-avail">$0.00</div>
        <div class="wc-sub">Available to allocate · Received via EFT</div>
      </div>
      <div class="wc-stats">
        <div class="wcs"><div class="wcs-label">Total Received</div><div class="wcs-val" id="wc-received">$0.00</div></div>
        <div class="wcs"><div class="wcs-label">Pending Invoices</div><div class="wcs-val" id="wc-pending">0</div></div>
        <div class="wcs"><div class="wcs-label">Total Outstanding</div><div class="wcs-val" id="wc-outstanding">$0.00</div></div>
      </div>
    </div>
    <nav class="dash-tabs" aria-label="Sections">
      ${TABS.map(t => `<a class="dash-tab ${t.id === activeTab ? 'active' : ''}" href="${t.href}" ${t.id === activeTab ? 'aria-current="page"' : ''}>${t.label}${t.id === 'disputes' && State.disputes.length ? `<span class="tab-badge">${State.disputes.length}</span>` : ''}</a>`).join('')}
    </nav>`;
    renderWallet();
  }
}

function renderWallet() {
  const el = document.getElementById('wc-avail');
  if (!el) return;
  const total = State.payments.reduce((s, p) => s + p.amount, 0);
  const vis = visibleInvoices();
  const outstanding = vis.reduce((s, { inv }) => s + inv.full, 0);
  el.textContent = fmt(total);
  document.getElementById('wc-received').textContent = fmt(total);
  document.getElementById('wc-outstanding').textContent = fmt(outstanding);
  document.getElementById('wc-pending').textContent = vis.length;
}

function renderFooter() {
  const f = document.getElementById('site-footer');
  if (!f) return;
  f.innerHTML = `FedEx FAST demo · <a href="index.html">Sign in</a> · <a href="dashboard.html">Dashboard</a> · <a href="disputes.html">Disputes</a>`;
}
