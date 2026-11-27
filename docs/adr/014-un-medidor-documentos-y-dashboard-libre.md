# ADR 014 — Un solo medidor, documentación por nivel, laboratorio siempre a mano y dashboard libre

Estado: aceptada (2026-11-24). Complementa a los ADR 012 y 013.

## Contexto
Segunda revisión del 24-nov:
- **Modelado:** los prefijos `fct_`/`dim_` daban la respuesta del esquema en estrella; el nivel «El protocolo» y «Modelo de reingreso» pedían casi lo mismo (leer el protocolo y traducirlo); los pasos casi daban la solución; al fallar una entrega no se veía qué unión o qué desplegable estaba mal.
- **R3C:** el número se copiaba de un botón; no se usaba el Laboratorio de preguntas, que en la sala 1 funciona muy bien.
- **Entrevistas:** el nivel se cerraba solo al conseguir 2 pistas, no quedaba claro qué se buscaba y sin pistas no se podía seguir.
- **Texto:** se llamaba «código» a lo que se escribe para avanzar.
- **KPI:** «30 altas» parecía un número arbitrario.
- **Dashboard:** tipos de gráfico fijos; casillas sin sentido (doble eje, 3D, «eje en cero») y el crítico pedía «como mucho 1 hallazgo» sin distinguir lo grave.
- **Puntos + tres medidores:** demasiados indicadores para un alumno de 16 años.

## Decisión
1. **Un solo medidor: ⭐ Confianza de la Comisión** (0-100, empieza en 40; se guarda en `meters.trust`). Sin puntos. Superar un nivel suma +1…+5 (peso del nivel / 40); decisiones: la media de sus efectos antiguos; pistas −1/−2/−3 y solución −5; marca falsa en R1C −2; dato identificativo a la vista −6 (la primera vez); llave maestra −10; insignias +2. El final de la Comisión usa este medidor y los votos.
2. **Modelado en 2 niveles:** «Esquema en estrella» y «Modelo de reingreso». El protocolo completo (5 reglas) está al lado de las piezas; R3A desaparece.
3. **Tablas sin prefijo** en R3B (`patient`, `hospital`, `date`, `admission`, `condition`), con qué es una fila y sus columnas clave. Posiciones mezcladas.
4. **Rojo en lo que falla:** tras una entrega, la unión, la tarjeta, el desplegable o la caja que el servidor marca mal sale en rojo hasta que se cambia (R3B, R4A, R4C, R5A). Nunca se dice cuál es lo bueno.
5. **Documentación del nivel:** cada nivel enlaza sus documentos (`docs_needed`), que se abren en pestaña. Los pasos explican el método; los documentos amplían con otro ejemplo (nuevo `docs/esquema-en-estrella.md` con una app de música). Los documentos ya no contienen la respuesta del hospital.
6. **Laboratorio de preguntas siempre disponible:** en cualquier nivel (salvo tutorial, carga de ficheros y Comisión) hay un botón para abrirlo y cerrarlo. Pregunta a `raw.*`, `marts.*` (vuestro cálculo) y `canon.*` (modelo final). En R3C es la forma de obtener la cifra.
7. **Entrevistas:** lista «Qué queréis descubrir» (3 preguntas y quién lo sabe), las pistas no cierran el nivel y «Terminar las entrevistas y seguir» está siempre disponible (también con 0 pistas). Cada pista vale más confianza.
8. **«Respuesta»** en lugar de «código» en todos los textos del juego.
9. **Mínimo de altas con datos:** el nivel enseña la tabla de centros con «1 reingreso más mueve la tasa…» y se escribe un número. Vale cualquier mínimo entre 4 y 317 (deja fuera la clínica de 3 casos y mantiene todos los hospitales), configurado en `numeric_ranges` del candado. El documento explica por qué los indicadores reales usan unas 25-30 altas. Ese mínimo se aplica después en el dashboard y en R5D.
10. **Dashboard libre:** cada gráfico = tipo (barras, línea, tabla, KPI) × dato (tasa, nº de reingresos, nº de altas) × reparto (centro, edad, área, mes, año). Eje en cero siempre; sin 3D ni doble eje. El crítico clasifica: 🔴 engaña (bloquea: contar reingresos entre centros, línea en categorías, centros sin mínimo, sin título, ninguna tasa) · 🟡 mejorable (deja seguir; cada uno resta un 15 % de la confianza del nivel, hasta un 60 %) · 🔵 sugerencia. Lo que añade el modelo de IA es siempre 🔵.

## Consecuencias
- 19 niveles en vez de 20. Tiempo total ≈ 148 min con bonus, ≈ 128 sin él.
- `teams.score` deja de usarse; `state.score` refleja la confianza para clientes antiguos.
- Los dashboards guardados con el formato anterior se descartan al abrir el constructor.
- Tests y e2e actualizados (rojo tras fallo, entrevistas sin avance automático, mínimo fuera de rango, crítico rojo/amarillo).
