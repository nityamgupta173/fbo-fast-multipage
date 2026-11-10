/* Allocate Funds page logic (dashboard.html) */
let selectedPayment = null;
let selectedInvoices = new Set();
let invoiceAdjustments = {};

function getAmountToApply(i) {
  const inv = State.invoices[i];
  const adj = invoiceAdjustments[i];
  if (!adj) return inv.full;
  if (adj.type === 'partial') return adj.value;
  if (adj.type === 'tds') return inv.full - inv.full * (adj.value / 100);
  return inv.full;
}

function buildTables() {
  buildEftTable();
  buildInvoiceTable();
}

function buildEftTable() {
  const tbody = document.getElementById('eft-tbody');
  tbody.innerHTML = State.payments.map((p, i) => `
    <tr class="${selectedPayment === i ? 'selected' : ''}" data-pay="${i}">
      <td data-label="Payment ID / Dept">
        <div class="item-id">${p.id}</div>
        <div class="item-secondary">${p.department || ''}</div>
      </td>
      <td data-label="Date Received" style="color:var(--t2)">${p.date}</td>
      <td data-label="Amount Available" class="amt-full">${fmt(p.amount)}</td>
    </tr>`).join('') || `<tr><td colspan="3" style="text-align:center;padding:2rem;color:var(--t3)">No funds on account.</td></tr>`;
}

