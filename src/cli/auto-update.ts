export interface AutoUpdateOptions {
  env?: NodeJS.ProcessEnv;
  isTTY?: boolean;
}

export function shouldSkipAutoUpdate(options: AutoUpdateOptions = {}): boolean {
  const env = options.env ?? process.env;

  return env.CI === "true" || env.NODE_ENV === "test" || env.IMPERIAL_SKIP_AUTO_UPDATE === "1";
}

export function shouldShowBanner(
  options: AutoUpdateOptions & { noBanner?: boolean } = {},
): boolean {
  return options.noBanner !== true && options.isTTY === true;
}
