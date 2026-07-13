const SKIP_ENV_KEYS = new Set([
  "CLAUDE_AGENT_SDK_VERSION",
  "IDEA_PROJECT_PATH",
  "PROJECT_PATH",
  "LIZHI_PROJECT_PATH",
]);

const MODEL_ROUTING_ENV_KEYS = [
  "ANTHROPIC_MODEL",
  "ANTHROPIC_DEFAULT_OPUS_MODEL",
  "ANTHROPIC_DEFAULT_SONNET_MODEL",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL",
  "ANTHROPIC_SMALL_FAST_MODEL",
  "CLAUDE_CODE_SUBAGENT_MODEL",
];

const PROXY_KEYS = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
  "NODE_EXTRA_CA_CERTS",
  "NODE_TLS_REJECT_UNAUTHORIZED",
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "WINDIR",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "TEMP",
  "TMP",
  "COMSPEC",
  "LIZHI_DATA_DIR",
];

/**
 * Build a minimal env object for SDK child processes.
 * Avoids inheriting malformed path env vars (e.g. PROJECT_PATH=D:).
 *
 * @param {Record<string, string>} anthropicEnv
 * @param {string} projectCwd
 */
export function buildSdkEnv(anthropicEnv, projectCwd) {
  /** @type {Record<string, string>} */
  const env = {};

  for (const key of PROXY_KEYS) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      env[key] = value.trim();
    }
  }

  for (const [key, value] of Object.entries(anthropicEnv)) {
    if (typeof value === "string") env[key] = value;
  }

  for (const key of MODEL_ROUTING_ENV_KEYS) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      env[key] = value.trim();
    }
  }

  if (env.ANTHROPIC_BASE_URL) {
    env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST = "1";
  }

  env.CLAUDE_CODE_ENTRYPOINT = "cli";
  env.USER_TYPE = "external";
  env.LIZHI_PROJECT_PATH = projectCwd;
  env.PROJECT_PATH = projectCwd;
  env.IDEA_PROJECT_PATH = projectCwd;

  for (const [key, value] of Object.entries(process.env)) {
    if (SKIP_ENV_KEYS.has(key) || SKIP_ENV_KEYS.has(key.toUpperCase())) continue;
    if (key in env) continue;
    if (typeof value !== "string") continue;
    if (/^PROJECT/i.test(key) && /^[A-Za-z]:[\\/]?$/.test(value.trim())) continue;
    if (key.endsWith("_PATH") && /^[A-Za-z]:[\\/]?$/.test(value.trim())) continue;
  }

  return env;
}
