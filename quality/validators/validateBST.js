/**
 * validateBST — 二叉搜索树结构不变量验证器（Algora 质检库 · 首批验证器 #1）
 *
 * 输入契约（state）：
 *   {
 *     root: <nodeId | null>,
 *     nodes: { [nodeId]: { id, key, left, right, parent? } }
 *   }
 * 可选 opts：
 *   { allowDuplicates: false, checkParent: true }
 *
 * 输出契约：{ ok: boolean, violations: [{ type, nodeId, detail }] }
 *   纯函数、无副作用；任何输入都不抛异常。
 *
 * 检查项（文档工作流 A / 共用质检系统）：
 *   1. root 引用有效
 *   2. left/right/parent 引用完整（指向存在的结点）
 *   3. 从 root 可达全部结点（连通、无悬空）
 *   4. 遍历不重复访问（无环）
 *   5. 二叉性：每结点至多两个孩子
 *   6. 排序不变量：left.key < parent.key（重复允许时 <=），right.key > parent.key
 *   7. parent 双向一致性（若提供 parent 字段）
 *   8. key 为有限数字
 */
(function (global) {
  'use strict';

  function isValidId(id) {
    return typeof id === 'string' && id.length > 0;
  }

  function validateBST(state, opts) {
    const violations = [];
    const allowDuplicates = !!(opts && opts.allowDuplicates);
    const checkParent = !(opts && opts.checkParent === false);

    if (!state || typeof state !== 'object' || !state.nodes || typeof state.nodes !== 'object') {
      return { ok: false, violations: [{ type: 'state', nodeId: null, detail: '状态缺失或非法：需要 { root, nodes }' }] };
    }
    const nodes = state.nodes;
    const root = state.root === undefined ? null : state.root;

    // 1. 根引用有效
    if (root !== null && !(root in nodes)) {
      violations.push({ type: 'root-ref', nodeId: root, detail: `根结点 "${root}" 不在结点表中` });
    }

    // 2+8. 结点表自身合法性：id 唯一（对象键天然唯一）、key 为有限数字、孩子引用完整
    Object.values(nodes).forEach((n) => {
      if (!n || typeof n !== 'object') { violations.push({ type: 'node-shape', nodeId: null, detail: '结点表中存在非法结点（非对象）' }); return; }
      const id = n.id;
      if (!isValidId(id)) violations.push({ type: 'node-id', nodeId: id, detail: '结点缺少合法 id' });
      if (typeof n.key !== 'number' || !Number.isFinite(n.key)) {
        violations.push({ type: 'node-key', nodeId: id ?? null, detail: `结点 key 非法：${JSON.stringify(n.key)}` });
      }
      ['left', 'right', 'parent'].forEach((ref) => {
        if (n[ref] != null && !(n[ref] in nodes)) {
          violations.push({ type: 'child-ref', nodeId: id ?? null, detail: `结点 "${id}" 的 ${ref} 引用 "${n[ref]}" 不存在` });
        }
      });
    });

    // 3+4. 从 root 做 DFS：连通性 + 无环 + 二叉性 + 排序不变量 + parent 双向一致
    const visited = new Set();
    function dfs(nodeId, from, lower, upper) {
      if (nodeId == null) return;
      if (visited.has(nodeId)) {
        violations.push({ type: 'cycle', nodeId, detail: `从 "${from}" 再次访问到 "${nodeId}"，存在环` });
        return;
      }
      visited.add(nodeId);
      const n = nodes[nodeId];
      if (!n) return; // 引用错误已在步骤 2 报出，避免重复崩溃
      // 区间约束（BST 排序不变量）
      const key = n.key;
      if (typeof key === 'number' && Number.isFinite(key)) {
        if (lower != null && (allowDuplicates ? key < lower : key <= lower)) {
          violations.push({ type: 'bst-order', nodeId, detail: `key=${key} 违反左子树区间约束（应 ${allowDuplicates ? '<=' : '<'} ${lower}）` });
        }
        if (upper != null && (allowDuplicates ? key > upper : key >= upper)) {
          violations.push({ type: 'bst-order', nodeId, detail: `key=${key} 违反右子树区间约束（应 ${allowDuplicates ? '>=' : '>'} ${upper}）` });
        }
      }
      // parent 双向一致性
      if (checkParent && n.parent != null) {
        const p = nodes[n.parent];
        if (p && p.left !== nodeId && p.right !== nodeId) {
          violations.push({ type: 'parent-mismatch', nodeId, detail: `结点 "${nodeId}" 声称 parent="${n.parent}"，但该父结点的 left/right 均不指向它` });
        }
      }
      // 二叉性 + 递归
      let childCount = 0;
      if (n.left != null) { childCount++; dfs(n.left, nodeId, lower, key); }
      if (n.right != null) { childCount++; dfs(n.right, nodeId, key, upper); }
      if (childCount > 2) violations.push({ type: 'arity', nodeId, detail: `结点 "${nodeId}" 有 ${childCount} 个孩子，违反二叉性` });
    }
    if (root != null) dfs(root, null, null, null);

    // 5. 悬空/孤立结点：从 root 不可达
    Object.keys(nodes).forEach((id) => {
      if (!visited.has(id)) {
        violations.push({ type: 'unreachable', nodeId: id, detail: `结点 "${id}" 从 root 不可达（悬空或根引用错误）` });
      }
    });

    return { ok: violations.length === 0, violations };
  }

  // UMD 导出：node 环境挂 module.exports，浏览器挂 global.AlgoraValidators
  const api = { validateBST };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.AlgoraValidators = global.AlgoraValidators || {};
    global.AlgoraValidators.validateBST = validateBST;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
