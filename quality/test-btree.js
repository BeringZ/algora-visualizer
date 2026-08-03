#!/usr/bin/env node
/**
 * test-btree.js — 2-3 树（B 树 m=3）插入分裂/删除借位合并测试（I4-B 验收）
 *
 * 对照计划书工作流 D P0 验收标准：
 *   - 插入：上溢分裂（中关键字上提），覆盖根分裂
 *   - 删除：下溢借位（兄弟可分）与合并（兄弟不可分）
 *   - 不变量：关键字有序 · 阶数合法 · 子树区间 · 叶同层（validateBTree）
 *
 * 运行：node quality/test-btree.js   退出码 0=通过
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
['modules.js', 'algorithms.js', 'code-library.js', 'operations.js',
  'quality/validators/validateBST.js', 'quality/validators/validateBTree.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
});
sandbox.window.AlgoraValidators = { validateBTree: require('./validators/validateBTree.js').validateBTree };
const W = sandbox.window;
const mod = W.ALGORA_MODULES.find((m) => m.id === 'b-tree');

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? '  → ' + detail : ''}`); }
}

console.log('—— 2-3 树插入分裂 ——');
const t = W.buildTrace(mod, '');
const frames = t.frames;
check('真实多步操作（帧数 > 15）', frames.length > 15, `实际 ${frames.length}`);
check('触发上溢分裂（≥2 次）', frames.filter((f) => /分裂/.test(f.message)).length >= 2,
  `实际 ${frames.filter((f) => /分裂/.test(f.message)).length}`);
check('触发根分裂（树增高）', frames.some((f) => /根结点分裂/.test(f.message)));
check('分裂使用 split mutation', frames.some((f) => f._meta && f._meta.mutation && f._meta.mutation.type === 'split'));

console.log('—— 2-3 树删除下溢修复 ——');
check('触发下溢合并', frames.some((f) => /下溢修复·合并/.test(f.message)));
check('触发下溢借位', frames.some((f) => /下溢修复·借位/.test(f.message)));
check('合并使用 merge mutation', frames.some((f) => f._meta && f._meta.mutation && f._meta.mutation.type === 'merge'));

console.log('—— 结构验证 ——');
const verifies = frames.filter((f) => f._meta && f._meta.invariantResult);
check('含验证帧且全部通过', verifies.length >= 4 && verifies.every((f) => f._meta.invariantResult.ok === true),
  verifies.filter((f) => !f._meta.invariantResult.ok).map((f) => JSON.stringify(f._meta.invariantResult.violations)).join('|'));
const lastLevels = frames[frames.length - 1].visual.levels;
check('默认演示最终树合法（[[40]],[[20],[50]]）', JSON.stringify(lastLevels) === '[[[40]],[[20],[50]]]',
  JSON.stringify(lastLevels));

console.log('—— 自定义输入（聚焦插入）——');
const cases = ['10,20,30', '10,20,30,40', '10,20,30,40,50,60,70,80,90', '5,15,25,35,45,55'];
let multiOk = true; const bad = [];
for (const inp of cases) {
  const tt = W.buildTrace(mod, inp);
  const ok = tt.frames.filter((f) => f._meta && f._meta.invariantResult).every((f) => f._meta.invariantResult.ok === true);
  if (!ok) { multiOk = false; bad.push(inp); }
}
check(`自定义输入（${cases.length} 组）验证全部通过`, multiOk, bad.join(','));

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
