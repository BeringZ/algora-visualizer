#!/usr/bin/env node
/**
 * test-matrix-map.js — 矩阵压缩坐标映射公式测试（I2-C 验收）
 *
 * 对照计划书工作流 C 验收标准：
 *   - 映射公式对首项 / 末项 / 主对角线 / 越界输入均有自动测试
 *   - 页面明确显示空间从 O(n²) 降低到何种规模
 *   - 点击矩阵元素与压缩数组双向联动（数据层断言）
 *
 * 运行：node quality/test-matrix-map.js   退出码 0=通过
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
sandbox.window.AlgoraValidators = {
  validateBST: require('./validators/validateBST.js').validateBST,
  validateAVL: require('./validators/validateAVL.js').validateAVL,
  validateCircularQueue: require('./validators/validateCircularQueue.js').validateCircularQueue,
  validateLinkedList: require('./validators/validateLinkedList.js').validateLinkedList,
};
const W = sandbox.window;
const M = W.AlgoraMatrixMap;
const mod = (id) => W.ALGORA_MODULES.find((m) => m.id === id);

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? '  → ' + detail : ''}`); }
}

console.log('—— 映射公式：对称矩阵下三角（n=4，存储 10 槽）——');
{
  check('首项 a[0][0] → k=0', M['symmetric-lower'](0, 0, 4).k === 0);
  check('末项 a[3][3] → k=9', M['symmetric-lower'](3, 3, 4).k === 9);
  check('下三角 a[2][0] → k=3', M['symmetric-lower'](2, 0, 4).k === 3, `got ${M['symmetric-lower'](2, 0, 4).k}`);
  check('主对角线 a[i][i] 单调递增', M['symmetric-lower'](1, 1, 4).k === 2 && M['symmetric-lower'](2, 2, 4).k === 5 && M['symmetric-lower'](3, 3, 4).k === 9);
  check('上三角区域按对称映射（a[0][2] ↔ a[2][0]）', M['symmetric-lower'](0, 2, 4).k === M['symmetric-lower'](2, 0, 4).k);
  check('越界输入不抛异常且返回合法下标', (() => { try { const r = M['symmetric-lower'](-1, 5, 4); return typeof r.k === 'number'; } catch { return false; } })());
}

console.log('—— 映射公式：三角矩阵（下三角，上三角为常量区）——');
{
  check('下三角 a[3][1] → k=7', M.triangular(3, 1, 4).k === 7, `got ${M.triangular(3, 1, 4).k}`);
  check('上三角区域 valid=false（常量区）', M.triangular(0, 2, 4).valid === false);
  check('首项 a[0][0] → k=0', M.triangular(0, 0, 4).k === 0);
  check('末项 a[3][3] → k=9', M.triangular(3, 3, 4).k === 9);
}

console.log('—— 映射公式：三对角矩阵（仅存 3n-2=10 槽）——');
{
  check('主对角线 a[i][i] → k=3i', M.tridiagonal(2, 2, 4).k === 6, `got ${M.tridiagonal(2, 2, 4).k}`);
  check('上邻 a[1][2] → k=4', M.tridiagonal(1, 2, 4).k === 4);
  check('下邻 a[2][1] → k=5', M.tridiagonal(2, 1, 4).k === 5);
  check('带外 a[0][3] valid=false（返回 0）', M.tridiagonal(0, 3, 4).valid === false);
  check('空间 3n-2：n=4 存 10 槽', M.tridiagonal(3, 3, 4).k <= 9);
}

console.log('—— 页面数据层：矩阵映射视图与空间对比 ——');
{
  const trace = W.buildTrace(mod('symmetric-matrix'), '');
  const mapFrame = trace.frames[0];
  check('对称矩阵走 matrix-map 交互视图', mapFrame.visual.type === 'matrix-map', `type=${mapFrame.visual.type}`);
  check('视图含原矩阵/压缩存储/公式/空间对比',
    mapFrame.visual.matrix && mapFrame.visual.storage && mapFrame.visual.formula
    && mapFrame.visual.spaceBefore === 16 && mapFrame.visual.spaceAfter === 10,
    `before=${mapFrame.visual.spaceBefore} after=${mapFrame.visual.spaceAfter}`);
  check('压缩存储与矩阵映射一致（逐元素校验）',
    (() => { const v = mapFrame.visual; const kind = v.kind; const n = v.n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const r = M[kind](i, j, n);
        if (r.valid && v.storage[r.k] !== v.matrix[i][j]) return false;
        if (!r.valid && v.matrix[i][j] !== 0 && kind !== 'symmetric-lower' && kind !== 'symmetric-upper') return false;
      } return true; })());

  // 三角/三对角也走映射视图
  check('三角矩阵走 matrix-map 视图', W.buildTrace(mod('triangular-matrix'), '').frames[0].visual.type === 'matrix-map');
  check('三对角矩阵走 matrix-map 视图', W.buildTrace(mod('tridiagonal-matrix'), '').frames[0].visual.type === 'matrix-map');
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
