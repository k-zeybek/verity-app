// ============================================================
// Verity Chrome Extension – Content Script (Shadow DOM)
// Injects fact-checking widgets into LinkedIn feed posts.
// Uses Shadow DOM for style isolation and protection.
// ============================================================

const VERITY_API_URL = "https://verity.backnd.workers.dev";

// Settings & I18N
let userSettings = { theme: 'light', uiLanguage: 'en', outputMode: 'display' };
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.sync.get(['theme', 'uiLanguage', 'outputMode'], (res) => {
    if (res.theme) userSettings.theme = res.theme;
    if (res.uiLanguage) userSettings.uiLanguage = res.uiLanguage;
    if (res.outputMode) userSettings.outputMode = res.outputMode;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      if (changes.theme) userSettings.theme = changes.theme.newValue;
      if (changes.uiLanguage) userSettings.uiLanguage = changes.uiLanguage.newValue;
      if (changes.outputMode) userSettings.outputMode = changes.outputMode.newValue;
      updateAllPanels();
    }
  });
}

function updateAllPanels() {
  document.querySelectorAll('.verity-widget-host').forEach(host => {
    const panel = host.shadowRoot?.querySelector('.verity-panel');
    if (panel) {
      if (userSettings.theme === 'dark') panel.classList.add('dark-theme');
      else panel.classList.remove('dark-theme');
    }
  });
}

const I18N = {
  en: {
    analyzing: "Analyzing post...",
    failed: "Analysis failed.",
    logicalScore: "Logical Score",
    claims: "Claims",
    sources: "Sources:",
    conf: "conf.",
    fallacies: "Logical Fallacies",
    summary: "Evaluation Summary",
    verityAnalysis: "Verity Analysis",
    accurate: "Verified True",
    misleading: "Misleading",
    falseLabel: "False",
    unverifiable: "Unverifiable",
    fallacyLabel: "Fallacy"
  },
  es: {
    analyzing: "Analizando post...",
    failed: "Análisis fallido.",
    logicalScore: "Puntuación Lógica",
    claims: "Afirmaciones",
    sources: "Fuentes:",
    conf: "conf.",
    fallacies: "Falacias Lógicas",
    summary: "Resumen de Evaluación",
    verityAnalysis: "Análisis Verity",
    accurate: "Verificado",
    misleading: "Engañoso",
    falseLabel: "Falso",
    unverifiable: "No verificable",
    fallacyLabel: "Falacia"
  },
  fr: {
    analyzing: "Analyse du post...",
    failed: "Analyse échouée.",
    logicalScore: "Score Logique",
    claims: "Affirmations",
    sources: "Sources :",
    conf: "conf.",
    fallacies: "Sophismes Logiques",
    summary: "Résumé de l'évaluation",
    verityAnalysis: "Analyse Verity",
    accurate: "Vérifié",
    misleading: "Trompeur",
    falseLabel: "Faux",
    unverifiable: "Invérifiable",
    fallacyLabel: "Sophisme"
  },
  de: {
    analyzing: "Beitrag wird analysiert...",
    failed: "Analyse fehlgeschlagen.",
    logicalScore: "Logik-Score",
    claims: "Behauptungen",
    sources: "Quellen:",
    conf: "Konf.",
    fallacies: "Logikfehler",
    summary: "Zusammenfassung",
    verityAnalysis: "Verity-Analyse",
    accurate: "Verifiziert",
    misleading: "Irreführend",
    falseLabel: "Falsch",
    unverifiable: "Nicht verifizierbar",
    fallacyLabel: "Fehlschluss"
  }
};

function t(key) {
  const lang = userSettings.uiLanguage || 'en';
  return I18N[lang] && I18N[lang][key] ? I18N[lang][key] : I18N['en'][key];
}

// ── Selectors (Combines User-provided and Stable Fallbacks) ──────
const FEED_SELECTORS = [
  'main.scaffold-layout__main',
  '[data-testid="mainFeed"]',
  '[role="main"]'
];

const POST_SELECTORS = [
  'div[data-urn^="urn:li:activity:"]',
  'div[role="listitem"]'
];

