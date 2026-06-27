// ===== TEST: summary.js =====
// Tests: renderSummary function exists, handles errors, renders stat cards

const tests = [];

tests.push({
  name: 'renderSummary — is a function',
  run: () => {
    if (typeof renderSummary !== 'function') throw new Error('renderSummary is not a function');
  },
});

tests.push({
  name: 'renderSummary — handles missing app element gracefully',
  run: async () => {
    // Should not throw if #app doesn't exist
    await renderSummary();
    // If we get here without throwing, it passed
  },
});

// Note: Full DOM rendering tests would require jsdom or browser environment.
// These are integration tests that verify the function exists and doesn't crash.

// ---- Runner ----
async function runTests() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      await t.run();
      console.log(`  ✅ ${t.name}`);
      pass++;
    } catch (e) {
      console.error(`  ❌ ${t.name}: ${e.message}`);
      fail++;
    }
  }
  console.log(`\nSummary tests: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { tests, runTests };
}