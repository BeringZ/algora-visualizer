#!/usr/bin/env node
/**
 * run.js — Algora 结构验证器自测 runner（CI 门禁第 1 步：结构断言测试）
 *
 * 每个验证器必须带合法/非法用例并在此跑通。运行：
 *   node quality/validators/run.js
 * 输出 PASS/FAIL 汇总；任一失败退出码非 0（供 CI 拦截）。
 */
'use strict';

const { validateBST } = require('./validateBST.js');
const { validateAVL } = require('./validateAVL.js');
const { validateCircularQueue } = require('./validateCircularQueue.js');
const { validateLinkedList } = require('./validateLinkedList.js');
const { validateRedBlack } = require('./validateRedBlack.js');
const { validateBTree } = require('./validateBTree.js');

let pass = 0, fail = 0;
const failures = [];

function expect(name, actual, wantOk, wantTypes) {
  const gotOk = actual.ok === true;
  const gotTypes = (actual.violations || []).map((v) => v.type);
  const ok = gotOk === wantOk && (!wantTypes || wantTypes.every((t) => gotTypes.includes(t)));
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else {
    fail++;
    failures.push(name);
    console.log(`  ✗ ${name}\n      want ok=${wantOk} types=[${wantTypes || ''}]  got ok=${gotOk} types=[${JSON.stringify(gotTypes)}]`);
  }
}

console.log('—— validateBST ——');
{
  const ok = {
    root: 'n2',
    nodes: {
      n2: { id: 'n2', key: 20, left: 'n1', right: 'n3', parent: null },
      n1: { id: 'n1', key: 10, left: null, right: null, parent: 'n2' },
      n3: { id: 'n3', key: 30, left: null, right: null, parent: 'n2' }
    }
  };
  expect('合法 BST 通过', validateBST(ok), true);

  const order = {
    root: 'n2',
    nodes: {
      n2: { id: 'n2', key: 20, left: 'n1', right: 'n3' },
      n1: { id: 'n1', key: 25, left: null, right: null },   // 左孩子 25 > 父 20 → 违序
      n3: { id: 'n3', key: 30, left: null, right: null }
    }
  };
  expect('左孩子 key 大于父 key 被捕获', validateBST(order), false, ['bst-order']);

  const cycle = {
    root: 'n1',
    nodes: {
      n1: { id: 'n1', key: 10, left: 'n2', right: null },
      n2: { id: 'n2', key: 5, left: 'n1', right: null }      // n2.left → n1 成环
    }
  };
  expect('环结构被捕获', validateBST(cycle), false, ['cycle']);

  const dangling = {
    root: 'n1',
    nodes: {
      n1: { id: 'n1', key: 10, left: 'ghost', right: null }  // 引用不存在的结点
    }
  };
  expect('悬空引用被捕获', validateBST(dangling), false, ['child-ref']);

  const orphan = {
    root: 'n1',
    nodes: {
      n1: { id: 'n1', key: 10, left: null, right: null },
      n2: { id: 'n2', key: 20, left: null, right: null }      // 孤立结点
    }
  };
  expect('孤立结点被捕获', validateBST(orphan), false, ['unreachable']);

  expect('空状态拒绝', validateBST(null), false, ['state']);
}

console.log('—— validateAVL ——');
{
  const valid = {
    root: 'n2',
    nodes: {
      n2: { id: 'n2', key: 20, left: 'n1', right: 'n3', height: 2 },
      n1: { id: 'n1', key: 10, left: null, right: null, height: 1 },
      n3: { id: 'n3', key: 30, left: null, right: null, height: 1 }
    }
  };
  expect('合法 AVL 通过（含 BST）', validateAVL(valid), true);

  const unbalanced = {
    root: 'n3',
    nodes: {
      n3: { id: 'n3', key: 30, left: 'n2', right: null, height: 3 },
      n2: { id: 'n2', key: 20, left: 'n1', right: null, height: 2 },
      n1: { id: 'n1', key: 10, left: null, right: null, height: 1 }
    }
  };
  expect('失衡链被捕获（平衡因子 +2）', validateAVL(unbalanced), false, ['avl-balance']);

  const badHeight = {
    root: 'n1',
    nodes: {
      n1: { id: 'n1', key: 10, left: null, right: 'n2', height: 1 },
      n2: { id: 'n2', key: 20, left: null, right: null, height: 1 }
    }
  };
  expect('height 与子树不一致被捕获', validateAVL(badHeight), false, ['height-consistency']);

  const noHeight = {
    root: 'n1',
    nodes: { n1: { id: 'n1', key: 10, left: null, right: null } }
  };
  expect('缺少 height 字段被捕获', validateAVL(noHeight), false, ['height-missing']);
}

