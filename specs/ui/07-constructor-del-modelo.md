# UI 07 · Constructor del modelo (R3C)

## Problema de partida
Era el nivel más técnico: desplegables dentro de SQL con plantillas (`{{ ref() }}`), opciones mostradas como fragmentos SQL truncados, un grafo de linaje y «Ejecutar modelos y tests». Para un alumno de 16 años era leer código ajeno. Además, hasta el 24-nov había un nivel previo («El protocolo») que pedía casi lo mismo con desplegables.

## Ahora
1. **«📄 …»**: una línea que remite al protocolo dentro de `docs/peticiones-direccion.md` (botón que lo abre en una pestaña). Las reglas no se copian aquí (26-nov): leerlas en el documento y traducirlas a piezas ES el nivel (el antiguo R3A se fusionó aquí, ADR 014).
2. **Cadena** «Visitas limpias ➜ Pacientes protegidos ➜ Episodios de ingreso ➜ Reingresos», con filas y color tras calcular.
3. Una **tarjeta por modelo** («1. Episodios de ingreso» + nombre técnico en pequeño + qué hace) con cada pieza como **pregunta** y opciones en castellano (campo `plain` de `*.slots.yaml`), con la SQL en pequeño debajo. Al elegir, una línea explica el efecto.
4. «▶ Calcular». Resultado en palabras: «✔ Episodios de ingreso · 6 012 filas», «🟡 12 episodios tienen el alta ANTES que el ingreso — es un aviso, lo investigaréis en la sala siguiente», «🟢 N comprobaciones superadas».
5. **La cifra se obtiene con el Laboratorio de preguntas** (debajo), que tras calcular se actualiza solo con las tablas `marts.*`. Ya no hay un botón que dé el número hecho.
6. «Ver el código SQL (opcional)» plegado, legible.
7. Lumi recibe las piezas como borrador (`slots:modelo.pieza=opción,…`) y el servidor dice cuál está mal (`slotKey`).

## Aceptación
E2E: el protocolo muestra también la regla de exclusiones; elegir las 3 piezas, «▶ Calcular», ver un aviso amarillo, contar en el Laboratorio `marts.fct_admission` con `is_readmission_30d` = true y abrir el nivel con esa cifra.
