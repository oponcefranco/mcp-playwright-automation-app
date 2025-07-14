<!-- lib/components/ConfigPanel.svelte -->
<script>
  import { onMount } from 'svelte';
  import { testStore } from '../stores/testStore.js';
  import { mcpStore } from '../stores/mcpStore.js';

  console.log('⚙️ ConfigPanel component loaded');

  let runConfig = {
    browser: 'chromium',
    headless: true,
    parallel: false,
    timeout: 30000,
    retries: 1,
    slowMo: 0,
    viewport: {
      width: 1280,
      height: 720
    }
  };

  let mcpConfig = {
    serverUrl: 'http://localhost:3001',
    autoConnect: true,
    timeout: 5000,
    retryAttempts: 3
  };

  let globalSettings = {
    theme: 'light',
    autoSave: true,
    notifications: true,
    debugMode: false,
    clearLogsOnRun: true,
    maxLogEntries: 1000
  };

  let authSettings = {
    defaultHeaders: '{\n  "User-Agent": "Playwright Test Runner",\n  "Accept": "application/json"\n}',
    apiKey: '',
    bearerToken: '',
    basicAuth: {
      username: '',
      password: ''
    },
    customAuth: ''
  };

  let exportConfig = {
    includeResults: true,
    includeTests: true,
    includeSettings: false,
    format: 'json'
  };

  let importedData = null;
  let configChanged = false;
  let savedSuccessfully = false;
  let isLoadingSettings = false;
  let lastSavedConfig = null;

  // Subscribe to stores
  onMount(() => {
    const testUnsubscribe = testStore.subscribe(state => {
      if (state.runConfig) {
        runConfig = { ...runConfig, ...state.runConfig };
      }
    });

    const mcpUnsubscribe = mcpStore.subscribe(state => {
      // Update MCP status if needed
    });

    // Load saved settings from localStorage
    loadSettings();

    return () => {
      testUnsubscribe();
      mcpUnsubscribe();
    };
  });

  // Watch for actual config changes by comparing with last saved state
  $: {
    if (!isLoadingSettings && lastSavedConfig) {
      const currentConfig = {
        runConfig,
        mcpConfig,
        globalSettings,
        authSettings
      };
      
      const hasChanges = JSON.stringify(currentConfig) !== JSON.stringify(lastSavedConfig);
      
      if (hasChanges && !configChanged) {
        configChanged = true;
        savedSuccessfully = false;
      } else if (!hasChanges && configChanged) {
        configChanged = false;
      }
    }
  }

  function loadSettings() {
    try {
      isLoadingSettings = true;
      const saved = localStorage.getItem('playwright-automation-config');
      if (saved) {
        const config = JSON.parse(saved);
        runConfig = { ...runConfig, ...config.runConfig };
        mcpConfig = { ...mcpConfig, ...config.mcpConfig };
        globalSettings = { ...globalSettings, ...config.globalSettings };
        authSettings = { ...authSettings, ...config.authSettings };
        console.log('⚙️ Settings loaded from localStorage');
      }
      
      // Reset flags and save baseline after loading
      configChanged = false;
      savedSuccessfully = false;
      lastSavedConfig = {
        runConfig: { ...runConfig },
        mcpConfig: { ...mcpConfig },
        globalSettings: { ...globalSettings },
        authSettings: { ...authSettings }
      };
    } catch (error) {
      console.error('❌ Error loading settings:', error);
    } finally {
      isLoadingSettings = false;
    }
  }

  function saveSettings() {
    try {
      const config = {
        runConfig,
        mcpConfig,
        globalSettings,
        authSettings,
        savedAt: new Date().toISOString()
      };

      localStorage.setItem('playwright-automation-config', JSON.stringify(config));

      // Update test store with run config
      testStore.updateRunConfig(runConfig);

      configChanged = false;
      savedSuccessfully = true;
      
      // Update the baseline with current config
      lastSavedConfig = {
        runConfig: { ...runConfig },
        mcpConfig: { ...mcpConfig },
        globalSettings: { ...globalSettings },
        authSettings: { ...authSettings }
      };

      console.log('✅ Settings saved successfully');

      // Hide success message after 3 seconds
      setTimeout(() => {
        savedSuccessfully = false;
      }, 3000);

    } catch (error) {
      console.error('❌ Error saving settings:', error);
      alert('Error saving settings: ' + error.message);
    }
  }

  function resetToDefaults() {
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      isLoadingSettings = true;
      
      runConfig = {
        browser: 'chromium',
        headless: true,
        parallel: false,
        timeout: 30000,
        retries: 1,
        slowMo: 0,
        viewport: { width: 1280, height: 720 }
      };

      mcpConfig = {
        serverUrl: 'http://localhost:3001',
        autoConnect: true,
        timeout: 5000,
        retryAttempts: 3
      };

      globalSettings = {
        theme: 'light',
        autoSave: true,
        notifications: true,
        debugMode: false,
        clearLogsOnRun: true,
        maxLogEntries: 1000
      };

      authSettings = {
        defaultHeaders: '{\n  "User-Agent": "Playwright Test Runner",\n  "Accept": "application/json"\n}',
        apiKey: '',
        bearerToken: '',
        basicAuth: { username: '', password: '' },
        customAuth: ''
      };

      isLoadingSettings = false;
      
      // Update baseline before saving
      lastSavedConfig = {
        runConfig: { ...runConfig },
        mcpConfig: { ...mcpConfig },
        globalSettings: { ...globalSettings },
        authSettings: { ...authSettings }
      };
      
      saveSettings();
    }
  }

  function exportSettings() {
    try {
      const dataToExport = {};

      if (exportConfig.includeTests) {
        const testState = testStore.getCurrentState();
        dataToExport.tests = testState.tests;
      }

      if (exportConfig.includeResults) {
        const testState = testStore.getCurrentState();
        dataToExport.results = testState.results;
      }

      if (exportConfig.includeSettings) {
        dataToExport.settings = {
          runConfig,
          mcpConfig,
          globalSettings,
          authSettings
        };
      }

      const dataStr = JSON.stringify(dataToExport, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `playwright-automation-export-${new Date().toISOString().split('T')[0]}.json`;
      link.click();

      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('❌ Export failed:', error);
      alert('Export failed: ' + error.message);
    }
  }

  function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        importedData = JSON.parse(e.target.result);
        console.log('📥 File imported successfully');
      } catch (error) {
        console.error('❌ Import failed:', error);
        alert('Invalid file format');
      }
    };
    reader.readAsText(file);
  }

  function applyImportedData() {
    if (!importedData) return;

    try {
      if (importedData.tests) {
        importedData.tests.forEach(test => {
          testStore.addTest(test);
        });
      }

      if (importedData.results) {
        importedData.results.forEach(result => {
          testStore.addResult(result);
        });
      }

      if (importedData.settings) {
        isLoadingSettings = true;
        if (importedData.settings.runConfig) {
          runConfig = { ...runConfig, ...importedData.settings.runConfig };
        }
        if (importedData.settings.mcpConfig) {
          mcpConfig = { ...mcpConfig, ...importedData.settings.mcpConfig };
        }
        if (importedData.settings.globalSettings) {
          globalSettings = { ...globalSettings, ...importedData.settings.globalSettings };
        }
        if (importedData.settings.authSettings) {
          authSettings = { ...authSettings, ...importedData.settings.authSettings };
        }
        isLoadingSettings = false;
        
        // Update baseline after import
        lastSavedConfig = {
          runConfig: { ...runConfig },
          mcpConfig: { ...mcpConfig },
          globalSettings: { ...globalSettings },
          authSettings: { ...authSettings }
        };
      }

      saveSettings();
      importedData = null;

      alert('Data imported successfully!');

    } catch (error) {
      console.error('❌ Error applying imported data:', error);
      alert('Error importing data: ' + error.message);
    }
  }

  function testMcpConnection() {
    mcpStore.connect();
  }

  function clearAllData() {
    if (confirm('Are you sure you want to clear ALL data? This will delete all tests, results, and settings. This cannot be undone.')) {
      if (confirm('This is your final warning. All data will be permanently deleted. Continue?')) {
        localStorage.clear();
        testStore.clearResults();
        // Reset all configs
        resetToDefaults();
        alert('All data has been cleared successfully.');
      }
    }
  }
