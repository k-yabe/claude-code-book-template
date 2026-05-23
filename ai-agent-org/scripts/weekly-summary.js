#!/usr/bin/env node
/**
 * Weekly Summary
 * 過去7日間のタスク完了状況をまとめた週次レポートを生成する。
 * launchd または手動で毎週月曜朝に実行することを想定。
 *
 * Usage:
 *   node scripts/weekly-summary.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk');

const ROOT = path.join(__dirname, '..');
const TASKS_FILE = path.join(ROOT, 'tasks', 'tasks.json');
const HANDOFFS_DIR = path.join(ROOT, 'context', 'context', 'ai-handoffs');
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 最新のtasks.jsonを取得
try {
  execSync('git fetch origin main', { cwd: ROOT });
  execSync('git checkout origin/main -- tasks/tasks.json', { cwd: ROOT });
} catch (err) {
  console.warn('git fetch 失敗（続行）:', err.message);
}

const data = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
const tasks = data.tasks || [];
const now = new Date();
const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

// 過去7日間に更新されたタスク
const recentDone = tasks.filter(t =>
  t.status === 'done' && new Date(t.updatedAt) >= weekAgo
);
const recentBlocked = tasks.filter(t =>
  t.status === 'blocked' && new Date(t.updatedAt) >= weekAgo
);
const newTasks = tasks.filter(t =>
  new Date(t.createdAt) >= weekAgo
);
const stillPending = tasks.filter(t =>
  t.status === 'new-assigned' || t.status === 'in-progress'
);

// エージェント別完了数
const agentCount = {};
recentDone.forEach(t => { agentCount[t.assignee] = (agentCount[t.assignee]||0) + 1; });
const topAgents = Object.entries(agentCount).sort((a,b)=>b[1]-a[1]).slice(0,5);

// AIによる週次サマリー生成
async function generateWeeklySummary() {
  const context = `
## 今週の実績（過去7日間）
- 完了タスク: ${recentDone.length}件
- 新規タスク: ${newTasks.length}件
- ブロック発生: ${recentBlocked.length}件
- 未着手・進行中: ${stillPending.length}件

## 完了タスク一覧
${recentDone.map(t => `- [${t.id}] ${t.title}（担当: ${t.assignee}）`).join('\n') || '（なし）'}

## ブロック中タスク
${recentBlocked.map(t => `- [${t.id}] ${t.title}: ${t.blockedReason||'理由未記載'}`).join('\n') || '（なし）'}

## 活躍エージェントTOP
${topAgents.map(([a, n]) => `- ${a}: ${n}件完了`).join('\n') || '（なし）'}
  `.trim();

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `以下のデータをもとに、チームへの週次レポートを日本語で作成してください。
トーン: 週次ミーティングの冒頭報告のような、簡潔で前向きな文体。
構成: ①今週のハイライト（1〜2文）②完了・成果のポイント（箇条書き3〜5点）③来週に向けた課題・懸念（あれば）
全体で20行以内。

${context}`
    }]
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}

(async () => {
  console.log(`\n📊 週次サマリー生成 — ${now.toLocaleString('ja-JP')}\n`);
  console.log(`完了: ${recentDone.length}件 / 新規: ${newTasks.length}件 / ブロック: ${recentBlocked.length}件`);

  const summary = await generateWeeklySummary();
  console.log('\n' + summary);

  // レポートファイル保存
  const dateStr = now.toISOString().split('T')[0];
  const reportPath = path.join(HANDOFFS_DIR, `weekly-summary-${dateStr}.md`);
  const content = [
    `# 週次サマリー ${dateStr}`,
    '',
    `- 対象期間: ${weekAgo.toISOString().split('T')[0]} 〜 ${dateStr}`,
    `- 完了: ${recentDone.length}件 / 新規: ${newTasks.length}件 / ブロック: ${recentBlocked.length}件 / 未対応: ${stillPending.length}件`,
    '',
    summary,
    '',
    '## 完了タスク詳細',
    '',
    ...recentDone.map(t => `- [${t.id}] ${t.title}（${t.assignee}）`),
    '',
    '---',
    '_by weekly-summary.js_',
  ].join('\n');

  fs.mkdirSync(HANDOFFS_DIR, { recursive: true });
  fs.writeFileSync(reportPath, content, 'utf-8');
  console.log(`\n📄 レポート保存: ${reportPath}`);

  // Slack通知
  if (SLACK_WEBHOOK) {
    const slackText = `📊 *週次サマリー ${dateStr}*\n完了: ${recentDone.length}件 / 新規: ${newTasks.length}件 / ブロック: ${recentBlocked.length}件\n\n${summary.slice(0, 500)}`;
    try {
      await fetch(SLACK_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: slackText }),
      });
      console.log('✓ Slack通知送信');
    } catch (e) {
      console.warn('Slack通知失敗:', e.message);
    }
  }

  // GitHubへpush
  try {
    execSync(`git add "${reportPath}"`, { cwd: ROOT });
    execSync(`git commit -m "bot: 週次サマリー ${dateStr}"`, { cwd: ROOT });
    try {
      execSync('git push', { cwd: ROOT });
    } catch {
      execSync('git fetch origin main', { cwd: ROOT });
      execSync('git rebase origin/main', { cwd: ROOT });
      execSync('git push', { cwd: ROOT });
    }
    console.log('✓ GitHubへのプッシュ完了');
  } catch (err) {
    if (!err.message.includes('nothing to commit')) {
      console.error('git push 失敗:', err.message);
    }
  }
})();
