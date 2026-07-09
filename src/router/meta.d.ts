import "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    title?: string;
    requiresUnlock?: boolean;
    layer?: "ftue" | "vault" | "app";
  }
}
