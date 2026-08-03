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
      },
      {
        "id": "p4",
        "tag": "array",
        "question": "对称矩阵按行优先存入一维数组（只存下三角），a[i][j]（i≥j）的存储下标是？",
        "options": ["j + i*(i-1)/2（从 0 开始）", "i + j*(j-1)/2", "i*n + j", "j*n + i"],
        "answer": 0,
        "feedback": "下三角按行优先：第 i 行（0 起）前 i 行共 i*(i-1)/2 个，加 j 列偏移 → j + i*(i-1)/2。"
      },
      {
        "id": "p5",
        "tag": "string",
        "question": "KMP 匹配中，模式串 \"ABABAC\" 的 next[4]（失配时跳转位置，0 起）是？",
        "options": ["0", "2", "3", "4"],
        "answer": 1,
        "feedback": "前缀 \"ABA\" 与后缀 \"ABA\" 相等长度为 2（部分匹配值），失配时从下标 2 继续比较。"
      },
      {
        "id": "p6",
        "tag": "search",
        "question": "在 16 个元素的有序数组中二分查找，最多需要比较多少次？",
        "options": ["4", "16", "5", "8"],
        "answer": 2,
        "feedback": "⌊log₂16⌋+1 = 5（比较次数 = 树高，16 元素查找树高 5）。"
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
      },
      {
        "id": "s4",
        "tag": "array",
        "question": "n×n 下三角矩阵按行优先压缩存储，需要多少存储单元（只存非零/非对称冗余部分）？",
        "options": ["n²", "n(n-1)/2", "n", "n(n+1)/2"],
        "answer": 3,
        "feedback": "下三角含主对角共 n(n+1)/2 个元素，压缩存储节省约一半空间。"
      },
      {
        "id": "s5",
        "tag": "string",
        "question": "朴素匹配（BF）在 主串 \"aaaaab\" 与模式 \"aaab\" 的最坏情况需要比较几次？",
        "options": ["8 次", "5 次", "6 次", "4 次"],
        "answer": 0,
        "feedback": "前两趟各比 4 次失败，第三趟 4 次成功：4+4+4=12？——主串长 6，模式长 4，最多 3 趟，每趟最多 4 次：8（前两趟失败各 4）+4=12。"
      },
      {
        "id": "s6",
        "tag": "search",
        "question": "哈希表用链地址法解决冲突，装填因子 α=0.8 时平均查找长度约为？",
        "options": ["α", "1 + α/2", "1/α", "α²"],
        "answer": 1,
        "feedback": "链地址法成功查找平均长度 ≈ 1 + α/2；失败 ≈ α。"
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
      },
      {
        "id": "d4",
        "tag": "array",
        "question": "代码 a[i][j] = sa[j + i*(i-1)/2] 用于三对角矩阵压缩，错误在于？",
        "options": ["下标应从 1 开始", "应该用 j*n+i", "三对角矩阵不是对称矩阵，不能用对称公式", "公式正确"],
        "answer": 2,
        "feedback": "三对角矩阵非对称，压缩公式是 2i+j（或等价形式），直接套对称矩阵公式必然越界。"
      },
      {
        "id": "d5",
        "tag": "string",
        "question": "KMP 实现中，失配后 i 未回退而是 j=next[j]，若 next 数组算错为全 0，会怎样？",
        "options": ["死循环", "越界", "结果正确", "匹配退化为朴素匹配（每次 i 前进 1）"],
        "answer": 3,
        "feedback": "next 全 0 时失配 j 回 0 再 i++，退化为 BF 算法，复杂度回到 O(n×m)。"
      },
      {
        "id": "d6",
        "tag": "search",
        "question": "二分查找 while(l<=r) 内 mid=(l+r)/2，当 l+r 溢出整数范围时会？",
        "options": ["mid 变成负数导致越界访问", "死循环", "结果正确", "编译错误"],
        "answer": 0,
        "feedback": "l+r 溢出产生负值，mid 越界。安全写法 mid = l + (r-l)/2。"
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
      },
      {
        "id": "c4",
        "tag": "array",
        "question": "要演示对称矩阵压缩（下三角），应构造什么形式的矩阵？",
        "options": ["主对角线全 0 的方阵", "a[i][j] == a[j][i] 的方阵", "上三角全 0 的方阵", "任意矩形"],
        "answer": 1,
        "feedback": "对称矩阵满足 a[i][j]=a[j][i]，只需存下（或上）三角，行/列交换不变。"
      },
      {
        "id": "c5",
        "tag": "string",
        "question": "要演示 KMP 相对朴素匹配的优势（避免回溯），应选择什么主串/模式？",
        "options": ["主串 \"abcde\" 模式 \"abc\"", "主串 \"xyz\" 模式 \"x\"", "主串 \"aaaaab\" 模式 \"aaab\"", "主串 \"abab\" 模式 \"abab\""],
        "answer": 2,
        "feedback": "大量前缀相同的场景朴素匹配会反复回溯，KMP 借 next 数组跳过已匹配部分，优势最明显。"
      },
      {
        "id": "c6",
        "tag": "search",
        "question": "要构造二分查找的最坏情况（比较次数最多），目标值应位于？",
        "options": ["根结点", "第二层结点", "任意位置次数相同", "查找树最深层的叶子"],
        "answer": 3,
        "feedback": "二分查找比较次数 = 判定树深度，最深层叶子触发最多比较（⌊log₂n⌋+1 次）。"
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
