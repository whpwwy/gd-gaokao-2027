#!/usr/bin/env node
/**
 * 高考数据构建脚本
 * 读取 data/ 内原始 CSV / gzip → 清洗归一化 → 输出小程序紧凑数据文件
 *
 * 用法: node scripts/build-data.mjs
 * 仅依赖 Node.js 内置模块 (fs/path/zlib)，Node >= 18
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_DIR = resolve(ROOT, 'data');
const OUT_DIR = resolve(ROOT, 'miniprogram', 'data');
const SUBPKG_DIR = resolve(ROOT, 'miniprogram', 'subpkg', 'data');

// ---------------------------------------------------------------------------
// 通用工具
// ---------------------------------------------------------------------------

/** 支持双引号字段的简易 CSV 解析 */
function parseCsv(text) {
  // 去 BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\n') {
      pushField(); pushRow();
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  pushField(); pushRow();
  // 去掉末尾空行
  while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
  return rows;
}

function readCsv(name) {
  const table = parseCsv(readFileSync(resolve(DATA_DIR, name), 'utf8'));
  const header = table.shift();
  return table.map((cols) => {
    const obj = {};
    header.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
    return obj;
  });
}

/** 解析 "683以上" / "178以内" / 普通数字 / 空值 */
function parseScoreOrRank(raw) {
  const v = (raw ?? '').trim();
  if (v === '') return { value: null, capped: false };
  const capped = /以上|以内/.test(v);
  const num = parseInt(v.replace(/[^\d]/g, ''), 10);
  if (Number.isNaN(num)) return { value: null, capped: false };
  return { value: num, capped };
}

/** 选科再选要求归一化: [mode, subjects[]]  mode: 0 不提要求 / 1 全部必选 */
const SUBJECT_ALIAS = {
  '思想政治': '思想政治', '政治': '思想政治',
  '化学': '化学', '生物': '生物', '地理': '地理',
  '物理': '物理', '历史': '历史', '技术': '技术',
};
function parseReselect(raw, warnings) {
  const v = (raw ?? '').trim();
  if (v === '' || v === '不提科目要求') return [0, []];
  // "化学(1门科目考生必须选考方可报考)"
  let m = v.match(/^(.+?)\(1门科目考生必须选考方可报考\)$/);
  if (m) {
    const s = SUBJECT_ALIAS[m[1].trim()] ?? m[1].trim();
    return [1, [s]];
  }
  // "化学,生物(2门科目考生均须选考方可报考)"
  m = v.match(/^(.+?)\(2门科目考生均须选考方可报考\)$/);
  if (m) {
    return [1, m[1].split(',').map((s) => SUBJECT_ALIAS[s.trim()] ?? s.trim())];
  }
  warnings.push(`未识别再选要求: ${v}`);
  // 兜底：按科目名直接提取
  const found = Object.keys(SUBJECT_ALIAS).filter((s) => v.includes(s));
  return found.length ? [1, [...new Set(found.map((s) => SUBJECT_ALIAS[s]))]] : [0, []];
}

function writeJsModule(filePath, obj) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, '// 此文件由 scripts/build-data.mjs 自动生成，请勿手动修改\nmodule.exports = ' +
    JSON.stringify(obj) + ';\n', 'utf8');
}

function sizeOf(filePath) {
  return readFileSync(filePath).length;
}
function fmtKB(n) { return (n / 1024).toFixed(1) + ' KB'; }

// ---------------------------------------------------------------------------
// 1. 读取原始数据
// ---------------------------------------------------------------------------
console.log('▶ 读取原始数据 ...');
const admissionsRaw = readCsv('广东高考物理类(2021-2026)高校录取分数.csv');
const rankRaw = readCsv('物理类一分一段表(2021-2026)总表.csv');
const subjectsRaw = readCsv('院校专业选科要求.csv');
const supplementRows = readCsv('院校属性补充表.csv');

const indexGz = readFileSync(resolve(DATA_DIR, 'gaokao-pro_school-index.json.gz'));
const schoolIndex = JSON.parse(gunzipSync(indexGz).toString('utf8'));

// 专业组代码 → 组内专业名列表（gaokao-pro college-groups，2025年招生计划口径，MIT许可）
// 存在性不强制：缺失时对应专业组仅显示代码，不崩溃
let groupMajorsMap = {};
try {
  const raw = readFileSync(resolve(DATA_DIR, 'gaokao-pro_group-majors.json'), 'utf8');
  groupMajorsMap = JSON.parse(raw);
  const totalGroups = Object.values(groupMajorsMap).reduce((n, o) => n + Object.keys(o).length, 0);
  console.log(`  ✓ 专业组映射: ${Object.keys(groupMajorsMap).length} 校 / ${totalGroups} 组`);
} catch {
  console.log('  ⚠ 未找到 gaokao-pro_group-majors.json，专业组将仅显示代码');
}

