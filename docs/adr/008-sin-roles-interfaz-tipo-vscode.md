# ADR 008 — Sin roles; interfaz tipo VS Code (sustituye a ADR 007)

Estado: aceptada (2026-11-18).

- **Sin roles, sin fichas, sin «pasar nota».** Desaparecen los tres roles de ADR 007, las fichas privadas, el reparto de candados por rol y el ajuste de la puerta de pistas según portátiles. Todo el equipo ve lo mismo; cualquier número de portátiles puede entrar al mismo equipo (mismo código de sesión + alias) y comparte el estado (WebSocket + `team_kv`).
- **La información de las fichas pasa a ser documentos del proyecto** (`content/docs.yaml`, antes `cards.yaml`): aparecen en la carpeta `docs/` del explorador cuando se alcanza el primer candado que los necesita (`docs_needed` en el candado) y ya no se ocultan. Se sirven en `TeamState.docs`.
- **Pantalla única a ancho completo, como VS Code:**
  - Izquierda: explorador con **Niveles** (solo se abren los ya desbloqueados; los superados se reabren en modo lectura) y **Proyecto** (`data/raw/*.csv`, `models/*.sql` desde R2B/R3C, `docs/*.md`).
  - Centro: pestañas. La pestaña fija «Nivel actual» es donde se juega (herramientas del candado abierto); los niveles superados y los ficheros se abren en pestañas aparte. Las herramientas del nivel actual siguen montadas aunque se mire otra pestaña.
  - Derecha: **solo el asistente de IA (Lumi)**. Las entrevistas con Noa/Brais (R4B) siguen dentro del nivel, no en el panel.
  - Barra de estado inferior: cronómetro, medidores, créditos de IA, glosario, ayuda, idioma.
  - Paneles redimensionables (ratón o flechas); anchos guardados en el navegador.
- Persistencia: se eliminan las tablas `members` e `info_cards_shared` del esquema; `deviceId` ya no se usa.
- Datos CSV del explorador: vista previa de las primeras líneas (petición Range); no sustituye al cargador del nivel R1A.
