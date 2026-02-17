const { test, expect } = require('playwright/test');

// Helper: type into the single input and wait for debounce + result
async function singleCheck(page, text) {
  const input = page.locator('#singleInput');
  await input.fill('');
  await input.fill(text);
  // debounce is 200ms for single input
  await page.waitForTimeout(350);
}

// Helper: type into the multi input and wait for debounce + result
async function multiCheck(page, text) {
  const input = page.locator('#multiInput');
  await input.fill('');
  await input.fill(text);
  // debounce is 300ms for multi input
  await page.waitForTimeout(450);
}

// Helper: get badge text from the first (or only) result card
async function getBadgeText(page, container = '#singleResults') {
  const badge = page.locator(`${container} .result-card .result-badge`).first();
  return badge.textContent();
}

// Helper: get the level class from a result card
async function getResultLevel(page, container = '#singleResults') {
  const card = page.locator(`${container} .result-card`).first();
  const cls = await card.getAttribute('class');
  if (cls.includes('deadly')) return 'deadly';
  if (cls.includes('dangerous')) return 'dangerous';
  if (cls.includes('caution')) return 'caution';
  if (cls.includes('safe')) return 'safe';
  return 'unknown';
}

test.describe('Food Safety Checker', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.tab.active');
  });

  // ─── Tab Navigation ───
  test.describe('Tab Navigation', () => {
    test('all 4 tabs exist and can be activated', async ({ page }) => {
      const tabs = ['single', 'multi', 'dishes', 'info'];
      for (const tab of tabs) {
        await page.click(`[data-tab="${tab}"]`);
        await expect(page.locator(`[data-tab="${tab}"]`)).toHaveClass(/active/);
        await expect(page.locator(`#tab-${tab}`)).toHaveClass(/active/);
      }
    });

    test('only one tab is active at a time', async ({ page }) => {
      await page.click('[data-tab="multi"]');
      await expect(page.locator('[data-tab="single"]')).not.toHaveClass(/active/);
      await expect(page.locator('[data-tab="multi"]')).toHaveClass(/active/);
      await expect(page.locator('#tab-single')).not.toHaveClass(/active/);
      await expect(page.locator('#tab-multi')).toHaveClass(/active/);
    });

    test('single tab is active by default', async ({ page }) => {
      await expect(page.locator('[data-tab="single"]')).toHaveClass(/active/);
      await expect(page.locator('#tab-single')).toHaveClass(/active/);
    });
  });

  // ─── BUG #1: German Compound Word Matching ───
  test.describe('BUG #1 - German compound word matching', () => {
    test('"Rindfleisch" should NOT match "Ei" — should show Nicht erkannt (safe)', async ({ page }) => {
      await singleCheck(page, 'Rindfleisch');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Nicht erkannt');
      const level = await getResultLevel(page);
      expect(level).toBe('safe');
    });

    test('"Spiegelei" SHOULD match eggs — should show Lebensgefahr (deadly)', async ({ page }) => {
      await singleCheck(page, 'Spiegelei');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Lebensgefahr');
      const level = await getResultLevel(page);
      expect(level).toBe('deadly');
    });

    test('"Rührei" SHOULD match eggs — should show Lebensgefahr (deadly)', async ({ page }) => {
      await singleCheck(page, 'Rührei');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Lebensgefahr');
      const level = await getResultLevel(page);
      expect(level).toBe('deadly');
    });

    test('"Schweinefilet" should NOT match "Ei" — should show Nicht erkannt (safe)', async ({ page }) => {
      await singleCheck(page, 'Schweinefilet');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Nicht erkannt');
      const level = await getResultLevel(page);
      expect(level).toBe('safe');
    });

    test('"Eierkuchen" SHOULD match eggs — should show Lebensgefahr (deadly)', async ({ page }) => {
      await singleCheck(page, 'Eierkuchen');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Lebensgefahr');
      const level = await getResultLevel(page);
      expect(level).toBe('deadly');
    });

    test('"Hühnerei" SHOULD match eggs — should show Lebensgefahr (deadly)', async ({ page }) => {
      await singleCheck(page, 'Hühnerei');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Lebensgefahr');
      const level = await getResultLevel(page);
      expect(level).toBe('deadly');
    });

    test('"Fleisch" should NOT directly match "Ei" allergen via compound word', async ({ page }) => {
      await singleCheck(page, 'Fleisch');
      // "Fleisch" does NOT match the "Ei" allergen directly (compound word fix works).
      // However, it matches the dish "Fleischpflanzerl / Frikadellen" (which contains eggs)
      // via the dish database substring search. This is the app's safety-first behavior.
      // The key test: it should NOT be tagged as "Eier / Eggs" allergen directly.
      const resultTitle = await page.locator('#singleResults .result-card .result-title').first().textContent();
      expect(resultTitle).not.toContain('Eier / Eggs');
    });
  });

  // ─── BUG #2: Käse Classification ───
  test.describe('BUG #2 - Käse classification', () => {
    test('"Käse" should show Vorsicht (caution/yellow), NOT Gefährlich', async ({ page }) => {
      await singleCheck(page, 'Käse');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Vorsicht');
      const level = await getResultLevel(page);
      expect(level).toBe('caution');
    });

    test('"Milch" should show Gefährlich (dangerous/orange)', async ({ page }) => {
      await singleCheck(page, 'Milch');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Gefährlich');
      const level = await getResultLevel(page);
      expect(level).toBe('dangerous');
    });

    test('"Butter" should show Gefährlich (dangerous)', async ({ page }) => {
      await singleCheck(page, 'Butter');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Gefährlich');
      const level = await getResultLevel(page);
      expect(level).toBe('dangerous');
    });

    test('"Parmesan" should show Vorsicht (caution)', async ({ page }) => {
      await singleCheck(page, 'Parmesan');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Vorsicht');
      const level = await getResultLevel(page);
      expect(level).toBe('caution');
    });
  });

  // ─── BUG #3: Multi-mode Parsing ───
  test.describe('BUG #3 - Multi-mode parsing', () => {
    test('comma-separated list should show ALL ingredients', async ({ page }) => {
      await page.click('[data-tab="multi"]');
      await multiCheck(page, 'Mehl, Zucker, Eier, Vanille');
      const cards = page.locator('#multiResults .result-card');
      await expect(cards).toHaveCount(4);
    });

    test('"Mehl, Zucker, Eier, Vanille" should flag Eier as deadly', async ({ page }) => {
      await page.click('[data-tab="multi"]');
      await multiCheck(page, 'Mehl, Zucker, Eier, Vanille');
      // Eier is deadly. "Vanille" also matches the dish "Pudding / Vanillesoße" (deadly).
      const deadlyCards = page.locator('#multiResults .result-card.deadly');
      const deadlyCount = await deadlyCards.count();
      expect(deadlyCount).toBeGreaterThanOrEqual(1);
      // Verify at least one deadly badge says Lebensgefahr
      const deadlyBadge = deadlyCards.first().locator('.result-badge');
      await expect(deadlyBadge).toHaveText('Lebensgefahr');
    });

    test('newline-separated list should show ALL ingredients', async ({ page }) => {
      await page.click('[data-tab="multi"]');
      await multiCheck(page, 'Mehl\nZucker\nEier\nVanille');
      const cards = page.locator('#multiResults .result-card');
      await expect(cards).toHaveCount(4);
    });

    test('"Mehl und Zucker" should split into two items', async ({ page }) => {
      await page.click('[data-tab="multi"]');
      await multiCheck(page, 'Mehl und Zucker');
      const cards = page.locator('#multiResults .result-card');
      await expect(cards).toHaveCount(2);
    });

    test('numbered list "1. Mehl\\n2. Eier" should parse correctly', async ({ page }) => {
      await page.click('[data-tab="multi"]');
      await multiCheck(page, '1. Mehl\n2. Eier');
      const cards = page.locator('#multiResults .result-card');
      await expect(cards).toHaveCount(2);
      // Eier should be deadly
      const deadlyCards = page.locator('#multiResults .result-card.deadly');
      await expect(deadlyCards).toHaveCount(1);
    });

    test('semicolons split ingredients', async ({ page }) => {
      await page.click('[data-tab="multi"]');
      await multiCheck(page, 'Mehl; Zucker; Salz');
      const cards = page.locator('#multiResults .result-card');
      await expect(cards).toHaveCount(3);
    });

    test('mixed separators work together', async ({ page }) => {
      await page.click('[data-tab="multi"]');
      await multiCheck(page, 'Mehl, Zucker\nEier; Salz');
      const cards = page.locator('#multiResults .result-card');
      await expect(cards).toHaveCount(4);
    });

    test('deduplication: repeated items appear only once', async ({ page }) => {
      await page.click('[data-tab="multi"]');
      await multiCheck(page, 'Mehl, mehl, MEHL');
      const cards = page.locator('#multiResults .result-card');
      await expect(cards).toHaveCount(1);
    });
  });

  // ─── Safe Exceptions ───
  test.describe('Safe exceptions', () => {
    test('"Erdnüsse" should be safe (Sicher)', async ({ page }) => {
      await singleCheck(page, 'Erdnüsse');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Sicher');
      const level = await getResultLevel(page);
      expect(level).toBe('safe');
    });

    test('"Mandeln" should be safe (Sicher)', async ({ page }) => {
      await singleCheck(page, 'Mandeln');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Sicher');
      const level = await getResultLevel(page);
      expect(level).toBe('safe');
    });
  });

  // ─── Deadly Items ───
  test.describe('Deadly items', () => {
    test('"Walnuss" should be deadly (Lebensgefahr)', async ({ page }) => {
      await singleCheck(page, 'Walnuss');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Lebensgefahr');
      const level = await getResultLevel(page);
      expect(level).toBe('deadly');
    });

    test('"Ei" should be deadly (Lebensgefahr)', async ({ page }) => {
      await singleCheck(page, 'Ei');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Lebensgefahr');
      const level = await getResultLevel(page);
      expect(level).toBe('deadly');
    });

    test('"Haselnuss" should be deadly (Lebensgefahr)', async ({ page }) => {
      await singleCheck(page, 'Haselnuss');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Lebensgefahr');
      const level = await getResultLevel(page);
      expect(level).toBe('deadly');
    });
  });

  // ─── Dangerous Items ───
  test.describe('Dangerous items', () => {
    test('"Huhn" should be dangerous (Gefährlich)', async ({ page }) => {
      await singleCheck(page, 'Huhn');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Gefährlich');
      const level = await getResultLevel(page);
      expect(level).toBe('dangerous');
    });

    test('"Avocado" should be dangerous (Gefährlich)', async ({ page }) => {
      await singleCheck(page, 'Avocado');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Gefährlich');
      const level = await getResultLevel(page);
      expect(level).toBe('dangerous');
    });

    test('"Kiwi" should be dangerous (Gefährlich)', async ({ page }) => {
      await singleCheck(page, 'Kiwi');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Gefährlich');
      const level = await getResultLevel(page);
      expect(level).toBe('dangerous');
    });
  });

  // ─── Clear Button ───
  test.describe('Clear button', () => {
    test('clear button is hidden by default', async ({ page }) => {
      await expect(page.locator('#clearSingle')).not.toHaveClass(/show/);
    });

    test('clear button appears when text is entered', async ({ page }) => {
      await page.locator('#singleInput').fill('Ei');
      await page.waitForTimeout(100);
      await expect(page.locator('#clearSingle')).toHaveClass(/show/);
    });

    test('clicking clear button clears input and results', async ({ page }) => {
      await singleCheck(page, 'Ei');
      // Verify result exists
      await expect(page.locator('#singleResults .result-card')).toHaveCount(1);
      // Click clear
      await page.click('#clearSingle');
      await page.waitForTimeout(100);
      // Input should be empty
      await expect(page.locator('#singleInput')).toHaveValue('');
      // Results should be gone
      await expect(page.locator('#singleResults .result-card')).toHaveCount(0);
      // Empty state should reappear
      await expect(page.locator('#singleEmpty')).toBeVisible();
    });

    test('multi clear button works', async ({ page }) => {
      await page.click('[data-tab="multi"]');
      await multiCheck(page, 'Mehl, Zucker');
      await expect(page.locator('#multiResults .result-card')).toHaveCount(2);
      await page.click('#clearMulti');
      await page.waitForTimeout(100);
      await expect(page.locator('#multiInput')).toHaveValue('');
      await expect(page.locator('#multiResults .result-card')).toHaveCount(0);
      await expect(page.locator('#multiEmpty')).toBeVisible();
    });
  });

  // ─── Empty State ───
  test.describe('Empty state', () => {
    test('single tab shows empty state by default', async ({ page }) => {
      await expect(page.locator('#singleEmpty')).toBeVisible();
      await expect(page.locator('#singleResults .result-card')).toHaveCount(0);
    });

    test('multi tab shows empty state by default', async ({ page }) => {
      await page.click('[data-tab="multi"]');
      await expect(page.locator('#multiEmpty')).toBeVisible();
      await expect(page.locator('#multiResults .result-card')).toHaveCount(0);
    });

    test('empty state hides when input has results', async ({ page }) => {
      await singleCheck(page, 'Ei');
      await expect(page.locator('#singleEmpty')).toBeHidden();
      await expect(page.locator('#singleResults .result-card')).toHaveCount(1);
    });
  });

  // ─── Dish Search Filtering ───
  test.describe('Dish search', () => {
    test('dishes grid is populated by default', async ({ page }) => {
      await page.click('[data-tab="dishes"]');
      const cards = page.locator('#dishesGrid .dish-card');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
    });

    test('dish search filters results', async ({ page }) => {
      await page.click('[data-tab="dishes"]');
      const allCards = await page.locator('#dishesGrid .dish-card').count();
      await page.locator('#dishSearch').fill('Caesar');
      await page.waitForTimeout(200);
      const filteredCards = await page.locator('#dishesGrid .dish-card').count();
      expect(filteredCards).toBeLessThan(allCards);
      expect(filteredCards).toBeGreaterThan(0);
    });

    test('dish search with no results shows empty state', async ({ page }) => {
      await page.click('[data-tab="dishes"]');
      await page.locator('#dishSearch').fill('xyznonexistentdish');
      await page.waitForTimeout(200);
      await expect(page.locator('#dishesGrid .dish-card')).toHaveCount(0);
      await expect(page.locator('#dishesGrid .empty-state')).toBeVisible();
    });
  });

  // ─── Dish Detail Click ───
  test.describe('Dish detail click', () => {
    test('clicking a dish navigates to single check with dish name', async ({ page }) => {
      await page.click('[data-tab="dishes"]');
      // Click the first dish card
      const firstDish = page.locator('#dishesGrid .dish-card').first();
      await firstDish.click();
      await page.waitForTimeout(400);
      // Should switch to single tab
      await expect(page.locator('[data-tab="single"]')).toHaveClass(/active/);
      await expect(page.locator('#tab-single')).toHaveClass(/active/);
      // Single input should have a value
      const inputValue = await page.locator('#singleInput').inputValue();
      expect(inputValue.length).toBeGreaterThan(0);
      // Should have a result
      await expect(page.locator('#singleResults .result-card')).toHaveCount(1);
    });
  });

  // ─── Additional Compound Word Edge Cases ───
  test.describe('Additional compound word edge cases', () => {
    test('"Eierlikör" should match eggs — deadly', async ({ page }) => {
      await singleCheck(page, 'Eierlikör');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Lebensgefahr');
    });

    test('"Nussecke" should match nuts — deadly', async ({ page }) => {
      await singleCheck(page, 'Nussecke');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Lebensgefahr');
    });

    test('"Erdnussbutter" should be safe', async ({ page }) => {
      await singleCheck(page, 'Erdnussbutter');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Sicher');
    });

    test('"Mandelmehl" should be safe', async ({ page }) => {
      await singleCheck(page, 'Mandelmehl');
      const badge = await getBadgeText(page);
      expect(badge).toBe('Sicher');
    });
  });

  // ─── Info Tab ───
  test.describe('Info tab', () => {
    test('info tab shows allergen information', async ({ page }) => {
      await page.click('[data-tab="info"]');
      await expect(page.locator('#tab-info .info-card')).toHaveCount(4);
      await expect(page.locator('#tab-info .legend')).toBeVisible();
    });

    test('info tab shows safe exceptions', async ({ page }) => {
      await page.click('[data-tab="info"]');
      const safeTags = page.locator('#tab-info .safe-tag');
      await expect(safeTags).toHaveCount(2);
    });
  });
});
