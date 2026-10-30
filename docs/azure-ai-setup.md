# Azure AI configuration

Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY and AZURE_OPENAI_DEPLOYMENT in the Azure App Service environment variables for the API backend. Use the Azure OpenAI resource endpoint and your deployed model name. Do not use VITE_ prefixes or commit credentials.

When AZURE_OPENAI_ENDPOINT is unset, the backend uses OPENAI_API_KEY and optionally OPENAI_MODEL for standard OpenAI. Restart the API application after changing settings. The GitHub Pages static frontend cannot access the model without the hosted API.

Check the authenticated POST /api/ai/ask route with a CRM question. Successful model answers use mode llm; local fallback answers use mode retrieval. Monitor backend HTTP errors and do not log secrets or client records.
