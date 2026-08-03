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

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
if (fail > 0) {
  console.error('失败用例：', failures.join(', '));
  process.exit(1);
}
process.exit(0);
