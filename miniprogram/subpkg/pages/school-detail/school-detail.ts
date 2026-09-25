// 院校详情页（分包）
import { dataService } from '../../../services/data-service';
import { favorites, favoriteId } from '../../../services/favorites';
import { AdmissionRecord, formatGroupLabel, School } from '../../../services/types';
import { subjectService } from '../../services/subject';

interface AdmView {
  key: string;
  year: number;
  group: string;
  groupLabel: string;
  /** 组内专业名预览，空串表示无数据 */
  majorsText: string;
  plan: number;
  admitted: number;
  score: number | null;
  rank: number | null;
  scoreCapped: boolean;
  rankCapped: boolean;
  noAdmission: boolean;
  fav: boolean;
}

interface TrendView { year: number; score: number | null; rank: number | null; }

interface SubjectView {
  key: string;
  level: string;
  category: string;
  firstText: string;
  reqText: string;
  majors: string[];
  open: boolean;
  majorCount: number;
}

Page({
  data: {
    code: '',
    school: null as (School & { levelText: string }) | null,
    schoolFav: false,
    yearTabs: [] as (number | 'all')[],
    activeTab: 'all' as number | 'all',
    admViews: [] as AdmView[],
    trend: [] as TrendView[],
    subjectViews: [] as SubjectView[],
    hasSubjects: false,
  },

  onLoad(options: { code?: string }) {
    const code = options.code || '';
    const school = dataService.getSchool(code);
    if (!school) {
      wx.showToast({ title: '未找到院校', icon: 'none' });
      return;
    }
    const records = dataService.getAdmissions(code);

    // 年份 tabs
    const years = [...new Set(records.map((r) => r.year))].sort((a, b) => b - a);
    const yearTabs: (number | 'all')[] = ['all', ...years];

    // 年度校线（每年最低分的组）
    const trend: TrendView[] = years.slice().reverse().map((year) => {
      const recs = records.filter((r) => r.year === year && r.minScore !== null && !r.noAdmission);
      if (!recs.length) return { year, score: null, rank: null };
      const low = recs.sort((a, b) => (a.minScore as number) - (b.minScore as number))[0];
      return { year, score: low.minScore, rank: low.minRank };
    });

    // 选科要求
    const subjectGroups = subjectService.getSubjects(code);
    const subjectViews: SubjectView[] = subjectGroups.map((g, i) => ({
      key: `sub_${i}`,
      level: g.level === 2 ? '专科' : '本科',
      category: g.category,
      firstText: g.first === 1 ? '仅物理' : '物理/历史均可',
      reqText: subjectService.describe(g),
      majors: g.majors,
      majorCount: g.majors.length,
      open: false,
    }));

    this.setData({
      code,
      school: { ...school, levelText: school.level === 2 ? '专科' : '本科' },
      schoolFav: favorites.isFavorite('school', code),
      yearTabs,
      trend,
      subjectViews,
      hasSubjects: subjectViews.length > 0,
    });
    this._records = records;
    this.refreshAdmViews();
  },

  _records: [] as AdmissionRecord[],

  refreshAdmViews() {
    const tab = this.data.activeTab;
    const code = this.data.code;
    const views: AdmView[] = this._records
      .filter((r) => tab === 'all' || r.year === tab)
      .sort((a, b) => (a.year !== b.year ? b.year - a.year : a.group < b.group ? -1 : 1))
      .map((r) => ({
        key: favoriteId('group', code, r.group) + '_' + r.year,
        year: r.year,
        group: r.group,
        groupLabel: formatGroupLabel(r.group),
        majorsText: r.majors.length
          ? (r.majors.length > 2 ? `${r.majors.slice(0, 2).join('、')} 等${r.majors.length}个` : r.majors.join('、'))
          : '',
        plan: r.plan,
        admitted: r.admitted,
        score: r.minScore,
        rank: r.minRank,
        scoreCapped: r.scoreCapped,
        rankCapped: r.rankCapped,
        noAdmission: r.noAdmission,
        fav: favorites.isFavorite('group', code, r.group),
      }));
    this.setData({ admViews: views });
  },

  switchTab(e: WechatMiniprogram.BaseEvent) {
    const tab = e.currentTarget.dataset.tab as number | 'all';
    this.setData({ activeTab: tab === 'all' ? 'all' : Number(tab) });
    this.refreshAdmViews();
  },

  /** 收藏/取消收藏院校 */
  toggleSchoolFav() {
    const school = this.data.school;
    if (!school) return;
    const nowFav = favorites.toggle('school', this.data.code, school.name);
    this.setData({ schoolFav: nowFav });
    wx.showToast({ title: nowFav ? '已收藏' : '已取消', icon: 'none' });
  },

  /** 收藏/取消收藏专业组 */
  toggleGroupFav(e: WechatMiniprogram.BaseEvent) {
    const { group } = e.currentTarget.dataset as { group: string };
    const school = this.data.school;
    if (!school) return;
    const nowFav = favorites.toggle(
      'group', this.data.code, `${school.name}（${formatGroupLabel(group)}）`, group);
    this.refreshAdmViews();
    wx.showToast({ title: nowFav ? '已收藏专业组' : '已取消', icon: 'none' });
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

  /** 展开/收起专业列表 */
  toggleSubject(e: WechatMiniprogram.BaseEvent) {
    const { key } = e.currentTarget.dataset as { key: string };
    const subjectViews = this.data.subjectViews.map((v) =>
      v.key === key ? { ...v, open: !v.open } : v);
    this.setData({ subjectViews });
  },
});
