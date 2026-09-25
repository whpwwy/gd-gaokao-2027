// 构建产物 rank-tables.js 的类型声明（由数据格式约定，手工维护）
/** [score,count,cumulative] */
export type RawRankRow = [number, number, number];
declare const data: { v: number; tables: Record<string, RawRankRow[]> };
export = data;
