#!/usr/bin/env node
/**
 * test-linked-error.js — 链表「错误顺序」演示集成测试（I1-D 验收）
 *
 * 验证（对照计划书工作流 B）：
 *   1. 链表模块的插入 trace 包含错误顺序演示帧（errorOrder）
 *   2. 演示帧包含自环可视化标记（selfLoop）
 *   3. 演示末帧结构验证失败（validateLinkedList 捕获自环）且页面可诊断
 *   4. 正确顺序帧仍全部通过（不破坏原演示）
 *
 * 运行：node quality/test-linked-error.js   退出码 0=通过
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
['modules.js', 'algorithms.js', 'code-library.js',
  'quality/validators/validateBST.js', 'quality/validators/validateAVL.js',
  'quality/validators/validateCircularQueue.js', 'quality/validators/validateLinkedList.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
});
sandbox.window.AlgoraValidators = {
  validateBST: require('./validators/validateBST.js').validateBST,
  validateAVL: require('./validators/validateAVL.js').validateAVL,
  validateCircularQueue: require('./validators/validateCircularQueue.js').validateCircularQueue,
  validateLinkedList: require('./validators/validateLinkedList.js').validateLinkedList,
};
const W = sandbox.window;

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? '  → ' + detail : ''}`); }
}

const mod = W.ALGORA_MODULES.find((m) => m.id === 'singly-list-no-head');
const trace = W.buildTrace(mod, '18,27,35,46');

const errFrames = trace.frames.filter((f) => f._meta && f.visual && f.visual.errorOrder);
check('插入 trace 含错误顺序演示帧（≥3 帧）', errFrames.length >= 3, `实际 ${errFrames.length}`);

const selfLoop = errFrames.filter((f) => f.visual.selfLoop !== undefined);
check('演示帧含自环可视化标记（selfLoop）', selfLoop.length >= 2, `实际 ${selfLoop.length}`);

const verifyFrame = errFrames.find((f) => f._meta.phase === 'verify' && f._meta.invariantResult);
check('演示末帧结构验证失败（捕获自环）', verifyFrame && verifyFrame._meta.invariantResult.ok === false,
  verifyFrame ? JSON.stringify(verifyFrame._meta.invariantResult.violations.map((v) => v.type)) : '无 verify 帧');

check('验证失败原因包含环诊断', verifyFrame && verifyFrame._meta.invariantResult.violations.some((v) => v.type === 'cycle'),
  verifyFrame ? JSON.stringify(verifyFrame._meta.invariantResult.violations) : '');

// 正确顺序帧不受影响
const okFrames = trace.frames.filter((f) => !(f.visual && f.visual.errorOrder));
check('正确顺序帧完整保留（≥6 帧）', okFrames.length >= 6, `实际 ${okFrames.length}`);

// 所有链表模块共用演示（带头/双链/循环也应包含）
const linkedDemos = ['linked', 'linked-head', 'doubly', 'doubly-head', 'circular-singly', 'circular-doubly'];
const linkedMods = W.ALGORA_MODULES.filter((m) => linkedDemos.includes(m.demo));
const missing = linkedMods.filter((m) => {
  const t = W.buildTrace(m, '18,27,35,46');
  return !t.frames.some((f) => f._meta && f.visual && f.visual.errorOrder);
});
check(`全部 ${linkedMods.length} 个链表模块均含错误顺序演示`, missing.length === 0, `缺失: ${missing.map((m) => m.id).join(',')}`);

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
