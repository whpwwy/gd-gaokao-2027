// 数据可行性验证: gaokao-pro college-groups 对本项目(广东物理类)院校/专业组的覆盖率
// 只读 miniprogram/data/*.js, 产出 data/gaokao-pro_group-majors.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const GROUPS_DIR = path.join(root, '.tmp-gaokao-pro', 'cli', 'data', 'college-groups');
const OUT_FILE = path.join(root, 'data', 'gaokao-pro_group-majors.json');

// ---------- 1. 本项目数据 ----------
const schools = require(path.join(root, 'miniprogram', 'data', 'schools.js'));
const admissions = require(path.join(root, 'miniprogram', 'data', 'admissions.js'));

const schoolByCode = new Map(); // code -> {name, level, region, city, flags}
for (const r of schools.rows) schoolByCode.set(String(r[0]), { name: r[1], level: r[4], region: r[2], city: r[3], flags: r[8] ?? 0 });
const schoolCodes = new Set(schoolByCode.keys());

// 本项目录取表中的 (院校,专业组) 组合
const admPairs = new Set(); // "code|group"
const admSchools = new Set();
for (const s of admissions.schools) {
  admSchools.add(String(s.c));
  for (const row of s.a) admPairs.add(`${s.c}|${String(row[1])}`);
}
console.log(`[本项目] schools.js 院校 ${schools.rows.length} 所(本科 ${[...schoolByCode.values()].filter(v => v.level === 1).length} / 专科 ${[...schoolByCode.values()].filter(v => v.level === 2).length})`);
console.log(`[本项目] admissions.js 院校 ${admSchools.size} 所, (院校,专业组)组合 ${admPairs.size} 个`);

// ---------- 2. school-index 名称->代码 ----------
const idxRaw = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, 'data', 'gaokao-pro_school-index.json.gz'))).toString('utf8'));
const nameToCodes = new Map(); // name -> Set(zs_code)
for (const r of idxRaw.rows) {
  const nm = String(r.name).trim();
  if (!nameToCodes.has(nm)) nameToCodes.set(nm, new Set());
  nameToCodes.get(nm).add(String(r.zs_code));
}
console.log(`[school-index] 共 ${idxRaw.rows.length} 行, ${nameToCodes.size} 个不同校名`);

// ---------- 3. 解析 college-groups ----------
const normCode = (raw) => {
  if (raw == null) return '';
  // 去掉全角/半角括号及空白, 只保留数字
  return String(raw).replace(/[（）()\s　]/g, '').replace(/\D/g, '');
};

// college-groups 结构不统一, 兼容处理:
//  校名: university | uni | _university | meta.uni
//  省份数组元素: province_name | province ; 对象形式: key 为 '广东'/'guangdong'/'44' 或 value.name==='广东'
//  组码: sg_name('（204）') 优先于 group_code(可能是 '204'/'（222）'/内部ID)
//  专业列表: majors(sp_name|name) | items(sp_name)
const schoolName = (d) => {
  const raw = d.university || d.uni || d._university || (d.meta && (d.meta.uni || d.meta.name)) || '';
  if (raw && typeof raw === 'object') return String(raw.name || raw.university || raw.uni || '').trim();
  return String(raw || '').trim();
};
function gdGroupsOf(d) {
  const p = d.provinces;
  if (!p) return null;
  if (Array.isArray(p)) {
    const e = p.find(x => x && (x.province_name === '广东' || x.province === '广东' || x.name === '广东'));
    return e && Array.isArray(e.groups) ? e.groups : null;
  }
  const key = ['广东', 'guangdong', 'Guangdong', '44'].find(k => p[k]);
  const e = key ? p[key] : Object.values(p).find(v => v && v.name === '广东');
  return e && Array.isArray(e.groups) ? e.groups : null;
}
const groupRawCode = (g) => g.sg_name ?? g.group_code ?? g.code;
const groupMajors = (g) => {
  const list = g.majors || g.items || [];
  const out = [];
  for (const m of list) { const n = m.sp_name || m.name || m.spname; if (n) out.push(n); }
  return out;
};

const files = fs.readdirSync(GROUPS_DIR).filter(f => f.endsWith('.json'));
console.log(`[gaokao-pro] college-groups 文件 ${files.length} 个`);

