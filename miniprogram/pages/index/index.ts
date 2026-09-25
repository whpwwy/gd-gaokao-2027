// 首页
import { dataService } from '../../services/data-service';
import { rankAtScore } from '../../services/rank';
import { go } from '../../services/nav';

Page({
  data: {
    latestYear: dataService.latestYear,
    years: dataService.years,
    scoreInput: '',
    quickRank: null as null | {
      rank: number;
      outOfRange: 'above' | 'below' | null;
    },
  },

  onScoreInput(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ scoreInput: e.detail.value, quickRank: null });
  },

  /** 快速查询：基于最新年份换算位次 */
  doQuickQuery() {
    const score = parseInt(this.data.scoreInput, 10);
    if (!Number.isFinite(score)) {
      wx.showToast({ title: '请输入有效分数', icon: 'none' });
      return;
    }
    if (score < 0 || score > 750) {
      wx.showToast({ title: '请输入0-750之间的分数', icon: 'none' });
      return;
    }
    const r = rankAtScore(this.data.latestYear, score);
    this.setData({ quickRank: { rank: r.rank, outOfRange: r.outOfRange } });
  },

  goRank() {
    const score = this.data.scoreInput || '';
    go(`/pages/rank/rank?score=${score}`);
  },

  goRecommend() {
    const score = this.data.scoreInput || '';
    go(`/pages/recommend/recommend?score=${score}`);
  },

  goSchoolSearch() {
    go('/pages/school-search/school-search');
  },

  goFavorites() {
    go('/pages/favorites/favorites');
  },

  goAbout() {
    go('/pages/about/about');
  },

  onShareAppMessage() {
    return {
      title: '广东省2027年高考历史信息查询推荐',
      path: '/pages/index/index',
      imageUrl: '/images/logo.png',
    };
  },

  onShareTimeline() {
    return {
      title: '广东省2027年高考历史信息查询推荐',
      imageUrl: '/images/logo.png',
    };
  },
});
