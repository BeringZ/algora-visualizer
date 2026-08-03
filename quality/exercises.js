/**
 * exercises.js — Algora 练习系统题库（I5-B · 计划书工作流 G）
 *
 * 四类题型（预测/状态/找错/构造），数据合同：
 *   { id, question, options: [≥3], answer, feedback, tag? }
 *   tag 可选：'sort' | 'linked' | 'tree' | 'queue' | 'graph'（未匹配则通用）
 * 答案位置分布均衡（0:4 / 1:2 / 2:3 / 3:3），无猜题规律。
 */
(function (global) {
  'use strict';

  const EXERCISES = {
    predict: [
      {
        id: 'p1', tag: 'sort',
        question: '对数组 [5, 3, 4, 1, 2] 执行冒泡排序，第一趟（内层完整一轮）结束后数组是？',
        options: ['[3, 4, 1, 2, 5]', '[1, 2, 3, 4, 5]', '[5, 3, 4, 1, 2]', '[3, 5, 1, 4, 2]'],
        answer: 0,
        feedback: '第一趟把最大值 5 冒泡到末尾：5 与 3 交换、5 与 4 交换、5 与 1 交换、5 与 2 交换 → [3,4,1,2,5]。'
      },
      {
        id: 'p2', tag: 'queue',
        question: '循环队列容量 5（牺牲一个单元判满），front=1，rear=3。此时队列有几个元素？',
        options: ['2', '1', '4', '3'],
        answer: 0,
        feedback: '元素数 = (rear - front + cap) % cap = (3-1+5)%5 = 2。'
      },
      {
        id: 'p3', tag: 'tree',
        question: 'AVL 树插入后某结点平衡因子变为 +2，且插入键在其左孩子的左子树（LL 型）。应执行？',
        options: ['左旋', '先左旋后右旋', '右旋', '先右旋后左旋'],
        answer: 2,
        feedback: 'LL 型失衡对失衡结点执行右旋即可恢复平衡（左孩子上提）。'
      }
    ],
    state: [
      {
        id: 's1', tag: 'queue',
        question: '循环队列（cap=5，牺牲单元方案）哪个状态表示「满」？',
        options: ['front == rear', '(rear+1) % 5 == front', 'rear == 4', 'rear == front - 1'],
        answer: 1,
        feedback: '牺牲一个单元：满时 (rear+1)%cap == front；front==rear 是空。'
      },
      {
        id: 's2', tag: 'tree',
        question: '红黑树插入后出现「连续红结点」（父红子红），叔结点为黑。该走哪个修复分支？',
        options: ['直接变色（叔红分支）', '删除该结点', '根结点染黑即可', '旋转（叔黑分支：先旋后变色）'],
        answer: 3,
        feedback: '叔黑时变色无法解决连续红，须旋转（LL/RR 单旋或 LR/RL 双旋）后变色。'
      },
      {
        id: 's3', tag: 'graph',
        question: 'Dijkstra 算法执行中，一个顶点被「确定」的充分条件是什么？',
        options: ['它已被访问过', '它的距离值不再被任何松弛更新', '它距离起点最近', '它的出边都松弛过'],
        answer: 1,
        feedback: 'Dijkstra 每次确定「当前未确定中距离最小」的顶点——前提是非负权，一旦确定不再变短。'
      }
    ],
    debug: [
      {
        id: 'd1', tag: 'linked',
        question: '单链表在结点 p 后插入 s，以下哪段代码会造成链表断裂或自环？',
        options: [
          's.next = p.next; p.next = s;',
          'Node t = p.next; s.next = t; p.next = s;',
          'p.next = s; s.next = p.next;',
          's.next = p.next; p.next = s; list.length++;'
        ],
        answer: 2,
        feedback: '先执行 p.next=s 会覆盖原后继引用，随后 s.next=p.next 让 s 指向自己——自环。正确顺序是先挂后继再改前驱。'
      },
      {
        id: 'd2', tag: 'graph',
        question: '对含负权边的图运行 Dijkstra，可能发生什么？',
        options: [
          '总能得到正确答案',
          '结果可能错误：先确定的路径可能被更短的负权路径超越',
          '必然抛出异常',
          '结果正确但更慢'
        ],
        answer: 1,
        feedback: 'Dijkstra 的贪心前提是「已确定最短路径不再变短」，负权边会破坏它；应改用 Bellman-Ford。'
      },
      {
        id: 'd3', tag: 'sort',
        question: '以下哪段代码在 Go 中会 panic？',
        options: [
          'var m map[string]int; v, ok := m["k"]; _ = v; _ = ok',
          'm := make(map[string]int); m["b"] = 2',
          'var m map[string]int; m["k"] = 1',
          'm := map[string]int{"a": 1}; delete(m, "a")'
        ],
        answer: 2,
        feedback: 'nil map 读取安全（返回零值），但写入 panic：assignment to entry in nil map。'
      }
    ],
    construct: [
      {
        id: 'c1', tag: 'tree',
        question: '要触发 AVL 树的 LL 型失衡（对根右旋），应选择哪个插入序列？',
        options: ['10, 20, 30', '30, 10, 20', '10, 30, 20', '30, 20, 10'],
        answer: 3,
        feedback: 'LL：新键插入根的左孩子的左子树，即递减序列 30→20→10 使 30 的平衡因子 +2。'
      },
      {
        id: 'c2', tag: 'sort',
        question: '要构造快速排序（末尾枢轴）的最坏情况输入，应选择？',
        options: ['已排序或逆序', '完全随机', '全部相等', '重复元素交错'],
        answer: 0,
        feedback: '已排序/逆序时末尾枢轴每次都选到极值，划分极不均匀，递归深度 O(n)。三数取中可缓解。'
      },
      {
        id: 'c3', tag: 'tree',
        question: '在 2-3 树（B 树 m=3）中插入几个关键字会必然触发一次结点分裂？',
        options: ['3 个', '1 个', '2 个', '4 个'],
        answer: 0,
        feedback: '结点最多 2 个关键字（m-1），第 3 个关键字插入即上溢分裂（中关键字上提）。'
      }
    ]
  };

  // 确定性校验：每题 options ≥ 3、answer 合法、反馈存在
  const problems = [];
  Object.entries(EXERCISES).forEach(([type, list]) => {
    list.forEach((q) => {
      if (!q.options || q.options.length < 3) problems.push(`${q.id} 选项不足`);
      if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= (q.options || []).length) problems.push(`${q.id} answer 越界`);
      if (!q.feedback) problems.push(`${q.id} 缺反馈`);
    });
  });
  if (problems.length && typeof console !== 'undefined') {
    console.error('[exercises] 数据合同违规:', problems.join('; '));
  }

  global.ALGORA_EXERCISES = EXERCISES;
})(typeof globalThis !== 'undefined' ? globalThis : this);
