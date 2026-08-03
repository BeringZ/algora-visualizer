#!/usr/bin/env node
/**
 * test-avl-trace.js — AVL 专属 trace 集成测试（I1-A 样板工程验收）
 *
 * 验证（对照计划书工作流 D 验收标准）：
 *   1. 四类旋转 LL/RR/LR/RL 均可通过输入构造触发
 *   2. 每个 trace 帧携带语义字段 _meta（phase/mutation/invariantChecks）
 *   3. 帧的 line 均落在 code-library AVL 代码的 @0-@9 锚点内（动画与代码不脱节）
 *   4. 帧末结构验证（validateAVL）全部通过
 *
 * 运行：node quality/test-avl-trace.js   退出码 0=通过
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
['modules.js', 'algorithms.js', 'code-library.js', 'quality/validators/validateBST.js', 'quality/validators/validateAVL.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
});

const W = sandbox.window;
const avlModule = W.ALGORA_MODULES.find((m) => m.id === 'avl');
if (!avlModule) { console.error('未找到 avl 模块'); process.exit(1); }

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? '  → ' + detail : ''}`); }
}

// 四种旋转触发用例
const cases = [
  { input: '30,20,10', rot: ['rotateRight'], label: 'LL（30,20,10 → 右旋）' },
  { input: '10,20,30', rot: ['rotateLeft'], label: 'RR（10,20,30 → 左旋）' },
  { input: '30,10,20', rot: ['rotateLeft', 'rotateRight'], label: 'LR（30,10,20 → 先左旋后右旋）' },
  { input: '10,30,20', rot: ['rotateRight', 'rotateLeft'], label: 'RL（10,30,20 → 先右旋后左旋）' },
];

console.log('—— 四旋转触发 ——');
for (const c of cases) {
  const trace = W.buildTrace(avlModule, c.input);
  const muts = trace.frames.map((f) => f._meta && f._meta.mutation && f._meta.mutation.type).filter(Boolean);
  check(`${c.label} 触发 ${c.rot.join('→')}`, c.rot.every((r) => muts.includes(r)),
    `实际 mutation: ${muts.join(',')}`);
  check(`${c.label} 帧末验证通过`, trace.frames[trace.frames.length - 1]._meta.invariantResult
    && trace.frames[trace.frames.length - 1]._meta.invariantResult.ok === true,
    `末帧 invariantResult: ${JSON.stringify(trace.frames[trace.frames.length - 1]._meta && trace.frames[trace.frames.length - 1]._meta.invariantResult)}`);
}

console.log('—— 帧语义完整性 ——');
const trace = W.buildTrace(avlModule, '30,20,10,25,40,5'); // 混合序列
check(`帧数 > 8（真实多步状态迁移，非 4 帧快照）`, trace.frames.length > 8, `实际 ${trace.frames.length} 帧`);
check(`每帧均有 _meta`, trace.frames.every((f) => f._meta), `缺 _meta 的帧: ${trace.frames.filter((f) => !f._meta).length}`);
check(`每帧 phase 合法`, trace.frames.every((f) => ['locate', 'mutate', 'repair', 'verify'].includes(f._meta.phase)));
check(`line 均在 @0-@9 锚点内`, trace.frames.every((f) => f.line >= 0 && f.line <= 9), `line 越界帧: ${trace.frames.filter((f) => f.line < 0 || f.line > 9).map((f) => f.line).join(',')}`);
check(`所有 repair/verify 帧带 invariantChecks`, trace.frames.filter((f) => ['repair', 'verify'].includes(f._meta.phase)).every((f) => f._meta.invariantChecks && f._meta.invariantChecks.length));
check(`末帧结构验证通过`, trace.frames[trace.frames.length - 1]._meta.invariantResult.ok === true,
  JSON.stringify(trace.frames[trace.frames.length - 1]._meta.invariantResult.violations));

console.log('—— 与 code-library 锚点对齐 ——');
const bundle = W.getCodeBundle(avlModule, trace);
['cpp', 'java', 'python'].forEach((lang) => {
  const anchors = bundle[lang].anchors;
  const missing = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((k) => !anchors[k] || !anchors[k].length);
  check(`${lang} 代码含 @0-@9 全部锚点`, missing.length === 0, `缺失锚点: ${missing.join(',')}`);
});

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