const TEXT_SELECTORS = [
  '.feed-shared-update-v2__description',
  '[data-testid="expandable-text-box"]',
  '.update-components-text'
];

const OVERFLOW_SVG = 'svg[id*="overflow"]';
const MIN_TEXT_LEN = 50;

// State to track if we injected
let totalInjected = 0;

// ============================================================
// Logging Helper
// ============================================================
function log(...args) { console.log("[Verity]", ...args); }
function warn(...args) { console.warn("[Verity]", ...args); }

// ============================================================
// DOM Discovery Functions
// ============================================================

function findFeed() {
  for (const sel of FEED_SELECTORS) {
    const feed = document.querySelector(sel);
    if (feed) return feed;
  }
  return null;
}

function findPosts() {
  const feed = findFeed();
  if (!feed) return [];

  for (const sel of POST_SELECTORS) {
    const items = feed.querySelectorAll(sel);
    if (items.length > 0) {
      // Filter out items that don't have text
      return Array.from(items).filter(item => extractPostText(item).length >= MIN_TEXT_LEN);
    }
  }
  return [];
}

function extractPostText(post) {
  for (const sel of TEXT_SELECTORS) {
    const el = post.querySelector(sel);
    if (el) {
      const text = (el.innerText || el.textContent || "").trim();
      if (text.length > 30) return text;
    }
  }

  // Last-resort fallback: longest paragraph/span
  let best = "";
  post.querySelectorAll("p, span").forEach(s => {
    const t = (s.innerText || "").trim();
    if (t.length > best.length && t.length > MIN_TEXT_LEN) best = t;
  });
  return best;
}

function findMenuButton(post) {
  // Try to find the three-dot SVG
  const svg = post.querySelector(OVERFLOW_SVG);
  if (svg) {
    const btn = svg.closest("button");
    if (btn) return btn;
  }

  // Backup: find localized aria-labels
  const btns = post.querySelectorAll("button[aria-label]");
  for (const b of btns) {
    const label = (b.getAttribute("aria-label") || "").toLowerCase();
    if (
      label.includes("Kontrollmenü") ||
      label.includes("control menu") ||
      label.includes("more actions")
    ) {
      return b;
    }
  }
  return null;
}

// ============================================================
// Shadow DOM Injection
// ============================================================

function createShadowHost(id) {
  const host = document.createElement("div");
  host.className = "verity-widget-host";
  host.id = id;
  host.style.cssText = `
  display: inline-flex;
  align-items: center; 
  align-self: center;
  flex-shrink: 0; 
  position: relative; 
  z-index: 9999;
  height: 100%;`;
  return host;
}

