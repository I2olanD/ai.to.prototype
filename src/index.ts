import type { Plugin } from "@opencode-ai/plugin"
import { cpSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SKILL_SOURCE = join(__dirname, "..", "plugin", "skills", "prototype")
const SKILL_TARGET = join(
  process.env.HOME ?? process.env.USERPROFILE ?? "",
  ".config",
  "opencode",
  "skills",
  "prototype"
)
const VERSION_FILE = ".ai-to-interface-design-version"

export const AiToInterfaceDesign: Plugin = async ({ client }) => {
  syncSkillFiles(client)
  return {}
}

function syncSkillFiles(client: any): void {
  try {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "..", "package.json"), "utf-8")
    )
    const currentVersion = pkg.version
    const versionFile = join(SKILL_TARGET, VERSION_FILE)

    if (existsSync(versionFile)) {
      const installedVersion = readFileSync(versionFile, "utf-8").trim()
      if (installedVersion === currentVersion) return
    }

    mkdirSync(SKILL_TARGET, { recursive: true })
    cpSync(SKILL_SOURCE, SKILL_TARGET, { recursive: true })
    writeFileSync(versionFile, currentVersion)

    client?.app?.log?.({
      body: {
        service: "ai-to-interface-design",
        level: "info",
        message: `Installed prototype skill v${currentVersion} to ${SKILL_TARGET}`
      }
    })
  } catch (error) {
    client?.app?.log?.({
      body: {
        service: "ai-to-interface-design",
        level: "warn",
        message: `Failed to sync skill files: ${error}`
      }
    })
  }
}
