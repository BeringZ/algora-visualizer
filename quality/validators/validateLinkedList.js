/**
 * validateLinkedList — 链表结构不变量验证器（Algora 质检库 · 第 4 个验证器）
 *
 * 文档工作流 B 要求：链表模块必须包含「错误顺序」演示（如先覆盖后继指针
 * 导致链断裂/自环）并允许用户诊断。本验证器用于在演示后断言结构完整性。
 *
 * 输入契约（state）：
 *   {
 *     head: <nodeId | null>,
 *     nodes: { [nodeId]: { id, value, next } },   // next: nodeId 或 null
 *     length?: number                              // 期望链长（可选）
 *   }
 * 输出契约：{ ok, violations: [{ type, nodeId, detail }] }（纯函数、不抛异常）
 *
 * 检查项：
 *   1. head 引用有效
 *   2. 每个 next 引用有效（指向存在的结点或 null）
 *   3. 无环（Floyd 快慢指针）
 *   4. 从 head 可达全部结点（无悬空）；每结点入度 ≤ 1（无重复引用）
 *   5. length（若提供）与实际可达数一致
 */
(function (global) {
  'use strict';

  function validateLinkedList(state) {
    const violations = [];
    if (!state || typeof state !== 'object' || !state.nodes || typeof state.nodes !== 'object') {
      return { ok: false, violations: [{ type: 'state', nodeId: null, detail: '状态缺失或非法：需要 { head, nodes }' }] };
    }
    const nodes = state.nodes;
    const head = state.head === undefined ? null : state.head;

    // 1) head 引用有效
    if (head !== null && !(head in nodes)) {
      violations.push({ type: 'head-ref', nodeId: head, detail: `头结点 "${head}" 不在结点表中` });
      return { ok: false, violations };
    }

    // 2) next 引用完整性
    Object.values(nodes).forEach((n) => {
      if (!n || typeof n !== 'object' || !(n.id in nodes)) {
        violations.push({ type: 'node-shape', nodeId: n && n.id, detail: '结点表中存在非法结点' });
        return;
      }
      if (n.next !== null && !(n.next in nodes)) {
        violations.push({ type: 'next-ref', nodeId: n.id, detail: `结点 "${n.id}" 的 next 引用 "${n.next}" 不存在` });
      }
    });

    // 3) 无环（快慢指针）+ 4) 可达性 + 入度
    const visited = new Set();
    const indegree = new Map();
    Object.keys(nodes).forEach((id) => indegree.set(id, 0));
    Object.values(nodes).forEach((n) => {
      if (n.next != null && n.next in nodes) indegree.set(n.next, (indegree.get(n.next) || 0) + 1);
    });
    indegree.forEach((deg, id) => {
      if (deg > 1) violations.push({ type: 'multi-parent', nodeId: id, detail: `结点 "${id}" 被 ${deg} 个结点引用（链表每结点至多一个前驱）` });
    });
    if (head != null) {
      let slow = head, fast = head;
      while (fast != null && nodes[fast] && nodes[fast].next != null && nodes[nodes[fast].next]) {
        visited.add(slow);
        slow = nodes[slow].next;
        fast = nodes[nodes[fast].next].next;
        if (slow === fast) {
          violations.push({ type: 'cycle', nodeId: slow, detail: `检测到环（快慢指针相遇于结点 "${slow}"），next 指针链成环` });
          break;
        }
      }
      // 可达性：从 head 沿 next 走一遍
      let cur = head, seen = new Set();
      while (cur != null && cur in nodes && !seen.has(cur)) {
        seen.add(cur);
        cur = nodes[cur].next;
      }
      Object.keys(nodes).forEach((id) => {
        if (!seen.has(id)) violations.push({ type: 'unreachable', nodeId: id, detail: `结点 "${id}" 从 head 不可达（悬空或 head 引用错误）` });
      });
      // 5) 长度
      if (typeof state.length === 'number' && seen.size !== state.length) {
        violations.push({ type: 'length-mismatch', nodeId: null, detail: `链长 ${seen.size} 与期望 ${state.length} 不一致` });
      }
    } else if (Object.keys(nodes).length > 0) {
      violations.push({ type: 'empty-head', nodeId: null, detail: 'head 为空但结点表非空（悬空结点）' });
    }

    return { ok: violations.length === 0, violations };
  }

  const api = { validateLinkedList };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.AlgoraValidators = global.AlgoraValidators || {};
    global.AlgoraValidators.validateLinkedList = validateLinkedList;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
