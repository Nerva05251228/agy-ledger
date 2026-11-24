/**
 * Model normalization and equivalent API billing engine for agy-ledger.
 *
 * Uses 2026-11 standard API list pricing ($ / 1M tokens).
 * Strictly avoids blue/purple color identifiers; every model family uses
 * botanical, terracotta, ochre, olive, umber, or warm stone slots.
 */

export const MODEL_TIERS = [
  {
    id: 'gemini-4-neon',
    label: 'Gemini 4 Neon',
    shortLabel: 'G4 Neon',
    color: 'terracotta',
    inRate: 3.0,
    inLong: 3.0,
    cacheRate: 0.15,
    cacheLong: 0.15,
    outRate: 15.0,
    outLong: 15.0,
    note: 'Balanced frontier reasoning model (1M context)',
  },
  {
    id: 'gemini-4-carbon',
    label: 'Gemini 4 Carbon',
    shortLabel: 'G4 Carbon',
    color: 'olive',
    inRate: 4.0,
    inLong: 4.0,
    cacheRate: 0.2,
    cacheLong: 0.2,
    outRate: 20.0,
    outLong: 20.0,
    note: 'Heavyweight deep reasoning & planning (1M context)',
  },
  {
    id: 'gemini-orchestrator',
    label: 'Orchestrator (Carbon)',
    shortLabel: 'Orchestrator',
    color: 'terracotta',
    inRate: 4.0,
    inLong: 4.0,
    cacheRate: 0.2,
    cacheLong: 0.2,
    outRate: 20.0,
    outLong: 20.0,
    note: 'Agentic planner & orchestrator',
  },
  {
    id: 'gemini-4-argon',
    label: 'Gemini 4 Argon',
    shortLabel: 'G4 Argon',
    color: 'forest',
    inRate: 4.0,
    inLong: 4.0,
    cacheRate: 0.2,
    cacheLong: 0.2,
    outRate: 20.0,
    outLong: 20.0,
    note: 'Workhorse coding & execution (1M context)',
  },
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen',
    shortLabel: 'G4 Hydrogen',
    color: 'forest',
    inRate: 1.5,
    inLong: 1.5,
    cacheRate: 0.075,
    cacheLong: 0.075,
    outRate: 7.5,
    outLong: 7.5,
    note: 'Fast everyday agentic execution (1M context)',
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    shortLabel: 'G3.8 Flash',
    color: 'ochre',
    inRate: 1.5,
    inLong: 1.5,
    cacheRate: 0.15,
    cacheLong: 0.15,
    outRate: 7.5,
    outLong: 7.5,
    note: 'Fast subagent & lightweight tasks',
  },
  {
    id: 'claude-opus-5.5',
    label: 'Claude Opus 5.5',
    shortLabel: 'Opus 5.5',
    color: 'umber',
    inRate: 4.0,
    inLong: 4.0,
    cacheRate: 0.2,
    cacheLong: 0.2,
    outRate: 20.0,
    outLong: 20.0,
    note: 'Anthropic flagship thinking model (1M context)',
  },
  {
    id: 'claude-sonnet-5.5',
    label: 'Claude Sonnet 5.5',
    shortLabel: 'Sonnet 5.5',
    color: 'umber',
    inRate: 2.0,
    inLong: 2.0,
    cacheRate: 0.1,
    cacheLong: 0.1,
    outRate: 10.0,
    outLong: 10.0,
    note: 'Anthropic balanced thinking model (1M context)',
  },
  {
    id: 'claude-opus-4.6',
    label: 'Claude Opus 4.6',
    shortLabel: 'Opus 4.6',
    color: 'umber',
    inRate: 5.0,
    inLong: 5.0,
    cacheRate: 0.5,
    cacheLong: 0.5,
    outRate: 25.0,
    outLong: 25.0,
    note: 'Anthropic legacy flagship model',
  },
  {
    id: 'claude-sonnet-4.6',
    label: 'Claude Sonnet 4.6',
    shortLabel: 'Sonnet 4.6',
    color: 'umber',
    inRate: 3.0,
    inLong: 3.0,
    cacheRate: 0.3,
    cacheLong: 0.3,
    outRate: 15.0,
    outLong: 15.0,
    note: 'Anthropic legacy balanced model',
  },
  {
    id: 'other-model',
    label: 'Standard Model',
    shortLabel: 'Standard',
    color: 'stone',
    inRate: 1.0,
    inLong: 2.0,
    cacheRate: 0.1,
    cacheLong: 0.2,
    outRate: 4.0,
    outLong: 6.0,
    note: 'Open / auxiliary fallback tier',
  },
];

const TIER_BY_ID = new Map(MODEL_TIERS.map((t) => [t.id, t]));

const ENUM_TO_ID = new Map([
  // Gemini 4 Neon
  [1535, 'gemini-4-neon'],
  [1536, 'gemini-4-neon'],
  [1537, 'gemini-4-neon'],
  [1538, 'gemini-4-neon'],
  // Gemini 4 Hydrogen
  [1525, 'gemini-4-hydrogen'],
  [1526, 'gemini-4-hydrogen'],
  [1527, 'gemini-4-hydrogen'],
  [1528, 'gemini-4-hydrogen'],
  [1530, 'gemini-4-hydrogen'],
  // Orchestrator
  [1667, 'gemini-orchestrator'],
  [1681, 'gemini-orchestrator'],
  // Gemini 4 Carbon
  [1427, 'gemini-4-carbon'],
  [1437, 'gemini-4-carbon'],
  [1438, 'gemini-4-carbon'],
  // Gemini 4 Argon
  [326, 'gemini-4-argon'],
  [1417, 'gemini-4-argon'],
  [1418, 'gemini-4-argon'],
  [1419, 'gemini-4-argon'],
  // Gemini 3.8 Flash & Flash workers
  [1318, 'gemini-3.8-flash'],
  [1319, 'gemini-3.8-flash'],
  [1320, 'gemini-3.8-flash'],
  [1669, 'gemini-3.8-flash'],
  // Claude Opus (5.5 vs legacy 4.6)
  [1401, 'claude-opus-5.5'],
  [1026, 'claude-opus-4.6'],
  // Claude Sonnet (5.5 vs legacy 4.6)
  [1404, 'claude-sonnet-5.5'],
  [1035, 'claude-sonnet-4.6'],
]);

