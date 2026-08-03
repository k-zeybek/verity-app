import { getToken, requestMagicLink } from './auth.js';

// ============================================================
// Verity Chrome Extension – Content Script (Shadow DOM)
// Injects fact-checking widgets into LinkedIn feed posts.
// Uses Shadow DOM for style isolation and protection.
// ============================================================

export default defineContentScript({
    matches: ["*://*.linkedin.com/*"],
    runAt: "document_idle",
    main() {
    
const SUPABASE_URL = import.meta.env.DEV
  ? "https://verity-staging.backnd.workers.dev"
  : "https://verity.backnd.workers.dev";

const VERITY_SITE_URL = import.meta.env.DEV
  ? "https://verity-site-staging.backnd.workers.dev"
  : "https://verity.dpdns.org";

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
    
    if (area === 'local' && changes.supabase_session) {
      const newSession = changes.supabase_session.newValue;
      
      const isShowingLoginScreen = floatingPanel && floatingPanel.querySelector('#v_email');

      if (isShowingLoginScreen && newSession) {
        log("Magic link login detected. Automatically closing popup.");
        closeFloatingPanel();
      } 
      
      else if (!newSession && !isShowingLoginScreen) {
        setTimeout(() => {
          chrome.storage.local.get(['supabase_session'], (res) => {
            if (!res.supabase_session) {
              log("Session definitively cleared (logout/cache wipe). Closing popup.");
              closeFloatingPanel();
            } else {
              log("Transient token refresh ignored. Keeping popup open.");
            }
          });
        }, 200);
      }
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

  const floatingHost = document.getElementById('verity-floating-panel-host');
  if (floatingHost) {
    const panel = floatingHost.shadowRoot?.querySelector('.verity-panel');
    if (panel) {
      if (userSettings.theme === 'dark') panel.classList.add('dark-theme');
      else panel.classList.remove('dark-theme');
    }
  }
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
    phaseExtracting: "Extracting claims...",
    phaseSearching: "Searching the web...",
    phaseEvaluating: "Evaluating truth...",
    accurate: "Accurate", 
    misleading: "Misleading",
    //unsupportedLabel: "Unsupported",
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
    phaseExtracting: "Extrayendo afirmaciones...",
    phaseSearching: "Buscando en la web...",
    phaseEvaluating: "Evaluando la veracidad...",
    accurate: "Verificado",
    misleading: "Engañoso",
    //unsupportedLabel: "No respaldado",
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
    phaseExtracting: "Extraction des affirmations...",
    phaseSearching: "Recherche sur le web...",
    phaseEvaluating: "Évaluation de la véracité...",
    accurate: "Vérifié",
    misleading: "Trompeur",
    //unsupportedLabel: "Non étayé",
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
    phaseExtracting: "Behauptungen werden extrahiert...",
    phaseSearching: "Websuche läuft...",
    phaseEvaluating: "Wahrheitsgehalt wird bewertet...",
    accurate: "Verifiziert",
    misleading: "Irreführend",
    //unsupportedLabel: "Nicht unterstützt",
    falseLabel: "Falsch",
    unverifiable: "Nicht verifizierbar",
    fallacyLabel: "Fehlschluss"
  }
};

function t(key) {
  const lang = userSettings.uiLanguage || 'en';
  return I18N[lang] && I18N[lang][key] ? I18N[lang][key] : I18N['en'][key];
}

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

let totalInjected = 0;
let lastUrl = location.href;

function log(...args) { console.log("[Verity]", ...args); }
function warn(...args) { console.warn("[Verity]", ...args); }

function recordLocalDiagnostics(latencyMs, status, responseData, rawText, uiLang, analysisLang) {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    warn("Chrome local storage unavailable for diagnostics.");
    return;
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    status,
    latencyMs,
    settings: {
      uiLanguage: uiLang,
      analysisLanguage: analysisLang
    },
    payload: {
      charCount: rawText.length,
      claimsCount: responseData.claims?.length || 0,
      fallaciesCount: responseData.fallacies?.length || 0,
      post: rawText,
      analysis: responseData
    }
  };

  chrome.storage.local.get(['verity_diagnostics'], (result) => {
    const logs = result.verity_diagnostics || [];
    logs.push(logEntry);

    //if (logs.length > 200) logs.shift();

    chrome.storage.local.set({ verity_diagnostics: logs }, () => {
      log(`Diagnostic saved locally. Latency: ${latencyMs}ms`);
    });
  });
}

function clearDiagnostics() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    warn("Chrome local storage unavailable.");
    return;
  }
  chrome.storage.local.remove('verity_diagnostics', () => {
    log("Diagnostics cache cleared.");
  });
}

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

  let best = "";
  post.querySelectorAll("p, span").forEach(s => {
    const txt = (s.innerText || "").trim();
    if (txt.length > best.length && txt.length > MIN_TEXT_LEN) best = txt;
  });
  return best;
}

function findPostTextElement(post) {
  for (const sel of TEXT_SELECTORS) {
    const el = post.querySelector(sel);
    if (el) {
      const text = (el.innerText || el.textContent || "").trim();
      if (text.length > 30) return el;
    }
  }
  let best = null, bestLen = 0;
  post.querySelectorAll("p, span").forEach(s => {
    const txt = (s.innerText || "").trim();
    if (txt.length > bestLen && txt.length > MIN_TEXT_LEN) {
      best = s;
      bestLen = txt.length;
    }
  });
  return best;
}

