/** 锁定 vault 时清空的敏感态回调（由 main.ts 注册，避免 store 循环依赖） */
const handlers: Array<() => void> = [];

export function registerSensitiveSessionClear(handler: () => void): void {
  handlers.push(handler);
}

export function clearSensitiveSessionData(): void {
  for (const handler of handlers) {
    handler();
  }
}
