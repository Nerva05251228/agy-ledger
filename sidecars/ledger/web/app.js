/**
 * Minimalist, Progressive-Disclosure Token Calendar UI (`mountTokenLedgerApp`).
 *
 * Fixed to USD ($) billing and gross tokens (including cached input), with
 * daily & cumulative AGY OS-process network traffic analytics.
 * First screen shows only the header, 4 clickable summary tiles, and calendar.
 * Clicking any day or summary tile reveals the single-card tabbed detail drawer.
 */
(function (globalScope) {
  'use strict';

  const ICONS = {
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  };

  const COPY = {
    'zh-CN': {
      title: 'Token 日历',
      loading: '加载中…',
      loadError: '加载失败',
      retry: '重试',
      themeLabel: '主题',
      themeAuto: '跟随系统',
      themeLight: '浅色',
      themeDark: '深色',
      langLabel: '语言',
      langVal: '中文',
      pillLabel: '底部胶囊',
      pillOn: '显示',
      pillOff: '隐藏',
      trafficLabel: '进程流量',
      proxyTrafficLabel: 'AGY 代理流量',
      proxyPortLabel: '控制接口端口',
      proxyPortAuto: '自动识别',
      proxyPortSave: '保存',
      proxyPaused: '采集暂停',
      proxyNoProcess: '代理未提供进程信息',
      proxyConnCount: (count) => `${count} 个 AGY 连接`,
      trafficActive: '运行中',
      trafficStarting: '启动中',
      trafficAdmin: '需管理员',
      trafficOff: '未启用',
      rateCard: '单价标准',
      refresh: '刷新数据',
      rateUnit: '$ / 1M Tokens',
      colModel: '模型',
      colIn: '输入',
      colCache: '缓存',
      colOut: '输出',
      kpiToday: '今日',
      kpiMonth: '本月',
      kpiAllTime: '总计',
      kpiSavings: '缓存节省',
      turnsUnit: '次',
      daysShort: '天',
      dailyAvg: (v) => `日均 ${v}`,
      convsSummary: (n) => `${n} 对话`,
      trafficShort: (v) => `流量 ${v}`,
      trafficTotalShort: (v) => `总流量 ${v}`,
      cachedSub: '缓存读取',
      hitRate: (pct) => `命中 ${pct}%`,
      tabMonth: '月历',
      tabYear: '全年',
      todayJump: '回到本月',
      weekdays: ['一', '二', '三', '四', '五', '六', '日'],
      formatMonth: (ym) => {
        const [y, m] = ym.split('-').map(Number);
        return `${y}年 ${m}月`;
      },
      formatDay: (ymd) => {
        const [, m, d] = ymd.split('-').map(Number);
        return `${m}月${d}日`;
      },
      allTitle: '全部记录',
      yearActive: (n) => `活跃 ${n} 天`,
      yearStreak: (n) => `连续 ${n} 天`,
      yearPeak: (v) => `最高 ${v}`,
      tabModels: '模型',
      tabTypes: '分类',
      tabTraffic: '流量',
      tabChats: '对话',
      tabHours: '时段',
      uncachedIn: '普通输入',
      cachedIn: '缓存读取',
      thinkingOut: '思考过程',
      responseOut: '模型回复',
      trafficUp: '上行上传',
      trafficDown: '下行下载',
      trafficSum: '合计流量',
      trafficEmpty: '该时段暂无流量记录（安装后实时按日累计）',
      trafficBackendText: (st) => {
        if (st.backend === 'win-proxy') {
          const port = st.controllerPort ? ` · ${st.controllerPort}` : '';
          const state = st.state === 'active' ? '运行中' : st.state === 'starting' ? '启动中' :
            st.error === 'Proxy did not provide process names' ? '代理未提供进程信息' : '采集暂停';
          return `AGY 代理流量${port} · ${state}`;
        }
        const b =
          st.backend === 'win-estats'
            ? 'Windows 进程 TCP'
            : st.backend === 'macos-nettop'
              ? 'macOS nettop'
              : st.backend === 'linux-ss'
                ? 'Linux ss'
                : '系统进程';
        if (st.state === 'active') return `${b} · 运行中`;
        if (st.state === 'admin_required') return `${b} · 需管理员权限运行`;
        if (st.state === 'starting') return `${b} · 启动中`;
        return `${b} · 未启用`;
      },
      trafficMetaCount: (pids, conns) => `${pids} 进程 · ${conns} 连接`,
      noDataPeriod: '暂无记录',
      untitledConv: (id) => `未命名对话 · ${id.slice(0, 6)}`,
      subagentTag: '子任务',
      archivedTag: '已归档',
      cliTag: 'CLI',
    },
    en: {
      title: 'Token Calendar',
      loading: 'Loading…',
      loadError: 'Failed to load',
      retry: 'Retry',
      themeLabel: 'Theme',
      themeAuto: 'System',
      themeLight: 'Light',
      themeDark: 'Dark',
      langLabel: 'Language',
      langVal: 'English',
      pillLabel: 'Footer Pill',
      pillOn: 'Show',
      pillOff: 'Hide',
      trafficLabel: 'Traffic',
      proxyTrafficLabel: 'AGY proxy traffic',
      proxyPortLabel: 'Controller port',
      proxyPortAuto: 'Auto-detect',
      proxyPortSave: 'Save',
      proxyPaused: 'Paused',
      proxyNoProcess: 'Process info unavailable',
      proxyConnCount: (count) => `${count} AGY connections`,
      trafficActive: 'Active',
      trafficStarting: 'Starting',
      trafficAdmin: 'Admin req.',
      trafficOff: 'Idle',
      rateCard: 'Pricing',
      refresh: 'Refresh',
      rateUnit: '$ / 1M Tokens',
      colModel: 'Model',
      colIn: 'Input',
      colCache: 'Cache',
      colOut: 'Output',
      kpiToday: 'Today',
      kpiMonth: 'This Month',
      kpiAllTime: 'Total',
      kpiSavings: 'Cache Saved',
      turnsUnit: 'reqs',
      daysShort: 'd',
      dailyAvg: (v) => `${v}/d`,
      convsSummary: (n) => `${n} chats`,
      trafficShort: (v) => `Net ${v}`,
      trafficTotalShort: (v) => `Total ${v}`,
      cachedSub: 'cached',
      hitRate: (pct) => `${pct}% cached`,
      tabMonth: 'Month',
      tabYear: 'Year',
      todayJump: 'Today',
      weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      formatMonth: (ym) => {
        const [y, m] = ym.split('-').map(Number);
        const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${names[(m - 1) % 12]} ${y}`;
      },
      formatDay: (ymd) => {
        const [, m, d] = ymd.split('-').map(Number);
        const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${names[(m - 1) % 12]} ${d}`;
      },
      allTitle: 'All Time',
      yearActive: (n) => `${n} active`,
      yearStreak: (n) => `${n}d streak`,
      yearPeak: (v) => `Peak ${v}`,
      tabModels: 'Models',
      tabTypes: 'Types',
      tabTraffic: 'Traffic',
      tabChats: 'Chats',
      tabHours: 'Hours',
      uncachedIn: 'Input',
      cachedIn: 'Cached',
      thinkingOut: 'Thinking',
      responseOut: 'Output',
      trafficUp: 'Upload',
      trafficDown: 'Download',
      trafficSum: 'Total',
      trafficEmpty: 'No traffic recorded for this period yet',
      trafficBackendText: (st) => {
        if (st.backend === 'win-proxy') {
          const port = st.controllerPort ? ` · ${st.controllerPort}` : '';
          const state = st.state === 'active' ? 'Active' : st.state === 'starting' ? 'Starting' :
            st.error === 'Proxy did not provide process names' ? 'Process info unavailable' : 'Paused';
          return `AGY proxy traffic${port} · ${state}`;
        }
        const b =
          st.backend === 'win-estats'
            ? 'Windows TCP EStats'
            : st.backend === 'macos-nettop'
              ? 'macOS nettop'
              : st.backend === 'linux-ss'
                ? 'Linux ss'
                : 'Process monitor';
        if (st.state === 'active') return `${b} · Active`;
        if (st.state === 'admin_required') return `${b} · Run as Administrator`;
        if (st.state === 'starting') return `${b} · Starting`;
        return `${b} · Idle`;
      },
      trafficMetaCount: (pids, conns) => `${pids} procs · ${conns} conns`,
      noDataPeriod: 'No data',
      untitledConv: (id) => `Untitled · ${id.slice(0, 6)}`,
      subagentTag: 'Subtask',
      archivedTag: 'Archived',
      cliTag: 'CLI',
    },
  };

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtTokens(n) {
    const num = Number(n || 0);
    if (!Number.isFinite(num) || num <= 0) return '0';
    if (num >= 1e9) return (num / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(num >= 1e7 ? 1 : 2).replace(/\.00$/, '') + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(num >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return String(Math.round(num));
  }

  function fmtMoney(usd, compact) {
    const val = Number(usd || 0);
    if (!Number.isFinite(val) || val <= 0) return '$' + (compact ? '0' : '0.00');
    if (compact) {
      if (val >= 100) return '$' + Math.round(val);
      if (val >= 10) return '$' + val.toFixed(1);
      return '$' + val.toFixed(2);
    }
    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtRate(v) {
    const n = Number(v || 0);
    if (Math.abs(n * 100 - Math.round(n * 100)) < 1e-6) return '$' + n.toFixed(2);
    return '$' + n.toFixed(3).replace(/0+$/, '');
  }

  function fmtBytes(bytes, compact) {
    const n = Number(bytes || 0);
    if (!Number.isFinite(n) || n <= 0) return compact ? '0B' : '0 B';
    const KB = 1024;
    const MB = KB * 1024;
    const GB = MB * 1024;
    const TB = GB * 1024;
    const sp = compact ? '' : ' ';
    if (n >= TB) return (n / TB).toFixed(n >= 10 * TB ? 1 : 2).replace(/\.00$/, '') + sp + 'TB';
    if (n >= GB) return (n / GB).toFixed(n >= 10 * GB ? 1 : 2).replace(/\.00$/, '') + sp + 'GB';
    if (n >= MB) return (n / MB).toFixed(n >= 100 * MB ? 0 : 1).replace(/\.0$/, '') + sp + 'MB';
    if (n >= KB) return (n / KB).toFixed(n >= 100 * KB ? 0 : 1).replace(/\.0$/, '') + sp + 'KB';
    return Math.round(n) + sp + 'B';
  }

  function parseLuminance(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return null;
    const s = colorStr.trim();
    const hex = s.replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex)) {
      const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
      const num = parseInt(full, 16);
      return (0.299 * ((num >> 16) & 255) + 0.587 * ((num >> 8) & 255) + 0.114 * (num & 255)) / 255;
    }
    const rgb = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*[,/]\s*([\d.]+))?/i);
    if (rgb) {
      if (rgb[4] !== undefined && Number(rgb[4]) <= 0.05) return null;
      return (0.299 * Number(rgb[1]) + 0.587 * Number(rgb[2]) + 0.114 * Number(rgb[3])) / 255;
    }
    return null;
  }

  function detectHostTheme() {
    try {
      const rootStyle = getComputedStyle(document.documentElement);
      const bodyStyle = document.body ? getComputedStyle(document.body) : null;
      const lum = parseLuminance(rootStyle.getPropertyValue('--background')) ?? parseLuminance(bodyStyle?.backgroundColor);
      if (lum !== null) return lum < 0.5 ? 'dark' : 'light';
      if (
        document.body?.classList?.contains('dark') ||
        document.body?.classList?.contains('theme-dark') ||
        document.documentElement?.classList?.contains('dark')
      ) {
        return 'dark';
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch {}
    return 'light';
  }

  function localDateKey(ts) {
    const d = new Date(ts);
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  function shiftMonth(ym, delta) {
    const [y, m] = ym.split('-').map(Number);
    const dt = new Date(y, m - 1 + delta, 1);
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
  }

  function computeHeatLevel(cost, p90) {
    if (!cost || cost <= 0) return 0;
    const maxRef = Math.max(0.05, p90 || 1);
    const ratio = cost / maxRef;
    if (ratio >= 0.85) return 4;
    if (ratio >= 0.5) return 3;
    if (ratio >= 0.22) return 2;
    return 1;
  }

  function mountTokenLedgerApp(containerEl, adapter = {}) {
    if (!containerEl) throw new Error('mountTokenLedgerApp requires containerEl');

    const root = document.createElement('div');
    root.className = 'tl-root';
    containerEl.innerHTML = '';
    containerEl.appendChild(root);

    const ui = {
      snapshot: adapter.initialSnapshot || null,
      loading: !adapter.initialSnapshot,
      error: '',
      calTab: 'month', // 'month' | 'year'
      viewMonth: '',
      inspectorScope: null, // null | { type: 'day'|'month'|'all', key: string }
      detailTab: 'models', // 'models' | 'types' | 'traffic' | 'chats' | 'hours'
      menuOpen: false,
      showRateCard: false,
      activeHour: null,
      lastTheme: '',
    };

    function getPrefs() {
      return (
        ui.snapshot?.prefs || {
          lang: 'zh-CN',
          theme: 'auto',
          widgetVisible: true,
        }
      );
    }

    function applyResolvedTheme() {
      const prefs = getPrefs();
      const resolved = prefs.theme === 'auto' ? detectHostTheme() : prefs.theme;
      root.setAttribute('data-theme', resolved === 'dark' ? 'dark' : 'light');
      if (resolved !== ui.lastTheme) {
        ui.lastTheme = resolved;
        if (typeof adapter.onThemeResolved === 'function') {
          adapter.onThemeResolved(resolved);
        }
      }
    }

    function ensureInitialPeriod() {
      if (!ui.snapshot) return;
      const todayKey = ui.snapshot.todayKey || localDateKey(Date.now());
      if (!ui.viewMonth) {
        ui.viewMonth = todayKey.slice(0, 7);
      }
    }

    async function patchPrefs(patch) {
      if (ui.snapshot) {
        ui.snapshot = { ...ui.snapshot, prefs: { ...getPrefs(), ...patch } };
        render();
      }
      if (typeof adapter.onUpdatePrefs === 'function') {
        try {
          const updated = await adapter.onUpdatePrefs(patch);
          if (updated && updated.totals) {
            ui.snapshot = updated;
            render();
          }
        } catch {}
      }
    }

    async function reload(force) {
      ui.loading = !ui.snapshot;
      ui.error = '';
      render();
      try {
        if (typeof adapter.onLoad === 'function') {
          const snap = await adapter.onLoad(Boolean(force));
          if (snap) {
            ui.snapshot = snap;
            ensureInitialPeriod();
          }
        }
      } catch (err) {
        ui.error = err?.message || 'Load error';
      } finally {
        ui.loading = false;
        render();
      }
    }

    function getP90Cost() {
      const days = Object.values(ui.snapshot?.days || {})
        .map((d) => Number(d.costUsd || 0))
        .filter((v) => v > 0)
        .sort((a, b) => a - b);
      if (days.length === 0) return 1;
      const idx = Math.min(days.length - 1, Math.floor(days.length * 0.9));
      return Math.max(days[idx], 0.1);
    }

    function renderRateCard(t) {
      if (!ui.showRateCard) return '';
      const rows = (ui.snapshot?.rateCard || [])
        .map((r) => {
          const inStr = r.inRate === r.inLong ? fmtRate(r.inRate) : `${fmtRate(r.inRate)} / ${fmtRate(r.inLong)}`;
          const outStr = r.outRate === r.outLong ? fmtRate(r.outRate) : `${fmtRate(r.outRate)} / ${fmtRate(r.outLong)}`;
          return `
          <tr>
            <td>
              <span class="tl-model-name-cell slot-${esc(r.color)}">
                <span class="tl-dot"></span>${esc(r.label)}
              </span>
            </td>
            <td class="num tl-num">${esc(inStr)}</td>
            <td class="num tl-num">${esc(fmtRate(r.cacheRate))}</td>
            <td class="num tl-num">${esc(outStr)}</td>
          </tr>`;
        })
        .join('');

      return `
        <section class="tl-rate-drawer">
          <div class="tl-rate-head">
            <div>
              <span class="tl-rate-title">${esc(t.rateCard)}</span>
              <span class="tl-rate-unit">${esc(t.rateUnit)}</span>
            </div>
            <button type="button" class="tl-icon-btn" data-action="close-rates" aria-label="Close">${ICONS.close}</button>
          </div>
          <div class="tl-rate-scroll">
            <table class="tl-rate-table">
              <thead>
                <tr>
                  <th>${esc(t.colModel)}</th>
                  <th class="num">${esc(t.colIn)}</th>
                  <th class="num">${esc(t.colCache)}</th>
                  <th class="num">${esc(t.colOut)}</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </section>`;
    }

    function renderMonthCalendar(t, p90) {
      const ym = ui.viewMonth;
      const [year, month] = ym.split('-').map(Number);
      const firstDay = new Date(year, month - 1, 1);
      const startDow = (firstDay.getDay() + 6) % 7;
      const daysInMonth = new Date(year, month, 0).getDate();
      const cellCount = Math.ceil((startDow + daysInMonth) / 7) * 7;
      const todayKey = ui.snapshot.todayKey || localDateKey(Date.now());

      const prevYm = shiftMonth(ym, -1);
      const [py, pm] = prevYm.split('-').map(Number);
      const prevDays = new Date(py, pm, 0).getDate();

      const selectedDayKey = ui.inspectorScope?.type === 'day' ? ui.inspectorScope.key : '';

      const cells = [];
      for (let i = 0; i < cellCount; i++) {
        const dayOffset = i - startDow + 1;
        let cellDate = '';
        let dayNum = 0;
        let isOutside = false;

        if (dayOffset <= 0) {
          dayNum = prevDays + dayOffset;
          cellDate = `${prevYm}-${String(dayNum).padStart(2, '0')}`;
          isOutside = true;
        } else if (dayOffset > daysInMonth) {
          const nextYm = shiftMonth(ym, 1);
          dayNum = dayOffset - daysInMonth;
          cellDate = `${nextYm}-${String(dayNum).padStart(2, '0')}`;
          isOutside = true;
        } else {
          dayNum = dayOffset;
          cellDate = `${ym}-${String(dayNum).padStart(2, '0')}`;
        }

        const d = ui.snapshot.days?.[cellDate];
        const hasTurns = !isOutside && Boolean(d && d.turns > 0);
        const hasTraffic = !isOutside && Boolean(d && d.trafficBytes > 0);
        const hasData = hasTurns || hasTraffic;
        const level = hasTurns ? computeHeatLevel(d.costUsd, p90) : hasTraffic ? 1 : 0;
        const isToday = cellDate === todayKey;
        const isSelected = selectedDayKey === cellDate;

        const cls = [
          'tl-cal-cell',
          `heat-${level}`,
          isOutside ? 'is-outside' : '',
          !hasData ? 'is-empty-day' : '',
          isSelected ? 'is-selected' : '',
        ]
          .filter(Boolean)
          .join(' ');

        cells.push(`
          <button type="button" class="${cls}" data-action="select-day" data-date="${esc(cellDate)}" ${hasData ? '' : 'data-empty="1"'}>
            <div class="tl-cell-top">
              <span class="tl-cell-day">${dayNum}</span>
              ${isToday ? '<span class="tl-today-pip"></span>' : ''}
            </div>
            ${
              hasData
                ? `<div class="tl-cell-metrics">
                    ${hasTurns ? `<span class="tl-cell-bill">${esc(fmtMoney(d.costUsd, true))}</span>` : ''}
                    ${hasTurns ? `<span class="tl-cell-tok">${esc(fmtTokens(d.grossTokens))}</span>` : ''}
                    ${hasTraffic ? `<span class="tl-cell-net">${esc(fmtBytes(d.trafficBytes, true))}</span>` : ''}
                  </div>`
                : ''
            }
          </button>`);
      }

      return `
        <div class="tl-weekdays">
          ${t.weekdays.map((w) => `<div class="tl-weekday">${esc(w)}</div>`).join('')}
        </div>
        <div class="tl-cal-grid">${cells.join('')}</div>`;
    }

    function renderYearHeatmap(t, prefs, p90) {
      const todayKey = ui.snapshot.todayKey || localDateKey(Date.now());
      const [ty, tm, td] = todayKey.split('-').map(Number);
      const todayDt = new Date(ty, tm - 1, td, 12, 0, 0);
      const todayDow = (todayDt.getDay() + 6) % 7;
      const totalCells = 52 * 7 + (todayDow + 1);
      const startDt = new Date(ty, tm - 1, td - (totalCells - 1), 12, 0, 0);

      const selectedDayKey = ui.inspectorScope?.type === 'day' ? ui.inspectorScope.key : '';
      const squares = [];
      const monthStarts = [];
      let prevMonth = -1;
      const enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      for (let idx = 0; idx < 53 * 7; idx++) {
        const col = Math.floor(idx / 7);
        const row = idx % 7;
        const dt = new Date(startDt.getFullYear(), startDt.getMonth(), startDt.getDate() + idx, 12, 0, 0);
        const key = localDateKey(dt.getTime());
        const isFuture = dt.getTime() > todayDt.getTime();
        if (row === 0 && dt.getMonth() !== prevMonth && !isFuture) {
          const lbl = prefs.lang === 'zh-CN' ? `${dt.getMonth() + 1}月` : enMonths[dt.getMonth()];
          monthStarts.push({ col, label: lbl });
          prevMonth = dt.getMonth();
        }
        const d = !isFuture ? ui.snapshot.days?.[key] : null;
        const hasTurns = Boolean(d && d.turns > 0);
        const hasTraffic = Boolean(d && d.trafficBytes > 0);
        const hasData = hasTurns || hasTraffic;
        const level = hasTurns ? computeHeatLevel(d.costUsd, p90) : hasTraffic ? 1 : 0;
        const isSelected = selectedDayKey === key;
        const tipParts = [key];
        if (hasTurns) {
          tipParts.push(fmtMoney(d.costUsd, false));
          tipParts.push(fmtTokens(d.grossTokens));
        }
        if (hasTraffic) {
          tipParts.push(fmtBytes(d.trafficBytes, false));
        }
        const tip = tipParts.join(' · ');

        squares.push(
          `<button type="button" class="tl-hm-sq heat-${level} ${isFuture ? 'is-future' : ''} ${isSelected ? 'is-selected' : ''}"
            ${isFuture || !hasData ? 'data-empty="1"' : ''} ${isFuture ? 'disabled' : ''} data-action="select-day" data-date="${esc(key)}" title="${esc(tip)}"></button>`
        );
      }

      if (monthStarts.length >= 2 && monthStarts[0].col === 0 && monthStarts[1].col < 3) {
        monthStarts.shift();
      }
      if (monthStarts.length >= 2 && monthStarts[monthStarts.length - 1].col >= 51) {
        monthStarts.pop();
      }

      const monthCells = monthStarts
        .map((m) => `<span class="tl-heatmap-month-lbl" style="grid-column:${m.col + 1}">${esc(m.label)}</span>`)
        .join('');

      return `
        <div class="tl-heatmap-scroll">
          <div class="tl-heatmap-wrap">
            <div class="tl-heatmap-corner"></div>
            <div class="tl-heatmap-months">${monthCells}</div>
            <div class="tl-heatmap-ydays">
              <span>${esc(t.weekdays[0])}</span><span></span><span>${esc(t.weekdays[2])}</span><span></span><span>${esc(t.weekdays[4])}</span><span></span><span></span>
            </div>
            <div class="tl-heatmap-cols">${squares.join('')}</div>
          </div>
        </div>`;
    }

    function renderDetailDrawer(t) {
      if (!ui.inspectorScope) return '';

      const scope = ui.inspectorScope;
      let periodData = null;
      let periodTitle = '';

      if (scope.type === 'day') {
        periodData = ui.snapshot.days?.[scope.key] || null;
        periodTitle = t.formatDay(scope.key);
      } else if (scope.type === 'month') {
        periodData = ui.snapshot.months?.[scope.key] || null;
        periodTitle = t.formatMonth(scope.key);
      } else {
        periodData = ui.snapshot.totals || null;
        periodTitle = t.allTitle;
      }

      const turns = periodData?.turns || 0;
      const grossTok = periodData?.grossTokens || 0;
      const costUsd = periodData?.costUsd || 0;
      const trafficBytes = periodData?.trafficBytes || 0;
      const trafficUp = periodData?.trafficUpBytes || 0;
      const trafficDown = periodData?.trafficDownBytes || 0;

      const metaParts = [];
      if (turns > 0) {
        metaParts.push(fmtMoney(costUsd, false));
        metaParts.push(fmtTokens(grossTok));
        metaParts.push(`${turns} ${t.turnsUnit}`);
      }
      if (trafficBytes > 0) {
        metaParts.push(fmtBytes(trafficBytes, false));
      }
      const metaStr = metaParts.length > 0 ? metaParts.join(' · ') : t.noDataPeriod;

      let bodyHtml = '';
      if (ui.detailTab === 'traffic') {
        const st = ui.snapshot?.trafficStatus || { state: 'idle', backend: '', pidCount: 0, activeConns: 0 };
        const dotCls = st.state === 'active' ? 'is-active' : st.state === 'admin_required' ? 'is-warn' : '';
        const statusFoot = `
          <div class="tl-traffic-foot">
            <span class="tl-traffic-badge">
              <span class="tl-status-dot ${dotCls}"></span>
              <span>${esc(t.trafficBackendText(st))}</span>
            </span>
            ${
              st.state === 'active'
                ? `<span class="tl-num">${esc(st.backend === 'win-proxy' ? t.proxyConnCount(st.activeConns || 0) : t.trafficMetaCount(st.pidCount || 0, st.activeConns || 0))}</span>`
                : ''
            }
          </div>`;

        if (trafficBytes <= 0) {
          bodyHtml = `<div class="tl-empty-state">${esc(t.trafficEmpty)}</div>${statusFoot}`;
        } else {
          const denom = Math.max(1, trafficBytes);
          const upPct = ((trafficUp / denom) * 100).toFixed(1);
          const downPct = ((trafficDown / denom) * 100).toFixed(1);
          const barSegs = [
            trafficUp > 0 ? `<div class="tl-seg-up" style="width:${Math.max(1.5, (trafficUp / denom) * 100).toFixed(2)}%"></div>` : '',
            trafficDown > 0 ? `<div class="tl-seg-down" style="width:${Math.max(1.5, (trafficDown / denom) * 100).toFixed(2)}%"></div>` : '',
          ].join('');

          bodyHtml = `
            <div class="tl-stacked-bar">${barSegs}</div>
            <div class="tl-type-rows">
              <div class="tl-type-row">
                <span class="tl-type-label slot-terracotta"><span class="tl-dot"></span><span>${esc(t.trafficUp)}</span></span>
                <span class="tl-type-tok">${upPct}%</span>
                <span class="tl-type-cost">${esc(fmtBytes(trafficUp, false))}</span>
              </div>
              <div class="tl-type-row">
                <span class="tl-type-label slot-forest"><span class="tl-dot"></span><span>${esc(t.trafficDown)}</span></span>
                <span class="tl-type-tok">${downPct}%</span>
                <span class="tl-type-cost">${esc(fmtBytes(trafficDown, false))}</span>
              </div>
              <div class="tl-type-row">
                <span class="tl-type-label slot-stone"><span class="tl-dot"></span><span>${esc(t.trafficSum)}</span></span>
                <span class="tl-type-tok">100%</span>
                <span class="tl-type-cost">${esc(fmtBytes(trafficBytes, false))}</span>
              </div>
            </div>
            ${statusFoot}`;
        }
      } else if (!periodData || turns === 0) {
        bodyHtml = `<div class="tl-empty-state">${esc(t.noDataPeriod)}</div>`;
      } else if (ui.detailTab === 'models') {
        const totalCost = Math.max(0.0001, costUsd);
        const models = Object.values(periodData.byModel || {}).sort(
          (a, b) => b.costUsd - a.costUsd || b.grossTokens - a.grossTokens
        );
        bodyHtml = `<div class="tl-rank-list">${models
          .map((m) => {
            const share = ((m.costUsd / totalCost) * 100).toFixed(1);
            const mPrompt = m.uncachedIn + m.cachedIn;
            const mHit = mPrompt > 0 ? ((m.cachedIn / mPrompt) * 100).toFixed(0) : '0';
            return `
              <div class="tl-model-item slot-${esc(m.color)}">
                <div class="tl-model-top">
                  <span class="tl-model-name-cell"><span class="tl-dot"></span>${esc(m.label)}</span>
                  <span class="tl-num" style="font-weight:600">${esc(fmtMoney(m.costUsd, false))} <span style="color:var(--tl-muted);font-weight:400">${share}%</span></span>
                </div>
                <div class="tl-progress-track">
                  <div class="tl-progress-fill" style="width:${Math.max(3, Number(share))}%"></div>
                </div>
                <div class="tl-model-meta">
                  <span>${m.turns} ${esc(t.turnsUnit)} · ${esc(t.hitRate(mHit))}</span>
                  <span class="tl-num">${esc(fmtTokens(m.grossTokens))}</span>
                </div>
              </div>`;
          })
          .join('')}</div>`;
      } else if (ui.detailTab === 'types') {
        const parts = [
          { cls: 'tl-seg-uncached', dot: 'terracotta', label: t.uncachedIn, tok: periodData.uncachedIn || 0, cost: periodData.costIn || 0 },
          { cls: 'tl-seg-cached', dot: 'forest', label: t.cachedIn, tok: periodData.cachedIn || 0, cost: periodData.costCache || 0 },
          { cls: 'tl-seg-thinking', dot: 'ochre', label: t.thinkingOut, tok: periodData.thinkingOut || 0, cost: periodData.costThink || 0 },
          { cls: 'tl-seg-response', dot: 'olive', label: t.responseOut, tok: periodData.responseOut || 0, cost: periodData.costResp || 0 },
        ];
        const denom = Math.max(1, grossTok);
        const barSegs = parts
          .filter((p) => p.tok > 0)
          .map((p) => `<div class="${p.cls}" style="width:${Math.max(1.5, (p.tok / denom) * 100).toFixed(2)}%"></div>`)
          .join('');
        const rows = parts
          .map((p) => {
            const share = ((p.tok / denom) * 100).toFixed(1);
            return `
              <div class="tl-type-row">
                <span class="tl-type-label slot-${p.dot}">
                  <span class="tl-dot"></span>
                  <span>${esc(p.label)}</span>
                </span>
                <span class="tl-type-tok">${esc(fmtTokens(p.tok))} <span style="opacity:0.6">${share}%</span></span>
                <span class="tl-type-cost">${esc(fmtMoney(p.cost, false))}</span>
              </div>`;
          })
          .join('');
        bodyHtml = `<div class="tl-stacked-bar">${barSegs}</div><div class="tl-type-rows">${rows}</div>`;
      } else if (ui.detailTab === 'chats') {
        const convs = periodData.topConvs || [];
        bodyHtml =
          convs.length > 0
            ? `<div class="tl-rank-list">${convs
                .map((c) => {
                  const title = c.title || t.untitledConv(c.convId);
                  const canOpen = !c.isArchived && typeof adapter.onOpenConversation === 'function';
                  const tag = canOpen ? 'button' : 'div';
                  const attrs = canOpen ? `type="button" data-action="open-conv" data-conv="${esc(c.convId)}"` : '';
                  return `
                    <${tag} class="tl-conv-row" ${attrs}>
                      <div class="tl-conv-left">
                        <div class="tl-conv-title">${esc(title)}</div>
                        <div class="tl-conv-tags">
                          ${c.workspace ? `<span class="tl-tag">${esc(c.workspace)}</span>` : ''}
                          ${c.isSubagent ? `<span class="tl-tag is-subagent">${esc(t.subagentTag)}</span>` : ''}
                          ${c.product === 'antigravity-cli' ? `<span class="tl-tag">${esc(t.cliTag)}</span>` : ''}
                          ${c.isArchived ? `<span class="tl-tag is-archived">${esc(t.archivedTag)}</span>` : ''}
                          <span>${c.turns} ${esc(t.turnsUnit)}</span>
                        </div>
                      </div>
                      <div class="tl-conv-right">
                        <span class="tl-conv-bill">${esc(fmtMoney(c.costUsd, false))}</span>
                        <span class="tl-conv-tok">${esc(fmtTokens(c.grossTokens))}</span>
                      </div>
                    </${tag}>`;
                })
                .join('')}</div>`
            : `<div class="tl-empty-state">${esc(t.noDataPeriod)}</div>`;
      } else {
        const hourlyTok = periodData.hourlyTokens || new Array(24).fill(0);
        const hourlyCost = periodData.hourlyCost || new Array(24).fill(0);
        const hourlyNet = periodData.hourlyTraffic || new Array(24).fill(0);
        const maxHourCost = Math.max(0.0001, ...hourlyCost);
        const peakHour = hourlyCost.reduce((best, val, idx, arr) => (val > arr[best] ? idx : best), 0);
        const inspectHour = ui.activeHour !== null ? ui.activeHour : peakHour;
        const hCost = hourlyCost[inspectHour] || 0;
        const hTok = hourlyTok[inspectHour] || 0;
        const hNet = hourlyNet[inspectHour] || 0;
        const badgeText =
          `${String(inspectHour).padStart(2, '0')}:00 · ${fmtMoney(hCost, false)} · ${fmtTokens(hTok)}` +
          (hNet > 0 ? ` · ${fmtBytes(hNet, false)}` : '');

        const barsHtml = hourlyCost
          .map((c, h) => {
            const pctH = c > 0 ? Math.max(8, Math.round((c / maxHourCost) * 100)) : 4;
            const isZero = c <= 0;
            const isPeak = !isZero && h === peakHour;
            const isActive = inspectHour === h;
            const label = h % 6 === 0 || h === 23 ? String(h).padStart(2, '0') : '';
            return `
              <div class="tl-hour-col ${isActive ? 'is-active' : ''}" data-action="hover-hour" data-hour="${h}">
                <div class="tl-hour-bar ${isZero ? 'is-zero' : ''} ${isPeak ? 'is-peak' : ''}" style="height:${pctH}%"></div>
                <span class="tl-hour-lbl">${label}</span>
              </div>`;
          })
          .join('');

        bodyHtml = `
          <div class="tl-hours-wrap">
            <div class="tl-hours-top">
              <span class="tl-hour-badge" data-el="hour-badge">${esc(badgeText)}</span>
            </div>
            <div class="tl-hours-chart">${barsHtml}</div>
          </div>`;
      }

      return `
        <section class="tl-drawer">
          <div class="tl-drawer-head">
            <div class="tl-drawer-title-group">
              <span class="tl-drawer-title">${esc(periodTitle)}</span>
              <span class="tl-drawer-meta">${esc(metaStr)}</span>
            </div>
            <div class="tl-drawer-controls">
              <div class="tl-segmented" role="tablist">
                <button type="button" class="tl-seg-btn ${ui.detailTab === 'models' ? 'is-active' : ''}" data-action="detail-tab" data-val="models">${esc(t.tabModels)}</button>
                <button type="button" class="tl-seg-btn ${ui.detailTab === 'types' ? 'is-active' : ''}" data-action="detail-tab" data-val="types">${esc(t.tabTypes)}</button>
                <button type="button" class="tl-seg-btn ${ui.detailTab === 'traffic' ? 'is-active' : ''}" data-action="detail-tab" data-val="traffic">${esc(t.tabTraffic)}</button>
                <button type="button" class="tl-seg-btn ${ui.detailTab === 'chats' ? 'is-active' : ''}" data-action="detail-tab" data-val="chats">${esc(t.tabChats)}</button>
                <button type="button" class="tl-seg-btn ${ui.detailTab === 'hours' ? 'is-active' : ''}" data-action="detail-tab" data-val="hours">${esc(t.tabHours)}</button>
              </div>
            </div>
          </div>
          ${bodyHtml}
        </section>`;
    }

    function render() {
      applyResolvedTheme();
      const prefs = getPrefs();
      const t = COPY[prefs.lang] || COPY['zh-CN'];

      if (ui.loading && !ui.snapshot) {
        root.innerHTML = `<div class="tl-shell"><div class="tl-empty-state">${esc(t.loading)}</div></div>`;
        return;
      }

      if (ui.error && !ui.snapshot) {
        root.innerHTML = `
          <div class="tl-shell">
            <div class="tl-empty-state">
              <p>${esc(t.loadError)}</p>
              <button type="button" class="tl-pill-btn" data-action="refresh">${esc(t.retry)}</button>
            </div>
          </div>`;
        return;
      }

      ensureInitialPeriod();
      const snap = ui.snapshot;
      const totals = snap.totals || {};
      const today = snap.today || {};
      const trafficSt = snap.trafficStatus || { state: 'idle', backend: '' };
      const trafficActive = trafficSt.state === 'active';
      const proxyTraffic = trafficSt.backend === 'win-proxy';
      const p90 = getP90Cost();

      const viewMonthData = snap.months?.[ui.viewMonth] || {
        costUsd: 0,
        grossTokens: 0,
        activeDays: 0,
        turns: 0,
        trafficBytes: 0,
      };
      const monthAvgCost = viewMonthData.activeDays > 0 ? viewMonthData.costUsd / viewMonthData.activeDays : 0;

      const allPrompt = (totals.uncachedIn || 0) + (totals.cachedIn || 0);
      const allHitPct = allPrompt > 0 ? ((totals.cachedIn / allPrompt) * 100).toFixed(1) : '0.0';
      const todayKey = snap.todayKey || localDateKey(Date.now());
      const todayMonth = todayKey.slice(0, 7);

      const themeLabel =
        prefs.theme === 'light' ? t.themeLight : prefs.theme === 'dark' ? t.themeDark : t.themeAuto;

      const trafficStateText =
        trafficSt.state === 'active'
          ? t.trafficActive
          : trafficSt.state === 'starting'
            ? t.trafficStarting
            : trafficSt.state === 'admin_required'
              ? t.trafficAdmin
              : proxyTraffic
                ? (trafficSt.error === 'Proxy did not provide process names' ? t.proxyNoProcess : t.proxyPaused)
                : t.trafficOff;
      const trafficDotCls =
        trafficSt.state === 'active' ? 'is-active' : trafficSt.state === 'admin_required' ? 'is-warn' : '';

      const isTodaySelected = ui.inspectorScope?.type === 'day' && ui.inspectorScope.key === todayKey;
      const isMonthSelected = ui.inspectorScope?.type === 'month' && ui.inspectorScope.key === ui.viewMonth;
      const isAllSelected = ui.inspectorScope?.type === 'all';

      const peakStr = totals.peakDay ? fmtMoney(totals.peakDay.costUsd, false) : '—';

      const popoverHtml = ui.menuOpen
        ? `<div class="tl-popover">
            <div class="tl-pop-row">
              <span>${esc(t.themeLabel)}</span>
              <button type="button" class="tl-pill-btn" data-action="cycle-theme">${esc(themeLabel)}</button>
            </div>
            <div class="tl-pop-row">
              <span>${esc(t.langLabel)}</span>
              <button type="button" class="tl-pill-btn" data-action="toggle-lang">${esc(t.langVal)}</button>
            </div>
            <div class="tl-pop-row">
              <span>${esc(t.pillLabel)}</span>
              <button type="button" class="tl-pill-btn" data-action="toggle-widget">${esc(prefs.widgetVisible !== false ? t.pillOn : t.pillOff)}</button>
            </div>
            <div class="tl-pop-row">
              <span>${esc(proxyTraffic ? t.proxyTrafficLabel : t.trafficLabel)}</span>
              <span class="tl-pop-status"><span class="tl-status-dot ${trafficDotCls}"></span>${esc(trafficStateText)}</span>
            </div>
            ${proxyTraffic ? `<form class="tl-pop-row tl-proxy-port">
              <label>${esc(t.proxyPortLabel)}
                <input name="port" type="number" min="1" max="65535" step="1" inputmode="numeric"
                  value="${esc(prefs.proxyControllerPort ?? '')}" placeholder="${esc(t.proxyPortAuto)}">
              </label>
              <button type="submit" class="tl-pill-btn">${esc(t.proxyPortSave)}</button>
            </form>` : ''}
            <div class="tl-pop-divider"></div>
            <div class="tl-pop-actions">
              <button type="button" class="tl-pill-btn" data-action="toggle-rates">${esc(t.rateCard)}</button>
              <button type="button" class="tl-pill-btn" data-action="refresh">${esc(t.refresh)}</button>
            </div>
          </div>`
        : '';

      const cardLeftHtml =
        ui.calTab === 'month'
          ? `<div class="tl-cal-nav">
              <button type="button" class="tl-icon-btn" data-action="prev-month" aria-label="Previous Month">${ICONS.prev}</button>
              <span class="tl-month-title">${esc(t.formatMonth(ui.viewMonth))}</span>
              <button type="button" class="tl-icon-btn" data-action="next-month" aria-label="Next Month">${ICONS.next}</button>
              ${
                ui.viewMonth !== todayMonth
                  ? `<button type="button" class="tl-pill-btn" data-action="jump-today">${esc(t.todayJump)}</button>`
                  : ''
              }
            </div>`
          : `<div class="tl-streak-strip">
              <span class="tl-streak-item">${esc(t.yearActive(totals.activeDays || 0))}</span>
              <span class="tl-streak-item">${esc(t.yearStreak(totals.longestStreak || 0))}</span>
              <span class="tl-streak-item">${esc(t.yearPeak(peakStr))}</span>
            </div>`;

      const showTodayTraffic = (today.trafficBytes || 0) > 0 || trafficActive;
      const showMonthTraffic = (viewMonthData.trafficBytes || 0) > 0;
      const showTotalTraffic = (totals.trafficBytes || 0) > 0 || trafficActive;

      root.innerHTML = `
        <div class="tl-shell">
          <header class="tl-masthead">
            <h1 class="tl-brand-title">${esc(t.title)}</h1>
            <div class="tl-header-actions">
              <div class="tl-pop-wrap">
                <button type="button" class="tl-icon-btn ${ui.menuOpen ? 'is-active' : ''}" data-action="toggle-menu" aria-label="Settings">${ICONS.gear}</button>
                ${popoverHtml}
              </div>
              ${
                typeof adapter.onCloseModal === 'function'
                  ? `<button type="button" class="tl-icon-btn" data-action="close-modal" aria-label="Close">${ICONS.close}</button>`
                  : ''
              }
            </div>
          </header>

          ${renderRateCard(t)}

          <section class="tl-kpi-grid">
            <button type="button" class="tl-kpi-card ${isTodaySelected ? 'is-selected' : ''}" data-action="select-scope" data-scope="today">
              <div class="tl-kpi-label">
                <span>${esc(t.kpiToday)}</span>
                <span class="tl-kpi-tag">${today.turns || 0} ${esc(t.turnsUnit)}</span>
              </div>
              <div class="tl-kpi-value">${esc(fmtMoney(today.costUsd, false))}</div>
              <div class="tl-kpi-sub tl-num">
                <span>${esc(fmtTokens(today.grossTokens))} Tokens</span>
                ${
                  showTodayTraffic
                    ? `<span>·</span><span>${esc(t.trafficShort(fmtBytes(today.trafficBytes || 0, false)))}</span>`
                    : ''
                }
              </div>
            </button>

            <button type="button" class="tl-kpi-card ${isMonthSelected ? 'is-selected' : ''}" data-action="select-scope" data-scope="month">
              <div class="tl-kpi-label">
                <span>${esc(t.kpiMonth)}</span>
                <span class="tl-kpi-tag">${viewMonthData.activeDays || 0} ${esc(t.daysShort)}</span>
              </div>
              <div class="tl-kpi-value">${esc(fmtMoney(viewMonthData.costUsd, false))}</div>
              <div class="tl-kpi-sub tl-num">
                <span>${esc(fmtTokens(viewMonthData.grossTokens))}</span>
                <span>·</span>
                <span>${esc(t.dailyAvg(fmtMoney(monthAvgCost, true)))}</span>
                ${
                  showMonthTraffic
                    ? `<span>·</span><span>${esc(fmtBytes(viewMonthData.trafficBytes || 0, false))}</span>`
                    : ''
                }
              </div>
            </button>

            <button type="button" class="tl-kpi-card ${isAllSelected ? 'is-selected' : ''}" data-action="select-scope" data-scope="all">
              <div class="tl-kpi-label">
                <span>${esc(t.kpiAllTime)}</span>
                <span class="tl-kpi-tag">${totals.activeDays || 0} ${esc(t.daysShort)}</span>
              </div>
              <div class="tl-kpi-value">${esc(fmtMoney(totals.costUsd, false))}</div>
              <div class="tl-kpi-sub tl-num">
                <span>${esc(fmtTokens(totals.grossTokens))}</span>
                <span>·</span>
                <span>${esc(t.convsSummary(totals.conversations || 0))}</span>
                ${
                  showTotalTraffic
                    ? `<span>·</span><span>${esc(t.trafficTotalShort(fmtBytes(totals.trafficBytes || 0, false)))}</span>`
                    : ''
                }
              </div>
            </button>

            <button type="button" class="tl-kpi-card is-savings ${isAllSelected ? 'is-selected' : ''}" data-action="select-scope" data-scope="all">
              <div class="tl-kpi-label">
                <span>${esc(t.kpiSavings)}</span>
                <span class="tl-kpi-tag is-good">${esc(t.hitRate(allHitPct))}</span>
              </div>
              <div class="tl-kpi-value">${esc(fmtMoney(totals.savedUsd, false))}</div>
              <div class="tl-kpi-sub tl-num">
                <span>${esc(fmtTokens(totals.cachedIn || 0))} ${esc(t.cachedSub)}</span>
              </div>
            </button>
          </section>

          <section class="tl-card">
            <div class="tl-card-head">
              ${cardLeftHtml}
              <div class="tl-segmented" role="tablist">
                <button type="button" class="tl-seg-btn ${ui.calTab === 'month' ? 'is-active' : ''}" data-action="cal-tab" data-val="month">${esc(t.tabMonth)}</button>
                <button type="button" class="tl-seg-btn ${ui.calTab === 'year' ? 'is-active' : ''}" data-action="cal-tab" data-val="year">${esc(t.tabYear)}</button>
              </div>
            </div>

            ${ui.calTab === 'month' ? renderMonthCalendar(t, p90) : renderYearHeatmap(t, prefs, p90)}
          </section>

          ${renderDetailDrawer(t)}
        </div>`;
    }

    root.addEventListener('submit', (e) => {
      if (!e.target.matches('.tl-proxy-port')) return;
      e.preventDefault();
      const value = e.target.elements.port.value;
      patchPrefs({ proxyControllerPort: value === '' ? null : Number(value) });
    });

    root.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('[data-action]');
      if (!btn) {
        if (ui.menuOpen && !e.target?.closest?.('.tl-pop-wrap')) {
          ui.menuOpen = false;
          render();
        }
        return;
      }

      const action = btn.getAttribute('data-action');
      const prefs = getPrefs();

      if (action !== 'toggle-menu' && ui.menuOpen && !e.target?.closest?.('.tl-popover')) {
        ui.menuOpen = false;
      }

      if (action === 'toggle-menu') {
        ui.menuOpen = !ui.menuOpen;
        render();
      } else if (action === 'close-modal') {
        if (typeof adapter.onCloseModal === 'function') adapter.onCloseModal();
      } else if (action === 'toggle-rates') {
        ui.showRateCard = !ui.showRateCard;
        ui.menuOpen = false;
        render();
      } else if (action === 'close-rates') {
        ui.showRateCard = false;
        render();
      } else if (action === 'toggle-widget') {
        patchPrefs({ widgetVisible: prefs.widgetVisible === false });
      } else if (action === 'cycle-theme') {
        const order = ['auto', 'light', 'dark'];
        const next = order[(order.indexOf(prefs.theme) + 1) % order.length];
        patchPrefs({ theme: next });
      } else if (action === 'toggle-lang') {
        patchPrefs({ lang: prefs.lang === 'zh-CN' ? 'en' : 'zh-CN' });
      } else if (action === 'refresh') {
        ui.menuOpen = false;
        reload(true);
      } else if (action === 'cal-tab') {
        ui.calTab = btn.getAttribute('data-val') === 'year' ? 'year' : 'month';
        render();
        if (ui.calTab === 'year') {
          const scroller = root.querySelector('.tl-heatmap-scroll');
          if (scroller) scroller.scrollLeft = scroller.scrollWidth;
        }
      } else if (action === 'prev-month') {
        ui.viewMonth = shiftMonth(ui.viewMonth, -1);
        if (ui.inspectorScope?.type === 'month') {
          ui.inspectorScope = { type: 'month', key: ui.viewMonth };
        }
        ui.activeHour = null;
        render();
      } else if (action === 'next-month') {
        ui.viewMonth = shiftMonth(ui.viewMonth, 1);
        if (ui.inspectorScope?.type === 'month') {
          ui.inspectorScope = { type: 'month', key: ui.viewMonth };
        }
        ui.activeHour = null;
        render();
      } else if (action === 'jump-today') {
        const todayKey = ui.snapshot?.todayKey || localDateKey(Date.now());
        ui.viewMonth = todayKey.slice(0, 7);
        ui.activeHour = null;
        render();
      } else if (action === 'select-day') {
        if (btn.getAttribute('data-empty') === '1') return;
        const dateKey = btn.getAttribute('data-date');
        if (!dateKey) return;
        if (ui.inspectorScope?.type === 'day' && ui.inspectorScope.key === dateKey) {
          ui.inspectorScope = null;
        } else {
          ui.inspectorScope = { type: 'day', key: dateKey };
          ui.viewMonth = dateKey.slice(0, 7);
        }
        ui.activeHour = null;
        render();
      } else if (action === 'select-scope') {
        const scopeKind = btn.getAttribute('data-scope');
        const todayKey = ui.snapshot?.todayKey || localDateKey(Date.now());
        let nextScope = null;
        if (scopeKind === 'today') {
          nextScope = { type: 'day', key: todayKey };
          ui.viewMonth = todayKey.slice(0, 7);
        } else if (scopeKind === 'month') {
          nextScope = { type: 'month', key: ui.viewMonth };
        } else {
          nextScope = { type: 'all', key: 'all' };
        }
        const isSame =
          ui.inspectorScope &&
          ui.inspectorScope.type === nextScope.type &&
          ui.inspectorScope.key === nextScope.key;
        ui.inspectorScope = isSame ? null : nextScope;
        ui.activeHour = null;
        render();
      } else if (action === 'detail-tab') {
        const val = btn.getAttribute('data-val');
        if (['models', 'types', 'traffic', 'chats', 'hours'].includes(val)) {
          ui.detailTab = val;
          render();
        }
      } else if (action === 'hover-hour') {
        const h = Number(btn.getAttribute('data-hour'));
        if (Number.isFinite(h)) {
          ui.activeHour = h;
          render();
        }
      } else if (action === 'open-conv') {
        const convId = btn.getAttribute('data-conv');
        if (convId && typeof adapter.onOpenConversation === 'function') {
          adapter.onOpenConversation(convId);
        }
      }
    });

    root.addEventListener('mouseover', (e) => {
      const col = e.target?.closest?.('[data-action="hover-hour"]');
      if (!col) return;
      const h = Number(col.getAttribute('data-hour'));
      if (!Number.isFinite(h) || h === ui.activeHour) return;
      ui.activeHour = h;
      const badgeEl = root.querySelector('[data-el="hour-badge"]');
      if (badgeEl && ui.snapshot && ui.inspectorScope) {
        const scope = ui.inspectorScope;
        const periodData =
          scope.type === 'day'
            ? ui.snapshot.days?.[scope.key]
            : scope.type === 'month'
              ? ui.snapshot.months?.[scope.key]
              : ui.snapshot.totals;
        if (periodData) {
          const hourlyTok = periodData.hourlyTokens || [];
          const hourlyCost = periodData.hourlyCost || [];
          const hourlyNet = periodData.hourlyTraffic || [];
          const hNet = hourlyNet[h] || 0;
          badgeEl.textContent =
            `${String(h).padStart(2, '0')}:00 · ${fmtMoney(hourlyCost[h] || 0, false)} · ${fmtTokens(hourlyTok[h] || 0)}` +
            (hNet > 0 ? ` · ${fmtBytes(hNet, false)}` : '');
        }
      }
    });

    const onMessage = (event) => {
      if (event.data?.type === 'theme-change') {
        setTimeout(applyResolvedTheme, 20);
      }
    };
    window.addEventListener('message', onMessage);

    const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const onMediaChange = () => applyResolvedTheme();
    mediaQuery?.addEventListener?.('change', onMediaChange);

    if (ui.snapshot) {
      ensureInitialPeriod();
      render();
    } else {
      reload(false);
    }

    return {
      updateSnapshot(nextSnap) {
        if (!nextSnap) return;
        const prevRev = ui.snapshot?.rev;
        ui.snapshot = nextSnap;
        ui.loading = false;
        ui.error = '';
        if (nextSnap.rev !== prevRev && !root.querySelector('.tl-proxy-port :focus')) {
          ensureInitialPeriod();
          render();
        }
      },
      refreshTheme() {
        applyResolvedTheme();
      },
      dispose() {
        window.removeEventListener('message', onMessage);
        mediaQuery?.removeEventListener?.('change', onMediaChange);
        containerEl.innerHTML = '';
      },
    };
  }

  globalScope.mountTokenLedgerApp = mountTokenLedgerApp;
})(typeof globalThis !== 'undefined' ? globalThis : window);
