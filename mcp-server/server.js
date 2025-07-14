// mcp-server/server.js
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PlaywrightMCPServer {
    constructor(port = 8080) {
        this.port = port;
        this.wss = null;
        this.clients = new Map();
        this.runningTests = new Map();
        this.testResults = new Map();

        // Create directories for test execution
        this.tempDir = path.join(__dirname, 'temp');
        this.resultsDir = path.join(__dirname, 'results');

        this.ensureDirectories();
    }

    async ensureDirectories() {
        await fs.ensureDir(this.tempDir);
        await fs.ensureDir(this.resultsDir);
        await fs.ensureDir(path.join(this.resultsDir, 'screenshots'));
        await fs.ensureDir(path.join(this.resultsDir, 'videos'));
    }

    start() {
        this.wss = new WebSocketServer({
            port: this.port,
            path: '/mcp'
        });

        this.wss.on('connection', (ws, req) => {
            const clientId = uuidv4();
            const clientInfo = {
                id: clientId,
                ws,
                connected: true,
                connectedAt: new Date().toISOString()
            };

            this.clients.set(clientId, clientInfo);

            console.log(`🔌 Client connected: ${clientId} from ${req.socket.remoteAddress}`);

            // Send welcome message
            this.sendMessage(ws, {
                type: 'connection',
                status: 'connected',
                clientId,
                serverInfo: {
                    name: 'Playwright MCP Server',
                    version: '1.0.0',
                    capabilities: ['test_execution', 'real_time_logs', 'screenshots', 'videos'],
                    supportedBrowsers: ['chromium', 'firefox', 'webkit']
                }
            });

            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    await this.handleMessage(clientId, message);
                } catch (error) {
                    console.error('❌ Error parsing message:', error);
                    this.sendError(ws, 'Invalid JSON message', error.message);
                }
            });

            ws.on('close', (code, reason) => {
                console.log(`🔌 Client disconnected: ${clientId} (${code}: ${reason})`);
                this.clients.delete(clientId);
            });

            ws.on('error', (error) => {
                console.error(`❌ WebSocket error for client ${clientId}:`, error);
                this.clients.delete(clientId);
            });
        });

        console.log(`🚀 Playwright MCP Server started on ws://localhost:${this.port}/mcp`);
        console.log(`📁 Temp directory: ${this.tempDir}`);
        console.log(`📊 Results directory: ${this.resultsDir}`);
    }

    async handleMessage(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client) return;

        console.log(`📨 Received message from ${clientId}:`, message.type);

        try {
            switch (message.type) {
                case 'ping':
                    this.sendMessage(client.ws, { type: 'pong', timestamp: Date.now() });
                    break;

                case 'run_test':
                    await this.handleRunTest(clientId, message);
                    break;

                case 'get_test_status':
                    await this.handleGetTestStatus(clientId, message);
                    break;

                case 'stop_test':
                    await this.handleStopTest(clientId, message);
                    break;

                case 'get_results':
                    await this.handleGetResults(clientId, message);
                    break;

                case 'list_browsers':
                    this.handleListBrowsers(clientId);
                    break;

                default:
                    this.sendError(client.ws, 'Unknown message type', `Type '${message.type}' is not supported`);
            }
        } catch (error) {
            console.error(`❌ Error handling message:`, error);
            this.sendError(client.ws, 'Message handling error', error.message);
        }
    }

    async handleRunTest(clientId, message) {
        const client = this.clients.get(clientId);
        const { testCode, config = {}, testId } = message;

        if (!testCode) {
            this.sendError(client.ws, 'Missing test code', 'testCode is required');
            return;
        }

        const executionId = testId || uuidv4();
        const testDir = path.join(this.tempDir, executionId);

        try {
            // Create test directory
            await fs.ensureDir(testDir);

            // Write test file
            const testFile = path.join(testDir, 'test.spec.js');
            await fs.writeFile(testFile, testCode);

            // Write Playwright config
            const playwrightConfig = this.generatePlaywrightConfig(config, executionId);
            const configFile = path.join(testDir, 'playwright.config.js');
            await fs.writeFile(configFile, playwrightConfig);

            // Start test execution
            this.sendMessage(client.ws, {
                type: 'test_started',
                executionId,
                status: 'running',
                timestamp: Date.now()
            });

            const testProcess = await this.executeTest(testDir, executionId, clientId);
            this.runningTests.set(executionId, {
                process: testProcess,
                clientId,
                startedAt: Date.now(),
                config,
                testDir
            });

        } catch (error) {
            console.error(`❌ Error running test:`, error);
            this.sendError(client.ws, 'Test execution failed', error.message);
        }
    }

    async executeTest(testDir, executionId, clientId) {
        const client = this.clients.get(clientId);

        return new Promise((resolve, reject) => {
            const npxPath = process.platform === 'win32' ? 'npx.cmd' : 'npx';
            const testProcess = spawn(npxPath, [
                'playwright', 'test',
                '--config=playwright.config.js',
                '--reporter=json'
            ], {
                cwd: testDir,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            testProcess.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;

                // Send real-time logs
                this.sendMessage(client.ws, {
                    type: 'test_log',
                    executionId,
                    log: {
                        type: 'stdout',
                        message: output,
                        timestamp: Date.now()
                    }
                });
            });

            testProcess.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;

                // Send real-time logs
                this.sendMessage(client.ws, {
                    type: 'test_log',
                    executionId,
                    log: {
                        type: 'stderr',
                        message: output,
                        timestamp: Date.now()
                    }
                });
            });

            testProcess.on('close', async (code) => {
                console.log(`📋 Test ${executionId} finished with code: ${code}`);

                try {
                    // Parse test results
                    const results = await this.parseTestResults(testDir, stdout, stderr, code);

                    // Store results
                    this.testResults.set(executionId, {
                        ...results,
                        executionId,
                        finishedAt: Date.now(),
                        exitCode: code
                    });

                    // Send completion message with enhanced error details
                    const enhancedMessage = {
                        type: 'test_completed',
                        executionId,
                        results,
                        status: code === 0 ? 'passed' : 'failed',
                        exitCode: code,
                        timestamp: Date.now(),
                        // Enhanced error information
                        detailedResults: {
                            summary: results.summary || {},
                            tests: results.tests || [],
                            stdout: results.stdout || '',
                            stderr: results.stderr || '',
                            duration: results.duration || 0,
                            error: results.error || null
                        }
                    };
                    console.log('🔍 Sending enhanced test completion message:', JSON.stringify(enhancedMessage, null, 2));
                    this.sendMessage(client.ws, enhancedMessage);

                    // Clean up
                    this.runningTests.delete(executionId);

                    resolve(results);
                } catch (error) {
                    console.error(`❌ Error processing test results:`, error);
                    this.sendError(client.ws, 'Result processing failed', error.message);
                    reject(error);
                }
            });

            testProcess.on('error', (error) => {
                console.error(`❌ Test process error:`, error);
                this.sendError(client.ws, 'Test process failed', error.message);
                this.runningTests.delete(executionId);
                reject(error);
            });
        });
    }

    generatePlaywrightConfig(config, executionId) {
        const browser = config.browser || 'chromium';
        const headless = config.headless !== false;
        const timeout = config.timeout || 30000;

        return `// playwright.config.js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: ${timeout},
  expect: {
    timeout: 5000,
  },
  fullyParallel: ${config.parallel || false},
  forbidOnly: !!process.env.CI,
  retries: ${config.retries || 0},
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['json', { outputFile: 'test-results.json' }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL: '${config.baseURL || 'http://localhost:3000'}',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: ${headless},
  },
  projects: [
    {
      name: '${browser}',
      use: { 
        ...devices['Desktop ${browser.charAt(0).toUpperCase() + browser.slice(1)}'] 
      },
    },
  ],
});`;
    }

    async parseTestResults(testDir, stdout, stderr, exitCode) {
        try {
            // Try to read JSON results
            const resultsFile = path.join(testDir, 'test-results.json');
            let results = {
                status: exitCode === 0 ? 'passed' : 'failed',
                tests: [],
                summary: {
                    total: 0,
                    passed: 0,
                    failed: 0,
                    skipped: 0
                },
                duration: 0,
                stdout,
                stderr
            };

            if (await fs.pathExists(resultsFile)) {
                const jsonResults = await fs.readJson(resultsFile);

                results.tests = jsonResults.suites?.flatMap(suite =>
                    suite.specs?.map(spec => ({
                        title: spec.title,
                        status: spec.tests?.[0]?.results?.[0]?.status || 'unknown',
                        duration: spec.tests?.[0]?.results?.[0]?.duration || 0,
                        error: spec.tests?.[0]?.results?.[0]?.error?.message
                    })) || []
                ) || [];

                results.summary = {
                    total: results.tests.length,
                    passed: results.tests.filter(t => t.status === 'passed').length,
                    failed: results.tests.filter(t => t.status === 'failed').length,
                    skipped: results.tests.filter(t => t.status === 'skipped').length
                };

                results.duration = jsonResults.stats?.duration || 0;
            }

            return results;
        } catch (error) {
            console.error('❌ Error parsing test results:', error);
            return {
                status: 'error',
                error: error.message,
                stdout,
                stderr
            };
        }
    }

    handleListBrowsers(clientId) {
        const client = this.clients.get(clientId);
        this.sendMessage(client.ws, {
            type: 'browsers_list',
            browsers: [
                { name: 'chromium', displayName: 'Chromium', supported: true },
                { name: 'firefox', displayName: 'Firefox', supported: true },
                { name: 'webkit', displayName: 'WebKit (Safari)', supported: true }
            ]
        });
    }

    async handleGetTestStatus(clientId, message) {
        const client = this.clients.get(clientId);
        const { executionId } = message;

        const runningTest = this.runningTests.get(executionId);
        const result = this.testResults.get(executionId);

        if (runningTest) {
            this.sendMessage(client.ws, {
                type: 'test_status',
                executionId,
                status: 'running',
                startedAt: runningTest.startedAt
            });
        } else if (result) {
            this.sendMessage(client.ws, {
                type: 'test_status',
                executionId,
                status: 'completed',
                results: result
            });
        } else {
            this.sendMessage(client.ws, {
                type: 'test_status',
                executionId,
                status: 'not_found'
            });
        }
    }

    async handleStopTest(clientId, message) {
        const client = this.clients.get(clientId);
        const { executionId } = message;

        const runningTest = this.runningTests.get(executionId);
        if (runningTest) {
            runningTest.process.kill('SIGTERM');
            this.runningTests.delete(executionId);

            this.sendMessage(client.ws, {
                type: 'test_stopped',
                executionId,
                timestamp: Date.now()
            });
        } else {
            this.sendError(client.ws, 'Test not found', `No running test with ID: ${executionId}`);
        }
    }

    async handleGetResults(clientId, message) {
        const client = this.clients.get(clientId);
        const { executionId } = message;

        const result = this.testResults.get(executionId);
        if (result) {
            this.sendMessage(client.ws, {
                type: 'test_results',
                executionId,
                results: result
            });
        } else {
            this.sendError(client.ws, 'Results not found', `No results for execution ID: ${executionId}`);
        }
    }

    sendMessage(ws, message) {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    sendError(ws, error, details) {
        this.sendMessage(ws, {
            type: 'error',
            error,
            details,
            timestamp: Date.now()
        });
    }

    stop() {
        if (this.wss) {
            this.wss.close();
            console.log('🛑 MCP Server stopped');
        }
    }
}

// Start the server
const server = new PlaywrightMCPServer(8080);
server.start();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down MCP server...');
    server.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down MCP server...');
    server.stop();
    process.exit(0);
});