#!/usr/bin/env node
/**
 * test-bst-delete.js — BST 三类删除 + 前驱/后继替换测试（I3-A 验收）
 *
 * 对照计划书工作流 D 验收标准：
 *   - BST 查找、插入、三类删除、前驱/后继替换
 *   - 左小右大、中序有序不变量（validateBST 结构断言）
 *
 * 运行：node quality/test-bst-delete.js   退出码 0=通过
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
sandbox.window.AlgoraValidators = { validateBST: require('./validators/validateBST.js').validateBST };
const W = sandbox.window;

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? '  → ' + detail : ''}`); }
}

console.log('—— BST 专属操作 ——');
const t = W.buildTrace(W.ALGORA_MODULES.find((m) => m.id === 'bst'), '');
const frames = t.frames;

check('帧数充足（真实多步操作）', frames.length > 20, `实际 ${frames.length}`);
check('含插入操作', frames.some((f) => f._meta && f._meta.mutation && f._meta.mutation.type === 'insert'));
check('含查找操作（search phase）', frames.some((f) => f._meta && f._meta.phase === 'search'));

const deletes = frames.filter((f) => f._meta && f._meta.mutation && f._meta.mutation.type === 'delete');
check('含三类删除（≥3 次 delete mutation）', deletes.length >= 3, `实际 ${deletes.length}`);
check('删除演示含「后继替换」（双孩子）', frames.some((f) => /后继/.test(f.message)));
check('删除演示含「叶结点」（叶删除）', frames.some((f) => /叶结点/.test(f.message)));
check('删除演示含「顶替」（单孩子）', frames.some((f) => /顶替/.test(f.message)));

const verifies = frames.filter((f) => f._meta && f._meta.invariantResult);
check('每次删除后结构验证（≥3 个验证帧）', verifies.length >= 3, `实际 ${verifies.length}`);
check('全部结构验证通过（中序有序）', verifies.every((v) => v._meta.invariantResult.ok === true),
  verifies.map((v) => JSON.stringify(v._meta.invariantResult.violations)).join(' | '));

const last = frames[frames.length - 1].visual.nodes;
const keys = last.map((n) => n.key).sort((a, b) => a - b);
check('删除后剩余结点有序（中序）', JSON.stringify(keys) === JSON.stringify([...keys].sort((a, b) => a - b)));
check('双孩子删除后目标保留（40 被后继 50 覆盖）', last.some((n) => n.id === '40' && n.key === 50),
  last.map((n) => `${n.id}=${n.key}`).join(','));
check('被删除结点已移除（无 10/20/50）', !last.some((n) => n.id === '10' || n.id === '20' || n.id === '50'),
  last.map((n) => n.id).join(','));

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
