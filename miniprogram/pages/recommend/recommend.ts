// 志愿推荐表单页
import { dataService } from '../../services/data-service';
import { rankAtScore } from '../../services/rank';
import { RecommendFilters } from '../../services/types';
import { go } from '../../services/nav';

const PENDING_KEY = 'pending_recommend';

/** 地区选项视图（选中态由 JS 层维护，模板只读 on） */
interface RegionView {
  name: string;
  on: boolean;
}

Page({
  data: {
    mode: 'score' as 'score' | 'rank',
    latestYear: dataService.latestYear,
    scoreInput: '',
    rankInput: '',
    resolvedRank: null as number | null,
    count: 40,
    countOptions: [20, 40, 80],
    // 筛选
    level1: true,   // 本科
    level2: false,  // 专科
    naturePublic: false,
    naturePrivate: false,
    natureJoint: false,
    only985: false,
    only211: false,
    // 院校地区：可多选；全部 on=false 时表示"不限"
    regionViews: [] as RegionView[],
    regionAllOff: true,
    // 最少计划招生人数输入（留空=不约束）
    minPlanInput: '',
    keyword: '',
  },

  onLoad(options: { score?: string; rank?: string }) {
    const regionViews: RegionView[] =
      [...new Set(dataService.getAllSchools().map((s) => s.region))]
        .sort()
        .map((name) => ({ name, on: false }));
    this.setData({ regionViews });
    if (options.rank) {
      this.setData({ mode: 'rank', rankInput: options.rank });
    } else if (options.score) {
      this.setData({ scoreInput: options.score });
      this.updateResolvedRank();
    }
  },

  switchMode(e: WechatMiniprogram.BaseEvent) {
    this.setData({ mode: e.currentTarget.dataset.mode as 'score' | 'rank' });
  },

  onScoreInput(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ scoreInput: e.detail.value });
    this.updateResolvedRank();
  },

  onRankInput(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ rankInput: e.detail.value });
  },

  updateResolvedRank() {
    const score = parseInt(this.data.scoreInput, 10);
    if (Number.isFinite(score) && score >= 0 && score <= 750) {
      this.setData({ resolvedRank: rankAtScore(this.data.latestYear, score).rank });
    } else {
      this.setData({ resolvedRank: null });
    }
  },

  selectCount(e: WechatMiniprogram.BaseEvent) {
    this.setData({ count: Number(e.currentTarget.dataset.count) });
  },

  toggleLevel(e: WechatMiniprogram.BaseEvent) {
    const which = e.currentTarget.dataset.which as '1' | '2';
    if (which === '1') this.setData({ level1: !this.data.level1 });
    else this.setData({ level2: !this.data.level2 });
  },

  toggleNature(e: WechatMiniprogram.BaseEvent) {
    const which = e.currentTarget.dataset.which as 'public' | 'private' | 'joint';
    if (which === 'public') this.setData({ naturePublic: !this.data.naturePublic });
    if (which === 'private') this.setData({ naturePrivate: !this.data.naturePrivate });
    if (which === 'joint') this.setData({ natureJoint: !this.data.natureJoint });
  },

  toggle985() { this.setData({ only985: !this.data.only985 }); },
  toggle211() { this.setData({ only211: !this.data.only211 }); },

  /** 多选/取消单个地区（选中态直接维护在视图对象上） */
  toggleRegion(e: WechatMiniprogram.BaseEvent) {
    const name = e.currentTarget.dataset.name as string;
    const regionViews = this.data.regionViews.map((v) =>
      v.name === name ? { ...v, on: !v.on } : v);
    this.setData({
      regionViews,
      regionAllOff: !regionViews.some((v) => v.on),
    });
  },

  /** 一键清空地区（回到"不限"） */
  clearRegions() {
    if (this.data.regionAllOff) return;
    this.setData({
      regionViews: this.data.regionViews.map((v) => ({ ...v, on: false })),
      regionAllOff: true,
    });
  },

  onMinPlanInput(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ minPlanInput: e.detail.value });
  },

  onKeywordInput(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ keyword: e.detail.value });
  },

  /** 生成推荐方案 */
  generate() {
    let rank: number;
    if (this.data.mode === 'score') {
      const score = parseInt(this.data.scoreInput, 10);
      if (!Number.isFinite(score) || score < 0 || score > 750) {
        wx.showToast({ title: '请输入0-750的分数', icon: 'none' });
        return;
      }
      rank = rankAtScore(this.data.latestYear, score).rank;
    } else {
      rank = parseInt(this.data.rankInput, 10);
      if (!Number.isFinite(rank) || rank <= 0) {
        wx.showToast({ title: '请输入有效位次', icon: 'none' });
        return;
      }
    }

    const levels: (1 | 2)[] = [];
    if (this.data.level1) levels.push(1);
    if (this.data.level2) levels.push(2);
    if (!levels.length) {
      wx.showToast({ title: '请至少选择本科或专科', icon: 'none' });
      return;
    }

    const natures: string[] = [];
    if (this.data.naturePublic) natures.push('公办');
    if (this.data.naturePrivate) natures.push('民办');
    if (this.data.natureJoint) natures.push('中外合作办学');

    // 最少计划招生人数：留空=不约束
    let minPlan: number | null = null;
    const planText = this.data.minPlanInput.trim();
    if (planText) {
      minPlan = parseInt(planText, 10);
      if (!Number.isFinite(minPlan) || minPlan <= 0) {
        wx.showToast({ title: '请输入有效的计划人数', icon: 'none' });
        return;
      }
    }

    const filters: RecommendFilters = {
      regions: this.data.regionViews.filter((v) => v.on).map((v) => v.name),
      levels,
      natures,
      only985: this.data.only985,
      only211: this.data.only211,
      keyword: this.data.keyword.trim(),
      minPlan,
    };

    wx.setStorageSync(PENDING_KEY, { rank, count: this.data.count, filters });
    go('/pages/recommend-result/recommend-result');
  },
});
