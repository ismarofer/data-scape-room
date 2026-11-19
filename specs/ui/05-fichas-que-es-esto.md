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
- **Columnas plegadas** por defecto; ▸ las despliega (con su significado al pasar el ratón).
- Pestaña de tabla: ficha abierta, primeras 100 filas, cabeceras con ⓘ y la explicación al pasar el ratón.

## Modelos SQL en el explorador
Se ven «limpios»: sin `{{ config }}`, `ref('x')` → `x`, `source('raw','encounters')` → `raw.encounters`, huecos como «▾ ¿Qué cuenta como ingreso?».

## Probado
E2E: tras cargar `patients.csv`, el árbol no muestra columnas; abrir la tabla muestra «Pacientes» y la explicación de `ssn`; hay cabeceras con información.
