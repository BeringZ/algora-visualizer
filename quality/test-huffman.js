#!/usr/bin/env node
/**
 * test-huffman.js — 哈夫曼树专属操作测试（I3-C 验收）
 *
 * 对照计划书工作流 D 验收标准：
 *   - 哈夫曼树：权值输入、堆取最小、合并、编码、解码
 *   - 带权路径长度（WPL）、前缀码性质
 *   - 不得继续使用普通 BST 式插入/删除操作
 *
 * 运行：node quality/test-huffman.js   退出码 0=通过
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

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? '  → ' + detail : ''}`); }
}

console.log('—— 哈夫曼树专属操作 ——');
const t = W.buildTrace(W.ALGORA_MODULES.find((m) => m.id === 'huffman'), '');
const frames = t.frames;

check('真实构建：帧数 = 1 初始 + 5 轮合并 + 1 完成 = 7', frames.length === 7, `实际 ${frames.length}`);
check('每轮合并使用 merge mutation（堆取最小）',
  frames.filter((f) => f._meta && f._meta.mutation && f._meta.mutation.type === 'merge').length === 5,
  `实际 ${frames.filter((f) => f._meta && f._meta.mutation && f._meta.mutation.type === 'merge').length}`);
check('不使用 BST 式插入/删除操作',
  !frames.some((f) => f._meta && f._meta.mutation && ['insert', 'delete', 'rotateRight', 'rotateLeft'].includes(f._meta.mutation.type)));

const last = frames[frames.length - 1];
check('完成帧输出编码表', !!last.visual.codes && Object.keys(last.visual.codes).length === 6,
  JSON.stringify(last.visual.codes));
check('完成帧输出 WPL（带权路径长度）', typeof last.visual.wpl === 'number' && last.visual.wpl > 0,
  `WPL=${last.visual.wpl}`);

// WPL 数学验证：Σ weight × 编码长度
const weights = [5, 7, 10, 15, 20, 45];
const wplCalc = weights.reduce((s, w, i) => s + w * (last.visual.codes['w' + i] || '').length, 0);
check('WPL 与编码长度乘积一致', wplCalc === last.visual.wpl, `计算 ${wplCalc} vs ${last.visual.wpl}`);

// 前缀码性质：无编码是另一编码的前缀
const codes = Object.values(last.visual.codes);
const prefixOk = codes.every((c, i) => !codes.some((d, j) => i !== j && (c.startsWith(d) || d.startsWith(c))));
check('前缀码性质成立（任何编码不是另一编码前缀）', prefixOk);

// 频率最高者编码最短（哈夫曼最优性）
const longest = Object.entries(last.visual.codes).sort((a, b) => a[1].length - b[1].length);
check('最高权值 45 获得最短编码（1 位）', last.visual.codes['w5'] === '0' || last.visual.codes['w5'].length === 1,
  `w5=${last.visual.codes['w5']}`);

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
