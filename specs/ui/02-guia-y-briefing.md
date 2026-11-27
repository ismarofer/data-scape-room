# UI 02 · Historia, guía de la pantalla y briefing de sala

## Historia inicial (`Intro.tsx`)
4 pantallas, una idea cada una, con frases completas (feedback del 26-nov: eran demasiado escuetas; explicar más sin ser verbosos):
1. 🏥 El caso: qué es un alta y un reingreso, por qué preocupa, qué pregunta la Comisión a las 13:00 y por qué nadie se fía de los datos. Datos ficticios.
2. 🕵️ Sois el equipo de datos: qué es y a qué se dedica; las 6 etapas en lista, cada una con una frase de lo que significa.
3. 🔐 Cómo se avanza: niveles como candados, tipos de tarea, equivocarse no pasa nada, Lumi y la ⭐ Confianza de la Comisión.
4. 🤝 Reglas (4 líneas).

«Atrás · contador · Siguiente» van **arriba y fijos**: los botones no cambian de sitio aunque cambie el largo del texto.
El último botón es «Ver la pantalla ▶», que lanza la guía. «Cómo se juega» (barra inferior) vuelve a la historia.

## Guía de la pantalla (`Tour.tsx`) — «todo gris menos una parte»
- Capa oscura sobre todo; un recorte iluminado (borde ámbar) sobre el elemento con `data-tour="…"`; tarjeta al lado con título, 1-2 frases, «Atrás / Siguiente», «Saltar» y contador «3 / 9».
- 9 pasos: `levels`, `project`, `db`, `tabs`, `pane`, `lumi`, `help`, `status`, `statushelp`.
- Teclado: ← → para moverse, Esc para salir. La tarjeta se coloca donde quepa (derecha, izquierda, abajo, arriba). Se recalcula al cambiar el tamaño de ventana. Sin animación si el sistema pide menos movimiento.
- Se puede repetir con «Guía de la pantalla» en la barra inferior.
- Si un elemento no existe (p. ej. sin nivel abierto) la tarjeta sale centrada.

**Aceptación (e2e «guided experience»):** los 9 títulos en orden, cada uno con su recorte visible; al terminar la capa desaparece.

## Briefing de sala (`Briefing.tsx`) — la «fase 0» de cada sala
Respuesta a la pregunta del encargo: **sí, cada sala necesita su fase de explicación**, pero no como un nivel más (no puntúa ni se puede fallar) sino como pantalla de entrada:
- Icono, «SALA 1 · INGESTA», título narrativo, introducción (2 frases).
- **«📚 Antes de empezar»** (`guides.yaml → rooms.*.primer`, opcional): el concepto básico que la sala da por sabido, con un ejemplo pequeño. Sala 1: qué es una tabla (fila, columna, cabecera, identificador, CSV). Sala 2: tablas que se conectan (clave, hechos y dimensiones). Añadido el 26-nov: el alumnado no sabe qué es una tabla.
- «En esta sala vais a:» 3-4 viñetas (`rooms/*.yaml → briefing`).
- Mapa de niveles de la sala (✔ ▶ 🔒) y minutos previstos.
- «Qué aprenderéis» (`guides.yaml → rooms.*.learn`).
- Botón «¡Vamos! ▶».
- Sale antes del primer nivel de cada sala en cada portátil (se recuerda en el navegador). Se reabre con la cabecera del nivel («Sala 1 · Ingesta · nivel 2/4 ⓘ»).
- El briefing de la sala 0 incluye el nombre del hospital, que es la pista del código del tutorial.

**Aceptación:** el speedrun e2e pasa por los 7 briefings comprobando el texto «Sala N · Etapa».
