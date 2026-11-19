# ADR 001 — Generador sintético propio en Python (sin Synthea/Java)

Estado: aceptada (2026-11-17)

## Contexto
El SPEC (9.1) pide Synthea, que requiere Java 17+. El responsable descarta usar Java.

## Decisión
`data/01_generate.py` genera datos sintéticos con Python + numpy (semilla `SEED=20261117`), imitando el esquema CSV de Synthea
(patients, organizations, encounters, conditions) para conservar nombres de columna y la lógica del SPEC.
Sustituye a `01_generate_synthea.sh`. Los datos siguen siendo 100 % ficticios.

## Consecuencias
- Control total sobre tasa de reingreso, volumen por centro y trampas; calibración más fácil.
- Menos "realismo clínico" que Synthea; aceptable para el objetivo pedagógico. Se declara en el informe final.
- El filtro de condiciones sensibles (9.3) pasa a ser trivial: el catálogo de condiciones ya excluye esos casos.

## Otras decisiones del mismo día
- Sin git por ahora, sin ramas; se construye en una sola línea de trabajo.
- Gallego (`gl`) incluido en la v1, además de `es`.
- Sin clave de API: se desarrolla en `scripted`; `live` queda implementado pero sin verificar con llamadas reales.
- Evento: miércoles 2 de diciembre de 2026.