// ---------------------------------------------------------------------------
// 2. 构建院校属性表 (索引 + 补充表)
// ---------------------------------------------------------------------------
console.log('▶ 构建院校属性表 ...');
const indexByCode = new Map(schoolIndex.rows.map((r) => [r.zs_code, r]));
const supplementByCode = new Map(supplementRows.map((r) => [r['院校代码'], r]));

// 以录取表出现过的院校代码为准
const allCodes = [...new Set(admissionsRaw.map((r) => r['院校代码']))].sort();

// 院校行: [code,name,region,city,level,type,nature,belong,flags]
// level: 1 本科 / 2 专科 ; flags: bit0 985, bit1 211, bit2 双一流
const schoolRows = allCodes.map((code) => {
  const hit = indexByCode.get(code);
  const sup = supplementByCode.get(code);
  if (hit) {
    let flags = 0;
    if (hit.f985) flags |= 1;
    if (hit.f211) flags |= 2;
    if (hit.dual_class === '双一流') flags |= 4;
    return [code, hit.name, hit.province, hit.city || hit.province,
      hit.level === '专科' ? 2 : 1, hit.type || '', hit.nature || '', hit.belong || '', flags];
  }
  if (sup) {
    let flags = 0;
    if (sup['985'] === '1') flags |= 1;
    if (sup['211'] === '1') flags |= 2;
    if (sup['双一流'] === '1') flags |= 4;
    return [code, sup['院校名称'], sup['省份'], sup['城市'],
      sup['层次'] === '专科' ? 2 : 1, sup['院校类型'], sup['办学性质'], sup['隶属'], flags];
  }
  throw new Error(`院校代码 ${code} 在索引和补充表中均缺失`);
});

const schoolMap = new Map(schoolRows.map((r) => [r[0], r]));

// ---------------------------------------------------------------------------
// 3. 构建录取记录表
// ---------------------------------------------------------------------------
console.log('▶ 构建录取记录表 ...');
const years = [...new Set(admissionsRaw.map((r) => parseInt(r['年份'], 10)))].sort((a, b) => a - b);
const yearIdx = new Map(years.map((y, i) => [String(y), i]));

// 按校分组: { c: code, a: [[yearIdx, group, plan, admitted, minScore, minRank, flags], ...] }
const admissionsBySchool = new Map();
for (const code of allCodes) admissionsBySchool.set(code, []);

for (const r of admissionsRaw) {
  const code = r['院校代码'];
  const score = parseScoreOrRank(r['投档最低分']);
  const rank = parseScoreOrRank(r['投档最低排位']);
  const admitted = parseInt(r['投档人数'], 10);
  let flags = 0;
  if (score.capped) flags |= 1;
  if (rank.capped) flags |= 2;
  if (!Number.isFinite(admitted) || admitted === 0 || (score.value === null && rank.value === null)) flags |= 4;
  admissionsBySchool.get(code).push([
    yearIdx.get(r['年份']),
    r['专业组代码'] || '-',
    parseInt(r['计划数'], 10) || 0,
    Number.isFinite(admitted) ? admitted : 0,
    score.value,
    rank.value,
    flags,
  ]);
}
const admissionSchoolRows = allCodes.map((code) => ({ c: code, a: admissionsBySchool.get(code) }));

// 专业组 → 组内专业名列表，按 (院校, 专业组) 去重，只保留本项目实际出现的院校与组码
// 结构: { "院校代码": { "专业组代码": ["专业1", ...] } }
const groupMajorsOut = {};
let groupMajorsHitGroups = 0;
for (const code of allCodes) {
  const groups = groupMajorsMap[code];
  if (!groups) continue;
  // 只保留录取表中真实出现的组码（gaokao-pro 是2025口径，历史组码可能不存在于录取表）
  const validCodes = new Set(admissionsBySchool.get(code).map((rec) => rec[1]));
  const filtered = {};
  for (const [g, majors] of Object.entries(groups)) {
    if (validCodes.has(g) && Array.isArray(majors) && majors.length) {
      filtered[g] = majors;
      groupMajorsHitGroups++;
    }
  }
  if (Object.keys(filtered).length) groupMajorsOut[code] = filtered;
}
console.log(`  ✓ 专业组映射并入: ${Object.keys(groupMajorsOut).length} 校 / ${groupMajorsHitGroups} 组有专业列表`);

