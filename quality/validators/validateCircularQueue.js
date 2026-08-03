/**
 * validateCircularQueue — 循环队列结构不变量验证器（Algora 质检库 · 首批验证器 #3）
 *
 * 支持文档工作流 B 要求的两种空满区分方案：
 *   mode='sacrifice' —— 牺牲一个存储单元：(rear+1) % capacity === front 为满
 *   mode='count'     —— 用独立 size 计数区分空满
 *   mode='flag'      —— 用独立 flag 布尔区分（本次实现为 size 的等价简化，flag 语义由调用方保证）
 *
 * 输入契约（state）：
 *   {
 *     capacity: int>0,
 *     front: int,        // 队头索引（指向元素）
 *     rear: int,         // sacrifice: 指向下一个可写位置；count: 指向队尾元素
 *     size: int,         // count/flag 模式必填；sacrifice 模式忽略
 *     mode: 'sacrifice'|'count'|'flag',
 *     values: Array|null // 长度应等于 capacity，非空槽位数量应与 size 一致
 *   }
 * 输出契约：{ ok, violations: [{ type, nodeId, detail }] }（纯函数、不抛异常）
 */
(function (global) {
  'use strict';

  function validateCircularQueue(state) {
    const violations = [];
    if (!state || typeof state !== 'object') {
      return { ok: false, violations: [{ type: 'state', nodeId: null, detail: '状态缺失或非法' }] };
    }
    const { capacity, front, rear, mode, size, values } = state;

    // 1) capacity 合法性
    if (!Number.isInteger(capacity) || capacity <= 0) {
      return { ok: false, violations: [{ type: 'capacity', nodeId: null, detail: `capacity 必须为正整数，收到 ${JSON.stringify(capacity)}` }] };
    }
    if (!['sacrifice', 'count', 'flag'].includes(mode)) {
      violations.push({ type: 'mode', nodeId: null, detail: `mode 必须为 sacrifice|count|flag，收到 ${JSON.stringify(mode)}` });
    }
    // 2) front/rear 索引范围
    if (!Number.isInteger(front) || front < 0 || front >= capacity) {
      violations.push({ type: 'index-range', nodeId: null, detail: `front=${front} 超出 [0, ${capacity - 1}]` });
    }
    if (!Number.isInteger(rear) || rear < 0 || rear >= capacity) {
      violations.push({ type: 'index-range', nodeId: null, detail: `rear=${rear} 超出 [0, ${capacity - 1}]` });
    }
    // 3) values 长度
    if (values != null && (!Array.isArray(values) || values.length !== capacity)) {
      violations.push({ type: 'values-length', nodeId: null, detail: `values 长度应为 ${capacity}，收到 ${values && values.length}` });
    }

    // 4) 元素数与空满语义
    if (mode === 'sacrifice') {
      if (front === rear) {
        // 空：允许，但 values 中不应有残留非空元素（严格模式下检查）
        if (Array.isArray(values) && values.some((v) => v != null)) {
          violations.push({ type: 'empty-contents', nodeId: null, detail: 'front==rear 表示空队列，但 values 中存在非空槽位' });
        }
      } else {
        const count = (rear - front + capacity) % capacity;
        if (count === 0) {
          violations.push({ type: 'empty-full', nodeId: null, detail: 'sacrifice 模式下 (rear-front+cap)%cap 恒为正时才是非空，此处矛盾' });
        }
        if ((rear + 1) % capacity === front) {
          violations.push({ type: 'full', nodeId: null, detail: `front=${front}, rear=${rear} 满足 (rear+1)%cap==front，队列已满（牺牲单元方案）` });
        }
        if (Array.isArray(values)) {
          let filled = 0;
          for (let i = 0; i < capacity; i++) if (values[i] != null) filled++;
          if (filled !== count) {
            violations.push({ type: 'contents-count', nodeId: null, detail: `values 非空槽位=${filled}，与 front/rear 推算元素数=${count} 不一致` });
          }
        }
      }
    } else {
      // count / flag 模式：size 必须存在且在 [0, capacity]
      if (!Number.isInteger(size) || size < 0 || size > capacity) {
        violations.push({ type: 'size-range', nodeId: null, detail: `size=${size} 超出 [0, ${capacity}]` });
      } else if (Array.isArray(values)) {
        let filled = 0;
        for (let i = 0; i < capacity; i++) if (values[i] != null) filled++;
        if (filled !== size) {
          violations.push({ type: 'contents-count', nodeId: null, detail: `values 非空槽位=${filled} 与 size=${size} 不一致` });
        }
      }
      if (size === capacity) {
        violations.push({ type: 'full', nodeId: null, detail: 'size==capacity，队列已满（计数方案）' });
      }
    }

    return { ok: violations.length === 0, violations };
  }

  const api = { validateCircularQueue };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.AlgoraValidators = global.AlgoraValidators || {};
    global.AlgoraValidators.validateCircularQueue = validateCircularQueue;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
