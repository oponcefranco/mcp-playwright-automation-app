const { test, expect } = require('@playwright/test');


// Authentication Helper
class AuthHelper {
  constructor(page) {
    this.page = page;
    this.headers = {};
  }

  async setAuthHeaders(headers) {
    this.headers = { ...this.headers, ...headers };
    await this.page.setExtraHTTPHeaders(this.headers);
  }

  async setBearerToken(token) {
    await this.setAuthHeaders({
      'Authorization': `Bearer ${token}`
    });
  }
}


test('Goat Timeline page', async ({ page }) => {
  const authHelper = new AuthHelper(page);
  
  
  
  // Navigate to Base URL
  await page.goto('Base URL');
  // Click “Timeline” top navigation link
  await page.click('a:has-text("“Timeline” top navigation")');
  // Verify text "Timeline: Sneaker Releases" is visible
  await expect(page.locator('[data-testid="text Timeline: Sneaker Releases"], :has-text("text Timeline: Sneaker Releases")')).toBeVisible();
});