# UI 04 · Laboratorio de preguntas (asistente de SQL)

Se usa en R1B (contar visitas distintas) y R1C (auditar a Ada). Hace preguntas a las tablas **sin escribir SQL**.

## Cómo funciona
1. «¿Sobre qué tabla preguntas?» — cada tabla con su nombre amigable («encounters — todos los encuentros de los 4 hospitales juntos»).
2. «¿Qué quieres saber?» — 8 preguntas en castellano: contar filas, contar valores distintos, ver valores y cuántas veces, mínimo y máximo, contar repetidos, ver repetidos, filas cuyo valor no está en otra tabla, ver 10 filas.
3. «¿En qué columna?» — **cada columna con su significado** (de `content/tables.yaml`), p. ej. «ssn — número de identificación de la persona…».
4. Condiciones opcionales (hasta 3, todas a la vez): es igual a / distinta de / está vacía / no está vacía / contiene.
5. Se ve la SQL que escribe el laboratorio (para aprender, no para editar) y «▶ Hacer la pregunta». Resultado en tabla.
6. «¿Qué es SQL?» plegado, con 6 palabras clave traducidas.

## Integraciones
- **Preparación desde R1C:** cada afirmación de Ada tiene «🔬 Comprobar (tabla · tipo de pregunta)». Rellena tabla y pregunta (y columna cuando no da la respuesta por sí sola), limpia condiciones, hace scroll y resalta el laboratorio. El equipo tiene que elegir columna/condiciones e interpretar el resultado: la habilidad (comprobar una IA con datos) se conserva.
- La última consulta y su resultado van a Lumi.

## Decisiones de dificultad
- No se pide escribir SQL en ningún nivel (la caja de SQL libre solo queda en las comprobaciones rápidas de R3C/R5D, opcional).
- La SQL se muestra siempre: es lo que aprenden de forma pasiva.

## Pendiente (propuesta)
- Explicar en una frase el resultado («Hay 59 484 valores distintos de encounter_id: hay visitas repetidas») cuando la pregunta es de conteo.
- Guardar el historial de las últimas 5 preguntas para comparar dos resultados (filas vs. distintos) sin copiarlos a mano.
