// Upstash Redis REST API を fetch で直接呼ぶ（@vercel/kv 不要）
// 必要な環境変数: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
// どちらも未設定の場合は fail-open（サービスを止めない）

export const MONTHLY_BUDGET_USD = 5.00;
const HARD_LIMIT_USD = 4.80; // $0.20 バッファ

const MODEL_COSTS = {
  'claude-haiku-4-5-20251001': { input: 0.80e-6, output: 4.00e-6, cacheWrite: 1.00e-6, cacheRead: 0.08e-6 },
  'claude-sonnet-4-6':         { input: 3.00e-6, output: 15.00e-6, cacheWrite: 3.75e-6, cacheRead: 0.30e-6 },
  'claude-opus-4-6':           { input: 15.00e-6, output: 75.00e-6, cacheWrite: 18.75e-6, cacheRead: 1.50e-6 },
};

function monthKey() {
  const d = new Date();
  return `anthropic_spend:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function upstashHeaders() {
  return { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` };
}

async function kvGet(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  if (!url) return null;
  const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, { headers: upstashHeaders() });
  const { result } = await r.json();
  return result;
}

async function kvIncrByFloat(key, value) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  if (!url) return;
  await fetch(`${url}/incrbyfloat/${encodeURIComponent(key)}/${value}`, { headers: upstashHeaders() });
}

async function kvExpire(key, seconds) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  if (!url) return;
  await fetch(`${url}/expire/${encodeURIComponent(key)}/${seconds}`, { headers: upstashHeaders() });
}

export function calcCost(model, usage = {}) {
  const c = MODEL_COSTS[model] || MODEL_COSTS['claude-sonnet-4-6'];
  const {
    input_tokens = 0,
    output_tokens = 0,
    cache_creation_input_tokens = 0,
    cache_read_input_tokens = 0,
  } = usage;
  return (
    input_tokens * c.input +
    output_tokens * c.output +
    cache_creation_input_tokens * c.cacheWrite +
    cache_read_input_tokens * c.cacheRead
  );
}

export async function checkBudget() {
  try {
    const raw = await kvGet(monthKey());
    const spend = parseFloat(raw || 0);
    if (spend >= HARD_LIMIT_USD) {
      return { allowed: false, spend };
    }
    return { allowed: true, spend };
  } catch {
    return { allowed: true, spend: null };
  }
}

export async function recordCost(model, usage) {
  try {
    const cost = calcCost(model, usage);
    if (cost <= 0) return;
    const key = monthKey();
    await kvIncrByFloat(key, cost);
    await kvExpire(key, 40 * 24 * 3600);
  } catch {
    // best-effort
  }
}

export function estimateWorstCaseCost(model, maxTokens, estimatedInputTokens = 2000) {
  return calcCost(model, {
    input_tokens: estimatedInputTokens,
    output_tokens: maxTokens,
  });
}
