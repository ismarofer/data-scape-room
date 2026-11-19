# UI 01 · Experiencia general

## Para quién
Equipos de 2-3 alumnos de ~16 años, 3 horas, uno o varios portátiles con el mismo nombre de equipo. No saben qué es SQL, dbt ni una base de datos. Leen poco: si un texto pasa de dos líneas, se lo saltan.

## Principios
1. **La tecnología no se mete en medio.** Nadie necesita saber qué herramienta hay debajo. En pantalla no aparecen dbt, DuckDB, Jinja, `staging`, `marts`, `ref()` ni «tests»: se dice «el cargador», «el laboratorio», «el cálculo», «comprobaciones», «datos limpios». El SQL se *enseña* (laboratorio, «Ver el código») pero nunca hace falta escribirlo.
2. **Siempre el mismo sitio para lo mismo.** Misión arriba, pasos debajo, herramienta, entrega al final; ayuda siempre a la derecha (Lumi); ficha «¿Qué es esto?» arriba de cualquier fichero o tabla.
3. **Al grano, pero explicándolo todo.** Frases cortas, imperativo, una idea por línea. Cada palabra técnica se explica entre paréntesis la primera vez o está en el glosario.
4. **Equivocarse es gratis; pedir ayuda cuesta poco.** Fallar una entrega no resta (salvo marcar como falsa una afirmación cierta en R1C). Las ayudas restan pocos puntos y están siempre visibles.
5. **Todo cambio se nota.** Puntos y medidores avisan al subir o bajar, con el motivo.

## Pantalla (tipo VS Code)
| Zona | Contenido |
|---|---|
| Izquierda | **Niveles** (agrupados por sala: «1 · Ingesta», con ✔ ▶ 🔒), **Proyecto** (`data/raw`, `models` desde R3C, `docs`), **Base de datos** (capas bronce/plata/oro con nombre amigable; columnas **plegadas** por defecto). |
| Centro | Pestañas. «▶ Nivel actual» fija; ficheros, tablas y niveles superados se abren al lado. |
| Derecha | Solo **Lumi** (chat + escalera de ayudas). |
| Abajo | Tiempo, 🏆 puntos, 🤝 confianza, 🛡 cumplimiento, 🧹 calidad, ❓ medidores, 📖 glosario, «Cómo se juega», «Guía de la pantalla», tema, idioma. |

## Flujo
Entrar con nombre de equipo → historia (4 pantallas) → **guía de la pantalla** → **briefing de la sala 0** → nivel → … → al entrar en cada sala nueva, su **briefing** → Comisión → final.

## Plantilla de nivel (igual en los 20)
1. **Cabecera**: «🧭 Sala 1 · Ingesta · nivel 2/4 ⓘ» (clic = volver a ver el briefing), título, «🏆 120 puntos · ⏱ ~10 min».
2. **🎯 Misión** (`story`): ≤ 55 palabras. Qué hay que conseguir y por qué.
3. **👣 Pasos** (`guides.yaml → steps`): 3-4 pasos de ≤ 30 palabras, siempre visibles.
4. **📚 Saber más** (plegado): para qué sirve, en la vida real, profesión, palabras clave.
5. **Herramienta** del nivel.
6. **✍️ Qué tenéis que escribir** (`answer_hint`, ≤ 35 palabras) + caja + «Probar», solo en niveles de código.
7. **Respuesta del juego**: correcto, o qué elementos están mal (nunca cuál es el bueno).
8. **🤔 ¿Atascados? → Preguntad a Lumi** (enfoca el chat).
9. En niveles superados: las ayudas usadas y, si la pidieron, la solución.

`content:validate` avisa si una misión, un paso o un «qué escribir» supera esos límites.

## Reglas de texto
- Tú/vosotros, imperativo: «Pulsad», «Elegid».
- Nombres de botones entre «comillas latinas», idénticos a la pantalla.
- Números con cifra; nada de dobles negaciones.
- es + gl siempre (el validador avisa si falta gallego).

## Estado
Implementado (19-nov): todo lo anterior. Pendiente: revisión del gallego por persona nativa; modo proyección; prueba con lector de pantalla.
