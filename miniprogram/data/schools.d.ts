// 构建产物 schools.js 的类型声明（由数据格式约定，手工维护）
/** [code,name,region,city,level,type,nature,belong,flags] */
export type RawSchoolRow = [string, string, string, string, number, string, string, string, number];
declare const data: { v: number; rows: RawSchoolRow[] };
export = data;
