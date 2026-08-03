#!/usr/bin/env node
/**
 * test-quick-pivot.js — 快排枢轴策略测试（I3-B 验收）
 *
 * 对照计划书工作流 F 专项要求：
 *   - 快排支持首元素 / 随机 / 三数取中（+末尾）枢轴策略
 *   - 逆序输入下三数取中应显著优于首元素策略（比较/交换次数）
 *   - 所有策略结果有序
 *
 * 运行：node quality/test-quick-pivot.js   退出码 0=通过
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
['modules.js', 'algorithms.js', 'code-library.js', 'operations.js',
  'quality/validators/validateBST.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
});
const W = sandbox.window;
const mod = W.ALGORA_MODULES.find((m) => m.id === 'quick-sort');
const INPUT = '71,56,42,33,27,18,12,5'; // 逆序（快排最坏场景）

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? '  → ' + detail : ''}`); }
}

console.log('—— 枢轴策略 ——');
const stats = {};
for (const mode of ['last', 'first', 'median']) {
  sandbox.window.AlgoraSortPivot = mode;
  const t = W.buildTrace(mod, INPUT);
  const c = t.frames[t.frames.length - 1]._meta.cost;
  stats[mode] = c;
  const last = t.frames[t.frames.length - 1].visual.values;
  check(`${mode} 策略：结果有序`, last.every((v, i) => i === 0 || last[i - 1] <= v), last.join(','));
}
check('首元素策略（逆序最坏）交换次数 ≥ 三数取中',
  stats.first.swaps >= stats.median.swaps, `first=${stats.first.swaps} median=${stats.median.swaps}`);
check('三数取中比较次数 ≤ 首元素', stats.median.comparisons <= stats.first.comparisons,
  `median=${stats.median.comparisons} first=${stats.first.comparisons}`);
check('三数取中交换次数 ≤ 末尾策略', stats.median.swaps <= stats.last.swaps,
  `median=${stats.median.swaps} last=${stats.last.swaps}`);

// 帧含策略名说明
sandbox.window.AlgoraSortPivot = 'median';
const t = W.buildTrace(mod, INPUT);
check('帧包含「三数取中」策略说明', t.frames.some((f) => /三数取中/.test(f.message)));

// random 策略不崩且有序
sandbox.window.AlgoraSortPivot = 'random';
const rt = W.buildTrace(mod, INPUT);
const rv = rt.frames[rt.frames.length - 1].visual.values;
check('随机策略：运行不崩且结果有序', rv.every((v, i) => i === 0 || rv[i - 1] <= v));

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
