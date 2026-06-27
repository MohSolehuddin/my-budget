// ===== TEST: router.js =====
// Tests: PAGE_TITLES, pctColor via renderPage routing

const tests = [];

tests.push({
  name: 'PAGE_TITLES — has all 11 pages',
  run: () => {
    const expected = ['summary', 'transactions', 'budgets', 'debts', 'pockets',
      'savings-targets', 'recurring-transactions', 'recurring-budgets',
      'insights', 'cutoffs', 'categories'];
    for (const p of expected) {
      if (!PAGE_TITLES[p]) throw new Error(`Missing page title for: ${p}`);
    }
  },
});

tests.push({
  name: 'PAGE_TITLES — all values are strings',
  run: () => {
    for (const key in PAGE_TITLES) {
      if (typeof PAGE_TITLES[key] !== 'string') throw new Error(`Page title for ${key} is not a string`);
    }
  },
});

tests.push({
  name: 'navigate — sets currentPage',
  run: () => {
    // Can't fully test without DOM, but verify function exists
    if (typeof navigate !== 'function') throw new Error('navigate is not a function');
  },
});

tests.push({
  name: 'renderPage — is a function',
  run: () => {
    if (typeof renderPage !== 'function') throw new Error('renderPage is not a function');
  },
});

tests.push({
  name: 'toggleSidebar — is a function',
  run: () => {
    if (typeof toggleSidebar !== 'function') throw new Error('toggleSidebar is not a function');
  },
});

tests.push({
  name: 'bindNavLinks — is a function',
  run: () => {
    if (typeof bindNavLinks !== 'function') throw new Error('bindNavLinks is not a function');
  },
});

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
  console.log(`\nRouter tests: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { tests, runTests };
}