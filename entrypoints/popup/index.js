const I18N = {
  en: { popupDesc: "Fact check LinkedIn posts using AI. Click the Verity button next to any post to analyze its claims.", popupActive: "Active", settingsTitleAttr: "Settings" },
  es: { popupDesc: "Verifica publicaciones de LinkedIn con IA. Haz clic en el botón Verity junto a cualquier publicación para analizar sus afirmaciones.", popupActive: "Activo", settingsTitleAttr: "Configuración" },
  fr: { popupDesc: "Vérifiez les posts LinkedIn avec l'IA. Cliquez sur le bouton Verity à côté d'un post pour analyser ses affirmations.", popupActive: "Actif", settingsTitleAttr: "Paramètres" },
  de: { popupDesc: "Faktenprüfung von LinkedIn-Beiträgen mit KI. Klicken Sie auf die Verity-Schaltfläche neben einem Beitrag, um die Behauptungen zu analysieren.", popupActive: "Aktiv", settingsTitleAttr: "Einstellungen" }
};

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get({ theme: 'light', uiLanguage: 'en' }, (items) => {
    if (items.theme === 'dark') document.body.classList.add('dark-theme');
    
    const dict = I18N[items.uiLanguage] || I18N['en'];
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) el.textContent = dict[key];
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (dict[key]) el.title = dict[key];
    });
  });
});

document.getElementById('settingsBtn').addEventListener('click', () => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options.html'));
  }
});

// --- Authentication: login/logout UI and storage ---
const SUPABASE_URL = 'https://gpyxoibtcjuabmujrxpq.supabase.co';
const SUPABASE_PUB_KEY = 'sb_publishable_RMvnK4S1r7txxEFAqmEWFg_L4OkhGwx';

function showMsg(msg, isError = true) {
  const el = document.getElementById('authMsg');
  if (!el) return;
  el.style.display = msg ? 'block' : 'none';
  el.style.color = isError ? '#ef4444' : '#16a34a';
  el.textContent = msg || '';
}

async function updateAuthUI() {
  const form = document.getElementById('loginForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const loginBtn = document.getElementById('loginBtn');
  const email = document.getElementById('email');

  chrome.storage.local.get(['token'], (res) => {
    const token = res && res.token;
    if (token) {
      // logged in
      form.style.display = 'flex';
      loginBtn.style.display = 'none';
      logoutBtn.style.display = 'block';
      email.value = '';
      showMsg('Logged in', false);
    } else {
      // not logged in
      form.style.display = 'flex';
      loginBtn.style.display = 'block';
      logoutBtn.style.display = 'none';
      showMsg('');
    }
  });
}

async function performLogin(emailVal, passwordVal) {
  try {
    showMsg('Logging in...', false);
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_PUB_KEY },
      body: JSON.stringify({ email: emailVal, password: passwordVal })
    });
    const data = await res.json();
    if (data.access_token) {
      chrome.storage.local.set({ token: data.access_token }, () => {
        showMsg('Logged in', false);
        updateAuthUI();
      });
    } else {
      showMsg(data.error_description || data.error || 'Login failed');
    }
  } catch (err) {
    showMsg(err.message || 'Network error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const email = document.getElementById('email');
  const password = document.getElementById('password');

  updateAuthUI();

  if (loginBtn) loginBtn.addEventListener('click', () => {
    const e = email.value.trim();
    const p = password.value;
    if (!e || !p) { showMsg('Enter email and password'); return; }
    performLogin(e, p);
  });

  if (logoutBtn) logoutBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['token'], () => {
      showMsg('Logged out', false);
      updateAuthUI();
    });
  });
});
