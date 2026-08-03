/**
 * validateBTree — B 树不变量验证器（Algora 质检库 · 第 6 个验证器）
 *
 * 文档工作流 D：B 树必须验证：
 *   1. 每个结点关键字严格递增有序
 *   2. 阶数约束：非根结点关键字数 ∈ [ceil(m/2)-1, m-1]；根 ∈ [1, m-1]
 *   3. 子树引用完整（children 引用存在的结点）
 *   4. 子树关键字区间正确（左子树所有 key < 结点 key < 右子树 key）
 *   5. 所有叶在同一层（平衡）
 *
 * 输入契约（state）：
 *   { m: 3, root: <nodeId>, nodes: { [nodeId]: { id, keys: [], children: [] } } }
 * 输出契约：{ ok, violations: [{ type, nodeId, detail }] }
 */
(function (global) {
  'use strict';

  function validateBTree(state) {
    const violations = [];
    if (!state || !state.nodes || typeof state.nodes !== 'object' || !state.root) {
      return { ok: false, violations: [{ type: 'state', nodeId: null, detail: '状态缺失或非法：需要 { m, root, nodes }' }] };
    }
    const m = state.m || 3;
    const minKeys = Math.ceil(m / 2) - 1;
    const maxKeys = m - 1;
    const nodes = state.nodes;
    const root = state.root;

    // 引用完整性
    Object.values(nodes).forEach((n) => {
      (n.children || []).forEach((c) => {
        if (!(c in nodes)) violations.push({ type: 'child-ref', nodeId: n.id, detail: `子引用 "${c}" 不存在` });
      });
    });
    if (!(root in nodes)) {
      violations.push({ type: 'root-ref', nodeId: root, detail: `根 "${root}" 不在结点表中` });
      return { ok: false, violations };
    }

    // 阶数约束 + 有序
    Object.values(nodes).forEach((n) => {
      const k = (n.keys || []).length;
      if (k < 1) violations.push({ type: 'empty-node', nodeId: n.id, detail: `结点 "${n.id}" 无关键字（下溢未修复）` });
      if (n.id !== root && k < minKeys) violations.push({ type: 'underflow', nodeId: n.id, detail: `结点 "${n.id}" 关键字数 ${k} < 最小 ${minKeys}（下溢）` });
      if (k > maxKeys) violations.push({ type: 'overflow', nodeId: n.id, detail: `结点 "${n.id}" 关键字数 ${k} > 最大 ${maxKeys}（上溢未分裂）` });
      for (let i = 1; i < k; i++) {
        if (n.keys[i] <= n.keys[i - 1]) violations.push({ type: 'key-order', nodeId: n.id, detail: `结点 "${n.id}" 关键字未严格递增（${n.keys[i - 1]} ≤ ${n.keys[i]}）` });
      }
      // 子树引用数 = keys + 1（内部结点）或 0（叶）
      const kids = (n.children || []).length;
      if (kids > 0 && kids !== k + 1) violations.push({ type: 'child-count', nodeId: n.id, detail: `结点 "${n.id}" 有 ${kids} 个子树但 ${k} 个关键字（应为 ${k + 1}）` });
    });

    // 关键字区间（BST 性质推广）+ 叶同层
    let leafDepth = -1;
    function checkRange(id, lo, hi, depth) {
      const n = nodes[id];
      (n.keys || []).forEach((key, i) => {
        if (lo !== null && key <= lo) violations.push({ type: 'range', nodeId: id, detail: `关键字 ${key} 不在 (${lo}, ${hi}) 区间` });
        if (hi !== null && key >= hi) violations.push({ type: 'range', nodeId: id, detail: `关键字 ${key} 不在 (${lo}, ${hi}) 区间` });
        const childLo = i === 0 ? lo : n.keys[i - 1];
        const childHi = n.keys[i];
        if (n.children && n.children[i]) checkRange(n.children[i], childLo, childHi, depth + 1);
      });
      if (n.children && n.children[n.keys.length]) checkRange(n.children[n.keys.length], n.keys[n.keys.length - 1] ?? lo, hi, depth + 1);
      if (!(n.children || []).length) {
        if (leafDepth === -1) leafDepth = depth;
        else if (depth !== leafDepth) violations.push({ type: 'leaf-depth', nodeId: id, detail: `叶结点 "${id}" 深度 ${depth} 与首叶 ${leafDepth} 不一致（B 树要求所有叶同层）` });
      }
    }
    checkRange(root, null, null, 0);

    return { ok: violations.length === 0, violations };
  }

  const api = { validateBTree };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.AlgoraValidators = global.AlgoraValidators || {};
    global.AlgoraValidators.validateBTree = validateBTree;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
