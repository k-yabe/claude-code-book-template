#!/usr/bin/env node
/**
 * Task Executor
 * 未着手（new-assigned）タスクをAIが処理し、結果をコメントとして書き込む。
 * tasks.json を更新後、GitHub にプッシュする。
 *
 * Usage:
 *   node scripts/task-executor.js
 *   node scripts/task-executor.js --dry-run   # 実際には書き込まない
 *   node scripts/task-executor.js --limit 1   # 1件だけ処理
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk');

const ROOT = path.join(__dirname, '..');
const TASKS_FILE = path.join(ROOT, 'tasks', 'tasks.json');
const CONTEXT_DIR = path.join(ROOT, 'context', 'context');
const PROJECTS_DIR = path.join(ROOT, 'context', 'projects');
const HANDOFFS_DIR = path.join(CONTEXT_DIR, 'ai-handoffs');

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (() => {
  const idx = process.argv.indexOf('--limit');
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : 3;
})();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// エージェントごとのモデル（コスト節約：基本Haiku、重要判断のみSonnet）
const AGENT_MODELS = {
  'tech-lead': 'claude-haiku-4-5-20251001',
  'frontend-engineer': 'claude-haiku-4-5-20251001',
  'backend-engineer': 'claude-haiku-4-5-20251001',
  'qa-engineer': 'claude-haiku-4-5-20251001',
  'content-director': 'claude-haiku-4-5-20251001',
  'brand-voice': 'claude-haiku-4-5-20251001',
  'root-cause': 'claude-haiku-4-5-20251001',
  'anti-ai-slop': 'claude-haiku-4-5-20251001',
  'marketing-director': 'claude-haiku-4-5-20251001',
  'business-strategist': 'claude-sonnet-4-6', // 戦略判断のみSonnet
  'partnership-manager': 'claude-haiku-4-5-20251001',
  'legal-review': 'claude-haiku-4-5-20251001',
  'task-dispatcher': 'claude-haiku-4-5-20251001',
};

function loadTasks() {
  return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
}

function saveTasks(data) {
  if (DRY_RUN) return;
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function loadContextFile(filename) {
  const p = path.join(CONTEXT_DIR, filename);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
}

function buildSystemPrompt(task) {
  const identity = loadContextFile('professional-identity.md');
  const philosophy = loadContextFile('philosophy.md');
  const designGuide = loadContextFile('visual-design.md');

  const agentDescriptions = {
    'content-director': 'あなたはコンテンツディレクターのAIエージェントです。記事・動画台本・LP・メール文・SNS投稿などのコンテンツを制作します。',
    'marketing-director': 'あなたはマーケティングディレクターのAIエージェントです。マーケティング戦略・施策・コピーを考えます。',
    'business-strategist': 'あなたはビジネスストラテジストのAIエージェントです。事業戦略・意思決定の分析を行います。',
    'tech-lead': 'あなたはテックリードのAIエージェントです。技術的な設計・実装方針・コードレビューを担当します。',
    'frontend-engineer': 'あなたはフロントエンドエンジニアのAIエージェントです。UI/HTML/CSS/JSの実装を担当します。',
    'backend-engineer': 'あなたはバックエンドエンジニアのAIエージェントです。API/DB/インフラの設計・実装を担当します。',
    'qa-engineer': 'あなたはQAエンジニアのAIエージェントです。品質チェック・テスト・検証を担当します。',
    'legal-review': 'あなたはリーガルレビュー担当のAIエージェントです。契約書・規約の確認を担当します。',
    'partnership-manager': 'あなたはパートナーシップマネージャーのAIエージェントです。案件・提携の管理を担当します。',
    'brand-voice': 'あなたはブランドボイス担当のAIエージェントです。ブランドのトーン・言葉遣いのチェックを担当します。',
  };

  const agentDesc = agentDescriptions[task.assignee] || 'あなたはAIエージェントです。';

  return `${agentDesc}

## クライアントのプロフィール
${identity}

## 組織の哲学
${philosophy}

## デザインガイドライン（UI関連タスクの場合）
${designGuide}

## 行動指針
- アウトプットを早く出すことを優先する
- クライアントが喜ぶ実用的な成果物を作る
- 曖昧な部分は合理的なデフォルトで判断して進める
- 日本語で回答する
`;
}

// Web検索が有用なエージェント（調査・リサーチ系）
const WEB_SEARCH_AGENTS = new Set([
  'content-director',
  'marketing-director',
  'business-strategist',
  'tech-lead',
  'legal-review',
]);

async function processTask(task) {
  const model = AGENT_MODELS[task.assignee] || 'claude-sonnet-4-6';
  const systemPrompt = buildSystemPrompt(task);
  const useWebSearch = WEB_SEARCH_AGENTS.has(task.assignee);

  const userMessage = `以下のタスクを実行してください。

## タスクID: ${task.id}
## タイトル: ${task.title}
## 優先度: ${task.priority}
## チーム: ${task.team}
## 組織: ${task.organization}

## タスクの詳細:
${task.description}

${task.comments && task.comments.length > 0 ? `## これまでのコメント:\n${task.comments.map(c => `[${c.author}] ${c.content}`).join('\n')}` : ''}

タスクを実行し、成果物または実行結果を日本語でまとめてください。
成果物がある場合（文章・コード・資料など）は全文を出力してください。
判断が必要で人間の確認が必要な場合は、その旨と理由を明記してください。
${useWebSearch ? '\n最新情報が必要な場合は積極的にweb_searchツールを使って検索してください。' : ''}`;

  console.log(`\n処理中: ${task.id} "${task.title}" → ${task.assignee} (${model})${useWebSearch ? ' [Web検索有効]' : ''}`);

  const tools = useWebSearch ? [{ type: 'web_search_20260209', name: 'web_search', allowed_callers: ['direct'] }] : undefined;
  const betas = useWebSearch ? ['web-search-2025-03-05'] : undefined;

  const messages = [{ role: 'user', content: userMessage }];
  let result = '';

  // tool_use ループ（Web検索が発生する場合に対応）
  for (let i = 0; i < 10; i++) {
    const reqParams = {
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      ...(tools ? { tools } : {}),
    };

    const response = await (betas
      ? client.beta.messages.create({ ...reqParams, betas })
      : client.messages.create(reqParams));

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') {
      const textBlocks = response.content.filter(b => b.type === 'text');
      result = textBlocks.map(b => b.text).join('\n\n');
      break;
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      console.log(`  → tool_use: ${toolUseBlocks.map(b => b.name).join(', ')} (ターン${i + 1})`);
      const hasWebSearch = toolUseBlocks.some(b => b.name === 'web_search');
      const hasServerResults = response.content.some(b => b.type === 'web_search_result');
      if (hasWebSearch) {
        // web_search はサーバーサイド実行: tool_result なしで次のターンへ
        if (!hasServerResults) {
          // 結果がまだない → assistantメッセージを追加して次のAPIコールで結果が来る
          // ただしAPIにはassistantメッセージで終わらせられないので空のuser messageを追加
          messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseBlocks[0].id, content: '検索を実行してください。' }] });
        }
        continue;
      }
      continue;
    }

    // その他の stop_reason (max_tokens など)
    const textBlocks = response.content.filter(b => b.type === 'text');
    result = textBlocks.map(b => b.text).join('\n\n');
    break;
  }

  // 人間の確認が必要かどうか判定
  const needsHuman = /人間の確認|判断が必要|承認が必要|確認をお願い|ブロック/.test(result);

  return { result, needsHuman };
}

function saveOutput(task, result) {
  if (DRY_RUN) return null;
  if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `${task.id}-${dateStr}-output.md`;
  const outputPath = path.join(PROJECTS_DIR, filename);
  const content = `# ${task.title}\n\n**タスクID:** ${task.id}  \n**実行日:** ${dateStr}  \n**担当:** ${task.assignee}\n\n---\n\n${result}\n`;
  fs.writeFileSync(outputPath, content, 'utf-8');
  return filename;
}

function gitPushChanges(taskIds) {
  if (DRY_RUN) return;
  try {
    execSync('git add tasks/tasks.json context/projects/', { cwd: ROOT });
    execSync(`git commit -m "bot: タスク自動実行 [${taskIds.join(', ')}]"`, { cwd: ROOT });
    execSync('git push', { cwd: ROOT });
    console.log('\n✓ GitHubへのプッシュ完了');
  } catch (err) {
    console.error('git push 失敗:', err.message);
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('エラー: ANTHROPIC_API_KEY が未設定です。');
    console.error('export ANTHROPIC_API_KEY="sk-ant-..." を実行してください。');
    process.exit(1);
  }

  // 最新のtasks.jsonを取得してから処理
  try {
    execSync('git pull --rebase', { cwd: ROOT });
    console.log('✓ GitHubから最新データを取得');
  } catch (err) {
    console.error('git pull 失敗（続行）:', err.message);
  }

  const data = loadTasks();
  const pending = data.tasks
    .filter(t => t.status === 'new-assigned' && t.assigneeType === 'ai')
    .sort((a, b) => a.priority.localeCompare(b.priority))
    .slice(0, LIMIT);

  if (pending.length === 0) {
    console.log('処理する未着手タスクはありません。');
    return;
  }

  console.log(`未着手タスク: ${pending.length}件（最大${LIMIT}件処理）`);
  if (DRY_RUN) console.log('--- dry-run モード ---');

  const processedIds = [];

  for (const task of pending) {
    try {
      const now = new Date().toISOString();

      // ステータスを in-progress に変更
      const taskRef = data.tasks.find(t => t.id === task.id);
      taskRef.status = 'in-progress';
      taskRef.updatedAt = now;
      taskRef.comments.push({ author: task.assignee, content: 'タスクを開始しました。', timestamp: now });
      saveTasks(data);

      // AI処理
      const { result, needsHuman } = await processTask(task);

      // 出力ファイルを保存
      const outputFile = saveOutput(task, result);

      // タスクを更新
      const snippet = result.length > 300 ? result.slice(0, 300) + '…（続きは projects/ フォルダを確認）' : result;
      const commentContent = outputFile
        ? `${snippet}\n\n📄 出力ファイル: context/projects/${outputFile}`
        : snippet;

      taskRef.status = needsHuman ? 'blocked' : 'done';
      taskRef.blockedReason = needsHuman ? '人間の確認・判断が必要です。上記コメントを確認してください。' : '';
      taskRef.updatedAt = new Date().toISOString();
      taskRef.comments.push({ author: task.assignee, content: commentContent, timestamp: new Date().toISOString() });

      saveTasks(data);
      processedIds.push(task.id);

      console.log(`✓ ${task.id}: ${needsHuman ? '→ blocked（要確認）' : '→ done'}`);

      if (DRY_RUN) {
        console.log('--- 出力プレビュー ---');
        console.log(result.slice(0, 500));
        console.log('---');
      }

    } catch (err) {
      console.error(`✗ ${task.id}: ${err.message}`);
      const taskRef = data.tasks.find(t => t.id === task.id);
      if (taskRef) {
        taskRef.status = 'blocked';
        taskRef.blockedReason = `実行エラー: ${err.message}`;
        taskRef.updatedAt = new Date().toISOString();
        saveTasks(data);
      }
    }
  }

  if (processedIds.length > 0) {
    gitPushChanges(processedIds);
  }

  console.log(`\n完了: ${processedIds.length}件処理しました`);
}

main().catch(err => {
  console.error('予期しないエラー:', err);
  process.exit(1);
});
