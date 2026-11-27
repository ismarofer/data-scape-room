# UI 05 · Ficha «¿Qué es esto?» y explorador

## Problema de partida
Los ficheros CSV tenían una explicación, pero las tablas de la base de datos ninguna, cada sitio lo presentaba distinto, y el árbol de la base de datos desplegaba todas las columnas, lo que lo hacía ilegible.

## Ficha única (`InfoCard` en `FileInfo.tsx`)
Mismo componente y mismo aspecto en todos los sitios:
- Etiqueta «ℹ️ ¿Qué es esto?» + **nombre amigable** + qué contiene en 1-2 frases («Una fila = una visita»).
- Nota opcional (p. ej. «Este fichero es la receta que crea la tabla X»).
- «Qué significa cada columna» (plegado en el cargador, abierto en la pestaña de tabla).

| Dónde | Clave |
|---|---|
| Pestaña de un CSV (`data/raw/…`) y cargador de R1A | `patients.csv` (`content/files.yaml`) |
| Pestaña de una tabla de la base de datos | `db:raw.encounters` (`content/tables.yaml`, admite prefijos `raw.encounters_h*`) |
| Pestaña de un modelo (`models/*.sql`) | `db:marts.fct_admission` + nota de «receta» |
Servido por `GET /api/files` (ficheros + `db:*`).

## Base de datos en el explorador
- Capas con nombre que se entiende: «🥉 Bronce · tal cual llegan», «🥈 Plata · datos limpios», «🥇 Oro · vuestro cálculo», «🏅 Oro · modelo final».
- Cada tabla: nombre técnico + **etiqueta amigable** («encounters · Visitas de los 4 hospitales juntas») + nº de filas; al pasar el ratón, su descripción.
- **Sin lista de columnas** en el árbol (25-nov): solo tablas, etiqueta y filas. Las columnas se explican al abrir la tabla.
- Pestaña de tabla: ficha abierta con **todas las columnas explicadas** (las 19 de pacientes, las 8 de cada fichero de encuentros, las de los modelos y del modelo final), primeras 100 filas, cabeceras con ⓘ y la explicación al pasar el ratón.
- Pestaña de un CSV o de un modelo SQL: la misma ficha, con «Qué significa cada columna» **abierto**. En el cargador sigue plegada para no tapar la vista previa.
- Fuente: `content/files.yaml` (ficheros) y `content/tables.yaml` (tablas); cada columna tiene su línea en es y gl.

## Modelos SQL en el explorador
Se ven «limpios»: sin `{{ config }}`, `ref('x')` → `x`, `source('raw','encounters')` → `raw.encounters`, huecos como «▾ ¿Qué cuenta como ingreso?».

## Probado
E2E: tras cargar `patients.csv`, el árbol no tiene listas ni flechas de columnas; abrir la tabla muestra «Pacientes» y **19 columnas explicadas**; hay cabeceras con información.
