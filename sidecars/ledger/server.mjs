/**
 * Sidecar & standalone HTTP server entrypoint for agy-ledger.
 *
 * Serves:
 *   - Native Antigravity Aux Pane web UI via `sidecar_sdk`
 *   - Optional standalone HTTP mode (`--standalone-port <port>` or `startLedgerServer`)
 *   - Optional main-window CDP Shadow DOM Ticket Pill + wide Modal (`cdp_modal.mjs`)
 */
import { createServer } from 'node:http';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLedgerCollector } from './collector.mjs';
import { startCdpModalInjector } from './cdp_modal.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = join(__dirname, 'web');
const WATCH_FILES = [
  'server.mjs',
  'pricing.mjs',
  'collector.mjs',
  'traffic.mjs',
  'win_tcp_monitor.ps1',
  'cdp_modal.mjs',
  join('web', 'index.html'),
  join('web', 'styles.css'),
  join('web', 'app.js'),
];

function startSelfReloadWatcher(onChanged) {
  const baseline = new Map();
  for (const rel of WATCH_FILES) {
    try {
      baseline.set(rel, statSync(join(__dirname, rel)).mtimeMs);
    } catch {}
  }
  const timer = setInterval(() => {
    for (const [rel, prev] of baseline.entries()) {
      try {
        const cur = statSync(join(__dirname, rel)).mtimeMs;
        if (cur !== prev) {
          clearInterval(timer);
          onChanged(rel);
          return;
        }
      } catch {}
    }
  }, 3000);
  timer.unref?.();
  return timer;
}

function loadWebAsset(filename) {
  return readFileSync(join(WEB_DIR, filename), 'utf8');
}

function createStandaloneServer(collector, { port = 0, host = '127.0.0.1' } = {}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${host}`);

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loadWebAsset('index.html'));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/styles.css') {
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      res.end(loadWebAsset('styles.css'));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/app.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(loadWebAsset('app.js'));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/preload.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end('/* standalone mode */');
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/ledger') {
      try {
        const snap = await collector.getLedgerSnapshot({ force: url.searchParams.get('force') === '1' });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(snap));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err?.message || 'Internal error' }));
      }
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/prefs') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', async () => {
        try {
          const patch = body ? JSON.parse(body) : {};
          collector.updatePrefs(patch);
          const snap = await collector.getLedgerSnapshot({ force: false });
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(snap));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err?.message || 'Bad request' }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  return new Promise((resolvePromise) => {
    server.listen(port, host, () => {
      resolvePromise({ server, address: server.address() });
    });
  });
}

export async function startLedgerServer(options = {}) {
  const collector = createLedgerCollector({
    ...options,
    enableTrafficMonitor: options.enableTrafficMonitor !== false,
  });
  let app = null;
  let httpHandle = null;
  let cdpInjector = null;

  if (process.env.ANTIGRAVITY_SIDECAR_WEB_PORT && !options.standalonePort) {
    const { SidecarApp, Response } = await import('sidecar_sdk');
    app = new SidecarApp();

    app.page('/', () => new Response(loadWebAsset('index.html'), { contentType: 'text/html; charset=utf-8' }));
    app.page('/styles.css', () => new Response(loadWebAsset('styles.css'), { contentType: 'text/css; charset=utf-8' }));
    app.page('/app.js', () => new Response(loadWebAsset('app.js'), { contentType: 'application/javascript; charset=utf-8' }));

    app.api(
      '/api/ledger',
      async (data) => collector.getLedgerSnapshot({ force: data?.force === '1' }),
      'GET'
    );
    app.api(
      '/api/prefs',
      async (data) => {
        collector.updatePrefs(data || {});
        return collector.getLedgerSnapshot({ force: false });
      },
      'POST'
    );

    await app.run();
  } else if (options.standalonePort !== undefined) {
    httpHandle = await createStandaloneServer(collector, {
      port: Number(options.standalonePort),
      host: options.host || '127.0.0.1',
    });
  }

  const shouldEnableCdp =
    options.enableCdp !== false &&
    Boolean(process.env.ANTIGRAVITY_LS_ADDRESS || process.env.ANTIGRAVITY_SIDECAR_WEB_PORT || options.enableCdp === true);

  if (shouldEnableCdp) {
    cdpInjector = startCdpModalInjector(collector, {
      onSuperseded: () => {
        cdpInjector?.stop();
        collector.close();
        process.exit(0);
      },
    });
  }

  return {
    collector,
    app,
    httpHandle,
    cdpInjector,
    async close() {
      cdpInjector?.stop();
      collector.close();
      await app?.close?.();
      if (httpHandle?.server) {
        await new Promise((res) => httpHandle.server.close(() => res()));
      }
    },
  };
}

const isMainModule =
  Boolean(process.argv[1]) &&
  (() => {
    try {
      return realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
    } catch {
      return false;
    }
  })();

if (isMainModule) {
  let standalonePort;
  const idx = process.argv.indexOf('--standalone-port');
  if (idx >= 0 && process.argv[idx + 1] !== undefined) {
    standalonePort = Number(process.argv[idx + 1]);
  }

  const runtime = await startLedgerServer({
    standalonePort,
    enableCdp: standalonePort === undefined,
  });

  if (runtime.httpHandle?.address) {
    console.log(`[agy-ledger] standalone server listening on http://127.0.0.1:${runtime.httpHandle.address.port}`);
  }

  if (standalonePort === undefined) {
    startSelfReloadWatcher(() => {
      runtime.close().finally(() => process.exit(0));
    });
  }

  const shutdown = () => {
    runtime.close().finally(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
