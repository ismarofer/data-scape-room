# ADR 003 — Proveedor de IA: Azure AI Foundry (API compatible con OpenAI) en lugar del SDK de Anthropic

Estado: aceptada (2026-11-17). Sustituye a lo indicado en SPEC 8.1 sobre ANTHROPIC_MODEL_*.

- Endpoint del cliente: `https://autoconsumo-fd.openai.azure.com/openai/v1` (API v1 compatible con OpenAI; proyecto Foundry `autoconsumo`).
- La capa de IA del servidor se escribe contra una interfaz `AiProvider` (`chat(messages, {json_schema, max_tokens, timeout})`), con implementaciones:
  `azure-openai` (SDK `openai` con `baseURL`), `scripted` y `off`. Anthropic queda como implementación opcional futura.
- Variables de entorno (solo servidor, nunca en el cliente ni en el repo): `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`
  (o Entra ID), `AZURE_OPENAI_DEPLOYMENT_FAST` (Lumi, NPCs, crítico), `AZURE_OPENAI_DEPLOYMENT_SMART` (Comisión, informe, Ada libre).
- El nombre del *deployment* se usa como `model`. Salida estructurada con `response_format: json_schema` si el deployment lo soporta; si no, JSON + validación Zod con un reintento.
- Todo lo demás del SPEC 8 (límites, moderación, timeout de 12 s, degradación a `scripted`) no cambia.
- Aviso de privacidad: la sesión se ejecuta en una cuenta corporativa; no se envían datos personales (el juego no los recoge).

## Nota técnica (M0/M2)
- SQLite: se usa `node:sqlite` (integrado en Node 22+) en vez de `better-sqlite3`, para evitar compilación nativa en Windows/Node 25. Se carga con `createRequire` porque Vite/Vitest no reconocen el builtin en imports ESM.
- La sal de las respuestas (`ANSWER_SALT`) se lee de `.env` tanto en el pipeline Python como en el servidor; si se cambia hay que ejecutar `python data/04_answers.py` y reiniciar el servidor (las respuestas se cargan en memoria al arrancar).