const gdSchools = [];            // {file, name, fileZsCode, groups:Map(code->Set(majors))}
const rawCodeSamples = new Set();
let skippedNoGD = 0;
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(GROUPS_DIR, f), 'utf8'));
  const name = schoolName(d);
  const gdGroups = gdGroupsOf(d);
  if (!gdGroups || gdGroups.length === 0) { skippedNoGD++; continue; }
  const groups = new Map();       // code -> Set(majors)  (全部科类合并)
  const groupsPhy = new Set();    // 仅物理类组码
  for (const g of gdGroups) {
    rawCodeSamples.add(groupRawCode(g));
    const code = normCode(groupRawCode(g));
    if (!code) continue;
    if (!groups.has(code)) groups.set(code, new Set());
    const set = groups.get(code);
    for (const n of groupMajors(g)) set.add(n);
    const track = String(g.track_name || g.track || '');
    if (track.includes('物理')) groupsPhy.add(code);
  }
  gdSchools.push({ file: f, name, fileZsCode: String(d.zs_code || d.zs_code_guobiao || (d.meta && (d.meta.zs_code_guobiao || d.meta.zs_code)) || '') || null, groups, groupsPhy });
}
console.log(`[gaokao-pro] 广东有数据的院校 ${gdSchools.length} 所(无广东数据跳过 ${skippedNoGD})`);
console.log(`[gaokao-pro] 广东共 ${gdSchools.reduce((a, s) => a + s.groups.size, 0)} 个专业组(纯数字code)`);

// ---------- 4. 名称匹配 ----------
let matched = 0, multiCode = 0;
const unmatchedNames = [];      // gaokao-pro 里有但映射不到本项目代码的
const multiCodeNames = [];
const result = {};              // code -> { groupCode -> [majors] }
const resultPhy = {};           // code -> Set(groupCode) 仅物理类
for (const s of gdSchools) {
  const codes = nameToCodes.get(s.name);
  let code = null;
  if (codes && codes.size === 1) code = [...codes][0];
  else if (codes && codes.size > 1) { multiCode++; multiCodeNames.push(`${s.name} -> ${[...codes].join(',')}`); code = [...codes][0]; }
  if (!code || !schoolCodes.has(code)) {
    unmatchedNames.push(`${s.name || s.file}${code ? `(索引代码${code}不在本项目)` : ''}`);
    continue;
  }
  matched++;
  if (!result[code]) { result[code] = {}; resultPhy[code] = new Set(); }
  for (const [gc, majors] of s.groups) {
    if (!result[code][gc]) result[code][gc] = [];
    const merged = new Set([...result[code][gc], ...majors]);
    result[code][gc] = [...merged];
  }
  for (const gc of s.groupsPhy) resultPhy[code].add(gc);
}
console.log(`[匹配] 名称精确匹配到本项目院校代码: ${matched}/${gdSchools.length} (${(matched / gdSchools.length * 100).toFixed(1)}%)`);
if (multiCodeNames.length) console.log(`[匹配] 一名多码 ${multiCode} 个: ${multiCodeNames.slice(0, 5).join(' ; ')}`);
console.log(`[匹配] 未匹配 ${unmatchedNames.length} 所: ${unmatchedNames.slice(0, 15).join(' ; ')}`);

// ---------- 5. 覆盖率 ----------
const coveredSchools = new Set(Object.keys(result));
const coveredPairs = new Set();
for (const [code, groups] of Object.entries(result))
  for (const gc of Object.keys(groups)) coveredPairs.add(`${code}|${gc}`);

// 按院校层次拆分 admissions 侧
const stats = { 1: { schools: 0, pairs: 0, hitSchools: 0, hitPairs: 0 }, 2: { schools: 0, pairs: 0, hitSchools: 0, hitPairs: 0 } };
for (const c of admSchools) {
  const lv = schoolByCode.get(c)?.level ?? 1;
  stats[lv].schools++;
  if (coveredSchools.has(c)) stats[lv].hitSchools++;
}
for (const p of admPairs) {
  const lv = schoolByCode.get(p.split('|')[0])?.level ?? 1;
  stats[lv].pairs++;
  if (coveredPairs.has(p)) stats[lv].hitPairs++;
}
const pct = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : 'n/a';

// ---- 物理类口径统计 ----
const coveredPairsPhy = new Set();
for (const [code, set] of Object.entries(resultPhy))
  for (const gc of set) coveredPairsPhy.add(`${code}|${gc}`);
const hitPairsAny = [...admPairs].filter(p => coveredPairs.has(p)).length;
const hitPairsPhy = [...admPairs].filter(p => coveredPairsPhy.has(p)).length;

// ---- 分年份口径: 组码跨年可能变, 2025 数据对 2025 行直接命中, 对 2024 行按 ±1 近似 ----
const yearStats = {}; // year -> {total, hit, hitAdj}
for (const s of admissions.schools) {
  const c = String(s.c);
  if (!result[c]) continue;
  for (const row of s.a) {
    const year = admissions.years[row[0]];
    const gc = String(row[1]);
    if (gc === '-') continue;
    yearStats[year] = yearStats[year] || { total: 0, hit: 0, hitAdj: 0 };
    yearStats[year].total++;
    if (result[c][gc]) { yearStats[year].hit++; yearStats[year].hitAdj++; }
    else if (result[c][String(Number(gc) - 1)] || result[c][String(Number(gc) + 1)]) yearStats[year].hitAdj++;
  }
}

