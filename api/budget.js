import { checkBudget, MONTHLY_BUDGET_USD } from './_budget.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { allowed, spend } = await checkBudget();
  return res.status(200).json({
    monthly_budget_usd: MONTHLY_BUDGET_USD,
    spend_usd: spend !== null ? Math.round(spend * 10000) / 10000 : null,
    remaining_usd: spend !== null ? Math.round((MONTHLY_BUDGET_USD - spend) * 10000) / 10000 : null,
    allowed,
  });
}
