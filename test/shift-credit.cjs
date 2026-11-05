const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../lib/shift.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { buildReport } = compiled.exports;
function loadTypeScript(name) {
  const file = path.resolve(__dirname, `../lib/${name}.ts`);
  const loaded = new Module(file, module);
  loaded.require = id => id === './assist' ? loadTypeScript('assist') : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
  return loaded.exports;
}
const { cashierPerformance, reconcileDay } = loadTypeScript('supervisor');

test('credit and repayments separate sales value, debt and money in the drawer', () => {
  const common = { createdAt: '2026-11-05T10:00:00Z', cashierId: 'cashier', shiftId: 'shift', change: 0, discount: 0, lines: [] };
  const sale = { ...common, id: 'sale', total: 20000, payments: [{ method: 'Cash', amount: 8000 }, { method: 'Credit', amount: 12000 }] };
  const repayment = { ...common, id: 'repay', kind: 'repayment', total: 5000, payments: [{ method: 'Cash', amount: 5000 }] };
  const other = { ...common, id: 'other', total: 1000, payments: [{ method: 'Other', amount: 1000 }] };
  const report = buildReport({ id: 'shift', openingFloat: 1000 }, [sale, repayment, other]);
  assert.equal(report.saleCount, 2); assert.equal(report.grossSales, 21000);
  assert.equal(report.cashSales, 13000); assert.equal(report.expectedCash, 14000);
  assert.equal(report.byMethod.find(row => row.method === 'Credit').amount, 12000);
  assert.equal(report.byMethod.find(row => row.method === 'Other').amount, 1000);
  const shift = { id: 'shift', cashierId: 'cashier', openedAt: common.createdAt, openingFloat: 1000 };
  const performance = cashierPerformance([sale, repayment, other], [shift], [], '2026-11-05')[0];
  assert.equal(performance.gross, 21000); assert.equal(performance.cashTaken, 13000); assert.equal(performance.transactions, 2);
  const day = reconcileDay([sale, repayment, other], [shift], '2026-11-05', 0);
  assert.equal(day.gross, 21000); assert.equal(day.totalExpected, 14000);
});
