import { createInterface } from "readline";

/**
 * @returns {Promise<Record<string, unknown>>}
 */
export async function readStdinJson() {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: process.stdin });
    const lines = [];
    rl.on("line", (line) => lines.push(line));
    rl.on("close", () => {
      const raw = lines.join("\n").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    rl.on("error", reject);
  });
}

/**
 * Read the first JSON line from stdin (stdin may stay open for follow-up messages).
 * @returns {Promise<Record<string, unknown>>}
 */
export async function readStdinFirstJsonLine() {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: process.stdin });
    rl.once("line", (line) => {
      rl.close();
      const raw = line.trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    rl.on("error", reject);
  });
}
