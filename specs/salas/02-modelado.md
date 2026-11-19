# Sala 2 · Modelado (R3) — «El plano del hospital»

**Objetivo:** ponerse de acuerdo en la definición y construir el cálculo. «Si cambia la definición, cambia el número.» ~30 min.
**Briefing:** leer el protocolo · dibujar el esquema en estrella · montar el cálculo y sacar la primera cifra.

## 2.1 El protocolo (`r3a_protocolo`, decisión)
- **Hace:** lee 5 puntos de un documento y contesta 4 desplegables.
- **Dificultad:** 2/5. Pura comprensión lectora, con frases cortas.
- **Cambio:** misión de 2 frases; si falla, el juego dice *qué* pregunta no cuadra.

## 2.2 Esquema en estrella (`r3b_estrella`, construcción)
- **Hace:** marca 5 tablas como hecho/dimensión y las une.
- **Dificultad:** 3/5. El concepto es nuevo; las tablas `fct_`/`dim_` lo delatan, lo cual está bien a esta edad. Validación inmediata de reglas (dimensiones no se unen, flechas desde el hecho) y formulario «Desde / Hasta» alternativo al arrastre.
- **Cambio:** misión explica hecho/dimensión con ejemplo; pista 1 ya enseña el truco de los prefijos.

## 2.3 Modelo de reingreso (`r3c_modelo`, código)
- **Hace:** elige 3 piezas, calcula y copia el número de reingresos (481).
- **Dificultad antes:** 5/5 (SQL con plantillas). **Ahora:** 2-3/5 → ver [UI 07](../ui/07-constructor-del-modelo.md): protocolo al lado, piezas como preguntas en castellano, resultado en palabras, código opcional.
- **Aviso amarillo** (estancias negativas) explicado como «lo investigaréis en la sala siguiente»: engancha con la sala 3.
- Lumi sabe qué pieza está mal (`slotKey`), sin decir cuál es la buena hasta la pista correspondiente.

## Probado
Speedrun e2e (con un fallo de protocolo a propósito); unit de diagnóstico de piezas.
