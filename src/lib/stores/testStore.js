import { writable } from 'svelte/store';

class TestStore {
    constructor() {
        this.state = writable({
            tests: [],
            currentTest: null,
            results: [],
            isRunning: false,
            runConfig: {
                headless: true,
                browser: 'chromium',
                timeout: 30000,
                video: false,
                screenshot: 'only-on-failure'
            }
        });

        // Load initial data from localStorage
        this.loadFromStorage();
    }

    subscribe(callback) {
        return this.state.subscribe(callback);
    }

    // Test Management
    addTest(test) {
        const newTest = {
            id: test.id || Date.now().toString(),
            name: test.name,
            category: test.category || 'e2e',
            content: test.content,
            status: test.status || 'created',
            createdAt: test.createdAt || new Date().toISOString(),
            ...test
        };

        this.state.update(state => ({
            ...state,
            tests: [...state.tests, newTest]
        }));

        this.saveToStorage();
        return newTest;
    }

    updateTest(testId, updates) {
        this.state.update(state => ({
            ...state,
            tests: state.tests.map(test =>
                test.id === testId ? { ...test, ...updates } : test
            )
        }));

        this.saveToStorage();
    }

    deleteTest(testId) {
        this.state.update(state => ({
            ...state,
            tests: state.tests.filter(test => test.id !== testId),
            currentTest: state.currentTest?.id === testId ? null : state.currentTest
        }));

        this.saveToStorage();
    }

    getTest(testId) {
        let test = null;
        this.state.subscribe(state => {
            test = state.tests.find(t => t.id === testId);
        })();
        return test;
    }

    getAllTests() {
        let tests = [];
        this.state.subscribe(state => {
            tests = state.tests;
        })();
        return tests;
    }

    setCurrentTest(test) {
        this.state.update(state => ({
            ...state,
            currentTest: test
        }));
    }

    // Test Execution
    async runTest(testId, config = {}) {
        const test = this.getTest(testId);
        if (!test) {
            throw new Error(`Test with ID ${testId} not found`);
        }

        this.state.update(state => ({
            ...state,
            isRunning: true
        }));

        try {
            const runConfig = {
                ...this.getRunConfig(),
                ...config
            };

            console.log(`🧪 Running test: ${test.name}`);

            // Update test status
            this.updateTest(testId, {
                status: 'running',
                lastRun: new Date().toISOString()
            });

            // For now, simulate test execution
            // In a real implementation, this would execute via Tauri or MCP
            const result = await this.simulateTestExecution(test, runConfig);

            // Update test with result
            this.updateTest(testId, {
                status: result.status,
                lastRun: new Date().toISOString(),
                result: result
            });

            // Add to results
            this.addResult({
                testId,
                testName: test.name,
                category: test.category,
                result,
                timestamp: new Date().toISOString()
            });

            return result;

        } catch (error) {
            console.error('❌ Error running test:', error);

            // Update test status
            this.updateTest(testId, {
                status: 'failed',
                lastRun: new Date().toISOString(),
                result: {
                    status: 'failed',
                    error: error.message,
                    duration: 0
                }
            });

            throw error;
        } finally {
            this.state.update(state => ({
                ...state,
                isRunning: false
            }));
        }
    }

    async simulateTestExecution(test, config) {
        // Simulate test execution for demo purposes
        const duration = Math.random() * 5000 + 1000; // 1-6 seconds

        await new Promise(resolve => setTimeout(resolve, duration));

        // Random success/failure for demo
        const success = Math.random() > 0.3; // 70% success rate

        return {
            status: success ? 'passed' : 'failed',
            duration: Math.round(duration),
            output: success
                ? `Test "${test.name}" completed successfully\nAll assertions passed`
                : `Test "${test.name}" failed\nAssertion error: Element not found`,
            error: success ? null : 'Element locator failed: timeout exceeded',
            testId: test.id
        };
    }

    // Results Management
    addResult(result) {
        const newResult = {
            id: result.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
            timestamp: result.timestamp || new Date().toISOString(),
            ...result
        };

        this.state.update(state => ({
            ...state,
            results: [newResult, ...state.results]
        }));

        this.saveToStorage();
    }

