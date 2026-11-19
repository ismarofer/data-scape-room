# ADR 005 — Motor de datos en el navegador (M3)

Estado: aceptada (2026-11-17).

- DuckDB-WASM 1.29 autoalojado (`apps/web/public/duckdb`, copiado por `scripts/sync-public.mjs`); ficheros de datos en `/data/raw` y `/data/parquet`. Sin CDN.
- La extensión de codificación de `read_csv` (`encoding=`) **no existe en WASM**: la decodificación (UTF-8 / Latin-1) y el análisis del CSV se hacen en JS (`packages/shared/src/csv.ts`); DuckDB solo recibe el texto ya decodificado.
- La capa `raw.*` guarda todo como VARCHAR. El asistente R1A valida separador, codificación y formato de fecha (filas rechazadas, fechas ilegibles, símbolos raros); el tipado real ocurre en staging (R2B, con huecos).
- Validación servidor de locks `build`: el cliente envía un informe canónico (filas, rechazos, columnas, checksum de ids, fallos de fecha / R2B: filas por modelo, tests fallidos, piezas elegidas) y el servidor compara su hash salado (`data/dist/build_answers*.json`, generado ejecutando la solución en DuckDB con `npm run build:answers`).
- `/api/models` entrega modelos, huecos y tests **sin** la marca `correct`.
- SQL libre (modo senior, P1 pendiente) pasará por `guardSql` (solo SELECT/CTAS/CREATE VIEW; sin COPY/ATTACH/read_csv…).
- Linaje: SVG propio por ahora; React Flow entra en R3B (lienzo estrella).
- Speedrun E2E (Playwright + Edge, `npm run e2e` con `BASE=http://localhost:<puerto>`) pasa tutorial → R1A → R1B → R2B en ~7 s.
