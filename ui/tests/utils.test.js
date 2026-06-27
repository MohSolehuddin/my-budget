// ===== TEST: utils.js =====
// Tests: formatIDR, formatDate, h, pctColor, emptyState, loadingState, badge

const tests = [];

tests.push({
  name: 'formatIDR — positive number',
  run: () => {
    const result = formatIDR(1500000);
    if (!result.includes('1.500.000')) throw new Error('Expected "1.500.000" in output, got: ' + result);
  },
});

tests.push({
  name: 'formatIDR — null returns Rp 0',
  run: () => {
    const result = formatIDR(null);
    if (!result.includes('0')) throw new Error('Expected "0" in output, got: ' + result);
  },
});

tests.push({
  name: 'formatIDR — undefined returns Rp 0',
  run: () => {
    const result = formatIDR(undefined);
    if (!result.includes('0')) throw new Error('Expected "0" in output, got: ' + result);
  },
});

tests.push({
  name: 'formatIDR — negative number',
  run: () => {
    const result = formatIDR(-50000);
    if (!result.includes('50.000')) throw new Error('Expected "50.000" in output, got: ' + result);
  },
});

tests.push({
  name: 'formatDate — null returns "-"',
  run: () => {
    if (formatDate(null) !== '-') throw new Error('Expected "-"');
  },
});

tests.push({
  name: 'formatDate — undefined returns "-"',
  run: () => {
    if (formatDate(undefined) !== '-') throw new Error('Expected "-"');
  },
});

tests.push({
  name: 'formatDate — PB format with space separator',
  run: () => {
    const result = formatDate('2026-06-27 00:00:00.000Z');
    if (!result.includes('2026')) throw new Error('Expected year 2026, got: ' + result);
  },
});

tests.push({
  name: 'formatDate — ISO date string',
  run: () => {
    const result = formatDate('2026-01-15T10:30:00Z');
    if (!result.includes('2026')) throw new Error('Expected year 2026, got: ' + result);
  },
});

tests.push({
  name: 'h — escapes HTML special characters',
  run: () => {
    const result = h('<script>alert("x")</script>');
    if (result.includes('<script>')) throw new Error('Expected escaped, got: ' + result);
    if (!result.includes('&lt;')) throw new Error('Expected &lt; in output');
  },
});

tests.push({
  name: 'h — null returns empty string',
  run: () => {
    if (h(null) !== '') throw new Error('Expected ""');
  },
});

tests.push({
  name: 'h — undefined returns empty string',
  run: () => {
    if (h(undefined) !== '') throw new Error('Expected ""');
  },
});

tests.push({
  name: 'pctColor — 0 returns green',
  run: () => {
    if (pctColor(0) !== 'green') throw new Error('Expected green');
  },
});

tests.push({
  name: 'pctColor — 70 returns green',
  run: () => {
    if (pctColor(70) !== 'green') throw new Error('Expected green');
  },
});

tests.push({
  name: 'pctColor — 71 returns yellow',
  run: () => {
    if (pctColor(71) !== 'yellow') throw new Error('Expected yellow');
  },
});

tests.push({
  name: 'pctColor — 90 returns yellow',
  run: () => {
    if (pctColor(90) !== 'yellow') throw new Error('Expected yellow');
  },
});

tests.push({
  name: 'pctColor — 91 returns red',
  run: () => {
    if (pctColor(91) !== 'red') throw new Error('Expected red');
  },
});

tests.push({
  name: 'pctColor — 100 returns red',
  run: () => {
    if (pctColor(100) !== 'red') throw new Error('Expected red');
  },
});

tests.push({
  name: 'badge — returns HTML span with correct type',
  run: () => {
    const result = badge('Active', 'green');
    if (!result.includes('badge-green')) throw new Error('Expected badge-green class');
    if (!result.includes('Active')) throw new Error('Expected "Active" text');
  },
});

tests.push({
  name: 'emptyState — returns HTML with icon, title, desc',
  run: () => {
    const result = emptyState('<svg></svg>', 'No Data', 'Add something');
    if (!result.includes('empty-state')) throw new Error('Expected empty-state class');
    if (!result.includes('No Data')) throw new Error('Expected title');
    if (!result.includes('Add something')) throw new Error('Expected description');
  },
});

tests.push({
  name: 'loadingState — returns spinner HTML',
  run: () => {
    const result = loadingState();
    if (!result.includes('spinner')) throw new Error('Expected spinner class');
    if (!result.includes('Loading')) throw new Error('Expected "Loading" text');
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
  console.log(`\nUtils tests: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { tests, runTests };
}