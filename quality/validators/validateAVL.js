/**
 * validateAVL — AVL 树结构不变量验证器（Algora 质检库 · 首批验证器 #2）
 *
 * 在 validateBST 全部检查项之上，追加 AVL 专属不变量：
 *   9. 高度一致性：height(node) === 1 + max(height(left), height(right))（空孩子高度视为 0）
 *  10. 平衡因子：|balanceFactor| = |height(left) - height(right)| <= 1，且 height 字段数值合法
 *
 * 输入契约（state）：
 *   {
 *     root: <nodeId | null>,
 *     nodes: { [nodeId]: { id, key, left, right, parent?, height? } }
 *   }
 * 输出契约：{ ok, violations: [{ type, nodeId, detail }] }（纯函数、不抛异常）
 */
(function (global) {
  'use strict';

  const { validateBST } = (function loadBase() {
    if (typeof require === 'function') {
      try { return require('./validateBST.js'); } catch (_) { /* browser fallback */ }
    }
    return { validateBST: global.AlgoraValidators && global.AlgoraValidators.validateBST };
  })();

  function validateAVL(state, opts) {
    const violations = [];
    if (!state || typeof state !== 'object' || !state.nodes) {
      return { ok: false, violations: [{ type: 'state', nodeId: null, detail: '状态缺失或非法：需要 { root, nodes }' }] };
    }
    const nodes = state.nodes;

    // 1) 先跑 BST 基础不变量（排序、引用、连通、无环）
    const base = validateBST(state, opts);
    violations.push(...base.violations);

    // 2) 后序遍历计算实际高度并校验 height 字段
    const actualHeight = new Map();
    const visited = new Set();
    const stk = [];
    if (state.root != null && state.root in nodes) {
      stk.push(state.root);
      while (stk.length) {
        const id = stk[stk.length - 1];
        const n = nodes[id];
        if (visited.has(id)) {
          stk.pop();
          const hl = n.left != null ? (actualHeight.get(n.left) ?? 0) : 0;
          const hr = n.right != null ? (actualHeight.get(n.right) ?? 0) : 0;
          actualHeight.set(id, 1 + Math.max(hl, hr));

          // 9) height 字段一致性
          if (typeof n.height === 'number' && Number.isFinite(n.height)) {
            if (n.height !== actualHeight.get(id)) {
              violations.push({ type: 'height-consistency', nodeId: id, detail: `height=${n.height}，但按子结点应为 ${actualHeight.get(id)}` });
            }
            // 10) 平衡因子
            const bf = hl - hr;
            if (Math.abs(bf) > 1) {
              violations.push({ type: 'avl-balance', nodeId: id, detail: `平衡因子=${bf}（左高 ${hl}，右高 ${hr}），超出 [-1,1]` });
            }
          } else {
            violations.push({ type: 'height-missing', nodeId: id, detail: 'AVL 结点必须提供数值 height 字段' });
          }
        } else {
          visited.add(id);
          if (n.left != null && n.left in nodes) stk.push(n.left);
          if (n.right != null && n.right in nodes) stk.push(n.right);
        }
      }
    }

    return { ok: violations.length === 0, violations };
  }

  const api = { validateAVL };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.AlgoraValidators = global.AlgoraValidators || {};
    global.AlgoraValidators.validateAVL = validateAVL;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
