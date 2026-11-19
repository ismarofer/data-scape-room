# Código Alta — escape room de datos (sanidad)
Spec completo: SPEC-escape-room-datos-sanidad.md. Plan: docs/PLAN.md. Decisiones: docs/adr/.
Comandos: `make data` / `python data/run_all.py`, `npm run dev`, `npm test`, `npm run e2e`, `npm run content:validate`.
Reglas duras: datos ficticios; sin respuestas/claves en cliente; IA solo en servidor y siempre live (ADR 009; sin AI_MODE);
sin CDNs en runtime; determinismo (SEED=20261117); contenido como datos en content/; es + gl.
Synthea (Java 21) en data/synthea; ADR 002. IA: Azure AI Foundry (ADR 003), variables en .env. Sin git por ahora.
Sin roles ni fichas (ADR 008, sustituye al 007). UI tipo VS Code: explorador de niveles+ficheros a la izquierda, pestañas al centro, solo el asistente IA (Lumi) a la derecha.
Sin código de sesión ni perfil de edad (ADR 009): se entra con el nombre del equipo; siempre perfil senior.
SOLUCION.md (raíz): respuestas de todos los niveles, solo para quien dirige; nunca servirlo al cliente.
R6 (bonus) y la Comisión final: ADR 010. Consola del facilitador en /facilitador (PIN). ML: packages/shared/src/ml.ts (el servidor reentrena lo que entrega el equipo); datos con `python data/05_ml_features.py`.
Specs de experiencia y salas: specs/ (README = índice). Lumi es la única ayuda: pistas 1-3 + solución, con borrador comprobado en servidor (ADR 012).
