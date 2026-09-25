// 我的收藏页
import { favorites } from '../../services/favorites';
import { dataService } from '../../services/data-service';
import { FavoriteItem, formatGroupLabel } from '../../services/types';
import { go } from '../../services/nav';

interface FavView {
  id: string;
  typeText: string;
  name: string;
  code: string;
  groupText: string;
  /** 组内专业名预览（仅专业组收藏项，空串表示无数据） */
  majorsText: string;
  savedText: string;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number): string => (n < 10 ? '0' + n : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

Page({
  data: {
    views: [] as FavView[],
    isEmpty: false,
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const items = favorites.list();
    this.setData({
      isEmpty: items.length === 0,
      views: items.map((it: FavoriteItem): FavView => {
        let majorsText = '';
        if (it.type === 'group' && it.group) {
          const rec = dataService.getAdmissions(it.code).find((r) => r.group === it.group);
          const majors = rec?.majors || [];
          if (majors.length) {
            majorsText = majors.length > 3
              ? `含：${majors.slice(0, 3).join('、')} 等${majors.length}个`
              : `含：${majors.join('、')}`;
          }
        }
        return {
          id: it.id,
          typeText: it.type === 'school' ? '院校' : '专业组',
          name: it.name,
          code: it.code,
          groupText: it.type === 'group' && it.group ? formatGroupLabel(it.group) : '',
          majorsText,
          savedText: formatTime(it.savedAt),
        };
      }),
    });
  },

  /** 点击进入院校详情 */
  openItem(e: WechatMiniprogram.BaseEvent) {
    const { id, code } = e.currentTarget.dataset as { id: string; code: string };
    const item = favorites.list().find((it) => it.id === id);
    if (!item) return;
    go(`/subpkg/pages/school-detail/school-detail?code=${code}`);
  },

  /** 长按删除 */
  removeItem(e: WechatMiniprogram.BaseEvent) {
    const { id } = e.currentTarget.dataset as { id: string };
    wx.showModal({
      title: '取消收藏',
      content: '确定要移除这条收藏吗？',
      success: (res) => {
        if (res.confirm) {
          favorites.remove(id);
          this.refresh();
        }
      },
    });
  },
});