</script>

<div class="config-panel">
  <!-- Left Panel - Configuration Sections -->
  <div class="left-panel">
    <div class="panel-content">
      <!-- Header -->
      <div class="section-header">
        <h2 class="section-title">⚙️ Configuration</h2>
        <div class="header-actions">
          {#if savedSuccessfully}
            <span class="save-indicator success">✅ Saved</span>
          {:else if configChanged}
            <span class="save-indicator changed">● Unsaved</span>
          {/if}
          <button on:click={saveSettings} class="btn btn-primary" disabled={!configChanged}>
            💾 Save Settings
          </button>
        </div>
      </div>

      <!-- Browser & Test Configuration -->
      <div class="config-section">
        <h3 class="config-title">🌐 Browser & Test Settings</h3>

        <form on:submit|preventDefault={() => {}}>
          <div class="form-grid">
          <div class="form-group">
            <label for="default-browser" class="form-label">Default Browser</label>
            <select id="default-browser" bind:value={runConfig.browser} class="form-select">
              <option value="chromium">Chromium</option>
              <option value="firefox">Firefox</option>
              <option value="webkit">WebKit (Safari)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="timeout" class="form-label">Timeout (ms)</label>
            <input
                    id="timeout"
                    type="number"
                    bind:value={runConfig.timeout}
                    min="5000"
                    max="300000"
                    step="5000"
                    class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="retries" class="form-label">Retries</label>
            <input
                    id="retries"
                    type="number"
                    bind:value={runConfig.retries}
                    min="0"
                    max="5"
                    class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="slow-motion" class="form-label">Slow Motion (ms)</label>
            <input
                    id="slow-motion"
                    type="number"
                    bind:value={runConfig.slowMo}
                    min="0"
                    max="5000"
                    step="100"
                    class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="viewport-width" class="form-label">Viewport Width</label>
            <input
                    id="viewport-width"
                    type="number"
                    bind:value={runConfig.viewport.width}
                    min="320"
                    max="3840"
                    class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="viewport-height" class="form-label">Viewport Height</label>
            <input
                    id="viewport-height"
                    type="number"
                    bind:value={runConfig.viewport.height}
                    min="240"
                    max="2160"
                    class="form-input"
            />
          </div>
        </div>

          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={runConfig.headless} class="checkbox-input" />
              <span class="checkbox-text">Headless Mode</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={runConfig.parallel} class="checkbox-input" />
              <span class="checkbox-text">Parallel Execution</span>
            </label>
          </div>
        </form>
      </div>

      <!-- MCP Server Configuration -->
      <div class="config-section">
        <h3 class="config-title">🤖 MCP Server Settings</h3>

        <form on:submit|preventDefault={() => {}}>
          <div class="form-grid">
          <div class="form-group form-group-full">
            <label for="server-url" class="form-label">Server URL</label>
            <input
                    id="server-url"
                    type="url"
                    bind:value={mcpConfig.serverUrl}
                    placeholder="http://localhost:3001"
                    class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="connection-timeout" class="form-label">Connection Timeout (ms)</label>
            <input
                    id="connection-timeout"
                    type="number"
                    bind:value={mcpConfig.timeout}
                    min="1000"
                    max="30000"
                    step="1000"
                    class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="retry-attempts" class="form-label">Retry Attempts</label>
            <input
                    id="retry-attempts"
                    type="number"
                    bind:value={mcpConfig.retryAttempts}
                    min="1"
                    max="10"
                    class="form-input"
            />
          </div>
        </div>

          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={mcpConfig.autoConnect} class="checkbox-input" />
              <span class="checkbox-text">Auto-connect on startup</span>
            </label>
          </div>

          <div class="action-row">
            <button on:click={testMcpConnection} class="btn btn-secondary">
              🔌 Test Connection
            </button>
          </div>
        </form>
      </div>

      <!-- Global Application Settings -->
      <div class="config-section">
        <h3 class="config-title">🎨 Application Settings</h3>

        <form on:submit|preventDefault={() => {}}>
          <div class="form-grid">
          <div class="form-group">
            <label for="theme" class="form-label">Theme</label>
            <select id="theme" bind:value={globalSettings.theme} class="form-select">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto (System)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="max-log-entries" class="form-label">Max Log Entries</label>
            <input
                    id="max-log-entries"
                    type="number"
                    bind:value={globalSettings.maxLogEntries}
                    min="100"
                    max="10000"
                    step="100"
                    class="form-input"
            />
          </div>
        </div>

          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={globalSettings.autoSave} class="checkbox-input" />
              <span class="checkbox-text">Auto-save tests</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={globalSettings.notifications} class="checkbox-input" />
              <span class="checkbox-text">Show notifications</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={globalSettings.debugMode} class="checkbox-input" />
              <span class="checkbox-text">Debug mode</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={globalSettings.clearLogsOnRun} class="checkbox-input" />
              <span class="checkbox-text">Clear logs on test run</span>
            </label>
          </div>
        </form>
      </div>

      <!-- Authentication Settings -->
      <div class="config-section">
        <h3 class="config-title">🔐 Authentication Settings</h3>

        <form on:submit|preventDefault={() => {}}>
          <div class="form-group">
            <label for="default-headers" class="form-label">Default Headers (JSON)</label>
            <textarea
                    id="default-headers"
                    bind:value={authSettings.defaultHeaders}
                    rows="4"
                    class="form-textarea"
                    placeholder={'{"User-Agent": "Playwright Test Runner"}'}
            ></textarea>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label for="api-key" class="form-label">API Key</label>
              <input
                      id="api-key"
                      type="password"
                      bind:value={authSettings.apiKey}
                      placeholder="Enter API key"
                      class="form-input"
                      autocomplete="off"
              />
            </div>

            <div class="form-group">
              <label for="bearer-token" class="form-label">Bearer Token</label>
              <input
                      id="bearer-token"
                      type="password"
                      bind:value={authSettings.bearerToken}
                      placeholder="Enter bearer token"
                      class="form-input"
                      autocomplete="off"
              />
            </div>

            <div class="form-group">
              <label for="basic-auth-username" class="form-label">Basic Auth Username</label>
              <input
                      id="basic-auth-username"
                      type="text"
                      bind:value={authSettings.basicAuth.username}
                      placeholder="Username"
                      class="form-input"
                      autocomplete="username"
              />
            </div>

            <div class="form-group">
              <label for="basic-auth-password" class="form-label">Basic Auth Password</label>
              <input
                      id="basic-auth-password"
                      type="password"
                      bind:value={authSettings.basicAuth.password}
                      placeholder="Password"
                      class="form-input"
                      autocomplete="current-password"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="custom-auth" class="form-label">Custom Authentication Script</label>
            <textarea
                    id="custom-auth"
                    bind:value={authSettings.customAuth}
                    rows="3"
                    class="form-textarea"
                    placeholder="// Custom authentication logic (JavaScript)&#10;// Example: await page.setExtraHTTPHeaders(headers);"
            ></textarea>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Right Panel - Data Management -->
  <div class="right-panel">
    <div class="panel-content">
      <h3 class="panel-title">📂 Data Management</h3>

      <!-- Export Settings -->
      <div class="data-section">
        <h4 class="data-title">📤 Export Data</h4>

        <div class="checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={exportConfig.includeTests} class="checkbox-input" />
            <span class="checkbox-text">Include Tests</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={exportConfig.includeResults} class="checkbox-input" />
            <span class="checkbox-text">Include Results</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={exportConfig.includeSettings} class="checkbox-input" />
            <span class="checkbox-text">Include Settings</span>
          </label>
        </div>

        <div class="form-group">
          <label for="export-format" class="form-label">Export Format</label>
          <select id="export-format" bind:value={exportConfig.format} class="form-select">
            <option value="json">JSON</option>
            <option value="csv">CSV (Results only)</option>
          </select>
        </div>

        <button on:click={exportSettings} class="btn btn-primary btn-full">
          📥 Export Data
        </button>
      </div>

      <!-- Import Settings -->
      <div class="data-section">
        <h4 class="data-title">📥 Import Data</h4>

        <div class="form-group">
          <label for="import-file" class="form-label">Select File</label>
          <input
                  id="import-file"
                  type="file"
                  accept=".json"
                  on:change={handleFileImport}
                  class="file-input"
          />
        </div>

        {#if importedData}
          <div class="import-preview">
            <div class="preview-title">Import Preview:</div>
            <div class="preview-stats">
              {#if importedData.tests}
                <span class="preview-item">📝 {importedData.tests.length} tests</span>
              {/if}
              {#if importedData.results}
                <span class="preview-item">📊 {importedData.results.length} results</span>
              {/if}
              {#if importedData.settings}
                <span class="preview-item">⚙️ Settings included</span>
              {/if}
            </div>
            <button on:click={applyImportedData} class="btn btn-success btn-full">
              ✅ Apply Import
            </button>
          </div>
        {/if}
      </div>

      <!-- System Actions -->
      <div class="data-section danger-section">
        <h4 class="data-title">⚠️ System Actions</h4>

        <div class="action-grid">
          <button on:click={resetToDefaults} class="btn btn-warning btn-full">
            🔄 Reset to Defaults
          </button>
          <button on:click={clearAllData} class="btn btn-danger btn-full">
            🗑️ Clear All Data
          </button>
        </div>

        <div class="warning-text">
          ⚠️ These actions cannot be undone. Please export your data first if you want to keep it.
        </div>
      </div>

      <!-- System Information -->
      <div class="data-section">
        <h4 class="data-title">📋 System Information</h4>

        <div class="info-grid">
          <div class="info-item">
            <span class="info-key">Version:</span>
            <span class="info-value">1.0.0</span>
          </div>
          <div class="info-item">
            <span class="info-key">User Agent:</span>
            <span class="info-value">{navigator.userAgent.split(' ')[0]}</span>
          </div>
          <div class="info-item">
            <span class="info-key">Storage Used:</span>
            <span class="info-value">~{Math.round((JSON.stringify(localStorage).length / 1024))} KB</span>
          </div>
          <div class="info-item">
            <span class="info-key">Last Saved:</span>
            <span class="info-value">
              {#if savedSuccessfully}
                Just now
              {:else}
                {configChanged ? 'Unsaved changes' : 'No changes'}
              {/if}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .config-panel {
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
    align-items: center;
    gap: 0.75rem;
  }

  .save-indicator {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .save-indicator.success {
    color: #10b981;
  }

  .save-indicator.changed {
    color: #f59e0b;
  }

  .config-section {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1.5rem;
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
    margin-bottom: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  .form-group-full {
    grid-column: span 2;
  }

  .form-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .form-input, .form-select, .form-textarea {
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    transition: border-color 0.2s;
  }

  .form-input:focus, .form-select:focus, .form-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-textarea {
    resize: vertical;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
    font-size: 0.8rem;
  }

  .checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .checkbox-input {
    margin: 0;
  }

  .checkbox-text {
    font-size: 0.875rem;
    color: #374151;
  }

  .action-row {
    margin-top: 1rem;
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

  .btn-success {
    background-color: #10b981;
    color: white;
  }

  .btn-success:hover {
    background-color: #059669;
  }

  .btn-warning {
    background-color: #f59e0b;
    color: white;
  }

  .btn-warning:hover {
    background-color: #d97706;
  }

  .btn-danger {
    background-color: #dc2626;
    color: white;
  }

  .btn-danger:hover {
    background-color: #b91c1c;
  }

  .btn-full {
    width: 100%;
  }

  /* Right Panel Styles */
  .panel-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 1.5rem 0;
  }

  .data-section {
    background-color: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .data-section.danger-section {
    border-color: #fecaca;
    background-color: #fef2f2;
  }

  .data-title {
    font-size: 1rem;
    font-weight: 500;
    color: #111827;
    margin: 0 0 1rem 0;
  }

  .file-input {
    width: 100%;
    padding: 0.75rem;
    border: 2px dashed #d1d5db;
    border-radius: 0.375rem;
    background-color: #f9fafb;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .file-input:hover {
    border-color: #3b82f6;
  }

  .import-preview {
    background-color: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 0.375rem;
    padding: 1rem;
    margin-top: 1rem;
  }

  .preview-title {
    font-weight: 500;
    color: #1e40af;
    margin-bottom: 0.5rem;
  }

  .preview-stats {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 1rem;
  }

  .preview-item {
    font-size: 0.875rem;
    color: #1e40af;
  }

  .action-grid {
    display: grid;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .warning-text {
    font-size: 0.75rem;
    color: #991b1b;
    text-align: center;
    font-style: italic;
  }

  .info-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f3f4f6;
  }

  .info-item:last-child {
    border-bottom: none;
  }

  .info-key {
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 500;
  }

  .info-value {
    font-size: 0.875rem;
    color: #111827;
    font-family: monospace;
  }
</style>
