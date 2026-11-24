/**
 * Non-intrusive Chrome DevTools Protocol (CDP) injector for agy-ledger.
 *
 * - Connects strictly to Antigravity UI pages (`https://127.0.0.1:<port>/...`)
 * - Docks an inline capsule Shadow DOM host (`#agy-ledger-pill-host`) inside
 *   `.agy-composer-footer` right before the right-hand controls (never overlaps
 *   the sidebar Settings area or `#agy-capsule-host`)
 * - Mounts the centered Modal (`#agy-ledger-host`) on `document.body` (`Alt+L`)
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const LEDGER_CLIENT_VERSION = 7;
const TICK_INTERVAL_MS = 2500;
const LIST_POLL_CONNECTED_MS = 5000;
const LIST_POLL_DISCONNECTED_MS = 2500;

export function computeBundleHash(str) {
  let h = 0x811c9dc5;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function resolveCdpPortFile() {
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Antigravity', 'DevToolsActivePort');
  }
  if (process.platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Antigravity', 'DevToolsActivePort');
  }
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'Antigravity', 'DevToolsActivePort');
}

export function isAntigravityUiTarget(target) {
  return Boolean(
    target &&
      target.type === 'page' &&
      /^https:\/\/127\.0\.0\.1:\d+\//.test(target.url || '') &&
      target.webSocketDebuggerUrl
  );
}

function buildOverlayClientScript(stylesCss) {
  return `
(function () {
  'use strict';
  if (typeof location === 'undefined' || location.protocol !== 'https:' || location.hostname !== '127.0.0.1') {
    return;
  }

  try {
    globalThis.__agyLedger?.dispose?.();
  } catch {}
  try {
    document.getElementById('agy-ledger-pill-host')?.remove();
    document.getElementById('agy-ledger-host')?.remove();
  } catch {}

  const CLIENT_VERSION = ${LEDGER_CLIENT_VERSION};
  const BUNDLE_HASH = globalThis.__AGY_LEDGER_BUNDLE_HASH || '';
  const OWNER_TS = Number(globalThis.__AGY_LEDGER_INIT_TS || 0) || Date.now();
  const STYLES_CSS = ${JSON.stringify(stylesCss)};

  if (document.head) {
    let fontLink = document.getElementById('agy-ledger-fonts');
    const desiredHref = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
    if (!fontLink) {
      fontLink = document.createElement('link');
      fontLink.id = 'agy-ledger-fonts';
      fontLink.rel = 'stylesheet';
      document.head.appendChild(fontLink);
    }
    if (fontLink.href !== desiredHref) fontLink.href = desiredHref;
  }

  const PILL_CSS = \`
    :host {
      all: initial;
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      position: relative;
      font-family: 'Google Sans Flex', 'Plus Jakarta Sans', 'Inter', 'PingFang SC', 'Microsoft YaHei UI', system-ui, sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; }
    .tl-pill-wrap {
      display: inline-flex;
      align-items: center;
      position: relative;
      --p-bg: rgba(252, 251, 248, 0.97);
      --p-border: #DDD6C8;
      --p-divider: #E9E3D7;
      --p-track: #EFEBE2;
      --p-ink: #1C1917;
      --p-ink-2: #57534E;
      --p-muted: #8A8277;
      --p-forest: #1E5E46;
      --p-copper: #D46B3E;
      --p-ochre: #C48F2B;
      --p-olive: #5B753A;
      --p-umber: #9E3B33;
      --p-stone: #78716C;
      --p-hover: rgba(120, 113, 108, 0.12);
      --p-shadow: 0 8px 26px rgba(28, 25, 23, 0.14), 0 1px 3px rgba(28, 25, 23, 0.06);
    }
    .tl-pill-wrap[data-theme="dark"] {
      --p-bg: rgba(26, 24, 21, 0.97);
      --p-border: #36312A;
      --p-divider: #2E2A24;
      --p-track: #26231E;
      --p-ink: #F2EDE4;
      --p-ink-2: #A8A095;
      --p-muted: #7C756A;
      --p-forest: #4CC392;
      --p-copper: #F0A868;
      --p-ochre: #D9AE5F;
      --p-olive: #95B869;
      --p-umber: #DC6E64;
      --p-stone: #A8A29E;
      --p-hover: rgba(168, 160, 149, 0.14);
      --p-shadow: 0 10px 30px rgba(0, 0, 0, 0.48), 0 1px 3px rgba(0, 0, 0, 0.25);
    }
    .tl-pill-main {
      appearance: none;
      height: 24px;
      padding: 0 8px;
      border-radius: 999px;
      border: none;
      background: transparent;
      color: var(--p-ink-2);
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-family: inherit;
      font-size: 12px;
      line-height: 1;
      cursor: pointer;
      user-select: none;
      transition: background 120ms ease, color 120ms ease;
    }
    .tl-pill-wrap[data-open="true"] .tl-pill-main,
    .tl-pill-main:hover,
    .tl-pill-main.is-open {
      background: var(--p-hover);
      color: var(--p-ink);
    }
    .tl-pill-main.is-hidden {
      display: none;
    }
    .tl-pill-dot {
      width: 5px;
      height: 5px;
      border-radius: 999px;
      background: var(--p-forest);
      flex-shrink: 0;
    }
    .tl-pill-text {
      font-family: 'Google Sans Code', 'JetBrains Mono', 'Cascadia Mono', ui-monospace, monospace;
      font-variant-numeric: tabular-nums;
      font-weight: 500;
      white-space: nowrap;
    }

    /* Quick-Peek Today Hover Card (mirrors agy-capsule hover bridge mechanics) */
    .tl-hover-wrap {
      display: none;
      position: absolute;
      bottom: calc(100% + 8px);
      left: 0;
      z-index: 2147483635;
      pointer-events: auto;
    }
    .tl-hover-wrap::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: -10px;
      height: 10px;
      background: transparent;
    }
    .tl-pill-wrap[data-open="true"] .tl-hover-wrap {
      display: block;
    }
    .tl-hover-card {
      width: 248px;
      max-width: calc(100vw - 16px);
      background: var(--p-bg);
      backdrop-filter: blur(22px);
      border: 1px solid var(--p-border);
      border-radius: 11px;
      padding: 11px 12px;
      box-shadow: var(--p-shadow);
      color: var(--p-ink);
      font-size: 12px;
      line-height: 1.35;
      user-select: none;
      display: flex;
      flex-direction: column;
      gap: 9px;
    }
    .tl-hc-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .tl-hc-title {
      font-weight: 600;
      font-size: 12px;
      color: var(--p-ink);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .tl-hc-date {
      font-family: 'Google Sans Code', 'JetBrains Mono', ui-monospace, monospace;
      font-size: 10.5px;
      font-weight: 400;
      color: var(--p-muted);
    }
    .tl-hc-turns {
      font-family: 'Google Sans Code', 'JetBrains Mono', ui-monospace, monospace;
      font-size: 10.5px;
      color: var(--p-ink-2);
      padding: 1px 6px;
      border-radius: 999px;
      background: var(--p-track);
    }
    .tl-hc-hero {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }
    .tl-hc-cost {
      font-family: 'Google Sans Code', 'JetBrains Mono', ui-monospace, monospace;
      font-variant-numeric: tabular-nums;
      font-size: 20px;
      font-weight: 650;
      letter-spacing: -0.02em;
      color: var(--p-ink);
      line-height: 1.1;
    }
    .tl-hc-tok {
      font-family: 'Google Sans Code', 'JetBrains Mono', ui-monospace, monospace;
      font-variant-numeric: tabular-nums;
      font-size: 11.5px;
      color: var(--p-ink-2);
    }
    .tl-hc-sub {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      font-size: 11px;
      color: var(--p-muted);
      font-family: 'Google Sans Code', 'JetBrains Mono', ui-monospace, monospace;
      font-variant-numeric: tabular-nums;
    }
    .tl-hc-saved {
      color: var(--p-forest);
      font-weight: 500;
    }
    .tl-hc-divider {
      height: 1px;
      background: var(--p-divider);
      margin: 0;
    }
    .tl-hc-sec {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .tl-hc-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 11.5px;
    }
    .tl-hc-lbl {
      color: var(--p-ink-2);
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .tl-hc-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--p-stone);
      flex-shrink: 0;
    }
    .tl-hc-dot.is-active { background: var(--p-forest); }
    .tl-hc-dot.is-warn { background: var(--p-ochre); }
    .tl-hc-dot.c-terracotta { background: var(--p-copper); }
    .tl-hc-dot.c-forest { background: var(--p-forest); }
    .tl-hc-dot.c-olive { background: var(--p-olive); }
    .tl-hc-dot.c-ochre { background: var(--p-ochre); }
    .tl-hc-dot.c-umber { background: var(--p-umber); }
    .tl-hc-dot.c-stone { background: var(--p-stone); }
    .tl-hc-val {
      font-family: 'Google Sans Code', 'JetBrains Mono', ui-monospace, monospace;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      color: var(--p-ink);
    }
    .tl-hc-bar {
      height: 4px;
      border-radius: 999px;
      background: var(--p-track);
      overflow: hidden;
      display: flex;
      gap: 1px;
    }
    .tl-hc-bar-up { background: var(--p-copper); height: 100%; }
    .tl-hc-bar-down { background: var(--p-forest); height: 100%; }
    .tl-hc-models {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .tl-hc-m-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
    }
    .tl-hc-m-name {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      color: var(--p-ink-2);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tl-hc-m-val {
      font-family: 'Google Sans Code', 'JetBrains Mono', ui-monospace, monospace;
      font-variant-numeric: tabular-nums;
      color: var(--p-ink);
      flex-shrink: 0;
    }
    .tl-hc-m-pct {
      color: var(--p-muted);
      margin-left: 3px;
    }
    .tl-hc-open-btn {
      appearance: none;
      width: 100%;
      border: none;
      border-radius: 7px;
      padding: 5px 8px;
      background: var(--p-track);
      color: var(--p-ink-2);
      font-family: inherit;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      transition: background 120ms ease, color 120ms ease;
    }
    .tl-hc-open-btn:hover {
      background: var(--p-hover);
      color: var(--p-ink);
    }
    .tl-hc-kbd {
      font-family: 'Google Sans Code', 'JetBrains Mono', ui-monospace, monospace;
      font-size: 10px;
      color: var(--p-muted);
    }
  \`;

  const MODAL_CSS = \`
    :host {
      all: initial;
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      pointer-events: none;
      font-family: 'Google Sans Flex', 'Plus Jakarta Sans', 'Inter', 'PingFang SC', 'Microsoft YaHei UI', system-ui, sans-serif;
    }
    .tl-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(20, 19, 17, 0.52);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      pointer-events: auto;
    }
    .tl-backdrop.is-open {
      display: flex;
    }
    .tl-modal {
      width: min(980px, 92vw);
      max-height: 86vh;
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #F7F4EE;
      color: #1C1917;
      border: 1px solid #D4CCBC;
      box-shadow: 0 24px 64px rgba(20, 19, 17, 0.34);
    }
    .tl-modal[data-theme="dark"] {
      background: #141311;
      color: #F2EDE4;
      border-color: #423C33;
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.62);
    }
    .tl-modal-scroll {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: thin;
      scrollbar-color: #D8D0C3 transparent;
    }
    .tl-modal[data-theme="dark"] .tl-modal-scroll {
      scrollbar-color: #302C26 transparent;
    }
    .tl-modal-scroll::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .tl-modal-scroll::-webkit-scrollbar-track {
      background: transparent;
    }
    .tl-modal-scroll::-webkit-scrollbar-thumb {
      background: #D8D0C3;
      border-radius: 999px;
    }
    .tl-modal-scroll::-webkit-scrollbar-thumb:hover {
      background: #BFB6A5;
    }
    .tl-modal[data-theme="dark"] .tl-modal-scroll::-webkit-scrollbar-thumb {
      background: #302C26;
    }
    .tl-modal[data-theme="dark"] .tl-modal-scroll::-webkit-scrollbar-thumb:hover {
      background: #464037;
    }
  \`;

  // 1. Inline Composer Footer Pill Host
  const pillHost = document.createElement('div');
  pillHost.id = 'agy-ledger-pill-host';
  // Unslotted light DOM marker lets agy-capsule's isControlGroup detect pillHost reliably
  const markerSpan = document.createElement('span');
  markerSpan.setAttribute('role', 'button');
  markerSpan.setAttribute('aria-hidden', 'true');
  pillHost.appendChild(markerSpan);

  const pillShadow = pillHost.attachShadow({ mode: 'open' });
  const pillStyleEl = document.createElement('style');
  pillStyleEl.textContent = PILL_CSS;
  pillShadow.appendChild(pillStyleEl);

  const pillWrap = document.createElement('div');
  pillWrap.className = 'tl-pill-wrap';
  pillWrap.setAttribute('data-open', 'false');
  pillWrap.setAttribute('data-theme', 'light');
  pillWrap.innerHTML = \`
    <button type="button" class="tl-pill-main is-hidden" data-el="pill-open">
      <span class="tl-pill-dot"></span>
      <span class="tl-pill-text" data-el="pill-text"></span>
    </button>
    <div class="tl-hover-wrap" data-el="hover-wrap">
      <div class="tl-hover-card" data-el="hover-card"></div>
    </div>
  \`;
  pillShadow.appendChild(pillWrap);

  const pillBtn = pillShadow.querySelector('[data-el="pill-open"]');
  const hoverWrapEl = pillShadow.querySelector('[data-el="hover-wrap"]');
  const hoverCardEl = pillShadow.querySelector('[data-el="hover-card"]');

  // 2. Centered Modal Host (mounted directly on document.body)
  const modalHost = document.createElement('div');
  modalHost.id = 'agy-ledger-host';
  const modalShadow = modalHost.attachShadow({ mode: 'open' });

  const modalStyleEl = document.createElement('style');
  modalStyleEl.textContent = STYLES_CSS + '\\n' + MODAL_CSS;
  modalShadow.appendChild(modalStyleEl);

  const backdrop = document.createElement('div');
  backdrop.className = 'tl-backdrop';
  backdrop.innerHTML = \`
    <div class="tl-modal" data-el="modal-box" role="dialog" aria-modal="true" aria-label="Token Calendar">
      <div class="tl-modal-scroll" data-el="modal-body"></div>
    </div>
  \`;
  modalShadow.appendChild(backdrop);

  const pillTextEl = pillShadow.querySelector('[data-el="pill-text"]');
  const modalBoxEl = modalShadow.querySelector('[data-el="modal-box"]');
  const modalBodyEl = modalShadow.querySelector('[data-el="modal-body"]');

  const state = {
    disposed: false,
    modalOpen: false,
    hoverOpen: false,
    footerWidth: 800,
    snapshot: null,
    pendingPrefsPatch: null,
    pendingForceRefresh: false,
    dashboardCtrl: null,
  };

  function parseLuminance(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return null;
    const s = colorStr.trim();
    const hex = s.replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex)) {
      const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
      const num = parseInt(full, 16);
      return (0.299 * ((num >> 16) & 255) + 0.587 * ((num >> 8) & 255) + 0.114 * (num & 255)) / 255;
    }
    const rgb = s.match(/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)(?:\\s*[,\\/]\\s*([\\d.]+))?/i);
    if (rgb) {
      if (rgb[4] !== undefined && Number(rgb[4]) <= 0.05) return null;
      return (0.299 * Number(rgb[1]) + 0.587 * Number(rgb[2]) + 0.114 * Number(rgb[3])) / 255;
    }
    return null;
  }

  function detectAgyTheme() {
    try {
      const body = document.body;
      const doc = document.documentElement;
      const hasAny = (el, names) => Boolean(el?.classList && names.some((n) => el.classList.contains(n)));
      const darkClasses = ['dark', 'theme-dark', 'dark-theme', 'vscode-dark'];
      const lightClasses = ['light', 'theme-light', 'light-theme', 'vscode-light'];
      if (hasAny(body, lightClasses) || hasAny(doc, lightClasses)) return 'light';
      if (hasAny(body, darkClasses) || hasAny(doc, darkClasses)) return 'dark';

      const docCs = doc ? getComputedStyle(doc) : null;
      const bodyCs = body ? getComputedStyle(body) : null;
      const lum =
        parseLuminance(docCs?.getPropertyValue('--background')) ??
        parseLuminance(bodyCs?.backgroundColor);
      if (lum !== null) return lum < 0.5 ? 'dark' : 'light';
      if (docCs?.colorScheme === 'dark') return 'dark';
      if (docCs?.colorScheme === 'light') return 'light';
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch {}
    return 'light';
  }

  function resolveModalTheme() {
    const mode = state.snapshot?.prefs?.theme || 'auto';
    if (mode === 'light' || mode === 'dark') return mode;
    return detectAgyTheme();
  }

  function fmtCompactTok(n) {
    const num = Number(n || 0);
    if (num >= 1e9) return (num / 1e9).toFixed(2).replace(/\\.00$/, '') + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\\.0$/, '') + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\\.0$/, '') + 'K';
    return String(Math.round(num));
  }

  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtBytesFull(b) {
    const n = Number(b || 0);
    if (!Number.isFinite(n) || n <= 0) return '0 B';
    const KB = 1024;
    const MB = KB * 1024;
    const GB = MB * 1024;
    if (n >= GB) return (n / GB).toFixed(n >= 10 * GB ? 1 : 2).replace(/\\.00$/, '') + ' GB';
    if (n >= MB) return (n / MB).toFixed(n >= 100 * MB ? 0 : 1).replace(/\\.0$/, '') + ' MB';
    if (n >= KB) return (n / KB).toFixed(n >= 100 * KB ? 0 : 1).replace(/\\.0$/, '') + ' KB';
    return Math.round(n) + ' B';
  }

  function fmtMoneyShort(usd) {
    const val = Number(usd || 0);
    return '$' + val.toFixed(2);
  }

  function positionHoverCard() {
    if (!hoverWrapEl || !state.hoverOpen) return;
    try {
      hoverWrapEl.style.left = '';
      const pr = hoverWrapEl.getBoundingClientRect();
      if (!pr || pr.width <= 0) return;
      const vw = window.innerWidth || 1280;
      const maxRight = vw - 8;
      if (pr.right > maxRight) {
        hoverWrapEl.style.left = Math.max(-pr.left + 8, maxRight - pr.right) + 'px';
      } else if (pr.left < 8) {
        hoverWrapEl.style.left = (8 - pr.left) + 'px';
      }
    } catch {}
  }

  function renderHoverCard() {
    const snap = state.snapshot;
    if (!snap || !hoverCardEl) return;
    const isEn = snap.prefs?.lang === 'en';
    const today = snap.today || {};
    const todayKey = snap.todayKey || '';
    const dateShort = todayKey ? todayKey.slice(5) : '';
    const turns = today.turns || 0;
    const promptTok = (today.uncachedIn || 0) + (today.cachedIn || 0);
    const hitPct = promptTok > 0 ? ((today.cachedIn / promptTok) * 100).toFixed(0) : '0';

    const up = today.trafficUpBytes || 0;
    const down = today.trafficDownBytes || 0;
    const totalNet = today.trafficBytes || 0;
    const st = snap.trafficStatus || { state: 'idle' };
    const dotCls = st.state === 'active' ? 'is-active' : st.state === 'admin_required' ? 'is-warn' : '';
    const netLabel = isEn ? 'Today Traffic' : '今日流量';
    const netRight =
      st.state === 'admin_required' && totalNet <= 0
        ? (isEn ? 'Admin req.' : '需管理员')
        : fmtBytesFull(totalNet);
    const upPct = totalNet > 0 ? Math.max(2, (up / totalNet) * 100) : 0;
    const downPct = totalNet > 0 ? Math.max(2, (down / totalNet) * 100) : 0;

    const todayDay = snap.days?.[todayKey];
    const topModels = Object.values(todayDay?.byModel || {})
      .sort((a, b) => b.costUsd - a.costUsd || b.grossTokens - a.grossTokens)
      .slice(0, 3);
    const dayCostDenom = Math.max(0.0001, today.costUsd || 0);

    const modelsHtml =
      topModels.length > 0
        ? '<div class="tl-hc-divider"></div><div class="tl-hc-models">' +
          topModels
            .map((m) => {
              const share = Math.round((m.costUsd / dayCostDenom) * 100);
              return (
                '<div class="tl-hc-m-row">' +
                '<span class="tl-hc-m-name"><span class="tl-hc-dot c-' +
                escHtml(m.color || 'stone') +
                '"></span>' +
                escHtml(m.shortLabel || m.label) +
                '</span>' +
                '<span class="tl-hc-m-val">' +
                escHtml(fmtMoneyShort(m.costUsd)) +
                '<span class="tl-hc-m-pct">' +
                share +
                '%</span></span></div>'
              );
            })
            .join('') +
          '</div>'
        : '';

    hoverCardEl.innerHTML =
      '<div class="tl-hc-head">' +
      '<span class="tl-hc-title">' +
      (isEn ? 'Today' : '今日概览') +
      (dateShort ? '<span class="tl-hc-date">' + escHtml(dateShort) + '</span>' : '') +
      '</span>' +
      '<span class="tl-hc-turns">' +
      turns +
      (isEn ? ' reqs' : ' 次') +
      '</span>' +
      '</div>' +
      '<div class="tl-hc-sec">' +
      '<div class="tl-hc-hero">' +
      '<span class="tl-hc-cost">' +
      escHtml(fmtMoneyShort(today.costUsd || 0)) +
      '</span>' +
      '<span class="tl-hc-tok">' +
      escHtml(fmtCompactTok(today.grossTokens || 0)) +
      ' Tokens</span>' +
      '</div>' +
      '<div class="tl-hc-sub">' +
      '<span>' +
      (isEn ? 'Cache ' + hitPct + '%' : '缓存命中 ' + hitPct + '%') +
      '</span>' +
      '<span class="tl-hc-saved">' +
      (isEn ? 'Saved ' : '省 ') +
      escHtml(fmtMoneyShort(today.savedUsd || 0)) +
      '</span>' +
      '</div>' +
      '</div>' +
      '<div class="tl-hc-divider"></div>' +
      '<div class="tl-hc-sec">' +
      '<div class="tl-hc-row">' +
      '<span class="tl-hc-lbl"><span class="tl-hc-dot ' +
      dotCls +
      '"></span>' +
      netLabel +
      '</span>' +
      '<span class="tl-hc-val">' +
      escHtml(netRight) +
      '</span>' +
      '</div>' +
      (totalNet > 0
        ? '<div class="tl-hc-bar">' +
          (up > 0 ? '<div class="tl-hc-bar-up" style="width:' + upPct.toFixed(1) + '%"></div>' : '') +
          (down > 0 ? '<div class="tl-hc-bar-down" style="width:' + downPct.toFixed(1) + '%"></div>' : '') +
          '</div>' +
          '<div class="tl-hc-sub">' +
          '<span>↑ ' +
          escHtml(fmtBytesFull(up)) +
          '</span>' +
          '<span>↓ ' +
          escHtml(fmtBytesFull(down)) +
          '</span>' +
          '</div>'
        : '') +
      '</div>' +
      modelsHtml +
      '<button type="button" class="tl-hc-open-btn" data-action="open-modal">' +
      '<span>' +
      (isEn ? 'Open Calendar' : '打开完整日历') +
      '</span>' +
      '<span class="tl-hc-kbd">Alt+L</span>' +
      '</button>';
  }

  let hoverCloseTimer = null;
  function clearHoverTimer() {
    if (hoverCloseTimer) {
      clearTimeout(hoverCloseTimer);
      hoverCloseTimer = null;
    }
  }
  function setHoverOpen(open) {
    clearHoverTimer();
    const next = Boolean(open) && !state.modalOpen && Boolean(state.snapshot);
    state.hoverOpen = next;
    pillWrap.setAttribute('data-open', next ? 'true' : 'false');
    if (next) {
      renderHoverCard();
      positionHoverCard();
    }
  }
  function scheduleHoverClose() {
    clearHoverTimer();
    hoverCloseTimer = setTimeout(() => {
      hoverCloseTimer = null;
      setHoverOpen(false);
    }, 130);
  }

  function renderChrome() {
    const snap = state.snapshot;
    if (!snap) return;
    const prefs = snap.prefs || {};
    const hostTheme = detectAgyTheme();
    pillBtn.setAttribute('data-theme', detectAgyTheme());
    pillWrap.setAttribute('data-theme', hostTheme);
    modalBoxEl.setAttribute('data-theme', resolveModalTheme());

    const visible = prefs.widgetVisible !== false;
    pillBtn.classList.toggle('is-hidden', !visible);
    pillBtn.classList.toggle('is-open', state.modalOpen);
    if (!visible) setHoverOpen(false);

    const nextHostStyle = visible
      ? 'display: inline-flex; align-items: center; flex-shrink: 0; margin: 0 2px; position: relative;'
      : 'display: none;';
    if (pillHost.style.cssText !== nextHostStyle) {
      pillHost.style.cssText = nextHostStyle;
    }

    const today = snap.today || {};
    pillTextEl.textContent = fmtMoneyShort(today.costUsd || 0);

    if (state.hoverOpen) {
      renderHoverCard();
      positionHoverCard();
    }
  }

  function findVisibleComposerFooter() {
    const nodes = document.querySelectorAll('.agy-composer-footer');
    let best = null;
    let bestW = -1;
    for (const node of nodes) {
      const cs = getComputedStyle(node);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') === 0) continue;
      const r = node.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.width > bestW) {
        best = node;
        bestW = r.width;
      }
    }
    return best;
  }

  let observedFooter = null;
  let footerResizeObserver = null;
  let bodyObserver = null;
  let themeAttrObserver = null;
  let dockRafId = 0;

  function ensureDocked() {
    if (state.disposed) return;

    if (document.body && !document.body.contains(modalHost)) {
      document.body.appendChild(modalHost);
    }

    const footer = findVisibleComposerFooter();
    if (!footer) {
      if (pillHost.isConnected) pillHost.remove();
      if (observedFooter) {
        try { footerResizeObserver?.disconnect(); } catch {}
        observedFooter = null;
      }
      return;
    }

    const footerLeft = footer.firstElementChild;
    const rightGroup = Array.from(footer.children).find((c) => c !== footerLeft && c !== pillHost) || null;
    const visible = state.snapshot?.prefs?.widgetVisible !== false;
    const nextHostStyle = visible
      ? 'display: inline-flex; align-items: center; flex-shrink: 0; margin: 0 2px; position: relative;'
      : 'display: none;';
    if (pillHost.style.cssText !== nextHostStyle) {
      pillHost.style.cssText = nextHostStyle;
    }

    if (pillHost.parentElement !== footer || pillHost.nextElementSibling !== rightGroup) {
      footer.insertBefore(pillHost, rightGroup);
    }

    if (observedFooter !== footer) {
      try { footerResizeObserver?.disconnect(); } catch {}
      observedFooter = footer;
      const r = footer.getBoundingClientRect();
      if (r && r.width > 0) state.footerWidth = r.width;
      if (typeof ResizeObserver !== 'undefined') {
        footerResizeObserver = new ResizeObserver((entries) => {
          const w = entries?.[0]?.contentRect?.width;
          if (w && Math.abs(w - state.footerWidth) > 8) {
            state.footerWidth = w;
            renderChrome();
          }
        });
        footerResizeObserver.observe(footer);
      }
      renderChrome();
    }
  }

  function scheduleEnsureDocked() {
    if (state.disposed || dockRafId) return;
    if (typeof requestAnimationFrame === 'function') {
      dockRafId = requestAnimationFrame(() => {
        dockRafId = 0;
        ensureDocked();
      });
    } else {
      ensureDocked();
    }
  }

  function closeModal() {
    state.modalOpen = false;
    backdrop.classList.remove('is-open');
    renderChrome();
  }

  function openModal() {
    if (state.disposed) return;
    setHoverOpen(false);
    if (document.body && !document.body.contains(modalHost)) {
      document.body.appendChild(modalHost);
    }
    state.modalOpen = true;
    backdrop.classList.add('is-open');
    renderChrome();

    if (!state.dashboardCtrl && typeof globalThis.mountTokenLedgerApp === 'function') {
      state.dashboardCtrl = globalThis.mountTokenLedgerApp(modalBodyEl, {
        mode: 'modal',
        initialSnapshot: state.snapshot,
        onCloseModal: closeModal,
        onLoad: async function (force) {
          if (force) state.pendingForceRefresh = true;
          return state.snapshot;
        },
        onUpdatePrefs: async function (patch) {
          state.pendingPrefsPatch = { ...(state.pendingPrefsPatch || {}), ...(patch || {}) };
          if (state.snapshot) {
            state.snapshot = {
              ...state.snapshot,
              prefs: { ...(state.snapshot.prefs || {}), ...(patch || {}) },
            };
            renderChrome();
          }
          return state.snapshot;
        },
        onOpenConversation: function (convId) {
          const link = document.querySelector(
            'a[href*="' + convId + '"], [data-conversation-id="' + convId + '"]'
          );
          if (link && typeof link.click === 'function') {
            link.click();
            closeModal();
            return true;
          }
          return false;
        },
      });
    } else if (state.dashboardCtrl && state.snapshot) {
      state.dashboardCtrl.updateSnapshot(state.snapshot);
      state.dashboardCtrl.refreshTheme();
    }
  }

  pillWrap.addEventListener('mouseenter', function () {
    setHoverOpen(true);
  });
  pillWrap.addEventListener('mouseleave', function () {
    scheduleHoverClose();
  });

  hoverCardEl.addEventListener('click', function (e) {
    const openBtn = e.target?.closest?.('[data-action="open-modal"]');
    if (openBtn) {
      e.stopPropagation();
      openModal();
    }
  });

  pillBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    setHoverOpen(false);
    if (state.modalOpen) closeModal();
    else openModal();
  });

  backdrop.addEventListener('click', function (e) {
    if (e.target === backdrop) closeModal();
  });

  function onKeyDown(e) {
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      if (state.modalOpen) closeModal();
      else openModal();
    } else if (e.key === 'Escape') {
      if (state.modalOpen) closeModal();
      else if (state.hoverOpen) setHoverOpen(false);
    }
  }
  window.addEventListener('keydown', onKeyDown, true);

  if (typeof MutationObserver !== 'undefined') {
    if (document.body) {
      bodyObserver = new MutationObserver((mutations) => {
        if (mutations.every((m) => pillHost.contains(m.target) || modalHost.contains(m.target))) return;
        const activeFooter = findVisibleComposerFooter();
        if (!activeFooter && pillHost.isConnected) {
          scheduleEnsureDocked();
        } else if (activeFooter && (!pillHost.isConnected || pillHost.parentElement !== activeFooter)) {
          scheduleEnsureDocked();
        }
      });
      bodyObserver.observe(document.body, { childList: true, subtree: true });
    }
    themeAttrObserver = new MutationObserver(() => {
      renderChrome();
      state.dashboardCtrl?.refreshTheme?.();
    });
    if (document.documentElement) {
      themeAttrObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    }
    if (document.body) {
      themeAttrObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    }
  }

  if (document.body) ensureDocked();
  else document.addEventListener('DOMContentLoaded', ensureDocked, { once: true });

  globalThis.__agyLedger = {
    pullClientState(reqTs) {
      if (state.disposed) return null;
      if (Number(reqTs || 0) < OWNER_TS) return 'superseded';
      ensureDocked();
      const out = {
        v: CLIENT_VERSION,
        hash: BUNDLE_HASH,
        ownerTs: OWNER_TS,
        modalOpen: state.modalOpen,
        prefsPatch: state.pendingPrefsPatch,
        forceRefresh: state.pendingForceRefresh,
      };
      state.pendingPrefsPatch = null;
      state.pendingForceRefresh = false;
      return out;
    },
    applyServerState(snap) {
      if (state.disposed || !snap) return false;
      state.snapshot = snap;
      ensureDocked();
      renderChrome();
      if (state.dashboardCtrl) {
        state.dashboardCtrl.updateSnapshot(snap);
      }
      return true;
    },
    dispose() {
      state.disposed = true;
      clearHoverTimer();
      window.removeEventListener('keydown', onKeyDown, true);
      if (dockRafId && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(dockRafId);
        dockRafId = 0;
      }
      try { bodyObserver?.disconnect(); } catch {}
      try { footerResizeObserver?.disconnect(); } catch {}
      try { themeAttrObserver?.disconnect(); } catch {}
      state.dashboardCtrl?.dispose?.();
      pillHost.remove();
      modalHost.remove();
    },
  };
})();
`;
}

