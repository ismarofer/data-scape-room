# Código Alta — escape room de datos (sanidad)

Escape room de ingeniería y ciencia de datos ambientado en un hospital. Un equipo
recorre salas (ingesta, modelado, calidad, visualización, predicción y presentación),
resuelve retos con SQL, dbt y ML en el navegador, y cuenta con **Lumi**, el asistente de IA,
como única ayuda (pistas 1-3 y solución).

- Datos **ficticios** (generados con Synthea y adaptados a Galicia). Idiomas: es y gl.
- UI tipo VS Code: explorador de niveles y ficheros, pestañas y Lumi a la derecha.
- Se entra con el nombre del equipo; no hay roles, códigos de sesión ni perfil de edad.
- Consola del facilitador en `/facilitador` (protegida con PIN).

> **Repo privado.** Contiene las respuestas de todos los niveles (`SOLUCION.md`,
> `solutions/`, `data/dist/answers.json`). No lo hagas público sin retirarlas antes.

## Requisitos

- Node.js **22 o superior** (el servidor usa `node:sqlite`).
- Python 3 para regenerar los datos (`data/`).
- Java 21 solo si quieres regenerar con Synthea (ADR 002).
- Un recurso de Azure AI Foundry para Lumi (ADR 003).

## Puesta en marcha

```bash
npm ci
cp .env.example .env     # rellena AZURE_OPENAI_API_KEY y ANSWER_SALT
npm run dev              # servidor + web en desarrollo
```

La IA funciona siempre en vivo y solo en servidor (ADR 009): sin clave válida, Lumi no responde.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor y web en desarrollo |
| `npm run start:offline` | Compila la web y arranca el servidor (producción, puerto 3000) |
| `npm test` | Tests unitarios (Vitest) |
| `npm run e2e` | Tests end-to-end (Playwright) |
| `npm run typecheck` | Comprobación de tipos |
| `npm run content:validate` | Valida el contenido de `content/` |
| `make data` / `python data/run_all.py` | Regenera los datos de forma determinista (`SEED=20261117`) |
| `python data/05_ml_features.py` | Datos para el módulo de ML |

## Estructura

```
apps/server/    Fastify: API, WebSocket, motor del juego, IA (Lumi), SQLite
apps/web/       Frontend (React + Vite), motor de datos DuckDB-WASM en el navegador
packages/shared Código compartido (CSV, dbt, ML, gráficos)
content/        Salas, prompts, modelos y tablas como datos (YAML/MD/SQL)
data/           Pipeline de datos; data/dist es lo que sirve el servidor
solutions/      Soluciones por nivel (solo para quien dirige)
specs/          Especificaciones de experiencia y salas (README = índice)
docs/           PLAN.md y ADRs (docs/adr/)
deploy/         Instalación en Raspberry Pi
```

Reglas de diseño: sin respuestas ni claves en el cliente, sin CDNs en runtime,
contenido como datos, determinismo. Las decisiones están en [docs/adr/](docs/adr/) y el
spec completo en [SPEC-escape-room-datos-sanidad.md](SPEC-escape-room-datos-sanidad.md).

## Despliegue en Raspberry Pi

```bash
git clone https://github.com/ismarofer/data-scape-room.git && cd data-scape-room
cp .env.example .env && nano .env
bash deploy/setup-pi.sh
```

Instala Node 22, dependencias y build, y crea el servicio systemd `codigo-alta`
(`journalctl -u codigo-alta -f` para ver los logs). Escucha en el puerto 3000.

## Regenerar los datos

`data/dist/` ya está versionado, así que no hace falta regenerar nada para jugar.
Si ejecutas `make data` sin salidas de Synthea, se usa el generador de Python (ADR 001) y
los datos resultantes serán distintos. Para reproducir los actuales, lanza antes
`data/synthea/run_synthea.sh` (necesita `synthea.jar` y Java 21).
