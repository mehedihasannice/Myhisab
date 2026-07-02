import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { getDatabase, ref, get, set, remove } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyBmWURw03HyycLImNR-erXY_AAHY9jRDP0",
  authDomain: "my-hisab-d6f6d.firebaseapp.com",
  databaseURL: "https://my-hisab-d6f6d-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "my-hisab-d6f6d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// --- Theme (day/night) ---
// localStorage try-catch দিয়ে wrap করা — private browsing বা storage
// ব্লক থাকা অবস্থাতেও যেন পুরো app ভেঙে না পড়ে, শুধু persist না হোক।
const themeToggleBtn = document.getElementById('theme-toggle');
const themeColorMeta = document.getElementById('theme-color-meta');

function getPreferredTheme() {
  try {
    const stored = localStorage.getItem('myhisab-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (e) { /* fallback নিচে */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  themeColorMeta.setAttribute('content', theme === 'dark' ? '#000000' : '#FFFFFF');
  try {
    localStorage.setItem('myhisab-theme', theme);
  } catch (e) { /* non-critical */ }
}

applyTheme(getPreferredTheme());
themeToggleBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// --- Section switching ---
const authSection = document.getElementById('auth-section');
const pendingSection = document.getElementById('pending-section');
const appSection = document.getElementById('app-section');
const adminPanel = document.getElementById('admin-panel');
const pendingListEl = document.getElementById('pending-list');

function showOnly(section) {
  [authSection, pendingSection, appSection].forEach(s => s.classList.add('hidden'));
  section.classList.remove('hidden');
}

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

function friendlyAuthError(err) {
  const map = {
    'auth/invalid-email': 'Email format ঠিক নেই।',
    'auth/user-not-found': 'এই email দিয়ে কোনো account নেই।',
    'auth/wrong-password': 'Password ভুল হয়েছে।',
    'auth/invalid-credential': 'Email অথবা password ভুল।',
    'auth/email-already-in-use': 'এই email দিয়ে আগেই account আছে, login করো।',
    'auth/weak-password': 'Password কমপক্ষে ৬ character হতে হবে।',
    'auth/too-many-requests': 'অনেকবার চেষ্টা হয়েছে, একটু পর আবার চেষ্টা করো।'
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
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
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
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const errorEl = document.getElementById('signup-error');
  errorEl.style.display = 'none';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await set(ref(db, `pendingRequests/${cred.user.uid}`), {
      name: name,
      email: email,
      requestedAt: Date.now()
    });
  } catch (err) {
    errorEl.textContent = friendlyAuthError(err);
    errorEl.style.display = 'block';
  }
});

document.getElementById('pending-logout-btn').addEventListener('click', () => signOut(auth));
document.getElementById('app-logout-btn').addEventListener('click', () => signOut(auth));

// --- Personal/Business sliding toggle ---
const tabPersonal = document.getElementById('tab-personal');
const tabBusiness = document.getElementById('tab-business');
const segmentIndicator = document.getElementById('segment-indicator');
const modeLabel = document.getElementById('ledger-mode-label');

tabPersonal.addEventListener('click', () => {
  tabPersonal.classList.add('active');
  tabBusiness.classList.remove('active');
  segmentIndicator.classList.remove('business');
  modeLabel.textContent = 'Personal';
});
tabBusiness.addEventListener('click', () => {
  tabBusiness.classList.add('active');
  tabPersonal.classList.remove('active');
  segmentIndicator.classList.add('business');
  modeLabel.textContent = 'Business';
});

// --- Auth state observer: drives which screen shows ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
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
    } else {
      showOnly(pendingSection);
    }
  } catch (err) {
    showOnly(pendingSection);
  }
});