function findMenuButton(post) {
  const svg = post.querySelector(OVERFLOW_SVG);
  if (svg) {
    const btn = svg.closest("button");
    if (btn) return btn;
  }

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

let floatingPanelHost = null;
let floatingPanelShadow = null;
let floatingPanel = null;
let activeAnchor = null;
let positionRafId = null;
let dragState = null; // { startX, startY, startLeft, startTop }

function ensureFloatingHost() {
  if (floatingPanelHost) return;

  floatingPanelHost = document.createElement('div');
  floatingPanelHost.id = 'verity-floating-panel-host';
  
  floatingPanelHost.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    overflow: visible;
    pointer-events: none;
    mix-blend-mode: normal; 
    z-index: 2147483647; 
  `;
  document.body.appendChild(floatingPanelHost);

  floatingPanelShadow = floatingPanelHost.attachShadow({ mode: 'open' });
  injectFloatingStyles(floatingPanelShadow);

  floatingPanel = document.createElement('div');
  floatingPanel.className = 'verity-panel' + (userSettings.theme === 'dark' ? ' dark-theme' : '');
  floatingPanel.style.display = 'none';
  floatingPanel.style.pointerEvents = 'auto';
  floatingPanelShadow.appendChild(floatingPanel);

  document.addEventListener('click', (e) => {
    if (!floatingPanel || floatingPanel.style.display === 'none') return;
    const path = e.composedPath();
    if (!path.includes(floatingPanel) && (!activeAnchor || !path.includes(activeAnchor))) {
      closeFloatingPanel();
    }
  }, true);
}

function injectFloatingStyles(shadowRoot) {
  const style = document.createElement('style');
  style.textContent = `
    :host {
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
      --verity-shadow: 0 10px 30px -10px rgba(0,0,0,0.15), 0 4px 6px -4px rgba(0,0,0,0.1);
      --verity-radius: 12px;
    }

    .verity-panel {
      position: absolute;
      width: 380px;
      background: var(--verity-card);
      border: 1px solid var(--verity-border);
      border-radius: var(--verity-radius);
      box-shadow: var(--verity-shadow);
      font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      color: var(--verity-foreground);
      flex-direction: column;
      cursor: default;
      z-index: 2147483647;
      backdrop-filter: blur(12px);
      animation: verity-slide-down 0.2s ease-out;
      max-height: 80vh;
      overflow: hidden;
    }
    .verity-panel.open {
      display: flex;
    }
    .verity-panel.no-animation {
      animation: none;
    }
    @keyframes verity-slide-down {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .verity-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--verity-border);
      background: rgba(248,250,252,0.8);
      border-radius: var(--verity-radius) var(--verity-radius) 0 0;
      flex-shrink: 0;
      cursor: grab;
      user-select: none;
    }
    .verity-header.dragging {
      cursor: grabbing;
    }
    .verity-header button {
      cursor: pointer;
    }
    .verity-logo {
      width: 28px;
      height: 28px; 
      object-fit: contain;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .verity-retry-wrapper {
      display: flex;
      justify-content: center;
      padding-bottom: 24px;
    }

    /* Reusable button class */
    .verity-btn {
      padding: 9px 16px; 
      border-radius: 6px;
      background: var(--verity-primary);
      color: #fff;
      border: none;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      width: max-content; 
      display: inline-block;
      transition: opacity 0.2s ease;
      display: block;
      width: max-content;
      align-self: center;
      margin: 0 auto;
    }

    .verity-btn:hover {
      opacity: 0.9;
    }
    .verity-settings-btn, .verity-close {
      all: initial; display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border-radius: 6px; cursor: pointer;
      color: var(--verity-muted); transition: all 0.2s ease;
    }
    .verity-settings-btn:hover, .verity-close:hover {
      background: var(--verity-border); color: var(--verity-foreground);
    }
    .verity-settings-btn svg, .verity-close svg { width: 16px; height: 16px; stroke: currentColor; }

    .verity-content {
      padding: 16px; flex: 1; overflow-y: auto;
      overscroll-behavior: contain;
    }
    .verity-content::-webkit-scrollbar { width: 6px; }
    .verity-content::-webkit-scrollbar-thumb { background: var(--verity-border); border-radius: 10px; }

    .verity-loading {
      display: flex; flex-direction: column; align-items: center; padding: 48px 0; gap: 16px;
    }
    .loader-circle {
      width: 32px; height: 32px; border: 3px solid var(--verity-border);
      border-top-color: var(--verity-primary); border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    .verity-phases {
      display: flex; flex-direction: column; align-items: stretch; gap: 14px; width: 100%;
      padding: 8px 8px 4px 8px;
    }
    .verity-phase {
      display: flex; align-items: center; gap: 10px;
      font-size: 13px; color: var(--verity-muted-foreground);
      opacity: 0.6; transition: opacity 0.3s ease, color 0.3s ease;
    }
    .verity-phase.active { opacity: 1; color: var(--verity-foreground); font-weight: 600; }
    .verity-phase.done { opacity: 0.9; color: var(--verity-success); }
    .phase-icon {
      width: 20px; height: 20px; display: inline-flex; align-items: center;
      justify-content: center; flex-shrink: 0;
    }
    .phase-spinner {
      width: 14px; height: 14px; border: 2px solid var(--verity-border);
      border-top-color: var(--verity-primary); border-radius: 50%;
      animation: spin 0.8s linear infinite; display: none;
    }
    .phase-check { display: none; color: var(--verity-success); font-weight: 700; font-size: 14px; }
    .phase-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--verity-border); display: block; }
    .verity-phase.active .phase-spinner { display: block; }
    .verity-phase.active .phase-dot { display: none; }
    .verity-phase.done .phase-check { display: block; }
    .verity-phase.done .phase-spinner { display: none; }
    .verity-phase.done .phase-dot { display: none; }

    .section-title {
      font-size: 11px; font-weight: 600; color: var(--verity-muted-foreground);
      text-transform: uppercase; letter-spacing: 0.05em; margin: 20px 0 12px 0;
    }
    .section-title:first-child { margin-top: 0; }

    .score-container {
      display: flex; flex-direction: column; align-items: center; gap: 16px;
      padding-bottom: 24px; margin-bottom: 24px; border-bottom: 1px solid var(--verity-border);
    }
    .verity-score-ring { width: 100px; height: 100px; position: relative; }
    .verity-score-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); overflow: visible; }
    .verity-ring-bg { fill: none; stroke: var(--verity-border); stroke-width: 6; }
    .verity-ring-fg {
      fill: none; stroke: var(--score-color); stroke-width: 6; stroke-linecap: round;
      stroke-dasharray: 251.2; transition: stroke-dashoffset 1s ease-out;
    }
    .verity-score-value {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      font-size: 28px; font-weight: 800; color: var(--score-color);
      font-variant-numeric: tabular-nums;
    }
    .rating-badge {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 4px 12px; border-radius: 100px; font-weight: 600; font-size: 15px;
      border: 1px solid transparent; width: fit-content; margin: 0 auto; white-space: nowrap;
    }
    .rating-badge svg { width: 14px; height: 14px; }

    .score-high { --score-color: var(--verity-success); }
    .score-mid  { --score-color: var(--verity-warning); }
    .score-low  { --score-color: var(--verity-danger); }

    .rating-accurate   { background: rgba(34,197,94,0.1);  color: var(--verity-success); border-color: rgba(34,197,94,0.2); }
    .rating-misleading { background: rgba(245,158,11,0.1); color: var(--verity-warning); border-color: rgba(245,158,11,0.2); }
    .rating-false      { background: rgba(239,68,68,0.1);  color: var(--verity-danger);  border-color: rgba(239,68,68,0.2); }

    .verity-card {
      position: relative; padding: 16px; border-radius: var(--verity-radius);
      border: 1px solid var(--verity-border); background: rgba(255,255,255,0.5);
      margin-bottom: 12px; transition: all 0.2s ease;
    }
    .verity-card:hover { background: rgba(255,255,255,0.8); border-color: rgba(59,130,246,0.3); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }

    .claim-card.verdict-true      { border-left: 6px solid var(--verity-success); }
    .claim-card.verdict-false     { border-left: 6px solid var(--verity-danger); }
    .claim-card.verdict-misleading{ border-left: 6px solid var(--verity-warning); }

    .fallacy-card { background: rgba(245,158,11,0.05); border-color: rgba(245,158,11,0.2); }
    .fallacy-card:hover { background: rgba(245,158,11,0.1); }

    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .card-title  { font-weight: 600; font-size: 14px; margin: 0; }
    .card-label  { font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .card-meta   { font-size: 10px; color: var(--verity-muted-foreground); display: flex; align-items: center; gap: 4px; }
    .card-meta svg { width: 12px; height: 12px; flex-shrink: 0; }
    .card-body   { font-size: 13px; line-height: 1.5; color: var(--verity-foreground); }
    .card-summary{ font-size: 12px; color: var(--verity-muted); margin-top: 8px; line-height: 1.4; }

    .sources-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .source-tag {
      display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px;
      background: var(--verity-background); border: 1px solid var(--verity-border);
      font-size: 11px; color: var(--verity-foreground); text-decoration: none; transition: all 0.2s ease;
    }
    .source-tag:hover { background: var(--verity-border); border-color: var(--verity-muted-foreground); }
    .source-tag svg { width: 12px; height: 12px; flex-shrink: 0; color: var(--verity-muted); }
    .source-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .dot-supports    { background: var(--verity-success); }
    .dot-contradicts { background: var(--verity-danger); }

    .verity-footer {
      padding: 10px 16px; border-top: 1px solid var(--verity-border);
      background: rgba(248,250,252,0.5); text-align: center;
      font-size: 10px; color: var(--verity-muted-foreground); flex-shrink: 0;
    }

    /* Dark Theme */
    .verity-panel.dark-theme {
      --verity-background: #0f172a; --verity-foreground: #f1f5f9;
      --verity-muted: #94a3b8; --verity-border: #334155;
      --verity-card: rgba(30,41,59,0.95); --verity-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
    }
    .verity-panel.dark-theme .verity-header { background: rgba(15,23,42,0.8); }
    .verity-panel.dark-theme .verity-footer { background: rgba(15,23,42,0.5); }
    .verity-panel.dark-theme .verity-card  { background: rgba(51,65,85,0.4); }
    .verity-panel.dark-theme .verity-card:hover { background: rgba(51,65,85,0.6); }
    .verity-panel.dark-theme .source-tag   { background: rgba(15,23,42,0.5); }
  `;
  shadowRoot.appendChild(style);
}

function positionFloatingPanel(anchorBtn) {
  if (!floatingPanel || !anchorBtn) return;

  const panelWidth = 380;
  const margin = 12;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Bottom edge of the sticky LinkedIn navbar. The panel must never slide
  // above this line, otherwise it overlaps the top navigation bar.
  const navbar = document.querySelector('.global-nav, #global-nav, header');
  const navBottom = navbar ? navbar.getBoundingClientRect().bottom : 52;
  const minTop = Math.max(margin, navBottom + margin);

  // Find the post element to position the panel to its right side
  let postRect = null;
  let postEl = anchorBtn.verityPostElement;
  if (postEl) {
    postRect = postEl.getBoundingClientRect();
  }

  let top, left;

  if (postRect) {
    // Position to the RIGHT of the post
    left = postRect.right + margin;
    top = Math.max(minTop, postRect.top);

    // If panel would overflow the right edge, place it to the left of the post instead
    if (left + panelWidth > viewportWidth - margin) {
      left = postRect.left - panelWidth - margin;
    }

    // If both sides overflow, center in viewport
    if (left < margin) {
      left = margin;
      top = Math.max(minTop, postRect.top);
    }

    // Keep top within viewport
    if (top + 400 > viewportHeight) {
      top = Math.max(minTop, postRect.bottom - 400);
    }
    if (top < minTop) top = minTop;
  } else {
    // Fallback: place below the anchor button
    const rect = anchorBtn.getBoundingClientRect();
    top = Math.max(minTop, rect.bottom + margin);
    left = rect.right - panelWidth;
    if (left < margin) left = margin;
    if (left + panelWidth > viewportWidth - margin) left = viewportWidth - panelWidth - margin;
  }

  floatingPanel.style.top  = `${top}px`;
  floatingPanel.style.left = `${left}px`;
  floatingPanel.style.clipPath = 'none';
}

function openFloatingPanel(anchorBtn, contentBuilder) {
  ensureFloatingHost();

  if (activeAnchor === anchorBtn && floatingPanel.style.display !== 'none') {
    closeFloatingPanel();
    return false; 
  }

  if (activeAnchor && activeAnchor !== anchorBtn) {
    closeFloatingPanel();
  }

  activeAnchor = anchorBtn;
  anchorBtn.classList.add('active');

  contentBuilder(floatingPanel);

  if (userSettings.theme === 'dark') floatingPanel.classList.add('dark-theme');
  else floatingPanel.classList.remove('dark-theme');

  floatingPanel.style.display = 'flex';
  floatingPanel.style.flexDirection = 'column';

  positionFloatingPanel(anchorBtn);

  cancelAnimationFrame(positionRafId);
  
  function trackPosition() {
    if (!floatingPanel || floatingPanel.style.display === 'none' || !activeAnchor) return;

    // Close if the associated post element is no longer in the DOM (SPA refresh)
    if (activeAnchor.verityPostElement && !document.contains(activeAnchor.verityPostElement)) {
      closeFloatingPanel();
      return;
    }

    positionFloatingPanel(activeAnchor);

    const panelRect = floatingPanel.getBoundingClientRect();
    const anchorRect = activeAnchor.getBoundingClientRect();
    
    // DIRECTIONAL BOUNDS RULE:
    const isOffScreen = panelRect.bottom < 0 || anchorRect.top > window.innerHeight;
    
    // Close when the post scrolls behind the navbar (its lower edge passes above navbar bottom)
    const navbar = document.querySelector('.global-nav, #global-nav, header');
    const navBottom = navbar ? navbar.getBoundingClientRect().bottom : 52;
    const postEl = activeAnchor.verityPostElement;
    let isBehindNavbar = false;
    if (postEl) {
      const postRect = postEl.getBoundingClientRect();
      isBehindNavbar = postRect.bottom < navBottom;
    }
    
    if (isOffScreen || isBehindNavbar) {
      closeFloatingPanel();
      return;
    }

    positionRafId = requestAnimationFrame(trackPosition);
  }
  positionRafId = requestAnimationFrame(trackPosition);

  return true;
}

function initDragOnPanel(headerEl) {
  headerEl.addEventListener('mousedown', (e) => {
    // Ignore clicks on buttons inside the header
    if (e.target.closest('button')) return;
    e.preventDefault();

    cancelAnimationFrame(positionRafId);

    const panelRect = floatingPanel.getBoundingClientRect();
    dragState = {
      startX: e.clientX,
      startY: e.clientY,
      startLeft: panelRect.left,
      startTop: panelRect.top
    };

    headerEl.classList.add('dragging');
    floatingPanel.classList.add('no-animation');

    function onMouseMove(ev) {
      if (!dragState) return;
      const dx = ev.clientX - dragState.startX;
      const dy = ev.clientY - dragState.startY;
      floatingPanel.style.left = `${dragState.startLeft + dx}px`;
      floatingPanel.style.top = `${dragState.startTop + dy}px`;
    }

    function onMouseUp() {
      headerEl.classList.remove('dragging');
      dragState = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

function closeFloatingPanel() {
  if (!floatingPanel) return;
  cancelAnimationFrame(positionRafId);
  floatingPanel.style.display = 'none';
  clearAllHighlights();
  if (activeAnchor) {
    activeAnchor.classList.remove('active');
    activeAnchor = null;
  }
  dragState = null;
}

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

function injectTriggerStyles(shadowRoot) {
  const style = document.createElement("style");
  style.textContent = `
    :host {
      display: inline-flex;
      align-items: center;
      position: relative;
      --verity-primary: #3b82f6;
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
    .verity-trigger:hover { background: rgba(59,130,246,0.1); }
    .verity-trigger.active { background: rgba(59,130,246,0.15); }
    .verity-icon, .verity-spinner { width: 20px; height: 20px; stroke: var(--verity-primary); display: block; }
    .verity-spinner { display: none; animation: spin 1s linear infinite; }
    .loading .verity-icon    { display: none; }
    .loading .verity-spinner { display: block; }
    @keyframes spin { 100% { transform: rotate(360deg); } }
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
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
  retry: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>'
};

const PHASE_ORDER = ["extracting", "searching", "evaluating"];

function updatePhaseUI(panel, phaseKey) {
  if (!panel || !phaseKey) return;
  const currentIdx = PHASE_ORDER.indexOf(phaseKey);
  if (currentIdx === -1) return;
  panel.querySelectorAll('.verity-phase').forEach(el => {
    const key = el.dataset.phase;
    const idx = PHASE_ORDER.indexOf(key);
    el.classList.toggle('active', key === phaseKey);
    el.classList.toggle('done', idx !== -1 && idx < currentIdx);
  });
}

async function consumeSSE(response, panel) {
  return new Promise((resolve, reject) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    function handleEvent(rawEvent) {
      let eventName = "message";
      const dataLines = [];
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (!dataLines.length) return;
      let parsed;
      try { parsed = JSON.parse(dataLines.join("\n")); } catch { return; }

      if (eventName === "phase" && parsed.key) {
        updatePhaseUI(panel, parsed.key);
      } else if (eventName === "result") {
        resolve(parsed);
      } else if (eventName === "error") {
        reject(new Error(parsed.error || "Analysis failed."));
      }
    }

    function parseChunk(chunk) {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        handleEvent(rawEvent);
      }
    }

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          parseChunk(decoder.decode(value, { stream: true }));
        }
        parseChunk(decoder.decode());
        reject(new Error("Stream ended without a result event."));
      } catch (err) {
        reject(err);
      }
    })();
  });
}