console.log('\n========== 覆盖率报告 ==========');
console.log(`本项目录取表院校 ${admSchools.size} 所, 被命中 ${coveredSchools.size} 所 (${pct(coveredSchools.size, admSchools.size)})`);
console.log(`本项目(院校,专业组) ${admPairs.size} 个, 被命中 ${hitPairsAny} 个 (${pct(hitPairsAny, admPairs.size)}); 其中按物理类组码严格口径 ${hitPairsPhy} 个 (${pct(hitPairsPhy, admPairs.size)})`);
for (const [lv, label] of [[1, '本科'], [2, '专科']]) {
  const s = stats[lv];
  console.log(`  [${label}] 院校 ${s.hitSchools}/${s.schools} (${pct(s.hitSchools, s.schools)}), 专业组 ${s.hitPairs}/${s.pairs} (${pct(s.hitPairs, s.pairs)})`);
}

// 未被覆盖的院校(按名称列出10个)
const uncovered = [...admSchools].filter(c => !coveredSchools.has(c)).map(c => `${schoolByCode.get(c)?.name ?? c}${schoolByCode.get(c)?.level === 2 ? '[专科]' : ''}`);
console.log(`\n未覆盖院校共 ${uncovered.length} 所, 示例10个: ${uncovered.slice(0, 10).join('、')}`);

// 命中院校但组码缺失的情况: 已覆盖院校里, admissions 组码在 gaokao-pro 中不存在的数量
let missPairsInHitSchools = 0;
for (const c of coveredSchools) if (admSchools.has(c))
  for (const row of (admissions.schools.find(s => String(s.c) === c)?.a || [])) {
    const gc = String(row[1]);
    if (gc !== '-' && !result[c][gc]) missPairsInHitSchools++;
  }
console.log(`已覆盖院校中组码未命中的(院校,组) ${missPairsInHitSchools} 个(多为 "-" 或历史组码/年份差异)`);
const dashPairs = [...admPairs].filter(p => p.endsWith('|-')).length;
console.log(`其中本项目组码为 "-" 的组合共 ${dashPairs} 个(占 ${pct(dashPairs, admPairs.size)}, 无法按组码命中)`);

// 广东本地院校缺口
const gdRegions = ['广东', '广州', '深圳', '珠海', '汕头', '佛山', '韶关', '湛江', '肇庆', '江门', '茂名', '惠州', '梅州', '汕尾', '河源', '阳江', '清远', '东莞', '中山', '潮州', '揭阳', '云浮'];
const isGdSchool = (code) => {
  const r = schoolByCode.get(code);
  return r && (gdRegions.includes(r.region) || gdRegions.includes(r.city));
};
const admGd = [...admSchools].filter(isGdSchool);
const hitGd = [...coveredSchools].filter(isGdSchool);
const admGdPairs = [...admPairs].filter(p => isGdSchool(p.split('|')[0]));
const hitGdPairs = admGdPairs.filter(p => coveredPairs.has(p));
console.log(`\n广东本地院校: ${admGd.length} 所, 命中 ${hitGd.length} 所 (${pct(hitGd.length, admGd.length)}); 专业组 ${hitGdPairs.length}/${admGdPairs.length} (${pct(hitGdPairs.length, admGdPairs.length)})`);

// 分年份命中明细
console.log('\n[分年份] 已覆盖院校内非"-"组的命中(精确 / 含±1近似):');
for (const y of Object.keys(yearStats).sort()) {
  const s = yearStats[y];
  console.log(`  ${y}: ${s.hit}/${s.total} (${pct(s.hit, s.total)}) / ±1后 ${s.hitAdj}/${s.total} (${pct(s.hitAdj, s.total)})`);
}

// 985/211 缺口
const is985 = (code) => ((schoolByCode.get(code)?.flags ?? 0) & 1) !== 0;
const is211 = (code) => ((schoolByCode.get(code)?.flags ?? 0) & 2) !== 0;
for (const [test, label] of [[is985, '985'], [is211, '211']]) {
  const all = [...admSchools].filter(test);
  const hit = all.filter(c => coveredSchools.has(c));
  const allP = [...admPairs].filter(p => test(p.split('|')[0]));
  const hitP = allP.filter(p => coveredPairs.has(p));
  console.log(`${label} 院校: ${all.length} 所, 命中 ${hit.length} 所 (${pct(hit.length, all.length)}); 专业组 ${hitP.length}/${allP.length} (${pct(hitP.length, allP.length)})`);
}

// ---------- 6. 写中间产物 ----------
fs.writeFileSync(OUT_FILE, JSON.stringify(result), 'utf8');
const outGroups = Object.values(result).reduce((a, g) => a + Object.keys(g).length, 0);
console.log(`\n[产出] ${path.relative(root, OUT_FILE)} 已写入: ${Object.keys(result).length} 所院校, ${outGroups} 个专业组 (${(fs.statSync(OUT_FILE).size / 1024).toFixed(0)}KB)`);
