// 导航守卫：防止快速重复点击触发并发 navigateTo
// 并发导航会让框架内部页面(webview)的创建/销毁竞争，
// 表现为控制台 "routeDone with a webviewId X is not found" 路由错误。
let lastUrl = '';
let lastTime = 0;
/** 同一目标页面的最小点击间隔 */
const LOCK_MS = 600;

/** 带防抖的页面跳转（用法与 wx.navigateTo 相同） */
export function go(url: string): void {
  const now = Date.now();
  if (url === lastUrl && now - lastTime < LOCK_MS) return;
  lastUrl = url;
  lastTime = now;
  wx.navigateTo({ url });
}
