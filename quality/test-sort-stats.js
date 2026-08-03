#!/usr/bin/env node
/**
 * test-sort-stats.js — 排序实验输入集 + 成本统计测试（I2-D 验收）
 *
 * 对照计划书工作流 F 验收标准：
 *   - 每种排序支持多输入集（已排序/逆序/几乎有序/重复/全相等/随机）
 *   - 统计比较次数 / 交换次数 / 写入次数
 *   - 相同值带身份编号（稳定性轨迹）
 *
 * 运行：node quality/test-sort-stats.js   退出码 0=通过
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
['modules.js', 'algorithms.js', 'code-library.js', 'operations.js',
  'quality/validators/validateBST.js', 'quality/validators/validateAVL.js',
  'quality/validators/validateCircularQueue.js', 'quality/validators/validateLinkedList.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
});
const W = sandbox.window;
const mod = (id) => W.ALGORA_MODULES.find((m) => m.id === id);

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? '  → ' + detail : ''}`); }
}

console.log('—— 输入集生成 ——');
{
  const IN = W.SORT_INPUTS;
  check('输入集齐全（6 种）', ['sorted', 'reversed', 'nearly', 'duplicates', 'equal', 'random'].every((k) => typeof IN[k] === 'function'));
  check('已排序输入升序', (() => { const a = IN.sorted(); return a.every((v, i) => i === 0 || a[i - 1] <= v); })());
  check('逆序输入降序', (() => { const a = IN.reversed(); return a.every((v, i) => i === 0 || a[i - 1] >= v); })());
  check('重复值输入含重复', (() => { const a = IN.duplicates(); return new Set(a).size < a.length; })());
  check('全相等输入', IN.equal().every((v) => v === IN.equal()[0]));
  check('随机输入 8 个元素', IN.random().length === 8);
}

console.log('—— 成本统计 ——');
{
  const bubble = W.buildTrace(mod('bubble-sort'), '71,56,42,33,27,18,12,5');
  const lastCost = bubble.frames[bubble.frames.length - 1]._meta.cost;
  check('冒泡排序：逆序输入比较次数 = n(n-1)/2 = 28', lastCost.comparisons === 28, `实际 ${lastCost.comparisons}`);
  check('冒泡排序：逆序输入交换次数 = 28', lastCost.swaps === 28, `实际 ${lastCost.swaps}`);
  check('每帧均带 cost 统计', bubble.frames.every((f) => f._meta && f._meta.cost));

  const sortedBubble = W.buildTrace(mod('bubble-sort'), '5,12,18,27,33,42,56,71');
  const sc = sortedBubble.frames[sortedBubble.frames.length - 1]._meta.cost;
  check('冒泡排序：已排序输入比较 28 次、交换 0 次', sc.comparisons === 28 && sc.swaps === 0, `比较${sc.comparisons} 交换${sc.swaps}`);

  const quick = W.buildTrace(mod('quick-sort'), '71,56,42,33,27,18,12,5');
  check('快排含比较与交换统计', quick.frames.some((f) => f._meta.cost.comparisons > 0) && quick.frames.some((f) => f._meta.cost.swaps > 0));
}

console.log('—— 稳定性身份编号 ——');
{
  const bubble = W.buildTrace(mod('bubble-sort'), '18,5,18,27,5');
  const frame = bubble.frames[0];
  check('重复值输入带身份编号（5₁ 5₂ 18₁ 18₂）', JSON.stringify(frame.visual.stability) === JSON.stringify([0, 0, 1, 0, 1]),
    `stability=${JSON.stringify(frame.visual.stability)}`);
  check('稳定性轨迹字段随帧传递', bubble.frames.every((f) => f.visual.stability !== undefined));

  // 稳定排序（冒泡）应保持重复值相对顺序 —— 校验最终数组
  const finalVals = bubble.frames[bubble.frames.length - 1].visual.values;
  check('稳定排序后数组有序', finalVals.every((v, i) => i === 0 || finalVals[i - 1] <= v), `实际 ${finalVals.join(',')}`);
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
