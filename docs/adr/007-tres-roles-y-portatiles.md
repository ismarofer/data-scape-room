# ADR 007 — Tres roles, un portátil por rol (sustituye a ADR 004)

Estado: sustituida por ADR 008 (2026-11-18): los roles y las fichas se eliminan.

- **Roles:** Ingeniería de datos (ingesta y modelado), Analista/BI (visualización, definición de KPI) y Data scientist (análisis de datos, verificación de IA, ML). Desaparecen Analytics engineer y Calidad/privacidad: privacidad pasa a la ficha de Ingeniería y a la del Data scientist (sesgos); el modelado a Ingeniería.
- **Un portátil por rol (hasta 3):** cada persona entra con el mismo código de sesión y nombre de equipo y elige un rol. Sin alias ni nombres; solo un `device_id` aleatorio. El estado del equipo es único y se sincroniza por WebSocket.
- **Fichas privadas:** cada portátil ve solo la ficha de su rol; el resto de información llega hablando o con «Pasar nota».
- **Menos de 3 personas:** (a) mientras se entra al juego no hay fichas públicas; (b) cuando el tutorial termina, la ficha de cualquier rol que nadie lleva pasa a ser pública para todos; (c) si alguien toma ese rol después, los demás conservan lo que ya habían leído; (d) las pistas llegan antes (puerta ×0,75 con 2 portátiles, ×0,5 con 1); (e) cada candado muestra quién lo lidera entre los roles presentes (si el rol líder está vacío, lo lidera quien esté).
- **Estado de las herramientas en servidor** (`team_kv`: opciones del cargador, piezas de modelos, dashboard) para que cualquier portátil pueda continuar el trabajo de otro. Los datos DuckDB siguen siendo locales a cada navegador y se reconstruyen desde esas acciones.
- **Pendiente:** R6 (ML) es el trabajo natural del Data scientist y sigue sin implementar.
