# 🎭 POC MCP Playwright Automation Desktop App

A powerful AI-enhanced automation testing framework built with **Tauri + Svelte + Playwright MCP Server**. This application provides a modern UI for creating, managing, and executing browser automation tests with intelligent step parsing and AI-powered test generation.

## ✨ Features

### 🧠 AI-Powered Test Builder
- **Natural Language Processing**: Convert plain English instructions into Playwright tests
- **Smart Step Parser**: Automatically recognizes test actions, targets, and assertions
- **Visual Test Builder**: Interactive UI for creating and editing test steps
- **Real-time Preview**: See parsed steps and generated code instantly

### 🔌 MCP Integration
- **Playwright MCP Server**: Seamless integration with Microsoft's Model Context Protocol
- **Real-time Communication**: WebSocket-based connection for live test execution
- **AI Test Runner**: Execute tests through AI with intelligent error handling
- **Status Monitoring**: Live connection status and health monitoring

### 🔐 Advanced Authentication
- **Multiple Auth Methods**: Bearer tokens, API keys, Basic auth, custom headers
- **Environment Variables**: Secure credential management with variable substitution
- **Cloudflare Access**: Built-in support for CF Access headers
- **Session Management**: Cookie-based authentication support

### 📊 Comprehensive Reporting
- **Real-time Results**: Live test execution status and progress tracking
- **Rich Reports**: HTML and JSON report generation
- **Visual Analytics**: Pass/fail statistics with category breakdowns
- **Error Analysis**: Detailed error messages and stack traces

### ⚙️ Professional Configuration
- **Project Templates**: Pre-configured setups for different testing scenarios
- **Cross-Browser Support**: Chrome, Firefox, and WebKit testing
- **Headless/Headful**: Toggle between visible and background execution
- **Video Recording**: Capture test runs for debugging

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Rust (for Tauri)
- Git

### Node Version Manager
```bash
nvm use 22.17.0 

nvm list
->  v22.17.0
```

### Installation

1. **Clone the repository**
```bash
git clone <git@github.com:oponcefranco/mcp-playwright-automation-app.git>
cd mcp-playwright-automation-app
```

2. **Install dependencies**
```bash
npm install
```

3. **Install Playwright browsers**
```bash
npx playwright install
```

4. **Start the MCP server**
```bash
npm run server
```

5. **Launch the desktop app**
```bash
npm run tauri:dev
```

## 📖 Usage Guide

### Creating Your First Test

1. **Open Test Builder**: Navigate to the "Test Builder" tab
2. **Configure Settings**: Set your base URL and authentication if needed
3. **Write Instructions**: Enter step-by-step test instructions in plain English:
   ```
   1. Navigate to https://example.com/login
   2. Enter username "admin@example.com"
   3. Enter password "secure123"
   4. Click the login button
   5. Verify user is redirected to dashboard
   6. Check that welcome message is displayed
   ```
4. **Generate Test**: Click "Generate Playwright Test" to create the automation code
5. **Save & Run**: Save the test file and execute via MCP or traditional runner

### Authentication Setup

#### Bearer Token Authentication
```javascript
// In Test Builder - Custom Headers
{
  "Authorization": "Bearer ${API_TOKEN}"
}
```

#### Cloudflare Access
```javascript
// Environment Variables (Config Panel)
CF_ACCESS_CLIENT_ID=your-client-id
CF_ACCESS_CLIENT_SECRET=your-secret
JWT_COOKIE=your-jwt-cookie
```

#### Custom Headers with Environment Variables
```javascript
{
  "Authorization": "Bearer ${API_TOKEN}",
  "X-Custom-Header": "${CUSTOM_VALUE}",
  "Content-Type": "application/json"
}
```

### Running Tests

#### Via MCP Server (AI-Powered)
1. Ensure MCP server is running (`npm run server`)
2. Click "Run Test via MCP" in Test Builder
3. Monitor real-time execution in Results panel

#### Via Traditional Runner
1. Save test to file system
2. Use Test Runner tab to select and execute tests
3. Configure browser, headless mode, and other options

## 🏗️ Architecture

### Component Structure
```
src/
├── lib/
│   ├── components/
│   │   ├── TestBuilder.svelte      # Main test creation interface
│   │   ├── TestRunner.svelte       # Test execution management
│   │   ├── ResultsPanel.svelte     # Results visualization
│   │   ├── ConfigPanel.svelte      # Configuration management
│   │   └── MCPStatusMonitor.svelte # MCP connection status
│   ├── stores/
│   │   ├── mcpStore.js            # MCP WebSocket management
│   │   └── testStore.js           # Test data and execution
│   └── utils/
│       ├── stepParser.js          # Natural language processing
│       ├── playwrightGenerator.js # Code generation engine
│       └── authHelper.js          # Authentication utilities
└── mcp/
    └── server.js                  # MCP server implementation
```

### Data Flow
1. **User Input** → Step Parser → Generated Code
2. **Test Execution** → MCP Server → Browser Automation
3. **Results** → Store → UI Components → Reports

## 🔧 Configuration

### Project Configuration (`playwright.config.js`)
```javascript
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'https://your-app.com',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
});
```

### Environment Variables (`.env`)
```bash
# Authentication
API_TOKEN=your-api-token
CF_ACCESS_CLIENT_ID=your-cf-client-id
CF_ACCESS_CLIENT_SECRET=your-cf-secret

# Application
BASE_URL=https://your-app.com
TIMEOUT=30000
```

## 📝 Step Parser Patterns

The application recognizes various natural language patterns:

### Navigation
- "Navigate to https://example.com"
- "Go to the login page"
- "Visit /dashboard"

### Interactions
- "Click the login button"
- "Enter 'admin' in username"
- "Select 'Option A' from dropdown"
- "Upload file.pdf to file input"

### Verifications
- "Verify welcome message is displayed"
- "Check that user is redirected to dashboard"
- "Assert page title contains 'Dashboard'"

### Advanced Actions
- "Wait for 2 seconds"
- "Take a screenshot"
- "Hover over menu item"
- "Press Enter key"

## 🧪 Testing Strategies

### E2E Testing Pattern
```javascript
// Generated test structure
test('User Login Flow', async ({ page }) => {
  const authHelper = new AuthHelper(page);
  
  // Set authentication headers
  await authHelper.setAuthHeaders({
    'Authorization': 'Bearer your-token'
  });
  
  // Test steps
  await page.goto('/login');
  await page.fill('[data-testid="username"]', 'admin');
  await page.fill('[data-testid="password"]', 'password');
  await page.click('[data-testid="login-button"]');
  
  // Assertions
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('text=Welcome')).toBeVisible();
});
```

## 🐛 Troubleshooting

### Common Issues

#### MCP Server Connection Failed
```bash
# Check if server is running
npm run server

# Verify WebSocket connection
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: test" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:8080/mcp
```

#### Test Generation Issues
- Ensure step instructions are clear and specific
- Check that selectors are accessible (use data-testid attributes)
- Verify authentication configuration in Config panel

#### Playwright Browser Issues
```bash
# Reinstall browsers
npx playwright install --force

# Check browser paths
npx playwright install-deps
```

## 🚀 Deployment

### Building for Production
```bash
# Build the application
npm run tauri:build

# The built application will be in src-tauri/target/release/
```

### CI/CD Integration
```yaml
# GitHub Actions example
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install
      - run: npm test
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Playwright](https://playwright.dev/) - Browser automation framework
- [Tauri](https://tauri.app/) - Desktop app framework
- [Svelte](https://svelte.dev/) - UI framework
- [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp) - Model Context Protocol server

---

Built with ❤️ for the automation testing community