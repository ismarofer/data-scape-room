# ADR 011 — Sala R2 simplificada: el RGPD pasa a «La bandeja de entrada»

Estado: aceptada (2026-11-18).

- La sala R2 desaparece. El candado **Radar RGPD** (`r2a_radar`) pasa a la sala R1 «La bandeja de entrada» como cuarto nivel (mismo id, para no romper soluciones ni tests).
- Se eliminan los niveles **Tipos y fechas** (`r2b_staging`, modelos de limpieza) y **Pacientes gemelos** (`r2c_gemelos`, unir fichas duplicadas). El juego pasa de 22 a 20 niveles.
- La capa de limpieza sigue existiendo, pero **ya no es un nivel**: el servidor sirve los modelos `stg_*` resueltos con sus piezas correctas (`withFixedStaging`), de modo que R3C construye sobre datos limpios sin que el equipo tenga que elegirlas. Siguen visibles como ficheros `models/stg_*.sql` desde R3C y en la capa «Plata» de la base de datos.
- Efectos: se retiran `solutions/r2b_staging.json` y `solutions/r2c_gemelos.json`; la tarjeta de evidencia «Tests en verde» de la Comisión; la respuesta `r2b_staging` de `build_answers`. La cifra 9 003 pacientes únicos solo queda como hecho de referencia (afirmación 3 de Ada).
