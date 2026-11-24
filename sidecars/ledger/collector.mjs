/**
 * Stat-gated SQLite telemetry scanner, persistent turn archive, and calendar
 * aggregator for agy-ledger.
 *
 * Reads local Antigravity conversation SQLite stores (`gen_metadata`, `steps`,
 * and `conversation_summaries.db`) in strictly read-only mode across desktop,
 * IDE, and CLI directories.
 */
import { DatabaseSync } from 'node:sqlite';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateTurnBilling, getRateCard, resolveModelSpec } from './pricing.mjs';
import { createTrafficMonitor } from './traffic.mjs';

const UUID_RE = /^[0-9a-f-]{36}$/i;
const PRODUCT_DIRS = ['antigravity', 'antigravity-ide', 'antigravity-cli'];
const LS_CONFIG_TTL_MS = 60_000;
const SCAN_TTL_MS = 4_000;
const ARCHIVE_FLUSH_MS = 15_000;

export const DEFAULT_PREFS = {
  lang: 'zh-CN',
  theme: 'auto',
  widgetVisible: true,
  widgetPos: null,
  proxyControllerPort: null,
};

// ---------------------------------------------------------------------------
// Binary protobuf wire decoder (read-only, zero dependencies)
// ---------------------------------------------------------------------------

export function readVarint(buf, offset) {
  let val = 0n;
  let shift = 0n;
  let i = offset;
  while (i < buf.length) {
    const b = buf[i++];
    val |= BigInt(b & 0x7f) << shift;
    if ((b & 0x80) === 0) {
      return [Number(val), i];
    }
    shift += 7n;
    if (shift > 63n) break;
  }
  return [Number(val), i];
}

export function parsePbMap(input) {
  const fields = new Map();
  if (!input || typeof input === 'number') return fields;
  const buf = Buffer.isBuffer(input)
    ? input
    : input instanceof Uint8Array
      ? Buffer.from(input.buffer, input.byteOffset, input.byteLength)
      : null;
  if (!buf || buf.length === 0) return fields;

  let i = 0;
  while (i < buf.length) {
    try {
      const [tag, nextI] = readVarint(buf, i);
      i = nextI;
      const fn = tag >>> 3;
      const wt = tag & 7;
      if (fn === 0) break;
      if (!fields.has(fn)) fields.set(fn, []);
      if (wt === 0) {
        const [val, nI] = readVarint(buf, i);
        i = nI;
        fields.get(fn).push(val);
      } else if (wt === 2) {
        const [len, nI] = readVarint(buf, i);
        i = nI;
        if (len < 0 || i + len > buf.length) break;
        fields.get(fn).push(buf.subarray(i, i + len));
        i += len;
      } else if (wt === 5) {
        if (i + 4 > buf.length) break;
        fields.get(fn).push(buf.subarray(i, i + 4));
        i += 4;
      } else if (wt === 1) {
        if (i + 8 > buf.length) break;
        fields.get(fn).push(buf.subarray(i, i + 8));
        i += 8;
      } else {
        break;
      }
    } catch {
      break;
    }
  }
  return fields;
}

