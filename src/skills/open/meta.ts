import type { SkillMeta } from "../types";

export const TOOLS = {
  openUrl: "openUrl",
  openApp: "openApp",
  quitApp: "quitApp",
  openPath: "openPath",
} as const;

export const meta: SkillMeta = {
  id: "open",
  label: "Open / quit apps & URLs",
  description: "Open URLs in the browser, launch or normally quit apps, and open files/folders.",
  sensitive: true,
};