function buildPanelHTML(analysisState, onRetry) {
  return (panel) => {
    const logoUrl = typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.getURL('/logo.png') : '';
    
    panel.innerHTML = `
      <div class="verity-header">
        <div style="display: flex; gap:8px; align-items: center;">
          <img src="${logoUrl}" class="verity-logo" />
          <span>${t('verityAnalysis')}</span>
        </div>
        <div style="display:flex; gap:4px; align-items:center;">
          <button class="verity-settings-btn verity-retry-header" title="Retry" style="display:${(!analysisState.loading && (analysisState.data || analysisState.error)) ? 'inline-flex' : 'none'}">${ICONS.retry}</button>
          <button class="verity-settings-btn verity-settings-open" title="Settings">${ICONS.settings}</button>
          <button class="verity-close">${ICONS.close}</button>
        </div>
      </div>
      <div class="verity-content">
        <div class="verity-loading" style="display:${analysisState.loading ? 'flex' : 'none'}">
          <div class="loader-circle"></div>
          <div class="verity-phases">
            <div class="verity-phase active" data-phase="extracting">
              <span class="phase-icon"><span class="phase-spinner"></span><span class="phase-check">✓</span><span class="phase-dot"></span></span>
              <span>${t('phaseExtracting')}</span>
            </div>
            <div class="verity-phase" data-phase="searching">
              <span class="phase-icon"><span class="phase-spinner"></span><span class="phase-check">✓</span><span class="phase-dot"></span></span>
              <span>${t('phaseSearching')}</span>
            </div>
            <div class="verity-phase" data-phase="evaluating">
              <span class="phase-icon"><span class="phase-spinner"></span><span class="phase-check">✓</span><span class="phase-dot"></span></span>
              <span>${t('phaseEvaluating')}</span>
            </div>
          </div>
        </div>
        <div class="verity-error" style="display:${analysisState.error ? 'flex' : 'none'}; color:var(--verity-danger); text-align:center; padding:24px;">
          ${analysisState.error || ''}
        </div>
        <div class="verity-retry-wrapper" style="display:${analysisState.error ? 'flex' : 'none'}">
          <button class="verity-retry-btn verity-btn">Retry</button>
        </div>
        <div class="verity-results" style="display:${analysisState.data ? 'block' : 'none'}"></div>
      </div>
      <div class="verity-footer">
        Powered by Verity AI • High Fidelity Fact-Checking
      </div>
    `;

    if (analysisState.data) {
      renderData(panel.querySelector('.verity-results'), analysisState.data, analysisState.postTextEl);
    }

    panel.querySelector('.verity-retry-btn')?.addEventListener('click', () => {
      if (typeof onRetry === 'function') {
        onRetry();
      }
    });

    panel.querySelector('.verity-retry-header')?.addEventListener('click', () => {
      if (typeof onRetry === 'function') {
        onRetry();
      }
    });

    panel.querySelector('.verity-close').addEventListener('click', closeFloatingPanel);
    panel.querySelector('.verity-settings-open')?.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ action: 'openOptionsPage' });
      }
    });
    panel.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

    // Enable dragging on the header
    const headerEl = panel.querySelector('.verity-header');
    if (headerEl) {
      initDragOnPanel(headerEl);
    }
  };
}