export function buildCdpRuntimeBundle(initTs = Date.now()) {
  const appSrc = readFileSync(join(__dirname, 'web', 'app.js'), 'utf8');
  const stylesCss = readFileSync(join(__dirname, 'web', 'styles.css'), 'utf8');
  const overlaySrc = buildOverlayClientScript(stylesCss);
  const hash = computeBundleHash(`${appSrc}\n${stylesCss}\n${overlaySrc}`);
  const code = `${appSrc}\nglobalThis.__AGY_LEDGER_INIT_TS = ${Number(initTs)};\nglobalThis.__AGY_LEDGER_BUNDLE_HASH = ${JSON.stringify(hash)};\n${overlaySrc}\ntrue;`;
  return { code, hash };
}

export function startCdpModalInjector(collector, options = {}) {
  const instanceTs = Number(options.instanceTs || Date.now());
  const portFile = options.portFile || resolveCdpPortFile();
  const { code: runtimeBundle, hash: bundleHash } = buildCdpRuntimeBundle(instanceTs);
  const onSuperseded = typeof options.onSuperseded === 'function' ? options.onSuperseded : () => {};

  const sockets = new Map();
  let cachedPages = [];
  let lastListAt = 0;
  let lastErr = '';
  let stopped = false;

  function logOnce(msg) {
    if (msg !== lastErr) {
      lastErr = msg;
      console.error('[agy-ledger]', msg);
    }
  }

  function readCdpPort() {
    try {
      return readFileSync(portFile, 'utf8').split(/\r?\n/)[0].trim();
    } catch {
      return '';
    }
  }

  async function connectTarget(target) {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    const entry = { ws, pending: new Map(), nextId: 1, lastRev: '' };
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        ws.onopen = null;
        ws.onerror = null;
        try {
          ws.close();
        } catch {}
        reject(new Error('ws timeout'));
      }, 3000);
      ws.onopen = () => {
        clearTimeout(t);
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(t);
        try {
          ws.close();
        } catch {}
        reject(new Error('ws error'));
      };
    });
    if (stopped) {
      try {
        ws.close();
      } catch {}
      throw new Error('stopped');
    }
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        const cb = entry.pending.get(msg.id);
        if (cb) {
          entry.pending.delete(msg.id);
          cb(msg);
        }
      } catch {}
    };
    ws.onclose = () => {
      for (const cb of entry.pending.values()) {
        try {
          cb(undefined);
        } catch {}
      }
      entry.pending.clear();
      sockets.delete(target.id);
    };
    sockets.set(target.id, entry);
    return entry;
  }

  function evaluate(entry, expression) {
    return new Promise((resolve) => {
      if (!entry?.ws || entry.ws.readyState !== 1) {
        resolve(undefined);
        return;
      }
      const id = entry.nextId++;
      const t = setTimeout(() => {
        entry.pending.delete(id);
        resolve(undefined);
      }, 3000);
      entry.pending.set(id, (msg) => {
        clearTimeout(t);
        resolve(msg?.result?.result?.value);
      });
      try {
        entry.ws.send(
          JSON.stringify({
            id,
            method: 'Runtime.evaluate',
            params: { expression, returnByValue: true },
          })
        );
      } catch {
        clearTimeout(t);
        entry.pending.delete(id);
        resolve(undefined);
      }
    });
  }

  async function refreshPagesIfNeeded(now) {
    const interval = sockets.size > 0 ? LIST_POLL_CONNECTED_MS : LIST_POLL_DISCONNECTED_MS;
    if (sockets.size > 0 && now - lastListAt < interval && cachedPages.length > 0) {
      return cachedPages;
    }
    const port = readCdpPort();
    if (!port) return [];
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const targets = await res.json();
      lastListAt = now;
      cachedPages = Array.isArray(targets) ? targets.filter(isAntigravityUiTarget) : [];
      const activeIds = new Set(cachedPages.map((t) => t.id));
      for (const [id, entry] of sockets.entries()) {
        if (!activeIds.has(id)) {
          try {
            entry.ws.close();
          } catch {}
          sockets.delete(id);
        }
      }
      return cachedPages;
    } catch (e) {
      logOnce(`CDP list failed: ${e.message}`);
      return sockets.size > 0 ? cachedPages : [];
    }
  }

  async function tick() {
    if (stopped) return;
    const pages = await refreshPagesIfNeeded(Date.now());
    for (const t of pages) {
      if (stopped) return;
      try {
        const entry = sockets.get(t.id) || (await connectTarget(t));
        let clientState = await evaluate(entry, `globalThis.__agyLedger?.pullClientState?.(${instanceTs}) ?? null`);
        if (clientState === undefined) continue;

        if (clientState === 'superseded') {
          stop();
          onSuperseded();
          return;
        }

        const needsInject =
          !clientState ||
          typeof clientState !== 'object' ||
          clientState.v !== LEDGER_CLIENT_VERSION ||
          clientState.hash !== bundleHash;

        if (needsInject) {
          const ok = await evaluate(entry, runtimeBundle);
          if (!ok) continue;
          entry.lastRev = '';
          clientState = await evaluate(entry, `globalThis.__agyLedger?.pullClientState?.(${instanceTs}) ?? null`);
          if (clientState === undefined || clientState === 'superseded') continue;
        }

        if (clientState && typeof clientState === 'object') {
          if (clientState.prefsPatch) {
            collector.updatePrefs(clientState.prefsPatch);
            entry.lastRev = '';
          }
          const snapshot = await collector.getLedgerSnapshot({ force: Boolean(clientState.forceRefresh) });
          if (snapshot && snapshot.rev !== entry.lastRev) {
            const applied = await evaluate(
              entry,
              `globalThis.__agyLedger?.applyServerState?.(${JSON.stringify(snapshot)}) ?? false`
            );
            entry.lastRev = applied === true ? snapshot.rev : '';
          }
        }
        lastErr = '';
      } catch (e) {
        const existing = sockets.get(t.id);
        if (existing) {
          try {
            existing.ws.close();
          } catch {}
          sockets.delete(t.id);
        }
        logOnce(`page ${t.id}: ${e.message}`);
      }
    }
  }

  let busy = false;
  const timer = setInterval(async () => {
    if (busy || stopped) return;
    busy = true;
    try {
      await tick();
    } finally {
      busy = false;
    }
  }, TICK_INTERVAL_MS);
  timer.unref?.();

  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    for (const entry of sockets.values()) {
      try {
        entry.ws.close();
      } catch {}
    }
    sockets.clear();
  }

  return { stop };
}