function cleanDisplayLabel(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/\s*\((?:minimal|low|medium|high|xhigh|max|auto|thinking|extended thinking)\)\s*$/i, '')
    .trim();
}

function matchTierByString(text) {
  const s = String(text || '').toLowerCase();
  if (!s) return null;
  if (s.includes('neon')) return TIER_BY_ID.get('gemini-4-neon');
  if (s.includes('hydrogen')) return TIER_BY_ID.get('gemini-4-hydrogen');
  if (s.includes('orchestrator')) return TIER_BY_ID.get('gemini-orchestrator');
  if (s.includes('carbon')) return TIER_BY_ID.get('gemini-4-carbon');
  if (s.includes('argon')) return TIER_BY_ID.get('gemini-4-argon');
  if (s.includes('flash')) return TIER_BY_ID.get('gemini-3.8-flash');
  if (s.includes('opus')) {
    if (/opus[-_\s]*4[.\-_]?[56]/i.test(s)) return TIER_BY_ID.get('claude-opus-4.6');
    return TIER_BY_ID.get('claude-opus-5.5');
  }
  if (s.includes('sonnet')) {
    if (/sonnet[-_\s]*4[.\-_]?[56]/i.test(s)) return TIER_BY_ID.get('claude-sonnet-4.6');
    return TIER_BY_ID.get('claude-sonnet-5.5');
  }
  if (s.includes('gpt-oss') || s.includes('openai')) return TIER_BY_ID.get('other-model');
  return null;
}

/**
 * Resolve normalized model tier & pricing spec from protobuf model string,
 * numeric model enum ID, and optional Language Server `clientModelConfigs`.
 */
export function resolveModelSpec(rawModelStr, enumId = 0, lsConfigs = []) {
  const numId = Number(enumId || 0);
  let lsLabel = '';

  if (numId >= 1000 && Array.isArray(lsConfigs) && lsConfigs.length > 0) {
    const placeholder = `MODEL_PLACEHOLDER_M${numId - 1000}`;
    const matched = lsConfigs.find(
      (c) => c?.modelOrAlias?.model === placeholder || c?.modelId === placeholder
    );
    if (matched?.label) {
      lsLabel = cleanDisplayLabel(matched.label);
    }
  }

  const byStr = matchTierByString(rawModelStr) || matchTierByString(lsLabel);
  if (byStr) {
    if (byStr.id === 'gemini-orchestrator') {
      const isArgon =
        numId === 1681 ||
        String(rawModelStr || '').toLowerCase().includes('argon') ||
        lsLabel.toLowerCase().includes('argon');
      return {
        ...byStr,
        label: isArgon ? 'Orchestrator (Argon)' : 'Orchestrator (Carbon)',
      };
    }
    return byStr;
  }

  const mappedId = ENUM_TO_ID.get(numId);
  if (mappedId && TIER_BY_ID.has(mappedId)) {
    const spec = TIER_BY_ID.get(mappedId);
    if (spec.id === 'gemini-orchestrator' && numId === 1681) {
      return { ...spec, label: 'Orchestrator (Argon)' };
    }
    return spec;
  }

  const fallbackTier = TIER_BY_ID.get('other-model');
  const cleaned = cleanDisplayLabel(lsLabel || rawModelStr);
  return {
    ...fallbackTier,
    label: cleaned || fallbackTier.label,
    shortLabel: cleaned || fallbackTier.shortLabel,
  };
}

/**
 * Calculate tier-aware equivalent API cost & Prompt Cache savings for a single turn.
 * Prompts exceeding 200K tokens switch to the long-context pricing tier when applicable.
 */
export function calculateTurnBilling({
  uncachedIn = 0,
  cachedIn = 0,
  thinkingOut = 0,
  responseOut = 0,
  spec,
}) {
  const tier = spec || TIER_BY_ID.get('other-model');
  const uIn = Math.max(0, Number(uncachedIn || 0));
  const cIn = Math.max(0, Number(cachedIn || 0));
  const thk = Math.max(0, Number(thinkingOut || 0));
  const rsp = Math.max(0, Number(responseOut || 0));

  const promptTokens = uIn + cIn;
  const isLong = promptTokens > 200_000;

  const inR = isLong ? tier.inLong : tier.inRate;
  const cacheR = isLong ? tier.cacheLong : tier.cacheRate;
  const outR = isLong ? tier.outLong : tier.outRate;

  const totalOut = thk + rsp;
  const costIn = (uIn * inR) / 1_000_000;
  const costCache = (cIn * cacheR) / 1_000_000;
  const costThink = (thk * outR) / 1_000_000;
  const costResp = (rsp * outR) / 1_000_000;
  const costUsd = costIn + costCache + costThink + costResp;

  const noCacheCostUsd = (promptTokens * inR + totalOut * outR) / 1_000_000;
  const savedUsd = Math.max(0, noCacheCostUsd - costUsd);

  return {
    isLongContext: isLong,
    costUsd,
    savedUsd,
    costIn,
    costCache,
    costThink,
    costResp,
  };
}

export function getRateCard() {
  return MODEL_TIERS.map((t) => ({ ...t }));
}