function showLoginPanel(panel, anchorBtn) {
  return new Promise((resolve) => {
    const logoUrl = typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.getURL('/logo.png') : '';
    
    panel.innerHTML = `
      <div class="verity-header">
        <div style="display: flex; gap:8px; align-items: center;">
          <img src="${logoUrl}" alt="V" class="verity-logo" />
          <span>${t('verityAnalysis')}</span>
        </div>
        <div style="display:flex; gap:4px; align-items:center;">
          <button class="verity-close">${ICONS.close}</button>
        </div>
      </div>
      <div class="verity-content">
        <div style="display:flex; flex-direction:column; gap:12px; padding:8px 0; align-items: center;">
          <p style="font-size:13px; margin:0; color: red;">Not Authorized</p>
        </div>
        <div style="display:flex; flex-direction:column; gap:12px; padding:8px 0; justify-content: center;">
          <p style="font-size:12px; color:var(--verity-muted); margin:0; line-height:1.5;">
            Send a message to the Verity team and we'll review your case and get back as soon as possible.
          </p>
          <a href="${VERITY_SITE_URL}/support" target="_blank" style="display:contents; text-align: center; text-decoration: none;">
            <button class="verity-btn">
              Request Assistance
            </button>
          </a>
          <p style="font-size:12px; color:var(--verity-muted); margin:0; line-height:1.5;">
            Alternatively, you can request another magic link manually or get your first if you haven't received one yet.
          </p>
        </div>
        <div style="display:flex; flex-direction:column; gap:12px; padding:8px 0;">
          <p style="font-size:13px; font-weight:600; margin:0;">Sign in to Verity</p>
          <p style="font-size:12px; color:var(--verity-muted); margin:0; line-height:1.5;">
            Enter your email and we'll send you a magic link. Click it and you'll be signed in automatically.
          </p>
          <input id="v_email" type="email" placeholder="you@example.com"
            style="padding:8px 10px; border-radius:6px; border:1px solid var(--verity-border);
                   font-size:13px; outline:none; background:var(--verity-background);
                   color:var(--verity-foreground);" />
          <button id="v_send_btn" class="verity-btn">
            Send magic link
          </button>
          <div id="v_msg" style="font-size:12px; display:none; line-height:1.5;"></div>
          <p style="font-size:11px; color:var(--verity-muted); margin:0; text-align:center;">
            No account yet?
            <a href="${VERITY_SITE_URL}/beta-access" target="_blank"
               style="color:var(--verity-primary); text-decoration:none;">
              Request beta access
            </a>
          </p>
        </div>
      </div>
      <div class="verity-footer">Powered by Verity AI • High Fidelity Fact-Checking</div>
    `;

    const closeBtn  = panel.querySelector('.verity-close');
    const sendBtn   = panel.querySelector('#v_send_btn');
    const msgEl     = panel.querySelector('#v_msg');

    function showMsg(text, isError = true) {
      msgEl.style.display = text ? 'block' : 'none';
      msgEl.style.color = isError ? 'var(--verity-danger)' : 'var(--verity-success)';
      msgEl.textContent = text;
    }

    // Enable dragging on the header for login panel too
    const headerEl = panel.querySelector('.verity-header');
    if (headerEl) {
      initDragOnPanel(headerEl);
    }

    closeBtn?.addEventListener('click', () => {
      closeFloatingPanel();
      resolve(false);
    });

    sendBtn?.addEventListener('click', async () => {
      const email = panel.querySelector('#v_email').value.trim();
      if (!email) { showMsg('Please enter your email'); return; }

      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending…';

      const result = await requestMagicLink(email);

      if (result.error) {
        showMsg(result.error.includes('User not found')
          ? 'This email hasn\'t been approved yet. Request access at verity.dpdns.org.'
          : result.error
        );
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send magic link';
        return;
      }

      showMsg('✓ Check your inbox — click the link to sign in. Then click Analyze again.', false);
      sendBtn.disabled = true;
      sendBtn.textContent = 'Link sent';
    });
  });
}

