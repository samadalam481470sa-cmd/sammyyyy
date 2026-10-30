# Azure AI configuration

Meeting summaries and Newport AI use Google Gemini when a Gemini key is set. Set these in the Azure App Service environment variables for the API backend (newport-crm-api):

- `MEETING_SUMMARY_ENABLED=1` (required for meeting summaries)
- `GEMINI_API_KEY` (key from Google AI Studio). A Google key saved as `OPENAI_API_KEY` also works.
- Optional: `GEMINI_MODEL` (default gemini-flash-latest) and `GEMINI_FALLBACK_MODELS` (default gemini-flash-lite-latest,gemini-2.5-flash).

Without a Gemini key, the backend uses Azure OpenAI (AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT) or standard OpenAI (OPENAI_API_KEY starting with sk-, optional OPENAI_MODEL) for Newport AI, and OpenAI for meeting summaries.

Do not use VITE_ prefixes or commit credentials. The app restarts after settings change. The GitHub Pages static frontend cannot reach the model without the hosted API.

Check it with the Test AI connection button on a meeting, or the signed-in GET /api/workspace/ai/selftest route. Successful Newport AI answers use mode llm; local fallback answers use mode retrieval. Do not log secrets or client records.