function injectStyles(shadowRoot) {
  const style = document.createElement("style");
  style.textContent = `
    :host {
      display: inline-flex;
      align-items: center;
      position: relative;
      --verity-primary: #3b82f6;
      --verity-success: #22c55e;
      --verity-danger: #ef4444;
      --verity-warning: #f59e0b;
      --verity-background: #ffffff;
      --verity-foreground: #0f172a;
      --verity-muted: #64748b;
      --verity-muted-foreground: #94a3b8;
      --verity-border: #e2e8f0;
      --verity-card: #ffffff;
      --verity-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
      --verity-radius: 12px;
    }
    
    .verity-trigger {
      all: initial;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 0;
      margin: 0;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      color: var(--verity-primary);
    }
    .verity-trigger:hover {
      background: rgba(59, 130, 246, 0.1);
    }
    .verity-trigger.active {
      background: rgba(59, 130, 246, 0.15);
      color: var(--verity-primary);
    }
    .verity-icon, .verity-spinner {
      width: 20px;
      height: 20px;
      stroke: var(--verity-primary);
      display: block;
    }
    .verity-spinner {
      display: none;
      animation: spin 1s linear infinite;
    }
    .loading .verity-icon { display: none; }
    .loading .verity-spinner { display: block; }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    /* Floating Fallback */
    :host(.floating) {
      position: absolute !important;
      top: 12px;
      right: 48px;
      z-index: 100;
    }

    /* Panel Styles */
    .verity-panel {
      position: absolute;
      top: 100%;
      right: 0;
      width: 380px;
      background: var(--verity-card);
      border: 1px solid var(--verity-border);
      border-radius: var(--verity-radius);
      box-shadow: var(--verity-shadow);
      font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      color: var(--verity-foreground);
      flex-direction: column;
      overflow-y: auto !important;
      cursor: default;
      z-index: 10000;
      backdrop-filter: blur(12px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      animation: verity-slide-down 0.2s ease-out;
      -webkit-overflow-scrolling: touch;
    }
    
    .verity-panel.open {
      display: flex;
    }

    .verity-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--verity-border);
      background: rgba(248, 250, 252, 0.8);
      border-radius: var(--verity-radius) var(--verity-radius) 0 0;
      flex-shrink: 0;
    }
    .verity-logo {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      font-size: 14px;
      color: var(--verity-foreground);
    }
    .verity-logo-icon {
      width: 24px;
      height: 24px;
      background: var(--verity-primary);
      color: #fff;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 13px;
    }
    .verity-settings-btn,
    .verity-close {
      all: initial;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      cursor: pointer;
      color: var(--verity-muted);
      transition: all 0.2s ease;
    }
    .verity-settings-btn:hover,
    .verity-close:hover {
      background: var(--verity-border);
      color: var(--verity-foreground);
    }
    .verity-settings-btn svg,
    .verity-close svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
    }

    .verity-content {
      padding: 16px;
      flex: 1;
      overflow-y: auto;
      max-height: 500px;
      overscroll-behavior: contain;
    }

    .verity-content::-webkit-scrollbar { width: 6px; }
    .verity-content::-webkit-scrollbar-thumb { background: var(--verity-border); border-radius: 10px; }
    
    .verity-loading {
      display: flex; flex-direction: column; align-items: center; padding: 48px 0; gap: 16px;
    }
    .loader-circle { 
      width: 32px; 
      height: 32px; 
      border: 3px solid var(--verity-border); 
      border-top-color: var(--verity-primary); 
      border-radius: 50%; 
      animation: spin 1s linear infinite; 
    }
    
    .section-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--verity-muted-foreground);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 20px 0 12px 0;
    }
    .section-title:first-child { margin-top: 0; }

    /* Score Section */
    .score-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding-bottom: 24px;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--verity-border);
    }
    
    .verity-score-ring { width: 100px; height: 100px; position: relative; }
    .verity-score-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); overflow: visible; }
    .verity-ring-bg { fill: none; stroke: var(--verity-border); stroke-width: 6; }
    .verity-ring-fg { 
      fill: none; 
      stroke: var(--score-color); 
      stroke-width: 6; 
      stroke-linecap: round; 
      stroke-dasharray: 251.2; 
      transition: stroke-dashoffset 1s ease-out;
    }
    .verity-score-value {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      font-size: 28px; font-weight: 800; color: var(--score-color);
      font-variant-numeric: tabular-nums;
    }

    .rating-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 100px;
      font-weight: 600;
      font-size: 15px;
      border: 1px solid transparent;
      width: fit-content;
      margin: 0 auto;
      white-space: nowrap;
    }
    .rating-badge svg {
      width: 14px;
      height: 14px;
    }
    
    .score-high { --score-color: var(--verity-success); }
    .score-mid { --score-color: var(--verity-warning); }
    .score-low { --score-color: var(--verity-danger); }

    .rating-accurate { background: rgba(34, 197, 94, 0.1); color: var(--verity-success); border-color: rgba(34, 197, 94, 0.2); }
    .rating-misleading { background: rgba(245, 158, 11, 0.1); color: var(--verity-warning); border-color: rgba(245, 158, 11, 0.2); }
    .rating-false { background: rgba(239, 68, 68, 0.1); color: var(--verity-danger); border-color: rgba(239, 68, 68, 0.2); }

    /* Cards */
    .verity-card {
      position: relative;
      padding: 16px;
      border-radius: var(--verity-radius);
      border: 1px solid var(--verity-border);
      background: rgba(255, 255, 255, 0.5);
      margin-bottom: 12px;
      transition: all 0.2s ease;
    }
    .verity-card:hover {
      background: rgba(255, 255, 255, 0.8);
      border-color: rgba(59, 130, 246, 0.3);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
    
    .card-icon-box {
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 12px;
    }
    
    .claim-card.verdict-true { border-left: 6px solid var(--verity-success); }
    .claim-card.verdict-false { border-left: 6px solid var(--verity-danger); }
    .claim-card.verdict-misleading { border-left: 6px solid var(--verity-warning); }
    
    .fallacy-card { 
      background: rgba(245, 158, 11, 0.05); 
      border-color: rgba(245, 158, 11, 0.2); 
    }
    .fallacy-card:hover { background: rgba(245, 158, 11, 0.1); }
    .fallacy-card .card-icon-box { background: rgba(245, 158, 11, 0.2); color: var(--verity-warning); }

    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .card-title { font-weight: 600; font-size: 14px; margin: 0; }
    .card-label { font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .card-meta { font-size: 10px; color: var(--verity-muted-foreground); display: flex; align-items: center; gap: 4px; }
    .card-meta svg { width: 12px; height: 12px; flex-shrink: 0; }
    
    .card-body { font-size: 13px; line-height: 1.5; color: var(--verity-foreground); }
    .card-summary { font-size: 12px; color: var(--verity-muted); margin-top: 8px; line-height: 1.4; }

    .sources-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .source-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 6px;
      background: var(--verity-background);
      border: 1px solid var(--verity-border);
      font-size: 11px;
      color: var(--verity-foreground);
      text-decoration: none;
      transition: all 0.2s ease;
    }
    .source-tag:hover { background: var(--verity-border); border-color: var(--verity-muted-foreground); }
    .source-tag svg { width: 12px; height: 12px; flex-shrink: 0; color: var(--verity-muted); }
    .source-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .dot-supports { background: var(--verity-success); }
    .dot-contradicts { background: var(--verity-danger); }

    .verity-footer {
      padding: 10px 16px;
      border-top: 1px solid var(--verity-border);
      background: rgba(248, 250, 252, 0.5);
      text-align: center;
      font-size: 10px;
      color: var(--verity-muted-foreground);
    }

    /* Dark Theme */
    .verity-panel.dark-theme {
      --verity-background: #0f172a;
      --verity-foreground: #f1f5f9;
      --verity-muted: #94a3b8;
      --verity-border: #334155;
      --verity-card: rgba(30, 41, 59, 0.95);
      --verity-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
    }
    .verity-panel.dark-theme .verity-header { background: rgba(15, 23, 42, 0.8); }
    .verity-panel.dark-theme .verity-footer { background: rgba(15, 23, 42, 0.5); }
    .verity-panel.dark-theme .verity-card { background: rgba(51, 65, 85, 0.4); }
    .verity-panel.dark-theme .verity-card:hover { background: rgba(51, 65, 85, 0.6); }
    .verity-panel.dark-theme .source-tag { background: rgba(15, 23, 42, 0.5); }
  `;
  shadowRoot.appendChild(style);
}