console.log('—— validateCircularQueue ——');
{
  // 牺牲单元方案：cap=5，空队列 front==rear
  expect('sacrifice 空队列合法', validateCircularQueue({ capacity: 5, front: 0, rear: 0, mode: 'sacrifice', values: [null, null, null, null, null] }), true);
  // 满队列：(rear+1)%cap==front
  expect('sacrifice 满队列被标记（元素 5 个时 (5+1)%5==1）', validateCircularQueue({ capacity: 5, front: 1, rear: 5, mode: 'sacrifice', values: [null, 1, 2, 3, 4] }), false, ['full', 'index-range']);
  // count 方案：size 与槽位一致（front=2 起连续 3 个元素落在索引 2,3,4）
  expect('count 队列元素一致', validateCircularQueue({ capacity: 5, front: 2, rear: 4, size: 3, mode: 'count', values: [null, null, 7, 8, 9] }), true);
  expect('count 队列 size 与槽位不符被捕获', validateCircularQueue({ capacity: 5, front: 0, rear: 2, size: 4, mode: 'count', values: [1, 2, null, null, null] }), false, ['contents-count']);
  expect('capacity 非法被拒绝', validateCircularQueue({ capacity: 0, front: 0, rear: 0, mode: 'count', size: 0 }), false, ['capacity']);
  expect('索引越界被捕获', validateCircularQueue({ capacity: 5, front: 6, rear: 0, mode: 'count', size: 0 }), false, ['index-range']);
}

console.log('—— validateLinkedList ——');
{
  const mk = (pairs) => { const nodes = {}; pairs.forEach(([id, value, next]) => { nodes[id] = { id, value, next }; }); return nodes; };
  const valid = { head: 'n1', nodes: mk([['n1', 18, 'n2'], ['n2', 27, 'n3'], ['n3', 35, null]]) };
  expect('合法链表通过', validateLinkedList(valid), true);

  const cycle = { head: 'n1', nodes: mk([['n1', 18, 'n2'], ['n2', 27, 'n1']]) };
  expect('自环/环被捕获', validateLinkedList(cycle), false, ['cycle']);

  const broken = { head: 'n1', nodes: mk([['n1', 18, 'n2'], ['n2', 27, 'n3'], ['n3', 35, null], ['n4', 99, null]]) };
  expect('悬空结点被捕获', validateLinkedList(broken), false, ['unreachable']);

  const multiParent = { head: 'n1', nodes: mk([['n1', 18, 'n3'], ['n2', 27, 'n3'], ['n3', 35, null]]) };
  expect('多前驱引用被捕获', validateLinkedList(multiParent), false, ['multi-parent']);

  const lenMismatch = { head: 'n1', length: 5, nodes: mk([['n1', 18, 'n2'], ['n2', 27, null]]) };
  expect('长度不一致被捕获', validateLinkedList(lenMismatch), false, ['length-mismatch']);

  const badRef = { head: 'n1', nodes: mk([['n1', 18, 'ghost']]) };
  expect('next 引用悬空被捕获', validateLinkedList(badRef), false, ['next-ref']);
}

