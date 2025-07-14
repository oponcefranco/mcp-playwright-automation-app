// lib/stores/mcpStore.js

import { writable } from 'svelte/store';

function createMCPStore() {
  const initialState = {
    status: 'disconnected', // 'disconnected', 'connecting', 'connected', 'error'
    ws: null,
    serverInfo: null,
    lastError: null,
    connectionAttempts: 0,
    isReconnecting: false,
    runningTests: new Map(),
    testLogs: new Map()
  };

  const { subscribe, set, update } = writable(initialState);

  let reconnectInterval = null;
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;

  const store = {
    subscribe,

    // Internal methods
    updateState(updater) {
      update(state => typeof updater === 'function' ? updater(state) : { ...state, ...updater });
    },

    getCurrentState() {
      let currentState;
      this.subscribe(state => currentState = state)();
      return currentState;
    },

    // Connection management
    connect() {
      console.log('🔌 Attempting to connect to MCP server...');

      const currentState = this.getCurrentState();
      if (currentState.status === 'connecting' || currentState.status === 'connected') {
        console.log('⚠️ Already connecting or connected');
        return;
      }

      this.updateState({ status: 'connecting', lastError: null });

      try {
        const ws = new WebSocket('ws://localhost:8080/mcp');

        ws.onopen = () => {
          console.log('✅ Connected to MCP server');
          this.updateState({
            status: 'connected',
            ws,
            connectionAttempts: 0,
            isReconnecting: false,
            lastError: null
          });
          this.clearReconnectInterval();
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ Error parsing MCP message:', error);
          }
        };

        ws.onclose = (event) => {
          console.log(`🔌 Disconnected from MCP server: ${event.code}`, event.reason);
          this.updateState({
            status: 'disconnected',
            ws: null,
            lastError: event.reason || `Connection closed (${event.code})`
          });

          if (event.code !== 1000) { // Not a normal closure
            this.scheduleReconnect();
          }
        };

        ws.onerror = (error) => {
          console.error('❌ MCP WebSocket error:', error);
          this.updateState({
            status: 'error',
            lastError: 'WebSocket connection failed'
          });
          this.scheduleReconnect();
        };

        this.updateState({ ws });

      } catch (error) {
        console.error('❌ Error creating WebSocket connection:', error);
        this.updateState({
          status: 'error',
          lastError: error.message
        });
        this.scheduleReconnect();
      }
    },

    disconnect() {
      console.log('🔌 Disconnecting from MCP server...');
      const currentState = this.getCurrentState();

      this.clearReconnectInterval();

      if (currentState.ws) {
        currentState.ws.close(1000, 'Client disconnect');
      }

      this.updateState({
        status: 'disconnected',
        ws: null,
        isReconnecting: false
      });
    },

    scheduleReconnect() {
      if (reconnectInterval) return;

      const currentState = this.getCurrentState();
      if (currentState.connectionAttempts >= maxReconnectAttempts) {
        this.updateState({
          status: 'error',
          lastError: 'Max reconnection attempts reached. Please check MCP server.'
        });
        return;
      }

      this.updateState({ isReconnecting: true });

      reconnectInterval = setTimeout(() => {
        const state = this.getCurrentState();
        this.updateState({
          connectionAttempts: state.connectionAttempts + 1
        });

        console.log(`🔄 Reconnection attempt ${state.connectionAttempts + 1}/${maxReconnectAttempts}`);
        this.clearReconnectInterval();
        this.connect();
      }, reconnectDelay);
    },

    clearReconnectInterval() {
      if (reconnectInterval) {
        clearTimeout(reconnectInterval);
        reconnectInterval = null;
      }
    },

    // Message handling
    handleMessage(message) {
      console.log('📨 MCP message received:', message.type);

      switch (message.type) {
        case 'connection':
          this.updateState({
            serverInfo: message.serverInfo,
            status: 'connected'
          });
          break;

        case 'test_started':
          this.updateState(state => ({
            ...state,
            runningTests: new Map(state.runningTests).set(message.executionId, {
              status: 'running',
              startedAt: message.timestamp
            })
          }));
          break;

        case 'test_log':
          this.updateState(state => {
            const logs = state.testLogs.get(message.executionId) || [];
            logs.push(message.log);
            const newTestLogs = new Map(state.testLogs);
            newTestLogs.set(message.executionId, logs);
            return { ...state, testLogs: newTestLogs };
          });
          break;

        case 'test_completed':
          this.updateState(state => {
            const newRunningTests = new Map(state.runningTests);
            newRunningTests.delete(message.executionId);
            return { ...state, runningTests: newRunningTests };
          });

          // Emit custom event for test completion
          window.dispatchEvent(new CustomEvent('mcpTestCompleted', {
            detail: {
              executionId: message.executionId,
              results: message.results,
              status: message.status
            }
          }));
          break;

        case 'error':
          console.error('❌ MCP Server error:', message.error, message.details);
          this.updateState({
            lastError: `${message.error}: ${message.details}`
          });
          break;

        case 'pong':
          // Handle ping response
          break;

        default:
          console.warn('⚠️ Unknown MCP message type:', message.type);
      }
    },

    // Test execution methods
    async runTest(testCode, config = {}) {
      const currentState = this.getCurrentState();

      if (currentState.status !== 'connected') {
        throw new Error('Not connected to MCP server');
      }

      const testId = Date.now().toString();
      const message = {
        type: 'run_test',
        testId,
        testCode,
        config
      };

      console.log('🚀 Sending test execution request:', testId);
      currentState.ws.send(JSON.stringify(message));

      // Return a promise that resolves when the test completes
      return new Promise((resolve, reject) => {
        const handleCompletion = (event) => {
          if (event.detail.executionId === testId) {
            window.removeEventListener('mcpTestCompleted', handleCompletion);
            resolve(event.detail);
          }
        };

        window.addEventListener('mcpTestCompleted', handleCompletion);

        // Timeout after 5 minutes
        setTimeout(() => {
          window.removeEventListener('mcpTestCompleted', handleCompletion);
          reject(new Error('Test execution timeout'));
        }, 300000);
      });
    },

    async stopTest(executionId) {
      const currentState = this.getCurrentState();

      if (currentState.status !== 'connected') {
        throw new Error('Not connected to MCP server');
      }

      const message = {
        type: 'stop_test',
        executionId
      };

      currentState.ws.send(JSON.stringify(message));
    },

    async getTestStatus(executionId) {
      const currentState = this.getCurrentState();

      if (currentState.status !== 'connected') {
        throw new Error('Not connected to MCP server');
      }

      const message = {
        type: 'get_test_status',
        executionId
      };

      currentState.ws.send(JSON.stringify(message));
    },

    async listBrowsers() {
      const currentState = this.getCurrentState();

      if (currentState.status !== 'connected') {
        throw new Error('Not connected to MCP server');
      }

      const message = {
        type: 'list_browsers'
      };

      currentState.ws.send(JSON.stringify(message));
    },

    // Utility methods
    ping() {
      const currentState = this.getCurrentState();
      if (currentState.status === 'connected' && currentState.ws) {
        currentState.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    },

    getRunningTests() {
      const currentState = this.getCurrentState();
      return Array.from(currentState.runningTests.entries());
    },

    getTestLogs(executionId) {
      const currentState = this.getCurrentState();
      return currentState.testLogs.get(executionId) || [];
    }
  };

  return store;
}

export const mcpStore = createMCPStore();