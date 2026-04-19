// @ts-check
// 主要アプリの最小スモークテスト（ページ読み込み / タイトル / 主要 UI 要素）
// regression を早期検知するのが目的。詳細な機能テストは個別 spec で実施。
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.beforeEach(async ({ page }) => {
  await page.goto(BASE_URL);
  await page.evaluate(() => localStorage.setItem('auth', '1'));
});

async function setAuthAndGo(page, path) {
  await page.goto(`${BASE_URL}${path}`);
  await page.evaluate(() => localStorage.setItem('auth', '1'));
  await page.reload();
}

test.describe('スモーク — OGP Checker', () => {
  test('アプリ表示 + チェックボタン存在', async ({ page }) => {
    await setAuthAndGo(page, '/apps/ogp-checker/');
    await expect(page).toHaveTitle(/OGP/);
    await expect(page.locator('#check-btn')).toBeVisible();
  });
  test('OGP meta タグが設定されている', async ({ page }) => {
    await setAuthAndGo(page, '/apps/ogp-checker/');
    const og = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(og).toBeTruthy();
  });
});

test.describe('スモーク — URL Slug Generator', () => {
  test('アプリ表示 + 生成ボタン存在', async ({ page }) => {
    await setAuthAndGo(page, '/apps/url-slug-generator/');
    await expect(page).toHaveTitle(/Slug|URL/);
    await expect(page.locator('#generate-btn')).toBeVisible();
  });
  test('入力欄 (#desc-input) が存在', async ({ page }) => {
    await setAuthAndGo(page, '/apps/url-slug-generator/');
    await expect(page.locator('#desc-input')).toBeAttached();
  });
});

test.describe('スモーク — Banner Resizer', () => {
  test('アプリ表示 + 出力形式ボタン存在', async ({ page }) => {
    await setAuthAndGo(page, '/apps/banner-resizer/');
    await expect(page).toHaveTitle(/Banner/);
    await expect(page.locator('#btn-webp')).toBeVisible();
    await expect(page.locator('#btn-png')).toBeVisible();
  });
  test('ドロップゾーンが存在', async ({ page }) => {
    await setAuthAndGo(page, '/apps/banner-resizer/');
    await expect(page.locator('#dz-mv')).toBeVisible();
  });
});

test.describe('スモーク — Prompt Maker', () => {
  test('アプリ表示', async ({ page }) => {
    await setAuthAndGo(page, '/apps/prompt-maker/');
    await expect(page).toHaveTitle(/Prompt/);
  });
  test('OGP meta が設定されている', async ({ page }) => {
    await setAuthAndGo(page, '/apps/prompt-maker/');
    const og = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(og).toContain('Prompt Maker');
  });
});

test.describe('スモーク — Writing Checker', () => {
  test('アプリ表示 + チェックボタン存在', async ({ page }) => {
    await setAuthAndGo(page, '/apps/writing-checker/');
    await expect(page).toHaveTitle(/Writing|Checker/);
    await expect(page.locator('#check-btn')).toBeVisible();
  });
  test('文字数カウントが表示される', async ({ page }) => {
    await setAuthAndGo(page, '/apps/writing-checker/');
    await expect(page.locator('#char-count')).toBeAttached();
  });
});

test.describe('スモーク — ポータル', () => {
  test('ポータル全アプリカードが表示される', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    const cards = page.locator('a.card[href^="apps/"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });
  test('ポータルに AI NEWS カードがある', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    const card = page.locator('a.card[href*="ai-news"]');
    await expect(card).toBeVisible();
  });
});

test.describe('スモーク — 全アプリ共通 OGP 準備', () => {
  const apps = [
    'ai-news', 'ogp-checker', 'url-slug-generator', 'banner-resizer',
    'prompt-maker', 'writing-checker', 'slide-maker', 'sns-post-generator',
    'youtube-desc', 'cache-checker', 'image-converter', 'marketo-mail-generator',
    'wireframe-maker', 'akkodis-watcher',
  ];
  for (const app of apps) {
    test(`${app}: OGP / meta description が存在`, async ({ page }) => {
      await setAuthAndGo(page, `/apps/${app}/`);
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
      const desc = await page.locator('meta[name="description"]').getAttribute('content');
      expect(ogTitle, `${app} has og:title`).toBeTruthy();
      expect(desc, `${app} has description`).toBeTruthy();
    });
  }
});
