---
name: token-ledger
description: Query local Antigravity token consumption, daily calendar usage, Prompt Cache savings, and equivalent API billing statements, or open the Token Ledger visual dashboard in the auxiliary pane. Use when the user asks about their token usage, API cost equivalent, daily/monthly spend, cache hit savings, or top token-consuming models/conversations.
---

# Token Ledger

Use this skill when the user wants to inspect their token consumption, daily/monthly calendar stats, equivalent API billing statement, or open the visual dashboard.

## Open the Visual Dashboard

When the `agy-ledger` plugin is enabled and running, offer the Aux Pane pill so the user can open the interactive calendar dashboard in one click:

```markdown
[Token Ledger](sidecar://agy-ledger/ledger/)
```

Users can also toggle the main-window modal anytime with `Alt+L` or by clicking the inline composer-footer capsule.

## Querying Exact Numbers in Chat

Run the collector CLI from the plugin directory to get a live JSON summary (reads local Antigravity SQLite databases in read-only mode):

```bash
node --no-warnings "$HOME/.gemini/config/plugins/agy-ledger/sidecars/ledger/collector.mjs" --summary
```

Optional flags:
- `--days 14` — include the last N active days in the summary output (default: 7).
- `--month YYYY-MM` — include detailed model & top conversation breakdown for a specific month.
- `--date YYYY-MM-DD` — include detailed breakdown for a specific local date.

Present numbers clearly with:
1. Equivalent API bill (`costUsd` / CNY) and Prompt Cache savings (`savedUsd`, cache hit rate %).
2. All tokens (incl. cache reads) vs. uncached + output tokens.
3. Per-model and top-conversation breakdown when relevant.