// ---------------------------------------------------------------------------
// 4. 构建一分一段表
// ---------------------------------------------------------------------------
console.log('▶ 构建一分一段表 ...');
// { '2021': [[score, count, cumulative], ...] } 分数从高到低
const rankTables = {};
for (const r of rankRaw) {
  const y = r['年份'];
  if (!rankTables[y]) rankTables[y] = [];
  rankTables[y].push([parseInt(r['分数'], 10), parseInt(r['本段人数'], 10), parseInt(r['累计人数'], 10)]);
}
for (const y of Object.keys(rankTables)) {
  rankTables[y].sort((a, b) => b[0] - a[0]);
}

// ---------------------------------------------------------------------------
// 5. 构建选科要求表 (归一化)
// ---------------------------------------------------------------------------
console.log('▶ 构建选科要求表 ...');
const warnings = [];
const subjectDict = ['化学', '生物', '思想政治', '地理', '物理', '历史', '技术'];
const subjectIdxMap = new Map(subjectDict.map((s, i) => [s, i]));

// 专业(类)名称全局字典：专业类名与具体专业名跨校去重，行内只存索引
const majorDict = [];
const majorIdxMap = new Map();
const internMajor = (name) => {
  const v = (name ?? '').trim();
  if (!v) return -1;
  let i = majorIdxMap.get(v);
  if (i === undefined) {
    i = majorDict.length;
    majorDict.push(v);
    majorIdxMap.set(v, i);
  }
  return i;
};

// 按校分组: code -> [ [level, categoryIdx, first, mode, subjectIdxs[], majorIdx[] ], ... ]
// first: 1 仅物理 / 2 物理或历史均可
const subjectBySchool = new Map();
for (const r of subjectsRaw) {
  const code = r['院校代码'];
  if (!schoolMap.has(code)) continue; // 只保留录取表中涉及的院校
  const [mode, subjects] = parseReselect(r['再选科目要求'], warnings);
  const item = [
    r['层次'] === '专科' ? 2 : 1,
    internMajor(r['专业(类)名称']),
    r['首选科目要求'] === '仅物理' ? 1 : 2,
    mode,
    subjects.map((s) => subjectIdxMap.get(s) ?? -1).filter((i) => i >= 0),
    r['包含具体专业']
      ? r['包含具体专业'].split(';').map(internMajor).filter((i) => i >= 0)
      : [],
  ];
  if (!subjectBySchool.has(code)) subjectBySchool.set(code, []);
  subjectBySchool.get(code).push(item);
}
const subjectSchoolRows = [...subjectBySchool.entries()]
  .sort((a, b) => (a[0] < b[0] ? -1 : 1))
  .map(([c, items]) => ({ c, items }));

if (warnings.length) {
  const uniq = [...new Set(warnings)];
  console.log(`  ⚠ ${uniq.length} 种未识别选科文本（已兜底处理）:`);
  uniq.slice(0, 10).forEach((w) => console.log('    ' + w));
}

// ---------------------------------------------------------------------------
// 6. 输出文件
// ---------------------------------------------------------------------------
console.log('▶ 写入数据文件 ...');
const generatedAt = new Date().toISOString();

writeJsModule(resolve(OUT_DIR, 'schools.js'), { v: 1, rows: schoolRows });
writeJsModule(resolve(OUT_DIR, 'admissions.js'), {
  v: 2, years, schools: admissionSchoolRows,
  // 专业组 → 组内专业名列表（gaokao-pro 2025口径，可选数据）
  groupMajors: groupMajorsOut,
});
writeJsModule(resolve(OUT_DIR, 'rank-tables.js'), { v: 1, tables: rankTables });
writeJsModule(resolve(SUBPKG_DIR, 'subjects.js'), {
  v: 2, subjects: subjectDict, majors: majorDict, schools: subjectSchoolRows,
});

const sources = [
  { name: '广东高校专业组投档分(2021-2026)', file: '广东高考物理类(2021-2026)高校录取分数.csv', provider: '广东省教育考试院', retrievedAt: '2026-09' },
  { name: '物理类一分一段表(2021-2026)', file: '物理类一分一段表(2021-2026)总表.csv', provider: '广东省教育考试院', retrievedAt: '2026-09' },
  { name: '院校专业选科要求(2024-2026版)', file: '院校专业选科要求.csv', provider: '广东省教育考试院', retrievedAt: '2026-09' },
  { name: '全国院校属性索引', file: 'gaokao-pro_school-index.json.gz', provider: '掌上高考(经gaokao-pro整理)', license: 'MIT', url: 'https://github.com/HA7CH/gaokao-pro', retrievedAt: '2026-09-25' },
  { name: '院校属性补充表', file: '院校属性补充表.csv', provider: '母校公开属性继承/官网', retrievedAt: '2026-09-25' },
  { name: '院校专业组包含专业(2025招生计划)', file: 'gaokao-pro_group-majors.json', provider: '掌上高考(经gaokao-pro整理)', license: 'MIT', url: 'https://github.com/HA7CH/gaokao-pro', retrievedAt: '2026-09-25' },
];

