const I18N = {
  en: { 
    settingsTitle: "Verity Settings", 
    themeLabel: "Theme", themeLight: "Light", themeDark: "Dark", 
    displayLanguageLabel: "Display Language", 
    outputLanguageLabel: "Output Language",
    outputModeDisplay: "Same as Display Language",
    outputModeArticle: "Same as Article Language",
    saveBtn: "Save Settings", savedMsg: "Settings saved." 
  },
  es: { 
    settingsTitle: "Configuración de Verity", 
    themeLabel: "Tema", themeLight: "Claro", themeDark: "Oscuro", 
    displayLanguageLabel: "Idioma de Pantalla", 
    outputLanguageLabel: "Idioma de Salida",
    outputModeDisplay: "Igual que el idioma de pantalla",
    outputModeArticle: "Igual que el idioma del artículo",
    saveBtn: "Guardar", savedMsg: "Configuración guardada." 
  },
  fr: { 
    settingsTitle: "Paramètres Verity", 
    themeLabel: "Thème", themeLight: "Clair", themeDark: "Sombre", 
    displayLanguageLabel: "Langue d'affichage", 
    outputLanguageLabel: "Langue de sortie",
    outputModeDisplay: "Identique à la langue d'affichage",
    outputModeArticle: "Identique à la langue de l'article",
    saveBtn: "Enregistrer", savedMsg: "Paramètres enregistrés." 
  },
  de: { 
    settingsTitle: "Verity-Einstellungen", 
    themeLabel: "Thema", themeLight: "Hell", themeDark: "Dunkel", 
    displayLanguageLabel: "Anzeigesprache", 
    outputLanguageLabel: "Ausgabesprache",
    outputModeDisplay: "Wie Anzeigesprache",
    outputModeArticle: "Wie Artikelsprache",
    saveBtn: "Speichern", savedMsg: "Einstellungen gespeichert." 
  }
};

function applyThemeAndLanguage(theme, lang) {
  if (theme === 'dark') document.body.classList.add('dark-theme');
  else document.body.classList.remove('dark-theme');

  const dict = I18N[lang] || I18N['en'];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });
}

function restoreOptions() {
  chrome.storage.sync.get({ 
    theme: 'light', 
    uiLanguage: 'en',
    outputMode: 'display'
  }, (items) => {
    document.getElementById('theme').value = items.theme;
    document.getElementById('uiLanguage').value = items.uiLanguage;
    document.getElementById('outputMode').value = items.outputMode;
    applyThemeAndLanguage(items.theme, items.uiLanguage);
  });
}

function saveOptions() {
  const theme = document.getElementById('theme').value;
  const uiLanguage = document.getElementById('uiLanguage').value;
  const outputMode = document.getElementById('outputMode').value;

  chrome.storage.sync.set({ theme, uiLanguage, outputMode }, () => {
    applyThemeAndLanguage(theme, uiLanguage);
    const status = document.getElementById('status');
    const dict = I18N[uiLanguage] || I18N['en'];
    status.textContent = dict.savedMsg;
    setTimeout(() => { status.textContent = ''; }, 2000);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  restoreOptions();
  const saveBtn = document.getElementById('save');
  if (saveBtn) saveBtn.addEventListener('click', saveOptions);
});

// Also listen for changes from other pages (like the widget)
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      restoreOptions();
    }
  });

  // Provide a harmless default export for the bundler in CommonJS environments.
  if (typeof module !== 'undefined' && module.exports) module.exports = {};
}
