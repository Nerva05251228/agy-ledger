---
name: token-ledger
description: Query local Antigravity token consumption, billing, cache savings, and AGY network traffic, open the Token Ledger dashboard, or set up Windows proxy traffic collection. Use when the user asks about AGY network traffic, proxy controller setup, token usage, billing, or top models and conversations.
---

# Token Ledger

Use this skill when the user wants to inspect their token consumption, daily/monthly calendar stats, equivalent USD API billing statement, AGY network traffic (daily & total), or open the visual dashboard.

## Open the Visual Dashboard

When the `agy-ledger` plugin is enabled and running, offer the Aux Pane pill so the user can open the interactive calendar dashboard in one click:

```markdown
[Token Ledger](sidecar://agy-ledger/ledger/)
```

Users can also toggle the main-window modal anytime with `Alt+L` or by clicking the inline composer-footer capsule.

## Set up Windows proxy traffic

1. Start with automatic detection. Open the Token Ledger settings and look for active AGY proxy traffic. In the Traffic detail, verify the detected controller port and check for AGY connections while Antigravity is generating traffic.
2. If the plugin cannot find the correct controller, inspect the active proxy core's local configuration for `external-controller` (Mihomo/Clash) or `experimental.clash_api.external_controller` (sing-box). If a generated config is unavailable, use the running core's PID and its local TCP listeners to identify candidates. Verify `GET /version` and `GET /connections` on `127.0.0.1`. The latter needs per-connection byte counters and process information. A system proxy or mixed/SOCKS port such as `10808` is separate from the controller. With TUN, check that the same controller sees the originating AGY process.
3. Enter the verified port in **Token Ledger → Settings → Controller port** and save it for the user. With filesystem access, the agent can set the numeric `proxyControllerPort` key in the running sidecar data directory's `ui-prefs.json`, preserving all existing keys. Use the sidecar's `ANTIGRAVITY_EXECUTABLE_DATA_DIR` when available. A typical desktop path is `~/.gemini/antigravity/sidecar_data/agy-ledger/ledger/data`. Set the key to `null` to restore auto-detection. The plugin picks up either change without restarting the proxy.
4. Verify the dashboard now reports an active backend and records an increase when AGY sends traffic. If the API requires authentication, use an existing local secret via the sidecar environment variable `AGY_LEDGER_PROXY_TOKEN` with the explicit port. Keep the secret out of chat and preferences. When the API is disabled or lacks process data, report the missing prerequisite and let the user choose any proxy configuration changes.

## Querying Exact Numbers in Chat

Run the collector CLI from the plugin directory to get a live JSON summary (reads local Antigravity SQLite databases in read-only mode and merges the saved traffic totals):

```bash
node --no-warnings "$HOME/.gemini/config/plugins/agy-ledger/sidecars/ledger/collector.mjs" --summary
```

Optional flags:
- `--days 14` — include the last N active days in the summary output (default: 7).
- `--month YYYY-MM` — include detailed model & top conversation breakdown for a specific month.
- `--date YYYY-MM-DD` — include detailed breakdown for a specific local date.

Present numbers clearly with:
1. Equivalent USD API bill (`costUsd`) and Prompt Cache savings (`savedUsd`, cache hit rate %).
2. Total tokens including cache (`grossTokens`) and AGY network traffic (`trafficBytes`, upload/download split) when recorded.
3. Per-model and top-conversation breakdown when relevant.
