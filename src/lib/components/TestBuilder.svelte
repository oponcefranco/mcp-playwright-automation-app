<!-- lib/components/TestBuilder.svelte -->
<script>
  import { testStore } from '../stores/testStore.js';
  import { mcpStore } from '../stores/mcpStore.js';
  import { stepParser } from '../utils/stepParser.js';
  import { playwrightGenerator } from '../utils/playwrightGenerator.js';

  console.log('🔧 TestBuilder component - Complete working version');

  let testInstructions = '';
  let testName = '';
  let testCategory = 'e2e';
  let baseUrl = 'https://example.com';
  let customHeaders = '{\n  "Authorization": "Bearer your-token"\n}';
  let useAuth = false;
  let isGenerating = false;
  let generatedTest = '';
  let steps = [];

  // Example instructions
  const exampleInstructions = `1. Navigate to https://example.com/login
2. Enter username "admin@example.com"
3. Enter password "secure123"
4. Click the login button
5. Verify user is redirected to dashboard
6. Check that welcome message is displayed`;

  $: if (testInstructions) {
    parseSteps();
  }

  // Reactive statement to log when generatedTest changes
  $: if (generatedTest) {
    console.log('🎯 generatedTest updated, length:', generatedTest.length);
  }

  async function parseSteps() {
    try {
      steps = await stepParser.parse(testInstructions);
      console.log('✅ Parsed', steps.length, 'steps');
    } catch (error) {
      console.error('❌ Error parsing steps:', error);
      steps = [];
    }
  }

  async function generatePlaywrightTest() {
    console.log('🎭 generatePlaywrightTest() called');
    
    if (!testInstructions.trim()) {
      alert('Please enter test instructions');
      return;
    }

    if (!testName.trim()) {
      alert('Please enter a test name');
      return;
    }

    if (steps.length === 0) {
      alert('No steps were parsed from your instructions. Please check your input.');
      return;
    }

    isGenerating = true;
    
    try {
      const testConfig = {
        name: testName,
        category: testCategory,
        baseUrl,
        customHeaders: useAuth ? JSON.parse(customHeaders) : {},
        steps: steps
      };

      console.log('🚀 Calling playwrightGenerator.generate()...');
      const result = await playwrightGenerator.generate(testConfig);
      
      // Force the reactive update
      generatedTest = result;
      
      console.log('✅ Test generated successfully! UI should update now.');
      
    } catch (error) {
      console.error('❌ Error generating test:', error);
      alert('Error generating test: ' + error.message);
    } finally {
      isGenerating = false;
    }
  }

  async function saveTest() {
    if (!generatedTest) {
      alert('Please generate a test first');
      return;
    }

    try {
      const test = {
        name: testName,
        category: testCategory,
        content: generatedTest,
        instructions: testInstructions,
        config: { baseUrl, useAuth, customHeaders: useAuth ? customHeaders : null }
      };

      testStore.addTest(test);
      alert('Test saved successfully!');
      clearForm();
      
    } catch (error) {
      console.error('❌ Error saving test:', error);
      alert('Error saving test: ' + error.message);
    }
  }

  async function runTestViaMCP() {
    if (!generatedTest) {
      alert('Please generate a test first');
      return;
    }

    try {
      console.log('🚀 Running test via MCP...');
      const result = await mcpStore.runTest(generatedTest, {
        baseURL: baseUrl,
        headless: true
      });
      
      console.log('✅ Test execution result:', result);
      alert(`Test completed with status: ${result.status}`);
      
    } catch (error) {
      console.error('❌ Error running test via MCP:', error);
      alert('Error running test: ' + error.message);
    }
  }

  function clearForm() {
    testInstructions = '';
    testName = '';
    generatedTest = '';
    steps = [];
  }

  function loadExample() {
    testInstructions = exampleInstructions;
    testName = 'Example Login Test';
    testCategory = 'e2e';
    baseUrl = 'https://example.com';
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy to clipboard');
    });
  }
</script>

