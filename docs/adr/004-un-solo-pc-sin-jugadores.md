# ADR 004 — Un solo PC por equipo, sin jugadores individuales

Estado: aceptada (2026-11-17). Modifica SPEC 3.1/3.2 y 6.6.

- El equipo resuelve todo en conjunto en **un único PC**. No hay alias de jugador, ni reparto de roles entre personas, ni multi-dispositivo.
- Se elimina `members` e `info_cards_shared`; unirse = abrir (o reanudar tras recargar) el equipo de la sesión con código + nombre de equipo.
- Los 4 roles se mantienen como **fichas de rol** (pestañas) con información distinta: el equipo debe leerlas y ponerlas en común. Siguen existiendo los locks que necesitan dos fichas.
- "Pasar nota" desaparece; la insignia "Equipo en sintonía" pasará a basarse en otra señal (p. ej. abrir las 4 fichas antes de resolver locks multi-ficha).
- Varios equipos pueden compartir sesión (un PC por equipo), pero cada equipo es independiente.
