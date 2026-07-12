// AI_MODE=native: spawn host Ollama and the local_ai Python server alongside the
// backend, and kill them on exit — the AI stack runs only while you practice.
import { join } from "node:path"
import { existsSync } from "node:fs"
import { config } from "./config"

const LOCAL_AI_DIR = join(import.meta.dir, "..", "local_ai")
const LOCAL_AI_PYTHON = join(LOCAL_AI_DIR, ".venv", "bin", "python3")

const isUp = (url: string) =>
  fetch(url, { signal: AbortSignal.timeout(1500) })
    .then((r) => r.ok)
    .catch(() => false)

export async function startNativeServices(): Promise<void> {
  if (config.aiMode !== "native") return

  const children: ReturnType<typeof Bun.spawn>[] = []

  if (await isUp(`${config.ollama.url}/api/version`)) {
    console.log("[native] ollama already running")
  } else {
    console.log("[native] starting ollama serve (Metal)…")
    children.push(
      Bun.spawn(["ollama", "serve"], {
        env: {
          ...process.env,
          // Recommended by the ollama brew formula for Apple Silicon
          OLLAMA_FLASH_ATTENTION: "1",
          OLLAMA_KV_CACHE_TYPE: "q8_0",
        },
        stdout: "ignore",
        stderr: "ignore",
      }),
    )
  }

  if (await isUp(`${config.whisper.url}/health`)) {
    console.log("[native] local_ai already running")
  } else if (!existsSync(LOCAL_AI_PYTHON)) {
    console.warn(
      "[native] local_ai venv not found — run:\n" +
        "  python3 -m venv local_ai/.venv && local_ai/.venv/bin/pip install -r local_ai/requirements.txt",
    )
  } else {
    console.log("[native] starting local_ai (mlx-whisper + kokoro)…")
    children.push(
      Bun.spawn([LOCAL_AI_PYTHON, "server.py"], {
        cwd: LOCAL_AI_DIR,
        stdout: "inherit",
        stderr: "inherit",
      }),
    )
  }

  if (children.length === 0) return

  let killed = false
  const killAll = () => {
    if (killed) return
    killed = true
    for (const child of children) child.kill()
  }
  process.on("SIGINT", () => {
    killAll()
    process.exit(0)
  })
  process.on("SIGTERM", () => {
    killAll()
    process.exit(0)
  })
  process.on("exit", killAll)
}