function numField(map, key) {
  if (!map || !map.has(key)) return 0;
  const v = map.get(key)[0];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function strField(map, key) {
  if (!map || !map.has(key)) return '';
  const v = map.get(key)[0];
  return Buffer.isBuffer(v) ? v.toString('utf8') : '';
}

export function parseStepTimestampMs(metadata) {
  if (!metadata) return 0;
  const sm = parsePbMap(metadata);
  if (!sm.has(1)) return 0;
  const tsMap = parsePbMap(sm.get(1)[0]);
  const sec = numField(tsMap, 1);
  const nanos = numField(tsMap, 2);
  if (!Number.isFinite(sec) || sec <= 0) return 0;
  const ms = sec * 1000 + (Number.isFinite(nanos) ? Math.floor(nanos / 1e6) : 0);
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

export function parseGenMetadataRow(idx, data) {
  if (!data) return null;
  const top = parsePbMap(data);
  if (!top.has(1)) return null;
  const m1 = parsePbMap(top.get(1)[0]);
  const usage = parsePbMap(m1.get(4)?.[0]);

  const usageEnumId = numField(usage, 1);
  const uncachedIn = numField(usage, 2);
  const totalOutField3 = numField(usage, 3);
  const cachedIn = numField(usage, 5);
  const thinkingOut = numField(usage, 9);
  const responseOutField10 = numField(usage, 10);

  const totalOut = Math.max(totalOutField3, thinkingOut + responseOutField10);
  const responseOut = Math.max(0, totalOut - thinkingOut);

  if (uncachedIn + cachedIn + totalOut <= 0) return null;

  const modelEnumId = numField(m1, 3) || usageEnumId || 0;
  const modelStr = strField(m1, 19);

  let lastStepIndex = -1;
  if (m1.has(20)) {
    for (const kvBuf of m1.get(20)) {
      const kv = parsePbMap(kvBuf);
      const key = strField(kv, 1);
      if (key === 'last_step_index') {
        const n = Number(strField(kv, 2));
        if (Number.isFinite(n)) lastStepIndex = n;
        break;
      }
    }
  }

  return {
    idx: Number(idx),
    modelStr,
    enumId: modelEnumId,
    uncachedIn,
    cachedIn,
    thinkingOut,
    responseOut,
    lastStepIndex,
  };
}

// ---------------------------------------------------------------------------
// Path, date, & filesystem helpers
// ---------------------------------------------------------------------------

export function resolveDefaultStateDir() {
  if (process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR) {
    return process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR;
  }
  const home = homedir();
  const base =
    process.platform === 'win32'
      ? process.env.LOCALAPPDATA || join(home, 'AppData', 'Local')
      : process.platform === 'darwin'
        ? join(home, 'Library', 'Application Support')
        : process.env.XDG_STATE_HOME || join(home, '.local', 'state');
  return join(base, 'agy-ledger');
}

export function resolveDefaultAppDataRoots() {
  const geminiRoot = join(homedir(), '.gemini');
  const roots = [];
  for (const product of PRODUCT_DIRS) {
    const dir = join(geminiRoot, product);
    if (existsSync(join(dir, 'conversations'))) {
      roots.push({ product, dir });
    }
  }
  return roots;
}

function safeStat(filePath) {
  try {
    const s = statSync(filePath);
    return { exists: true, mtimeMs: s.mtimeMs, size: s.size };
  } catch {
    return { exists: false, mtimeMs: 0, size: -1 };
  }
}

function atomicWriteJson(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  const payload = JSON.stringify(data);
  const tmp = `${filePath}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, payload, 'utf8');
    renameSync(tmp, filePath);
  } catch {
    try {
      rmSync(tmp, { force: true });
    } catch {}
    writeFileSync(filePath, payload, 'utf8');
  }
}

export function toLocalDateKey(tsMs) {
  const d = new Date(tsMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addLocalDays(dateKey, deltaDays) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays, 12, 0, 0, 0);
  return toLocalDateKey(dt.getTime());
}

function extractWorkspaceName(rawUris) {
  if (!rawUris || typeof rawUris !== 'string') return '';
  let candidate = '';
  const trimmed = rawUris.trim();
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr) && arr.length > 0) candidate = String(arr[0] || '');
    } catch {}
  }
  if (!candidate) {
    candidate = trimmed.split(',')[0].trim();
  }
  if (!candidate) return '';
  try {
    candidate = decodeURIComponent(candidate);
  } catch {}
  candidate = candidate.replace(/^file:\/+/i, '').replace(/[\\/]+$/, '');
  const parts = candidate.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : '';
}

export function sanitizePrefs(raw, base = DEFAULT_PREFS) {
  const out = { ...base };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  if (raw.lang === 'zh-CN' || raw.lang === 'en') out.lang = raw.lang;
  if (raw.theme === 'auto' || raw.theme === 'light' || raw.theme === 'dark') out.theme = raw.theme;
  if (typeof raw.widgetVisible === 'boolean') out.widgetVisible = raw.widgetVisible;
  if (raw.proxyControllerPort === null ||
      (Number.isInteger(raw.proxyControllerPort) && raw.proxyControllerPort >= 1 && raw.proxyControllerPort <= 65535)) {
    out.proxyControllerPort = raw.proxyControllerPort;
  }
  if (raw.widgetPos === null) {
    out.widgetPos = null;
  } else if (
    raw.widgetPos &&
    typeof raw.widgetPos === 'object' &&
    Number.isFinite(raw.widgetPos.x) &&
    Number.isFinite(raw.widgetPos.y)
  ) {
    out.widgetPos = { x: Math.round(raw.widgetPos.x), y: Math.round(raw.widgetPos.y) };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Collector service
// ---------------------------------------------------------------------------

function createEmptyAgg() {
  return {
    grossTokens: 0,
    uncachedIn: 0,
    cachedIn: 0,
    thinkingOut: 0,
    responseOut: 0,
    costUsd: 0,
    savedUsd: 0,
    costIn: 0,
    costCache: 0,
    costThink: 0,
    costResp: 0,
    turns: 0,
    trafficUpBytes: 0,
    trafficDownBytes: 0,
    trafficBytes: 0,
  };
}

function addAgg(target, delta) {
  target.grossTokens += delta.grossTokens;
  target.uncachedIn += delta.uncachedIn;
  target.cachedIn += delta.cachedIn;
  target.thinkingOut += delta.thinkingOut;
  target.responseOut += delta.responseOut;
  target.costUsd += delta.costUsd;
  target.savedUsd += delta.savedUsd;
  target.costIn += delta.costIn || 0;
  target.costCache += delta.costCache || 0;
  target.costThink += delta.costThink || 0;
  target.costResp += delta.costResp || 0;
  target.turns += delta.turns || 1;
}

function decodeCompactTurn(raw) {
  if (Array.isArray(raw)) {
    return {
      idx: Number(raw[0] || 0),
      ts: Number(raw[1] || 0),
      modelStr: String(raw[2] || ''),
      enumId: Number(raw[3] || 0),
      uncachedIn: Number(raw[4] || 0),
      cachedIn: Number(raw[5] || 0),
      thinkingOut: Number(raw[6] || 0),
      responseOut: Number(raw[7] || 0),
    };
  }
  return {
    idx: Number(raw.idx || 0),
    ts: Number(raw.ts || 0),
    modelStr: String(raw.modelStr || ''),
    enumId: Number(raw.enumId || 0),
    uncachedIn: Number(raw.uncachedIn || 0),
    cachedIn: Number(raw.cachedIn || 0),
    thinkingOut: Number(raw.thinkingOut || 0),
    responseOut: Number(raw.responseOut || 0),
  };
}

function encodeCompactTurn(t) {
  return [
    t.idx,
    t.ts,
    t.modelStr || '',
    t.enumId || 0,
    t.uncachedIn,
    t.cachedIn,
    t.thinkingOut,
    t.responseOut,
  ];
}

export function createLedgerCollector(options = {}) {
  const stateDir = options.stateDir || resolveDefaultStateDir();
  const appDataRoots =
    Array.isArray(options.appDataRoots) && options.appDataRoots.length > 0
      ? options.appDataRoots
      : resolveDefaultAppDataRoots();
  const nowFn = options.nowFn || (() => Date.now());
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const disableArchiveWrite = Boolean(options.disableArchiveWrite);

  const prefsPath = join(stateDir, 'ui-prefs.json');
  const archivePath = join(stateDir, 'ledger-archive.json');

  let prefsCache = null;
  let prefsMtime = null;
  let archiveLoaded = false;
  let archiveMap = new Map(); // convId -> { convId, product, title, workspace, isSubagent, statKey, isArchived, turns }
  let archiveDirty = false;
  let lastArchiveWriteAt = 0;

  const summaryDbCache = new Map(); // dbPath -> { statKey, rowsById: Map }
  let lsConfigsCache = { configs: [], fetchedAt: 0 };
  let lastSnapshot = null;
  let lastScanAt = 0;
  let revCounter = 1;
  let lastDataSig = '';

  const trafficMonitor = createTrafficMonitor({
    stateDir,
    nowFn,
    disableArchiveWrite,
    getProxyControllerPort: () => readPrefs().proxyControllerPort,
    onDelta: () => {
      revCounter++;
      lastScanAt = 0;
    },
  });
  if (options.enableTrafficMonitor === true) {
    trafficMonitor.start();
  }

  function readPrefs() {
    try {
      const modifiedAt = statSync(prefsPath, { throwIfNoEntry: false })?.mtimeMs ?? null;
      if (prefsCache && prefsMtime === modifiedAt) return prefsCache;
      if (modifiedAt !== null) {
        prefsCache = sanitizePrefs(JSON.parse(readFileSync(prefsPath, 'utf8')), DEFAULT_PREFS);
      } else {
        prefsCache = { ...DEFAULT_PREFS };
      }
      prefsMtime = modifiedAt;
    } catch {}
    return prefsCache || { ...DEFAULT_PREFS };
  }

  function updatePrefs(patch) {
    const prev = readPrefs();
    const next = sanitizePrefs(patch, prev);
    const changed = JSON.stringify(prev) !== JSON.stringify(next);
    prefsCache = next;
    if (changed) {
      revCounter++;
      try {
        atomicWriteJson(prefsPath, next);
        prefsMtime = statSync(prefsPath).mtimeMs;
      } catch {}
      if (lastSnapshot) {
        lastSnapshot = { ...lastSnapshot, prefs: next, rev: String(revCounter) };
      }
    }
    return next;
  }

  function loadArchiveIfNeeded() {
    if (archiveLoaded) return;
    archiveLoaded = true;
    try {
      if (!existsSync(archivePath)) return;
      const raw = JSON.parse(readFileSync(archivePath, 'utf8'));
      const convs = raw?.conversations;
      if (convs && typeof convs === 'object') {
        for (const [convId, entry] of Object.entries(convs)) {
          if (!entry || !Array.isArray(entry.turns)) continue;
          archiveMap.set(convId, {
            convId,
            product: entry.product || 'antigravity',
            title: entry.title || '',
            workspace: entry.workspace || '',
            isSubagent: Boolean(entry.isSubagent),
            statKey: entry.statKey || '',
            isArchived: true,
            turns: entry.turns.map(decodeCompactTurn),
          });
        }
      }
    } catch {}
  }

  function flushArchive(force = false) {
    if (disableArchiveWrite || !archiveDirty) return;
    const now = nowFn();
    if (!force && now - lastArchiveWriteAt < ARCHIVE_FLUSH_MS) return;
    try {
      const conversations = {};
      for (const [convId, entry] of archiveMap.entries()) {
        if (!entry.turns || entry.turns.length === 0) continue;
        conversations[convId] = {
          convId: entry.convId,
          product: entry.product,
          title: entry.title,
          workspace: entry.workspace,
          isSubagent: entry.isSubagent,
          statKey: entry.statKey,
          turns: entry.turns.map(encodeCompactTurn),
        };
      }
      atomicWriteJson(archivePath, {
        version: 1,
        updatedAt: now,
        conversations,
      });
      archiveDirty = false;
      lastArchiveWriteAt = now;
    } catch {}
  }

  async function getLsModelConfigs() {
    const lsAddr = options.lsAddress ?? process.env.ANTIGRAVITY_LS_ADDRESS ?? '';
    const csrf = options.csrfToken ?? process.env.ANTIGRAVITY_CSRF_TOKEN ?? '';
    if (!lsAddr || !csrf || typeof fetchImpl !== 'function') {
      return lsConfigsCache.configs;
    }
    const now = nowFn();
    if (now - lsConfigsCache.fetchedAt < LS_CONFIG_TTL_MS) {
      return lsConfigsCache.configs;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const res = await fetchImpl(
        `http://${lsAddr}/exa.language_server_pb.LanguageServerService/GetUserStatus`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Connect-Protocol-Version': '1',
            'x-codeium-csrf-token': csrf,
          },
          body: '{}',
          signal: controller.signal,
        }
      );
      if (res.ok) {
        const json = await res.json();
        const configs = json?.userStatus?.cascadeModelConfigData?.clientModelConfigs || [];
        lsConfigsCache = { configs, fetchedAt: now };
      } else {
        lsConfigsCache.fetchedAt = now;
      }
    } catch {
      lsConfigsCache.fetchedAt = now;
    } finally {
      clearTimeout(timer);
    }
    return lsConfigsCache.configs;
  }

  function readSummaryDb(rootDir) {
    const sumPath = join(rootDir, 'conversation_summaries.db');
    const st = safeStat(sumPath);
    if (!st.exists || st.size === 0) return new Map();
    const walSt = safeStat(`${sumPath}-wal`);
    const statKey = `${st.mtimeMs}:${st.size}:${walSt.mtimeMs}:${walSt.size}`;
    const cached = summaryDbCache.get(sumPath);
    if (cached && cached.statKey === statKey) {
      return cached.rowsById;
    }

    const rowsById = new Map();
    let db = null;
    try {
      db = new DatabaseSync(sumPath, { readOnly: true });
      const rows = db
        .prepare(
          'SELECT conversation_id, title, workspace_uris, parent_conversation_id, nesting_depth, source FROM conversation_summaries'
        )
        .all();
      for (const r of rows) {
        const id = String(r.conversation_id || '');
        if (!id) continue;
        rowsById.set(id, {
          title: String(r.title || '').trim(),
          workspace: extractWorkspaceName(String(r.workspace_uris || '')),
          isSubagent: Boolean(r.parent_conversation_id) || Number(r.nesting_depth || 0) > 0,
          source: String(r.source || ''),
        });
      }
      summaryDbCache.set(sumPath, { statKey, rowsById });
    } catch {
      if (cached) return cached.rowsById;
    } finally {
      try {
        db?.close();
      } catch {}
    }
    return rowsById;
  }

  function readConversationDb(dbPath, statKey, fallbackTs) {
    let db = null;
    try {
      db = new DatabaseSync(dbPath, { readOnly: true });
      const steps = db.prepare('SELECT idx, metadata FROM steps ORDER BY idx ASC').all();
      const stepTimestamps = [];
      const stepTsByIdx = new Map();
      for (const s of steps) {
        const ts = parseStepTimestampMs(s.metadata);
        if (ts > 0) {
          const sIdx = Number(s.idx);
          stepTsByIdx.set(sIdx, ts);
          stepTimestamps.push({ idx: sIdx, ts });
        }
      }

      const gens = db.prepare('SELECT idx, data FROM gen_metadata ORDER BY idx ASC').all();
      const turns = [];
      for (const g of gens) {
        const parsed = parseGenMetadataRow(g.idx, g.data);
        if (!parsed) continue;
        let ts = 0;
        if (parsed.lastStepIndex >= 0 && stepTsByIdx.has(parsed.lastStepIndex)) {
          ts = stepTsByIdx.get(parsed.lastStepIndex);
        } else if (stepTimestamps.length > 0) {
          // Nearest step with idx <= lastStepIndex, or last known step timestamp
          let bestTs = 0;
          for (const st of stepTimestamps) {
            if (parsed.lastStepIndex < 0 || st.idx <= parsed.lastStepIndex) {
              bestTs = st.ts;
            } else {
              break;
            }
          }
          ts = bestTs || stepTimestamps[0].ts;
        }
        if (!ts) ts = fallbackTs || Date.now();
        turns.push({
          idx: parsed.idx,
          ts,
          modelStr: parsed.modelStr,
          enumId: parsed.enumId,
          uncachedIn: parsed.uncachedIn,
          cachedIn: parsed.cachedIn,
          thinkingOut: parsed.thinkingOut,
          responseOut: parsed.responseOut,
        });
      }
      return { ok: true, statKey, turns };
    } catch {
      return { ok: false, statKey, turns: [] };
    } finally {
      try {
        db?.close();
      } catch {}
    }
  }

  function syncAllConversations(force = false) {
    loadArchiveIfNeeded();

    // Mark all currently archived entries; active DBs on disk clear isArchived
    for (const entry of archiveMap.values()) {
      entry.isArchived = true;
    }

    for (const root of appDataRoots) {
      const convDir = join(root.dir, 'conversations');
      if (!existsSync(convDir)) continue;
      const summaries = readSummaryDb(root.dir);

      let files = [];
      try {
        files = readdirSync(convDir).filter((f) => f.endsWith('.db'));
      } catch {
        continue;
      }

      for (const file of files) {
        const convId = file.slice(0, -3);
        if (!UUID_RE.test(convId)) continue;
        const dbPath = join(convDir, file);
        const st = safeStat(dbPath);
        if (!st.exists || st.size === 0) continue;
        const walSt = safeStat(`${dbPath}-wal`);
        const statKey = `${root.product}:${st.mtimeMs}:${st.size}:${walSt.mtimeMs}:${walSt.size}`;

        const summary = summaries.get(convId);
        const existing = archiveMap.get(convId);

        if (!force && existing && existing.statKey === statKey) {
          existing.isArchived = false;
          if (summary) {
            if (summary.title && existing.title !== summary.title) {
              existing.title = summary.title;
              archiveDirty = true;
            }
            if (summary.workspace && existing.workspace !== summary.workspace) {
              existing.workspace = summary.workspace;
              archiveDirty = true;
            }
            if (existing.isSubagent !== summary.isSubagent) {
              existing.isSubagent = summary.isSubagent;
              archiveDirty = true;
            }
          }
          continue;
        }

        const readRes = readConversationDb(dbPath, statKey, st.mtimeMs || walSt.mtimeMs);
        if (!readRes.ok) {
          if (existing) existing.isArchived = false;
          continue;
        }

        // If duplicate convId exists across products, keep whichever has more turns
        if (
          existing &&
          existing.product !== root.product &&
          !existing.isArchived &&
          existing.turns.length > readRes.turns.length
        ) {
          continue;
        }

        archiveMap.set(convId, {
          convId,
          product: root.product,
          title: summary?.title || existing?.title || '',
          workspace: summary?.workspace || existing?.workspace || '',
          isSubagent: summary ? summary.isSubagent : Boolean(existing?.isSubagent),
          statKey,
          isArchived: false,
          turns: readRes.turns,
        });
        archiveDirty = true;
      }
    }

    flushArchive(force);
  }

  function buildAggregatedSnapshot(lsConfigs) {
    const now = nowFn();
    const todayKey = toLocalDateKey(now);
    const prefs = readPrefs();

    const totals = createEmptyAgg();
    totals.conversations = 0;
    totals.subagentConversations = 0;
    totals.activeDays = 0;
    totals.currentStreak = 0;
    totals.longestStreak = 0;
    totals.peakDay = null;
    totals.hourlyTokens = new Array(24).fill(0);
    totals.hourlyCost = new Array(24).fill(0);
    totals.hourlyTraffic = new Array(24).fill(0);
    totals.byModel = {};
    totals.topConvs = [];

    const days = {};
    const months = {};
    const dayConvMaps = new Map(); // dateKey -> Map<convId, convStats>
    const monthConvMaps = new Map(); // monthKey -> Map<convId, convStats>
    const allConvMap = new Map();

    function ensureDay(dateKey) {
      let d = days[dateKey];
      if (!d) {
        d = {
          date: dateKey,
          ...createEmptyAgg(),
          hourlyTokens: new Array(24).fill(0),
          hourlyCost: new Array(24).fill(0),
          hourlyTraffic: new Array(24).fill(0),
          byModel: {},
          topConvs: [],
        };
        days[dateKey] = d;
      }
      return d;
    }

    function ensureMonth(monthKey) {
      let m = months[monthKey];
      if (!m) {
        m = {
          month: monthKey,
          ...createEmptyAgg(),
          activeDays: 0,
          peakDay: null,
          hourlyTokens: new Array(24).fill(0),
          hourlyCost: new Array(24).fill(0),
          hourlyTraffic: new Array(24).fill(0),
          byModel: {},
          topConvs: [],
        };
        months[monthKey] = m;
      }
      return m;
    }

    function addModelAgg(byModelObj, spec, turnDelta) {
      let entry = byModelObj[spec.id];
      if (!entry) {
        entry = {
          id: spec.id,
          label: spec.label,
          shortLabel: spec.shortLabel,
          color: spec.color,
          ...createEmptyAgg(),
        };
        byModelObj[spec.id] = entry;
      }
      addAgg(entry, turnDelta);
    }

    function addConvEntry(convMap, conv, turnDelta) {
      let c = convMap.get(conv.convId);
      if (!c) {
        c = {
          convId: conv.convId,
          title: conv.title || '',
          workspace: conv.workspace || '',
          isSubagent: conv.isSubagent,
          isArchived: conv.isArchived,
          product: conv.product,
          turns: 0,
          grossTokens: 0,
          costUsd: 0,
          savedUsd: 0,
        };
        convMap.set(conv.convId, c);
      }
      c.turns += 1;
      c.grossTokens += turnDelta.grossTokens;
      c.costUsd += turnDelta.costUsd;
      c.savedUsd += turnDelta.savedUsd;
    }

    for (const conv of archiveMap.values()) {
      if (!conv.turns || conv.turns.length === 0) continue;
      totals.conversations++;
      if (conv.isSubagent) totals.subagentConversations++;

      for (const turn of conv.turns) {
        const spec = resolveModelSpec(turn.modelStr, turn.enumId, lsConfigs);
        const billing = calculateTurnBilling({
          uncachedIn: turn.uncachedIn,
          cachedIn: turn.cachedIn,
          thinkingOut: turn.thinkingOut,
          responseOut: turn.responseOut,
          spec,
        });

        const totalOut = turn.thinkingOut + turn.responseOut;
        const grossTokens = turn.uncachedIn + turn.cachedIn + totalOut;
        const turnDelta = {
          grossTokens,
          uncachedIn: turn.uncachedIn,
          cachedIn: turn.cachedIn,
          thinkingOut: turn.thinkingOut,
          responseOut: turn.responseOut,
          costUsd: billing.costUsd,
          savedUsd: billing.savedUsd,
          costIn: billing.costIn,
          costCache: billing.costCache,
          costThink: billing.costThink,
          costResp: billing.costResp,
          turns: 1,
        };

        const ts = turn.ts > 0 ? turn.ts : now;
        const dt = new Date(ts);
        const dateKey = toLocalDateKey(ts);
        const monthKey = dateKey.slice(0, 7);
        const hour = dt.getHours();

        addAgg(totals, turnDelta);
        totals.hourlyTokens[hour] += grossTokens;
        totals.hourlyCost[hour] += billing.costUsd;
        addModelAgg(totals.byModel, spec, turnDelta);
        addConvEntry(allConvMap, conv, turnDelta);

        const dayObj = ensureDay(dateKey);
        addAgg(dayObj, turnDelta);
        dayObj.hourlyTokens[hour] += grossTokens;
        dayObj.hourlyCost[hour] += billing.costUsd;
        addModelAgg(dayObj.byModel, spec, turnDelta);
        if (!dayConvMaps.has(dateKey)) dayConvMaps.set(dateKey, new Map());
        addConvEntry(dayConvMaps.get(dateKey), conv, turnDelta);

        const monthObj = ensureMonth(monthKey);
        addAgg(monthObj, turnDelta);
        monthObj.hourlyTokens[hour] += grossTokens;
        monthObj.hourlyCost[hour] += billing.costUsd;
        addModelAgg(monthObj.byModel, spec, turnDelta);
        if (!monthConvMaps.has(monthKey)) monthConvMaps.set(monthKey, new Map());
        addConvEntry(monthConvMaps.get(monthKey), conv, turnDelta);
      }
    }

    // Merge OS-level per-process daily & hourly network traffic
    for (const [dateKey, tDay] of trafficMonitor.getDaysMap().entries()) {
      const up = Math.max(0, Number(tDay.upBytes || 0));
      const down = Math.max(0, Number(tDay.downBytes || 0));
      const sum = up + down;
      if (sum <= 0) continue;

      const dayObj = ensureDay(dateKey);
      dayObj.trafficUpBytes += up;
      dayObj.trafficDownBytes += down;
      dayObj.trafficBytes += sum;

      const monthObj = ensureMonth(dateKey.slice(0, 7));
      monthObj.trafficUpBytes += up;
      monthObj.trafficDownBytes += down;
      monthObj.trafficBytes += sum;

      totals.trafficUpBytes += up;
      totals.trafficDownBytes += down;
      totals.trafficBytes += sum;

      for (let h = 0; h < 24; h++) {
        const hSum = Number(tDay.hourlyUp?.[h] || 0) + Number(tDay.hourlyDown?.[h] || 0);
        if (hSum > 0) {
          dayObj.hourlyTraffic[h] += hSum;
          monthObj.hourlyTraffic[h] += hSum;
          totals.hourlyTraffic[h] += hSum;
        }
      }
    }

    // Finalize top conversations & peak/streak metrics (streaks track days with actual turns)
    const activeDates = Object.keys(days)
      .filter((k) => days[k].turns > 0)
      .sort();
    totals.activeDays = activeDates.length;

    for (const dateKey of activeDates) {
      const d = days[dateKey];
      const convMap = dayConvMaps.get(dateKey);
      if (convMap) {
        d.topConvs = [...convMap.values()]
          .sort((a, b) => b.costUsd - a.costUsd || b.grossTokens - a.grossTokens)
          .slice(0, 12);
      }
      if (!totals.peakDay || d.costUsd > totals.peakDay.costUsd) {
        totals.peakDay = { date: dateKey, costUsd: d.costUsd, grossTokens: d.grossTokens };
      }
      const m = months[dateKey.slice(0, 7)];
      if (m) {
        m.activeDays++;
        if (!m.peakDay || d.costUsd > m.peakDay.costUsd) {
          m.peakDay = { date: dateKey, costUsd: d.costUsd, grossTokens: d.grossTokens };
        }
      }
    }

    for (const [monthKey, m] of Object.entries(months)) {
      const convMap = monthConvMaps.get(monthKey);
      if (convMap) {
        m.topConvs = [...convMap.values()]
          .sort((a, b) => b.costUsd - a.costUsd || b.grossTokens - a.grossTokens)
          .slice(0, 15);
      }
    }

    totals.topConvs = [...allConvMap.values()]
      .sort((a, b) => b.costUsd - a.costUsd || b.grossTokens - a.grossTokens)
      .slice(0, 15);

    // Streaks
    let run = 0;
    let best = 0;
    let prevDate = '';
    for (const dKey of activeDates) {
      if (prevDate && addLocalDays(prevDate, 1) === dKey) {
        run += 1;
      } else {
        run = 1;
      }
      if (run > best) best = run;
      prevDate = dKey;
    }
    totals.longestStreak = best;

    const activeSet = new Set(activeDates);
    let anchor = '';
    if (activeSet.has(todayKey)) anchor = todayKey;
    else if (activeSet.has(addLocalDays(todayKey, -1))) anchor = addLocalDays(todayKey, -1);

    let currentStreak = 0;
    while (anchor && activeSet.has(anchor)) {
      currentStreak++;
      anchor = addLocalDays(anchor, -1);
    }
    totals.currentStreak = currentStreak;

    // 7-day rolling baseline (up to 7 prior active days before today)
    const priorActive = activeDates.filter((d) => d < todayKey).slice(-7);
    const avg7dCostUsd =
      priorActive.length > 0
        ? priorActive.reduce((s, k) => s + days[k].costUsd, 0) / priorActive.length
        : 0;
    const avg7dGrossTokens =
      priorActive.length > 0
        ? priorActive.reduce((s, k) => s + days[k].grossTokens, 0) / priorActive.length
        : 0;

    const todayObj = days[todayKey] || { date: todayKey, ...createEmptyAgg() };
    const today = {
      date: todayKey,
      grossTokens: todayObj.grossTokens,
      uncachedIn: todayObj.uncachedIn,
      cachedIn: todayObj.cachedIn,
      thinkingOut: todayObj.thinkingOut,
      responseOut: todayObj.responseOut,
      costUsd: todayObj.costUsd,
      savedUsd: todayObj.savedUsd,
      turns: todayObj.turns,
      trafficUpBytes: todayObj.trafficUpBytes,
      trafficDownBytes: todayObj.trafficDownBytes,
      trafficBytes: todayObj.trafficBytes,
      avg7dCostUsd,
      avg7dGrossTokens,
    };

    const trafficStatus = trafficMonitor.getStatus();
    const dataSig = `${totals.turns}:${totals.grossTokens}:${totals.conversations}:${Math.round(totals.costUsd * 1000)}:${totals.trafficUpBytes}:${totals.trafficDownBytes}:${trafficStatus.state}`;
    if (dataSig !== lastDataSig) {
      lastDataSig = dataSig;
      revCounter++;
    }

    return {
      generatedAt: now,
      todayKey,
      rev: String(revCounter),
      prefs,
      rateCard: getRateCard(),
      trafficStatus,
      totals,
      allModels: totals.byModel,
      today,
      days,
      months,
    };
  }

  async function getLedgerSnapshot({ force = false } = {}) {
    const now = nowFn();
    if (!force && lastSnapshot && now - lastScanAt < SCAN_TTL_MS) {
      return lastSnapshot;
    }
    const lsConfigs = await getLsModelConfigs();
    syncAllConversations(force);
    lastSnapshot = buildAggregatedSnapshot(lsConfigs);
    lastScanAt = nowFn();
    return lastSnapshot;
  }

  return {
    stateDir,
    trafficMonitor,
    readPrefs,
    updatePrefs,
    flushArchive,
    getLedgerSnapshot,
    close() {
      trafficMonitor.stop();
      flushArchive(true);
    },
  };
}

