const I18N = {
  en: { popupDesc: "Fact check LinkedIn posts using AI. Click the Verity button next to any post to analyze its claims.", popupActive: "Active", settingsTitleAttr: "Settings" },
  es: { popupDesc: "Verifica publicaciones de LinkedIn con IA. Haz clic en el botón Verity junto a cualquier publicación para analizar sus afirmaciones.", popupActive: "Activo", settingsTitleAttr: "Configuración" },
  fr: { popupDesc: "Vérifiez les posts LinkedIn avec l'IA. Cliquez sur le bouton Verity à côté d'un post pour analyser ses affirmations.", popupActive: "Actif", settingsTitleAttr: "Paramètres" },
  de: { popupDesc: "Faktenprüfung von LinkedIn-Beiträgen mit KI. Klicken Sie auf die Verity-Schaltfläche neben einem Beitrag, um die Behauptungen zu analysieren.", popupActive: "Aktiv", settingsTitleAttr: "Einstellungen" }
};

// 1. Put all your startup code inside a single init function
function initExtensionUI() {
  console.log("Initializing UI...");

  // Handle Themes and Translations
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

  // Handle Settings Button Click
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      }
    });
  }
}

// 2. Run the safe-guard check
if (typeof document !== 'undefined') {
  if (document.readyState === "loading") {
    // Document is still parsing, wait for the event
    document.addEventListener("DOMContentLoaded", initExtensionUI);
  } else {
    // Document is already parsed/ready, run right now!
    initExtensionUI();
  }
}