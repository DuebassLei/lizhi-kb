/** v1.5 — Canvas 防窥水印层 */
import { type Ref, nextTick, onMounted, onUnmounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { useUiStore } from "../stores/ui";
import { useVaultStore } from "../stores/vault";
import { normalizeWatermarkNickname } from "../utils/watermarkSetting";
import { isLightTheme } from "../utils/theme";
import type { ThemeId } from "../stores/ui";

const ROTATE_DEG = -22;
const FONT_SIZE = 14;
const TILE_W = 240;
const TILE_H = 150;
const DEVICE_SUFFIX_KEY = "lizhi-kb-device-suffix";

function getOrCreateDeviceSuffix(): string {
  let suffix = localStorage.getItem(DEVICE_SUFFIX_KEY);
  if (!suffix) {
    suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    localStorage.setItem(DEVICE_SUFFIX_KEY, suffix);
  }
  return suffix;
}

function formatWatermarkLine(vaultId: string | null, nickname: string): string {
  const custom = normalizeWatermarkNickname(nickname);
  const identity = custom || (vaultId ? vaultId.slice(-4).toUpperCase() : getOrCreateDeviceSuffix());
  const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${identity} · ${time}`;
}

function watermarkFill(theme: ThemeId): string {
  // spec: 默认 15% 透明度，颜色跟随主题
  return isLightTheme(theme)
    ? "rgba(90, 99, 112, 0.15)"
    : "rgba(138, 155, 176, 0.15)";
}

export function useWatermark(canvasRef: Ref<HTMLCanvasElement | null>) {
  const ui = useUiStore();
  const vault = useVaultStore();
  const { watermarkOn, watermarkNickname, theme } = storeToRefs(ui);

  let rafId = 0;
  let intervalId = 0;
  let resizeObserver: ResizeObserver | null = null;

  function draw() {
    const canvas = canvasRef.value;
    if (!canvas || !watermarkOn.value) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const text = formatWatermarkLine(vault.vaultId, watermarkNickname.value);
    ctx.font = `${FONT_SIZE}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = watermarkFill(theme.value);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const rad = (ROTATE_DEG * Math.PI) / 180;
    for (let y = -TILE_H; y < h + TILE_H; y += TILE_H) {
      for (let x = -TILE_W; x < w + TILE_W; x += TILE_W) {
        ctx.save();
        ctx.translate(x + TILE_W / 2, y + TILE_H / 2);
        ctx.rotate(rad);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
    }
  }

  function scheduleDraw() {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(draw);
  }

  onMounted(() => {
    resizeObserver = new ResizeObserver(scheduleDraw);
    resizeObserver.observe(document.documentElement);
    window.addEventListener("resize", scheduleDraw);
    intervalId = window.setInterval(scheduleDraw, 60_000);
    watch([watermarkOn, watermarkNickname, theme, () => vault.vaultId, canvasRef], () => {
      void nextTick(scheduleDraw);
    }, { immediate: true });
  });

  onUnmounted(() => {
    cancelAnimationFrame(rafId);
    clearInterval(intervalId);
    resizeObserver?.disconnect();
    window.removeEventListener("resize", scheduleDraw);
  });

  return { redraw: scheduleDraw };
}
