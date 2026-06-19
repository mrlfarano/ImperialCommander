import { getConfig, updateConfig } from "../config/config-manager.js";

export interface LangCommandOptions {
  configPath?: string;
  response?: string;
}

export async function langCommand(options: LangCommandOptions = {}): Promise<string> {
  if (options.response) {
    await updateConfig(
      (config) => ({
        ...config,
        global: {
          ...config.global,
          responseLanguage: options.response ?? "English",
        },
      }),
      { configPath: options.configPath },
    );
  }

  const config = await getConfig({ configPath: options.configPath, forceReload: true });
  return `Response language: ${config.global.responseLanguage}`;
}
