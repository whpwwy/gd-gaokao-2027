// 构建产物 manifest.js 的类型声明（由数据格式约定，手工维护）
declare const data: {
  v: number;
  version: string;
  generatedAt: string;
  track: string;
  trackName: string;
  years: number[];
  latestYear: number;
  sources: { name: string; file: string; provider: string; license?: string; url?: string; retrievedAt: string }[];
  stats: Record<string, number>;
};
export = data;
