// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const APP_URL = `${BASE_URL}/apps/ai-news/`;

test.beforeEach(async ({ page }) => {
  await page.goto(BASE_URL);
  await page.evaluate(() => {
    localStorage.setItem('auth', '1');
    // オンボーディングを「既読」にしてオーバーレイを出さない
    localStorage.setItem('ai-news_onboarded_v3', '1');
  });
});

// 各テストの最初に呼び出して、念のためオーバーレイが出てたら閉じる
async function dismissOnboarding(page) {
  const overlay = page.locator('.ob-overlay.show');
  if (await overlay.count()) {
    await page.evaluate(() => {
      document.querySelectorAll('.ob-overlay').forEach(el => el.remove());
    });
  }
}

test.describe('AI NEWS — 基本表示', () => {
  test('アプリがタイトルを含めて表示される', async ({ page }) => {
    await page.goto(APP_URL);
    await expect(page).toHaveTitle(/AI NEWS|ai-news/i);
    await expect(page.locator('.hero-title')).toBeVisible();
  });

  test('ヒーロー stat に 日付 / 記事 / 既読 / 読了目安 が表示される', async ({ page }) => {
    await page.goto(APP_URL);
    await expect(page.locator('#stat-date')).toBeVisible();
    await expect(page.locator('#stat-total')).toBeVisible();
    await expect(page.locator('#stat-read-progress')).toBeVisible();
    await expect(page.locator('#stat-read')).toBeVisible();
  });

  test('3行サマリーの TODAY\'S BRIEFING ラベルが欠けず見える', async ({ page }) => {
    await page.goto(APP_URL);
    const execBox = page.locator('.exec-box');
    await expect(execBox).toBeVisible();
    // ラベルは ::before 擬似要素なのでバウンディングボックスで top 以下にあるか確認
    const box = await execBox.boundingBox();
    expect(box).toBeTruthy();
    expect(box.y).toBeGreaterThan(0);
  });

  test('本日の主要ニュース / その他のニュース セクション見出しがある', async ({ page }) => {
    await page.goto(APP_URL);
    await expect(page.locator('#sec-must-know')).toContainText('本日の主要ニュース');
    await expect(page.locator('text=その他のニュース').first()).toBeVisible();
  });
});

test.describe('AI NEWS — インタラクション', () => {
  test('FYI フィルタツールバーが sticky (position: sticky で top: 0)', async ({ page }) => {
    await page.goto(APP_URL);
    const toolbar = page.locator('.more-toolbar').first();
    await expect(toolbar).toBeVisible();
    const position = await toolbar.evaluate(el => getComputedStyle(el).position);
    expect(position).toBe('sticky');
  });

  test('カード一覧に「⏱ N分」読了時間が表示される', async ({ page }) => {
    await page.goto(APP_URL);
    // 最初のカードが読み込まれるのを待つ
    await page.waitForSelector('.brief-card, .fyi-card', { timeout: 5000 });
    const readTime = page.locator('.meta-read').first();
    await expect(readTime).toBeVisible();
    await expect(readTime).toContainText(/分/);
  });

  test('タブ (すべて/マーケ/市場/AI/ツール活用) がクリックで切り替わる', async ({ page }) => {
    await page.goto(APP_URL);
    await dismissOnboarding(page);
    await page.waitForSelector('.tab', { timeout: 5000 });
    const aiTab = page.locator('.tab[data-cat="ai"]');
    await aiTab.click();
    await expect(aiTab).toHaveClass(/active/);
  });

  test('🌙 夜間モードボタンで body に night-mode クラスが付く', async ({ page }) => {
    await page.goto(APP_URL);
    await dismissOnboarding(page);
    await page.click('#btn-night-mode');
    const cls = await page.evaluate(() => document.body.className);
    expect(cls).toContain('night-mode');
    // トグルで外れる
    await page.click('#btn-night-mode');
    const cls2 = await page.evaluate(() => document.body.className);
    expect(cls2).not.toContain('night-mode');
  });
});

test.describe('AI NEWS — データ構造', () => {
  test('news.json が取得できて items 配列を含む', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/apps/ai-news/data/news.json`);
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(Array.isArray(json.items)).toBeTruthy();
    expect(json.items.length).toBeGreaterThan(0);
  });

  test('すべての記事に title / source / publishedAt / url が存在する', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/apps/ai-news/data/news.json`);
    const json = await res.json();
    for (const item of json.items) {
      expect(item.title, JSON.stringify(item)).toBeTruthy();
      expect(item.source).toBeTruthy();
      expect(item.publishedAt).toBeTruthy();
      // URL は空文字列を許容する場合があるが https:// 始まりのみ有効
      if (item.url) expect(item.url).toMatch(/^https?:\/\//);
    }
  });

  test('「はじめに」「概要」等の boilerplate プレフィクスが summary / whyItMatters に残っていない', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/apps/ai-news/data/news.json`);
    const json = await res.json();
    const bad = ['はじめに', '概要', '要約', '目次', 'TL;DR', 'tldr'];
    for (const item of json.items) {
      const heads = [item.summary || '', item.whyItMatters || ''];
      for (const text of heads) {
        for (const h of bad) {
          expect(text.toLowerCase().startsWith(h.toLowerCase()),
            `記事「${item.title}」の要約先頭に「${h}」が残っている: ${text.slice(0, 50)}`
          ).toBeFalsy();
        }
      }
    }
  });

  test('UGC (Qiita/Zenn/note) 記事は urgency=must_know に混ざっていない', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/apps/ai-news/data/news.json`);
    const json = await res.json();
    const UGC = /(Qiita|Zenn|note)/i;
    const mustKnowUGC = json.items.filter(i => i.urgency === 'must_know' && UGC.test(i.source || ''));
    expect(mustKnowUGC, `UGC が主要ニュース枠に侵入: ${mustKnowUGC.map(x => x.source).join(', ')}`).toHaveLength(0);
  });
});

test.describe('AI NEWS — SEO / シェア', () => {
  test('OGP meta タグが設定されている', async ({ page }) => {
    await page.goto(APP_URL);
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    const ogDesc = await page.locator('meta[property="og:description"]').getAttribute('content');
    const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content');
    expect(ogTitle).toMatch(/AI NEWS/);
    expect(ogDesc).toBeTruthy();
    expect(twitterCard).toBe('summary_large_image');
  });

  test('meta description が設定されている', async ({ page }) => {
    await page.goto(APP_URL);
    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc).toMatch(/AI.*マーケ/);
  });
});

test.describe('AI NEWS — PWA', () => {
  test('Service Worker ファイル (sw.js) が配信される', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/apps/ai-news/sw.js`);
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toContain('CACHE_VERSION');
  });

  test('manifest.json が存在して start_url が正しい', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/apps/ai-news/manifest.json`);
    const json = await res.json();
    expect(json.start_url).toContain('/apps/ai-news/');
    expect(json.theme_color).toBe('#001f33');
  });
});

test.describe('AI NEWS — アクセシビリティ', () => {
  test('ヒーローに aria 属性と見出しタグが適切', async ({ page }) => {
    await page.goto(APP_URL);
    await expect(page.locator('.hero-title')).toBeVisible();
    // 音声ダイジェストボタンに aria-label がある
    await expect(page.locator('#btn-listen')).toHaveAttribute('aria-label', /音声/);
  });

  test('j/k キーナビゲーションで記事カード間を移動できる', async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForSelector('.brief-card, .fyi-card', { timeout: 5000 });
    await page.keyboard.press('j');
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-id'));
    expect(focused).toBeTruthy();
  });
});
