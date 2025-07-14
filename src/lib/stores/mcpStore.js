// lib/stores/mcpStore.js
import { writable } from 'svelte/store';

class MCPStore {
  constructor() {
    this.state = writable({
      status: 'disconnected', // disconnected, connecting, connected, error
      server: null,
      lastError: null,
      connectionAttempts: 0,
      serverInfo: null,
      isReconnecting: false
    });
    
    this.ws = null;
    this.reconnectInterval = null;
    this.heartbeatInterval = null;
    this.reconnectDelay = 5000; // 5 seconds
    this.maxReconnectAttempts = 5;
  }

  subscribe(callback) {
    return this.state.subscribe(callback);
  }

  async connect() {
    this.updateState({ status: 'connecting' });
    
    try {
      // Try to connect to MCP server
      this.ws = new WebSocket('ws://localhost:8080/mcp');
      
      this.ws.onopen = () => {
        console.log('✅ Connected to MCP server');
        this.updateState({ 
          status: 'connected',
          lastError: null,
          connectionAttempts: 0,
          isReconnecting: false
        });
        
        this.startHeartbeat();
        this.sendHandshake();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing MCP message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('🔌 Disconnected from MCP server:', event.code, event.reason);
        this.updateState({ status: 'disconnected' });
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('❌ MCP WebSocket error:', error);
        this.updateState({ 
          status: 'error',
          lastError: 'Connection failed - Make sure MCP server is running on port 8080'
        });
      };

    } catch (error) {
      console.error('❌ Failed to connect to MCP server:', error);
      this.updateState({ 
        status: 'error',
        lastError: error.message
      });
    }
  }

  disconnect() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.stopHeartbeat();
    this.updateState({ status: 'disconnected', isReconnecting: false });
  }

  sendHandshake() {
    this.sendMessage({
      type: 'handshake',
      data: {
        clientName: 'Playwright Automation App',
        version: '1.0.0',
        capabilities: ['browser', 'api', 'test-execution']
      }
    });
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'ping' });
      }
    }, 30000); // 30 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectInterval) return;

    const currentState = this.getCurrentState();
    if (currentState.connectionAttempts >= this.maxReconnectAttempts) {
      this.updateState({ 
        status: 'error',
        lastError: 'Max reconnection attempts reached. Please check MCP server.'
      });
      return;
    }
    
    this.updateState({ isReconnecting: true });
    
    this.reconnectInterval = setTimeout(() => {
      this.state.update(state => ({
        ...state,
        connectionAttempts: state.connectionAttempts + 1
      }));
      
      console.log(`🔄 Attempting to reconnect to MCP server (attempt ${this.getConnectionAttempts() + 1})`);
      this.connect();
      this.reconnectInterval = null;
    }, this.reconnectDelay);
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    console.warn('⚠️ Cannot send message: MCP not connected');
    return false;
  }

  handleMessage(message) {
    switch (message.type) {
      case 'handshake_response':
        console.log('🤝 MCP Handshake successful:', message.data);
        this.updateState({ serverInfo: message.data });
        break;
        
      case 'pong':
        // Heartbeat response - connection is alive
        break;
        
      case 'test_result':
        this.handleTestResult(message.data);
        break;
        
      case 'browser_event':
        this.handleBrowserEvent(message.data);
        break;

      case 'error':
        console.error('🚨 MCP Server Error:', message.message);
        this.updateState({ lastError: message.message });
        break;
        
      default:
        console.log('📨 Unhandled MCP message:', message);
    }
  }

  handleTestResult(result) {
    // Dispatch test result to other parts of the app
    window.dispatchEvent(new CustomEvent('mcp-test-result', { 
      detail: result 
    }));
  }

  handleBrowserEvent(event) {
    // Handle browser automation events
    window.dispatchEvent(new CustomEvent('mcp-browser-event', { 
      detail: event 
    }));
  }

  async runTest(testCode, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('MCP server not connected. Please start the MCP server first.'));
        return;
      }

      const requestId = Date.now().toString();
      
      // Set up response handler
      const handleResponse = (event) => {
        const result = event.detail;
        if (result.requestId === requestId) {
          window.removeEventListener('mcp-test-result', handleResponse);
          resolve(result);
        }
      };
      
      window.addEventListener('mcp-test-result', handleResponse);
      
      // Send test execution request
      const success = this.sendMessage({
        type: 'run_test',
        requestId,
        data: {
          testCode,
          options: {
            headless: options.headless ?? true,
            browser: options.browser ?? 'chromium',
            timeout: options.timeout ?? 30000,
            ...options
          }
        }
      });

      if (!success) {
        window.removeEventListener('mcp-test-result', handleResponse);
        reject(new Error('Failed to send test execution request'));
        return;
      }
      
      // Set timeout for the request
      setTimeout(() => {
        window.removeEventListener('mcp-test-result', handleResponse);
        reject(new Error('Test execution timeout - no response from MCP server'));
      }, (options.timeout ?? 30000) + 10000); // Add 10s buffer
    });
  }

  async takeScreenshot() {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('MCP server not connected'));
        return;
      }

      const requestId = Date.now().toString();
      
      const handleResponse = (event) => {
        const result = event.detail;
        if (result.requestId === requestId) {
          window.removeEventListener('mcp-browser-event', handleResponse);
          resolve(result.screenshot);
        }
      };
      
      window.addEventListener('mcp-browser-event', handleResponse);
      
      this.sendMessage({
        type: 'browser_action',
        action: 'screenshot',
        requestId
      });
      
      setTimeout(() => {
        window.removeEventListener('mcp-browser-event', handleResponse);
        reject(new Error('Screenshot timeout'));
      }, 10000);
    });
  }

  getConnectionAttempts() {
    return this.getCurrentState().connectionAttempts;
  }

  updateState(updates) {
    this.state.update(state => ({
      ...state,
      ...updates
    }));
  }

  // Get current state synchronously
  getCurrentState() {
    let currentState;
    this.state.subscribe(state => {
      currentState = state;
    })();
    return currentState;
  }
}

export const mcpStore = new MCPStore();
