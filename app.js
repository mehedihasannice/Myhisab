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

const authSection = document.getElementById('auth-section');
const pendingSection = document.getElementById('pending-section');
const appSection = document.getElementById('app-section');
const adminPanel = document.getElementById('admin-panel');
const pendingListEl = document.getElementById('pending-list');

function showOnly(section) {
  [authSection, pendingSection, appSection].forEach(s => s.classList.add('hidden'));
  section.classList.remove('hidden');
}

// user-এর দেওয়া নাম/email textContent আর dataset দিয়ে বসানো হয় (নিচে),
// innerHTML string জোড়া না দেওয়ায় আলাদা করে escape করার দরকার নেই —
// browser নিজেই এই দুটো API-তে raw text হিসেবে safe ভাবে handle করে।

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
    // নতুন member হিসেবেই approve হয় — admin বানাতে হলে এখনো
    // Firebase Console-এ গিয়েই করতে হবে, ইচ্ছাকৃতভাবে।
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
    // সফল হলে onAuthStateChanged নিজেই screen বদলে দেবে, এখানে কিছু করার দরকার নেই।
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
    // admin panel-এ দেখানোর জন্য pending request লিখে রাখি — rule অনুযায়ী
    // নিজের uid-তে লেখা যায়, যতক্ষণ না /users-এ provisioned হয়।
    await set(ref(db, `pendingRequests/${cred.user.uid}`), {
      name: name,
      email: email,
      requestedAt: Date.now()
    });
    // onAuthStateChanged নিজেই pending screen দেখিয়ে দেবে।
  } catch (err) {
    errorEl.textContent = friendlyAuthError(err);
    errorEl.style.display = 'block';
  }
});

document.getElementById('pending-logout-btn').addEventListener('click', () => signOut(auth));
document.getElementById('app-logout-btn').addEventListener('click', () => signOut(auth));

const tabPersonal = document.getElementById('tab-personal');
const tabBusiness = document.getElementById('tab-business');
const modeLabel = document.getElementById('ledger-mode-label');

tabPersonal.addEventListener('click', () => {
  tabPersonal.classList.add('active');
  tabBusiness.classList.remove('active');
  modeLabel.textContent = 'Personal';
});
tabBusiness.addEventListener('click', () => {
  tabBusiness.classList.add('active');
  tabPersonal.classList.remove('active');
  modeLabel.textContent = 'Business';
});

// পুরো app-টা এই একটা observer দিয়ে চালিত — login/logout/page-load
// সব ক্ষেত্রেই এটাই ঠিক করে দেয় কোন screen দেখানো হবে।
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showOnly(authSection);
    return;
  }
  try {
    // এখানে user-এর নিজের idToken auto ব্যবহার হচ্ছে (SDK নিজেই সামলায়) —
    // Worker-এ যেমন REST দিয়ে করেছিলাম, এখানে SDK দিয়ে একই rule মেনে হচ্ছে।
    const snap = await get(ref(db, `users/${user.uid}`));
    if (snap.exists()) {
      const data = snap.val();
      document.getElementById('who-name').textContent = data.name || user.email;
      document.getElementById('who-role').textContent = data.role === 'admin' ? 'Admin' : 'Member';
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
    // RTDB read fail করলে ভুল করে app খুলে দেওয়ার চেয়ে pending দেখানো নিরাপদ।
    showOnly(pendingSection);
  }
});
