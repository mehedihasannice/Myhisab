import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import {
  getDatabase, ref, get, set, remove, push, onValue
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyBmWURw03HyycLImNR-erXY_AAHY9jRDP0",
  authDomain: "my-hisab-d6f6d.firebaseapp.com",
  databaseURL: "https://my-hisab-d6f6d-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "my-hisab-d6f6d"
};

const WORKER_URL = "https://accounting-bot-parser.mehedihasan-nice96.workers.dev";

// worker/index.js-এর CATEGORIES-এর সাথে হুবহু মিলিয়ে রাখা
const CATEGORY_ICONS = {
  "খাবার": "🍽️", "বাজার": "🛒", "যাতায়াত": "🚗", "বাড়িভাড়া": "🏠",
  "বিল": "💡", "চিকিৎসা": "💊", "শিক্ষা": "📚", "কেনাকাটা": "🛍️",
  "বিনোদন": "🎬", "বেতন": "💰", "ব্যবসা": "💼", "বিবিধ": "📌"
};

const BN_MONTHS = ["জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"];
const BN_DAYS_SHORT = ["রবি","সোম","মঙ্গল","বুধ","বৃহ","শুক্র","শনি"];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

function reportInitError(context, err) {
  console.error('[' + context + ']', err);
  const banner = document.createElement('div');
  banner.textContent = 'Setup error (' + context + '): ' + err.message;
  banner.style.cssText =
    'position:fixed;top:0;left:0;right:0;background:#DC2626;color:#fff;' +
    'padding:10px;text-align:center;font-size:12px;z-index:999;';
  document.body.appendChild(banner);
}

// ===== Theme =====
(function initTheme() {
  try {
    const floatingBtn = document.getElementById('theme-toggle');
    const themeColorMeta = document.getElementById('theme-color-meta');
    const settingsRow = document.getElementById('theme-toggle-row');
    const settingsLabel = document.getElementById('theme-toggle-label');
    if (!themeColorMeta) throw new Error('theme-color-meta element পাওয়া যায়নি');

    function getPreferredTheme() {
      try {
        const stored = localStorage.getItem('myhisab-theme');
        if (stored === 'light' || stored === 'dark') return stored;
      } catch (e) {}
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      if (floatingBtn) floatingBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
      if (settingsLabel) settingsLabel.textContent = theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
      themeColorMeta.setAttribute('content', theme === 'dark' ? '#000000' : '#FFFFFF');
      try { localStorage.setItem('myhisab-theme', theme); } catch (e) {}
    }

    applyTheme(getPreferredTheme());

    function toggle() {
      const current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'dark' ? 'light' : 'dark');
    }
    if (floatingBtn) floatingBtn.addEventListener('click', toggle);
    if (settingsRow) settingsRow.addEventListener('click', toggle);
  } catch (err) {
    reportInitError('theme', err);
  }
})();

