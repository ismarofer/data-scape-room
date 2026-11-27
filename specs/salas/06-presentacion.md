# Final · Presentación (FINAL) — «La Comisión»

**Objetivo:** contar el trabajo a quien decide, que no es técnico: una cifra, si se puede fiar y qué hacer. **~17 min** (5 preguntas × ~3 min + resultado).
**Briefing:** 5 preguntas sencillas de tres personas que no saben de datos · apoyarse en el resumen del trabajo · ver resultado, informe e insignias.

## Nivel único · La Comisión (`f_comision`)
| | |
|---|---|
| Cambio 27-nov | Antes eran 6 preguntas técnicas (denominadores, SSN, reenvíos…) y había que adjuntar «tarjetas de evidencia». Un cliente no técnico no pregunta así. Ahora son **5 preguntas funcionales** y, debajo, un **resumen fijo en tarjetas** de todo lo hecho; no se adjunta nada. |
| Preguntas (`commission.yaml`) | 1 Valcárcel: de cada 100 altas, ¿cuántas vuelven antes de un mes? ¿Mucho o poco? · 2 Pardo: ¿me puedo fiar de la cifra? (variante si quedaron visitas repetidas) · 3 Louzao: ¿en qué hospital o tipo de paciente me fijo? · 4 Pardo: ¿están protegidos los pacientes? (variante si hubo un fallo de privacidad) · 5 Valcárcel: ¿qué hacemos mañana y qué no? (variante con el aviso de riesgo si se hizo el bonus). Con IA se reformulan sin tecnicismos (`commission.md`). |
| Información en pantalla | Recuadro «¿Qué buscan?» (no saben de datos; responder corto, como a la familia). La pregunta con quién la hace y **«💡 Una buena respuesta: …»** (qué debería incluir y en qué tarjeta mirar). **«📋 Lo que habéis hecho y decidido»**: tarjetas de 1-2 frases con cifras, solo de lo que el equipo ha completado: 📥 Los datos · 🔐 Privacidad · 📏 Qué es un reingreso · 🔎 Datos raros · 📊 La cifra (tasa limpia) · 🏥 Dónde (más y menos reingresos con el mínimo del equipo, y los centros que no llegan) · 👥 Por edad · 📈 Vuestro dashboard (títulos de sus gráficos) · 🤖 Aviso de riesgo (bonus). Las cifras salen del modelo final limpio (`data/dist/canon/fct_admission_clean.csv`) y de las respuestas canónicas. |
| Evaluación | Claridad (sin tecnicismos), evidencia (cifras y hechos; ya no cuenta adjuntar), límites y propuesta. El evaluador con IA ve el mismo resumen y marca como error lo que lo contradiga. Tras cada respuesta, un consejo en positivo. |
| Tono | Preguntas amables y con interés real; evaluador generoso; los tres finales se presentan como buenos resultados. |
| Dificultad | 2/5 — escribir, con la información delante. No hay respuesta única. Lumi tiene 3 pistas de redacción; **no hay solución**. |

## Probado
Speedrun e2e: resumen con «La cifra» e «Illa Verde», sin casillas para adjuntar, primera pregunta «de cada 100», consejo en cada pregunta, 5 respuestas y pantalla final con votos. Unit: 5 turnos, pregunta funcional con consejo, tarjeta con la tasa limpia (10,0 %) y el centro con más reingresos.