// ---------------------------------------------------------------------------
// CLI entrypoint (`node collector.mjs --summary`)
// ---------------------------------------------------------------------------

function parseCliArgs(argv) {
  const out = { summary: false, days: 7, month: '', date: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--summary') out.summary = true;
    else if (a === '--days' && argv[i + 1]) out.days = Math.max(1, Number(argv[++i]) || 7);
    else if (a === '--month' && argv[i + 1]) out.month = argv[++i];
    else if (a === '--date' && argv[i + 1]) out.date = argv[++i];
  }
  return out;
}

const isMain =
  Boolean(process.argv[1]) &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const args = parseCliArgs(process.argv.slice(2));
  const collector = createLedgerCollector({ enableTrafficMonitor: false });
  const snap = await collector.getLedgerSnapshot({ force: true });
  collector.flushArchive(true);

  if (args.summary || args.month || args.date) {
    const recentDates = Object.keys(snap.days).sort().slice(-args.days);
    const out = {
      generatedAt: snap.generatedAt,
      todayKey: snap.todayKey,
      trafficStatus: snap.trafficStatus,
      today: snap.today,
      totals: snap.totals,
      recentDays: recentDates.map((d) => ({
        date: d,
        turns: snap.days[d].turns,
        grossTokens: snap.days[d].grossTokens,
        costUsd: Number(snap.days[d].costUsd.toFixed(4)),
        savedUsd: Number(snap.days[d].savedUsd.toFixed(4)),
        trafficBytes: snap.days[d].trafficBytes,
        trafficUpBytes: snap.days[d].trafficUpBytes,
        trafficDownBytes: snap.days[d].trafficDownBytes,
      })),
    };
    if (args.month && snap.months[args.month]) {
      out.monthDetail = snap.months[args.month];
    }
    if (args.date && snap.days[args.date]) {
      out.dateDetail = snap.days[args.date];
    }
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log(JSON.stringify(snap, null, 2));
  }
}
