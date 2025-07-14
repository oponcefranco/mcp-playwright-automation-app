<!-- lib/components/ResultsPanel.svelte -->
<script>
  import { onMount } from 'svelte';
  import { testStore } from '../stores/testStore.js';

  console.log('📊 ResultsPanel component loaded');

  let results = [];
  let tests = [];
  let filteredResults = [];
  let selectedFilter = 'all';
  let selectedTestId = 'all';
  let sortBy = 'timestamp';
  let sortOrder = 'desc';
  let showDetails = new Set();

  // Subscribe to test store
  onMount(() => {
    const unsubscribe = testStore.subscribe(state => {
      results = state.results || [];
      tests = state.tests || [];
      applyFilters();
    });

    return unsubscribe;
  });

  $: if (results || selectedFilter || selectedTestId || sortBy || sortOrder) {
    applyFilters();
  }

  function applyFilters() {
    let filtered = [...results];

    // Filter by status
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(result => result.status === selectedFilter);
    }

    // Filter by test
    if (selectedTestId !== 'all') {
      filtered = filtered.filter(result => result.testId === selectedTestId);
    }

    // Sort results
    filtered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      // Handle timestamp sorting
      if (sortBy === 'timestamp') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      // Handle duration sorting
      if (sortBy === 'duration') {
        aVal = aVal || 0;
        bVal = bVal || 0;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    filteredResults = filtered;
  }

  function toggleDetails(resultId) {
    if (showDetails.has(resultId)) {
      showDetails.delete(resultId);
    } else {
      showDetails.add(resultId);
    }
    showDetails = new Set(showDetails); // Trigger reactivity
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'passed': return '✅';
      case 'failed': return '❌';
      case 'error': return '💥';
      case 'running': return '🔄';
      case 'skipped': return '⏭️';
      default: return '⚪';
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case 'passed': return '#10b981';
      case 'failed': return '#dc2626';
      case 'error': return '#f59e0b';
      case 'running': return '#3b82f6';
      case 'skipped': return '#6b7280';
      default: return '#9ca3af';
    }
  }

  function formatDuration(duration) {
    if (!duration) return 'N/A';
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(1)}s`;
  }

  function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  function getTestName(testId) {
    const test = tests.find(t => t.id === testId);
    return test ? test.name : 'Unknown Test';
  }

  function clearAllResults() {
    if (confirm('Are you sure you want to clear all test results?')) {
      testStore.clearResults();
    }
  }

  function deleteResult(resultId) {
    if (confirm('Are you sure you want to delete this result?')) {
      testStore.removeResult(resultId);
    }
  }

  function exportResults() {
    const dataStr = JSON.stringify(filteredResults, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `test-results-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  }

  // Calculate statistics
  $: statistics = {
    total: results.length,
    passed: results.filter(r => r.status === 'passed').length,
    failed: results.filter(r => r.status === 'failed').length,
    error: results.filter(r => r.status === 'error').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    avgDuration: results.length > 0 
      ? Math.round(results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length)
      : 0,
    successRate: results.length > 0 
      ? Math.round((results.filter(r => r.status === 'passed').length / results.length) * 100)
      : 0
  };
</script>

