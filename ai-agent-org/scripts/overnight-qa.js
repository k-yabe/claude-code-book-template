#!/usr/bin/env node
/**
 * Overnight QA Runner
 * Runs quality checks on context engine integrity and task board data.
 * Designed to run unattended (e.g., via cron at 2:00 AM).
 *
 * Usage:
 *   node scripts/overnight-qa.js
 *   node scripts/overnight-qa.js --verbose
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TASKS_FILE = path.join(ROOT, 'tasks', 'tasks.json');
const CONTEXT_DIR = path.join(ROOT, 'context', 'context');
const HANDOFFS_DIR = path.join(ROOT, 'context', 'context', 'ai-handoffs');
const AGENTS_DIR = path.join(ROOT, 'agents');

const VERBOSE = process.argv.includes('--verbose');

const results = { passed: [], failed: [], warnings: [] };

function pass(msg) {
  results.passed.push(msg);
  if (VERBOSE) console.log(`✅ ${msg}`);
}

function fail(msg) {
  results.failed.push(msg);
  console.error(`❌ ${msg}`);
}

function warn(msg) {
  results.warnings.push(msg);
  if (VERBOSE) console.warn(`⚠️  ${msg}`);
}

// --- Checks ---

function checkTasksJson() {
  if (!fs.existsSync(TASKS_FILE)) {
    fail('tasks/tasks.json が存在しない');
    return;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
    pass('tasks.json: JSON解析OK');
  } catch (e) {
    fail(`tasks.json: JSON解析エラー — ${e.message}`);
    return;
  }

  if (!Array.isArray(data.tasks)) {
    fail('tasks.json: tasks配列が存在しない');
    return;
  }
  pass(`tasks.json: ${data.tasks.length}件のタスク`);

  const validStatuses = ['new-assigned', 'in-progress', 'blocked', 'done'];
  const validPriorities = ['P0', 'P1', 'P2', 'P3'];
  const validTeams = ['engineering', 'content', 'business', 'infrastructure'];
  const ids = new Set();

  for (const task of data.tasks) {
    if (!task.id) { fail(`タスクにIDがない: ${JSON.stringify(task).slice(0, 50)}`); continue; }
    if (ids.has(task.id)) { fail(`重複タスクID: ${task.id}`); }
    ids.add(task.id);

    if (!validStatuses.includes(task.status)) warn(`${task.id}: 不正なstatus "${task.status}"`);
    if (!validPriorities.includes(task.priority)) warn(`${task.id}: 不正なpriority "${task.priority}"`);
    if (!validTeams.includes(task.team)) warn(`${task.id}: 不正なteam "${task.team}"`);
    if (!task.title) fail(`${task.id}: titleが空`);

    if (task.status === 'blocked' && !task.blockedReason) {
      warn(`${task.id}: blockedなのにblockedReasonが空`);
    }

    if (task.status === 'in-progress') {
      const updatedAt = new Date(task.updatedAt);
      const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 7) {
        warn(`${task.id}: in-progressのまま${Math.floor(daysSinceUpdate)}日経過 — スタック？`);
      }
    }
  }

  const p0 = data.tasks.filter(t => t.priority === 'P0' && t.status !== 'done');
  if (p0.length > 0) {
    warn(`P0タスクが${p0.length}件未完了: ${p0.map(t => t.id).join(', ')}`);
  }
}

function checkContextEngine() {
  const required = [
    'philosophy.md',
    'professional-identity.md',
    'technical-setup.md',
    'visual-design.md',
  ];

  for (const file of required) {
    const filePath = path.join(CONTEXT_DIR, file);
    if (fs.existsSync(filePath)) {
      const size = fs.statSync(filePath).size;
      if (size < 100) {
        warn(`context/${file}: ファイルが小さすぎる (${size}bytes) — 未記入？`);
      } else {
        pass(`context/${file}: OK`);
      }
    } else {
      fail(`context/${file}: 存在しない`);
    }
  }

  if (!fs.existsSync(HANDOFFS_DIR)) {
    fail('context/ai-handoffs/ ディレクトリが存在しない');
  } else {
    pass('context/ai-handoffs/: OK');
  }
}

function checkAgentConfigs() {
  const expectedAgents = [
    'engineering/tech-lead.md',
    'engineering/qa-engineer.md',
    'content/content-director.md',
    'infrastructure/task-dispatcher.md',
  ];

  for (const agent of expectedAgents) {
    const filePath = path.join(AGENTS_DIR, agent);
    if (fs.existsSync(filePath)) {
      pass(`agents/${agent}: OK`);
    } else {
      warn(`agents/${agent}: 存在しない — エージェント設定未整備`);
    }
  }
}

function checkInbox() {
  const inboxDir = path.join(ROOT, 'context', 'inbox');
  if (!fs.existsSync(inboxDir)) { warn('context/inbox/ が存在しない'); return; }

  const files = fs.readdirSync(inboxDir).filter(f => f.endsWith('.md'));
  if (files.length > 10) {
    warn(`inbox/ に${files.length}件の未処理ファイル — タスクディスパッチャーを実行してください`);
  } else if (files.length > 0) {
    warn(`inbox/ に${files.length}件の未処理ファイル`);
  } else {
    pass('inbox/: 未処理ファイルなし');
  }
}

// --- Run all checks ---

console.log(`\n🌙 夜間QA実行 — ${new Date().toLocaleString('ja-JP')}\n`);

checkTasksJson();
checkContextEngine();
checkAgentConfigs();
checkInbox();

// --- Report ---

const now = new Date();
const dateStr = now.toISOString().split('T')[0];
const reportPath = path.join(HANDOFFS_DIR, `overnight-qa-${dateStr}.md`);

const reportLines = [
  `# 夜間QAレポート ${dateStr}`,
  '',
  `- 実行日時: ${now.toLocaleString('ja-JP')}`,
  `- 合格: ${results.passed.length} / 警告: ${results.warnings.length} / 失敗: ${results.failed.length}`,
  '',
];

if (results.failed.length > 0) {
  reportLines.push('## ❌ 失敗（要対応）', '', ...results.failed.map(m => `- ${m}`), '');
}
if (results.warnings.length > 0) {
  reportLines.push('## ⚠️ 警告', '', ...results.warnings.map(m => `- ${m}`), '');
}
if (results.passed.length > 0) {
  reportLines.push('## ✅ 合格', '', ...results.passed.map(m => `- ${m}`), '');
}
reportLines.push('---', `_by overnight-qa.js_`);

if (fs.existsSync(HANDOFFS_DIR)) {
  fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf-8');
}

console.log(`\n結果: ✅${results.passed.length} ⚠️${results.warnings.length} ❌${results.failed.length}`);
if (results.failed.length > 0) {
  console.error('要対応の問題があります。朝会レポートを確認してください。');
  process.exit(1);
}
