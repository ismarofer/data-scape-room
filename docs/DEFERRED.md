# DEFERRED — huecos conocidos (actualizado 2026-11-18)

Lo que el SPEC pide y todavía NO está hecho o está simplificado. Nada de esto bloquea jugar R0-R5 de principio a fin.

## Pendiente
- **Eventos narrativos E1-E6** (cifra provisional, auditoría de privacidad, parche reenviado, Ada segura, atajo, prensa) y su efecto en medidores. Por eso las insignias «Decidido/a con datos» y «Equipo en sintonía» no existen y «Sin atajos» significa «sin llave maestra».
- **Banco de tiempo / soft_cap / hard_cap / Llave maestra automática**, bonus de tiempo y puntuación 0-1000 completa (hoy: puntos de candado, pistas, llave maestra, falsos positivos e insignias). R6 se ofrece siempre, sin comprobar el banco de tiempo.
- **Consola del facilitador:** falta el QR (hay que añadir una dependencia), dry-run ×N y `purge` desde la pantalla.
- **Impresos PDF, modo proyección, preflight, guía del facilitador y RUNBOOK.**
- Hecho el 18-nov (ADR 010): R6 (laboratorio de riesgo), La Comisión con final, informe e insignias, y la consola `/facilitador`.

## Simplificaciones respecto al SPEC (decisiones en ADR)
- Sin roles ni fichas; varios portátiles pueden compartir un equipo (ADR 008; sustituye a ADR 007 y 004).
- Encoding de CSV decodificado en JS (DuckDB-WASM no trae `encoding=`) (ADR 005).
- Marts canónicos (R4-R5) servidos como CSV, no Parquet: DuckDB-WASM 1.29 falla con los Parquet escritos por DuckDB 1.5 ("function signature mismatch"). Los Parquet siguen generándose para cuando se suba de versión (ADR 006).
- R2A: eliminar el SSN no "pasa con aviso y deja volver": no pasa y explica por qué (mismo efecto pedagógico, sin penalización).
- R3A/R5A: pasan solo con las respuestas correctas (el SPEC permitía modelos "coherentes pero con otra cifra").
- Linaje en SVG propio (React Flow solo en R3B).
- Gráficos del dashboard dibujados con SVG propio sobre las mismas reglas declarativas (no Vega-Lite).
- SQL libre del modo senior: solo en el panel de comprobaciones rápidas (no hay editor de SQL del modelo).
- Sin roles, sin código de sesión, sin perfil de edad (siempre senior) y IA siempre live (ADR 008 y 009). Las secciones del SPEC sobre roles (§3.2), perfiles de edad (§3.3) y modo de IA (§8.4) ya no aplican; insignia "Equipo en sintonía" por redefinir.

## No verificado
- **IA `live` con Azure Foundry:** verificada el 18-nov con `gpt-6-luna` (Lumi, con historial y estado del equipo). Es un modelo de razonamiento: hay que dejar `max_completion_tokens` ≥ 2000. Sin probar con la IA real: Ada, crítico de dashboard y entrevistas Noa/Brais.
- Accesibilidad con lector de pantalla y axe; navegadores distintos de Edge; rendimiento con 6 equipos simultáneos.
- Contenido en gallego revisado por una persona nativa.
