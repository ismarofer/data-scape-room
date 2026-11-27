# ADR 012 — Lumi como única ayuda y experiencia guiada

Estado: aceptada (2026-11-19). Especificación completa en `specs/`.

## Contexto
Prueba interna con la mirada de un alumno de 16 años: Lumi no servía (no sabía qué estaba probando el equipo ni la respuesta), el botón de pistas competía con ella, los textos eran largos, los medidores cambiaban sin que nadie lo notara, no había explicación de la interfaz ni de cada sala, y las tablas de la base de datos no tenían ninguna ayuda.

## Decisión
- **Se elimina el botón «Pedir pista».** Las 3 pistas de cada candado y una nueva **solución** (`solution`, con `{answer}` = valor real de `data/dist/answers.json`) forman la **escalera de ayuda de Lumi**: pista 1 → 2 → 3 → solución.
- **Desbloqueo:** el paso *n* se abre con `help_gate_attempts[n-1]` intentos fallidos **o** `help_gate_minutes[n-1]` minutos en el nivel (`[0,1,2,2]` / `[0,2,4,6]` desde el ADR 013; antes `[0,1,2,3]` / `[0,3,6,10]`). Coste: 5, 10, 20 y 40 puntos (`hint_penalty`, `solution_penalty`). Se piden con un botón en el panel de Lumi; el texto es contenido fijo y queda en el chat de todos los portátiles.
- **Lumi conoce, solo en servidor:** el nivel, sus pasos, la solución completa, el **borrador** del equipo (lo que tienen montado en la herramienta, en el mismo formato que entregarían) **comprobado por el servidor** (`Engine.diagnose`, sin efectos), sus últimas entregas y la pestaña que miran. Puede decir qué parte de lo que tienen está mal desde el nivel 0; la solución solo en el nivel 4 (filtro de fuga activo por debajo).
- **Sin modelo de IA** (o sin presupuesto) Lumi sigue siendo útil: pasos del nivel, diagnóstico del borrador, última pista o solución.
- **Experiencia guiada:** historia en 4 pantallas + **guía de la pantalla** (spotlight paso a paso), **briefing de sala** antes de su primer nivel, el mismo esquema en todos los niveles (Misión · Pasos · herramienta · qué entregar · «Saber más» plegado), **avisos visibles** de cada cambio de puntos y medidores con su motivo, y la ficha **«¿Qué es esto?»** igual para ficheros, tablas y modelos (`content/tables.yaml`).
- **Salas con número y etapa** sin cambiar ids: 0 Tutorial, 1 Ingesta, 2 Modelado, 3 Calidad, 4 Visualización, 5 Predicción (bonus), F Presentación.
- Se quita el medidor «Créditos de IA» de la barra (Ada libre no tiene interfaz) y se muestra la puntuación.

## Consecuencias
- La solución sale del servidor solo cuando el equipo la pide y paga; nunca está en el bundle (test `leak.test.ts`).
- `content:validate` exige `solution` en todo candado salvo la Comisión y avisa de textos largos.
- El facilitador ve en «pistas» un número de 0 a 4 (4 = solución).
