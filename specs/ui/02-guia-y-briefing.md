# UI 02 · Historia, guía de la pantalla y briefing de sala

## Historia inicial (`Intro.tsx`)
4 pantallas, una idea cada una:
1. 🏥 El problema (reingresos) y la cita de las 13:00. Datos ficticios.
2. 🕵️ Sois el equipo de datos: las 6 etapas como chips (Sala 1 Ingesta … Final Presentación).
3. 🔐 Cómo se avanza: niveles, equivocarse no pasa nada, Lumi ayuda y sus pistas cuestan puntos.
4. 🤝 Reglas (4 líneas).
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
- «En esta sala vais a:» 3-4 viñetas (`rooms/*.yaml → briefing`).
- Mapa de niveles de la sala (✔ ▶ 🔒) y minutos previstos.
- «Qué aprenderéis» (`guides.yaml → rooms.*.learn`).
- Botón «¡Vamos! ▶».
- Sale antes del primer nivel de cada sala en cada portátil (se recuerda en el navegador). Se reabre con la cabecera del nivel («Sala 1 · Ingesta · nivel 2/4 ⓘ»).
- El briefing de la sala 0 incluye el nombre del hospital, que es la pista del código del tutorial.

**Aceptación:** el speedrun e2e pasa por los 7 briefings comprobando el texto «Sala N · Etapa».
