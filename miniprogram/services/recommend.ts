// 志愿推荐服务：等位次法 + 冲/稳/保分档
import { dataService } from './data-service';
import {
  RecommendCandidate, RecommendFilters, RecommendResult, School, TierKey,
} from './types';

// 分档阈值（相对用户位次的比例）
const REACH_MIN = -0.15;   // 低于门槛超过15%不推荐
const MATCH_MIN = 0;
const SAFETY_MIN = 0.20;
// 用于聚合的最近年份窗口
const RECENT_WINDOW = 3;

interface GroupAgg {
  school: School;
  group: string;
  refRank: number;
  refYear: number;
  refScore: number | null;
  /** 最近一年计划招生人数 */
  refPlan: number;
  /** 该专业组包含的专业名列表 */
  majors: string[];
  history: { year: number; rank: number }[];
}

function tierOf(margin: number): TierKey | null {
  if (margin < REACH_MIN) return null;
  if (margin < MATCH_MIN) return 'reach';
  if (margin < SAFETY_MIN) return 'match';
  return 'safety';
}

/** 近三年位次波动幅度（最大值-最小值）/中位值；不足两年返回 0 */
function volatilityOf(history: { year: number; rank: number }[]): number {
  if (history.length < 2) return 0;
  const ranks = history.map((h) => h.rank).sort((a, b) => a - b);
  const median = ranks[ranks.length >> 1] || 1;
  return (ranks[ranks.length - 1] - ranks[0]) / median;
}

function probabilityOf(
  tier: TierKey, margin: number, volatility: number, yearsCount: number,
): '高' | '中' | '低' {
  let p: '高' | '中' | '低';
  if (tier === 'reach') {
    p = margin >= -0.06 ? '中' : '低';
  } else if (tier === 'match') {
    p = margin >= 0.10 && volatility <= 0.25 ? '高' : '中';
  } else {
    p = margin >= 0.35 ? '高' : '中';
  }
  // 只有单年数据支撑时，不确定性大，最高只给"中"
  if (yearsCount < 2 && p === '高') p = '中';
  return p;
}

function passFilters(school: School, filters: RecommendFilters): boolean {
  if (filters.regions.length && !filters.regions.includes(school.region)) return false;
  if (filters.levels.length && !filters.levels.includes(school.level)) return false;
  if (filters.natures.length && !filters.natures.includes(school.nature)) return false;
  if (filters.only985 && !school.is985) return false;
  if (filters.only211 && !school.is211) return false;
  if (filters.keyword && !school.name.includes(filters.keyword.trim())) return false;
  return true;
}

/**
 * 主推荐入口
 * @param rank 用户全省位次（必填，由位次服务换算得到）
 * @param filters 筛选条件
 * @param count 期望志愿数量（20/40/80）
 */
export function recommend(
  rank: number,
  filters: RecommendFilters,
  count = 40,
): RecommendResult {
  if (!Number.isFinite(rank) || rank <= 0) {
    return { rank, reach: [], match: [], safety: [], total: 0 };
  }

  const latestYear = dataService.latestYear;
  const windowStart = latestYear - (RECENT_WINDOW - 1);

  // 1. 聚合"学校+专业组"近三年有效位次
  const groups: GroupAgg[] = [];
  dataService.getAllSchools().forEach((school) => {
    if (!passFilters(school, filters)) return;
    const records = dataService.getAdmissions(school.code);
    // 该院校各专业组的专业名列表（同组各年记录共享，取任一有效记录即可）
    const groupMajorsMap = new Map<string, string[]>();
    records.forEach((rec) => {
      if (!groupMajorsMap.has(rec.group)) groupMajorsMap.set(rec.group, rec.majors);
    });
    const byGroup = new Map<string, { year: number; rank: number; score: number | null; plan: number }[]>();
    records.forEach((rec) => {
      if (rec.year < windowStart) return;
      if (rec.noAdmission || rec.minRank === null) return;
      const key = rec.group;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push({
        year: rec.year, rank: rec.minRank, score: rec.minScore, plan: rec.plan,
      });
    });
    byGroup.forEach((items, group) => {
      items.sort((a, b) => b.year - a.year);
      const ref = items[0]; // 最近一年
      // 计划招生人数筛选（作用于专业组）
      if (filters.minPlan !== null && ref.plan < filters.minPlan) return;
      groups.push({
        school,
        group,
        refRank: ref.rank,
        refYear: ref.year,
        refScore: ref.score,
        refPlan: ref.plan,
        majors: groupMajorsMap.get(group) || [],
        history: items.map((it) => ({ year: it.year, rank: it.rank })),
      });
    });
  });

  // 2. 分档
  const buckets: Record<TierKey, RecommendCandidate[]> = { reach: [], match: [], safety: [] };
  groups.forEach((agg) => {
    const margin = (agg.refRank - rank) / rank;
    const tier = tierOf(margin);
    if (!tier) return;
    const volatility = volatilityOf(agg.history);
    buckets[tier].push({
      school: agg.school,
      group: agg.group,
      refRank: agg.refRank,
      refYear: agg.refYear,
      margin,
      tier,
      probability: probabilityOf(tier, margin, volatility, agg.history.length),
      history: agg.history,
      volatility,
      refScore: agg.refScore,
      majors: agg.majors,
    });
  });

  // 3. 桶内排序
  // 冲：余量从大到小（最有希望的在前）；稳/保：余量从小到大（梯度排列）
  buckets.reach.sort((a, b) => b.margin - a.margin);
  buckets.match.sort((a, b) => a.margin - b.margin);
  buckets.safety.sort((a, b) => a.margin - b.margin);

  // 4. 按配额取，缺口由其他桶补足（保底优先）
  const reachQuota = Math.round(count * 0.3);
  const safetyQuota = Math.round(count * 0.3);
  const matchQuota = count - reachQuota - safetyQuota;

  const reach = buckets.reach.slice(0, reachQuota);
  const match = buckets.match.slice(0, matchQuota);
  const safety = buckets.safety.slice(0, safetyQuota);

  let gap = count - reach.length - match.length - safety.length;
  const fillFrom = (picked: RecommendCandidate[], pool: RecommendCandidate[]): void => {
    while (gap > 0 && pool.length > picked.length) {
      picked.push(pool[picked.length]);
      gap--;
    }
  };
  fillFrom(safety, buckets.safety);
  fillFrom(match, buckets.match);
  fillFrom(reach, buckets.reach);

  return {
    rank,
    reach,
    match,
    safety,
    total: reach.length + match.length + safety.length,
  };
}

/** 默认空筛选条件 */
export function emptyFilters(): RecommendFilters {
  return {
    regions: [],
    levels: [],
    natures: [],
    only985: false,
    only211: false,
    keyword: '',
    minPlan: null,
  };
}
