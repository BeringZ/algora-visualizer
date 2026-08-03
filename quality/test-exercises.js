#!/usr/bin/env node
/**
 * test-exercises.js — 练习系统四类题数据合同测试（I5-B 验收）
 *
 * 对照计划书工作流 G：
 *   - 四类题齐全（预测 predict / 状态 state / 找错 debug / 构造 construct）
 *   - 每题选项 ≥ 3、answer 合法、反馈存在
 *   - 答案位置分布均衡（无猜题规律，最大占比 ≤ 45%）
 *   - 题目按模块 tag 可匹配（sort/tree/queue/graph/linked）
 *
 * 运行：node quality/test-exercises.js   退出码 0=通过
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'quality/exercises.js'), 'utf8'), sandbox, { filename: 'exercises.js' });
const EX = sandbox.window.ALGORA_EXERCISES || sandbox.ALGORA_EXERCISES;

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? '  → ' + detail : ''}`); }
}

console.log('—— 四类题结构 ——');
const types = ['predict', 'state', 'debug', 'construct'];
check('四类题齐全且每类 ≥ 3 题', types.every((t) => EX[t] && EX[t].length >= 3),
  types.map((t) => `${t}=${EX[t] ? EX[t].length : 0}`).join(' '));

const all = Object.values(EX).flat();
check('每题选项 ≥ 3', all.every((q) => q.options.length >= 3));
check('每题 answer 合法', all.every((q) => Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length));
check('每题含即时反馈', all.every((q) => typeof q.feedback === 'string' && q.feedback.length > 0));
check('每题含唯一 id', new Set(all.map((q) => q.id)).size === all.length);

console.log('—— 答案分布（无猜题规律）——');
const ansByType = {};
types.forEach((t) => { ansByType[t] = EX[t].map((q) => q.answer); });
const allAns = all.map((q) => q.answer);
const countByPos = [0, 0, 0, 0];
allAns.forEach((a) => { countByPos[a]++; });
const maxPct = Math.max(...countByPos) / allAns.length;
check(`总体答案位置分布均衡（最大 ${(maxPct * 100).toFixed(0)}% ≤ 45%）`, maxPct <= 0.45, `分布 ${countByPos.join('/')}`);

console.log('—— 模块 tag 匹配 ——');
const tags = all.map((q) => q.tag).filter(Boolean);
check('含 sort/tree/queue/graph/linked 等模块标签', ['sort', 'tree', 'queue', 'graph', 'linked'].some((t) => tags.includes(t)), tags.join(','));

console.log('—— 全模块覆盖（I7-C：category 归一化）——');
vm.runInContext(fs.readFileSync(path.join(root, 'modules.js'), 'utf8'), sandbox, { filename: 'modules.js' });
const MODS = sandbox.window.ALGORA_MODULES || sandbox.ALGORA_MODULES;
const CATEGORY_TAG = { list: 'linked', 'stack-queue': 'queue', array: 'array', string: 'string', search: 'search', sort: 'sort', tree: 'tree', graph: 'graph' };
const tagSet = new Set(tags);
const uncovered = MODS.filter((m) => {
  const catTag = m.category ? CATEGORY_TAG[m.category] : null;
  return !(tagSet.has(m.demo) || (catTag && tagSet.has(catTag)));
}).map((m) => m.id);
const covered = MODS.length - uncovered.length;
check(`模块全覆盖（${covered}/${MODS.length} ≥ 95%）`, covered / MODS.length >= 0.95, uncovered.join(', '));

console.log('—— 题型语义抽查 ——');
check('predict 题可预测输出', EX.predict.some((q) => /数组|结果是|结束后/.test(q.question)));
check('debug 题含错误代码场景', EX.debug.some((q) => /代码|panic|错误/.test(q.question)));
check('construct 题含「选择/构造输入」语义', EX.construct.some((q) => /插入序列|输入|选择/.test(q.question)));

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
