<!-- lib/components/TestRunner.svelte -->
<script>
    import { onMount } from "svelte";
    import { testStore } from "../stores/testStore.js";
    import { mcpStore } from "../stores/mcpStore.js";

    console.log("🎬 TestRunner component loaded");

    let tests = [];
    let results = [];
    let selectedTests = new Set();
    let runConfig = {
        browser: "chromium",
        headless: true,
        parallel: false,
        timeout: 30000,
        retries: 1,
    };
    let isRunning = false;
    let currentExecution = null;
    let executionLogs = [];
    let mcpStatus = "disconnected";

    // Reactive statement to sync runConfig back to store
    $: if (runConfig) {
        testStore.updateRunConfig(runConfig);
    }

    // Subscribe to stores
    onMount(() => {
        const testUnsubscribe = testStore.subscribe((state) => {
            tests = state.tests || [];
            results = state.results || [];
            runConfig = { ...runConfig, ...state.runConfig };
        });

        const mcpUnsubscribe = mcpStore.subscribe((state) => {
            mcpStatus = state.status;
        });

        // Auto-connect to MCP server
        if (mcpStatus === "disconnected") {
            mcpStore.connect();
        }

        return () => {
            testUnsubscribe();
            mcpUnsubscribe();
        };
    });

    function selectAllTests() {
        selectedTests = new Set(tests.map((t) => t.id));
    }

    function deselectAllTests() {
        selectedTests = new Set();
    }

    function toggleTestSelection(testId) {
        if (selectedTests.has(testId)) {
            selectedTests.delete(testId);
        } else {
            selectedTests.add(testId);
        }
        selectedTests = new Set(selectedTests); // Trigger reactivity
    }

    async function runSelectedTests() {
        if (selectedTests.size === 0) {
            alert("Please select at least one test to run");
            return;
        }

        if (mcpStatus !== "connected") {
            alert("MCP Server is not connected. Please check the connection.");
            return;
        }

        isRunning = true;
        executionLogs = [];
        currentExecution = {
            startTime: Date.now(),
            totalTests: selectedTests.size,
            completedTests: 0,
            passedTests: 0,
            failedTests: 0,
        };

        try {
            console.log("🚀 Starting test execution via MCP...");

            for (const testId of selectedTests) {
                const test = tests.find((t) => t.id === testId);
                if (!test) continue;

                addLog(`🚀 Running test: ${test.name}`);

                try {
                    // Debug log the test content
                    console.log('🔍 Test content to run:', test.content);
                    console.log('🔍 Test object:', test);
                    
                    if (!test.content) {
                        throw new Error('Test content is missing or empty');
                    }
                    
                    // Run test via MCP server
                    const result = await mcpStore.runTest(test.content, runConfig);
                    console.log('🔍 Test result received in TestRunner:', result);

                    // Add result to store with enhanced error details
                    const detailedResults = result.detailedResults || {};
                    console.log('🔍 Detailed results:', detailedResults);
                    testStore.addResult({
                        testId: test.id,
                        testName: test.name,
                        status:
                            result.status === "passed" ? "passed" : "failed",
                        duration: result.duration || detailedResults.duration || 0,
                        error: result.error || detailedResults.error,
                        logs: result.logs || [],
                        executionId: result.executionId,
                        timestamp: new Date().toISOString(),
                        // Enhanced error information
                        detailedError: {
                            stdout: detailedResults.stdout || '',
                            stderr: detailedResults.stderr || '',
                            summary: detailedResults.summary || {},
                            individualTests: detailedResults.tests || [],
                            exitCode: result.exitCode || 0
                        }
                    });

                    if (result.status === "passed") {
                        currentExecution.passedTests++;
                        addLog(`✅ Test passed: ${test.name}`);
                    } else {
                        currentExecution.failedTests++;
                        const failureDetails = detailedResults.summary || {};
                        const failedCount = failureDetails.failed || 0;
                        const totalCount = failureDetails.total || 0;
                        
                        if (totalCount > 1) {
                            addLog(
                                `❌ Test failed: ${test.name} - ${failedCount}/${totalCount} tests failed`
                            );
                        } else {
                            addLog(
                                `❌ Test failed: ${test.name} - ${result.error || "Unknown error"}`
                            );
                        }
                        
                        // Log stderr if available for immediate debugging
                        if (detailedResults.stderr) {
                            addLog(`💥 Error details: ${detailedResults.stderr.substring(0, 200)}${detailedResults.stderr.length > 200 ? '...' : ''}`);
                        }
                    }
                } catch (error) {
                    console.error("❌ Test execution error:", error);
                    addLog(`💥 Test error: ${test.name} - ${error.message}`);

                    testStore.addResult({
                        testId: test.id,
                        testName: test.name,
                        status: "error",
                        duration: 0,
                        error: error.message,
                        logs: [error.message],
                        timestamp: new Date().toISOString(),
                    });

                    currentExecution.failedTests++;
                }

                currentExecution.completedTests++;
            }

            const duration = Date.now() - currentExecution.startTime;
            addLog(
                `🏁 Test execution completed in ${(duration / 1000).toFixed(1)}s`,
            );
            addLog(
                `📊 Results: ${currentExecution.passedTests} passed, ${currentExecution.failedTests} failed`,
            );
        } catch (error) {
            console.error("❌ Test runner error:", error);
            addLog(`💥 Execution failed: ${error.message}`);
        } finally {
            isRunning = false;
            currentExecution = null;
        }
    }

    async function runTestsLocally() {
        if (selectedTests.size === 0) {
            alert("Please select at least one test to run");
            return;
        }

        isRunning = true;
        executionLogs = [];

        try {
            addLog("🔧 Running tests locally (simulation mode)...");

            for (const testId of selectedTests) {
                const test = tests.find((t) => t.id === testId);
                if (!test) continue;

                addLog(`🚀 Simulating test: ${test.name}`);

                // Simulate test execution
                await new Promise((resolve) =>
                    setTimeout(resolve, 1000 + Math.random() * 2000),
                );

                const success = Math.random() > 0.3; // 70% success rate
                const duration = Math.floor(Math.random() * 3000) + 500;

                testStore.addResult({
                    testId: test.id,
                    testName: test.name,
                    status: success ? "passed" : "failed",
                    duration,
                    error: success ? null : "Simulated test failure",
                    logs: [
                        "Browser launched",
                        "Page loaded",
                        success
                            ? "Test completed successfully"
                            : "Test assertion failed",
                    ],
                    timestamp: new Date().toISOString(),
                });

                addLog(
                    success
                        ? `✅ Test passed: ${test.name}`
                        : `❌ Test failed: ${test.name}`,
                );
            }

            addLog("🏁 Local test execution completed");
        } catch (error) {
            console.error("❌ Local test runner error:", error);
            addLog(`💥 Execution failed: ${error.message}`);
        } finally {
            isRunning = false;
        }
    }

    function addLog(message) {
        const timestamp = new Date().toLocaleTimeString();
        executionLogs = [...executionLogs, { timestamp, message }];
    }

    function stopExecution() {
        if (currentExecution) {
            addLog("🛑 Stopping test execution...");
            isRunning = false;
            currentExecution = null;
        }
    }

    function clearLogs() {
        executionLogs = [];
    }

    function getStatusColor(status) {
        switch (status) {
            case "connected":
                return "#10b981";
            case "connecting":
                return "#f59e0b";
            case "disconnected":
                return "#6b7280";
            case "error":
                return "#dc2626";
            default:
                return "#9ca3af";
        }
    }
