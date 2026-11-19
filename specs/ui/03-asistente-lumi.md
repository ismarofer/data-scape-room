# UI 03 · Lumi, el asistente de IA (única ayuda)

## Problema de partida
Lumi «no sabía nada»: veía el título del nivel y las pistas ya pedidas, no lo que el equipo estaba probando ni la respuesta, y tenía prohibido decir si algo estaba bien. Respondía con preguntas genéricas. A la vez, un botón de pistas aparte hacía lo mismo peor.

## Qué es ahora
Lumi es **la única ayuda del juego**: explica, comprueba lo que tenéis y, si hace falta, os lleva hasta la solución tras varios intentos.

### Lo que sabe (solo en servidor; nunca viaja al navegador)
| Dato | Origen |
|---|---|
| Nivel, misión, pasos, qué hay que entregar | contenido del candado y `guides.yaml` |
| **Solución completa** con el valor real | `solution` del candado + `data/dist/answers.json` |
| **Borrador**: lo que hay montado en la herramienta | cada herramienta llama a `setDraft(lockId, borrador, texto)`; el servidor lo **comprueba** con `Engine.diagnose()` (mismo validador que la entrega, sin efectos) |
| Últimas 3 entregas y qué falló | `events_log` (`submit` guarda código recortado y elementos mal) |
| Pestaña abierta, tablas cargadas, última consulta del laboratorio | `workContext` |
| Progreso, medidores, decisiones, minutos en el nivel | `Engine.snapshot()` |
| Historial de la conversación | `ai_messages` (8 últimos turnos) |

### Escalera de ayuda
| Paso | Qué da | Se abre con… | Coste |
|---|---|---|---|
| 0 (siempre) | Explicaciones, cómo usar la herramienta, **qué parte de lo vuestro está mal** (no cuál es lo bueno) | — | 0 |
| Pista 1 | Dónde mirar | al instante | −5 |
| Pista 2 | Método concreto | 1 intento fallido **o** 3 min | −10 |
| Pista 3 | Casi la solución | 2 intentos **o** 6 min | −20 |
| 🔑 Solución | La respuesta, paso a paso | 3 intentos **o** 10 min (y confirmación) | −40 |
Configurable en `content/session.yaml` (`help_gate_attempts`, `help_gate_minutes`, `hint_penalty`, `solution_penalty`). El paso se pide con el botón del panel; el texto es contenido fijo (no depende del modelo) y se guarda en el chat, así que lo ven todos los portátiles del equipo. La Comisión no tiene solución (solo 3 pistas).

### Interfaz (`Chat.tsx`)
- Cabecera: avatar, «IA», aviso de que puede equivocarse.
- Caja «Ayudas en este nivel»: 4 círculos (1 2 3 🔑), botón «💡 Dame una pista (−5 puntos)» / «🔑 Ver la solución (−40 puntos)», y si está cerrado «⏳ Se abre tras 1 intento más o en 2:30 min» con cuenta atrás.
- Conversación con separadores por nivel; los pasos de ayuda resaltados en ámbar; indicador «escribiendo».
- 4 preguntas rápidas: «¿Qué hay que hacer aquí?», «¿Vamos bien?», «No entiendo una palabra», «¿Para qué sirve esta pantalla?».
- Caja de texto multilínea (Enter envía). El botón «Preguntad a Lumi» de cada nivel enfoca la caja.
- El historial se carga del servidor (`GET /api/ai/lumi/history/:teamId`).

### Reglas del modelo (`content/prompts/lumi.md`)
- ≤ 60 palabras, frases cortas, termina con un paso o una pregunta. Sin nombres de herramientas internas.
- La comprobación del juego manda: nunca la contradice; si dice CORRECTO, «entregadlo».
- Niveles 0-3: **solo puede hablar de lo que el equipo ha elegido**; no puede señalar opciones buenas, afirmaciones falsas, columnas que faltan ni valores de la solución.
- Nivel 4: da la solución clara.
- Pedir la respuesta no es un ataque: se contesta con cariño y explicando cómo desbloquear. Las inyecciones reales («ignora tus reglas») se bloquean sin llamar al modelo.
- Filtro de fuga: por debajo del nivel 4, si el texto contiene el código del candado (hash), se sustituye.

### Sin modelo (o presupuesto agotado / error)
Respuestas fijas pero útiles: pasos del nivel si preguntan qué hacer, diagnóstico del borrador («Revisad: el fichero encounters_H3.csv»), cómo desbloquear si piden la respuesta, última pista, o la solución si ya está pedida.

## Endpoints
`POST /api/ai/lumi` (con `work.draft`, `work.draftText`, `work.view`), `POST /api/ai/lumi/help {level}`, `GET /api/ai/lumi/history/:teamId`.

## Probado
- Unit: el prompt lleva solución, diagnóstico y últimas entregas; filtro de fuga antes del nivel 4 y no después; modo sin modelo (pasos, diagnóstico sin revelar lo correcto, solución en nivel 4); pasos de ayuda en el historial; escalera con desbloqueo por intentos y por tiempo y penalizaciones 5/10/20/40; la solución nunca está en el estado antes de pedirla.
- E2E: pregunta rápida con respuesta, pista 1 en el chat y en un aviso «Puntos −5», pista 2 bloqueada hasta un intento fallido.
- Manual con IA real (19-nov): respuestas útiles y breves en R0, R1A, R1B, R1C. Se detectó que en R1C señalaba qué afirmaciones mirar con nivel 0 → regla reforzada en el prompt. **Volver a comprobar en el ensayo.**

## Pendiente
- Medir en el ensayo cuántas ayudas se piden por nivel y ajustar tiempos/costes.
- Si el modelo vuelve a filtrar pistas por debajo del nivel concedido, añadir una segunda pasada de verificación (el modelo «juez» ya existe para la Comisión).
