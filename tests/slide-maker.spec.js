const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.beforeEach(async ({ page }) => {
  // 認証をセット
  await page.goto(BASE_URL);
  await page.evaluate(() => localStorage.setItem('auth', '1'));
});

test.describe('Slide Maker — ページ表示', () => {
  test('アプリが正常に表示される', async ({ page }) => {
    await page.goto(`${BASE_URL}/apps/slide-maker/`);
    await expect(page).toHaveTitle(/Slide Maker/);
    await expect(page.locator('.page-title')).toContainText('Slide Maker');
  });

  test('ナビバーに「← アプリ一覧へ」リンクが存在する', async ({ page }) => {
    await page.goto(`${BASE_URL}/apps/slide-maker/`);
    await expect(page.locator('.navbar-back')).toContainText('アプリ一覧へ');
  });

  test('認証なしでアクセスするとトップページにリダイレクトされる', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('auth'));
    await page.goto(`${BASE_URL}/apps/slide-maker/`);
    await expect(page).toHaveURL(BASE_URL + '/');
  });
});

test.describe('Slide Maker — ウィザード入力', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/apps/slide-maker/`);
    await page.evaluate(() => localStorage.setItem('auth', '1'));
    await page.reload();
  });

  test('テンプレートカードが4種類表示される', async ({ page }) => {
    const cards = page.locator('.template-card');
    await expect(cards).toHaveCount(4);
  });

  test('テンプレートを選択するとselectedクラスが付く', async ({ page }) => {
    await page.locator('.template-card[data-val="external-dark"]').click();
    await expect(page.locator('.template-card[data-val="external-dark"]')).toHaveClass(/selected/);
    await expect(page.locator('.template-card[data-val="external-white"]')).not.toHaveClass(/selected/);
  });

  test('必須項目が空のまま生成ボタンを押すとエラーが表示される', async ({ page }) => {
    await page.locator('#btn-generate').click();
    await expect(page.locator('#error-msg')).toBeVisible();
    await expect(page.locator('#error-text')).toContainText('タイトルを入力してください');
  });

  test('入力項目が正しく入力できる', async ({ page }) => {
    await page.fill('#title', 'テスト提案書');
    await page.fill('#audience', 'テスト対象者');
    await page.fill('#background', 'テスト背景');
    await page.locator('.msg-input').first().fill('テストメッセージ');
    await expect(page.locator('#title')).toHaveValue('テスト提案書');
  });
});

test.describe('Slide Maker — UI構造', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/apps/slide-maker/`);
    await page.evaluate(() => localStorage.setItem('auth', '1'));
    await page.reload();
  });

  test('ウィザードが3ステップで構成されている', async ({ page }) => {
    const steps = page.locator('.step');
    await expect(steps).toHaveCount(3);
  });

  test('生成ボタンが存在する', async ({ page }) => {
    await expect(page.locator('#btn-generate')).toBeVisible();
  });

  test('ダウンロードエリアが初期状態では非表示', async ({ page }) => {
    await expect(page.locator('#download-area')).not.toBeVisible();
  });

  test('プレビューセクションが初期状態では非表示', async ({ page }) => {
    await expect(page.locator('#preview-section')).not.toBeVisible();
  });

  test('フッターに機密情報警告が表示される', async ({ page }) => {
    await expect(page.locator('footer')).toContainText('機密情報');
  });
});

test.describe('ポータル — Slide Makerカード', () => {
  test('ポータルにSlide MakerカードにNEWバッジが表示される', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.evaluate(() => localStorage.setItem('auth', '1'));
    await page.reload();
    const card = page.locator('a.card[href*="slide-maker"]');
    await expect(card).toBeVisible();
    await expect(card.locator('.card-new-badge')).toContainText('NEW');
  });

  test('WHAT\'S NEWにSlide Makerのエントリが存在する', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.evaluate(() => localStorage.setItem('auth', '1'));
    await page.reload();
    // WHAT'S NEWボタンをクリック
    const btn = page.locator('.changelog-btn');
    if (await btn.isVisible()) {
      await btn.click();
      await expect(page.locator('.changelog-panel')).toContainText('Slide Maker');
    }
  });
});
