// 院校搜索页
import { dataService } from '../../services/data-service';
import { School } from '../../services/types';
import { go } from '../../services/nav';

interface SchoolView {
  code: string;
  name: string;
  region: string;
  nature: string;
  is985: boolean;
  is211: boolean;
  isDualClass: boolean;
  /** 最新年份最低录取情况 */
  latest: { score: number; rank: number; scoreCapped: boolean; rankCapped: boolean } | null;
}

const PAGE_SIZE = 20;

Page({
  data: {
    keyword: '',
    only985: false,
    only211: false,
    onlyDual: false,
    region: '',
    regionIndex: 0,
    regionOptions: ['全部地区'] as string[],
    views: [] as SchoolView[],
    page: 0,
    hasMore: false,
    resultCount: 0,
  },

  onLoad() {
    const regions = [...new Set(dataService.getAllSchools().map((s) => s.region))].sort();
    this.setData({ regionOptions: ['全部地区', ...regions] });
    this.runSearch();
  },

  onInput(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ keyword: e.detail.value });
  },

  doSearch() {
    this.runSearch();
  },

  toggle985() {
    this.setData({ only985: !this.data.only985 });
    this.runSearch();
  },
  toggle211() {
    this.setData({ only211: !this.data.only211 });
    this.runSearch();
  },
  toggleDual() {
    this.setData({ onlyDual: !this.data.onlyDual });
    this.runSearch();
  },

  onRegionChange(e: WechatMiniprogram.CustomEvent<{ value: number }>) {
    const idx = e.detail.value;
    this.setData({
      regionIndex: idx,
      region: idx === 0 ? '' : this.data.regionOptions[idx],
    });
    this.runSearch();
  },

  /** 计算并缓存过滤结果，重置分页 */
  runSearch() {
    const kw = this.data.keyword.trim();
    const latestYear = dataService.latestYear;
    const matched = dataService.getAllSchools().filter((s: School) => {
      if (kw && !s.name.includes(kw) && !s.code.includes(kw)) return false;
      if (this.data.only985 && !s.is985) return false;
      if (this.data.only211 && !s.is211) return false;
      if (this.data.onlyDual && !s.isDualClass) return false;
      if (this.data.region && s.region !== this.data.region) return false;
      return true;
    });

    const toView = (s: School): SchoolView => {
      const recs = dataService.getAdmissions(s.code)
        .filter((r) => r.year === latestYear && r.minScore !== null && !r.noAdmission);
      let latest: SchoolView['latest'] = null;
      if (recs.length) {
        // 取最低分的组
        const low = recs.sort((a, b) => (a.minScore as number) - (b.minScore as number))[0];
        latest = {
          score: low.minScore as number,
          rank: low.minRank as number,
          scoreCapped: low.scoreCapped,
          rankCapped: low.rankCapped,
        };
      }
      return {
        code: s.code, name: s.name, region: s.region, nature: s.nature,
        is985: s.is985, is211: s.is211, isDualClass: s.isDualClass, latest,
      };
    };

    this._all = matched.map(toView);
    this.setData({
      resultCount: this._all.length,
      page: 0,
      views: [],
    });
    this.loadMore();
  },

  loadMore() {
    const start = this.data.page * PAGE_SIZE;
    const slice = this._all.slice(start, start + PAGE_SIZE);
    if (!slice.length) return;
    this.setData({
      views: this.data.views.concat(slice),
      page: this.data.page + 1,
      hasMore: start + PAGE_SIZE < this._all.length,
    });
  },

  onReachBottom() {
    if (this.data.hasMore) this.loadMore();
  },

  goDetail(e: WechatMiniprogram.BaseEvent) {
    const code = e.currentTarget.dataset.code as string;
    go(`/subpkg/pages/school-detail/school-detail?code=${code}`);
  },

  _all: [] as SchoolView[],
});
