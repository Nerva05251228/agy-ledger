/**
 * Automated verification suite for agy-ledger.
 *
 * Verifies:
 *   1. Tier-aware equivalent API billing & Prompt Cache savings math
 *   2. Real local SQLite telemetry extraction + all-time totals breakdown
 *   3. End-to-end HTTP server asset & JSON API serving + prefs mutation
 *   4. Strict Zero-Blue/Purple palette audit across all UI, SVG, and CDP files
 *   5. Minimalist plain-language copy & theme-unified scrollbar verification
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateTurnBilling, resolveModelSpec } from './pricing.mjs';
import { createLedgerCollector, toLocalDateKey } from './collector.mjs';
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
  assert.ok(cdpModal.includes('::-webkit-scrollbar-thumb'), 'Missing custom webkit scrollbar in cdp_modal.mjs');
  assert.ok(cdpModal.includes('scrollbar-color'), 'Missing scrollbar-color in cdp_modal.mjs');
  assert.ok(cdpModal.includes('agy-ledger-pill-host'), 'Missing inline pill host in cdp_modal.mjs');
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
    pbVarint(1, 1417),
    pbVarint(2, 10_000),
    pbVarint(3, 1_500),
    pbVarint(5, 80_000),
    pbVarint(9, 500),
    pbVarint(10, 1_000),
  ]);
  const m1 = Buffer.concat([pbVarint(3, 1417), pbBytes(4, usage), pbBytes(19, 'gemini-4-argon'), pbBytes(20, kv)]);
  const genData = pbBytes(1, m1);

  const cDb = new DatabaseSync(join(convDir, `${convId}.db`));
  cDb.exec('CREATE TABLE steps (idx INTEGER PRIMARY KEY, metadata BLOB)');
  cDb.exec('CREATE TABLE gen_metadata (idx INTEGER PRIMARY KEY, data BLOB)');
  cDb.prepare('INSERT INTO steps VALUES (0, ?)').run(stepMeta);
  cDb.prepare('INSERT INTO gen_metadata VALUES (0, ?)').run(genData);
  cDb.close();

  return [{ product: 'antigravity', dir: prodDir }];
}

async function runTests() {
  const tempStateDir = mkdtempSync(join(tmpdir(), 'agy-ledger-test-'));
  const tempFixtureDir = mkdtempSync(join(tmpdir(), 'agy-ledger-fixture-'));
  try {
    // 1. Billing & Cache Math Unit Test
    const argonSpec = resolveModelSpec('gemini-4-argon', 1417);
    assert.equal(argonSpec.id, 'gemini-4-argon');
    assert.equal(argonSpec.color, 'forest');

    const unknownSpec = resolveModelSpec('', 1401);
    assert.equal(unknownSpec.id, 'claude-opus-4.6');

    const stdBill = calculateTurnBilling({
      uncachedIn: 100_000,
      cachedIn: 50_000,
      thinkingOut: 1_000,
      responseOut: 1_000,
      spec: argonSpec,
    });
    assert.ok(Math.abs(stdBill.costUsd - 0.15125) < 1e-9, `Unexpected standard bill: ${stdBill.costUsd}`);
    assert.ok(stdBill.savedUsd > 0, 'Expected positive cache savings when cachedIn > 0');
    assert.equal(stdBill.isLongContext, false);

    const longBill = calculateTurnBilling({
      uncachedIn: 50_000,
      cachedIn: 200_000,
      thinkingOut: 1_000,
      responseOut: 1_000,
      spec: argonSpec,
    });
    assert.equal(longBill.isLongContext, true);
    assert.ok(Math.abs(longBill.costUsd - 0.205) < 1e-9, `Unexpected long bill: ${longBill.costUsd}`);
    assert.ok(longBill.savedUsd > 0.4, `Expected >$0.40 cache savings, got ${longBill.savedUsd}`);

    // 2. Portable SQLite Fixture Extraction Test + Totals Detail Breakdown
    const fixtureRoots = createFixtureAppData(tempFixtureDir, Date.now());
    const collector = createLedgerCollector({
      stateDir: tempStateDir,
      appDataRoots: fixtureRoots,
      disableArchiveWrite: true,
    });
    const snap = await collector.getLedgerSnapshot({ force: true });
    assert.equal(snap.totals.conversations, 1);
    assert.equal(snap.totals.turns, 1);
    assert.equal(snap.totals.grossTokens, 91_500);
    assert.equal(snap.totals.netTokens, 11_500);
    assert.ok(snap.totals.costUsd > 0, 'Expected positive costUsd');
    assert.ok(snap.totals.savedUsd > 0, 'Expected positive savedUsd');
    assert.equal(snap.totals.topConvs[0].title, 'Sample Fixture Chat');
    assert.equal(snap.totals.topConvs[0].workspace, 'demo-project');

    assert.ok(Object.keys(snap.totals.byModel || {}).length >= 1, 'Expected populated totals.byModel');
    assert.ok(
      Array.isArray(snap.totals.hourlyCost) &&
        snap.totals.hourlyCost.length === 24 &&
        snap.totals.hourlyCost.some((v) => v > 0),
      'Expected populated 24-hour totals.hourlyCost'
    );

    const dayKeys = Object.keys(snap.days);
    assert.equal(dayKeys.length, 1);
    assert.match(dayKeys[0], /^\d{4}-\d{2}-\d{2}$/, `Invalid local date key: ${dayKeys[0]}`);
    assert.equal(snap.todayKey, toLocalDateKey(snap.generatedAt));

    // Also verify real local DBs if present on this machine (non-fatal if empty)
    const realCollector = createLedgerCollector({
      stateDir: tempStateDir,
      disableArchiveWrite: true,
    });
    const realSnap = await realCollector.getLedgerSnapshot({ force: true });
    for (const k of Object.keys(realSnap.days)) {
      assert.match(k, /^\d{4}-\d{2}-\d{2}$/, `Invalid local date key: ${k}`);
    }

    // 3. HTTP Server End-to-End Test
    const srv = await startLedgerServer({
      standalonePort: 0,
      enableCdp: false,
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

      const rPrefs = await fetch(`${baseUrl}/api/prefs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: 'CNY', metricMode: 'net' }),
      });
      assert.equal(rPrefs.status, 200);
      const updatedJson = await rPrefs.json();
      assert.equal(updatedJson.prefs.currency, 'CNY');
      assert.equal(updatedJson.prefs.metricMode, 'net');
    } finally {
      await srv.close();
    }

    // 4. Strict Zero-Blue/Purple Palette Audit & Copy/Scrollbar Checks
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
