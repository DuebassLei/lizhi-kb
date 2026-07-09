import { ref, watch } from "vue";
import {
  loadStoredWechatTheme,
  saveWechatTheme,
  type WechatThemeId,
} from "../services/wechatExport";

const themeId = ref<WechatThemeId>(loadStoredWechatTheme());
let watcherBound = false;

/** 工作区与公众号工作室共享的微信主题选择（localStorage 持久化） */
export function useWechatTheme() {
  if (!watcherBound) {
    watch(themeId, (id) => saveWechatTheme(id));
    watcherBound = true;
  }
  return { themeId };
}
