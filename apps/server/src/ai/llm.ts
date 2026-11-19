import OpenAI from "openai";

export interface ChatTurn { role: "user" | "assistant"; content: string }
export interface CompleteOpts { system: string; user: string; history?: ChatTurn[]; json: boolean; maxTokens: number; tier: "fast" | "smart"; signal?: AbortSignal }
export interface Llm { complete(o: CompleteOpts): Promise<{ text: string; tokens: number }> }

/** Azure AI Foundry through the OpenAI-compatible v1 endpoint (ADR 003). The key never leaves the server. */
export class AzureLlm implements Llm {
  private client: OpenAI;
  constructor(private cfg: { endpoint: string; apiKey: string; fast: string; smart: string }) {
    this.client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.endpoint });
  }
  async complete(o: CompleteOpts) {
    const res = await this.client.chat.completions.create(
      {
        model: o.tier === "fast" ? this.cfg.fast : this.cfg.smart,
        messages: [{ role: "system", content: o.system }, ...(o.history ?? []), { role: "user", content: o.user }],
        // the deployment is a reasoning model: hidden reasoning tokens count against this limit, so a small cap returns an EMPTY answer
        max_completion_tokens: Math.max(o.maxTokens, 2000),
        ...(o.json ? { response_format: { type: "json_object" as const } } : {}),
      },
      { signal: o.signal },
    );
    return { text: res.choices[0]?.message?.content ?? "", tokens: res.usage?.total_tokens ?? 0 };
  }
}

export function llmFromEnv(env: NodeJS.ProcessEnv): Llm | undefined {
  const apiKey = env.AZURE_OPENAI_API_KEY;
  const endpoint = env.AZURE_OPENAI_ENDPOINT;
  if (!apiKey || !endpoint) return undefined;
  return new AzureLlm({ apiKey, endpoint, fast: env.AZURE_OPENAI_DEPLOYMENT_FAST ?? "gpt-6-luna", smart: env.AZURE_OPENAI_DEPLOYMENT_SMART ?? "gpt-6-luna" });
}
