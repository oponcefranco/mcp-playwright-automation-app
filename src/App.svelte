<!-- App.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { mcpStore } from './lib/stores/mcpStore.js';
  import { testStore } from './lib/stores/testStore.js';
  import TestBuilder from './lib/components/TestBuilder.svelte';
  import TestRunner from './lib/components/TestRunner.svelte';
  import ResultsPanel from './lib/components/ResultsPanel.svelte';
  import ConfigPanel from './lib/components/ConfigPanel.svelte';
  import MCPStatusMonitor from './lib/components/MCPStatusMonitor.svelte';

  console.log('🎭 Complete Playwright Automation App loaded!');

  let activeTab = 'builder';
  let mcpState = { status: 'disconnected' };
  let testState = { tests: [], results: [] };
  
  // Store subscriptions
  let mcpUnsubscribe;
  let testUnsubscribe;
  
  onMount(async () => {
    console.log('🚀 App mounted, activeTab:', activeTab);
    
    // Subscribe to store updates
    mcpUnsubscribe = mcpStore.subscribe(state => {
      mcpState = state;
    });
    
    testUnsubscribe = testStore.subscribe(state => {
      testState = state;
      console.log('📊 Test state updated:', {
        tests: state.tests.length,
        results: state.results.length
      });
    });
    
    // Try to connect to MCP server
    setTimeout(() => {
      mcpStore.connect();
    }, 1000);
  });

  onDestroy(() => {
    if (mcpUnsubscribe) mcpUnsubscribe();
    if (testUnsubscribe) testUnsubscribe();
    mcpStore.disconnect();
  });

  const tabs = [
    { id: 'builder', label: 'Test Builder', icon: '🔧' },
    { id: 'runner', label: 'Test Runner', icon: '▶️' },
    { id: 'results', label: 'Results', icon: '📊' },
    { id: 'config', label: 'Config', icon: '⚙️' }
  ];

  $: testStats = testStore.getTestStatistics();
  $: console.log('🔄 Current tab:', activeTab);
</script>

<!-- Success banner -->
<div class="success-banner">
  ✅ Complete Playwright Automation App | Current tab: {activeTab} | Tests: {testState.tests.length} | Results: {testState.results.length}
</div>

<main class="app-main">
  <header class="app-header">
    <div class="header-content">
      <div class="header-left">
        <h1 class="app-title">🎭 Playwright Automation</h1>
        <div class="app-subtitle">AI-Powered Testing Framework</div>
      </div>
      <MCPStatusMonitor status={mcpState.status} {mcpState} />
    </div>
    
    <nav class="tab-nav">
      {#each tabs as tab}
        <button
          class="tab-button {activeTab === tab.id ? 'active' : ''}"
          on:click={() => activeTab = tab.id}
        >
          <span class="tab-icon">{tab.icon}</span>
          {tab.label}
          {#if tab.id === 'runner' && testState.tests.length > 0}
            <span class="tab-count">{testState.tests.length}</span>
          {/if}
          {#if tab.id === 'results' && testState.results.length > 0}
            <span class="tab-count">{testState.results.length}</span>
          {/if}
        </button>
      {/each}
    </nav>
  </header>

  <div class="main-content">
    {#if activeTab === 'builder'}
      <TestBuilder />
    {:else if activeTab === 'runner'}
      <TestRunner />
    {:else if activeTab === 'results'}
      <ResultsPanel />
    {:else if activeTab === 'config'}
      <ConfigPanel />
    {:else}
      <div class="placeholder-content">
        <div class="placeholder-icon">❓</div>
        <h2 class="placeholder-title">Unknown Tab: {activeTab}</h2>
        <p class="placeholder-text">Something went wrong</p>
      </div>
    {/if}
  </div>
</main>

<style>
  .success-banner {
    background: linear-gradient(90deg, #10b981, #059669);
    color: white;
    padding: 0.5rem;
    text-align: center;
    font-weight: bold;
    position: sticky;
    top: 0;
    z-index: 1000;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    font-size: 0.875rem;
  }

  .app-main {
    height: 100vh;
    background-color: #f9fafb;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .app-header {
    background-color: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    border-bottom: 1px solid #e5e7eb;
  }

  .header-content {
    padding: 1rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .app-title {
    font-size: 1.5rem;
    font-weight: bold;
    color: #111827;
    margin: 0;
  }

  .app-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .tab-nav {
    display: flex;
    gap: 2rem;
    padding: 0 1.5rem;
  }

  .tab-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    background: none;
    border-bottom: 2px solid transparent;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-button:hover {
    color: #374151;
    border-bottom-color: #d1d5db;
  }

  .tab-button.active {
    color: #2563eb;
    border-bottom-color: #2563eb;
  }

  .tab-icon {
    margin-right: 0.5rem;
  }

  .tab-count {
    background-color: #3b82f6;
    color: white;
    font-size: 0.75rem;
    padding: 2px 6px;
    border-radius: 10px;
    margin-left: 4px;
  }

  .main-content {
    flex: 1;
    overflow: hidden;
  }

  .placeholder-content {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2rem;
  }

  .placeholder-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .placeholder-title {
    font-size: 2rem;
    font-weight: bold;
    color: #111827;
    margin-bottom: 0.5rem;
  }

  .placeholder-text {
    color: #6b7280;
    margin-bottom: 1rem;
  }
</style>
