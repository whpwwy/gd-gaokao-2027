// 收藏服务：基于 wx.storage 本地持久化
import { FavoriteItem } from './types';

const STORAGE_KEY = 'gaokao_favorites_v1';

export function favoriteId(type: 'school' | 'group', code: string, group?: string): string {
  return type === 'school' ? `s_${code}` : `g_${code}_${group || ''}`;
}

function load(): FavoriteItem[] {
  return wx.getStorageSync(STORAGE_KEY) || [];
}

function save(items: FavoriteItem[]): void {
  wx.setStorageSync(STORAGE_KEY, items);
}

export const favorites = {
  list(): FavoriteItem[] {
    return load().sort((a, b) => b.savedAt - a.savedAt);
  },

  has(id: string): boolean {
    return load().some((it) => it.id === id);
  },

  isFavorite(type: 'school' | 'group', code: string, group?: string): boolean {
    return this.has(favoriteId(type, code, group));
  },

  /** 添加收藏，返回是否成功 */
  add(type: 'school' | 'group', code: string, name: string, group?: string): boolean {
    const items = load();
    const id = favoriteId(type, code, group);
    if (items.some((it) => it.id === id)) return false;
    items.push({ id, type, code, group, name, savedAt: Date.now() });
    save(items);
    return true;
  },

  remove(id: string): void {
    save(load().filter((it) => it.id !== id));
  },

  toggle(type: 'school' | 'group', code: string, name: string, group?: string): boolean {
    const id = favoriteId(type, code, group);
    if (this.has(id)) {
      this.remove(id);
      return false;
    }
    return this.add(type, code, name, group);
  },
};