<div class="test-builder">
  <!-- Left Panel - Test Builder -->
  <div class="left-panel">
    <div class="panel-content">
      <!-- Header -->
      <div class="section-header">
        <h2 class="section-title">🔧 Test Builder</h2>
        <button class="example-btn" on:click={loadExample}>
          📝 Load Example
        </button>
      </div>

      <!-- Test Configuration -->
      <div class="config-section">
        <h3 class="config-title">Test Configuration</h3>
        
        <div class="form-grid">
          <div class="form-group">
            <label for="test-name" class="form-label">Test Name</label>
            <input
              id="test-name"
              type="text"
              bind:value={testName}
              placeholder="e.g., Login Flow Test"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="test-category" class="form-label">Category</label>
            <select id="test-category" bind:value={testCategory} class="form-select">
              <option value="e2e">End-to-End</option>
              <option value="api">API</option>
              <option value="integration">Integration</option>
              <option value="smoke">Smoke</option>
            </select>
          </div>

          <div class="form-group form-group-full">
            <label for="base-url" class="form-label">Base URL</label>
            <input
              id="base-url"
              type="url"
              bind:value={baseUrl}
              placeholder="https://example.com"
              class="form-input"
            />
          </div>
        </div>
      </div>

      <!-- Authentication Configuration -->
      <div class="config-section">
        <div class="config-header">
          <h3 class="config-title">Authentication & Headers</h3>
          <label class="toggle-label">
            <input type="checkbox" bind:checked={useAuth} class="toggle-input" />
            <span class="toggle-text">Enable</span>
          </label>
        </div>

        {#if useAuth}
          <div class="form-group">
            <label for="custom-headers" class="form-label">Custom Headers (JSON)</label>
            <textarea
              id="custom-headers"
              bind:value={customHeaders}
              rows="4"
              class="form-textarea"
              placeholder={'{"Authorization": "Bearer token"}'}
            ></textarea>
          </div>
        {/if}
      </div>

      <!-- Test Instructions -->
      <div class="config-section">
        <h3 class="config-title">Test Instructions</h3>
        <textarea
          bind:value={testInstructions}
          rows="12"
          class="form-textarea"
          placeholder="Enter step-by-step test instructions:

1. Navigate to the login page
2. Enter username 'admin@example.com'
3. Enter password 'secure123'
4. Click the login button
5. Verify user is redirected to dashboard
6. Check that welcome message is displayed"
        ></textarea>
      </div>

      <!-- Parsed Steps Preview -->
      {#if steps.length > 0}
        <div class="steps-preview">
          <h4 class="steps-title">✨ Parsed Steps ({steps.length})</h4>
          <div class="steps-list">
            {#each steps as step, index}
              <div class="step-item">
                <span class="step-number">{index + 1}</span>
                <div class="step-content">
                  <div class="step-action">{step.action}</div>
                  {#if step.target}
                    <div class="step-detail">Target: {step.target}</div>
                  {/if}
                  {#if step.value}
                    <div class="step-detail">Value: {step.value}</div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button
          on:click={generatePlaywrightTest}
          disabled={isGenerating || !testInstructions.trim() || !testName.trim()}
          class="btn btn-primary"
        >
          {#if isGenerating}
            🔄 Generating...
          {:else}
            🎭 Generate Playwright Test
          {/if}
        </button>

        <button on:click={clearForm} class="btn btn-secondary">
          🗑️ Clear
        </button>
      </div>
    </div>
  </div>

  <!-- Right Panel - Generated Test -->
  <div class="right-panel">
    <div class="panel-content">
      <div class="result-header">
        <h3 class="result-title">Generated Playwright Test</h3>
        
        {#if generatedTest}
          <div class="result-actions">
            <button
              on:click={() => copyToClipboard(generatedTest)}
              class="btn btn-small"
            >
              📋 Copy
            </button>
            
            <button
              on:click={saveTest}
              class="btn btn-small btn-success"
            >
              💾 Save Test
            </button>
            
            <button
              on:click={runTestViaMCP}
              class="btn btn-small btn-warning"
            >
              🤖 Run via MCP
            </button>
          </div>
        {/if}
      </div>

      <!-- Debug info for generated test -->
      <div class="debug-info">
        Generated test length: {generatedTest.length} characters
        {#if generatedTest}✅ Test ready{:else}⏳ No test generated yet{/if}
      </div>

      {#if generatedTest}
        <div class="code-container">
          <pre class="code-block">{generatedTest}</pre>
        </div>
      {:else}
        <div class="empty-state">
          <div class="empty-icon">🎭</div>
          <div class="empty-title">No test generated yet</div>
          <div class="empty-text">Enter test instructions and click "Generate Playwright Test" to see the generated code</div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .test-builder {
    display: flex;
    height: 100%;
  }

  .left-panel, .right-panel {
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

  .example-btn {
    background-color: #6b7280;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .example-btn:hover {
    background-color: #4b5563;
  }

  .config-section {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .config-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .config-title {
    font-size: 1.125rem;
    font-weight: 500;
    color: #111827;
    margin: 0 0 1rem 0;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .toggle-input {
    margin: 0;
  }

  .toggle-text {
    font-size: 0.875rem;
    color: #6b7280;
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

  .form-group-full {
    grid-column: span 2;
  }

  .form-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.25rem;
  }

  .form-input, .form-select, .form-textarea {
    padding: 0.5rem 0.75rem;
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
    min-width: 350px;
    width: 100%;
  }

  .steps-preview {
    background-color: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .steps-title {
    font-size: 1rem;
    font-weight: 500;
    color: #1e40af;
    margin: 0 0 0.75rem 0;
  }

  .steps-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .step-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .step-number {
    background-color: #3b82f6;
    color: white;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    min-width: 1.5rem;
    text-align: center;
  }

  .step-content {
    flex: 1;
  }

  .step-action {
    font-size: 0.875rem;
    font-weight: 500;
    color: #111827;
    text-transform: capitalize;
  }

  .step-detail {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .action-buttons {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    background-color: #f8fafc;
    border-radius: 0.5rem;
    border: 2px solid #3b82f6;
    margin-bottom: 1rem;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    flex: 1;
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

  .btn-small {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    flex: none;
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

  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .result-title {
    font-size: 1.125rem;
    font-weight: 500;
    color: #111827;
    margin: 0;
  }

  .result-actions {
    display: flex;
    gap: 0.5rem;
  }

  .debug-info {
    background: #fef3c7;
    border: 1px solid #f59e0b;
    padding: 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    margin-bottom: 1rem;
    text-align: center;
  }

  .code-container {
    background-color: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .code-block {
    padding: 1rem;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
    color: #374151;
    overflow-x: auto;
    white-space: pre-wrap;
    margin: 0;
    background-color: #f8fafc;
    max-height: 500px;
    overflow-y: auto;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
    background-color: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .empty-title {
    font-size: 1.125rem;
    font-weight: 500;
    color: #111827;
    margin-bottom: 0.5rem;
  }

  .empty-text {
    color: #6b7280;
    font-size: 0.875rem;
    max-width: 300px;
  }
</style>
