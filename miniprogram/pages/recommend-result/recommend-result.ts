// 志愿推荐结果页
import { recommend } from '../../services/recommend';
import { favorites, favoriteId } from '../../services/favorites';
import { formatGroupLabel, RecommendCandidate, RecommendResult } from '../../services/types';
import { go } from '../../services/nav';

const PENDING_KEY = 'pending_recommend';

interface CandView {
  key: string;
  favKey: string;
  code: string;
  name: string;
  region: string;
  nature: string;
  group: string;
  groupLabel: string;
  /** 组内专业名预览（前若干 + 省略），空串表示无数据 */
  majorsText: string;
  refRank: number;
  refYear: number;
  refScore: number | null;
  marginText: string;
  probability: '高' | '中' | '低';
  probClass: string;
  is985: boolean;
  is211: boolean;
  isDualClass: boolean;
  historyText: string;
  fav: boolean;
}

/** 组内专业名预览：最多展示前 4 个，超出用"等N个"收尾 */
function majorsPreview(majors: string[]): string {
  if (!majors.length) return '';
  const head = majors.slice(0, 4).join('、');
  return majors.length > 4 ? `${head} 等${majors.length}个` : head;
}

function toView(c: RecommendCandidate): CandView {
  const pct = Math.round(c.margin * 100);
  const marginText = c.tier === 'reach' ? `位次差 ${Math.abs(pct)}%` : `位次余量 +${pct}%`;
  const probClass = c.probability === '高' ? 'prob-high' : c.probability === '低' ? 'prob-low' : 'prob-mid';
  const historyText = c.history
    .map((h) => `${h.year}:${h.rank}`)
    .join('  ');
  const favKey = favoriteId('group', c.school.code, c.group);
  return {
    key: c.school.code + '_' + c.group,
    favKey,
    code: c.school.code,
    name: c.school.name,
    region: c.school.region,
    nature: c.school.nature,
    group: c.group,
    groupLabel: formatGroupLabel(c.group),
    majorsText: majorsPreview(c.majors),
    refRank: c.refRank,
    refYear: c.refYear,
    refScore: c.refScore,
    marginText,
    probability: c.probability,
    probClass,
    is985: c.school.is985,
    is211: c.school.is211,
    isDualClass: c.school.isDualClass,
    historyText,
    fav: favorites.has(favKey),
  };
}

Page({
  data: {
    rank: 0,
    reach: [] as CandView[],
    match: [] as CandView[],
    safety: [] as CandView[],
    total: 0,
    hasResult: false,
    // 三个分区的折叠状态（默认全部展开）
    reachOpen: true,
    matchOpen: true,
    safetyOpen: true,
  },

  onLoad() {
    const pending = wx.getStorageSync(PENDING_KEY);
    if (!pending) {
      wx.showToast({ title: '推荐参数缺失', icon: 'none' });
      return;
    }
    const result: RecommendResult = recommend(pending.rank, pending.filters, pending.count);
    this.setData({
      rank: result.rank,
      reach: result.reach.map(toView),
      match: result.match.map(toView),
      safety: result.safety.map(toView),
      total: result.total,
      hasResult: true,
    });
  },

  goDetail(e: WechatMiniprogram.BaseEvent) {
    const code = e.currentTarget.dataset.code as string;
    go(`/subpkg/pages/school-detail/school-detail?code=${code}`);
  },

  toggleFav(e: WechatMiniprogram.BaseEvent) {
    const { code, group, name } = e.currentTarget.dataset as {
      code: string; group: string; name: string;
    };
    const nowFav = favorites.toggle('group', code, `${name}（${formatGroupLabel(group)}）`, group);
    const update = (list: CandView[]): CandView[] =>
      list.map((v) => (v.code === code && v.group === group ? { ...v, fav: nowFav } : v));
    this.setData({
      reach: update(this.data.reach),
      match: update(this.data.match),
      safety: update(this.data.safety),
    });
    wx.showToast({ title: nowFav ? '已收藏专业组' : '已取消', icon: 'none' });
  },

  goBack() {
    wx.navigateBack();
  },

  /** 点击顶部"冲/稳/保"数字：展开对应分区并平滑滚动定位过去 */
  jumpTier(e: WechatMiniprogram.BaseEvent) {
    const tier = e.currentTarget.dataset.tier as 'reach' | 'match' | 'safety';
    const count = tier === 'reach'
      ? this.data.reach.length
      : tier === 'match' ? this.data.match.length : this.data.safety.length;
    if (count === 0) return;
    const isOpen = tier === 'reach'
      ? this.data.reachOpen
      : tier === 'match' ? this.data.matchOpen : this.data.safetyOpen;
    const scroll = () => wx.pageScrollTo({
      selector: `#${tier}-section`,
      duration: 250,
    });
    if (isOpen) {
      scroll();
    } else if (tier === 'reach') {
      this.setData({ reachOpen: true }, scroll);
    } else if (tier === 'match') {
      this.setData({ matchOpen: true }, scroll);
    } else {
      this.setData({ safetyOpen: true }, scroll);
    }
  },

  /** 折叠/展开某个分区 */
  toggleTier(e: WechatMiniprogram.BaseEvent) {
    const tier = e.currentTarget.dataset.tier as 'reach' | 'match' | 'safety';
    if (tier === 'reach') {
      this.setData({ reachOpen: !this.data.reachOpen });
    } else if (tier === 'match') {
      this.setData({ matchOpen: !this.data.matchOpen });
    } else {
      this.setData({ safetyOpen: !this.data.safetyOpen });
    }
  },

  /** 专业组概念说明 */
  showGroupHelp() {
    wx.showModal({
      title: '什么是"院校专业组"？',
      content:
        '院校专业组（简称专业组）是新高考志愿填报和投档录取的基本单位。院校把选科要求相同的若干专业打包成一个专业组，并编一个代码（如206）。\n\n'
        + '填报志愿时，一个"院校+专业组"就是一个志愿；同一所大学的不同专业组，录取分数可能差别很大。\n\n'
        + '部分专业组下方会列出所含专业（数据来自2025年招生计划，仅供参考），未列出的请以当年《招生专业目录》为准。',
      showCancel: false,
      confirmText: '我知道了',
    });
  },
});
