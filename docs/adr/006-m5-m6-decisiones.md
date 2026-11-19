# ADR 006 — Decisiones de M5 (R3-R5) y M6 (capa de IA)

Estado: aceptada (2026-11-17).

## Datos y navegador
- Los marts canónicos para R4-R5 (`fct_admission_clean`, `anomalies`) se sirven como **CSV** (`data/dist/canon`). DuckDB-WASM 1.29 devolvió "function signature mismatch" con los Parquet escritos por DuckDB 1.5. Revisar al subir de versión.
- Las respuestas esperadas "de contenido" (protocolo, esquema estelar, causas, veredicto, KPI) viven en `content/expected.yaml` (solo servidor) y se hashean con `npm run build:answers`.
- R3C usa los mismos modelos que R2B (`stg_*`) con las piezas ya guardadas del equipo; la cifra del código sale del SQL canónico (`data/answers.sql`) y se prueba contra el modelo del navegador.

## Capa de IA (apps/server/src/ai)
- `Llm` = interfaz mínima; `AzureLlm` usa el SDK `openai` contra el endpoint v1 de Foundry. Sin clave → solo `scripted`.
- **El servidor decide, el modelo adorna:** las pistas de las entrevistas se revelan por regla determinista (grupos de palabras clave); la IA solo pone la voz si coincide con la regla.
- Defensas: entrada con datos personales/enlaces o intento de inyección **no llega al modelo**; salida filtrada (correos, enlaces, teléfonos) y comprobada contra el hash de la respuesta del lock (cualquier 1-3 tokens consecutivos); JSON validado con Zod con 1 reintento y caída a `scripted`; timeout 12 s; límite por minuto; presupuesto por sesión (`AI_BUDGET_EUR_PER_SESSION`) tras el cual la sesión pasa a `scripted`.
- Ada cuesta 1 crédito, siempre devuelve `verified:false` y solo propone SQL que pasa `guardSql`.
- El crítico: las reglas del motor de gráficos son autoritativas; el modelo solo añade hallazgos extra (máx. 3).
- Cada candado es resoluble con `AI_MODE=off` (verificado en tests y en el speedrun, que corre en `scripted`).
