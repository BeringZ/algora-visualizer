/**
 * validateRedBlack — 红黑树不变量验证器（Algora 质检库 · 第 5 个验证器）
 *
 * 文档工作流 D：红黑树必须验证四条不变量：
 *   1. 每个结点非红即黑
 *   2. 根结点为黑色
 *   3. 红色结点的两个子结点均为黑色（无连续红结点）
 *   4. 从任一结点到其每个叶子的简单路径上黑色结点数相同（黑高一致）
 *   5. 中序有序（BST 性质）
 *
 * 输入契约（state）：
 *   { root: <nodeId|null>, nodes: { [nodeId]: { id, key, left, right, color } } }
 *   其中 color ∈ { 'red', 'black' }（缺省视为 black）
 * 输出契约：{ ok, violations: [{ type, nodeId, detail }] }（纯函数、不抛异常）
 */
(function (global) {
  'use strict';

  function validateRedBlack(state) {
    const violations = [];
    if (!state || !state.nodes || typeof state.nodes !== 'object') {
      return { ok: false, violations: [{ type: 'state', nodeId: null, detail: '状态缺失或非法：需要 { root, nodes }' }] };
    }
    const nodes = state.nodes;
    const root = state.root === undefined ? null : state.root;

    // 0) 引用完整性
    Object.values(nodes).forEach((n) => {
      if (!n || !(n.id in nodes)) violations.push({ type: 'node-shape', nodeId: n && n.id, detail: '结点表中存在非法结点' });
      [n.left, n.right].forEach((c) => { if (c !== null && !(c in nodes)) violations.push({ type: 'child-ref', nodeId: n.id, detail: `子引用 "${c}" 不存在` }); });
    });
    if (root !== null && !(root in nodes)) {
      violations.push({ type: 'root-ref', nodeId: root, detail: `根结点 "${root}" 不在结点表中` });
      return { ok: false, violations };
    }
    if (root === null && Object.keys(nodes).length > 0) {
      violations.push({ type: 'empty-root', nodeId: null, detail: 'root 为空但结点表非空' });
    }

    // 1) 颜色合法 + 2) 根黑
    Object.values(nodes).forEach((n) => {
      if (n.color !== 'red' && n.color !== 'black') violations.push({ type: 'color', nodeId: n.id, detail: `结点 "${n.id}" 颜色非法：${n.color}` });
    });
    if (root !== null && nodes[root].color === 'red') {
      violations.push({ type: 'root-red', nodeId: root, detail: '根结点必须是黑色' });
    }

    // 3) 红结点子黑 + 4) 黑高一致 + 5) BST 有序
    const blackHeights = {};
    function bh(id, depth) {
      if (id === null) return 1; // 叶（null）视为黑色
      const n = nodes[id];
      if (n.color === 'red') {
        if (n.left !== null && nodes[n.left].color === 'red') violations.push({ type: 'red-child', nodeId: id, detail: `红色结点 "${id}" 的左孩子也为红色（连续红）` });
        if (n.right !== null && nodes[n.right].color === 'red') violations.push({ type: 'red-child', nodeId: id, detail: `红色结点 "${id}" 的右孩子也为红色（连续红）` });
      }
      // BST 有序
      if (n.left !== null && nodes[n.left].key > n.key) violations.push({ type: 'bst-order', nodeId: id, detail: `左孩子 ${nodes[n.left].key} 大于父结点 ${n.key}` });
      if (n.right !== null && nodes[n.right].key < n.key) violations.push({ type: 'bst-order', nodeId: id, detail: `右孩子 ${nodes[n.right].key} 小于父结点 ${n.key}` });
      const lbh = bh(n.left, depth + 1), rbh = bh(n.right, depth + 1);
      if (lbh !== rbh) violations.push({ type: 'black-height', nodeId: id, detail: `结点 "${id}" 左右子树黑高不一致（${lbh} vs ${rbh}）` });
      const h = (n.color === 'black' ? 1 : 0) + lbh;
      blackHeights[id] = h;
      return h;
    }
    if (root !== null) bh(root, 0);

    return { ok: violations.length === 0, violations };
  }

  const api = { validateRedBlack };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.AlgoraValidators = global.AlgoraValidators || {};
    global.AlgoraValidators.validateRedBlack = validateRedBlack;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
