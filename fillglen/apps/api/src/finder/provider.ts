export type AiProviderName = "claude" | "openai" | "none";

export interface AiProvider {
  name: AiProviderName;
  complete(system: string, user: string, opts?: { batch?: boolean }): Promise<string>;
}

function providerName(): AiProviderName {
  const n = (process.env.FILLGLEN_AI_PROVIDER || "none").toLowerCase();
  if (n === "claude" || n === "openai") return n;
  return "none";
}

export function createAiProvider(): AiProvider {
  const name = providerName();
  return {
    name,
    async complete(system, user, opts) {
      if (name === "none") return "";
      if (opts?.batch && process.env.FILLGLEN_AI_BATCH === "1") {
        // Batch paths cost less; without a live batch job id we run immediately.
      }
      if (name === "claude") {
        const key = process.env.ANTHROPIC_API_KEY || process.env.FILLGLEN_LLM_KEY;
        if (!key) return "";
        const model = process.env.FILLGLEN_CLAUDE_MODEL || "claude-sonnet-4-5";
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 400,
            system,
            messages: [{ role: "user", content: user }],
          }),
        });
        const body = (await r.json()) as { content?: { text?: string }[] };
        return body.content?.[0]?.text || "";
      }
      const key = process.env.OPENAI_API_KEY || process.env.FILLGLEN_LLM_KEY;
      if (!key) return "";
      const model = process.env.FILLGLEN_OPENAI_MODEL || "gpt-4.1-mini";
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      const body = (await r.json()) as { choices?: { message?: { content?: string } }[] };
      return body.choices?.[0]?.message?.content || "";
    },
  };
}