const ICONS = {
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
  xCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  octagon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2z"></path><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
};

function buildUI(shadowRoot, postText) {
  const container = document.createElement("div");

  const btn = document.createElement("button");
  btn.className = "verity-trigger";
  btn.innerHTML = `
    <svg class="verity-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      <polyline points="9 12 11 14 15 10"></polyline>
    </svg>
    <svg class="verity-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"></circle>
    </svg>
  `;

  const panel = document.createElement("div");
  panel.className = "verity-panel" + (userSettings.theme === 'dark' ? " dark-theme" : "");
  panel.innerHTML = `
    <div class="verity-header">
      <div class="verity-logo">
        <span class="verity-logo-icon">V</span><span>${t('verityAnalysis')}</span>
      </div>
      <div style="display:flex; gap:4px; align-items:center;">
        <button class="verity-settings-btn" title="Settings">${ICONS.settings}</button>
        <button class="verity-close">${ICONS.close}</button>
      </div>
    </div>
    <div class="verity-content">
      <div class="verity-loading">
        <div class="loader-circle"></div>
        <p style="font-weight: 500; font-size: 13px;">${t('analyzing')}</p>
      </div>
      <div class="verity-error" style="display:none; color:var(--verity-danger); text-align:center; padding: 24px;"></div>
      <div class="verity-results"></div>
    </div>
    <div class="verity-footer">
      Powered by Verity AI • High Fidelity Fact-Checking
    </div>
  `;
  panel.addEventListener("wheel", (e) => {
    e.stopPropagation();
  }, { passive: true });

  let hasAnalyzed = false;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const isOpen = panel.classList.contains("open");
    if (isOpen) {
      panel.style.display = "none";
      btn.classList.remove("active");
    } else {
      panel.style.display = "flex";
      panel.style.flexDirection = "column";
      btn.classList.add("active");

      if (!hasAnalyzed) {
        hasAnalyzed = true;
        btn.classList.add("loading");
        doAnalysis(panel, postText).finally(() => btn.classList.remove("loading"));
      }
    }
  });

  panel.querySelector(".verity-close").addEventListener("click", () => {
    panel.style.display = "none";
    btn.classList.remove("active");
  });

  panel.querySelector(".verity-settings-btn").addEventListener("click", () => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ action: "openOptionsPage" });
    }
  });

  // Close when clicking outside
  document.addEventListener("click", (e) => {
    const isClickInside = e.composedPath().includes(shadowRoot.host);
    if (!isClickInside && panel.style.display === "flex") {
      panel.style.display = "none";
      btn.classList.remove("active");
    }
  });

  container.appendChild(btn);
  container.appendChild(panel);
  shadowRoot.appendChild(container);

  panel.style.display = "none";
}

