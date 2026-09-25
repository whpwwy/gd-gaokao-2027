// 业务领域类型定义（面向页面使用的友好结构）

/** 院校 */
export interface School {
  code: string;
  name: string;
  region: string;
  city: string;
  /** 1 本科 / 2 专科 */
  level: 1 | 2;
  /** 院校类型：综合类 / 理工类 / 师范类 ... */
  type: string;
  /** 办学性质：公办 / 民办 / 中外合作办学 */
  nature: string;
  belong: string;
  is985: boolean;
  is211: boolean;
  isDualClass: boolean;
}

/** 单年单专业组投档记录 */
export interface AdmissionRecord {
  year: number;
  /** 专业组代码 */
  group: string;
  plan: number;
  admitted: number;
  minScore: number | null;
  minRank: number | null;
  /** 分数为截断显示，如 "683以上" */
  scoreCapped: boolean;
  /** 排位为截断显示，如 "178以内" */
  rankCapped: boolean;
  /** 当年无人投档 */
  noAdmission: boolean;
  /** 该专业组包含的专业名列表（可能为空，来源于 gaokao-pro 2025招生计划） */
  majors: string[];
}

/** 专业组展示副标题：有专业列表时返回"含N个专业"，否则返回空串 */
export function formatGroupMajorsSummary(majors: string[]): string {
  return majors.length ? `含${majors.length}个专业` : '';
}

/** 一分一段表行 */
export interface RankRow {
  score: number;
  /** 本段人数 */
  count: number;
  /** 累计人数（全省位次） */
  cumulative: number;
}

/** 分数查询位次结果 */
export interface RankAtScore {
  score: number;
  rank: number;
  /** 该分数在表中精确存在 */
  exact: boolean;
  /** 超出表的上界（高分）或下界（低分） */
  outOfRange: 'above' | 'below' | null;
}

/** 某一年的同位分 */
export interface YearEquivalent {
  year: number;
  score: number | null;
  rank: number;
}

export type TierKey = 'reach' | 'match' | 'safety';

/** 推荐候选（院校专业组） */
export interface RecommendCandidate {
  school: School;
  group: string;
  /** 参考位次（近年最近一次有效位次） */
  refRank: number;
  refYear: number;
  /** 位次余量比例：(门槛位次-用户位次)/用户位次，正=用户占优 */
  margin: number;
  tier: TierKey;
  /** 参考录取概率 */
  probability: '高' | '中' | '低';
  /** 近三年位次（含年份），用于展示稳定性 */
  history: { year: number; rank: number }[];
  /** 近年位次波动幅度（0~1） */
  volatility: number;
  /** 该组当年投档分（refYear） */
  refScore: number | null;
  /** 该专业组包含的专业名列表（可能为空） */
  majors: string[];
}

export interface RecommendFilters {
  /** 院校所在省份，空数组=不限 */
  regions: string[];
  /** 层次，空数组=不限 */
  levels: (1 | 2)[];
  /** 办学性质，空数组=不限 */
  natures: string[];
  only985: boolean;
  only211: boolean;
  /** 院校名称关键词 */
  keyword: string;
  /** 专业组最少计划招生人数，null=不约束（按最近一年计划数判定） */
  minPlan: number | null;
}

export interface RecommendResult {
  rank: number;
  reach: RecommendCandidate[];
  match: RecommendCandidate[];
  safety: RecommendCandidate[];
  total: number;
}

/** 专业组代码 → 展示文本（206→"206专业组"；缺失→"未分组"） */
export function formatGroupLabel(group: string): string {
  return !group || group === '-' ? '未分组' : `${group}专业组`;
}

/** 收藏项 */
export interface FavoriteItem {
  id: string;
  /** school 院校 / group 专业组 */
  type: 'school' | 'group';
  code: string;
  group?: string;
  name: string;
  savedAt: number;
}
