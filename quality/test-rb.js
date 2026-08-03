#!/usr/bin/env node
/**
 * test-rb.js — 红黑树插入修复专属 trace 测试（I4-A 验收）
 *
 * 对照计划书工作流 D P0 验收标准：
 *   - 红黑树插入专属修复流程：变色（叔红）/ 旋转（叔黑），旋转覆盖 LL/RR/LR/RL
 *   - 不变量验证：根黑 · 红结点子黑 · 黑高一致 · 中序有序（validateRedBlack）
 *   - 可构造输入触发不同修复分支
 *
 * 运行：node quality/test-rb.js   退出码 0=通过
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
['modules.js', 'algorithms.js', 'code-library.js', 'operations.js',
  'quality/validators/validateBST.js', 'quality/validators/validateRedBlack.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
});
sandbox.window.AlgoraValidators = { validateRedBlack: require('./validators/validateRedBlack.js').validateRedBlack };
const W = sandbox.window;
const mod = W.ALGORA_MODULES.find((m) => m.id === 'red-black-tree');

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? '  → ' + detail : ''}`); }
}

console.log('—— 红黑树插入修复 ——');
const t = W.buildTrace(mod, '');
const frames = t.frames;

check('真实多步操作（帧数 > 10）', frames.length > 10, `实际 ${frames.length}`);
check('触发 case 1（叔红变色）', frames.some((f) => /case 1/.test(f.message)));
check('触发 case 2/3（叔黑旋转）', frames.some((f) => /case [23]/.test(f.message)));
check('修复使用 recolor mutation', frames.some((f) => f._meta && f._meta.mutation && f._meta.mutation.type === 'recolor'));
check('修复使用旋转 mutation', frames.some((f) => f._meta && f._meta.mutation && /rotate/.test(f._meta.mutation.type)));
check('含验证帧且全部通过', frames.filter((f) => f._meta && f._meta.invariantResult).every((f) => f._meta.invariantResult.ok === true));
const finalRoot = (() => {
  const last = frames[frames.length - 1].visual.nodes;
  const root = last.find((n) => !last.some((o) => o.left === n.id || o.right === n.id));
  return root;
})();
check('最终根结点为黑色', finalRoot && finalRoot.color === 'black', finalRoot ? finalRoot.color : '无根');
check('验证帧时根结点为黑', frames.filter((f) => f._meta && f._meta.invariantResult && f._meta.invariantResult.ok).every((f) => {
  const nodes = f.visual.nodes;
  const root = nodes.find((n) => !nodes.some((o) => o.left === n.id || o.right === n.id));
  return !root || root.color === 'black';
}));

// 多输入序列（含旋转镜像、连续修复）
const cases = [
  '10,20,30', '30,20,10', '20,10,30,15,25,5', '30,20,10,40,50,60,70,15',
  '7,3,18,10,22,8,11,26,2,6,13'
];
let multiOk = true;
const details = [];
for (const inp of cases) {
  const tt = W.buildTrace(mod, inp);
  const ok = tt.frames.filter((f) => f._meta && f._meta.invariantResult).every((f) => f._meta.invariantResult.ok === true);
  if (!ok) { multiOk = false; details.push(inp); }
}
check(`多输入序列（${cases.length} 组）验证全部通过`, multiOk, details.join(','));

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
