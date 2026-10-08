/**
 * Provider-neutral model call. Without an API key, returns NEEDS_HUMAN so
 * callers send the question to review instead of inventing an answer.
 */
export async function callModel(prompt: string): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const provider = (process.env.AI_PROVIDER || (anthropicKey && !openaiKey ? "anthropic" : "openai")).toLowerCase();

  if (provider === "anthropic" && anthropicKey) {
    const model = process.env.AI_MODEL || "claude-sonnet-4-20250514";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as any;
    return (data.content?.[0]?.text || "").trim();
  }

  if (openaiKey) {
    const model = process.env.AI_MODEL || "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as any;
    return (data.choices?.[0]?.message?.content || "").trim();
  }

  return "NEEDS_HUMAN";
}
