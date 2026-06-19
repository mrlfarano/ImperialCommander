export type LogLevel = "debug" | "info" | "warn" | "error" | "success";

export interface LoggerOptions {
  level?: LogLevel;
  debug?: boolean;
  sink?: (level: LogLevel, message: string) => void;
}

const severity: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  success: 25,
  warn: 30,
  error: 40,
};

export class Logger {
  constructor(private readonly options: LoggerOptions = {}) {}

  debug(message: string): void {
    this.write("debug", message);
  }

  info(message: string): void {
    this.write("info", message);
  }

  success(message: string): void {
    this.write("success", message);
  }

  warn(message: string): void {
    this.write("warn", message);
  }

  error(message: string): void {
    this.write("error", message);
  }

  private write(level: LogLevel, message: string): void {
    const configuredLevel = this.options.debug === true ? "debug" : (this.options.level ?? "info");

    if (severity[level] >= severity[configuredLevel]) {
      this.options.sink?.(level, message);
    }
  }
}