const outFiles = {
  schools: 'data/schools.js',
  admissions: 'data/admissions.js',
  rankTables: 'data/rank-tables.js',
  subjects: 'subpkg/data/subjects.js',
};
const sizes = {};
for (const [k, rel] of Object.entries(outFiles)) {
  sizes[k] = sizeOf(resolve(ROOT, 'miniprogram', rel));
}
writeJsModule(resolve(OUT_DIR, 'manifest.js'), {
  v: 1,
  version: '1.0.0',
  generatedAt,
  track: 'physics',
  trackName: '物理类',
  years,
  latestYear: years[years.length - 1],
  sources,
  files: outFiles,
  stats: {
    schools: schoolRows.length,
    admissionRecords: admissionsRaw.length,
    rankRows: rankRaw.length,
    subjectRecords: subjectSchoolRows.reduce((n, s) => n + s.items.length, 0),
    subjectSchools: subjectSchoolRows.length,
  },
});
sizes.manifest = sizeOf(resolve(OUT_DIR, 'manifest.js'));

// ---------------------------------------------------------------------------
// 7. 校验断言
// ---------------------------------------------------------------------------
console.log('▶ 执行校验断言 ...');
const assert = (cond, msg) => {
  if (!cond) { console.error('  ✗ 断言失败: ' + msg); process.exitCode = 1; }
  else console.log('  ✓ ' + msg);
};

assert(schoolRows.length === allCodes.length, `院校数 ${schoolRows.length} 与录取表代码数一致`);

// 官方数字锚点
const lookupCum = (y, score) => {
  const exact = rankTables[y].find((r) => r[0] === score);
  if (exact) return exact[2];
  // 若无该精确分数，取最接近的下一分
  const lower = rankTables[y].filter((r) => r[0] <= score).sort((a, b) => b[0] - a[0])[0];
  return lower ? lower[2] : null;
};
assert(lookupCum('2021', 432) === 222304, '2021 物理类本科线432分累计222304人');
assert(lookupCum('2026', 425) === 303919, '2026 物理类本科线425分累计303919人');

// 位次单调性：分数下降时累计人数不减
let monoOk = true;
for (const y of Object.keys(rankTables)) {
  const t = rankTables[y];
  for (let i = 1; i < t.length; i++) {
    if (t[i][2] < t[i - 1][2] || t[i][0] >= t[i - 1][0]) { monoOk = false; break; }
  }
}
assert(monoOk, '各年一分一段表分数降序、位次单调不减');

// 录取记录学校代码全部可关联
let refOk = true;
for (const s of admissionSchoolRows) {
  if (!schoolMap.has(s.c)) { refOk = false; break; }
}
assert(refOk, '全部录取记录可关联到院校属性表');

// 截断值解析检查
const cappedSchools = admissionSchoolRows
  .flatMap((s) => s.a.filter((rec) => rec[6] & 1).map((rec) => [s.c, rec[4]]));
assert(cappedSchools.length > 0 && cappedSchools.every(([, v]) => v === 683),
  `截断分数"683以上"正确解析（${cappedSchools.length}条）`);

// ---------------------------------------------------------------------------
// 8. 输出报告
// ---------------------------------------------------------------------------
const mainPkgData = sizes.schools + sizes.admissions + sizes.rankTables + sizes.manifest;
console.log('\n═══════════ 构建报告 ═══════════');
console.log('院校数:        ', schoolRows.length);
console.log('录取记录:      ', admissionsRaw.length);
console.log('一分一段行:    ', rankRaw.length);
console.log('选科要求条目:  ', subjectSchoolRows.reduce((n, s) => n + s.items.length, 0),
  `（${subjectSchoolRows.length} 校）`);
console.log('─────────── 文件体积 ───────────');
for (const [k, n] of Object.entries(sizes)) console.log(k.padEnd(12), fmtKB(n));
console.log('───────────────────────────────');
console.log('主包数据合计:  ', fmtKB(mainPkgData), mainPkgData < 2 * 1024 * 1024 ? '(<2MB ✓)' : '(超2MB ✗)');
console.log('分包 subjects:', fmtKB(sizes.subjects));
if (process.exitCode) console.log('\n✗ 构建存在校验失败，请检查');
else console.log('\n✓ 构建完成');
