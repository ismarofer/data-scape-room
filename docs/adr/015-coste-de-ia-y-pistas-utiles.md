# ADR 015 · Usar la IA cuesta confianza y las pistas valen la pena

- **Estado:** aceptado (27-nov-2026). Modifica los costes de ayuda del ADR 012 y la tabla del ADR 014.

## Contexto
Lumi respondía gratis a todo y las pistas costaban poco (−1/−2/−3, solución −5), pero eran vagas: el equipo preguntaba sin pensar y las pistas apenas desatascaban.

## Decisión
1. **Cada pregunta a Lumi baja 1** la Confianza de la Comisión (también las preguntas rápidas). Los mensajes bloqueados (datos personales, intento de saltar reglas) no cuentan. El aviso dice «Pregunta a Lumi · ⭐ … −1» y bajo la caja de texto se recuerda el coste.
2. **Cada pista baja 5** y **la solución 10** (`hint_penalty: [5, 5, 5]`, `solution_penalty: 10`). La desbloqueo por intentos o tiempo no cambia.
3. **Pistas mucho más útiles** en los 18 niveles (es + gl): la 1 explica cómo se hace y resuelve la primera parte; la 2, la mayor parte con los valores reales; la 3, todo menos el último paso (la cifra o el nombre que se escribe). La solución sigue siendo la única que da la cifra.
4. Lumi puede repetir y explicar lo que ya dicen las pistas dadas, sin ir más allá de la última (prompt `lumi.md`).
5. Las **entrevistas** (Noa y Brais) y el **crítico del dashboard** son el propio nivel: no cuestan. Se puede cambiar en `session.yaml` → `ai_use_penalty: { lumi: 1, npc: 0, critic: 0 }`. La Comisión tampoco.

## Consecuencias
- Un nivel superado da +2…+4: una pista cuesta más de lo que da un nivel. Pedir ayuda es una decisión, no un reflejo.
- El servidor cobra (`Engine.chargeAi`) y lo apunta en `events_log` (`ai_use`); el estado lleva `aiCost` para la interfaz.
