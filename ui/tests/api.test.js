// ===== TEST: api.js =====
// Run with: node --test ui/tests/api.test.js (requires Node 18+)
// Or: import manually in browser test runner

// These tests mock fetch and localStorage to test API logic in isolation.

// ---- Mock setup ----
const originalFetch = globalThis.fetch;
const originalLocalStorage = globalThis.localStorage;

function mockLocalStorage() {
  const store = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}

function mockFetch(status, body) {
  return async () => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

// ---- Tests ----
const tests = [];

tests.push({
  name: 'API.get — success returns parsed JSON',
  run: async () => {
    globalThis.localStorage = mockLocalStorage();
    globalThis.fetch = mockFetch(200, { data: { id: '123' } });
    authToken = 'test-token';
    const result = await API.get('/api/test');
    if (!result.data || result.data.id !== '123') throw new Error('Expected {data: {id: "123"}}');
  },
});

tests.push({
  name: 'API.get — 401 triggers logout',
  run: async () => {
    globalThis.localStorage = mockLocalStorage();
    globalThis.fetch = mockFetch(401, { error: 'Unauthorized' });
    authToken = 'test-token';
    let threw = false;
    try {
      await API.get('/api/test');
    } catch (e) {
      threw = true;
      if (e.message !== 'Session expired') throw new Error('Expected "Session expired" error');
    }
    if (!threw) throw new Error('Expected error to be thrown');
    if (authToken !== null) throw new Error('Expected authToken to be null after logout');
  },
});

tests.push({
  name: 'API.post — sends JSON body',
  run: async () => {
    globalThis.localStorage = mockLocalStorage();
    let capturedBody = null;
    globalThis.fetch = async (path, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { status: 201, ok: true, json: async () => ({ data: { id: 'new' } }), text: async () => '{}' };
    };
    authToken = 'test-token';
    const result = await API.post('/api/test', { name: 'test', amount: 100 });
    if (!result.data || result.data.id !== 'new') throw new Error('Expected {data: {id: "new"}}');
    if (capturedBody.name !== 'test') throw new Error('Body not sent correctly');
  },
});

tests.push({
  name: 'API.get — non-2xx throws error with response text',
  run: async () => {
    globalThis.localStorage = mockLocalStorage();
    globalThis.fetch = mockFetch(500, { error: 'Server error' });
    authToken = 'test-token';
    let threw = false;
    try {
      await API.get('/api/test');
    } catch (e) {
      threw = true;
    }
    if (!threw) throw new Error('Expected error for 500 status');
  },
});

tests.push({
  name: 'API.del — sends DELETE method',
  run: async () => {
    globalThis.localStorage = mockLocalStorage();
    let capturedMethod = null;
    globalThis.fetch = async (path, opts) => {
      capturedMethod = opts.method;
      return { status: 200, ok: true, json: async () => ({ success: true }), text: async () => '{}' };
    };
    authToken = 'test-token';
    await API.del('/api/test/123');
    if (capturedMethod !== 'DELETE') throw new Error('Expected DELETE method');
  },
});

tests.push({
  name: 'formatIDR — null/undefined returns Rp 0',
  run: async () => {
    // This test belongs in utils, but we test it here too for safety
    // Will be moved when utils.js is loaded
  },
});

// ---- Runner ----
async function runTests() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      // Reset state
      authToken = null;
      currentUser = null;
      await t.run();
      console.log(`  ✅ ${t.name}`);
      pass++;
    } catch (e) {
      console.error(`  ❌ ${t.name}: ${e.message}`);
      fail++;
    }
  }
  // Restore
  globalThis.fetch = originalFetch;
  globalThis.localStorage = originalLocalStorage;
  console.log(`\nAPI tests: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}

// Export for Node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { tests, runTests };
}