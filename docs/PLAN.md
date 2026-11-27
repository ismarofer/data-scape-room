# PLAN — DataQuest (evento: mié 2-dic-2026; inicio 17-nov)

Orden: M0 → M1 ∥ M2 → M3 → M4 → M5 → M7 → M6 → M9 → M8 (si sobra) → M10 (humano).
Regla: nada de IA live verificada hasta tener clave; `scripted` completable al 100 %.

## M0 Cimientos
- [x] npm workspaces (packages/shared, apps/server, apps/web), TS, Vitest, ESLint
- [x] Zod schemas contenido + `content:validate` + lock de ejemplo (Apéndice A)
- [x] Fastify + SQLite (11.3) + WS hola mundo; Vite+React hola mundo
- [x] i18n es + gl
## M1 Datos (Python, sin Java)
- [x] 01_generate.py (ADR 001 plan B, ADR 002 Synthea) → 03_inject (T1-T12) → answers.sql/json → Parquet (02_localize fusionada en 01)
- [x] pytest con DuckDB + pandas + desde raw (16 tests verdes); BUILD_REPORT.md
## M2 Motor de juego
- [x] sesiones, equipos, roles, locks (hash salado), medidores, pistas, puntuación, eventos, banco de tiempo
- [x] WS tiempo real + reconexión, consola mínima, tutorial R0 jugable con 2 clientes
## M3 DuckDB y modelos
- [x] DuckDB-WASM autoalojado, wizard de carga, mini-runner dbt, model builder con slots, linaje (SVG), tests — speedrun E2E en navegador verde (ADR 005)
## M4 R0-R2 · M5 R3-R5 · M6 IA live (Azure Foundry, ADR 003) · M7 Final · M8 R6 · M9 Consola/pulido · M10 Ensayo
(Detalle en SPEC §16; se desglosa al iniciar cada hito.)

## Recorte previsto (DEFERRED) si aprieta: M8, dbt_reference, impresos PDF, modo proyección
