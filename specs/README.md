# Specs de Código Alta

Especificación funcional de la experiencia, pensada para alumnado de **16 años** que lee poco y rápido. Complementa al spec original (`SPEC-escape-room-datos-sanidad.md`), que sigue valiendo para datos, motor y seguridad. Decisión que la origina: `docs/adr/012-lumi-unica-ayuda-y-experiencia-guiada.md`. Las respuestas exactas siguen solo en `SOLUCION.md`.

## Vocabulario (el mismo en el juego y en estas specs)
| Palabra | Qué es | Ejemplo |
|---|---|---|
| **Sala** | Una etapa del trabajo de datos. Tiene número y etapa. | Sala 1 · Ingesta |
| **Nivel** (o candado) | Una tarea dentro de una sala. Se abre resolviéndola. | «El reenvío» |
| **Briefing** | Pantalla de entrada de cada sala (la «fase 0»). | — |
| **Paso de ayuda** | Pista 1, 2, 3 o la solución, que da Lumi. | — |
| **Borrador** | Lo que el equipo tiene montado en la herramienta sin entregar. | opciones del cargador |

## Mapa de salas
| Sala (id) | Etapa | Niveles | Min | Spec |
|---|---|---|---|---|
| 0 (R0) | Tutorial | 1 | 10 | [salas/00-tutorial.md](salas/00-tutorial.md) |
| 1 (R1) | Ingesta | 4 | 30 | [salas/01-ingesta.md](salas/01-ingesta.md) |
| 2 (R3) | Modelado | 3 | 30 | [salas/02-modelado.md](salas/02-modelado.md) |
| 3 (R4) | Calidad | 4 | 25 | [salas/03-calidad.md](salas/03-calidad.md) |
| 4 (R5) | Visualización | 4 | 25 | [salas/04-visualizacion.md](salas/04-visualizacion.md) |
| 5 (R6) | Predicción (bonus) | 3 | 20 | [salas/05-prediccion.md](salas/05-prediccion.md) |
| F (FINAL) | Presentación | 1 | 20 | [salas/06-presentacion.md](salas/06-presentacion.md) |

Los ids internos (R1, R3…) no cambian: lo que cambia es lo que ve el alumno.

## Specs de interfaz
1. [ui/01-experiencia-general.md](ui/01-experiencia-general.md) — principios, pantalla, flujo, plantilla de nivel, reglas de texto.
2. [ui/02-guia-y-briefing.md](ui/02-guia-y-briefing.md) — historia inicial, guía de la pantalla (spotlight) y briefing de sala.
3. [ui/03-asistente-lumi.md](ui/03-asistente-lumi.md) — Lumi como única ayuda: contexto, escalera, reglas, fallback.
4. [ui/04-laboratorio-de-preguntas.md](ui/04-laboratorio-de-preguntas.md) — el «asistente de SQL».
5. [ui/05-fichas-que-es-esto.md](ui/05-fichas-que-es-esto.md) — ayuda unificada de ficheros, tablas y modelos; explorador.
6. [ui/06-medidores-y-puntos.md](ui/06-medidores-y-puntos.md) — que se note cada subida y bajada.
7. [ui/07-constructor-del-modelo.md](ui/07-constructor-del-modelo.md) — R3C sin SQL obligatorio.

## Validación
[validacion.md](validacion.md): dificultad de cada nivel para 16 años, simplificaciones aplicadas, pendientes y cómo se ha probado.

## Cómo se prueba
- `npm test` — motor, escalera de ayuda, diagnóstico de borradores, Lumi (con y sin modelo), entrevistas en gallego, fuga de respuestas en el bundle.
- `npm run e2e` (servidor en :3300) — speedrun de los 20 niveles con briefings, guía de pantalla paso a paso, Lumi y avisos de puntos, dos portátiles en el mismo equipo, consola del facilitador.
- `npm run content:validate` — esquema, gallego, soluciones presentes y longitud de textos.