    removeResult(resultId) {
        this.state.update(state => ({
            ...state,
            results: state.results.filter(result => result.id !== resultId)
        }));

        this.saveToStorage();
    }

    updateTestResult(testName, result) {
        this.state.update(state => ({
            ...state,
            tests: state.tests.map(test =>
                test.name === testName
                    ? { ...test, result, lastRun: new Date().toISOString() }
                    : test
            )
        }));

        this.saveToStorage();
    }

    clearResults() {
        this.state.update(state => ({
            ...state,
            results: []
        }));

        this.saveToStorage();
    }

    // Configuration Management
    updateRunConfig(config) {
        this.state.update(state => ({
            ...state,
            runConfig: { ...state.runConfig, ...config }
        }));

        this.saveToStorage();
    }

    getRunConfig() {
        let config = {};
        this.state.subscribe(state => {
            config = state.runConfig;
        })();
        return config;
    }

    // File Operations (Mock for now)
    async saveTestFile(category, fileName, content) {
        try {
            // In a real Tauri app, this would use the Tauri API
            console.log(`💾 Saving test file: ${category}/${fileName}`);

            // For now, just log the operation
            console.log('Test content:', content.substring(0, 200) + '...');

            return `tests/${category}/${fileName}`;
        } catch (error) {
            console.error('❌ Error saving test file:', error);
            throw error;
        }
    }

    async loadTestFiles() {
        try {
            // In a real Tauri app, this would read from the file system
            console.log('📂 Loading test files...');

            // For now, return empty array
            return [];
        } catch (error) {
            console.error('❌ Error loading test files:', error);
            return [];
        }
    }

    // Statistics
    getTestStatistics() {
        let stats = {
            total: 0,
            passed: 0,
            failed: 0,
            pending: 0,
            categories: {}
        };

        this.state.subscribe(state => {
            stats.total = state.tests.length;

            state.tests.forEach(test => {
                // Count by status
                if (test.result) {
                    if (test.result.status === 'passed') stats.passed++;
                    else if (test.result.status === 'failed') stats.failed++;
                    else stats.pending++;
                } else {
                    stats.pending++;
                }

                // Count by category
                const category = test.category || 'uncategorized';
                stats.categories[category] = (stats.categories[category] || 0) + 1;
            });
        })();

        return stats;
    }

    // Data Persistence
    saveToStorage() {
        try {
            const data = this.getCurrentState();
            localStorage.setItem('playwright-automation-data', JSON.stringify({
                tests: data.tests,
                results: data.results,
                runConfig: data.runConfig,
                savedAt: new Date().toISOString()
            }));
        } catch (error) {
            console.error('❌ Error saving to localStorage:', error);
        }
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem('playwright-automation-data');
            if (saved) {
                const data = JSON.parse(saved);
                this.state.update(state => ({
                    ...state,
                    tests: data.tests || [],
                    results: data.results || [],
                    runConfig: { ...state.runConfig, ...data.runConfig }
                }));
                console.log('📂 Loaded data from localStorage');
            }
        } catch (error) {
            console.error('❌ Error loading from localStorage:', error);
        }
    }

    getCurrentState() {
        let currentState;
        this.state.subscribe(state => {
            currentState = state;
        })();
        return currentState;
    }

    // Export/Import
    exportData() {
        const data = this.getCurrentState();
        return {
            version: '1.0.0',
            exportDate: new Date().toISOString(),
            tests: data.tests,
            results: data.results,
            runConfig: data.runConfig
        };
    }

    importData(importedData) {
        try {
            this.state.update(state => ({
                ...state,
                tests: [...state.tests, ...(importedData.tests || [])],
                results: [...state.results, ...(importedData.results || [])],
                runConfig: { ...state.runConfig, ...importedData.runConfig }
            }));

            this.saveToStorage();
            return true;
        } catch (error) {
            console.error('❌ Error importing data:', error);
            return false;
        }
    }
}

export const testStore = new TestStore();