// =============================================================================
// Post text highlighting: hover over a claim → highlight its excerpt in the post
// Uses the CSS Custom Highlight API (CSS.highlights + ::highlight()), which
// never mutates the DOM. Links, mentions, and other inline elements therefore
// cannot break the highlight, and cleanup is a single registry delete.
// =============================================================================

const HIGHLIGHT_NAMES = {
  true: 'verity-claim-true',
  false: 'verity-claim-false',
  misleading: 'verity-claim-misleading',
  unverifiable: 'verity-claim-unverifiable'
};

let highlightStyleEl = null;

function ensureHighlightStyles() {
  if (highlightStyleEl) return;
  highlightStyleEl = document.createElement('style');
  highlightStyleEl.textContent = `
    ::highlight(verity-claim-true) {
      background: rgba(34, 197, 94, 0.25);
      border-radius: 3px;
    }
    ::highlight(verity-claim-false) {
      background: rgba(239, 68, 68, 0.25);
      border-radius: 3px;
    }
    ::highlight(verity-claim-misleading) {
      background: rgba(245, 158, 11, 0.25);
      border-radius: 3px;
    }
    ::highlight(verity-claim-unverifiable) {
      background: rgba(59, 130, 246, 0.25);
      border-radius: 3px;
    }
  `;
  document.documentElement.appendChild(highlightStyleEl);
}