// ============================================================
// Core Analysis Logic
// ============================================================

async function doAnalysis(panel, text) {
  const ld = panel.querySelector(".verity-loading");
  const rs = panel.querySelector(".verity-results");
  const er = panel.querySelector(".verity-error");

  ld.style.display = "flex"; rs.style.display = "none"; er.style.display = "none";

  try {
    const analysisLanguage = userSettings.outputMode === 'article' ? null : userSettings.uiLanguage;

    const resp = await fetch(VERITY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        language: analysisLanguage
      })
    });

    if (!resp.ok) throw new Error(`API returned ${resp.status}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error);

    renderData(rs, data);
    ld.style.display = "none";
    rs.style.display = "block";
  } catch (err) {
    warn("Analysis failed:", err);
    ld.style.display = "none";
    er.style.display = "flex";
    er.textContent = "Failed: " + err.message;
  }
}

function renderData(container, data) {
  const getVerdictConfig = (v) => {
    if (v === "accurate") return { label: t('accurate'), tagClass: "rating-accurate", icon: ICONS.check };
    if (v === "false") return { label: t('falseLabel'), tagClass: "rating-false", icon: ICONS.xCircle };
    if (v === "misleading") return { label: t('misleading'), tagClass: "rating-misleading", icon: ICONS.alert };
    return { label: t('unverifiable'), tagClass: "", icon: ICONS.help };
  };

  const score = data.logical_score;

  const scoreClass = score >= 70 ? 'score-high' : (score >= 40 ? 'score-mid' : 'score-low');
  const offset = 251.2 - (251.2 * score) / 100;

  const ratingCfg = getVerdictConfig(data.overall_rating);

  let html = `
    <div class="score-container ${scoreClass}">
      <div class="verity-score-ring">
        <svg viewBox="0 0 100 100">
          <circle class="verity-ring-bg" cx="50" cy="50" r="40" />
          <circle class="verity-ring-fg" cx="50" cy="50" r="40" style="stroke-dashoffset: ${offset};" />
        </svg>
        <div class="verity-score-value">${score}</div>
      </div>
      <div class="rating-badge ${ratingCfg.tagClass}">
        ${ratingCfg.icon}
        <span>${ratingCfg.label}</span>
      </div>
    </div>

    <div class="section-title">${t('summary')}</div>
    <div class="card-body" style="margin-bottom: 24px;">${data.explanation || ''}</div>
  `;

  // Fallacies
  if (data.fallacies && data.fallacies.length > 0) {
    html += `<div class="section-title">${t('fallacies')} (${data.fallacies.length})</div>`;
    data.fallacies.forEach((f, i) => {
      html += `
        <div class="verity-card fallacy-card">
          <div class="card-header">
            <h4 class="card-title" style="text-transform: capitalize;">${f.name.replace(/_/g, ' ')}</h4>
            <span class="card-label" style="color:var(--verity-warning)">${t('fallacyLabel')}</span>
          </div>
          <div class="card-body">${f.explanation}</div>
        </div>
      `;
    });
  }

  // Claims
  if (data.claims && data.claims.length > 0) {
    html += `<div class="section-title">${t('claims')} (${data.claims.length})</div>`;
    data.claims.forEach(c => {
      const cfg = getVerdictConfig(c.verdict);
      let sourcesHtml = "";
      if (c.sources && c.sources.length) {
        sourcesHtml = `<div class="sources-list">${c.sources.slice(0, 3).map(s => {
          let domain = "Link";
          try { domain = new URL(s.url).hostname.replace('www.', ''); } catch (e) { }
          return `
            <a href="${s.url}" class="source-tag" target="_blank">
              <span class="source-dot ${s.supports ? 'dot-supports' : 'dot-contradicts'}"></span>
              <span>${domain}</span>
              ${ICONS.external}
            </a>`;
        }).join("")}</div>`;
      }

      html += `
        <div class="verity-card claim-card verdict-${c.verdict}">
          <div class="card-header">
            <div class="card-meta">
              ${cfg.icon}
              <span style="font-weight:600;">${cfg.label}</span>
            </div>
            <div class="card-meta">
              ${ICONS.shield}
              <span>${c.confidence}% ${t('conf')}</span>
            </div>
          </div>
          <div class="card-body">"${c.text}"</div>
          <div class="card-summary">${c.summary}</div>
          ${sourcesHtml}
        </div>
      `;
    });
  }

  container.innerHTML = html;
}

// ============================================================
// Orchestration
// ============================================================

function processPost(post) {
  const text = extractPostText(post);
  if (!text) return false;

  const existingHost = post.querySelector('.verity-widget-host');
  if (existingHost) {
    // Check if the DOM node was recycled by React for a different post
    if (existingHost.dataset.verityTextLen === String(text.length)) return false;
    // Node was recycled. Remove the outdated widget
    existingHost.remove();
  }

  const menuBtn = findMenuButton(post);
  if (!menuBtn || !menuBtn.parentElement) return false; // Checks if menu button exists, if not then not a valid post

  // 1. Create Shadow Host
  const hostId = "verity-host-" + Math.random().toString(36).slice(2, 11);
  const host = createShadowHost(hostId);
  host.dataset.verityTextLen = String(text.length);

  // 2. Attach Shadow DOM
  const shadow = host.attachShadow({ mode: "open" });
  injectStyles(shadow);
  buildUI(shadow, text);

  // 3. Inject logic
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "4px";

  menuBtn.parentElement.insertBefore(wrapper, menuBtn);
  wrapper.appendChild(host);
  wrapper.appendChild(menuBtn);

  const btnRect = menuBtn.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();

  const deltaY = (btnRect.top + btnRect.height / 2) - (hostRect.top + hostRect.height / 2);
  host.style.transform = `translateY(${deltaY}px)`;

  totalInjected++;
  return true;
}

function scan() {
  const posts = findPosts();
  let count = 0;
  for (const p of posts) {
    if (processPost(p)) count++;
  }
  if (count > 0) log(`Scanned ${posts.length} feed elements. Injected ${count} new widgets.`);
}

// ============================================================
// Initialization & Observers
// ============================================================

let debounceTimer = null;
function onDomMutation() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(scan, 300);
}

function init() {
  log("Initializing Shadow DOM Injector using user-provided + stable selectors");

  // Try immediate injection
  scan();

  // Setup retries for slow-loading SPA
  let retries = 0;
  const iv = setInterval(() => {
    scan();
    if (++retries > 10) clearInterval(iv);
  }, 1000);

  // Observer
  const observer = new MutationObserver(onDomMutation);
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

/* 
IMPORTANT:
STRING FORMAT:
` [...] ` and ` ${variable} `
STOP PUTTING BACKSLASHES IN FRONT OF DOLLAR SIGNS AND BACKTICKS
*/