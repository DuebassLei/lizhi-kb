export type ScrollSyncSide = "editor" | "preview";

/**
 * 分栏滚动同步的驱动侧门禁：只允许「用户最近操作的那一侧」发起同步，
 * 避免程序化改 scrollTop / 图片加载撑高预览时反向回写另一侧造成跳滚。
 */
export function createScrollSyncDriver() {
  let driver: ScrollSyncSide | null = null;

  return {
    arm(side: ScrollSyncSide) {
      driver = side;
    },
    clear() {
      driver = null;
    },
    shouldSyncFrom(side: ScrollSyncSide): boolean {
      return driver === side;
    },
    getDriver(): ScrollSyncSide | null {
      return driver;
    },
  };
}
