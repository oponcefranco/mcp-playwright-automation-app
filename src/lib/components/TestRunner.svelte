<!-- lib/components/TestRunner.svelte -->
<script>
    import { onMount } from "svelte";
    import { testStore } from "../stores/testStore.js";
    import { mcpStore } from "../stores/mcpStore.js";

    console.log("▶️ TestRunner component loaded");

    let tests = [];
    let selectedTests = new Set();
    let isRunning = false;
    let runningTestId = null;
    let executionLogs = [];
    let testResults = {};
    let runConfig = {
        browser: "chromium",
        headless: true,
        parallel: false,
        timeout: 30000,
    };

    // Subscribe to test store
    onMount(() => {
        const unsubscribe = testStore.subscribe((state) => {
            tests = state.tests;
            testResults = state.results.reduce((acc, result) => {
                acc[result.testId] = result;
                return acc;
            }, {});
        });

        return unsubscribe;
    });

    $: selectedCount = selectedTests.size;
    $: canRun = selectedCount > 0 && !isRunning;

    function toggleTestSelection(testId) {
        if (selectedTests.has(testId)) {
            selectedTests.delete(testId);
        } else {
            selectedTests.add(testId);
        }
        selectedTests = new Set(selectedTests); // Trigger reactivity
    }

    function selectAllTests() {
        selectedTests = new Set(tests.map((t) => t.id));
    }

    function clearSelection() {
        selectedTests = new Set();
    }

    async function runSelectedTests() {
        if (!canRun) return;

        isRunning = true;
        executionLogs = [];
        const selectedTestList = tests.filter((t) => selectedTests.has(t.id));

        addLog(
            `🚀 Starting test execution for ${selectedTestList.length} test(s)`,
        );
        addLog(
            `📋 Configuration: ${runConfig.browser} | Headless: ${runConfig.headless}`,
        );

        try {
            for (const test of selectedTestList) {
                await runSingleTest(test);

                // Add delay between tests if not running in parallel
                if (!runConfig.parallel && selectedTestList.length > 1) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
            }

            addLog(`✅ Test execution completed successfully`);
        } catch (error) {
            addLog(`❌ Test execution failed: ${error.message}`);
            console.error("Test execution error:", error);
        } finally {
            isRunning = false;
            runningTestId = null;
        }
    }

    async function runSingleTest(test) {
        runningTestId = test.id;
        addLog(`\n▶️ Running: ${test.name}`);

        try {
            // Simulate test execution via MCP
            const startTime = Date.now();

            // In a real implementation, this would call the MCP server
            const result = await simulateTestExecution(test);

            const duration = Date.now() - startTime;

            // Store result
            testStore.addResult({
                testId: test.id,
                testName: test.name,
                status: result.status,
                duration,
                error: result.error,
                screenshots: result.screenshots || [],
                logs: result.logs || [],
                timestamp: new Date().toISOString(),
            });

            if (result.status === "passed") {
                addLog(`✅ ${test.name} - PASSED (${duration}ms)`);
            } else {
                addLog(
                    `❌ ${test.name} - FAILED (${duration}ms): ${result.error}`,
                );
            }
        } catch (error) {
            addLog(`💥 ${test.name} - ERROR: ${error.message}`);

            testStore.addResult({
                testId: test.id,
                testName: test.name,
                status: "error",
                duration: 0,
                error: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    }

    // Simulate test execution for demo purposes
    async function simulateTestExecution(test) {
        // Simulate network delay
        await new Promise((resolve) =>
            setTimeout(resolve, Math.random() * 2000 + 1000),
        );

        // Random success/failure for demo
        const success = Math.random() > 0.3; // 70% success rate

        if (success) {
            return {
                status: "passed",
                logs: [
                    "Browser launched",
                    "Page navigated successfully",
                    "Elements found and interacted with",
                    "Assertions passed",
                ],
            };
        } else {
            return {
                status: "failed",
                error: "Element not found: login button",
                logs: [
                    "Browser launched",
                    "Page navigated successfully",
                    "Failed to find element: login button",
                ],
            };
        }
    }

    function addLog(message) {
        executionLogs = [
            ...executionLogs,
            {
                timestamp: new Date().toLocaleTimeString(),
                message,
            },
        ];
    }

    function deleteTest(testId) {
        if (confirm("Are you sure you want to delete this test?")) {
            testStore.removeTest(testId);
            selectedTests.delete(testId);
            selectedTests = new Set(selectedTests);
        }
    }

    function editTest(test) {
        // For now, just show the test content
        alert(
            `Edit functionality will be added in future versions.\n\nTest: ${test.name}\nCategory: ${test.category}`,
        );
    }

    function getTestStatusIcon(testId) {
        const result = testResults[testId];
        if (!result) return "⚪";

        switch (result.status) {
            case "passed":
                return "✅";
            case "failed":
                return "❌";
            case "error":
                return "💥";
            case "running":
                return "🔄";
            default:
                return "⚪";
        }
    }

    function getTestStatusText(testId) {
        const result = testResults[testId];
        if (!result) return "Not run";

        const timeAgo = new Date(result.timestamp).toLocaleString();
        return `${result.status.toUpperCase()} - ${timeAgo}`;
    }

    function formatDuration(duration) {
        if (duration < 1000) return `${duration}ms`;
        return `${(duration / 1000).toFixed(1)}s`;
    }
</script>

<div class="test-runner">
    <!-- Left Panel - Test List & Config -->
    <div class="left-panel">
        <div class="panel-content">
            <!-- Header -->
            <div class="section-header">
                <h2 class="section-title">▶️ Test Runner</h2>
                <div class="test-stats">
                    {tests.length} tests • {selectedCount} selected
                </div>
            </div>

            <!-- Run Configuration -->
            <div class="config-section">
                <h3 class="config-title">Run Configuration</h3>

                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Browser</label>
                        <select
                            bind:value={runConfig.browser}
                            class="form-select"
                        >
                            <option value="chromium">Chromium</option>
                            <option value="firefox">Firefox</option>
                            <option value="webkit">WebKit</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Timeout (ms)</label>
                        <input
                            type="number"
                            bind:value={runConfig.timeout}
                            min="5000"
                            max="120000"
                            step="5000"
                            class="form-input"
                        />
                    </div>

                    <div class="form-group">
                        <label class="toggle-label">
                            <input
                                type="checkbox"
                                bind:checked={runConfig.headless}
                                class="toggle-input"
                            />
                            <span class="toggle-text">Headless Mode</span>
                        </label>
                    </div>

                    <div class="form-group">
                        <label class="toggle-label">
                            <input
                                type="checkbox"
                                bind:checked={runConfig.parallel}
                                class="toggle-input"
                            />
                            <span class="toggle-text">Parallel Execution</span>
                        </label>
                    </div>
                </div>
            </div>

            <!-- Test Selection Controls -->
            <div class="selection-controls">
                <button
                    on:click={selectAllTests}
                    class="btn btn-small btn-secondary"
                >
                    Select All
                </button>
                <button
                    on:click={clearSelection}
                    class="btn btn-small btn-secondary"
                >
                    Clear
                </button>
                <button
                    on:click={runSelectedTests}
                    disabled={!canRun}
                    class="btn btn-small btn-primary"
                >
                    {#if isRunning}
                        🔄 Running...
                    {:else}
                        ▶️ Run Selected ({selectedCount})
                    {/if}
                </button>
            </div>

            <!-- Test List -->
            <div class="test-list">
                {#if tests.length === 0}
                    <div class="empty-state">
                        <div class="empty-icon">📝</div>
                        <div class="empty-text">No tests available</div>
                        <div class="empty-subtext">
                            Create tests in the Test Builder tab
                        </div>
                    </div>
                {:else}
                    {#each tests as test (test.id)}
                        <div
                            class="test-item {runningTestId === test.id
                                ? 'running'
                                : ''}"
                        >
                            <div class="test-checkbox">
                                <input
                                    type="checkbox"
                                    checked={selectedTests.has(test.id)}
                                    on:change={() =>
                                        toggleTestSelection(test.id)}
                                    disabled={isRunning}
                                />
                            </div>

                            <div class="test-content">
                                <div class="test-header">
                                    <span class="test-status"
                                        >{getTestStatusIcon(test.id)}</span
                                    >
                                    <span class="test-name">{test.name}</span>
                                    <span class="test-category"
                                        >{test.category}</span
                                    >
                                </div>

                                <div class="test-meta">
                                    <span class="test-status-text"
                                        >{getTestStatusText(test.id)}</span
                                    >
                                    {#if testResults[test.id]?.duration}
                                        <span class="test-duration"
                                            >⏱️ {formatDuration(
                                                testResults[test.id].duration,
                                            )}</span
                                        >
                                    {/if}
                                </div>

                                {#if test.config?.baseUrl}
                                    <div class="test-url">
                                        🌐 {test.config.baseUrl}
                                    </div>
                                {/if}
                            </div>

                            <div class="test-actions">
                                <button
                                    on:click={() => runSingleTest(test)}
                                    disabled={isRunning}
                                    class="btn btn-tiny"
                                >
                                    ▶️
                                </button>
                                <button
                                    on:click={() => editTest(test)}
                                    class="btn btn-tiny"
                                >
                                    ✏️
                                </button>
                                <button
                                    on:click={() => deleteTest(test.id)}
                                    disabled={isRunning}
                                    class="btn btn-tiny btn-danger"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>
        </div>
    </div>

    <!-- Right Panel - Execution Logs -->
    <div class="right-panel">
        <div class="panel-content">
            <div class="logs-header">
                <h3 class="logs-title">Execution Logs</h3>
                <button
                    on:click={() => (executionLogs = [])}
                    class="btn btn-small btn-secondary"
                >
                    🗑️ Clear Logs
                </button>
            </div>

            <div class="logs-container">
                {#if executionLogs.length === 0}
                    <div class="logs-empty">
                        <div class="empty-icon">📄</div>
                        <div class="empty-text">No execution logs</div>
                        <div class="empty-subtext">
                            Run tests to see execution details
                        </div>
                    </div>
                {:else}
                    <div class="logs-content">
                        {#each executionLogs as log}
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
        flex: 1;
        overflow-y: auto;
    }

    .left-panel {
        border-right: 1px solid #e5e7eb;
        background-color: white;
    }

    .right-panel {
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

    .test-stats {
        font-size: 0.875rem;
        color: #6b7280;
        background-color: #f3f4f6;
        padding: 0.5rem 1rem;
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
        font-size: 1.125rem;
        font-weight: 500;
        color: #111827;
        margin: 0 0 1rem 0;
    }

    .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }

    .form-group {
        display: flex;
        flex-direction: column;
    }

    .form-label {
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
        margin-bottom: 0.25rem;
    }

    .form-input,
    .form-select {
        padding: 0.5rem 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        font-size: 0.875rem;
    }

    .toggle-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.5rem;
    }

    .toggle-text {
        font-size: 0.875rem;
        color: #6b7280;
    }

    .selection-controls {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    .btn {
        padding: 0.5rem 1rem;
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

    .btn-secondary:hover:not(:disabled) {
        background-color: #4b5563;
    }

    .btn-small {
        padding: 0.375rem 0.75rem;
        font-size: 0.75rem;
    }

    .btn-tiny {
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
    }

    .btn-danger {
        background-color: #dc2626;
        color: white;
    }

    .btn-danger:hover:not(:disabled) {
        background-color: #b91c1c;
    }

    .test-list {
        max-height: 400px;
        overflow-y: auto;
    }

    .test-item {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 1rem;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        margin-bottom: 0.75rem;
        background-color: white;
        transition: all 0.2s;
    }

    .test-item:hover {
        border-color: #3b82f6;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .test-item.running {
        border-color: #f59e0b;
        background-color: #fef3c7;
    }

    .test-checkbox {
        margin-top: 0.25rem;
    }

    .test-content {
        flex: 1;
    }

    .test-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
    }

    .test-status {
        font-size: 1rem;
    }

    .test-name {
        font-weight: 500;
        color: #111827;
    }

    .test-category {
        background-color: #e5e7eb;
        color: #6b7280;
        padding: 0.125rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        text-transform: uppercase;
    }

    .test-meta {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 0.25rem;
    }

    .test-status-text {
        font-size: 0.75rem;
        color: #6b7280;
    }

    .test-duration {
        font-size: 0.75rem;
        color: #059669;
    }

    .test-url {
        font-size: 0.75rem;
        color: #6b7280;
        font-family: monospace;
    }

    .test-actions {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .logs-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .logs-title {
        font-size: 1.125rem;
        font-weight: 500;
        color: #111827;
        margin: 0;
    }

    .logs-container {
        background-color: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        height: 500px;
        overflow: hidden;
    }

    .logs-empty {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
    }

    .logs-empty .empty-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
    }

    .logs-empty .empty-text {
        font-size: 1.125rem;
        font-weight: 500;
        color: #111827;
        margin-bottom: 0.5rem;
    }

    .logs-empty .empty-subtext {
        color: #6b7280;
        font-size: 0.875rem;
    }

    .logs-content {
        padding: 1rem;
        height: 100%;
        overflow-y: auto;
        font-family: "SF Mono", "Monaco", "Inconsolata", "Roboto Mono",
            monospace;
    }

    .log-entry {
        display: flex;
        gap: 1rem;
        margin-bottom: 0.5rem;
        font-size: 0.875rem;
        line-height: 1.5;
    }

    .log-timestamp {
        color: #6b7280;
        font-size: 0.75rem;
        min-width: 80px;
        flex-shrink: 0;
    }

    .log-message {
        color: #111827;
        flex: 1;
        word-break: break-word;
    }

    .empty-state {
        text-align: center;
        padding: 2rem;
        color: #6b7280;
    }

    .empty-state .empty-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
    }

    .empty-state .empty-text {
        font-size: 1.125rem;
        font-weight: 500;
        margin-bottom: 0.5rem;
    }

    .empty-state .empty-subtext {
        font-size: 0.875rem;
    }
</style>
