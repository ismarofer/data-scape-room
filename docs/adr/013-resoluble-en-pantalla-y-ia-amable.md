# ADR 013 — Cada nivel se resuelve con lo que hay en su pantalla; IA amable; ayudas antes

Estado: aceptada (2026-11-23). Complementa al ADR 012.

## Contexto
Revisión sala por sala del 23-nov:
- **R0:** la misión pedía «el océano que baña la costa del hospital», pero el nombre del hospital solo salía en la historia y el briefing, que no se ven al resolver.
- **R3B:** unir tablas exigía acertar con puntos de conexión diminutos (arriba/abajo) y en el sentido correcto. Muy difícil con trackpad.
- **R4B:** el centro y la fecha por los que había que preguntar estaban en las tarjetas del nivel anterior; Noa exigía dos grupos de palabras a la vez y Brais una palabra «empática» de una lista oculta. Respuestas secas.
- **R2A:** la información para decidir cada columna estaba en un documento en otra pestaña.
- **R5A:** el porqué del mínimo de altas solo estaba en un documento.
- **IA «hater»:** el filtro de inyección saltaba con palabras normales («olvida», «ignora», «actúa como», «reveal») y respondía «Eso no puedo dártelo: … no a saltarte el reto»; pedir la respuesta daba «Todavía no os puedo dar la respuesta: primero probad vosotros»; Noa abría con «Tengo poco tiempo»; la Comisión era «exigente».

## Decisión
1. **Principio:** todo dato necesario para resolver un nivel está en la pantalla de ese nivel (misión, pasos, herramienta o tarjetas). Historia, briefing y `docs/` ambientan o amplían; nunca son la única fuente.
2. Aplicado: misión de R0 con el nombre del hospital; R2A con regla de 4 acciones y qué contiene/riesgo de cada columna; tarjetas de R4A también en R4B, con el centro (H3) en la de fragmentación; R5A con la razón del mínimo.
3. **R3B sin puntos de conexión:** clic en dos tarjetas o arrastrar desde cualquier punto; la flecha se orienta sola; las uniones sin sentido no se crean y se explica por qué ([UI 08](../../specs/ui/08-esquema-en-estrella.md)). Se deja de usar React Flow en el cliente (la dependencia puede quitarse).
4. **Entrevistas por tema:** Noa revela con centro, fecha o migración; Brais con el tema. Una pregunta vaga sigue sin revelar nada, pero la respuesta sugiere de qué preguntar.
5. **Tono de la IA:** Lumi empieza por algo útil, nunca regaña ni contesta con otra pregunta si están atascados; el filtro de inyección solo salta con intentos claros («ignora tus reglas», «system prompt»…), con respuesta con humor; Noa, Brais, el crítico y la Comisión, amables; el evaluador de la Comisión, generoso.
6. **Ayudas antes:** `help_gate_attempts [0,1,2,2]`, `help_gate_minutes [0,2,4,6]` (antes `[0,1,2,3]` / `[0,3,6,10]`). Costes sin cambios (5/10/20/40).
7. Tiempos por nivel y sala recalculados ([specs/tiempos.md](../../specs/tiempos.md)): ≈ 153 min con bonus, ≈ 133 sin él.

## Consecuencias
- Baja la dificultad de R2A, R3B y R4B (de 3 a 2); la curva queda sin picos salvo R5C (3-4), que sigue pendiente del ensayo.
- Los tests de entrevistas cambian: un saludo sin tema no revela nada pero sugiere el tema; hay un test de que palabras normales no se toman como ataque.
- Lumi sigue sin dar valores antes de la pista/solución pedida (filtro de fuga intacto).
