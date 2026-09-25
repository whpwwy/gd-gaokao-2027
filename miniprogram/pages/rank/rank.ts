// 位次查询页
import { dataService } from '../../services/data-service';
import { equivalentsByScore } from '../../services/rank';
import { RankAtScore, YearEquivalent } from '../../services/types';
import { go } from '../../services/nav';

Page({
  data: {
    scoreInput: '',
    baseYear: dataService.latestYear,
    years: dataService.years.slice().reverse(),
    rankResult: null as RankAtScore | null,
    equivalents: [] as YearEquivalent[],
  },

  onLoad(options: { score?: string }) {
    if (options.score) this.setData({ scoreInput: options.score });
  },

  onScoreInput(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ scoreInput: e.detail.value, rankResult: null, equivalents: [] });
  },

  selectYear(e: WechatMiniprogram.TouchEvent) {
    const year = Number(e.currentTarget.dataset.year);
    this.setData({ baseYear: year, rankResult: null, equivalents: [] });
    if (this.data.scoreInput) this.doQuery();
  },

  doQuery() {
    const score = parseInt(this.data.scoreInput, 10);
    if (!Number.isFinite(score)) {
      wx.showToast({ title: '请输入有效分数', icon: 'none' });
      return;
    }
    if (score < 0 || score > 750) {
      wx.showToast({ title: '请输入0-750之间的分数', icon: 'none' });
      return;
    }
    const { base, list } = equivalentsByScore(score, this.data.baseYear);
    this.setData({ rankResult: base, equivalents: list });
  },

  goRecommend() {
    if (!this.data.rankResult) return;
    go(`/pages/recommend/recommend?rank=${this.data.rankResult.rank}`);
  },
});