</script>

<div class="test-runner">
    <!-- Left Panel - Test Selection and Controls -->
    <div class="left-panel">
        <div class="panel-content">
            <!-- Header -->
            <div class="section-header">
                <h2 class="section-title">🎬 Test Runner</h2>
                <div class="mcp-status">
                    <span
                        class="status-indicator"
                        style="color: {getStatusColor(mcpStatus)}">●</span
                    >
                    <span class="status-text">MCP Server {mcpStatus}</span>
                    {#if mcpStatus === "disconnected"}
                        <button
                            on:click={() => mcpStore.connect()}
                            class="btn btn-tiny btn-primary"
                        >
                            Connect
                        </button>
                    {/if}
                </div>
            </div>

            <!-- Test Selection -->
            <div class="test-selection-section">
                <div class="selection-header">
                    <h3 class="selection-title">Select Tests to Run</h3>
                    <div class="selection-actions">
                        <button
                            on:click={selectAllTests}
                            class="btn btn-small btn-secondary"
                        >
                            Select All
                        </button>
                        <button
                            on:click={deselectAllTests}
                            class="btn btn-small btn-secondary"
                        >
                            Clear All
                        </button>
                    </div>
                </div>

                <div class="tests-list">
                    {#if tests.length === 0}
                        <div class="empty-state">
                            <div class="empty-icon">🧪</div>
                            <div class="empty-text">No tests available</div>
                            <div class="empty-subtext">
                                Create some tests in the Test Builder first
                            </div>
                        </div>
                    {:else}
                        {#each tests as test (test.id)}
                            <div
                                class="test-item"
                                class:selected={selectedTests.has(test.id)}
                            >
                                <label class="test-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={selectedTests.has(test.id)}
                                        on:change={() =>
                                            toggleTestSelection(test.id)}
                                    />
                                    <span class="test-info">
                                        <div class="test-name">{test.name}</div>
                                        <div class="test-description">
                                            {test.description ||
                                                "No description"}
                                        </div>
                                    </span>
                                </label>
                            </div>
                        {/each}
                    {/if}
                </div>

                <div class="selection-summary">
                    Selected: {selectedTests.size} of {tests.length} tests
                </div>
            </div>

            <!-- Run Configuration -->
            <div class="config-section">
                <h3 class="config-title">🛠️ Run Configuration</h3>

                <div class="config-grid">
                    <div class="config-item">
                        <label class="config-label" for="browser-select">Browser</label>
                        <select
                            id="browser-select"
                            bind:value={runConfig.browser}
                            class="config-select"
                        >
                            <option value="chromium">Chromium</option>
                            <option value="firefox">Firefox</option>
                            <option value="webkit">WebKit</option>
                        </select>
                    </div>

                    <div class="config-item">
                        <label class="config-label" for="timeout-input">Timeout (ms)</label>
                        <input
                            id="timeout-input"
                            type="number"
                            bind:value={runConfig.timeout}
                            min="5000"
                            max="300000"
                            step="5000"
                            class="config-input"
                        />
                    </div>

                    <div class="config-item">
                        <label class="config-label" for="retries-input">Retries</label>
                        <input
                            id="retries-input"
                            type="number"
                            bind:value={runConfig.retries}
                            min="0"
                            max="5"
                            class="config-input"
                        />
                    </div>
                </div>

                <div class="config-checkboxes">
                    <label class="config-checkbox">
                        <input
                            type="checkbox"
                            bind:checked={runConfig.headless}
                        />
                        <span>Headless Mode</span>
                    </label>
                    <label class="config-checkbox">
                        <input
                            type="checkbox"
                            bind:checked={runConfig.parallel}
                        />
                        <span>Parallel Execution</span>
                    </label>
                </div>
            </div>

            <!-- Run Controls -->
            <div class="run-controls">
                {#if !isRunning}
                    <button
                        on:click={runSelectedTests}
                        class="btn btn-primary btn-large"
                        disabled={selectedTests.size === 0 ||
                            mcpStatus !== "connected"}
                    >
                        🚀 Run via MCP Server
                    </button>
                    <button
                        on:click={runTestsLocally}
                        class="btn btn-secondary btn-large"
                        disabled={selectedTests.size === 0}
                    >
                        🔧 Run Locally (Simulate)
                    </button>
                {:else}
                    <button
                        on:click={stopExecution}
                        class="btn btn-danger btn-large"
                    >
                        🛑 Stop Execution
                    </button>
                {/if}
            </div>

            <!-- Execution Progress -->
            {#if currentExecution}
                <div class="progress-section">
                    <h3 class="progress-title">Execution Progress</h3>
                    <div class="progress-stats">
                        <div class="progress-stat">
                            <span class="stat-label">Progress:</span>
                            <span class="stat-value"
                                >{currentExecution.completedTests}/{currentExecution.totalTests}</span
                            >
                        </div>
                        <div class="progress-stat">
                            <span class="stat-label">Passed:</span>
                            <span class="stat-value success"
                                >{currentExecution.passedTests}</span
                            >
                        </div>
                        <div class="progress-stat">
                            <span class="stat-label">Failed:</span>
                            <span class="stat-value error"
                                >{currentExecution.failedTests}</span
                            >
                        </div>
                    </div>
                    <div class="progress-bar">
                        <div
                            class="progress-fill"
                            style="width: {(currentExecution.completedTests /
                                currentExecution.totalTests) *
                                100}%"
                        ></div>
                    </div>
                </div>
            {/if}
        </div>
    </div>

    <!-- Right Panel - Execution Logs -->
    <div class="right-panel">
        <div class="panel-content">
            <div class="logs-header">
                <h3 class="logs-title">📋 Execution Logs</h3>
                <div class="logs-actions">
                    <button
                        on:click={clearLogs}
                        class="btn btn-small btn-secondary"
                    >
                        🗑️ Clear
                    </button>
                </div>
            </div>

            <div class="logs-container">
                {#if executionLogs.length === 0}
                    <div class="logs-empty">
                        <div class="logs-empty-icon">📋</div>
                        <div class="logs-empty-text">No logs yet</div>
                        <div class="logs-empty-subtext">
                            Run some tests to see execution logs here
                        </div>
                    </div>
                {:else}
                    <div class="logs-list">
                        {#each executionLogs as log (log.timestamp + log.message)}
                            <div class="log-entry">
                                <span class="log-timestamp"
                                    >{log.timestamp}</span
                                >
                                <span class="log-message">{log.message}</span>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>

<style>
    .test-runner {
        display: flex;
        height: 100%;
    }

    .left-panel,
    .right-panel {
        overflow-y: auto;
    }

    .left-panel {
        flex: 2;
        border-right: 1px solid #e5e7eb;
        background-color: white;
    }

    .right-panel {
        flex: 1;
        background-color: #f9fafb;
    }

    .panel-content {
        padding: 1.5rem;
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    .section-title {
        font-size: 1.5rem;
        font-weight: 600;
        color: #111827;
        margin: 0;
    }

    .mcp-status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
    }

    .status-indicator {
        font-size: 1rem;
    }

    .status-text {
        color: #6b7280;
    }

    .test-selection-section {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        padding: 1rem;
        margin-bottom: 1.5rem;
    }

    .selection-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .selection-title {
        font-size: 1rem;
        font-weight: 500;
        color: #111827;
        margin: 0;
    }

    .selection-actions {
        display: flex;
        gap: 0.5rem;
    }

    .tests-list {
        max-height: 300px;
        overflow-y: auto;
        margin-bottom: 1rem;
    }

    .test-item {
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;
        margin-bottom: 0.5rem;
        background-color: white;
        transition: all 0.2s;
    }

    .test-item.selected {
        border-color: #3b82f6;
        background-color: #eff6ff;
    }

    .test-checkbox {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem;
        cursor: pointer;
        width: 100%;
    }

    .test-info {
        flex: 1;
    }

    .test-name {
        font-weight: 500;
        color: #111827;
        margin-bottom: 0.25rem;
    }

    .test-description {
        font-size: 0.875rem;
        color: #6b7280;
    }

    .selection-summary {
        font-size: 0.875rem;
        color: #6b7280;
        text-align: center;
        padding: 0.5rem;
        background-color: #f3f4f6;
        border-radius: 0.375rem;
    }

    .config-section {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        padding: 1rem;
        margin-bottom: 1.5rem;
    }

    .config-title {
        font-size: 1rem;
        font-weight: 500;
        color: #111827;
        margin: 0 0 1rem 0;
    }

    .config-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .config-item {
        display: flex;
        flex-direction: column;
    }

    .config-label {
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
        margin-bottom: 0.25rem;
    }

    .config-select,
    .config-input {
        padding: 0.375rem 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        background-color: white;
    }

    .config-checkboxes {
        display: flex;
        gap: 1rem;
    }

    .config-checkbox {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        font-size: 0.875rem;
        color: #374151;
    }

    .run-controls {
        display: flex;
        gap: 1rem;
        margin-bottom: 1.5rem;
    }

    .btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .btn-small {
        padding: 0.375rem 0.75rem;
        font-size: 0.75rem;
    }

    .btn-tiny {
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
    }

    .btn-large {
        padding: 1rem 2rem;
        font-size: 1rem;
        flex: 1;
    }

    .btn-primary {
        background-color: #3b82f6;
        color: white;
    }

    .btn-primary:hover:not(:disabled) {
        background-color: #2563eb;
    }

    .btn-secondary {
        background-color: #6b7280;
        color: white;
    }

    .btn-secondary:hover {
        background-color: #4b5563;
    }

    .btn-danger {
        background-color: #dc2626;
        color: white;
    }

    .btn-danger:hover {
        background-color: #b91c1c;
    }

    .progress-section {
        background-color: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 0.5rem;
        padding: 1rem;
    }

    .progress-title {
        font-size: 1rem;
        font-weight: 500;
        color: #1e40af;
        margin: 0 0 1rem 0;
    }

    .progress-stats {
        display: flex;
        justify-content: space-between;
        margin-bottom: 1rem;
    }

    .progress-stat {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .stat-label {
        font-size: 0.75rem;
        color: #6b7280;
        margin-bottom: 0.25rem;
    }

    .stat-value {
        font-size: 1.25rem;
        font-weight: bold;
        color: #1e40af;
    }

    .stat-value.success {
        color: #10b981;
    }

    .stat-value.error {
        color: #dc2626;
    }

    .progress-bar {
        height: 8px;
        background-color: #e5e7eb;
        border-radius: 4px;
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        background-color: #3b82f6;
        transition: width 0.3s ease;
    }

    .empty-state {
        text-align: center;
        padding: 2rem;
        color: #6b7280;
    }

    .empty-icon {
        font-size: 2rem;
        margin-bottom: 0.5rem;
    }

    .empty-text {
        font-size: 1rem;
        font-weight: 500;
        margin-bottom: 0.25rem;
    }

    .empty-subtext {
        font-size: 0.875rem;
    }

    /* Right Panel Styles */
    .logs-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .logs-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: #111827;
        margin: 0;
    }

    .logs-container {
        background-color: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        height: calc(100vh - 200px);
        overflow: hidden;
    }

    .logs-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #6b7280;
    }

    .logs-empty-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
    }

    .logs-empty-text {
        font-size: 1.125rem;
        font-weight: 500;
        margin-bottom: 0.5rem;
    }

    .logs-empty-subtext {
        font-size: 0.875rem;
    }

    .logs-list {
        height: 100%;
        overflow-y: auto;
        padding: 1rem;
    }

    .log-entry {
        display: flex;
        gap: 1rem;
        padding: 0.5rem 0;
        border-bottom: 1px solid #f3f4f6;
        font-family: monospace;
        font-size: 0.875rem;
    }

    .log-entry:last-child {
        border-bottom: none;
    }

    .log-timestamp {
        color: #6b7280;
        min-width: 80px;
    }

    .log-message {
        color: #111827;
        flex: 1;
    }
</style>