function buildInvoiceTable() {
  const tbody = document.getElementById('inv-tbody');
  const vis = visibleInvoices();
  const disabled = selectedPayment === null;
  if (!vis.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--t3)">No open invoices for this account view.</td></tr>`;
    return;
  }
  tbody.innerHTML = vis.map(({ inv, i }) => {
    const sel = selectedInvoices.has(i);
    const chip = inv.status === 'overdue' ? 'chip-overdue' : inv.status === 'due' ? 'chip-due' : 'chip-current';
    const adj = invoiceAdjustments[i];
    return `
    <tr class="${sel ? 'selected' : ''}" data-inv="${i}" style="${disabled ? 'cursor:not-allowed;opacity:0.6;' : ''}">
      <td data-label="Select Invoice"><input type="checkbox" class="cb" data-cb="${i}" ${sel ? 'checked' : ''} ${disabled ? 'disabled' : ''} aria-label="Select ${inv.id}"></td>
      <td data-label="Invoice Details">
        <div class="item-id">${inv.id}</div>
        <div class="item-secondary">Total: ${fmt(inv.full)} &middot; Acct: ${inv.acctId}</div>
      </td>
      <td data-label="Due Date" style="color:var(--t2)">${inv.date}</td>
      <td data-label="Status"><span class="chip ${chip}">${inv.label}</span></td>
      <td data-label="Amount to Apply">
        <div class="amt-wrap">
          <div class="amt-full">${fmt(getAmountToApply(i))}</div>
          <div class="deduction-wrap ${adj?.type === 'partial' ? 'visible' : ''}">
            <label for="partial-input-${i}">Adjust</label>
            <input class="deduction-input" id="partial-input-${i}" data-partial="${i}" type="number" value="${adj?.value || inv.full}" min="0.01" step="0.01" ${disabled ? 'disabled' : ''}>
          </div>
          <div class="deduction-wrap ${adj?.type === 'tds' ? 'visible' : ''}">
            <label for="tds-input-${i}">TDS %</label>
            <input class="deduction-input" id="tds-input-${i}" data-tds="${i}" type="number" value="${adj?.value || 0}" min="0" max="${TDS_MAX_PERCENT}" step="0.01" ${disabled ? 'disabled' : ''}>
          </div>
          <div class="inv-actions">
            <button class="action-btn ${adj?.type === 'tds' ? 'active' : ''}" data-adj="tds:${i}" ${disabled ? 'disabled' : ''}>Deduct TDS</button>
            <button class="action-btn ${adj?.type === 'partial' ? 'active' : ''}" data-adj="partial:${i}" ${disabled ? 'disabled' : ''}>Edit Amount</button>
          </div>
          <div class="comment-wrap ${adj?.type === 'partial' ? 'visible' : ''}">
            <textarea class="comment-input" id="comment-input-${i}" data-comment="${i}" placeholder="Enter reason here..." ${disabled ? 'disabled' : ''}>${adj?.comment || ''}</textarea>
            <label for="comment-input-${i}">Reason (Required)*</label>
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function updateSummary() {
  const available = selectedPayment !== null ? State.payments[selectedPayment].amount : 0;
  let total = 0, tds = 0, missingComment = false;
  selectedInvoices.forEach(i => {
    total += getAmountToApply(i);
    const adj = invoiceAdjustments[i];
    if (adj?.type === 'tds') tds += State.invoices[i].full * (adj.value / 100);
    if (adj?.type === 'partial' && (!adj.comment || !adj.comment.trim())) missingComment = true;
  });
  const remaining = available - total;
  const over = total > available;

  document.getElementById('sum-avail').textContent = fmt(available);
  document.getElementById('sum-count').textContent = selectedInvoices.size;
  document.getElementById('sum-total').textContent = fmt(total);
  const tdsRow = document.getElementById('sum-tds-row');
  tdsRow.style.display = tds > 0 ? 'flex' : 'none';
  if (tds > 0) document.getElementById('sum-tds').textContent = fmt(tds);
  document.getElementById('sum-remaining').textContent = fmt(remaining);
  document.getElementById('sum-rem-row').classList.toggle('over', over);

  const btn = document.getElementById('apply-btn');
  btn.disabled = !(selectedInvoices.size > 0 && selectedPayment !== null) || total <= 0 || over || missingComment;
  btn.textContent = selectedPayment === null ? 'Select a payment to begin'
    : selectedInvoices.size === 0 ? 'Select invoices to allocate funds'
    : `Allocate ${fmt(total)} →`;

  const err = document.getElementById('err-msg');
  if (over) { err.textContent = 'Total exceeds available funds'; err.style.display = 'block'; }
  else if (missingComment) { err.textContent = 'Provide a reason for all partial allocations'; err.style.display = 'block'; }
  else err.style.display = 'none';

  const selBtn = document.getElementById('sel-all-btn');
  const smartBtn = document.getElementById('smart-match-btn');
  selBtn.disabled = smartBtn.disabled = selectedPayment === null;
  const vis = visibleInvoices();
  const selVisible = vis.filter(({ i }) => selectedInvoices.has(i)).length;
  selBtn.textContent = selVisible > 0 && selVisible === vis.length ? 'Deselect All' : 'Select All';
}

function refresh() { buildTables(); updateSummary(); renderWallet(); }

function selectPayment(index) {
  if (selectedPayment === index) {
    selectedPayment = null; selectedInvoices.clear(); invoiceAdjustments = {};
  } else selectedPayment = index;
  refresh();
}

function toggleInvoice(i, on) {
  if (selectedPayment === null) return;
  const next = on === undefined ? !selectedInvoices.has(i) : on;
  if (next) selectedInvoices.add(i); else selectedInvoices.delete(i);
  buildInvoiceTable(); updateSummary();
}

function toggleSelectAll() {
  if (selectedPayment === null) return;
  const idx = visibleInvoices().map(({ i }) => i);
  const all = idx.every(i => selectedInvoices.has(i));
  idx.forEach(i => all ? selectedInvoices.delete(i) : selectedInvoices.add(i));
  buildInvoiceTable(); updateSummary();
}

function toggleAdjustment(i, type) {
  if (invoiceAdjustments[i]?.type === type) delete invoiceAdjustments[i];
  else {
    selectedInvoices.add(i);
    invoiceAdjustments[i] = { type, value: type === 'tds' ? TDS_MAX_PERCENT : State.invoices[i].full, comment: '' };
  }
  buildInvoiceTable(); updateSummary();
}

/* ---------- Smart Match ---------- */
function getCombinations(arr, maxDepth) {
  const results = [];
  (function combine(start, path) {
    if (path.length > 1 && path.length <= maxDepth) results.push([...path]);
    if (path.length === maxDepth) return;
    for (let k = start; k < arr.length; k++) { path.push(arr[k]); combine(k + 1, path); path.pop(); }
  })(0, []);
  return results;
}

function doSmartMatch() {
  if (selectedPayment === null) return;
  const available = State.payments[selectedPayment].amount;
  const idx = visibleInvoices().map(({ i }) => i);
  if (!idx.length) { alert('No open invoices available to match.'); return; }

  const INV = State.invoices;
  const isMatch = (v, t) => Math.abs(v - t) < 0.01;
  const tdsMult = 1 - TDS_MAX_PERCENT / 100;
  const oldest = (a, b) => INV[a].ts - INV[b].ts;
  const comboSort = (a, b) => a.length !== b.length ? a.length - b.length
    : Math.min(...a.map(i => INV[i].ts)) - Math.min(...b.map(i => INV[i].ts));
  const sumOf = c => c.reduce((s, i) => s + INV[i].full, 0);

  let matched = [], type = null, text = '';

  let m = idx.filter(i => isMatch(INV[i].full, available)).sort(oldest);
  if (m.length) {
    matched = [m[0]]; type = 'full';
    text = m.length > 1 ? `Tie-breaker Applied: Found ${m.length} invoices matching ${fmt(available)}. Selected the oldest invoice (${INV[m[0]].id}).`
      : `Exact Match: Found a single invoice (${INV[m[0]].id}) that exactly matches the ${fmt(available)} payment.`;
  }
  if (!type) {
    m = idx.filter(i => isMatch(INV[i].full * tdsMult, available)).sort(oldest);
    if (m.length) {
      matched = [m[0]]; type = 'tds';
      text = m.length > 1 ? `Tie-breaker Applied: Found ${m.length} invoices matching ${fmt(available)} after TDS. Selected the oldest (${INV[m[0]].id}).`
        : `TDS Match: Invoice ${INV[m[0]].id} perfectly matches the ${fmt(available)} payment after applying a ${TDS_MAX_PERCENT}% TDS deduction.`;
    }
  }
  const combos = getCombinations(idx, 4);
  if (!type) {
    const v = combos.filter(c => isMatch(sumOf(c), available)).sort(comboSort);
    if (v.length) {
      matched = v[0]; type = 'full';
      text = v.length > 1 ? `Tie-breaker Applied: Found ${v.length} different combinations equaling ${fmt(available)}. Selected the optimal combo containing your oldest debt.`
        : `Combined Match: Found an exact match by summing ${matched.length} invoices to equal ${fmt(available)}.`;
    }
  }
  if (!type) {
    const v = combos.filter(c => isMatch(sumOf(c) * tdsMult, available)).sort(comboSort);
    if (v.length) {
      matched = v[0]; type = 'tds';
      text = v.length > 1 ? `Tie-breaker Applied: Found ${v.length} different combinations matching ${fmt(available)} after TDS. Selected optimal oldest debt combo.`
        : `Combined TDS Match: Found ${matched.length} invoices that match the ${fmt(available)} payment after applying a ${TDS_MAX_PERCENT}% TDS deduction across the sum.`;
    }
  }
  if (!type) {
    const o = [...idx].sort(oldest)[0];
    matched = [o]; type = 'partial';
    text = `No exact matches found. Fallback: Allocating the full ${fmt(available)} payment as a partial credit to your oldest invoice (${INV[o].id}).`;
  }

  selectedInvoices.clear(); invoiceAdjustments = {};
  matched.forEach(i => {
    selectedInvoices.add(i);
    if (type === 'tds') invoiceAdjustments[i] = { type: 'tds', value: TDS_MAX_PERCENT };
    else if (type === 'partial') invoiceAdjustments[i] = { type: 'partial', value: available, comment: 'Smart Match Partial' };
  });
  track('smart_match', { match_type: type, invoices: matched.length });
  document.getElementById('smart-match-text').textContent = text;
  document.getElementById('smart-match-modal').classList.add('active');
}

function closeSmartMatch(accept) {
  document.getElementById('smart-match-modal').classList.remove('active');
  if (!accept) { selectedInvoices.clear(); invoiceAdjustments = {}; }
  buildInvoiceTable(); updateSummary();
}

/* ---------- Bulk CSV (simulated) ---------- */
function processCSV(e) {
  if (selectedPayment === null) { alert('Please select a payment to allocate against first.'); e.target.value = ''; return; }
  const idx = visibleInvoices().map(({ i }) => i);
  if (!idx.length) { alert('No invoices available in the current view.'); e.target.value = ''; return; }
  idx.sort(() => 0.5 - Math.random()).slice(0, 3).forEach(i => {
    const amt = parseFloat((State.invoices[i].full * (Math.random() * 0.4 + 0.1)).toFixed(2));
    selectedInvoices.add(i);
    invoiceAdjustments[i] = { type: 'partial', value: amt, comment: 'Bulk SFTP/CSV allocation reference' };
  });
  track('bulk_csv_upload');
  buildInvoiceTable(); updateSummary();
  e.target.value = '';
}

/* ---------- Apply ---------- */
function doApply() {
  let total = 0;
  selectedInvoices.forEach(i => total += getAmountToApply(i));
  const chips = [...selectedInvoices].map(i => ({ id: State.invoices[i].id, amount: getAmountToApply(i) }));

  State.payments[selectedPayment].amount -= total;
  const remainingInvoices = [];
  State.invoices.forEach((inv, i) => {
    if (selectedInvoices.has(i)) {
      const adj = invoiceAdjustments[i];
      if (adj && adj.type === 'partial') {
        State.disputes.push({ ...inv, status: 'inquiry', label: 'Under Inquiry', applied: adj.value, comment: adj.comment });
      }
    } else remainingInvoices.push(inv);
  });
  State.invoices = remainingInvoices;
  State.payments = State.payments.filter(p => p.amount > 0.01);
  State.confirmation = {
    chips,
    acct: State.view === 'ALL' ? 'Multiple Accounts' : State.view,
    total,
    remaining: State.payments.reduce((s, p) => s + p.amount, 0),
    ref: 'FAST-' + randId()
  };
  saveState();
  track('allocate_funds', { value: total, currency: 'USD', invoices: chips.length });
  window.location.href = 'success.html';
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  if (!requireLogin()) return;
  renderShell('dashboard');
  renderFooter();

  document.getElementById('eft-tbody').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-pay]');
    if (tr) selectPayment(parseInt(tr.dataset.pay, 10));
  });

  const inv = document.getElementById('inv-tbody');
  inv.addEventListener('click', e => {
    const adjBtn = e.target.closest('[data-adj]');
    if (adjBtn) { const [t, i] = adjBtn.dataset.adj.split(':'); toggleAdjustment(parseInt(i, 10), t); return; }
    if (e.target.closest('.deduction-wrap, .comment-wrap, .cb')) return;
    const tr = e.target.closest('tr[data-inv]');
    if (tr) toggleInvoice(parseInt(tr.dataset.inv, 10));
  });
  inv.addEventListener('change', e => {
    if (e.target.dataset.cb !== undefined) toggleInvoice(parseInt(e.target.dataset.cb, 10), e.target.checked);
  });
  inv.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.partial !== undefined) {
      const i = parseInt(t.dataset.partial, 10);
      invoiceAdjustments[i] = { type: 'partial', value: parseFloat(t.value) || 0, comment: invoiceAdjustments[i]?.comment || '' };
      updateSummary();
    } else if (t.dataset.tds !== undefined) {
      const i = parseInt(t.dataset.tds, 10);
      let pct = parseFloat(t.value) || 0;
      if (pct > TDS_MAX_PERCENT) { pct = TDS_MAX_PERCENT; t.value = pct; }
      invoiceAdjustments[i] = { type: 'tds', value: pct };
      updateSummary();
    } else if (t.dataset.comment !== undefined) {
      const i = parseInt(t.dataset.comment, 10);
      if (invoiceAdjustments[i]) { invoiceAdjustments[i].comment = t.value; updateSummary(); }
    }
  });
  inv.addEventListener('focusin', e => { if (e.target.classList.contains('deduction-input')) e.target.select(); });

  document.getElementById('smart-match-btn').addEventListener('click', doSmartMatch);
  document.getElementById('sel-all-btn').addEventListener('click', toggleSelectAll);
  document.getElementById('apply-btn').addEventListener('click', doApply);
  document.getElementById('csv-btn').addEventListener('click', () => document.getElementById('csv-upload').click());
  document.getElementById('csv-upload').addEventListener('change', processCSV);
  document.getElementById('sm-confirm').addEventListener('click', () => closeSmartMatch(true));
  document.getElementById('sm-cancel').addEventListener('click', () => closeSmartMatch(false));

  const promo = document.getElementById('fbo-promo-modal');
  const closePromo = () => promo.classList.remove('active');
  document.getElementById('promo-later').addEventListener('click', closePromo);
  document.getElementById('promo-switch').addEventListener('click', () => { track('promo_switch_dashboard'); alert('This would navigate to the FBO dashboard.'); closePromo(); });
  if (!State.promoSeen) {
    State.promoSeen = true; saveState();
    setTimeout(() => promo.classList.add('active'), 1500);
  }

  window.onViewChange = () => { selectedInvoices.clear(); invoiceAdjustments = {}; refresh(); };
  refresh();
});
