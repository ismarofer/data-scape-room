# UI 08 · Lienzo del esquema en estrella (R3B)

## Problema de partida
El lienzo usaba React Flow: cada tabla tenía un **punto de conexión arriba y otro abajo** de unos pocos píxeles. Para unir había que pulsar exactamente el punto inferior de un hecho y soltar sobre el punto superior de una dimensión; si se soltaba al revés aparecía «las flechas salen del hecho». En la prueba del 23-nov fue lo más frustrante de la sala 2. La alternativa «Desde / Hasta» existía, pero nadie la veía como la forma normal de hacerlo.

## Ahora (`StarCanvas` en `apps/web/src/M5Tools.tsx`)
1. **Tarjetas grandes y fijas** (no se mueven), en posiciones **mezcladas** (la colocación no delata qué es hecho). Cada una con el nombre **sin prefijo** (`patient`, `hospital`, `date`, `admission`, `condition`; el prefijo `fct_`/`dim_` daba la respuesta), **qué es una fila** («Una fila cada vez que alguien ingresa», «Una fila por centro»), sus **columnas clave** y dos botones **«Hecho» / «Dimensión»** (el elegido se resalta; los hechos se pintan en ámbar).
2. **Unir con dos clics:** pulsar una tarjeta (queda marcada y el mensaje dice «ahora pulsad la tabla con la que se une») y después otra. Pulsar la misma otra vez cancela.
3. **Unir arrastrando desde cualquier punto** de una tarjeta y soltando sobre otra (línea discontinua mientras se arrastra). Funciona con ratón, trackpad y pantalla táctil (`pointer events`).
4. **La dirección la pone el juego:** la unión se guarda como pareja y la flecha va siempre del hecho a la dimensión. Si luego cambian el tipo de una tabla, se reorienta sola.
5. **Uniones que no tienen sentido no se crean** y el mensaje explica por qué: «Dos dimensiones no se unen entre sí…», «Dos hechos no se unen entre sí: comparten dimensiones», «Primero decid si X es un hecho o una dimensión». Si una unión existente queda entre dos del mismo tipo (por cambiar un tipo), sale en rojo discontinuo y bloquea «Comprobar esquema».
6. **Lista de uniones** debajo («admission → date ✕»): ✕ borra una; «Borrar todas las uniones» las quita todas.
6 bis. **Tras entregar con errores**, la tarjeta cuyo tipo está mal sale con borde rojo y la unión que sobra en rojo discontinuo (y ✘ en la lista). La marca se quita al cambiar ese elemento. Las uniones que faltan solo se cuentan.
7. **Sin ratón:** «Unir con menús (sin ratón)», plegado, con «Desde / Hasta / Unir» (usa la misma lógica, así que el orden da igual). Las tarjetas son botones accesibles con Tab + Enter.

## Qué no cambia
- El formato de entrega (`types:…|edges:hecho>dimensión,…`) y el validador del servidor.
- El borrador que recibe Lumi (`setDraft`) y el diagnóstico de qué tipo o unión falla.
- La dificultad conceptual: hay que saber qué es hecho y qué dimensión y qué dimensiones describen cada hecho. Lo que desaparece es la dificultad **motora**.

## Aceptación
E2E: no aparece `fct_` ni `dim_`; un tipo mal a propósito → entregar → tarjeta en rojo → se quita al corregirla; unir una pareja **pulsando primero la dimensión y luego el hecho** (la flecha sale del hecho); dos dimensiones no se unen; el resto con «Desde / Hasta»; 5 uniones y candado abierto.
