// 构建产物 admissions.js 的类型声明（由数据格式约定，手工维护）
/** [yearIdx, group, plan, admitted, minScore, minRank, flags] */
export type RawAdmRow = [number, string, number, number, number | null, number | null, number];

declare const data: {
  /** 数据格式版本（v2 起增加 groupMajors） */
  v: number;
  years: number[];
  schools: { c: string; a: RawAdmRow[] }[];
  /** 专业组代码 → 组内专业名列表（gaokao-pro 2025口径，可选数据） */
  groupMajors?: Record<string, Record<string, string[]>>;
};
export = data;
