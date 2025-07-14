class PlaywrightGenerator {
  constructor() {
    console.log('🎭 PlaywrightGenerator initialized');

    this.templates = {
      imports: `import { test, expect } from '@playwright/test';`,

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

      testStructure: (name, steps, config) => {
        const hasAuth = config.customHeaders && Object.keys(config.customHeaders).length > 0;
        return `
test('${name}', async ({ page }) => {${hasAuth ? '\n  const authHelper = new AuthHelper(page);' : ''}
  ${hasAuth
          ? `\n  // Set custom headers\n  await authHelper.setAuthHeaders(${JSON.stringify(config.customHeaders, null, 2)});`
          : ''}
  
  ${steps.map(step => this.generateStepCode(step)).join('\n  ')}
});`;
      }
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
      const hasAuth = customHeaders && Object.keys(customHeaders).length > 0;
      const authHelper = hasAuth ? this.templates.authHelper : '';
      const testCode = this.templates.testStructure(name, steps, { customHeaders });

      const fullTest = `${imports}${authHelper ? '\n\n' + authHelper : ''}\n\n${testCode}`;

      console.log('✅ Test generated successfully');
      console.log('📄 Generated test length:', fullTest.length, 'characters');
      console.log('🔐 Authentication enabled:', hasAuth);

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

  escapeQuotesForSelector(text) {
    if (!text) return '';
    return text.replace(/"/g, '\\"').replace(/'/g, "\\'");
  }

  extractLinkText(target) {
    // Handle patterns like "link, 'More information...'" or 'link "More information..."'
    const linkMatch = target.match(/link[,\s]*["']([^"']+)["']/i);
    if (linkMatch) {
      return linkMatch[1];
    }
    
    // Handle patterns like "More information... link" 
    const textLinkMatch = target.match(/["']([^"']+)["'][,\s]*link/i);
    if (textLinkMatch) {
      return textLinkMatch[1];
    }
    
    // Fallback: remove "link" and clean up remaining text
    let linkText = target.replace(/link/gi, '').trim();
    
    // Remove leading comma and whitespace
    linkText = linkText.replace(/^[,\s]+/, '');
    
    // Remove surrounding quotes
    linkText = linkText.replace(/^["']|["']$/g, '');
    
    return linkText;
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
      const escapedText = this.escapeQuotesForSelector(buttonText);
      return `button:has-text("${escapedText}")`;
    }

    if (target.includes('link')) {
      const linkText = this.extractLinkText(target);
      const escapedText = this.escapeQuotesForSelector(linkText);
      return `a:has-text("${escapedText}")`;
    }

    // Default: try to find by text or data-testid
    const cleanTarget = target.replace(/['"]/g, '');
    const escapedTarget = this.escapeQuotesForSelector(cleanTarget);
    return `[data-testid="${escapedTarget}"], :has-text("${escapedTarget}")`;
  }

  generateAssertionCode(target, value, assertion) {
    let selector;
    let description;
    
    // Handle specific patterns where target is element type and value is the text
    if ((target === 'link' || target === 'button' || target === 'element') && value) {
      if (target === 'link') {
        const escapedText = this.escapeQuotesForSelector(value);
        selector = `a:has-text("${escapedText}")`;
        description = `link with text "${value}"`;
      } else if (target === 'button') {
        const escapedText = this.escapeQuotesForSelector(value);
        selector = `button:has-text("${escapedText}")`;
        description = `button with text "${value}"`;
      } else {
        const escapedText = this.escapeQuotesForSelector(value);
        selector = `:has-text("${escapedText}")`;
        description = `element with text "${value}"`;
      }
    } else {
      selector = this.generateSelector(target);
      description = target;
    }

    if (assertion) {
      switch (assertion.toLowerCase()) {
        case 'visible':
          return `// Verify ${description} is visible
  await expect(page.locator('${selector}')).toBeVisible();`;

        case 'text':
        case 'contains':
          return `// Verify ${description} contains text '${value}'
  await expect(page.locator('${selector}')).toContainText('${value}');`;

        default:
          return `// Verify ${description}
  await expect(page.locator('${selector}')).toContainText('${value || assertion}');`;
      }
    }

    // Default verification
    if (value && !(target === 'link' || target === 'button' || target === 'element')) {
      return `// Verify ${description} contains '${value}'
  await expect(page.locator('${selector}')).toContainText('${value}');`;
    } else {
      return `// Verify ${description} is visible
  await expect(page.locator('${selector}')).toBeVisible();`;
    }
  }
}

export const playwrightGenerator = new PlaywrightGenerator();