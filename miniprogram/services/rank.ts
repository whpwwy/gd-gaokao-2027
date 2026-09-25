// 位次服务：分数 ↔ 全省位次换算、历年同位分
import { dataService } from './data-service';
import { RankAtScore, YearEquivalent } from './types';

/**
 * 某年某分数对应的全省位次
 * 表按分数从高到低、累计人数从小到大排列
 */
export function rankAtScore(year: number, score: number): RankAtScore {
  const table = dataService.getRankTable(year);
  if (!table.length) {
    return { score, rank: 0, exact: false, outOfRange: 'above' };
  }
  const first = table[0];
  const last = table[table.length - 1];

  if (score > first.score) {
    // 高于表中最高分：实际位次不超过首行累计人数
    return { score, rank: first.cumulative, exact: false, outOfRange: 'above' };
  }
  if (score < last.score) {
    // 低于表中最低分：位次大于末行累计人数
    return { score, rank: last.cumulative, exact: false, outOfRange: 'below' };
  }

  // 表范围内：取分数 <= score 的最高分一行（逐分表连续时即为精确行）
  let lo = 0;
  let hi = table.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (table[mid].score >= score) lo = mid + 1;
    else hi = mid;
  }
  // lo 是第一个 score < 目标分的位置；候选为 lo-1 与 lo
  let idx = lo;
  if (table[idx].score > score) idx = Math.max(0, idx - 1);
  const row = table[idx];
  return { score, rank: row.cumulative, exact: row.score === score, outOfRange: null };
}

/**
 * 某年某位考生位次对应的分数（同位分）
 * 找到累计人数首次 >= rank 的最高分一行
 * 位次超出表下界时返回 null
 */
export function scoreAtRank(year: number, rank: number): number | null {
  const table = dataService.getRankTable(year);
  if (!table.length) return null;
  if (rank <= table[0].cumulative) return table[0].score;
  if (rank > table[table.length - 1].cumulative) return null;

  let lo = 0;
  let hi = table.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (table[mid].cumulative >= rank) hi = mid;
    else lo = mid + 1;
  }
  return table[lo].score;
}

/** 以某年分数为基准，换算各年同位分 */
export function equivalentsByScore(score: number, baseYear: number): {
  base: RankAtScore;
  list: YearEquivalent[];
} {
  const base = rankAtScore(baseYear, score);
  const list = dataService.years.map((year) => ({
    year,
    score: scoreAtRank(year, base.rank),
    rank: base.rank,
  }));
  return { base, list };
}

/** 直接以位次为基准，换算各年同位分 */
export function equivalentsByRank(rank: number): YearEquivalent[] {
  return dataService.years.map((year) => ({
    year,
    score: scoreAtRank(year, rank),
    rank,
  }));
}
