// Runs the backend venv's Python on Windows and macOS: node scripts/py.mjs -m uvicorn ...
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const candidates = [join(root, "backend/.venv/Scripts/python.exe"), join(root, "backend/.venv/bin/python")]
const python = candidates.find((p) => existsSync(p))
if (!python) {
  console.error("No backend/.venv found. Run: uv venv --python 3.12 backend/.venv && uv pip install --python backend/.venv -r backend/requirements.txt")
  process.exit(1)
}
const args = process.argv.slice(2)
const cwd = args.includes("app.core.seed_gen") ? join(root, "backend") : root
const child = spawn(python, args, { cwd, stdio: "inherit" })
child.on("exit", (code) => process.exit(code ?? 1))