<div class="results-panel">
  <!-- Left Panel - Results List -->
  <div class="left-panel">
    <div class="panel-content">
      <!-- Header -->
      <div class="section-header">
        <h2 class="section-title">📊 Test Results</h2>
        <div class="header-actions">
          <button on:click={exportResults} class="btn btn-small btn-secondary">
            📥 Export
          </button>
          <button on:click={clearAllResults} class="btn btn-small btn-danger">
            🗑️ Clear All
          </button>
        </div>
      </div>

      <!-- Statistics Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{statistics.total}</div>
          <div class="stat-label">Total Runs</div>
        </div>
        <div class="stat-card success">
          <div class="stat-value">{statistics.passed}</div>
          <div class="stat-label">Passed</div>
        </div>
        <div class="stat-card error">
          <div class="stat-value">{statistics.failed + statistics.error}</div>
          <div class="stat-label">Failed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{statistics.successRate}%</div>
          <div class="stat-label">Success Rate</div>
        </div>
      </div>

      <!-- Filters and Controls -->
      <div class="controls-section">
        <div class="control-row">
          <div class="control-group">
            <label class="control-label">Filter by Status:</label>
            <select bind:value={selectedFilter} class="control-select">
              <option value="all">All Results</option>
              <option value="passed">Passed Only</option>
              <option value="failed">Failed Only</option>
              <option value="error">Error Only</option>
              <option value="skipped">Skipped Only</option>
            </select>
          </div>

          <div class="control-group">
            <label class="control-label">Filter by Test:</label>
            <select bind:value={selectedTestId} class="control-select">
              <option value="all">All Tests</option>
              {#each tests as test}
                <option value={test.id}>{test.name}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="control-row">
          <div class="control-group">
            <label class="control-label">Sort by:</label>
            <select bind:value={sortBy} class="control-select">
              <option value="timestamp">Date</option>
              <option value="testName">Test Name</option>
              <option value="status">Status</option>
              <option value="duration">Duration</option>
            </select>
          </div>

          <div class="control-group">
            <label class="control-label">Order:</label>
            <select bind:value={sortOrder} class="control-select">
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Results List -->
      <div class="results-list">
        {#if filteredResults.length === 0}
          <div class="empty-state">
            <div class="empty-icon">📈</div>
            <div class="empty-text">No test results found</div>
            <div class="empty-subtext">
              {#if results.length === 0}
                Run some tests to see results here
              {:else}
                Try adjusting your filters
              {/if}
            </div>
          </div>
        {:else}
          <div class="results-count">
            Showing {filteredResults.length} of {results.length} results
          </div>
          
          {#each filteredResults as result (result.id)}
            <div class="result-item">
              <div class="result-header" on:click={() => toggleDetails(result.id)}>
                <div class="result-main">
                  <span class="result-status" style="color: {getStatusColor(result.status)}">
                    {getStatusIcon(result.status)}
                  </span>
                  <div class="result-info">
                    <div class="result-test-name">{getTestName(result.testId)}</div>
                    <div class="result-meta">
                      {formatTimestamp(result.timestamp)} • {formatDuration(result.duration)}
                    </div>
                  </div>
                </div>
                
                <div class="result-actions">
                  <button 
                    class="btn btn-tiny"
                    on:click|stopPropagation={() => toggleDetails(result.id)}
                  >
                    {showDetails.has(result.id) ? '▼' : '▶'}
                  </button>
                  <button 
                    class="btn btn-tiny btn-danger"
                    on:click|stopPropagation={() => deleteResult(result.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {#if showDetails.has(result.id)}
                <div class="result-details">
                  {#if result.error}
                    <div class="detail-section">
                      <h4 class="detail-title">Error Message</h4>
                      <div class="error-message">{result.error}</div>
                    </div>
                  {/if}

                  {#if result.logs && result.logs.length > 0}
                    <div class="detail-section">
                      <h4 class="detail-title">Execution Logs</h4>
                      <div class="logs-container">
                        {#each result.logs as log}
                          <div class="log-entry">{log}</div>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  {#if result.screenshots && result.screenshots.length > 0}
                    <div class="detail-section">
                      <h4 class="detail-title">Screenshots</h4>
                      <div class="screenshots-grid">
                        {#each result.screenshots as screenshot}
                          <div class="screenshot-item">
                            <img src={screenshot.url} alt={screenshot.name} class="screenshot-image" />
                            <div class="screenshot-name">{screenshot.name}</div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  <div class="detail-section">
                    <h4 class="detail-title">Execution Details</h4>
                    <div class="details-grid">
                      <div class="detail-item">
                        <span class="detail-key">Status:</span>
                        <span class="detail-value" style="color: {getStatusColor(result.status)}">
                          {result.status.toUpperCase()}
                        </span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-key">Duration:</span>
                        <span class="detail-value">{formatDuration(result.duration)}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-key">Executed:</span>
                        <span class="detail-value">{formatTimestamp(result.timestamp)}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-key">Test ID:</span>
                        <span class="detail-value">{result.testId}</span>
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>

  <!-- Right Panel - Charts and Analytics -->
  <div class="right-panel">
    <div class="panel-content">
      <h3 class="panel-title">📈 Analytics</h3>

      <!-- Success Rate Chart (Visual representation) -->
      <div class="chart-section">
        <h4 class="chart-title">Success Rate Overview</h4>
        <div class="chart-container">
          <div class="success-rate-chart">
            <div class="chart-bar">
              <div 
                class="chart-bar-fill success"
                style="width: {statistics.total > 0 ? (statistics.passed / statistics.total) * 100 : 0}%"
              ></div>
              <div 
                class="chart-bar-fill error"
                style="width: {statistics.total > 0 ? ((statistics.failed + statistics.error) / statistics.total) * 100 : 0}%"
              ></div>
            </div>
            <div class="chart-labels">
              <span class="chart-label success">
                ✅ Passed: {statistics.passed}
              </span>
              <span class="chart-label error">
                ❌ Failed: {statistics.failed + statistics.error}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="activity-section">
        <h4 class="activity-title">Recent Activity</h4>
        <div class="activity-list">
          {#each results.slice(0, 10) as result}
            <div class="activity-item">
              <span class="activity-status" style="color: {getStatusColor(result.status)}">
                {getStatusIcon(result.status)}
              </span>
              <div class="activity-content">
                <div class="activity-test">{getTestName(result.testId)}</div>
                <div class="activity-time">{formatTimestamp(result.timestamp)}</div>
              </div>
              <div class="activity-duration">{formatDuration(result.duration)}</div>
            </div>
          {/each}
          
          {#if results.length === 0}
            <div class="activity-empty">
              No recent activity
            </div>
          {/if}
        </div>
      </div>

      <!-- Test Performance -->
      <div class="performance-section">
        <h4 class="performance-title">Performance Metrics</h4>
        <div class="metrics-grid">
          <div class="metric-item">
            <div class="metric-value">{formatDuration(statistics.avgDuration)}</div>
            <div class="metric-label">Avg Duration</div>
          </div>
          <div class="metric-item">
            <div class="metric-value">{statistics.total}</div>
            <div class="metric-label">Total Runs</div>
          </div>
          <div class="metric-item">
            <div class="metric-value">{statistics.successRate}%</div>
            <div class="metric-label">Success Rate</div>
          </div>
          <div class="metric-item">
            <div class="metric-value">{tests.length}</div>
            <div class="metric-label">Active Tests</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .results-panel {
    display: flex;
    height: 100%;
  }

  .left-panel, .right-panel {
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

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-card {
    background-color: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    text-align: center;
  }

  .stat-card.success {
    border-color: #10b981;
    background-color: #ecfdf5;
  }

  .stat-card.error {
    border-color: #dc2626;
    background-color: #fef2f2;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: bold;
    color: #111827;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .controls-section {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .control-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .control-row:last-child {
    margin-bottom: 0;
  }

  .control-group {
    flex: 1;
  }

  .control-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.25rem;
  }

  .control-select {
    width: 100%;
    padding: 0.375rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background-color: white;
  }

  .results-count {
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 1rem;
    text-align: center;
  }

  .results-list {
    max-height: 500px;
    overflow-y: auto;
  }

  .result-item {
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    margin-bottom: 0.75rem;
    background-color: white;
    overflow: hidden;
  }

  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .result-header:hover {
    background-color: #f9fafb;
  }

  .result-main {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .result-status {
    font-size: 1.25rem;
  }

  .result-test-name {
    font-weight: 500;
    color: #111827;
    margin-bottom: 0.25rem;
  }

  .result-meta {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .result-actions {
    display: flex;
    gap: 0.25rem;
  }

  .result-details {
    border-top: 1px solid #e5e7eb;
    padding: 1rem;
    background-color: #f9fafb;
  }

  .detail-section {
    margin-bottom: 1rem;
  }

  .detail-section:last-child {
    margin-bottom: 0;
  }

  .detail-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: #111827;
    margin: 0 0 0.5rem 0;
  }

  .error-message {
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.375rem;
    padding: 0.75rem;
    font-family: monospace;
    font-size: 0.875rem;
    color: #991b1b;
  }

  .logs-container {
    background-color: #f3f4f6;
    border-radius: 0.375rem;
    padding: 0.75rem;
    max-height: 200px;
    overflow-y: auto;
  }

  .log-entry {
    font-family: monospace;
    font-size: 0.75rem;
    color: #374151;
    margin-bottom: 0.25rem;
  }

  .screenshots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.75rem;
  }

  .screenshot-item {
    text-align: center;
  }

  .screenshot-image {
    width: 100%;
    height: 100px;
    object-fit: cover;
    border-radius: 0.375rem;
    border: 1px solid #e5e7eb;
  }

  .screenshot-name {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
  }

  .detail-key {
    color: #6b7280;
    font-weight: 500;
  }

  .detail-value {
    color: #111827;
  }

  .btn {
    padding: 0.375rem 0.75rem;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-small {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }

  .btn-tiny {
    padding: 0.125rem 0.375rem;
    font-size: 0.75rem;
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

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #6b7280;
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .empty-text {
    font-size: 1.125rem;
    font-weight: 500;
    margin-bottom: 0.5rem;
  }

  .empty-subtext {
    font-size: 0.875rem;
  }

  /* Right Panel Styles */
  .panel-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 1.5rem 0;
  }

  .chart-section, .activity-section, .performance-section {
    background-color: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .chart-title, .activity-title, .performance-title {
    font-size: 1rem;
    font-weight: 500;
    color: #111827;
    margin: 0 0 1rem 0;
  }

  .success-rate-chart {
    margin-bottom: 1rem;
  }

  .chart-bar {
    height: 30px;
    background-color: #f3f4f6;
    border-radius: 15px;
    display: flex;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }

  .chart-bar-fill {
    height: 100%;
    transition: width 0.3s ease;
  }

  .chart-bar-fill.success {
    background-color: #10b981;
  }

  .chart-bar-fill.error {
    background-color: #dc2626;
  }

  .chart-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
  }

  .chart-label.success {
    color: #10b981;
  }

  .chart-label.error {
    color: #dc2626;
  }

  .activity-list {
    max-height: 300px;
    overflow-y: auto;
  }

  .activity-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f3f4f6;
  }

  .activity-item:last-child {
    border-bottom: none;
  }

  .activity-content {
    flex: 1;
  }

  .activity-test {
    font-size: 0.875rem;
    font-weight: 500;
    color: #111827;
  }

  .activity-time {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .activity-duration {
    font-size: 0.75rem;
    color: #059669;
    font-family: monospace;
  }

  .activity-empty {
    text-align: center;
    color: #6b7280;
    font-size: 0.875rem;
    padding: 2rem;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .metric-item {
    text-align: center;
    padding: 1rem;
    background-color: #f8fafc;
    border-radius: 0.375rem;
  }

  .metric-value {
    font-size: 1.25rem;
    font-weight: bold;
    color: #111827;
    margin-bottom: 0.25rem;
  }

  .metric-label {
    font-size: 0.75rem;
    color: #6b7280;
  }
</style>
