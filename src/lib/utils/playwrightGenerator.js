class PlaywrightGenerator {
  constructor() {
    console.log('🎭 PlaywrightGenerator initialized');

    this.templates = {
      imports: `const { test, expect } = require('@playwright/test');`,

      authHelper: `
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
      'Authorization': \`Bearer \${token}\`
    });
  }
}`,

      testStructure: (name, steps, config) => `
test('${name}', async ({ page }) => {
  const authHelper = new AuthHelper(page);
  
  ${config.customHeaders && Object.keys(config.customHeaders).length > 0
          ? `// Set custom headers
  await authHelper.setAuthHeaders(${JSON.stringify(config.customHeaders, null, 2)});`
          : ''}
  
  ${steps.map(step => this.generateStepCode(step)).join('\n  ')}
});`
    };
  }

  async generate(testConfig) {
    console.log('🎭 PlaywrightGenerator.generate called with:', testConfig);

    const { name, steps, baseUrl, customHeaders = {} } = testConfig;

    if (!steps || steps.length === 0) {
      console.error('❌ No test steps provided');
      throw new Error('No test steps provided');
    }

    console.log('📝 Generating test with', steps.length, 'steps');

    try {
      const imports = this.templates.imports;
      const authHelper = this.templates.authHelper;
      const testCode = this.templates.testStructure(name, steps, { customHeaders });

      const fullTest = `${imports}

${authHelper}

${testCode}`;

      console.log('✅ Test generated successfully');
      console.log('📄 Generated test length:', fullTest.length, 'characters');

      return fullTest;
    } catch (error) {
      console.error('❌ Error in PlaywrightGenerator.generate:', error);
      throw error;
    }
  }

  generateStepCode(step) {
    console.log('🔧 Generating step code for:', step);

    const { action, target, value, assertion } = step;

    try {
      switch (action.toLowerCase()) {
        case 'navigate':
        case 'goto':
        case 'visit':
          return `// Navigate to ${target || value}
  await page.goto('${target || value}');`;

        case 'click':
          return `// Click ${target}
  await page.click('${this.generateSelector(target)}');`;

        case 'fill':
        case 'type':
        case 'enter':
          return `// Enter '${value}' in ${target}
  await page.fill('${this.generateSelector(target)}', '${value}');`;

        case 'select':
          return `// Select '${value}' from ${target}
  await page.selectOption('${this.generateSelector(target)}', '${value}');`;

        case 'wait':
          if (target && target.includes('element')) {
            return `// Wait for ${target} to be visible
  await page.waitForSelector('${this.generateSelector(value)}', { state: 'visible' });`;
          } else {
            const duration = parseInt(value) || 1000;
            return `// Wait for ${duration}ms
  await page.waitForTimeout(${duration});`;
          }

        case 'verify':
        case 'check':
        case 'assert':
          return this.generateAssertionCode(target, value, assertion);

        case 'hover':
          return `// Hover over ${target}
  await page.hover('${this.generateSelector(target)}');`;

        case 'press':
          return `// Press ${value || target} key
  await page.keyboard.press('${value || target}');`;

        case 'screenshot':
          return `// Take screenshot
  await page.screenshot({ path: 'test-results/screenshot-${Date.now()}.png' });`;

        default:
          console.warn('⚠️ Unknown action:', action);
          return `// Custom action: ${action}
  // TODO: Implement custom action for ${target}`;
      }
    } catch (error) {
      console.error('❌ Error generating step code for:', step, error);
      return `// Error generating step: ${action}`;
    }
  }

  generateSelector(target) {
    if (!target) {
      console.warn('⚠️ No target provided for selector generation');
      return '';
    }

    // If target already looks like a CSS selector, use it as-is
    if (target.includes('[') || target.startsWith('#') || target.startsWith('.')) {
      return target;
    }

    // Common element mappings
    const elementMappings = {
      'login button': '[data-testid="login-button"], button:has-text("login"), input[type="submit"]',
      'username': '[data-testid="username"], input[name="username"], input[placeholder*="username" i]',
      'password': '[data-testid="password"], input[name="password"], input[type="password"]',
      'email': '[data-testid="email"], input[name="email"], input[type="email"]',
      'submit button': '[data-testid="submit"], button[type="submit"], input[type="submit"]',
      'search box': '[data-testid="search"], input[name="search"], input[placeholder*="search" i]'
    };

    // Check for direct mapping
    const lowerTarget = target.toLowerCase();
    for (const [key, selector] of Object.entries(elementMappings)) {
      if (lowerTarget.includes(key)) {
        return selector;
      }
    }

    // Generate selector based on text content
    if (target.includes('button')) {
      const buttonText = target.replace(/button/gi, '').trim();
      return `button:has-text("${buttonText}")`;
    }

    if (target.includes('link')) {
      const linkText = target.replace(/link/gi, '').trim();
      return `a:has-text("${linkText}")`;
    }

    // Default: try to find by text or data-testid
    const cleanTarget = target.replace(/['"]/g, '');
    return `[data-testid="${cleanTarget}"], :has-text("${cleanTarget}")`;
  }

  generateAssertionCode(target, value, assertion) {
    const selector = this.generateSelector(target);

    if (assertion) {
      switch (assertion.toLowerCase()) {
        case 'visible':
          return `// Verify ${target} is visible
  await expect(page.locator('${selector}')).toBeVisible();`;

        case 'text':
        case 'contains':
          return `// Verify ${target} contains text '${value}'
  await expect(page.locator('${selector}')).toContainText('${value}');`;

        default:
          return `// Verify ${target}
  await expect(page.locator('${selector}')).toContainText('${value || assertion}');`;
      }
    }

    // Default verification
    if (value) {
      return `// Verify ${target} contains '${value}'
  await expect(page.locator('${selector}')).toContainText('${value}');`;
    } else {
      return `// Verify ${target} is visible
  await expect(page.locator('${selector}')).toBeVisible();`;
    }
  }
}

export const playwrightGenerator = new PlaywrightGenerator();