function clearAllHighlights() {
  if (typeof CSS === 'undefined' || !CSS.highlights) return;
  Object.values(HIGHLIGHT_NAMES).forEach(name => CSS.highlights.delete(name));
}

function normalizeWhitespace(str) {
  return str.replace(/\s+/g, ' ').trim();
}

// Tags that innerText renders as separate lines. Treating these boundaries as
// a single space keeps the synthetic buffer aligned with the innerText string
// that was sent to the API, so offsets map back to the DOM correctly even when
// paragraphs, <br>, or links split the text across many nodes.
const BLOCK_TAGS = new Set([
  'P','DIV','LI','UL','OL','H1','H2','H3','H4','H5','H6','BLOCKQUOTE',
  'SECTION','ARTICLE','ASIDE','HEADER','FOOTER','FIGURE','FIGCAPTION',
  'TABLE','THEAD','TBODY','TFOOT','TR','TD','TH','PRE','DL','DT','DD',
  'FORM','FIELDSET','MAIN','NAV','HR'
]);

function isHiddenNode(node) {
  try {
    // aria-hidden elements are not rendered to AT/innerText
    if (node.getAttribute && node.getAttribute('aria-hidden') === 'true') return true;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return true;
    // LinkedIn uses clip/clip-path/1px sizing for screen-reader-only duplicates
    // that innerText excludes. Skip them so the index stays aligned.
    if (style.position === 'absolute' && (
      style.clip === 'rect(0px, 0px, 0px, 0px)' ||
      style.clipPath === 'inset(50%)' ||
      (parseInt(style.width) === 1 && parseInt(style.height) === 1)
    )) return true;
    return false;
  } catch {
    return false;
  }
}

// Normalize curly/smart punctuation to ASCII equivalents on both the excerpt
// and the post text. The AI sometimes swaps straight quotes/apostrophes for
// curly ones (or vice-versa), which breaks exact matching even when the words
// are identical. This is still a verbatim match — only glyph variants are unified.
// IMPORTANT: every replacement must be 1:1 (same length) so character positions
// in the normalized string stay aligned with the original text and its DOM index.
function normalizePunctuation(str) {
  return str
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')   // curly double quotes → "
    .replace(/[\u2018\u2019\u201A\u201B\u0060\u00B4]/g, "'")   // curly single quotes/apostrophes → '
    .replace(/[\u2013\u2014\u2015]/g, '-');                     // en/em dashes → -
}

function isBlockOrLineBreak(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
  const tag = node.tagName;
  if (tag === 'BR' || tag === 'WBR') return true;
  if (BLOCK_TAGS.has(tag)) return true;
  try {
    const display = getComputedStyle(node).display;
    return /^(block|list-item|table|table-row|table-cell|flex|grid)$/.test(display);
  } catch {
    return false;
  }
}

