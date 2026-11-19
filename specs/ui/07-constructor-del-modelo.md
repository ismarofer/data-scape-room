# UI 07 · Constructor del modelo (R3C)

## Problema de partida
Era el nivel más técnico: desplegables dentro de SQL con plantillas (`{{ ref() }}`), opciones mostradas como fragmentos SQL truncados, un grafo de linaje y «Ejecutar modelos y tests». Para un alumno de 16 años era leer código ajeno.

## Ahora
1. **«📄 Vuestro protocolo»** al lado: las 4 reglas del protocolo que acaban de contestar en R3A. R3C pasa a ser *traducir esas reglas a piezas*.
2. **Cadena** «Visitas limpias ➜ Pacientes protegidos ➜ Episodios de ingreso ➜ Reingresos», con filas y color tras calcular.
3. Una **tarjeta por modelo** («1. Episodios de ingreso» + nombre técnico en pequeño + qué hace) con cada pieza como **pregunta** y opciones en castellano (campo `plain` de `*.slots.yaml`), con la SQL en pequeño debajo. Al elegir, una línea explica el efecto.
4. «▶ Calcular». Resultado en palabras: «✔ Episodios de ingreso · 6 012 filas», «🟡 12 episodios tienen el alta ANTES que el ingreso (estancias negativas) — es un aviso, lo investigaréis en la sala siguiente», «🟢 N comprobaciones superadas».
5. «Ver el código SQL (opcional)» plegado, legible.
6. Lumi recibe las piezas como borrador (`slots:modelo.pieza=opción,…`) y el servidor dice cuál está mal (`slotKey`).

## Aceptación
E2E: elegir las 3 piezas por radio, «▶ Calcular», ver un aviso amarillo, pulsar «Episodios marcados como reingreso» y abrir el candado.