// ===== Main App =====
(function initApp() {
  try {
    // DOM refs
    const authSection    = document.getElementById('auth-section');
    const pendingSection = document.getElementById('pending-section');
    const appSection     = document.getElementById('app-section');
    const brandEl        = document.getElementById('brand');
    const taglineEl      = document.getElementById('tagline');
    const floatingThemeBtn = document.getElementById('theme-toggle');
    const adminPanel     = document.getElementById('admin-panel');
    const pendingListEl  = document.getElementById('pending-list');
    const tabPersonal    = document.getElementById('tab-personal');
    const tabBusiness    = document.getElementById('tab-business');
    const segmentIndicator = document.getElementById('segment-indicator');
    const chatFeed       = document.getElementById('chat-feed');
    const chatForm       = document.getElementById('chat-form');
    const chatInput      = document.getElementById('chat-input');
    const chatSendBtn    = document.getElementById('chat-send-btn');
    const confirmOverlay = document.getElementById('confirm-overlay');
    const confirmAmount  = document.getElementById('confirm-amount');
    const confirmCategory= document.getElementById('confirm-category');
    const confirmDate    = document.getElementById('confirm-date');
    const confirmNote    = document.getElementById('confirm-note');
    const confirmTypeExpense = document.getElementById('confirm-type-expense');
    const confirmTypeIncome  = document.getElementById('confirm-type-income');
    const confirmCancelBtn   = document.getElementById('confirm-cancel-btn');
    const confirmSaveBtn     = document.getElementById('confirm-save-btn');
    const settingsBtn    = document.getElementById('settings-btn');
    const settingsOverlay= document.getElementById('settings-overlay');
    const statIncome     = document.getElementById('stat-income');
    const statExpense    = document.getElementById('stat-expense');
    const statBalance    = document.getElementById('stat-balance');
    const statMonthLabel = document.getElementById('stat-month-label');
    const sparklineChart = document.getElementById('sparkline-chart');
    const sparklineLabels= document.getElementById('sparkline-labels');
    const navButtons     = document.querySelectorAll('.view-tab-btn');
    const viewPanels     = {
      home:    document.getElementById('view-home'),
      history: document.getElementById('view-history')
    };
    // History DOM
    const hfBtns         = document.querySelectorAll('.hf-btn');
    const periodPrev     = document.getElementById('period-prev');
    const periodNext     = document.getElementById('period-next');
    const periodLabel    = document.getElementById('period-label');
    const hsIncome       = document.getElementById('hs-income');
    const hsExpense      = document.getElementById('hs-expense');
    const hsNet          = document.getElementById('hs-net');
    const trendSvg       = document.getElementById('trend-svg');
    const trendXLabels   = document.getElementById('trend-x-labels');
    const historyList    = document.getElementById('history-list');

    // Guard
    if (!authSection || !pendingSection || !appSection || !adminPanel || !pendingListEl ||
        !tabPersonal || !tabBusiness || !segmentIndicator || !chatFeed || !chatForm ||
        !confirmOverlay || !settingsBtn || !settingsOverlay ||
        !statIncome || !statExpense || !statBalance) {
      throw new Error('মূল app-এর কোনো element পাওয়া যায়নি');
    }

    // ===== Utility =====
    function categoryIcon(cat) { return CATEGORY_ICONS[cat] || '📌'; }

    function getBDDateString() {
      return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
    }

    function formatBN(amount) {
      return '৳' + Number(amount).toLocaleString('en-IN');
    }

    function populateCategorySelect() {
      confirmCategory.innerHTML = '';
      Object.keys(CATEGORY_ICONS).forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = CATEGORY_ICONS[cat] + ' ' + cat;
        confirmCategory.appendChild(opt);
      });
    }
    populateCategorySelect();

    // ===== Section visibility =====
    function showOnly(section) {
      [authSection, pendingSection, appSection].forEach(s => s.classList.add('hidden'));
      section.classList.remove('hidden');
      // app-section active হলে: brand/tagline hide, floating theme btn hide
      const isApp = section === appSection;
      if (brandEl)         brandEl.classList.toggle('hidden', isApp);
      if (taglineEl)       taglineEl.classList.toggle('hidden', isApp);
      if (floatingThemeBtn) floatingThemeBtn.classList.toggle('hidden', isApp);
    }

    function currentLedger() {
      return tabBusiness.classList.contains('active') ? 'business' : 'personal';
    }

    // ===== Settings =====
    settingsBtn.addEventListener('click', () => settingsOverlay.classList.remove('hidden'));
    settingsOverlay.addEventListener('click', (e) => {
      if (e.target === settingsOverlay) settingsOverlay.classList.add('hidden');
    });

    // ===== View tab switching =====
    navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Object.keys(viewPanels).forEach((key) => {
          if (viewPanels[key]) viewPanels[key].classList.toggle('hidden', key !== view);
        });
        // chat-form শুধু home view-এ দেখা যাবে
        chatForm.classList.toggle('hidden', view !== 'home');
        if (view === 'history') renderHistory();
      });
    });

    // ===== Admin: pending approvals =====
    async function loadPendingRequests() {
      pendingListEl.innerHTML = '';
      try {
        const snap = await get(ref(db, 'pendingRequests'));
        if (!snap.exists()) {
          const empty = document.createElement('div');
          empty.className = 'empty-note';
          empty.textContent = 'এখন কোনো pending request নেই।';
          pendingListEl.appendChild(empty);
          return;
        }
        const requests = snap.val();
        Object.keys(requests).forEach((uid) => {
          const r = requests[uid];
          const info = document.createElement('div');
          info.className = 'pending-item-info';
          info.appendChild(document.createTextNode(r.name));
          const emailSpan = document.createElement('span');
          emailSpan.className = 'email';
          emailSpan.textContent = r.email;
          info.appendChild(emailSpan);

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'approve-btn';
          btn.textContent = 'Approve';
          btn.dataset.uid = uid;
          btn.dataset.name = r.name;

          const item = document.createElement('div');
          item.className = 'pending-item';
          item.appendChild(info);
          item.appendChild(btn);
          pendingListEl.appendChild(item);
        });
      } catch (err) {
        const errNote = document.createElement('div');
        errNote.className = 'empty-note';
        errNote.textContent = 'Load করতে সমস্যা হয়েছে।';
        pendingListEl.appendChild(errNote);
      }
    }

    pendingListEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('.approve-btn');
      if (!btn) return;
      const uid = btn.dataset.uid;
      const name = btn.dataset.name;
      btn.disabled = true;
      btn.textContent = '...';
      try {
        await set(ref(db, `users/${uid}`), { name: name, role: 'member' });
        await remove(ref(db, `pendingRequests/${uid}`));
        loadPendingRequests();
      } catch (err) {
        alert('Approve করতে সমস্যা হয়েছে: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'Approve';
      }
    });

    // ===== Ledger subscription =====
    let unsubscribeLedger = null;
    let currentEntries = [];

    function subscribeToLedger(ledgerType, uid) {
      if (unsubscribeLedger) { unsubscribeLedger(); unsubscribeLedger = null; }
      const path = ledgerType === 'personal' ? `personal/${uid}` : 'business';
      unsubscribeLedger = onValue(ref(db, path), (snapshot) => {
        currentEntries = [];
        snapshot.forEach((child) => {
          const val = child.val();
          val._key = child.key;
          currentEntries.push(val);
        });
        renderFeed();
        renderDashboard();
      }, () => {
        chatFeed.innerHTML = '';
        const errNote = document.createElement('div');
        errNote.className = 'empty-note';
        errNote.textContent = 'হিসাব load করতে সমস্যা হয়েছে।';
        chatFeed.appendChild(errNote);
      });
    }

    // ===== Feed =====
    function renderFeed() {
      chatFeed.innerHTML = '';
      if (currentEntries.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-note';
        empty.textContent = 'এখনো কোনো হিসাব যোগ হয়নি। নিচে লিখে শুরু করো।';
        chatFeed.appendChild(empty);
        return;
      }
      const recent = currentEntries.slice(-20).slice().reverse();
      recent.forEach((entry) => chatFeed.appendChild(buildEntryEl(entry)));
    }

    function buildEntryEl(entry) {
      const item = document.createElement('div');
      item.className = 'entry-item ' + (entry.type === 'income' ? 'income' : 'expense');

      const iconEl = document.createElement('div');
      iconEl.className = 'entry-icon';
      iconEl.textContent = categoryIcon(entry.category);

      const main = document.createElement('div');
      main.className = 'entry-main';
      const catEl = document.createElement('span');
      catEl.className = 'entry-category';
      catEl.textContent = entry.category;
      const noteEl = document.createElement('span');
      noteEl.className = 'entry-note';
      noteEl.textContent = entry.note || '';
      main.appendChild(catEl);
      main.appendChild(noteEl);

      const right = document.createElement('div');
      right.className = 'entry-right';
      const amountEl = document.createElement('div');
      amountEl.className = 'entry-amount';
      amountEl.textContent = (entry.type === 'income' ? '+' : '-') + formatBN(entry.amount);
      const dateEl = document.createElement('div');
      dateEl.className = 'entry-date';
      if (entry.date) {
        const d = new Date(entry.date + 'T00:00:00');
        dateEl.textContent = d.getDate() + ' ' + BN_MONTHS[d.getMonth()];
      }
      right.appendChild(amountEl);
      right.appendChild(dateEl);

      item.appendChild(iconEl);
      item.appendChild(main);
      item.appendChild(right);
      return item;
    }

    // ===== Dashboard =====
    function renderDashboard() {
      const today = getBDDateString();           // "YYYY-MM-DD"
      const currentMonth = today.slice(0, 7);   // "YYYY-MM"
      let monthlyIncome = 0, monthlyExpense = 0, balance = 0;

      currentEntries.forEach((entry) => {
        const amt = Number(entry.amount) || 0;
        balance += entry.type === 'income' ? amt : -amt;
        if (typeof entry.date === 'string' && entry.date.slice(0, 7) === currentMonth) {
          if (entry.type === 'income') monthlyIncome += amt;
          else monthlyExpense += amt;
        }
      });

      statIncome.textContent  = formatBN(monthlyIncome);
      statExpense.textContent = formatBN(monthlyExpense);
      statBalance.textContent = formatBN(balance);

      // Month label in Bengali
      const now = new Date();
      if (statMonthLabel) {
        statMonthLabel.textContent = BN_MONTHS[now.getMonth()] + ' ' + now.getFullYear();
      }

      renderSparkline(today);
    }

    // ===== Sparkline: last 7 days expense bars =====
    function renderSparkline(todayStr) {
      if (!sparklineChart || !sparklineLabels) return;
      sparklineChart.innerHTML = '';
      sparklineLabels.innerHTML = '';

      // Build last 7 days array
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(todayStr + 'T00:00:00');
        d.setDate(d.getDate() - i);
        const ds = d.toLocaleDateString('en-CA');
        days.push({ date: ds, dayName: BN_DAYS_SHORT[d.getDay()], amount: 0 });
      }

      currentEntries.forEach((entry) => {
        if (entry.type !== 'expense') return;
        const dayObj = days.find(d => d.date === entry.date);
        if (dayObj) dayObj.amount += Number(entry.amount) || 0;
      });

      const maxAmt = Math.max(...days.map(d => d.amount), 1);

      days.forEach((day, idx) => {
        const isToday = idx === 6;
        const heightPct = Math.max((day.amount / maxAmt) * 100, 6);

        const bar = document.createElement('div');
        bar.className = 'spark-bar' + (isToday ? ' today' : '');
        bar.style.height = heightPct + '%';
        if (day.amount > 0) bar.title = day.date + ': ' + formatBN(day.amount);
        sparklineChart.appendChild(bar);

        const lbl = document.createElement('div');
        lbl.className = 'spark-lbl' + (isToday ? ' today' : '');
        lbl.textContent = day.dayName;
        sparklineLabels.appendChild(lbl);
      });
    }

    // ===== History view =====
    let historyFilter = 'month';   // 'day' | 'month' | 'year'
    let historyOffset = 0;         // 0 = current, -1 = previous, +1 = future (but we cap at 0)

    hfBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        hfBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        historyFilter = btn.dataset.hfilter;
        historyOffset = 0;
        renderHistory();
      });
    });

    if (periodPrev) periodPrev.addEventListener('click', () => { historyOffset--; renderHistory(); });
    if (periodNext) periodNext.addEventListener('click', () => {
      if (historyOffset < 0) { historyOffset++; renderHistory(); }
    });

    function getPeriodRange(filter, offset) {
      const now = new Date();
      let start, end, label;
      if (filter === 'day') {
        const d = new Date(now);
        d.setDate(d.getDate() + offset);
        const ds = d.toLocaleDateString('en-CA');
        start = ds; end = ds;
        label = d.getDate() + ' ' + BN_MONTHS[d.getMonth()] + ' ' + d.getFullYear();
      } else if (filter === 'month') {
        const y = now.getFullYear();
        const m = now.getMonth() + offset;
        const td = new Date(y, m, 1);
        start = td.toLocaleDateString('en-CA');
        const lastDay = new Date(td.getFullYear(), td.getMonth() + 1, 0);
        end = lastDay.toLocaleDateString('en-CA');
        label = BN_MONTHS[td.getMonth()] + ' ' + td.getFullYear();
      } else { // year
        const y = now.getFullYear() + offset;
        start = y + '-01-01';
        end   = y + '-12-31';
        label = String(y);
      }
      return { start, end, label };
    }

    function renderHistory() {
      if (!historyList || !periodLabel) return;
      const { start, end, label } = getPeriodRange(historyFilter, historyOffset);
      periodLabel.textContent = label;

      // Filter entries for period
      const filtered = currentEntries.filter(e => {
        if (typeof e.date !== 'string') return false;
        return e.date >= start && e.date <= end;
      });

      // Summary
      let inc = 0, exp = 0;
      filtered.forEach(e => {
        const a = Number(e.amount) || 0;
        if (e.type === 'income') inc += a; else exp += a;
      });
      if (hsIncome)  hsIncome.textContent  = formatBN(inc);
      if (hsExpense) hsExpense.textContent = formatBN(exp);
      if (hsNet)     hsNet.textContent     = formatBN(inc - exp);

      // Trend chart
      renderTrendChart(filtered, start, end);

      // Group by date, sorted descending
      historyList.innerHTML = '';
      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-note';
        empty.textContent = 'এই সময়কালে কোনো হিসাব নেই।';
        historyList.appendChild(empty);
        return;
      }

      const byDate = {};
      filtered.forEach(e => {
        const dk = e.date || 'unknown';
        if (!byDate[dk]) byDate[dk] = [];
        byDate[dk].push(e);
      });

      const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
      sortedDates.forEach(dateKey => {
        const group = document.createElement('div');
        group.className = 'history-day-group';

        const dayLabel = document.createElement('div');
        dayLabel.className = 'history-day-label';
        if (dateKey !== 'unknown') {
          const d = new Date(dateKey + 'T00:00:00');
          dayLabel.textContent = BN_DAYS_SHORT[d.getDay()] + ', ' + d.getDate() + ' ' + BN_MONTHS[d.getMonth()];
        } else {
          dayLabel.textContent = 'অজানা তারিখ';
        }
        group.appendChild(dayLabel);

        byDate[dateKey].slice().reverse().forEach(e => group.appendChild(buildEntryEl(e)));
        historyList.appendChild(group);
      });
    }

    // ===== Trend SVG chart =====
    function renderTrendChart(entries, start, end) {
      if (!trendSvg || !trendXLabels) return;
      trendSvg.innerHTML = '';
      trendXLabels.innerHTML = '';

      // Build buckets: for 'day' filter → hours, 'month' → days, 'year' → months
      let buckets = [];

      if (historyFilter === 'year') {
        for (let m = 0; m < 12; m++) {
          const ys = start.slice(0, 4);
          const ms = String(m + 1).padStart(2, '0');
          buckets.push({ key: ys + '-' + ms, label: BN_MONTHS[m].slice(0, 3), income: 0, expense: 0 });
        }
        entries.forEach(e => {
          const bk = e.date ? e.date.slice(0, 7) : null;
          const b = buckets.find(b => b.key === bk);
          if (b) { if (e.type === 'income') b.income += Number(e.amount) || 0; else b.expense += Number(e.amount) || 0; }
        });
      } else if (historyFilter === 'month') {
        const startD = new Date(start + 'T00:00:00');
        const endD   = new Date(end   + 'T00:00:00');
        for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
          buckets.push({ key: d.toLocaleDateString('en-CA'), label: String(d.getDate()), income: 0, expense: 0 });
        }
        entries.forEach(e => {
          const b = buckets.find(b => b.key === e.date);
          if (b) { if (e.type === 'income') b.income += Number(e.amount) || 0; else b.expense += Number(e.amount) || 0; }
        });
      } else {
        // day — show income vs expense as 2-bar summary only (single bucket)
        buckets = [{ key: start, label: '', income: 0, expense: 0 }];
        entries.forEach(e => {
          if (e.type === 'income') buckets[0].income += Number(e.amount) || 0;
          else buckets[0].expense += Number(e.amount) || 0;
        });
      }

      const maxVal = Math.max(...buckets.map(b => Math.max(b.income, b.expense)), 1);
      const W = 320, H = 80, PAD = 4;
      const bw = (W - PAD * 2) / buckets.length;

      // Income polyline (green)
      const incPts = buckets.map((b, i) => {
        const x = PAD + i * bw + bw / 2;
        const y = H - PAD - ((b.income / maxVal) * (H - PAD * 2));
        return x + ',' + y;
      }).join(' ');

      // Expense polyline (red)
      const expPts = buckets.map((b, i) => {
        const x = PAD + i * bw + bw / 2;
        const y = H - PAD - ((b.expense / maxVal) * (H - PAD * 2));
        return x + ',' + y;
      }).join(' ');

      // Area fill under expense (subtle)
      const firstX = PAD + bw / 2;
      const lastX  = PAD + (buckets.length - 1) * bw + bw / 2;
      const areaPath = 'M ' + firstX + ',' + (H - PAD) + ' L ' +
        buckets.map((b, i) => {
          const x = PAD + i * bw + bw / 2;
          const y = H - PAD - ((b.expense / maxVal) * (H - PAD * 2));
          return x + ',' + y;
        }).join(' L ') + ' L ' + lastX + ',' + (H - PAD) + ' Z';

      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const incColor  = isDark ? '#22C55E' : '#16A34A';
      const expColor  = isDark ? '#F87171' : '#DC2626';
      const areaColor = isDark ? 'rgba(248,113,113,0.12)' : 'rgba(220,38,38,0.08)';

      // Area
      const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      area.setAttribute('d', areaPath);
      area.setAttribute('fill', areaColor);
      trendSvg.appendChild(area);

      // Income line
      if (incPts) {
        const incLine = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        incLine.setAttribute('points', incPts);
        incLine.setAttribute('fill', 'none');
        incLine.setAttribute('stroke', incColor);
        incLine.setAttribute('stroke-width', '2');
        incLine.setAttribute('stroke-linecap', 'round');
        incLine.setAttribute('stroke-linejoin', 'round');
        trendSvg.appendChild(incLine);
      }

      // Expense line
      if (expPts) {
        const expLine = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        expLine.setAttribute('points', expPts);
        expLine.setAttribute('fill', 'none');
        expLine.setAttribute('stroke', expColor);
        expLine.setAttribute('stroke-width', '2');
        expLine.setAttribute('stroke-linecap', 'round');
        expLine.setAttribute('stroke-linejoin', 'round');
        trendSvg.appendChild(expLine);
      }

      // X labels — show only if ≤ 15 buckets, else skip every other
      const step = buckets.length > 15 ? 7 : (buckets.length > 7 ? 3 : 1);
      buckets.forEach((b, i) => {
        const lbl = document.createElement('div');
        lbl.className = 'trend-x-lbl';
        lbl.textContent = (i % step === 0 || i === buckets.length - 1) ? b.label : '';
        trendXLabels.appendChild(lbl);
      });
    }

    // ===== Personal/Business toggle =====
    tabPersonal.addEventListener('click', () => {
      if (tabPersonal.classList.contains('active')) return;
      tabPersonal.classList.add('active');
      tabBusiness.classList.remove('active');
      segmentIndicator.classList.remove('business');
      const user = auth.currentUser;
      if (user) subscribeToLedger('personal', user.uid);
    });
    tabBusiness.addEventListener('click', () => {
      if (tabBusiness.classList.contains('active')) return;
      tabBusiness.classList.add('active');
      tabPersonal.classList.remove('active');
      segmentIndicator.classList.add('business');
      const user = auth.currentUser;
      if (user) subscribeToLedger('business', user.uid);
    });

    // ===== Send message → Worker → confirm card =====
    let pendingLedger = null;

    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      chatInput.disabled = true;
      chatSendBtn.disabled = true;
      chatSendBtn.textContent = '...';

      try {
        const idToken = await auth.currentUser.getIdToken();
        const res = await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
          body: JSON.stringify({ text })
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || 'বুঝতে সমস্যা হয়েছে, আবার চেষ্টা করো।');
          return;
        }
        pendingLedger = currentLedger();
        confirmAmount.value   = data.amount;
        confirmCategory.value = data.category;
        confirmDate.value     = data.date;
        confirmNote.value     = data.note || text;
        setConfirmType(data.type);
        confirmOverlay.classList.remove('hidden');
        chatInput.value = '';
      } catch (err) {
        alert('সমস্যা হয়েছে: ' + err.message);
      } finally {
        chatInput.disabled   = false;
        chatSendBtn.disabled = false;
        chatSendBtn.textContent = '➤';
      }
    });

    function setConfirmType(type) {
      confirmTypeExpense.classList.toggle('active', type !== 'income');
      confirmTypeIncome.classList.toggle('active', type === 'income');
    }
    confirmTypeExpense.addEventListener('click', () => setConfirmType('expense'));
    confirmTypeIncome.addEventListener('click',  () => setConfirmType('income'));

    confirmOverlay.addEventListener('click', (e) => {
      if (e.target === confirmOverlay) confirmOverlay.classList.add('hidden');
    });
    confirmCancelBtn.addEventListener('click', () => confirmOverlay.classList.add('hidden'));

    confirmSaveBtn.addEventListener('click', async () => {
      const amount   = parseFloat(confirmAmount.value);
      const type     = confirmTypeIncome.classList.contains('active') ? 'income' : 'expense';
      const category = confirmCategory.value;
      const date     = confirmDate.value;
      const note     = confirmNote.value.trim();

      if (!amount || amount <= 0 || !category || !date) {
        alert('Amount, Category, আর Date ঠিকভাবে পূরণ করো।');
        return;
      }

      confirmSaveBtn.disabled = true;
      try {
        const user = auth.currentUser;
        const entry = { amount, type, category, date, note };
        if (pendingLedger === 'business') {
          entry.addedBy = user.uid;
          await set(push(ref(db, 'business')), entry);
        } else {
          await set(push(ref(db, `personal/${user.uid}`)), entry);
        }
        confirmOverlay.classList.add('hidden');
      } catch (err) {
        alert('সংরক্ষণ করতে সমস্যা হয়েছে: ' + err.message);
      } finally {
        confirmSaveBtn.disabled = false;
      }
    });

    // ===== Auth forms =====
    function friendlyAuthError(err) {
      const map = {
        'auth/invalid-email':       'Email format ঠিক নেই।',
        'auth/user-not-found':      'এই email দিয়ে কোনো account নেই।',
        'auth/wrong-password':      'Password ভুল হয়েছে।',
        'auth/invalid-credential':  'Email অথবা password ভুল।',
        'auth/email-already-in-use':'এই email দিয়ে আগেই account আছে, login করো।',
        'auth/weak-password':       'Password কমপক্ষে ৬ character হতে হবে।',
        'auth/too-many-requests':   'অনেকবার চেষ্টা হয়েছে, একটু পর আবার চেষ্টা করো।'
      };
      return map[err.code] || ('সমস্যা হয়েছে: ' + err.message);
    }

    document.getElementById('show-signup-btn').addEventListener('click', () => {
      document.getElementById('login-form').classList.add('hidden');
      document.getElementById('signup-form').classList.remove('hidden');
    });
    document.getElementById('show-login-btn').addEventListener('click', () => {
      document.getElementById('signup-form').classList.add('hidden');
      document.getElementById('login-form').classList.remove('hidden');
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email    = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const errorEl  = document.getElementById('login-error');
      errorEl.style.display = 'none';
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        errorEl.textContent = friendlyAuthError(err);
        errorEl.style.display = 'block';
      }
    });

    document.getElementById('signup-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name     = document.getElementById('signup-name').value.trim();
      const email    = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      const errorEl  = document.getElementById('signup-error');
      errorEl.style.display = 'none';
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await set(ref(db, `pendingRequests/${cred.user.uid}`), {
          name: name, email: email, requestedAt: Date.now()
        });
      } catch (err) {
        errorEl.textContent = friendlyAuthError(err);
        errorEl.style.display = 'block';
      }
    });

    document.getElementById('pending-logout-btn').addEventListener('click', () => signOut(auth));
    document.getElementById('app-logout-btn').addEventListener('click',     () => signOut(auth));

    // ===== Auth state =====
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (unsubscribeLedger) { unsubscribeLedger(); unsubscribeLedger = null; }
        showOnly(authSection);
        return;
      }
      try {
        const snap = await get(ref(db, `users/${user.uid}`));
        if (snap.exists()) {
          const data = snap.val();
          const roleBadgeEl = document.getElementById('who-role');
          document.getElementById('who-name').textContent = data.name || user.email;
          roleBadgeEl.textContent = data.role === 'admin' ? 'Admin' : 'Member';
          roleBadgeEl.className = 'role-badge ' + (data.role === 'admin' ? 'admin' : 'member');
          showOnly(appSection);
          if (data.role === 'admin') {
            adminPanel.classList.remove('hidden');
            loadPendingRequests();
          } else {
            adminPanel.classList.add('hidden');
          }
          subscribeToLedger(currentLedger(), user.uid);
        } else {
          showOnly(pendingSection);
        }
      } catch (err) {
        showOnly(pendingSection);
      }
    });

  } catch (err) {
    reportInitError('app-core', err);
  }
})();
