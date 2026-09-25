// 数据服务：加载构建产物，向页面/其他服务提供查询能力
import schoolsData = require('../data/schools.js');
import admissionsData = require('../data/admissions.js');
import rankTablesData = require('../data/rank-tables.js');
import manifestData = require('../data/manifest.js');
import { School, AdmissionRecord, RankRow } from './types';

// ---- 录取记录标志位 ----
const F_SCORE_CAPPED = 1;
const F_RANK_CAPPED = 2;
const F_NO_ADMISSION = 4;

// ---- 院校转换 ----
const schools: School[] = schoolsData.rows.map((r) => ({
  code: r[0],
  name: r[1],
  region: r[2],
  city: r[3],
  level: (r[4] === 2 ? 2 : 1) as 1 | 2,
  type: r[5],
  nature: r[6],
  belong: r[7],
  is985: (r[8] & 1) === 1,
  is211: (r[8] & 2) === 2,
  isDualClass: (r[8] & 4) === 4,
}));

const schoolByCode = new Map<string, School>();
schools.forEach((s) => schoolByCode.set(s.code, s));

// ---- 专业组 → 组内专业名列表（gaokao-pro 2025口径，可选数据） ----
const groupMajorsData: Record<string, Record<string, string[]>> = admissionsData.groupMajors || {};

// ---- 录取记录转换（按校） ----
const admissionsByCode = new Map<string, AdmissionRecord[]>();
admissionsData.schools.forEach((entry) => {
  const majorsByGroup = groupMajorsData[entry.c] || {};
  const records: AdmissionRecord[] = entry.a.map((rec) => ({
    year: admissionsData.years[rec[0]],
    group: rec[1],
    plan: rec[2],
    admitted: rec[3],
    minScore: rec[4],
    minRank: rec[5],
    scoreCapped: (rec[6] & F_SCORE_CAPPED) === F_SCORE_CAPPED,
    rankCapped: (rec[6] & F_RANK_CAPPED) === F_RANK_CAPPED,
    noAdmission: (rec[6] & F_NO_ADMISSION) === F_NO_ADMISSION,
    majors: majorsByGroup[rec[1]] || [],
  }));
  // 按年份升序、专业组代码升序排列
  records.sort((a, b) => (a.year !== b.year ? a.year - b.year : a.group < b.group ? -1 : a.group > b.group ? 1 : 0));
  admissionsByCode.set(entry.c, records);
});

// ---- 一分一段表转换 ----
const rankTables = new Map<number, RankRow[]>();
Object.keys(rankTablesData.tables).forEach((y) => {
  rankTables.set(Number(y), rankTablesData.tables[y].map((r) => ({ score: r[0], count: r[1], cumulative: r[2] })));
});

export const dataService = {
  /** 数据覆盖年份，升序 */
  years: admissionsData.years,
  latestYear: manifestData.latestYear,
  manifest: manifestData,

  getAllSchools(): School[] {
    return schools;
  },

  getSchool(code: string): School | undefined {
    return schoolByCode.get(code);
  },

  /** 按院校名称/代码模糊搜索 */
  searchSchools(keyword: string, limit = 50): School[] {
    const kw = keyword.trim();
    if (!kw) return schools.slice(0, limit);
    return schools
      .filter((s) => s.name.includes(kw) || s.code.includes(kw))
      .slice(0, limit);
  },

  /** 某校全部历年投档记录 */
  getAdmissions(code: string): AdmissionRecord[] {
    return admissionsByCode.get(code) || [];
  },

  /** 某年一分一段表（分数从高到低） */
  getRankTable(year: number): RankRow[] {
    return rankTables.get(year) || [];
  },

  /** 各年本科线等批次线（从一分一段表无法直接得到，保留扩展位） */
  getRankTableYears(): number[] {
    return [...rankTables.keys()].sort((a, b) => a - b);
  },
};