console.log('—— validateRedBlack ——');
{
  const ok = {
    root: 'n2',
    nodes: {
      n2: { id: 'n2', key: 20, color: 'black', left: 'n1', right: 'n3' },
      n1: { id: 'n1', key: 10, color: 'red', left: null, right: null },
      n3: { id: 'n3', key: 30, color: 'red', left: null, right: null }
    }
  };
  expect('合法红黑树通过', validateRedBlack(ok), true);

  const rootRed = { ...ok, nodes: { ...ok.nodes, n2: { ...ok.nodes.n2, color: 'red' } } };
  expect('根结点为红色被捕获', validateRedBlack(rootRed), false, ['root-red']);

  const doubleRed = {
    root: 'n3',
    nodes: {
      n3: { id: 'n3', key: 30, color: 'black', left: 'n2', right: null },
      n2: { id: 'n2', key: 20, color: 'red', left: 'n1', right: null },
      n1: { id: 'n1', key: 10, color: 'red', left: null, right: null }
    }
  };
  expect('连续红结点被捕获', validateRedBlack(doubleRed), false, ['red-child']);

  const bhMismatch = {
    root: 'n2',
    nodes: {
      n2: { id: 'n2', key: 20, color: 'black', left: 'n1', right: 'n3' },
      n1: { id: 'n1', key: 10, color: 'red', left: 'n0', right: null },
      n0: { id: 'n0', key: 5, color: 'black', left: null, right: null },
      n3: { id: 'n3', key: 30, color: 'black', left: null, right: null }
    }
  };
  expect('左右黑高不一致被捕获', validateRedBlack(bhMismatch), false, ['black-height']);

  const bstBad = {
    root: 'n2',
    nodes: {
      n2: { id: 'n2', key: 20, color: 'black', left: 'n1', right: null },
      n1: { id: 'n1', key: 25, color: 'red', left: null, right: null }
    }
  };
  expect('BST 有序性破坏被捕获', validateRedBlack(bstBad), false, ['bst-order']);
}

console.log('—— validateBTree ——');
{
  // 2-3 树（m=3）：根 [20]，两个孩子 [10] [30,40]
  const ok = {
    m: 3,
    root: 'r',
    nodes: {
      r: { id: 'r', keys: [20], children: ['l', 'rl'] },
      l: { id: 'l', keys: [10], children: [] },
      rl: { id: 'rl', keys: [30, 40], children: [] }
    }
  };
  expect('合法 2-3 树通过', validateBTree(ok), true);

  const under = {
    m: 3, root: 'r',
    nodes: { r: { id: 'r', keys: [20], children: ['l', 'rl'] }, l: { id: 'l', keys: [], children: [] }, rl: { id: 'rl', keys: [30, 40], children: [] } }
  };
  expect('下溢结点被捕获', validateBTree(under), false, ['empty-node']);

  const overflow = {
    m: 3, root: 'r',
    nodes: { r: { id: 'r', keys: [20, 30, 40], children: [] } }
  };
  expect('上溢结点被捕获（3 个关键字 > 2）', validateBTree(overflow), false, ['overflow']);

  const order = {
    m: 3, root: 'r',
    nodes: { r: { id: 'r', keys: [30, 20], children: [] } }
  };
  expect('关键字无序被捕获', validateBTree(order), false, ['key-order']);

  const range = {
    m: 3, root: 'r',
    nodes: { r: { id: 'r', keys: [20], children: ['l', 'rl'] }, l: { id: 'l', keys: [25], children: [] }, rl: { id: 'rl', keys: [30], children: [] } }
  };
  expect('子树关键字越界被捕获（25 > 20）', validateBTree(range), false, ['range']);

  const childCount = {
    m: 3, root: 'r',
    nodes: { r: { id: 'r', keys: [20], children: ['l'] }, l: { id: 'l', keys: [10], children: [] } }
  };
  expect('子树数 ≠ 关键字数+1 被捕获', validateBTree(childCount), false, ['child-count']);
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
if (fail > 0) {
  console.error('失败用例：', failures.join(', '));
  process.exit(1);
}
process.exit(0);
