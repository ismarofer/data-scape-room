# UI 01 · Experiencia general

## Para quién
Equipos de 2-3 alumnos de ~16 años, 3 horas, uno o varios portátiles con el mismo nombre de equipo. No saben qué es SQL, dbt ni una base de datos. Leen poco: si un texto pasa de dos líneas, se lo saltan.

## Principios
1. **La tecnología no se mete en medio.** Nadie necesita saber qué herramienta hay debajo. En pantalla no aparecen dbt, DuckDB, Jinja, `staging`, `marts`, `ref()` ni «tests»: se dice «el cargador», «el laboratorio», «el cálculo», «comprobaciones», «datos limpios». El SQL se *enseña* (laboratorio, «Ver el código») pero nunca hace falta escribirlo.
2. **Siempre el mismo sitio para lo mismo.** Misión arriba, pasos debajo, herramienta, entrega al final; ayuda siempre a la derecha (Lumi); ficha «¿Qué es esto?» arriba de cualquier fichero o tabla.
3. **Al grano, pero explicándolo todo.** Frases cortas, imperativo, una idea por línea. Cada palabra técnica se explica entre paréntesis la primera vez o está en el glosario.
4. **Equivocarse es gratis; pedir ayuda cuesta poco.** Fallar una entrega no resta (salvo marcar como falsa una afirmación cierta en R1C). Las ayudas bajan un poco la confianza y están siempre visibles.
5. **Todo cambio se nota.** La confianza avisa al subir o bajar, con el motivo.
6. **Se resuelve sin salir de la pantalla** (ADR 013). Cualquier dato que haga falta para un nivel (un nombre, una cifra, el riesgo de una columna, el centro raro) está en su misión, sus pasos, su herramienta o sus tarjetas. La historia, el briefing, los niveles anteriores y `docs/` pueden repetirlo o ampliarlo, nunca ser la única fuente.
7. **Nada de puntería.** Ninguna acción exige acertar con un objetivo pequeño: los objetivos de clic y arrastre son la tarjeta o el botón entero.
8. **Los pasos enseñan el método, los documentos lo explican** (ADR 014). Los 👣 Pasos dicen dónde mirar y cómo trabajar, no qué opción elegir. Cada nivel enlaza su **📄 Documentación del nivel** (se abre en pestaña), con más explicación y, si hace falta, otro ejemplo. Lo concreto queda para las pistas de Lumi.
9. **Lo que falla se ve en rojo.** Tras una entrega incorrecta, el elemento que está mal (desplegable, caja, tarjeta, unión, columna) se pinta en rojo hasta que se cambia. Nunca se marca lo que falta ni se dice cuál es lo bueno.
10. **El Laboratorio de preguntas está siempre a mano.** Es una pestaña que se abre desde el nivel, la barra inferior o el explorador, y se cierra y reabre cuando se quiera; pregunta a todas las tablas del navegador.
11. **«Respuesta», no «código».** Lo que se escribe para avanzar se llama respuesta en todos los textos.

## Pantalla (tipo VS Code)
| Zona | Contenido |
|---|---|
| Izquierda | **Niveles** (agrupados por sala: «1 · Ingesta», con ✔ ▶ 🔒), **Proyecto** (`data/raw`, `models` desde R3C, `docs`), **Base de datos** (capas bronce/plata/oro con nombre amigable; columnas **plegadas** por defecto). |
| Centro | Pestañas. «▶ Nivel actual» fija; ficheros, tablas y niveles superados se abren al lado. |
| Derecha | Solo **Lumi** (chat + escalera de ayudas). |
| Abajo | Tiempo, ⭐ Confianza de la Comisión (el único medidor, [UI 06](06-medidores-y-puntos.md)), ❓ confianza, 📖 glosario, «Cómo se juega», «Guía de la pantalla», tema, idioma. |

## Flujo
Entrar con nombre de equipo → historia (4 pantallas) → **guía de la pantalla** → **briefing de la sala 0** → nivel → … → al entrar en cada sala nueva, su **briefing** → Comisión → final.

## Plantilla de nivel (igual en los 19)
1. **Cabecera**: «🧭 Sala 1 · Ingesta · nivel 2/4 ⓘ» (clic = volver a ver el briefing), título, «⏱ ~10 min».
2. **🎯 Misión** (`story`): ≤ 55 palabras. Qué hay que conseguir y por qué.
2 bis. **📄 Documentación del nivel**: botones a sus documentos (`docs_needed`).
3. **👣 Pasos** (`guides.yaml → steps`): 3-4 pasos de ≤ 30 palabras, siempre visibles.
4. **📚 Saber más** (plegado): para qué sirve, en la vida real, profesión, palabras clave.
5. **Herramienta** del nivel.
6. **✍️ Qué tenéis que escribir** (`answer_hint`, ≤ 35 palabras) + caja + «Probar», solo en niveles de código.
7. **Respuesta del juego**: correcto, o qué elementos están mal (en rojo en la herramienta y en la lista; nunca cuál es el bueno).
7 bis. **🔬 Laboratorio de preguntas** (abrir / cerrar) en los niveles que no lo traen ya.
8. **🤔 ¿Atascados? → Preguntad a Lumi** (enfoca el chat).
9. En niveles superados: las ayudas usadas y, si la pidieron, la solución. Además (**27-nov**), **«📋 Lo que hicisteis (solo lectura)»**: **la misma herramienta del nivel**, rellena con lo que entregaron y desactivada (un `fieldset disabled`; los botones de entregar se ocultan), con los resultados recalculados: el cargador con la vista previa de cada fichero; las opciones del reenvío con la elegida marcada y las visitas cargadas; las afirmaciones de Ada marcadas; el radar con cada columna en su cajón; la estrella dibujada; el constructor con sus piezas y las cifras de su cálculo; las tarjetas de problemas y **las conversaciones con Noa y Brais**; el veredicto; el KPI con la tabla de centros; el dashboard con sus gráficos y la revisión del crítico (reglas, sin volver a llamar a la IA); el modelo reentrenado con sus medidas, la matriz, la importancia de variables y el gráfico de cómo predice; la simulación del umbral; la equidad con la decisión y la frase; y la Comisión con preguntas, respuestas, votos e informe. Lo que la herramienta enseña no se guarda ni cambia el borrador del nivel abierto (que solo puede escribir el nivel abierto). El servidor guarda la entrega aceptada completa (evento `solved`); los niveles pasados con el atajo del facilitador no tienen nada que enseñar y lo dicen.

`content:validate` avisa si una misión, un paso o un «qué escribir» supera esos límites.

## Reglas de texto
- Tú/vosotros, imperativo: «Pulsad», «Elegid».
- Nombres de botones entre «comillas latinas», idénticos a la pantalla.
- Números con cifra; nada de dobles negaciones.
- es + gl siempre (el validador avisa si falta gallego).

## Estado
Implementado (19-nov): todo lo anterior. Pendiente: revisión del gallego por persona nativa; modo proyección; prueba con lector de pantalla.
