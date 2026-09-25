// 构建产物 subjects.js 的类型声明（由数据格式约定，手工维护）
/** [level, categoryIdx, first, mode, subjectIdxs[], majorIdx[]] */
export type RawSubjectRow = [number, number, number, number, number[], number[]];
declare const data: {
  v: number;
  /** 再选科目字典 */
  subjects: string[];
  /** 专业(类)名称字典：专业类名与具体专业名共用 */
  majors: string[];
  schools: { c: string; items: RawSubjectRow[] }[];
};
export = data;
