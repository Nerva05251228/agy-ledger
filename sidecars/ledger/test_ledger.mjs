/**
 * Automated verification suite for agy-ledger.
 *
 * Verifies:
 *   1. Updated 2026-11 standard API billing (incl. Gemini 4 Neon & Claude 5.5) & Cache savings math
 *   2. Cross-platform OS-level process traffic accounting, persistence, & Linux/macOS parsers
 *   3. Real local SQLite telemetry extraction + all-time totals breakdown
 *   4. End-to-end HTTP server asset & JSON API serving + simplified prefs mutation
 *   5. Strict Zero-Blue/Purple palette audit across all UI, SVG, and CDP files
 *   6. Minimalist plain-language copy, removed toggles, & theme-unified scrollbar verification
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateTurnBilling, resolveModelSpec } from './pricing.mjs';
import { createLedgerCollector, sanitizePrefs, toLocalDateKey } from './collector.mjs';
import { createTrafficMonitor, parseLinuxSsOutput, parseMacNettopOutput } from './traffic.mjs';
import { startLedgerServer } from './server.mjs';
import { buildCdpRuntimeBundle } from './cdp_modal.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..', '..');

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return { h, s: s * 100, l: l * 100 };
}

function parseHexToRgb(hex) {
  const raw = hex.replace(/^#/, '');
  if (raw.length === 3 || raw.length === 4) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    return { r, g, b };
  }
  if (raw.length === 6 || raw.length === 8) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

function auditPaletteZeroBluePurple() {
  const files = [
    join(__dirname, 'web', 'styles.css'),
    join(__dirname, 'web', 'app.js'),
    join(__dirname, 'web', 'index.html'),
    join(__dirname, 'cdp_modal.mjs'),
    join(PLUGIN_ROOT, 'assets', 'logo.svg'),
  ];

  const violations = [];
  let checkedCount = 0;

  for (const file of files) {
    const text = readFileSync(file, 'utf8');

    for (const m of text.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) {
      const hex = m[1];
      if (![3, 4, 6, 8].includes(hex.length)) continue;
      const rgb = parseHexToRgb(hex);
      if (!rgb) continue;
      checkedCount++;
      const { h, s } = rgbToHsl(rgb.r, rgb.g, rgb.b);
      if (s > 15 && h >= 185 && h <= 320) {
        violations.push({ file, literal: `#${hex}`, h: h.toFixed(1), s: s.toFixed(1) });
      }
    }

    for (const m of text.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi)) {
      const rgb = { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
      checkedCount++;
      const { h, s } = rgbToHsl(rgb.r, rgb.g, rgb.b);
      if (s > 15 && h >= 185 && h <= 320) {
        violations.push({ file, literal: m[0], h: h.toFixed(1), s: s.toFixed(1) });
      }
    }

    for (const m of text.matchAll(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%/gi)) {
      const h = Number(m[1]) % 360;
      const s = Number(m[2]);
      checkedCount++;
      if (s > 15 && h >= 185 && h <= 320) {
        violations.push({ file, literal: m[0], h: h.toFixed(1), s: s.toFixed(1) });
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    `Found forbidden blue/purple color literals: ${JSON.stringify(violations)}`
  );
  assert.ok(checkedCount > 25, `Expected >25 color literals checked, got ${checkedCount}`);
  return checkedCount;
}

function auditUiCopyAndScrollbars() {
  const uiFiles = [
    join(__dirname, 'web', 'app.js'),
    join(__dirname, 'web', 'index.html'),
    join(__dirname, 'web', 'styles.css'),
    join(__dirname, 'cdp_modal.mjs'),
  ];

  const forbidden = [
    '无缓存原价',
    'List price',
    '悬停或点击',
    'Hover or click',
    '四维构成解剖',
    '构成解剖',
    '算力小票',
    '算力账本',
    '算力日历',
    '结算总账',
    '高消耗会话榜单',
    '热力矩阵',
    '总吞吐',
    '净新增',
    '暖纸',
    '黑曜',
    'Anatomy',
    'Burn Rhythm',
    '仅只读统计',
    'pill-hide',
    'SimSun',
    'Times New Roman',
    '不含缓存',
    'data-action="currency"',
    'data-action="metric"',
    'data-action="close-drawer"',
  ];

  for (const file of uiFiles) {
    const content = readFileSync(file, 'utf8');
    for (const bad of forbidden) {
      assert.equal(
        content.includes(bad),
        false,
        `Forbidden copy/token "${bad}" found in ${file}`
      );
    }
  }

  const stylesCss = readFileSync(join(__dirname, 'web', 'styles.css'), 'utf8');
  const cdpModal = readFileSync(join(__dirname, 'cdp_modal.mjs'), 'utf8');
  assert.ok(stylesCss.includes('::-webkit-scrollbar-thumb'), 'Missing custom webkit scrollbar in styles.css');
  assert.ok(stylesCss.includes('scrollbar-color'), 'Missing scrollbar-color in styles.css');
  assert.ok(stylesCss.includes('.tl-heatmap-month-lbl'), 'Missing .tl-heatmap-month-lbl in styles.css');
  assert.ok(stylesCss.includes('white-space: nowrap'), 'Missing white-space: nowrap in styles.css');
  assert.ok(stylesCss.includes('.tl-cell-net'), 'Missing .tl-cell-net in styles.css');
  assert.ok(cdpModal.includes('::-webkit-scrollbar-thumb'), 'Missing custom webkit scrollbar in cdp_modal.mjs');
  assert.ok(cdpModal.includes('scrollbar-color'), 'Missing scrollbar-color in cdp_modal.mjs');
  assert.ok(cdpModal.includes('agy-ledger-pill-host'), 'Missing inline pill host in cdp_modal.mjs');
  assert.ok(cdpModal.includes('.tl-hover-card'), 'Missing today hover card in cdp_modal.mjs');
  assert.ok(cdpModal.includes('.agy-composer-footer'), 'Missing composer footer docking in cdp_modal.mjs');
  assert.ok(
    cdpModal.includes("pillBtn.setAttribute('data-theme', detectAgyTheme())"),
    'Inline capsule must follow Antigravity host theme independently'
  );
  for (const pos of ['left: 16px', 'bottom: 16px', 'left: 14px', 'bottom: 14px']) {
    assert.equal(cdpModal.includes(pos), false, `Found forbidden fixed pill coordinate "${pos}" in cdp_modal.mjs`);
  }

  // Validate generated CDP runtime bundle compiles cleanly as JS
  const { code } = buildCdpRuntimeBundle(123456);
  new Function(code);
}

function encodeVarint(n) {
  let v = BigInt(n);
  const out = [];
  while (v >= 0x80n) {
    out.push(Number((v & 0x7fn) | 0x80n));
    v >>= 7n;
  }
  out.push(Number(v));
  return Buffer.from(out);
}

function pbVarint(fn, val) {
  return Buffer.concat([encodeVarint((fn << 3) | 0), encodeVarint(val)]);
}

function pbBytes(fn, buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf), 'utf8');
  return Buffer.concat([encodeVarint((fn << 3) | 2), encodeVarint(b.length), b]);
}

function createFixtureAppData(rootDir, nowMs) {
  const convId = '11111111-2222-3333-4444-555555555555';
  const prodDir = join(rootDir, 'antigravity');
  const convDir = join(prodDir, 'conversations');
  mkdirSync(convDir, { recursive: true });

  const sumDb = new DatabaseSync(join(prodDir, 'conversation_summaries.db'));
  sumDb.exec(
    'CREATE TABLE conversation_summaries (conversation_id TEXT PRIMARY KEY, title TEXT, workspace_uris TEXT, parent_conversation_id TEXT, nesting_depth INTEGER, source TEXT)'
  );
  sumDb
    .prepare('INSERT INTO conversation_summaries VALUES (?, ?, ?, ?, ?, ?)')
    .run(convId, 'Sample Fixture Chat', '["file:///tmp/demo-project"]', '', 0, 'desktop');
  sumDb.close();

  const sec = Math.floor(nowMs / 1000);
  const stepMeta = pbBytes(1, pbVarint(1, sec));
  const kv = Buffer.concat([pbBytes(1, 'last_step_index'), pbBytes(2, '0')]);
  const usage = Buffer.concat([
    pbVarint(1, 1535),
    pbVarint(2, 10_000),
    pbVarint(3, 1_500),
    pbVarint(5, 80_000),
    pbVarint(9, 500),
    pbVarint(10, 1_000),
  ]);
  const m1 = Buffer.concat([pbVarint(3, 1535), pbBytes(4, usage), pbBytes(19, 'gemini-4-neon'), pbBytes(20, kv)]);
  const genData = pbBytes(1, m1);

  const cDb = new DatabaseSync(join(convDir, `${convId}.db`));
  cDb.exec('CREATE TABLE steps (idx INTEGER PRIMARY KEY, metadata BLOB)');
  cDb.exec('CREATE TABLE gen_metadata (idx INTEGER PRIMARY KEY, data BLOB)');
  cDb.prepare('INSERT INTO steps VALUES (0, ?)').run(stepMeta);
  cDb.prepare('INSERT INTO gen_metadata VALUES (0, ?)').run(genData);
  cDb.close();

  return [{ product: 'antigravity', dir: prodDir }];
}

function testTrafficParsersAndArchive(tempStateDir) {
  // Linux `ss` parser test: count external + proxy loopback, exclude internal AGY IPC & local dev server
  const listenText = [
    'LISTEN 0 128 127.0.0.1:6758 0.0.0.0:* users:(("language_server",pid=100,fd=5))',
    'LISTEN 0 128 127.0.0.1:10808 0.0.0.0:* users:(("sing-box",pid=200,fd=8))',
    'LISTEN 0 128 127.0.0.1:3000 0.0.0.0:* users:(("node",pid=300,fd=9))',
  ].join('\n');
  const tcpText = [
    'ESTAB 0 0 127.0.0.1:50001 127.0.0.1:6758 users:(("Antigravity",pid=101,fd=10))',
    ' cubic bytes_sent:999999 bytes_received:888888',
    'ESTAB 0 0 127.0.0.1:50002 127.0.0.1:10808 users:(("language_server",pid=100,fd=11))',
    ' cubic bytes_sent:40000 bytes_received:12000',
    'ESTAB 0 0 127.0.0.1:50003 127.0.0.1:3000 users:(("Antigravity",pid=101,fd=12))',
    ' cubic bytes_sent:77777 bytes_received:66666',
    'ESTAB 0 0 10.0.0.5:50004 142.250.1.1:443 users:(("language_server",pid=100,fd=13))',
    ' cubic bytes_sent:10000 bytes_received:5000',
    'ESTAB 0 0 127.0.0.1:50005 127.0.0.1:10808 users:(("chrome",pid=400,fd=14))',
    ' cubic bytes_sent:500000 bytes_received:500000',
  ].join('\n');

  const linuxParsed = parseLinuxSsOutput(tcpText, listenText);
  assert.equal(linuxParsed.conns.size, 2, 'Linux parser should only include proxy + external AGY sockets');
  let sumOut = 0;
  let sumIn = 0;
  for (const c of linuxParsed.conns.values()) {
    sumOut += c.outBytes;
    sumIn += c.inBytes;
  }
  assert.equal(sumOut, 50_000);
  assert.equal(sumIn, 17_000);

  // macOS `nettop` parser test
  const lsofListen = [
    'COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME',
    'language_server 100 user 5u IPv4 0x1 0t0 TCP 127.0.0.1:6758 (LISTEN)',
    'mihomo 200 user 8u IPv4 0x2 0t0 TCP 127.0.0.1:7890 (LISTEN)',
  ].join('\n');
  const nettopOut = [
    'time,,bytes_in,bytes_out,',
    '17:00:01.000,language_server_macos_arm.100,50000,90000,',
    '17:00:01.000,tcp4 127.0.0.1:51000<->127.0.0.1:6758,99999,99999,',
    '17:00:01.000,tcp4 127.0.0.1:51001<->127.0.0.1:7890,1500,8500,',
    '17:00:01.000,tcp4 192.168.1.5:51002<->142.250.1.1:443,2500,3500,',
    '17:00:01.000,Google Chrome.400,800000,800000,',
    '17:00:01.000,tcp4 127.0.0.1:51003<->127.0.0.1:7890,800000,800000,',
  ].join('\n');

  const macParsed = parseMacNettopOutput(nettopOut, lsofListen);
  assert.equal(macParsed.conns.size, 2, 'macOS parser should exclude IPC & Chrome, keep proxy + external');
  let macOut = 0;
  let macIn = 0;
  for (const c of macParsed.conns.values()) {
    macOut += c.outBytes;
    macIn += c.inBytes;
  }
  assert.equal(macOut, 12_000);
  assert.equal(macIn, 4_000);

  // Persistence round-trip test
  const tDir = mkdtempSync(join(tempStateDir, 'traffic-'));
  const fixedTs = new Date(2026, 10, 24, 15, 30, 0).getTime();
  const mon1 = createTrafficMonitor({ stateDir: tDir, nowFn: () => fixedTs });
  mon1.recordDelta(1_500_000, 250_000, fixedTs);
  mon1.recordDelta(500_000, 50_000, fixedTs);
  mon1.flush(true);

  const mon2 = createTrafficMonitor({ stateDir: tDir, nowFn: () => fixedTs });
  const day = mon2.getDaysMap().get('2026-11-24');
  assert.ok(day, 'Expected persisted traffic day 2026-11-24');
  assert.equal(day.upBytes, 2_000_000);
  assert.equal(day.downBytes, 300_000);
  assert.equal(day.hourlyUp[15], 2_000_000);
  assert.equal(day.hourlyDown[15], 300_000);
}

async function runTests() {
  const tempStateDir = mkdtempSync(join(tmpdir(), 'agy-ledger-test-'));
  const tempFixtureDir = mkdtempSync(join(tmpdir(), 'agy-ledger-fixture-'));
  try {
    // 1. Billing & Cache Math Unit Test (2026-11 Standard Rates)
    const neonSpec = resolveModelSpec('gemini-4-neon', 1535);
    assert.equal(neonSpec.id, 'gemini-4-neon');
    assert.equal(neonSpec.inRate, 3.0);
    assert.equal(neonSpec.cacheRate, 0.15);
    assert.equal(neonSpec.outRate, 15.0);

    const neonByEnum = resolveModelSpec('', 1535);
    assert.equal(neonByEnum.id, 'gemini-4-neon');

    const hydrogenSpec = resolveModelSpec('gemini-4-hydrogen', 1528);
    assert.equal(hydrogenSpec.id, 'gemini-4-hydrogen');
    assert.equal(hydrogenSpec.inRate, 1.5);
    assert.equal(hydrogenSpec.cacheRate, 0.075);
    assert.equal(hydrogenSpec.outRate, 7.5);

    const argonSpec = resolveModelSpec('gemini-4-argon', 1417);
    assert.equal(argonSpec.id, 'gemini-4-argon');
    assert.equal(argonSpec.color, 'forest');
    assert.equal(argonSpec.inRate, 4.0);
    assert.equal(argonSpec.outRate, 20.0);

    const opus55Spec = resolveModelSpec('claude-opus-5-5-medium', 1401);
    assert.equal(opus55Spec.id, 'claude-opus-5.5');
    assert.equal(opus55Spec.inRate, 4.0);
    assert.equal(opus55Spec.cacheRate, 0.2);
    assert.equal(opus55Spec.outRate, 20.0);

    const opus46Spec = resolveModelSpec('', 1026);
    assert.equal(opus46Spec.id, 'claude-opus-4.6');
    assert.equal(opus46Spec.inRate, 5.0);

    const sonnet55Spec = resolveModelSpec('claude-sonnet-5-5-medium', 1404);
    assert.equal(sonnet55Spec.id, 'claude-sonnet-5.5');
    assert.equal(sonnet55Spec.inRate, 2.0);
    assert.equal(sonnet55Spec.outRate, 10.0);

    // Neon billing math: 100K in ($0.30) + 50K cache ($0.0075) + 2K out ($0.03) = $0.3375
    const neonBill = calculateTurnBilling({
      uncachedIn: 100_000,
      cachedIn: 50_000,
      thinkingOut: 1_000,
      responseOut: 1_000,
      spec: neonSpec,
    });
    assert.ok(Math.abs(neonBill.costUsd - 0.3375) < 1e-9, `Unexpected Neon bill: ${neonBill.costUsd}`);
    assert.ok(Math.abs(neonBill.savedUsd - 0.1425) < 1e-9, `Unexpected Neon savings: ${neonBill.savedUsd}`);

    // SanitizePrefs strips removed toggles cleanly
    const cleanPrefs = sanitizePrefs({ currency: 'CNY', metricMode: 'net', theme: 'dark', lang: 'en' });
    assert.equal(cleanPrefs.theme, 'dark');
    assert.equal(cleanPrefs.lang, 'en');
    assert.equal('currency' in cleanPrefs, false);
    assert.equal('metricMode' in cleanPrefs, false);

    // 2. Traffic Parsers & Persistence Unit Test
    testTrafficParsersAndArchive(tempStateDir);

    // 3. Portable SQLite Fixture Extraction + Traffic Aggregation Test
    const nowMs = Date.now();
    const fixtureRoots = createFixtureAppData(tempFixtureDir, nowMs);
    const collector = createLedgerCollector({
      stateDir: tempStateDir,
      appDataRoots: fixtureRoots,
      disableArchiveWrite: true,
      enableTrafficMonitor: false,
    });
    collector.trafficMonitor.recordDelta(5_242_880, 1_048_576, nowMs);
    const snap = await collector.getLedgerSnapshot({ force: true });
    assert.equal(snap.totals.conversations, 1);
    assert.equal(snap.totals.turns, 1);
    assert.equal(snap.totals.grossTokens, 91_500);
    assert.ok(snap.totals.costUsd > 0, 'Expected positive costUsd');
    assert.ok(snap.totals.savedUsd > 0, 'Expected positive savedUsd');
    assert.equal(snap.totals.trafficUpBytes, 5_242_880);
    assert.equal(snap.totals.trafficDownBytes, 1_048_576);
    assert.equal(snap.totals.trafficBytes, 6_291_456);
    assert.equal(snap.today.trafficBytes, 6_291_456);
    assert.equal(snap.totals.topConvs[0].title, 'Sample Fixture Chat');
    assert.equal(snap.totals.topConvs[0].workspace, 'demo-project');
    assert.ok(snap.totals.byModel['gemini-4-neon'], 'Expected gemini-4-neon in byModel');

    const dayKeys = Object.keys(snap.days);
    assert.equal(dayKeys.length, 1);
    assert.match(dayKeys[0], /^\d{4}-\d{2}-\d{2}$/, `Invalid local date key: ${dayKeys[0]}`);
    assert.equal(snap.todayKey, toLocalDateKey(snap.generatedAt));

    // Also verify real local DBs if present on this machine (non-fatal if empty)
    const realCollector = createLedgerCollector({
      stateDir: tempStateDir,
      disableArchiveWrite: true,
      enableTrafficMonitor: false,
    });
    const realSnap = await realCollector.getLedgerSnapshot({ force: true });
    for (const k of Object.keys(realSnap.days)) {
      assert.match(k, /^\d{4}-\d{2}-\d{2}$/, `Invalid local date key: ${k}`);
    }

    // 4. HTTP Server End-to-End Test
    const srv = await startLedgerServer({
      standalonePort: 0,
      enableCdp: false,
      enableTrafficMonitor: false,
      stateDir: tempStateDir,
      appDataRoots: fixtureRoots,
      disableArchiveWrite: true,
    });
    try {
      const port = srv.httpHandle.address.port;
      const baseUrl = `http://127.0.0.1:${port}`;

      const [rHtml, rCss, rJs, rApi] = await Promise.all([
        fetch(`${baseUrl}/`),
        fetch(`${baseUrl}/styles.css`),
        fetch(`${baseUrl}/app.js`),
        fetch(`${baseUrl}/api/ledger`),
      ]);

      assert.equal(rHtml.status, 200);
      assert.equal(rCss.status, 200);
      assert.equal(rJs.status, 200);
      assert.equal(rApi.status, 200);

      const htmlText = await rHtml.text();
      const cssText = await rCss.text();
      const jsText = await rJs.text();
      const apiJson = await rApi.json();

      assert.ok(htmlText.includes('mountTokenLedgerApp'));
      assert.ok(cssText.includes('.tl-cal-grid'));
      assert.ok(jsText.includes('mountTokenLedgerApp'));
      assert.equal(apiJson.totals.turns, snap.totals.turns);
      assert.ok(apiJson.trafficStatus, 'Expected trafficStatus in API response');

      const rPrefs = await fetch(`${baseUrl}/api/prefs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: 'dark', lang: 'en', widgetVisible: false }),
      });
      assert.equal(rPrefs.status, 200);
      const updatedJson = await rPrefs.json();
      assert.equal(updatedJson.prefs.theme, 'dark');
      assert.equal(updatedJson.prefs.lang, 'en');
      assert.equal(updatedJson.prefs.widgetVisible, false);
    } finally {
      await srv.close();
    }

    // 5. Strict Zero-Blue/Purple Palette Audit & Copy/Scrollbar Checks
    const colorsChecked = auditPaletteZeroBluePurple();
    auditUiCopyAndScrollbars();

    console.log(
      JSON.stringify(
        {
          ok: true,
          colorsChecked,
          conversations: realSnap.totals.conversations,
          turns: realSnap.totals.turns,
          activeDays: realSnap.totals.activeDays,
          costUsd: Number(realSnap.totals.costUsd.toFixed(2)),
          savedUsd: Number(realSnap.totals.savedUsd.toFixed(2)),
          models: Object.keys(realSnap.totals.byModel || {}),
        },
        null,
        2
      )
    );
  } finally {
    rmSync(tempStateDir, { recursive: true, force: true });
    rmSync(tempFixtureDir, { recursive: true, force: true });
  }
}

await runTests();
