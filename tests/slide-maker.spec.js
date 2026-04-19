// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const APP_URL = `${BASE_URL}/apps/slide-maker/`;

test.beforeEach(async ({ page }) => {
  await page.goto(BASE_URL);
  await page.evaluate(() => localStorage.setItem('auth', '1'));
});

test.describe('Slide Maker — ページ表示', () => {
  test('アプリが正常に表示される', async ({ page }) => {
    await page.goto(APP_URL);
    await expect(page).toHaveTitle(/Slide Maker/);
    await expect(page.locator('.navbar-title')).toContainText('Slide Maker');
  });

  test('ナビバーにアプリ一覧への戻りリンクが存在する', async ({ page }) => {
    await page.goto(APP_URL);
    // 現行 UI は .back-btn（過去は .navbar-back）。どちらでもマッチさせる
    const back = page.locator('.back-btn, .navbar-back').first();
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute('href', /^\.\.\/|^\/$/);
  });

  test('認証なしでアクセスするとトップページにリダイレクトされる', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('auth'));
    await page.goto(APP_URL);
    await expect(page).toHaveURL(BASE_URL + '/');
  });
});

test.describe('Slide Maker — 主要 UI 要素', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await page.evaluate(() => localStorage.setItem('auth', '1'));
    await page.reload();
  });

  test('チャット入力欄が存在する', async ({ page }) => {
    await expect(page.locator('#chat-input')).toBeVisible();
  });

  test('送信ボタンが存在する', async ({ page }) => {
    await expect(page.locator('#btn-send')).toBeVisible();
  });

  test('エディタパネルが存在する', async ({ page }) => {
    await expect(page.locator('#editor-pane')).toBeAttached();
  });

  test('ダウンロードボタンが存在する', async ({ page }) => {
    await expect(page.locator('#btn-download')).toBeAttached();
  });
});

test.describe('ポータル — Slide Makerカード', () => {
  test('ポータルに Slide Maker カードが存在する', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.evaluate(() => localStorage.setItem('auth', '1'));
    await page.reload();
    const card = page.locator('a.card[href*="slide-maker"]');
    await expect(card).toBeVisible();
  });

  test('WHAT\'S NEW に Slide Maker のエントリが存在する', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    const hasEntry = await page.evaluate(() => {
      const text = document.body.innerHTML;
      return /Slide Maker/.test(text);
    });
    expect(hasEntry).toBeTruthy();
  });
});