// Build a normalized text buffer that mirrors innerText (the exact string sent
// to the API): whitespace runs collapse to one space, block/<br> boundaries
// become a space, hidden elements are skipped, and inline elements (links,
// mentions, spans) concatenate with no gap. Every character records the
// (node, offset) it came from, so a match in the buffer maps to exact DOM
// positions — links and other inline elements can't break the highlight.
function buildTextIndex(rootEl) {
  const chars = [];
  const index = []; // index[charPos] = { node, offset } (null = synthetic space)
  let pendingSpace = false;

  function flushSpace() {
    if (pendingSpace && chars.length > 0 && chars[chars.length - 1] !== ' ') {
      chars.push(' ');
      index.push(null); // synthetic space, not tied to a DOM char
    }
    pendingSpace = false;
  }

  function visit(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (/\s/.test(ch)) {
          pendingSpace = true;
        } else {
          flushSpace();
          chars.push(ch);
          index.push({ node, offset: i });
        }
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return; // comments, etc.
    if (isHiddenNode(node)) return;
    const tag = node.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE') return;

    if (tag === 'BR' || tag === 'WBR') {
      pendingSpace = true; // line break between siblings
      return;
    }

    const breaks = isBlockOrLineBreak(node);
    if (breaks) {
      flushSpace();
      pendingSpace = true;
    }
    for (const child of node.childNodes) visit(child);
    if (breaks) {
      flushSpace();
      pendingSpace = true;
    }
  }

  visit(rootEl);
  return { text: chars.join(''), index };
}

function highlightInPostElement(textEl, excerpt, verdict) {
  if (!textEl || !excerpt) return;
  if (typeof CSS === 'undefined' || !CSS.highlights) {
    warn("Highlight: CSS Custom Highlight API not supported");
    return;
  }

  clearAllHighlights();

  const { text: fullText, index } = buildTextIndex(textEl);
  const normalizedExcerpt = normalizeWhitespace(excerpt);

  // Match against the same rendered text the API analyzed. The backend now
  // guarantees the excerpt is a verbatim substring (post-parse repair), so
  // exact matching is the primary path. We still tolerate two harmless AI
  // formatting slips before giving up: wrapping quotes and curly punctuation.
  let matchExcerpt = normalizedExcerpt;
  let matchKind = "exact";
  let excerptIndex = fullText.indexOf(matchExcerpt);

  if (excerptIndex === -1) {
    // Case-insensitive
    excerptIndex = fullText.toLowerCase().indexOf(matchExcerpt.toLowerCase());
    matchKind = "case-insensitive";
  }

  if (excerptIndex === -1) {
    // Strip wrapping straight/curly double quotes the AI may have added
    const stripped = matchExcerpt.replace(/^["""']+|["""']+$/g, '');
    if (stripped.length > 5) {
      excerptIndex = fullText.indexOf(stripped);
      if (excerptIndex !== -1) { matchExcerpt = stripped; matchKind = "quote-stripped"; }
    }
  }

  if (excerptIndex === -1) {
    // Unify curly/smart punctuation on both sides (glyph variants only).
    // normalizePunctuation is strictly 1:1, so positions in punctFull align
    // perfectly with positions in fullText and its DOM index.
    const punctExcerpt = normalizePunctuation(matchExcerpt);
    const punctFull = normalizePunctuation(fullText);
    excerptIndex = punctFull.indexOf(punctExcerpt);
    if (excerptIndex !== -1) {
      matchExcerpt = punctExcerpt;
      matchKind = "punctuation-normalized";
    }
  }

  if (excerptIndex === -1) {
    warn(`Highlight: excerpt not found [${verdict}] (${excerpt.length} chars):`, excerpt.slice(0, 120));
    if (import.meta.env.DEV) {
      log("Highlight DEV — index text:", fullText.slice(0, 200));
      log("Highlight DEV — excerpt:", normalizedExcerpt.slice(0, 200));
    }
    return;
  }

  const matchEnd = excerptIndex + matchExcerpt.length;

  // Skip synthetic spaces at the boundaries (they carry no DOM position)
  let startPos = excerptIndex;
  while (startPos < matchEnd && !index[startPos]) startPos++;
  let endPos = matchEnd - 1;
  while (endPos >= startPos && !index[endPos]) endPos--;

  if (startPos >= endPos) {
    warn("Highlight: excerpt has no real characters");
    return;
  }

  const startRef = index[startPos];
  const endRef = index[endPos];

  // A single Range may span many text nodes (links, mentions, nested spans).
  // The CSS Custom Highlight API paints it without touching the DOM.
  const range = document.createRange();
  range.setStart(startRef.node, startRef.offset);
  range.setEnd(endRef.node, endRef.offset + 1);

  const name = HIGHLIGHT_NAMES[verdict] || HIGHLIGHT_NAMES.unverifiable;
  CSS.highlights.set(name, new Highlight(range));

  log(`Highlight ${matchKind} [${verdict}] "${fullText.slice(startPos, endPos + 1).slice(0, 60)}..."`);
}

function buildUI(shadowRoot, postText, postTextEl) {
  const analysisState = { loading: false, data: null, error: null, hasAnalyzed: false, postTextEl: postTextEl };

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

  async function runAnalysis() {
    analysisState.hasAnalyzed = true;
    analysisState.loading = true;
    analysisState.error = null;
    analysisState.data = null;
    btn.classList.add("loading");

    buildPanelHTML(analysisState, runAnalysis)(floatingPanel);

    let showedLoginPanel = false;

    try {
      const token = await getToken();
      if (!token) throw new Error('Unauthorized');

      const analysisLanguage = userSettings.outputMode === 'article' ? null : userSettings.uiLanguage;
      
      // 1. Mark the start time right before fetch
      const startTime = performance.now();

      const resp = await fetch(SUPABASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ text: postText, language: analysisLanguage, stream: true })
      });

      if (!resp.ok) throw resp.status === 401 ? new Error('Unauthorized') : new Error(`API returned ${resp.status}`);

      // SSE streaming with phased progress, falling back to plain JSON for legacy/static responses
      const contentType = resp.headers.get('Content-Type') || '';
      let data;
      if (contentType.includes('text/event-stream')) {
        data = await consumeSSE(resp, floatingPanel);
      } else {
        data = await resp.json();
      }

      // 2. Mark the end time as soon as the payload resolves
      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);

      if (data && data.error) throw new Error(data.error);

      analysisState.data = data;
      analysisState.error = null;

      // 3. [DEV ONLY] Record debug diagnostics with language settings
      if (import.meta.env.DEV) {
        recordLocalDiagnostics(latencyMs, resp.status, data, postText, userSettings.uiLanguage, analysisLanguage);
      }
      
    } catch (err) {
      if (err.message === 'Unauthorized') {
        showedLoginPanel = true;
        analysisState.hasAnalyzed = false;
        analysisState.loading = false;
        btn.classList.remove("loading");
        await showLoginPanel(floatingPanel, btn);
        return;
      }

      warn("Analysis failed:", err);
      analysisState.error = "Failed: " + err.message;
      analysisState.data = null;

    } finally {
      analysisState.loading = false;
      btn.classList.remove("loading");
      if (activeAnchor === btn) {
        buildPanelHTML(analysisState, runAnalysis)(floatingPanel);
      }
    }
  }

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const opened = openFloatingPanel(btn, buildPanelHTML(analysisState, runAnalysis));
    if (!opened) return;

    if (!analysisState.hasAnalyzed) {
      await runAnalysis();
    }
  });

  shadowRoot.appendChild(btn);
}

