#!/usr/bin/env node
/**
 * 核心算法功能与边界验证
 * 用法: node scripts/verify-logic.mjs
 * 仅依赖 Node.js 内置模块
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const MP = resolve(ROOT, 'miniprogram');
const schools = require(resolve(MP, 'data/schools.js'));
const adm = require(resolve(MP, 'data/admissions.js'));
const rt = require(resolve(MP, 'data/rank-tables.js'));

let pass = 0;
let fail = 0;
const ok = (c, m) => {
  if (c) pass++;
  else { fail++; console.log('  ✗ ' + m); }
};

// ---- 位次换算复现 ----
function rankAtScore(year, score) {
  const t = rt.tables[year];
  if (score > t[0][0]) return { rank: t[0][2], r: 'above' };
  if (score < t[t.length - 1][0]) return { rank: t[t.length - 1][2], r: 'below' };
  let lo = 0;
  let hi = t.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (t[m][0] >= score) lo = m + 1;
    else hi = m;
  }
  let i = lo;
  if (t[i][0] > score) i = Math.max(0, i - 1);
  return { rank: t[i][2], r: t[i][0] === score ? 'exact' : 'gap' };
}
function scoreAtRank(year, rank) {
  const t = rt.tables[year];
  if (rank <= t[0][2]) return t[0][0];
  if (rank > t[t.length - 1][2]) return null;
  let lo = 0;
  let hi = t.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (t[m][2] >= rank) hi = m;
    else lo = m + 1;
  }
  return t[lo][0];
}

console.log('▶ 边界测试');
ok(rankAtScore(2026, 750).r === 'above', '750分→above上界');
ok(rankAtScore(2026, 0).r === 'below', '0分→below下界');
ok(rankAtScore(2026, 600).rank > 0, '常见分数可查');

console.log('▶ 位次↔分数往返一致性');
[1000, 10000, 50000, 100000, 200000, 250000].forEach((rank) => {
  adm.years.forEach((y) => {
    const s = scoreAtRank(y, rank);
    if (s === null) return;
    const back = rankAtScore(y, s);
    const upperRow = rt.tables[y].find((r) => r[0] === s + 1);
    ok(back.rank >= rank && (!upperRow || upperRow[2] < rank),
      `${y} rank${rank}→score${s}→rank${back.rank}`);
  });
});

console.log('▶ 各年分数连续性');
adm.years.forEach((y) => {
  const t = rt.tables[y];
  const gaps = [];
  for (let i = 1; i < t.length; i++) {
    if (t[i - 1][0] - t[i][0] !== 1) gaps.push(t[i][0]);
  }
  ok(gaps.length === 0, `${y}逐分连续(缺分:${gaps.slice(0, 5)})`);
});

console.log('▶ 推荐分档复现 (rank=30000)');
const userRank = 30000;
const counts = { reach: 0, match: 0, safety: 0 };
const mRange = { reach: [0, -99], match: [99, -99], safety: [99, -99] };
adm.schools.forEach((sch) => {
  const items = sch.a
    .filter((r) => adm.years[r[0]] >= 2024 && r[5] !== null && !(r[6] & 4))
    .map((r) => ({ y: adm.years[r[0]], rank: r[5] }))
    .sort((a, b) => b.y - a.y);
  if (!items.length) return;
  const margin = (items[0].rank - userRank) / userRank;
  let tier = null;
  if (margin >= -0.15 && margin < 0) tier = 'reach';
  else if (margin >= 0 && margin < 0.2) tier = 'match';
  else if (margin >= 0.2) tier = 'safety';
  if (!tier) return;
  counts[tier]++;
  mRange[tier][0] = Math.min(mRange[tier][0], margin);
  mRange[tier][1] = Math.max(mRange[tier][1], margin);
});
console.log('  候选池: 冲%d 稳%d 保%d', counts.reach, counts.match, counts.safety);
ok(counts.reach > 0 && counts.match > 0 && counts.safety > 0, '三档均有候选');
ok(mRange.reach[0] >= -0.15 && mRange.reach[1] < 0, '冲档margin∈[-0.15,0)');
ok(mRange.match[0] >= 0 && mRange.match[1] < 0.2, '稳档margin∈[0,0.2)');
ok(mRange.safety[0] >= 0.2, '保档margin≥0.2');

console.log('▶ 筛选：计划人数 & 多地区');
function buildPool(filters) {
  const pool = [];
  adm.schools.forEach((sch) => {
    const schoolRow = schools.rows.find((r) => r[0] === sch.c);
    if (!schoolRow) return;
    if (filters.regions.length && !filters.regions.includes(schoolRow[2])) return;
    const items = sch.a
      .filter((r) => adm.years[r[0]] >= 2024 && r[5] !== null && !(r[6] & 4))
      .map((r) => ({ y: adm.years[r[0]], rank: r[5], plan: r[2] }))
      .sort((a, b) => b.y - a.y);
    if (!items.length) return;
    const ref = items[0];
    if (filters.minPlan !== null && ref.plan < filters.minPlan) return;
    pool.push({ code: sch.c, region: schoolRow[2], plan: ref.plan });
  });
  return pool;
}
const allRegions = [...new Set(schools.rows.map((r) => r[2]))].sort();
ok(allRegions.length >= 5, '地区选项正常生成: ' + allRegions.length + ' 个');
const basePool = buildPool({ regions: [], minPlan: null });
ok(basePool.length > 0, '不约束时候选组正常: ' + basePool.length);
ok(basePool.some((p) => p.plan < 50), '数据中存在计划<50的组');
const plan50 = buildPool({ regions: [], minPlan: 50 });
ok(plan50.length < basePool.length, 'minPlan=50 候选减少');
ok(plan50.every((p) => p.plan >= 50), 'minPlan=50 保留组计划均≥50');
ok(buildPool({ regions: [], minPlan: 100000 }).length === 0, 'minPlan=100000 候选归零');
const r1 = allRegions[0];
const poolR1 = buildPool({ regions: [r1], minPlan: null });
ok(poolR1.length > 0 && poolR1.every((p) => p.region === r1), '单地区("' + r1 + '")过滤生效');
const r2 = allRegions[1];
const poolR12 = buildPool({ regions: [r1, r2], minPlan: null });
ok(poolR12.length >= poolR1.length && poolR12.every((p) => p.region === r1 || p.region === r2), '多选两地区为并集');
ok(buildPool({ regions: ['__不存在__'], minPlan: null }).length === 0, '不存在地区候选归零');

console.log('▶ 数据关联完整性');
ok(schools.rows.length === new Set(schools.rows.map((r) => r[0])).size, '院校代码无重复');
let allLinked = true;
adm.schools.forEach((s) => {
  if (!schools.rows.some((r) => r[0] === s.c)) allLinked = false;
});
ok(allLinked, '录取记录全部可关联院校');

console.log('\n结果: %d 通过, %d 失败', pass, fail);
process.exit(fail ? 1 : 0);
