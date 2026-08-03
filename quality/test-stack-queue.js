#!/usr/bin/env node
/**
 * test-stack-queue.js — 链栈/链队列结点指针视图 + 队列空满方案测试（I2-A/B 验收）
 *
 * 验证（对照计划书工作流 B）：
 *   1. 链栈「算法演示」使用 type:'linked' 结点视图 + top 指针标签
 *   2. 链队列使用 type:'linked' 结点视图 + front/rear 指针标签
 *   3. 链栈/链队列的操作（push/enqueue/pop/dequeue）同样用结点视图
 *   4. 数组栈/队列保持数组视图（不回归）
 *   5. 循环队列包含牺牲单元/计数两种空满方案说明 + 假溢出对比
 *   6. validateCircularQueue 两种模式均已验证（sacrifice/count）
 *
 * 运行：node quality/test-stack-queue.js   退出码 0=通过
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
// 显式注入验证器（vm 沙箱无 global，UMD 的 global.AlgoraValidators 挂载不到 window）
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

const mod = (id) => W.ALGORA_MODULES.find((m) => m.id === id);

// —— I2-A：链栈结点视图 ——
console.log('—— 链栈/链队列结点指针视图 ——');
{
  const t = W.buildTrace(mod('linked-stack-head'), '14,27,39');
  const frames = t.frames;
  check('链栈算法演示使用 linked 结点视图', frames.every((f) => f.visual.type === 'linked'),
    `类型: ${frames.map((f) => f.visual.type).join(',')}`);
  check('链栈帧带 top 指针标签', frames.every((f) => f.visual.topIndex !== undefined));
  check('链栈 top 指向栈顶（最后一个元素）', frames[0].visual.topIndex === 2 && frames[0].visual.values[2] === 39);

  const tq = W.buildTrace(mod('linked-queue-head'), '11,23,34');
  check('链队列算法演示使用 linked 结点视图', tq.frames.every((f) => f.visual.type === 'linked'));
  check('链队列帧带 front/rear 指针标签',
    tq.frames.every((f) => f.visual.frontIndex === 0 && f.visual.rearIndex === f.visual.values.length - 1),
    `front/rear: ${tq.frames.map((f) => f.visual.frontIndex + ',' + f.visual.rearIndex).join(' | ')}`);

  // 操作层（push/enqueue）也用结点视图
  const pushT = W.buildTrace(mod('linked-stack-no-head'), '14,27,39', 'push');
  check('链栈 push 操作使用 linked 视图', pushT.frames.every((f) => f.visual.type === 'linked'),
    pushT.frames.map((f) => f.visual.type).join(','));
  const enqT = W.buildTrace(mod('linked-queue-no-head'), '11,23,34', 'enqueue');
  check('链队列 enqueue 操作使用 linked 视图', enqT.frames.every((f) => f.visual.type === 'linked'));

  // 数组视图不回归
  const arrStack = W.buildTrace(mod('array-stack'), '14,27,39');
  check('数组栈保持数组视图（不回归）', arrStack.frames.every((f) => f.visual.type === 'stack'));
  const arrQueue = W.buildTrace(mod('array-queue'), '11,23,34');
  check('数组队列保持数组视图（不回归）', arrQueue.frames.every((f) => f.visual.type === 'queue'));
}

// —— I2-B：队列空满方案 + 假溢出 ——
console.log('—— 队列空满方案与假溢出 ——');
{
  const t = W.buildTrace(mod('circular-queue'), '11,23,34,48');
  const hasOverflow = t.frames.some((f) => f.visual && f.visual.falseOverflow);
  check('循环队列含假溢出对比演示帧', hasOverflow);
  const hasEmptyFull = t.frames.some((f) => f._meta && f._meta.invariantChecks && f._meta.invariantChecks.includes('queue-empty-full'));
  check('假溢出对比帧带 queue-empty-full 不变量检查', hasEmptyFull);

  const hasSacrifice = t.code.join('\n').includes('(rear+1)%cap == front');
  check('代码含牺牲单元空满方案说明', hasSacrifice);

  // validateCircularQueue 两种模式
  const V = W.AlgoraValidators.validateCircularQueue;
  const sacrificeOk = V({ capacity: 5, front: 0, rear: 0, mode: 'sacrifice', values: [null, null, null, null, null] }).ok === true;
  const sacrificeFull = V({ capacity: 5, front: 1, rear: 5, mode: 'sacrifice', values: [null, 1, 2, 3, 4] }).ok === false;
  const countOk = V({ capacity: 5, front: 2, rear: 4, size: 3, mode: 'count', values: [null, null, 7, 8, 9] }).ok === true;
  const countFull = V({ capacity: 5, front: 0, rear: 4, size: 5, mode: 'count', values: [1, 2, 3, 4, 5] }).ok === false;
  check('牺牲单元方案：空/满判定正确', sacrificeOk && sacrificeFull);
  check('计数方案：空/满判定正确', countOk && countFull);
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
