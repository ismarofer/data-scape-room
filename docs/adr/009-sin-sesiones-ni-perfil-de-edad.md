# ADR 009 — Sin código de sesión, sin perfil de edad, IA siempre live

Estado: aceptada (2026-11-18).

- **Sin código de sesión.** Se entra solo con el nombre del equipo. El servidor tiene una única sesión implícita (`MAIN`, creada la primera vez que se necesita); los equipos son únicos por nombre dentro de ella. Varios portátiles con el mismo nombre comparten equipo. Desaparecen `POST /api/sessions` y `/api/facilitator/ai-mode`; `pause`, `overview` y `master-key` (con PIN) actúan sobre todos los equipos.
- **Siempre perfil «senior»:** se elimina el perfil de edad. Pista disponible a los 7 min (`hint_gate_minutes: 7`), caja de SQL libre en las comprobaciones rápidas, SQL compilado siempre visible en el constructor de modelos, y todos los candados están disponibles (se elimina `senior_only`).
- **IA siempre live** (Azure AI Foundry, ADR 003). Desaparece `AI_MODE`. Se mantiene solo la degradación a textos fijos si el modelo no está configurado, se agota el presupuesto por ejecución (`AI_BUDGET_EUR_PER_SESSION`) o falla una llamada.
- Consecuencia práctica: los datos de equipos persisten en `data/game.sqlite`; para empezar de cero con un nombre ya usado hay que elegir otro nombre (o borrar el fichero con el servidor parado).
