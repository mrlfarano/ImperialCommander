import type { z } from "zod";

export interface SamplingClient {
  supportsSampling: boolean;
  sampleText?: (prompt: string) => Promise<string>;
}

export class SamplingUnavailableError extends Error {
  constructor() {
    super("Host-session sampling is unavailable. Configure a non-sampling fallback provider.");
    this.name = "SamplingUnavailableError";
  }
}

export class HostSessionSamplingProvider {
  constructor(private readonly client: SamplingClient | undefined) {}

  async generateText(prompt: string): Promise<string> {
    if (!this.client?.supportsSampling || !this.client.sampleText) {
      throw new SamplingUnavailableError();
    }

    return this.client.sampleText(prompt);
  }

  async generateObject<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    return schema.parse(JSON.parse(await this.generateText(prompt)));
  }

  async parseSpec(prompt: string): Promise<string> {
    return this.generateText(prompt);
  }

  keyStatus(): { ok: true; source: "not-required" } {
    return { ok: true, source: "not-required" };
  }
}
