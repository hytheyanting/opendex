import { quitApp } from "./quit-app";
import { spawn } from "node:child_process";
import { shell } from "electron";
import { z } from "zod";
import { meta, TOOLS } from "./meta";
import type { Skill } from "../types";

function launchApp(name: string): Promise<{ ok: true } | { error: string }> {
  return new Promise((resolve) => {
    let cmd: string;
    let args: string[];
    if (process.platform === "darwin") {
      cmd = "open";
      args = ["-a", name];
    } else if (process.platform === "win32") {
      // `start` is a cmd builtin; "" is the (empty) window title arg.
      cmd = "cmd";
      args = ["/c", "start", "", name];
    } else {
      cmd = "gtk-launch";
      args = [name];
    }
    let settled = false;
    const settle = (result: { ok: true } | { error: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    try {
      const child = spawn(cmd, args, { stdio: "ignore", detached: true });
      // A spawn error can fire after the optimistic resolve below; the `settled`
      // guard ensures we report failure only if it arrives first, and never tell
      // the model "launched" after an error already won.
      child.on("error", (err) => settle({ error: err.message }));
      child.unref();
      // Resolve optimistically — most launchers exit immediately.
      setTimeout(() => settle({ ok: true }), 150);
    } catch (err) {
      settle({ error: err instanceof Error ? err.message : String(err) });
    }
  });
}

export const openSkill: Skill = {
  ...meta,
  systemPrompt: "To quit/exit a named application on macOS, prefer quitApp over screenshot or keyboard control. Closing only a window differs from quitting the app: use quitApp when the user wants the application to exit. Never claim it exited if the tool reports still running or an error.",
  tools: [
    {
      name: TOOLS.quitApp,
      description: "Normally quit/exit a running macOS application by its exact name or bundle ID (Calculator = 计算器). Does not launch absent apps or force quit. An app may ask the user to save changes. Use for requests to close/quit an application; not for closing just one document/window.",
      inputSchema: z.object({ name: z.string().min(1).max(256).describe("Exact installed app name, e.g. Calculator, or bundle ID, e.g. com.apple.calculator.") }),
      summarize: (i) => `Quit app normally: ${(i as { name: string }).name}`,
      execute: async ({ name }: { name: string }) => quitApp(name),
    },
    {
      name: TOOLS.openUrl,
      description: "Open a URL in the user's default web browser.",
      inputSchema: z.object({
        url: z.string().describe("An http(s) or mailto URL."),
      }),
      summarize: (i) => `Open URL: ${(i as { url: string }).url}`,
      execute: async ({ url }: { url: string }) => {
        if (!/^(https?:|mailto:)/i.test(url)) {
          return { error: "Only http(s) and mailto URLs are allowed." };
        }
        await shell.openExternal(url);
        return { ok: true, opened: url };
      },
    },
    {
      name: TOOLS.openApp,
      description: "Launch an installed application by name (e.g. 'Safari', 'Notes').",
      inputSchema: z.object({
        name: z.string().describe("Application name."),
      }),
      summarize: (i) => `Launch app: ${(i as { name: string }).name}`,
      execute: async ({ name }: { name: string }) => {
        const result = await launchApp(name);
        return "ok" in result ? { ok: true, launched: name } : result;
      },
    },
    {
      name: TOOLS.openPath,
      description: "Open a file or folder in its default application / the file manager.",
      inputSchema: z.object({
        path: z.string().describe("Absolute path to a file or folder."),
      }),
      summarize: (i) => `Open path: ${(i as { path: string }).path}`,
      execute: async ({ path }: { path: string }) => {
        const err = await shell.openPath(path); // "" on success
        return err ? { error: err } : { ok: true, opened: path };
      },
    },
  ],
};
