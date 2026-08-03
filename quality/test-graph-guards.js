#!/usr/bin/env node
/**
 * test-graph-guards.js — 图算法异常输入门禁测试（I4-C 验收）
 *
 * 对照计划书工作流 E 验收标准：
 *   - Dijkstra：负权边拒绝执行（贪心前提被破坏），推荐 Bellman-Ford
 *   - 拓扑排序：含环时输出环路径证据并拒绝
 *   - Floyd：负环检测（dist[i][i] < 0）
 *   - 可构造输入触发（边列表语法 'A-B:-2'）
 *   - 默认输入不回归
 *
 * 运行：node quality/test-graph-guards.js   退出码 0=通过
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
['modules.js', 'algorithms.js', 'code-library.js', 'operations.js',
  'quality/validators/validateBST.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
});
const W = sandbox.window;
const M = (id) => W.ALGORA_MODULES.find((x) => x.id === id);

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? '  → ' + detail : ''}`); }
}

console.log('—— Dijkstra 负权拒绝 ——');
{
  const d = W.buildTrace(M('dijkstra'), 'A-B:2,B-C:-3,C-D:1');
  const last = d.frames[d.frames.length - 1];
  check('检测到负权边并说明前提', /负权/.test(d.frames.map((f) => f.message).join(' ')));
  check('拒绝执行并推荐 Bellman-Ford', /Bellman-Ford/.test(d.frames.map((f) => f.message).join(' ')));
  check('负权边高亮（activeEdges 含负权边）', d.frames.some((f) => f.visual.activeEdges && f.visual.activeEdges.some((e) => e.join('-') === 'B-C')));

  const ok = W.buildTrace(M('dijkstra'), 'A-B:2,B-C:3,C-D:1');
  check('非负权输入正常执行（无拒绝帧）', !ok.frames.some((f) => /拒绝/.test(f.message)) && ok.frames.length > 5);
}

console.log('—— 拓扑排序环证据 ——');
{
  const t = W.buildTrace(M('topological-sort'), 'A-B:1,B-C:1,C-A:1,D-A:1');
  const last = t.frames[t.frames.length - 1];
  check('检测到环并输出环路径证据', /检测到环/.test(last.message) && typeof last.visual.cyclePath === 'string' && last.visual.cyclePath.length > 0,
    last.visual.cyclePath);
  check('环路径首尾相连（A→…→A）', /^A→/.test(last.visual.cyclePath || '') && /→A$/.test(last.visual.cyclePath || ''), last.visual.cyclePath);

  const ok = W.buildTrace(M('topological-sort'), 'A-B:1,B-C:1,C-D:1');
  check('无环输入正常输出拓扑序', /无环/.test(ok.frames[ok.frames.length - 1].message));
}

console.log('—— Floyd 负环检测 ——');
{
  const f = W.buildTrace(M('floyd'), 'A-B:1,B-C:-4,C-A:1');
  check('检测到负环（dist[i][i] < 0）', /负环/.test(f.frames[f.frames.length - 1].message));
  check('负环结点对角高亮', JSON.stringify(f.frames[f.frames.length - 1].visual.active) === '[[0,0],[1,1],[2,2]]');
  const ok = W.buildTrace(M('floyd'), 'A-B:1,B-C:2,C-A:3');
  check('无负环输入正常', !/负环/.test(ok.frames.map((x) => x.message).join(' ')));
}

console.log('—— 默认输入不回归 ——');
{
  check('Dijkstra 默认图正常', W.buildTrace(M('dijkstra'), '').frames.length > 5);
  check('拓扑默认 DAG 正常', /无环/.test(W.buildTrace(M('topological-sort'), '').frames.slice(-1)[0].message));
  check('Floyd 默认图正常', !/负环/.test(W.buildTrace(M('floyd'), '').frames.map((x) => x.message).join(' ')));
  check('Bellman-Ford 默认正常', W.buildTrace(M('bellman-ford'), '').frames.length > 3);
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
