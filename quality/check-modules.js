#!/usr/bin/env node
/**
 * check-modules.js — Algora 模块清单数据完整性检查（CI 门禁：数据格式校验）
 *
 * 检查项（文档工作流 A 验收标准 + 共用质检系统）：
 *   1. 模块 id 全局唯一
 *   2. level 成熟度字段合法（L1|L2|L3|L4）且已标记（缺省记 L1 + 警告）
 *   3. category 引用存在于 ALGORA_CATEGORIES
 *   4. type 字段在合法枚举内
 *   5. title / summary / time / space / tags 非空
 *   6. demo 字段非空且唯一（渲染层定位用）
 *
 * 运行：node quality/check-modules.js   退出码 0=通过 1=存在 error
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const MODULE_TYPES = new Set(['array', 'linked', 'stack', 'queue', 'tree', 'btree', 'graph', 'hash', 'string', 'matrix', 'bars']);
const LEVELS = new Set(['L1', 'L2', 'L3', 'L4']);

// 在隔离沙箱中执行 modules.js，取出全局数据（不污染当前进程）
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'modules.js'), 'utf8'), sandbox, { filename: 'modules.js' });
const categories = sandbox.window.ALGORA_CATEGORIES || [];
const modules = sandbox.window.ALGORA_MODULES || [];

const errors = [];
const warnings = [];

// 1) id 唯一
const seen = new Map();
modules.forEach((m) => {
  if (!m.id) { errors.push(`模块缺少 id：${JSON.stringify(m.title)}`); return; }
  if (seen.has(m.id)) errors.push(`模块 id 重复："${m.id}"（${m.title} 与 ${seen.get(m.id)}）`);
  seen.set(m.id, m.title);
});

// 2) level
modules.forEach((m) => {
  if (m.level == null) { warnings.push(`模块 "${m.id}" 未标记 level，按 L1 处理（文档：必须公开标记真实完成度）`); }
  else if (!LEVELS.has(m.level)) { errors.push(`模块 "${m.id}" level="${m.level}" 非法，应为 L1-L4`); }
});

// 3) category 引用
const catIds = new Set(categories.map((c) => c.id));
modules.forEach((m) => {
  if (!catIds.has(m.category)) errors.push(`模块 "${m.id}" category="${m.category}" 不在目录中（${[...catIds].join('|')}）`);
});

// 4) type 枚举
modules.forEach((m) => {
  if (!MODULE_TYPES.has(m.type)) errors.push(`模块 "${m.id}" type="${m.type}" 不在合法枚举中（${[...MODULE_TYPES].join('|')}）`);
});

// 5) 必填字段非空
modules.forEach((m) => {
  ['title', 'summary', 'time', 'space'].forEach((f) => {
    if (!m[f] || !String(m[f]).trim()) errors.push(`模块 "${m.id}" 缺少必填字段 ${f}`);
  });
  if (!Array.isArray(m.tags) || m.tags.length === 0) errors.push(`模块 "${m.id}" tags 缺失或为空`);
});

// 6) demo 非空且唯一
const demos = new Map();
modules.forEach((m) => {
  if (!m.demo) { errors.push(`模块 "${m.id}" 缺少 demo 字段`); return; }
  if (demos.has(m.demo)) warnings.push(`模块 "${m.id}" 与 "${demos.get(m.demo)}" 共用 demo="${m.demo}"（允许共享渲染，但须确认操作语义独立）`);
  demos.set(m.demo, m.id);
});

// —— 汇总输出 ——
const levelCount = { L1: 0, L2: 0, L3: 0, L4: 0 };
modules.forEach((m) => { levelCount[m.level || 'L1']++; });

console.log(`Algora 模块清单检查（共 ${modules.length} 个模块 / ${categories.length} 个目录）`);
console.log(`成熟度分布：L1=${levelCount.L1}  L2=${levelCount.L2}  L3=${levelCount.L3}  L4=${levelCount.L4}`);
console.log(`错误 ${errors.length} · 警告 ${warnings.length}`);
errors.forEach((e) => console.log(`  [ERROR] ${e}`));
warnings.forEach((w) => console.log(`  [WARN ] ${w}`));

process.exit(errors.length > 0 ? 1 : 0);
