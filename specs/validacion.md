# Validación: dificultad, explicaciones y fases (19-nov-2026)

Revisión de los 20 niveles con la mirada de un alumno de 16 años. Escala 1 (trivial) - 5 (bloqueante sin ayuda).

## 1. Dificultad por nivel
| Sala | Nivel | Antes | Ahora | Qué se hizo |
|---|---|---|---|---|
| 0 | El primer candado | 1 | 1 | Enseña además a pedir ayuda. |
| 1 | La bandeja de entrada | 3 | 3 | Textos cortos, ficha del fichero, Lumi ve opciones y diagnóstico por fichero. |
| 1 | El reenvío | 2 | 2 | Pasos con las preguntas exactas. |
| 1 | Auditoría de Ada | **4** | **2-3** | «🔬 Comprobar» prepara el laboratorio en cada afirmación. |
| 1 | Radar RGPD | 3 | 3 | Términos explicados en la misión; regla práctica en los pasos. |
| 2 | El protocolo | 2 | 2 | — |
| 2 | Esquema en estrella | 3 | 3 | Hecho/dimensión con ejemplo en la misión. |
| 2 | Modelo de reingreso | **5** | **2-3** | Piezas en castellano, protocolo al lado, sin SQL obligatorio. |
| 3 | Tablero de pruebas | 2 | 2 | Causas explicadas entre paréntesis. |
| 3 | Entrevistas | 3 (gl: 5) | 3 | Palabras clave en gallego; preguntas de ejemplo en la pista 3. |
| 3 | Veredicto | 2 | 2 | — |
| 3 | Registros excluidos | 1 | 1 | — |
| 4 | KPI con sentido | 2 | 2 | — |
| 4 | Constructor de dashboard | 1 | 1 | — |
| 4 | Revisión del crítico | 4 | 3-4 | Reglas repartidas en la escalera; Lumi ve hallazgos. Propuesta en sala 4. |
| 4 | Centro con mayor tasa | 1 | 1 | — |
| 5 | Entrenar / Umbral / Equidad | 3 / 2 / 3 | igual | AUC explicado en una línea. |
| F | La Comisión | 3 | 3 | Fórmula «cifra + límite + propuesta». |

Curva resultante: no hay ningún nivel ≥ 4 sin ayuda específica; los picos (R1C, R3C) bajaron a 2-3; cada sala empieza con algo asequible.

## 2. Explicaciones
- Misión ≤ 55 palabras, 3-4 pasos ≤ 30 palabras, «qué escribir» ≤ 35 palabras. **Los 20 niveles cumplen** (`content:validate` sin avisos).
- Lo largo (por qué importa, profesión, glosario) pasa a «📚 Saber más», plegado.
- Eliminadas referencias obsoletas: roles, «ficha del rol», «Sala 2», créditos de IA, promesas de auditoría y bonus de tiempo que no existen.

## 3. ¿Fase de explicación en cada sala?
Sí: **briefing** antes del primer nivel de cada sala (ver [UI 02](ui/02-guia-y-briefing.md)). No es un nivel (no puntúa), se ve una vez por portátil y se puede reabrir. Nombres de sala acordados: Tutorial, Ingesta, Modelado, **Calidad** (añadida: la investigación de datos sucios es una etapa propia), Visualización, Predicción (bonus) y Presentación.

## 4. Otras mejoras aplicadas
Lumi como única ayuda con escalera y solución ([UI 03](ui/03-asistente-lumi.md)); guía de pantalla con spotlight; ficha «¿Qué es esto?» unificada para ficheros, tablas y modelos; columnas plegadas en la base de datos; avisos de puntos y medidores; tecnología fuera de la vista (nombres de capas, SQL legible, «Calcular» en vez de «Ejecutar modelos y tests»).

## 5. Pendiente (no bloquea el evento)
- Ensayo con alumnado real (M10): medir minutos y ayudas por nivel y ajustar `help_gate_*` y costes.
- Revisión del gallego por persona nativa (todo el texto nuevo está en gl).
- Propuestas marcadas en cada sala (⚠ en la lista del cargador, explicación del resultado del laboratorio, plantilla de respuesta para la Comisión, historial de medidores).
- Lector de pantalla y navegadores distintos de Edge.

## 6. Cómo se ha probado
| Prueba | Resultado (19-nov) |
|---|---|
| `npm test` (motor, Lumi, escalera, diagnóstico, gallego, fuga en bundle) | 53/53 ✔ |
| `npm run e2e` (speedrun 20 niveles, guía, Lumi, 2 portátiles, facilitador) | 4/4 ✔ |
| `npm run content:validate` | OK, 0 avisos |
| `npm run typecheck` | OK |
| Capturas en Edge 1440×860 + conversación con la IA real en 4 niveles | revisado; 1 fuga de Lumi corregida en el prompt |