function renderData(container, data, postTextEl) {
  const getVerdictConfig = (v) => {
    if (v === "true")    return { label: t('accurate'),         tagClass: "rating-accurate",   icon: ICONS.check };
    if (v === "false")       return { label: t('falseLabel'),       tagClass: "rating-false",      icon: ICONS.xCircle };
    //if (v === "unsupported") return { label: t('unsupportedLabel'), tagClass: "rating-false",      icon: ICONS.xCircle };
    if (v === "misleading")  return { label: t('misleading'),       tagClass: "rating-misleading", icon: ICONS.alert };
    if (v === "unverifiable") return { label: t('unverifiable'),     tagClass: "",                  icon: ICONS.help };
    return { label: t('unknown'),          tagClass: "",                  icon: ICONS.help };
  };

  const score = data.logical_score;
  const scoreClass = score >= 80 ? 'score-high' : (score >= 60 ? 'score-mid' : 'score-low');
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

  if (data.fallacies && data.fallacies.length > 0) {
    html += `<div class="section-title">${t('fallacies')} (${data.fallacies.length})</div>`;
    data.fallacies.forEach(f => {
      html += `
        <div class="verity-card fallacy-card">
          <div class="card-header">
            <h4 class="card-title" style="text-transform:capitalize;">${f.name.replace(/_/g, ' ')}</h4>
            <span class="card-label" style="color:var(--verity-warning)">${t('fallacyLabel')}</span>
          </div>
          <div class="card-body">${f.explanation}</div>
        </div>
      `;
    });
  }

  if (data.claims && data.claims.length > 0) {
    html += `<div class="section-title">${t('claims')} (${data.claims.length})</div>`;
    data.claims.forEach((c, ci) => {
      const cfg = getVerdictConfig(c.verdict);
      let sourcesHtml = "";
      if (c.sources && c.sources.length) {
        sourcesHtml = `<div class="sources-list">${c.sources.slice(0, 3).map(s => {
          let domain = "Link";
          try { domain = new URL(s.url).hostname.replace('www.', ''); } catch (e) {}
          return `
            <a href="${s.url}" class="source-tag" target="_blank">
              <span class="source-dot ${s.supports ? 'dot-supports' : 'dot-contradicts'}"></span>
              <span>${domain}</span>
              ${ICONS.external}
            </a>`;
        }).join("")}</div>`;
      }
      html += `
        <div class="verity-card claim-card verdict-${c.verdict}" data-excerpt="${(c.excerpt || '').replace(/"/g, '"')}" data-verdict="${c.verdict}">
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

  // Set up hover handlers for claim-card highlighting in the post
  if (postTextEl) {
    container.querySelectorAll('.claim-card').forEach(card => {
      const excerpt = card.dataset.excerpt;
      const verdict = card.dataset.verdict;
      if (!excerpt) return;

      card.addEventListener('mouseenter', () => {
        ensureHighlightStyles();
        highlightInPostElement(postTextEl, excerpt, verdict);
      });

      card.addEventListener('mouseleave', () => {
        clearAllHighlights();
      });
    });
  }
}

function processPost(post) {
  if (post.dataset.verityInjected === 'true') return false;

  const text = extractPostText(post);
  if (!text) return false;

  const menuBtn = findMenuButton(post);
  if (!menuBtn || !menuBtn.parentElement) return false;

  post.dataset.verityInjected = 'true';

  const hostId = "verity-host-" + Math.random().toString(36).slice(2, 11);
  const host = createShadowHost(hostId);

  const shadow = host.attachShadow({ mode: "open" });
  injectTriggerStyles(shadow);
  
  // Find the post text element for highlighting
  const postTextEl = findPostTextElement(post);
  buildUI(shadow, text, postTextEl);

  // Store reference to the post element on the trigger button for panel positioning
  const triggerBtn = shadow.querySelector('.verity-trigger');
  if (triggerBtn) {
    triggerBtn.verityPostElement = post;
  }

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex; align-items:center; gap:4px;";

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
  if (location.href !== lastUrl) {
      log("SPA Navigation detected. Closing open panels.");
      lastUrl = location.href;
      closeFloatingPanel();
    }

  const posts = findPosts();
  let count = 0;
  for (const p of posts) {
    if (processPost(p)) count++;
  }
  if (count > 0) log(`Scanned ${posts.length} feed elements. Injected ${count} new widgets.`);
}

let debounceTimer = null;
function onDomMutation() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(scan, 300);
}

function init() {
  log("Initializing Shadow DOM Injector");

  ensureFloatingHost();
  scan();

  window.addEventListener('beforeunload', () => {
      closeFloatingPanel();
    });

  let retries = 0;
  const iv = setInterval(() => {
    scan();
    if (++retries > 10) clearInterval(iv);
  }, 1000);
  if (typeof MutationObserver !== 'undefined' && document && document.body) {
    const observer = new MutationObserver(onDomMutation);
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    const fallbackIv = setInterval(onDomMutation, 1500);
    setTimeout(() => clearInterval(fallbackIv), 10000);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = {};

}});