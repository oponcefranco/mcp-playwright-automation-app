// src/mcp/server.js
import { WebSocketServer } from 'ws';
import { chromium } from 'playwright';
import { spawn, exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PlaywrightMCPServer {
    constructor(port = 8080) {
        this.port = port;
        this.wss = null;
        this.browser = null;
        this.context = null;
        this.page = null;
        this.clients = new Map();
        this.activeSessions = new Map();
        this.testQueue = [];
        this.isProcessingQueue = false;
        this.serverInfo = {
            name: 'Playwright MCP Server',
            version: '1.0.0',
            capabilities: [
                'browser_automation',
                'test_execution',
                'screenshot',
                'network_monitoring',
                'file_operations',
                'parallel_execution',
                'video_recording'
            ],
            supportedBrowsers: ['chromium', 'firefox', 'webkit'],
            maxConcurrentTests: 5,
            status: 'initializing'
        };
    }

    async start() {
        console.log('🚀 Starting Playwright MCP Server...');

        try {
            // Initialize WebSocket server
            this.wss = new WebSocketServer({
                port: this.port,
                perMessageDeflate: false,
                clientTracking: true
            });

            this.wss.on('connection', (ws, request) => {
                this.handleNewConnection(ws, request);
            });

            this.wss.on('error', (error) => {
                console.error('WebSocket Server Error:', error);
            });

            // Initialize default browser
            await this.initializeBrowser('chromium');

            this.serverInfo.status = 'running';

            console.log(`🎭 Playwright MCP Server running on ws://localhost:${this.port}`);
            console.log('📋 Available capabilities:', this.serverInfo.capabilities.join(', '));
            console.log('🌐 Supported browsers:', this.serverInfo.supportedBrowsers.join(', '));
            console.log('✅ Server ready to accept automation requests!');

            // Set up graceful shutdown
            this.setupGracefulShutdown();

        } catch (error) {
            console.error('❌ Failed to start MCP server:', error);
            this.serverInfo.status = 'error';
            throw error;
        }
    }

    handleNewConnection(ws, request) {
        const clientId = this.generateClientId();
        const clientInfo = {
            id: clientId,
            ws: ws,
            ip: request.socket.remoteAddress,
            userAgent: request.headers['user-agent'],
            connectedAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            activeTests: 0
        };

        this.clients.set(clientId, clientInfo);

        console.log(`📱 Client connected: ${clientId} from ${clientInfo.ip}`);

        ws.on('message', async (data) => {
            try {
                clientInfo.lastActivity = new Date().toISOString();
                const message = JSON.parse(data.toString());
                await this.handleMessage(clientId, message);
            } catch (error) {
                console.error(`Error handling message from ${clientId}:`, error);
                this.sendError(ws, 'Invalid message format', error.message);
            }
        });

        ws.on('close', (code, reason) => {
            console.log(`📱 Client disconnected: ${clientId} (Code: ${code}, Reason: ${reason})`);
            this.handleClientDisconnect(clientId);
        });

        ws.on('error', (error) => {
            console.error(`WebSocket error for client ${clientId}:`, error);
            this.handleClientDisconnect(clientId);
        });

        // Send welcome message
        this.send(ws, {
            type: 'connection_established',
            clientId: clientId,
            serverInfo: this.serverInfo,
            timestamp: new Date().toISOString()
        });
    }

    handleClientDisconnect(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            // Cancel any active tests for this client
            this.cancelClientTests(clientId);
            this.clients.delete(clientId);
        }
    }

    async handleMessage(clientId, message) {
        const ws = this.clients.get(clientId)?.ws;
        if (!ws) return;

        const { type, requestId, data } = message;

        console.log(`📨 Message from ${clientId}: ${type} ${requestId ? `(${requestId})` : ''}`);

        try {
            switch (type) {
                case 'handshake':
                    await this.handleHandshake(ws, message);
                    break;

                case 'run_test':
                    await this.handleRunTest(ws, clientId, message);
                    break;

                case 'browser_action':
                    await this.handleBrowserAction(ws, message);
                    break;

                case 'file_operation':
                    await this.handleFileOperation(ws, message);
                    break;

                case 'network_monitor':
                    await this.handleNetworkMonitor(ws, message);
                    break;

                case 'get_server_status':
                    await this.handleGetServerStatus(ws, message);
                    break;

                case 'cancel_test':
                    await this.handleCancelTest(ws, clientId, message);
                    break;

                case 'ping':
                    this.send(ws, {
                        type: 'pong',
                        timestamp: new Date().toISOString(),
                        requestId
                    });
                    break;

                default:
                    this.sendError(ws, `Unknown message type: ${type}`, null, requestId);
            }
        } catch (error) {
            console.error(`Error handling ${type} from ${clientId}:`, error);
            this.sendError(ws, `Error processing ${type}`, error.message, requestId);
        }
    }

    async handleHandshake(ws, message) {
        const { data } = message;

        const response = {
            type: 'handshake_response',
            data: {
                ...this.serverInfo,
                clientCapabilities: data,
                sessionId: this.generateSessionId(),
                protocols: ['playwright-mcp-v1'],
                features: {
                    parallelExecution: true,
                    videoRecording: true,
                    networkInterception: true,
                    mobileEmulation: true,
                    crossBrowserTesting: true
                }
            },
            timestamp: new Date().toISOString()
        };

        this.send(ws, response);
    }

    async handleRunTest(ws, clientId, message) {
        const { requestId, data } = message;
        const { testCode, options = {} } = data;

        try {
            console.log(`🧪 Running test for client ${clientId}, request ${requestId}`);

            // Add test to queue
            const testSession = {
                id: this.generateTestId(),
                clientId,
                requestId,
                testCode,
                options,
                status: 'queued',
                createdAt: new Date().toISOString(),
                ws
            };

            this.testQueue.push(testSession);
            this.activeSessions.set(testSession.id, testSession);

            // Increment client's active test count
            const client = this.clients.get(clientId);
            if (client) {
                client.activeTests++;
            }

            // Send queued confirmation
            this.send(ws, {
                type: 'test_queued',
                requestId,
                data: {
                    testId: testSession.id,
                    queuePosition: this.testQueue.length,
                    estimatedWaitTime: this.estimateWaitTime()
                }
            });

            // Process queue
            this.processTestQueue();

        } catch (error) {
            console.error('Test execution error:', error);
            this.sendTestResult(ws, requestId, {
                status: 'failed',
                error: error.message,
                stack: error.stack,
                testId: null
            });
        }
    }

    async processTestQueue() {
        if (this.isProcessingQueue || this.testQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            while (this.testQueue.length > 0) {
                const activeSessions = Array.from(this.activeSessions.values())
                    .filter(session => session.status === 'running').length;

                if (activeSessions >= this.serverInfo.maxConcurrentTests) {
                    console.log(`⏳ Max concurrent tests reached (${activeSessions}), waiting...`);
                    break;
                }

                const testSession = this.testQueue.shift();
                if (testSession) {
                    this.executeTestSession(testSession);
                }
            }
        } finally {
            this.isProcessingQueue = false;
        }
    }

    async executeTestSession(testSession) {
        const { id, clientId, requestId, testCode, options, ws } = testSession;

        try {
            testSession.status = 'running';
            testSession.startedAt = new Date().toISOString();

            console.log(`🚀 Executing test ${id} for client ${clientId}`);

            // Send test started notification
            this.send(ws, {
                type: 'test_started',
                requestId,
                data: {
                    testId: id,
                    startedAt: testSession.startedAt
                }
            });

            // Initialize browser if needed
            const browserType = options.browser || 'chromium';
            if (!this.browser || this.currentBrowserType !== browserType) {
                await this.initializeBrowser(browserType);
            }

            // Execute the test
            const result = await this.executeTest(testSession);

            // Send test result
            this.sendTestResult(ws, requestId, result);

        } catch (error) {
            console.error(`Test execution error for ${id}:`, error);
            this.sendTestResult(ws, requestId, {
                status: 'failed',
                error: error.message,
                stack: error.stack,
                testId: id
            });
        } finally {
            // Clean up session
            testSession.status = 'completed';
            testSession.completedAt = new Date().toISOString();

            // Decrement client's active test count
            const client = this.clients.get(clientId);
            if (client && client.activeTests > 0) {
                client.activeTests--;
            }

            // Continue processing queue
            setTimeout(() => this.processTestQueue(), 100);
        }
    }

    async executeTest(testSession) {
        const { testCode, options = {} } = testSession;
        const startTime = Date.now();

        try {
            // Create isolated test execution environment
            const testId = testSession.id;
            const tempDir = path.join(os.tmpdir(), 'playwright-mcp', testId);
            await fs.mkdir(tempDir, { recursive: true });

            // Prepare test file
            const testFile = path.join(tempDir, `test-${testId}.spec.js`);
            const enhancedTestCode = this.enhanceTestCode(testCode, options);
            await fs.writeFile(testFile, enhancedTestCode);

            // Prepare Playwright config
            const configFile = path.join(tempDir, 'playwright.config.js');
            const config = this.generatePlaywrightConfig(options, tempDir);
            await fs.writeFile(configFile, config);

            // Execute test using Playwright CLI
            const result = await this.runPlaywrightTest(testFile, configFile, options);

            // Process results
            const processedResult = await this.processTestResults(result, tempDir, testId);

            // Clean up (optional - keep for debugging)
            if (!options.keepTempFiles) {
                await this.cleanupTempDir(tempDir);
            }

            const duration = Date.now() - startTime;

            return {
                status: processedResult.success ? 'passed' : 'failed',
                duration,
                output: processedResult.output,
                error: processedResult.error,
                testId,
                artifacts: processedResult.artifacts,
                metrics: processedResult.metrics,
                config: options
            };

        } catch (error) {
            const duration = Date.now() - startTime;

            return {
                status: 'failed',
                duration,
                error: error.message,
                stack: error.stack,
                testId: testSession.id
            };
        }
    }

    enhanceTestCode(testCode, options) {
        const imports = `import { test, expect } from '@playwright/test';`;

        const authSetup = options.auth ? `
// Authentication setup
test.beforeEach(async ({ page }) => {
  ${this.generateAuthCode(options.auth)}
});` : '';

        const baseUrlSetup = options.baseURL ? `
// Base URL configuration
test.use({ baseURL: '${options.baseURL}' });` : '';

        return `${imports}
${baseUrlSetup}
${authSetup}

${testCode}`;
    }

    generateAuthCode(auth) {
        if (!auth) return '';

        switch (auth.type) {
            case 'bearer':
                return `await page.setExtraHTTPHeaders({
    'Authorization': 'Bearer ${auth.token}'
  });`;

            case 'basic':
                const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
                return `await page.setExtraHTTPHeaders({
    'Authorization': 'Basic ${encoded}'
  });`;

            case 'custom':
                const headers = JSON.stringify(auth.headers, null, 4);
                return `await page.setExtraHTTPHeaders(${headers});`;

            case 'cookies':
                const cookies = JSON.stringify(auth.cookies, null, 4);
                return `await page.context().addCookies(${cookies});`;

            default:
                return '';
        }
    }

    generatePlaywrightConfig(options, outputDir) {
        return `const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  outputDir: '${outputDir}/results',
  timeout: ${options.timeout || 30000},
  retries: ${options.retries || 0},
  workers: 1,
  
  use: {
    headless: ${options.headless !== false},
    viewport: ${JSON.stringify(options.viewport || { width: 1280, height: 720 })},
    ignoreHTTPSErrors: true,
    video: '${options.video ? 'retain-on-failure' : 'off'}',
    screenshot: '${options.screenshot || 'only-on-failure'}',
    trace: '${options.trace || 'on-first-retry'}',
    ${options.userAgent ? `userAgent: '${options.userAgent}',` : ''}
    ${options.baseURL ? `baseURL: '${options.baseURL}',` : ''}
  },

  projects: [{
    name: '${options.browser || 'chromium'}',
    use: { 
      channel: '${options.channel || 'chrome'}' 
    }
  }],

  reporter: [
    ['json', { outputFile: '${outputDir}/results.json' }],
    ['html', { outputFolder: '${outputDir}/html-report' }]
  ]
});`;
    }

    async runPlaywrightTest(testFile, configFile, options) {
        return new Promise((resolve) => {
            const args = [
                'test',
                testFile,
                '--config',
                configFile,
                '--reporter=json'
            ];

            if (options.headed) {
                args.push('--headed');
            }

            if (options.debug) {
                args.push('--debug');
            }

            const child = spawn('npx', ['playwright', ...args], {
                stdio: 'pipe',
                cwd: path.dirname(testFile),
                env: { ...process.env, ...options.env }
            });

            let output = '';
            let error = '';

            child.stdout.on('data', (data) => {
                output += data.toString();
            });

            child.stderr.on('data', (data) => {
                error += data.toString();
            });

            child.on('close', (code) => {
                resolve({
                    success: code === 0,
                    output,
                    error: error || null,
                    exitCode: code
                });
            });

            child.on('error', (err) => {
                resolve({
                    success: false,
                    output,
                    error: err.message,
                    exitCode: -1
                });
            });

            // Set timeout
            const timeout = options.timeout || 60000;
            setTimeout(() => {
                child.kill('SIGTERM');
                resolve({
                    success: false,
                    output,
                    error: 'Test execution timeout',
                    exitCode: -1
                });
            }, timeout + 10000); // Add buffer to Playwright timeout
        });
    }

    async processTestResults(result, tempDir, testId) {
        const artifacts = {
            screenshots: [],
            videos: [],
            traces: [],
            reports: []
        };

        const metrics = {
            testDuration: 0,
            stepCount: 0,
            networkRequests: 0,
            consoleMessages: 0
        };

        try {
            // Parse JSON report if available
            const reportPath = path.join(tempDir, 'results.json');
            if (await this.fileExists(reportPath)) {
                const reportData = await fs.readFile(reportPath, 'utf8');
                const report = JSON.parse(reportData);

                artifacts.reports.push({
                    type: 'json',
                    path: reportPath,
                    data: report
                });

                // Extract metrics from report
                if (report.stats) {
                    metrics.testDuration = report.stats.duration || 0;
                }
            }

            // Collect artifacts from results directory
            const resultsDir = path.join(tempDir, 'results');
            if (await this.fileExists(resultsDir)) {
                await this.collectArtifacts(resultsDir, artifacts);
            }

        } catch (error) {
            console.error('Error processing test results:', error);
        }

        return {
            ...result,
            artifacts,
            metrics
        };
    }

    async collectArtifacts(directory, artifacts) {
        try {
            const files = await fs.readdir(directory, { withFileTypes: true });

            for (const file of files) {
                const filePath = path.join(directory, file.name);

                if (file.isDirectory()) {
                    await this.collectArtifacts(filePath, artifacts);
                } else {
                    const ext = path.extname(file.name).toLowerCase();

                    if (['.png', '.jpg', '.jpeg'].includes(ext)) {
                        artifacts.screenshots.push(filePath);
                    } else if (['.webm', '.mp4'].includes(ext)) {
                        artifacts.videos.push(filePath);
                    } else if (ext === '.zip' && file.name.includes('trace')) {
                        artifacts.traces.push(filePath);
                    }
                }
            }
        } catch (error) {
            console.error('Error collecting artifacts:', error);
        }
    }

    async handleBrowserAction(ws, message) {
        const { action, requestId, data } = message;

        try {
            let result;

            // Initialize browser if not available
            if (!this.browser) {
                await this.initializeBrowser();
            }

            switch (action) {
                case 'navigate':
                    await this.page.goto(data.url, { waitUntil: 'networkidle' });
                    result = { success: true, url: data.url, title: await this.page.title() };
                    break;

                case 'screenshot':
                    const screenshot = await this.page.screenshot({
                        encoding: 'base64',
                        fullPage: data.fullPage || false,
                        type: data.type || 'png'
                    });
                    result = {
                        screenshot: `data:image/${data.type || 'png'};base64,${screenshot}`,
                        timestamp: new Date().toISOString()
                    };
                    break;

                case 'get_title':
                    result = { title: await this.page.title() };
                    break;

                case 'get_url':
                    result = { url: this.page.url() };
                    break;

                case 'get_content':
                    result = { content: await this.page.content() };
                    break;

                case 'evaluate':
                    const evalResult = await this.page.evaluate(data.script);
                    result = { result: evalResult };
                    break;

                case 'click':
                    await this.page.click(data.selector);
                    result = { success: true };
                    break;

                case 'fill':
                    await this.page.fill(data.selector, data.value);
                    result = { success: true };
                    break;

                case 'select':
                    await this.page.selectOption(data.selector, data.value);
                    result = { success: true };
                    break;

                case 'wait_for_selector':
                    await this.page.waitForSelector(data.selector, {
                        timeout: data.timeout || 30000
                    });
                    result = { success: true };
                    break;

                case 'pdf':
                    if (this.currentBrowserType !== 'chromium') {
                        throw new Error('PDF generation is only supported in Chromium');
                    }
                    const pdf = await this.page.pdf({
                        format: data.format || 'A4',
                        printBackground: data.printBackground || true
                    });
                    result = {
                        pdf: pdf.toString('base64'),
                        timestamp: new Date().toISOString()
                    };
                    break;

                default:
                    throw new Error(`Unknown browser action: ${action}`);
            }

            this.send(ws, {
                type: 'browser_event',
                requestId,
                data: result,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Browser action error:', error);
            this.sendError(ws, `Browser action failed: ${action}`, error.message, requestId);
        }
    }

    async handleFileOperation(ws, message) {
        const { operation, requestId, data } = message;

        try {
            let result;

            switch (operation) {
                case 'read':
                    const content = await fs.readFile(data.path, data.encoding || 'utf8');
                    result = { content, path: data.path };
                    break;

                case 'write':
                    await fs.writeFile(data.path, data.content, data.encoding || 'utf8');
                    result = { success: true, path: data.path };
                    break;

                case 'exists':
                    result = { exists: await this.fileExists(data.path) };
                    break;

                case 'list':
                    const files = await fs.readdir(data.path, { withFileTypes: true });
                    result = {
                        files: files.map(f => ({
                            name: f.name,
                            isDirectory: f.isDirectory(),
                            isFile: f.isFile()
                        }))
                    };
                    break;

                case 'mkdir':
                    await fs.mkdir(data.path, { recursive: true });
                    result = { success: true, path: data.path };
                    break;

                case 'delete':
                    await fs.unlink(data.path);
                    result = { success: true, path: data.path };
                    break;

                default:
                    throw new Error(`Unknown file operation: ${operation}`);
            }

            this.send(ws, {
                type: 'file_operation_result',
                requestId,
                data: result
            });

        } catch (error) {
            this.sendError(ws, `File operation failed: ${operation}`, error.message, requestId);
        }
    }

    async handleNetworkMonitor(ws, message) {
        const { action, requestId, data } = message;

        try {
            if (!this.page) {
                throw new Error('No active page for network monitoring');
            }

            switch (action) {
                case 'start':
                    this.page.on('request', (request) => {
                        this.send(ws, {
                            type: 'network_event',
                            data: {
                                type: 'request',
                                url: request.url(),
                                method: request.method(),
                                headers: request.headers(),
                                timestamp: new Date().toISOString()
                            }
                        });
                    });

                    this.page.on('response', (response) => {
                        this.send(ws, {
                            type: 'network_event',
                            data: {
                                type: 'response',
                                url: response.url(),
                                status: response.status(),
                                headers: response.headers(),
                                timestamp: new Date().toISOString()
                            }
                        });
                    });

                    this.send(ws, {
                        type: 'network_monitor_result',
                        requestId,
                        data: { status: 'started' }
                    });
                    break;

                case 'stop':
                    this.page.removeAllListeners('request');
                    this.page.removeAllListeners('response');

                    this.send(ws, {
                        type: 'network_monitor_result',
                        requestId,
                        data: { status: 'stopped' }
                    });
                    break;

                default:
                    throw new Error(`Unknown network monitor action: ${action}`);
            }

        } catch (error) {
            this.sendError(ws, `Network monitor failed: ${action}`, error.message, requestId);
        }
    }

    async handleGetServerStatus(ws, message) {
        const { requestId } = message;

        const status = {
            ...this.serverInfo,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            activeClients: this.clients.size,
            activeSessions: this.activeSessions.size,
            queueLength: this.testQueue.length,
            browserStatus: {
                type: this.currentBrowserType,
                connected: !!this.browser,
                contextActive: !!this.context,
                pageActive: !!this.page
            },
            timestamp: new Date().toISOString()
        };

        this.send(ws, {
            type: 'server_status',
            requestId,
            data: status
        });
    }

    async handleCancelTest(ws, clientId, message) {
        const { requestId, data } = message;
        const { testId } = data;

        try {
            const session = this.activeSessions.get(testId);
            if (!session || session.clientId !== clientId) {
                throw new Error('Test not found or not owned by client');
            }

            // Remove from queue if queued
            const queueIndex = this.testQueue.findIndex(t => t.id === testId);
            if (queueIndex !== -1) {
                this.testQueue.splice(queueIndex, 1);
            }

            // Mark as cancelled
            session.status = 'cancelled';
            session.cancelledAt = new Date().toISOString();

            this.send(ws, {
                type: 'test_cancelled',
                requestId,
                data: { testId, status: 'cancelled' }
            });

        } catch (error) {
            this.sendError(ws, 'Failed to cancel test', error.message, requestId);
        }
    }

    async initializeBrowser(browserType = 'chromium') {
        try {
            console.log(`🌐 Initializing ${browserType} browser...`);

            // Close existing browser if different type
            if (this.browser && this.currentBrowserType !== browserType) {
                await this.browser.close();
                this.browser = null;
                this.context = null;
                this.page = null;
            }

            if (!this.browser) {
                const browserOptions = {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor'
                    ]
                };

                switch (browserType) {
                    case 'firefox':
                        this.browser = await firefox.launch(browserOptions);
                        break;
                    case 'webkit':
                        this.browser = await webkit.launch(browserOptions);
                        break;
                    default:
                        this.browser = await chromium.launch(browserOptions);
                }

                this.currentBrowserType = browserType;
            }

            if (!this.context) {
                this.context = await this.browser.newContext({
                    viewport: { width: 1280, height: 720 },
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                });
            }

            if (!this.page) {
                this.page = await this.context.newPage();

                // Set up global page event listeners
                this.page.on('console', (msg) => {
                    console.log(`📄 Page console [${msg.type()}]:`, msg.text());
                });

                this.page.on('pageerror', (error) => {
                    console.error('📄 Page error:', error.message);
                });

                this.page.on('crash', () => {
                    console.error('📄 Page crashed!');
                    this.page = null;
                });
            }

            console.log(`✅ ${browserType} browser initialized successfully`);

        } catch (error) {
            console.error(`❌ Failed to initialize ${browserType} browser:`, error);
            throw error;
        }
    }

    send(ws, message) {
        if (ws.readyState === ws.OPEN) {
            try {
                ws.send(JSON.stringify(message));
            } catch (error) {
                console.error('Error sending message:', error);
            }
        }
    }

    sendError(ws, message, details = null, requestId = null) {
        this.send(ws, {
            type: 'error',
            message,
            details,
            requestId,
            timestamp: new Date().toISOString()
        });
    }

    sendTestResult(ws, requestId, result) {
        this.send(ws, {
            type: 'test_result',
            requestId,
            data: result,
            timestamp: new Date().toISOString()
        });
    }

    cancelClientTests(clientId) {
        // Cancel all active tests for the client
        const clientSessions = Array.from(this.activeSessions.values())
            .filter(session => session.clientId === clientId);

        clientSessions.forEach(session => {
            session.status = 'cancelled';
            session.cancelledAt = new Date().toISOString();
        });

        // Remove from queue
        this.testQueue = this.testQueue.filter(test => test.clientId !== clientId);
    }

    generateClientId() {
        return `client-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    }

    generateSessionId() {
        return `session-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    }

    generateTestId() {
        return `test-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    }

    estimateWaitTime() {
        const avgTestTime = 30000; // 30 seconds average
        const queueLength = this.testQueue.length;
        const activeTests = Array.from(this.activeSessions.values())
            .filter(s => s.status === 'running').length;

        const slotsAvailable = Math.max(0, this.serverInfo.maxConcurrentTests - activeTests);
        const waitTime = slotsAvailable > 0 ? 0 : (queueLength * avgTestTime) / this.serverInfo.maxConcurrentTests;

        return Math.round(waitTime);
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async cleanupTempDir(directory) {
        try {
            await fs.rm(directory, { recursive: true, force: true });
        } catch (error) {
            console.error('Error cleaning up temp directory:', error);
        }
    }

    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
            await this.stop();
            process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
        process.on('SIGQUIT', shutdown);

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('❌ Uncaught Exception:', error);
            this.stop().then(() => process.exit(1));
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
            this.stop().then(() => process.exit(1));
        });
    }

    async stop() {
        console.log('🛑 Stopping Playwright MCP Server...');

        try {
            this.serverInfo.status = 'stopping';

            // Cancel all active tests
            console.log('⏹️ Cancelling active tests...');
            Array.from(this.activeSessions.values()).forEach(session => {
                if (session.status === 'running' || session.status === 'queued') {
                    session.status = 'cancelled';
                    session.cancelledAt = new Date().toISOString();

                    if (session.ws && session.ws.readyState === session.ws.OPEN) {
                        this.send(session.ws, {
                            type: 'test_cancelled',
                            data: { testId: session.id, reason: 'server_shutdown' }
                        });
                    }
                }
            });

            // Close all client connections
            console.log('🔌 Closing client connections...');
            this.clients.forEach((client, clientId) => {
                if (client.ws.readyState === client.ws.OPEN) {
                    this.send(client.ws, {
                        type: 'server_shutdown',
                        message: 'Server is shutting down',
                        timestamp: new Date().toISOString()
                    });
                    client.ws.close(1001, 'Server shutdown');
                }
            });

            // Close browser
            if (this.browser) {
                console.log('🌐 Closing browser...');
                await this.browser.close();
                this.browser = null;
                this.context = null;
                this.page = null;
            }

            // Close WebSocket server
            if (this.wss) {
                console.log('🔌 Closing WebSocket server...');
                this.wss.close();
                this.wss = null;
            }

            // Clean up temp directories
            console.log('🧹 Cleaning up temporary files...');
            const tempDir = path.join(os.tmpdir(), 'playwright-mcp');
            if (await this.fileExists(tempDir)) {
                await this.cleanupTempDir(tempDir);
            }

            this.serverInfo.status = 'stopped';
            console.log('✅ Playwright MCP Server stopped successfully');

        } catch (error) {
            console.error('❌ Error during shutdown:', error);
            this.serverInfo.status = 'error';
        }
    }

    // Health check endpoint simulation
    getHealthStatus() {
        return {
            status: this.serverInfo.status,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            clients: this.clients.size,
            activeSessions: this.activeSessions.size,
            queueLength: this.testQueue.length,
            browser: {
                type: this.currentBrowserType,
                connected: !!this.browser
            },
            timestamp: new Date().toISOString()
        };
    }

    // Performance monitoring
    getPerformanceMetrics() {
        const sessions = Array.from(this.activeSessions.values());
        const completedSessions = sessions.filter(s => s.status === 'completed');

        let totalDuration = 0;
        let successCount = 0;

        completedSessions.forEach(session => {
            if (session.startedAt && session.completedAt) {
                const duration = new Date(session.completedAt) - new Date(session.startedAt);
                totalDuration += duration;

                if (session.result && session.result.status === 'passed') {
                    successCount++;
                }
            }
        });

        const avgDuration = completedSessions.length > 0 ? totalDuration / completedSessions.length : 0;
        const successRate = completedSessions.length > 0 ? (successCount / completedSessions.length) * 100 : 0;

        return {
            totalTests: sessions.length,
            completedTests: completedSessions.length,
            successRate: Math.round(successRate * 100) / 100,
            averageDuration: Math.round(avgDuration),
            activeTests: sessions.filter(s => s.status === 'running').length,
            queuedTests: sessions.filter(s => s.status === 'queued').length,
            timestamp: new Date().toISOString()
        };
    }

    // Broadcast message to all connected clients
    broadcast(message) {
        this.clients.forEach((client) => {
            if (client.ws.readyState === client.ws.OPEN) {
                this.send(client.ws, message);
            }
        });
    }

    // Periodic cleanup of stale sessions
    startPeriodicCleanup() {
        setInterval(() => {
            const now = new Date();
            const staleThreshold = 30 * 60 * 1000; // 30 minutes

            Array.from(this.activeSessions.entries()).forEach(([sessionId, session]) => {
                const lastActivity = new Date(session.createdAt);

                if (now - lastActivity > staleThreshold &&
                    (session.status === 'completed' || session.status === 'cancelled')) {
                    this.activeSessions.delete(sessionId);
                }
            });

            // Clean up disconnected clients
            Array.from(this.clients.entries()).forEach(([clientId, client]) => {
                if (client.ws.readyState !== client.ws.OPEN) {
                    this.clients.delete(clientId);
                }
            });

        }, 5 * 60 * 1000); // Run every 5 minutes
    }

    // Advanced browser management
    async createIsolatedContext(options = {}) {
        if (!this.browser) {
            await this.initializeBrowser();
        }

        const contextOptions = {
            viewport: options.viewport || { width: 1280, height: 720 },
            userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            locale: options.locale || 'en-US',
            timezoneId: options.timezone || 'America/New_York',
            permissions: options.permissions || [],
            geolocation: options.geolocation || null,
            colorScheme: options.colorScheme || 'light',
            extraHTTPHeaders: options.headers || {},
            ignoreHTTPSErrors: options.ignoreHTTPSErrors !== false,
            javaScriptEnabled: options.javaScriptEnabled !== false,
            acceptDownloads: options.acceptDownloads === true,
            recordVideo: options.recordVideo ? {
                dir: options.recordVideo.dir || './videos',
                size: options.recordVideo.size || { width: 1280, height: 720 }
            } : undefined
        };

        if (options.storageState) {
            contextOptions.storageState = options.storageState;
        }

        const context = await this.browser.newContext(contextOptions);

        // Set up authentication if provided
        if (options.auth) {
            const page = await context.newPage();

            switch (options.auth.type) {
                case 'bearer':
                    await page.setExtraHTTPHeaders({
                        'Authorization': `Bearer ${options.auth.token}`
                    });
                    break;

                case 'basic':
                    const credentials = Buffer.from(`${options.auth.username}:${options.auth.password}`).toString('base64');
                    await page.setExtraHTTPHeaders({
                        'Authorization': `Basic ${credentials}`
                    });
                    break;

                case 'cookies':
                    await context.addCookies(options.auth.cookies);
                    break;
            }
        }

        return context;
    }

    // Device emulation capabilities
    async emulateDevice(deviceName) {
        const devices = {
            'iPhone 13': {
                viewport: { width: 390, height: 844 },
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
                deviceScaleFactor: 3,
                isMobile: true,
                hasTouch: true
            },
            'iPad': {
                viewport: { width: 820, height: 1180 },
                userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
                deviceScaleFactor: 2,
                isMobile: true,
                hasTouch: true
            },
            'Galaxy S21': {
                viewport: { width: 384, height: 854 },
                userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36',
                deviceScaleFactor: 2.75,
                isMobile: true,
                hasTouch: true
            }
        };

        const device = devices[deviceName];
        if (!device) {
            throw new Error(`Unknown device: ${deviceName}`);
        }

        if (this.context) {
            await this.context.close();
        }

        this.context = await this.browser.newContext(device);
        this.page = await this.context.newPage();

        return device;
    }
}

// Helper function to start server if this file is run directly
async function startServer() {
    const port = process.env.MCP_PORT || 8080;
    const server = new PlaywrightMCPServer(port);

    try {
        await server.start();

        // Start periodic cleanup
        server.startPeriodicCleanup();

        // Log performance metrics periodically
        setInterval(() => {
            const metrics = server.getPerformanceMetrics();
            console.log(`📊 Performance: ${metrics.completedTests} tests, ${metrics.successRate}% success rate, ${metrics.averageDuration}ms avg`);
        }, 60000); // Every minute

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    startServer();
}

export { PlaywrightMCPServer };
