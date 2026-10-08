export async function notify(message: string): Promise<void> {
  console.log(`[notify] ${message}`);
  const url = process.env.NOTIFY_WEBHOOK;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message, content: message }),
    });
  } catch (err) {
    console.warn(`Webhook failed: ${err instanceof Error ? err.message : err}`);
  }
}
