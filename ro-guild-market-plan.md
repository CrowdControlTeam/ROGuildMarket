# Plan de desarrollo — Mercado de guild (Ragnarok Online)

## 0. Estado actual (actualizado 2026-07-20)

Léase esto primero al retomar el proyecto, antes que el resto del documento —
resume la realidad actual del desarrollo; el resto del archivo es la
especificación original y puede haber quedado desactualizado en detalles.

**Dónde está todo:**
- App: [github.com/CrowdControlTeam/ROGuildMarket](https://github.com/CrowdControlTeam/ROGuildMarket), desplegada en Vercel (proyecto `ro-guild-market`) en `https://ro-guild-market.vercel.app`, con base de datos en Supabase (proyecto `lpljlztabvjwuolqaqwa`) conectada vía la integración oficial Vercel↔Supabase.
- Scraper del catálogo: repositorio aparte, [github.com/CrowdControlTeam/ro-guild-market-scraper](https://github.com/CrowdControlTeam/ro-guild-market-scraper) (ver Fase 1.4 más abajo y su propio README).
- Credenciales (Discord, Supabase, `AUTH_SECRET`, etc.): en `.env.local`/`.env`/`.env.production` en local (gitignorados, nunca commiteados) y en las variables de entorno del proyecto en Vercel. Ninguna vive en este repo ni en este documento.

**Progreso**: Fase 0 y Fase 1 completas (marcadas más abajo), incluido el
despliegue. Fases 2-4 sin empezar, salvo varios adelantos explicados abajo
(compras parciales, random options, refine).

**Git flow** (en vigor desde que hay repo remoto, sustituye a cualquier
mención de trabajar directo en local): `main` protegida, todo por rama
`<tipo>/<descripcion_tarea>` (`feature`/`bugfix`/`hotfix`/`release`) +
PR revisado y mergeado por el humano, nunca por el asistente. Commits
`<tipo>: <mensaje>` con el tipo determinado por el tipo de rama.

**Desviaciones/decisiones respecto al documento original:**
- Next.js 16 (no 14) + Tailwind v4 (no v3) — el plan se escribió antes de esas versiones; NextAuth v5 (beta, pero es el estándar de facto para App Router).
- Base de datos: Supabase en vez de Neon, conectada a Vercel vía su integración oficial (variables `POSTGRES_PRISMA_URL`/`POSTGRES_URL_NON_POOLING`, autosincronizadas — no se pegan credenciales a mano). En local, Postgres por Docker (`docker-compose.yml`, puerto 5433).
- Scraping: solo manual/puntual desde el principio (no hay Fase 4.5 de re-scraping periódico ni GitHub Actions) — decisión explícita del usuario, no solo por Fase 1. El scraper vive en su propio repositorio, no mezclado con la app.
- El nombre de usuario mostrado en cualquier parte de la app o de los mensajes de Discord es siempre el **apodo del servidor de Discord** (nickname del guild, con fallback al nombre visible y por último al `@username`), nunca el `@username` en crudo — regla transversal, ver memoria del asistente `display_name_convention`.
- Formato de precios: separador de miles con `.` (sin decimales), y color según magnitud (normal hasta 1M, verde/azul/rojo/morado cada orden de magnitud x10 por encima) — ver `src/lib/price.ts`, aplicado en toda la app.

**Adelanto sobre el roadmap — compras parciales (normalmente más de Fase 3):**
La Fase 1 CRUD original solo preveía "marcar como vendida" (todo o nada). Se
amplió a compra real: cualquier miembro (salvo el propio vendedor) puede
comprar de 1 a N unidades de una publicación; hay un modelo `Purchase`
(registro inmutable por compra: comprador, cantidad, precio unitario) y un
contador `Listing.quantitySold`; el estado pasa solo a `SOLD` al agotarse el
stock. El vendedor cierra el stock restante sin vender con "Cancelar
publicación" (ya no existe "marcar como vendida" manual). **Esto es
deliberadamente la base para una futura Fase 3 de ofertas** (al comprar se
lanzará una oferta al vendedor, que podrá aceptar o no, con DM de Discord si
el bot está configurado) — de momento la compra se confirma al instante, sin
ese paso intermedio ni DM.

**Adelanto sobre el roadmap — random options y refine (2026-07-20, tampoco
estaba en el plan original tal cual):**
- **Random options**: arma/armadura de cuerpo/prenda/calzado pueden llevar de
  0 a 3 estadísticas aleatorias adicionales por listing (no son fijas del
  item del catálogo). Catálogo real de 194 combinaciones stat/rango/slot
  posicional (`ItemOptionDef`), con selección por listing (`ListingOption`,
  hasta `MAX_OPTION_SLOTS` = 3, ver `src/lib/item-options-constants.ts`).
  El formulario de venta desbloquea cada slot de option en orden (1→2→3) y
  valida el rango; se muestran en la card del mercado, la ficha del listing
  y el embed de Discord. Filtro de mercado por option (uno por slot, con
  mín/máx), que se deshabilita pero conserva su valor si la categoría deja
  de ser compatible, y se limpia si cambia a otro grupo válido distinto
  (p.ej. arma mágica → física).
- **Refine**: nivel +0 a un máximo configurable en base de datos
  (`MarketConfig.maxRefineLevel`, 10 por defecto — el tope real de RO Zero
  no está confirmado todavía). Aplica a arma, o armadura en slot casco
  superior/cuerpo/escudo/prenda/calzado (accesorios y cascos medio/inferior
  no). A diferencia de las options, no obliga a publicar cantidad 1 (varias
  copias al mismo refine sí tiene sentido). Se muestra como prefijo `+N`
  donde aparezca el item (nunca en +0), y tiene su propio filtro de rango.
- **Catálogo de items**: `Item` ahora guarda `weaponType` (subtipo real de
  arma — daga, espada 1H/2H, lanza 1H/2H, hacha 1H/2H, maza, báculo,
  báculo 2H, arco, knuckle, katar, instrumento, látigo, libro, y los tipos
  de arma de fuego aunque de momento no hay ninguna en el catálogo), en vez
  del física/mágica que se manejaba antes solo a nivel de código. Qué
  subtipos cuentan como "mágicos" (pool de options `WEAPON_MAGICAL`) vive en
  `MagicalWeaponType`, una tabla editable en base de datos sin desplegar
  código (por defecto: báculo, báculo 2H, libro). También se revisaron y
  corrigieron a mano varios nombres de item que venían rotos (texto en otro
  idioma sin traducir, o una descripción larga colada como si fuera el
  nombre) y unas pocas categorías mal puestas (piedras de stat que debían
  ser `ENCHANT` y estaban como `ETC`/`CARD`).

**Lección operativa (2026-07-20) — checklist al añadir migraciones de
Prisma:** un cambio de esquema mergeado a `main` se despliega en Vercel
automáticamente, pero **no aplica migraciones ni datos por sí solo** — hay
que aplicar `prisma migrate deploy` (y los scripts de seed que toquen,
`prisma/seed*.mjs`) contra la base de datos de producción de Supabase
explícitamente, o el sitio entero cae con error de servidor en cuanto el
código nuevo intenta leer columnas/tablas que la base de datos de
producción todavía no tiene. Pasó exactamente eso el 2026-07-20 al mergear
el PR de options/refine — quedó resuelto aplicando las migraciones y los
seeds a mano contra Supabase, pero conviene incluir este paso en el flujo
de cualquier PR que toque `prisma/schema.prisma` a partir de ahora, en vez
de darlo por hecho.

**Pendiente de decidir, sin implementar todavía — reconocimiento de item
por captura de pantalla:** el usuario planteó (2026-07-19) que al crear una
venta se pueda arrastrar/pegar una captura del tooltip de un item en el
juego y que la app reconozca automáticamente el item y sus options,
rellenando el formulario. Se decidió explícitamente posponerlo hasta que el
catálogo de random options (ya construido, ver arriba) estuviera en pie,
porque el reconocimiento se puede validar mucho mejor contra un catálogo de
options real que a ciegas. Sigue sin planificarse en detalle — sería el
candidato natural para la próxima sesión si no se prioriza Fase 2.

**Próximo paso natural**: Fase 2 (subastas) tal como está descrita más abajo,
seguir puliendo el mercado de venta directa, o el reconocimiento de item por
captura mencionado arriba — sin decidir todavía, a confirmar con el usuario
al retomar.

---

## 1. Idea general

Una web privada, solo para miembros del Discord de la guild, donde los jugadores pueden:

- Poner objetos en **venta directa** (precio fijo) o en **subasta** (puja al mejor postor).
- **Comprar** objetos publicados por otros.
- Publicar **peticiones de compra** ("busco X, pago Y").
- Proponer **trades** (objeto por objeto, con o sin dinero de por medio).
- Hacer **regalos** directos a otro jugador.

El catálogo de objetos (nombre, icono, stats, descripción) sale de una base de datos propia, alimentada mediante scraping periódico de Midgardhub, para no depender de esa web en tiempo real.

El acceso se controla con **login de Discord (OAuth2)**, y solo se permite entrar a quienes pertenezcan al servidor de Discord de la guild. Cada publicación en el mercado (venta, subasta, petición de compra) se anuncia automáticamente en un canal de Discord vía **webhook**, con fecha, autor, item (nombre + icono) y precio.

La estética visual busca recordar a Ragnarok Online (paneles tipo ventana de inventario, tipografía con aire retro, paleta de colores del juego) sin usar sprites ni assets originales de Gravity.

---

## 2. Especificación punto por punto

### 2.1 Autenticación y acceso
- Login exclusivamente vía **Discord OAuth2** (no habrá usuario/contraseña propio).
- Tras el login, se comprueba que el usuario pertenece al `GUILD_ID` (servidor de Discord) configurado. Si no pertenece, se le deniega el acceso con un mensaje claro.
- Se guarda un perfil mínimo por usuario: `discordId`, `username`, `avatar`, fecha de alta, y opcionalmente su rol/rango dentro de la guild (para fases posteriores, p. ej. moderación).
- Sesión persistente (cookies firmadas), cierre de sesión disponible.

### 2.2 Catálogo de objetos
- Base de datos propia con: nombre, icono, descripción, categoría (arma/armadura/carta/consumible/etc.), y cualquier dato adicional relevante para identificar el objeto en el mercado.
- **Origen de los datos:** scraping propio de Midgardhub, ejecutado de forma periódica (no en cada visita del usuario), guardando los resultados en la DB local.
- Antes de scrapear de forma sistemática, contactar al autor de Midgardhub (vía su página de contacto) explicando el uso: proyecto privado, sin ánimo de lucro, solo para una guild, con crédito a la fuente. Aunque no sea estrictamente obligatorio, es buena práctica y reduce riesgo de bloqueo/ToS.
- Los iconos se alojan copiados en tu propio almacenamiento (no se hace *hotlink* directo a midgardhub).

### 2.3 Mercado — modalidades de publicación
Al crear una publicación, el vendedor elige un **modo** (obligatorio indicar al menos uno de los dos precios):

| Campo | Venta directa | Subasta |
|---|---|---|
| Precio de venta | Obligatorio si no hay subasta | — |
| Precio de subasta (puja inicial) | — | Obligatorio si no hay venta directa |
| Duración | No aplica | Obligatoria (p. ej. 24h/48h/72h) |
| Cierre | Al comprar | Al expirar el tiempo o alcanzar "comprar ya" (opcional) |

- Se puede combinar: precio de venta directa ("cómpralo ya") + precio de subasta mínimo, pero al menos uno de los dos es obligatorio.
- Cada publicación incluye: item, cantidad, precio(s), vendedor, fecha de publicación, estado (activa/vendida/cancelada/expirada).
- Historial de pujas visible en las subastas.

### 2.4 Peticiones de compra
- Un jugador publica "busco [item], pago hasta [precio]".
- Otros jugadores pueden responder ofreciendo el item.
- Notificación en Discord igual que una venta, indicando que es una **petición de compra**, no una venta.

### 2.5 Trade (intercambio)
- Un jugador propone intercambiar un objeto propio por otro objeto (de otro jugador o "busco cualquiera de esta lista").
- El receptor puede aceptar, rechazar o contraofertar.
- Puede incluir compensación en zeny (moneda del juego) además del objeto.

### 2.6 Regalos
- Un jugador puede "regalar" un objeto a otro miembro directamente, sin coste, quedando registrado en el historial (para transparencia y evitar disputas).

### 2.7 Notificaciones a Discord
- Cada evento relevante (nueva venta, nueva subasta, nueva petición de compra, y opcionalmente trade/regalo) genera un mensaje enviado por **webhook de Discord** al canal configurado, en formato *embed* con:
  - Fecha y hora de publicación.
  - Usuario que publica (nombre + avatar de Discord).
  - Item: nombre e icono.
  - Precio (venta y/o subasta) o, en el caso de peticiones, el precio que se ofrece pagar.
  - Enlace directo a la publicación en la web.
- (Fase 3) Notificaciones de cierre de subasta y aviso al ganador, mediante el bot descrito en el punto 2.10 (los webhooks son unidireccionales, no pueden reaccionar a eventos ni mandar DMs).

### 2.8 Ambientación visual "estilo RO"
- Paleta de colores inspirada en la UI clásica del juego (marrones/dorados tipo madera, paneles con borde).
- Tipografía con aire retro/pixel para títulos, tipografía legible normal para el contenido.
- Iconografía e ilustraciones **propias o genéricas** (no sprites extraídos del cliente del juego ni artwork oficial de Gravity), para evitar problemas de derechos de autor.
- Los iconos de los items scrapeados de Midgardhub sí se van a usar (son necesarios para identificar el objeto), pero limitados a ese uso funcional, con atribución a la fuente en el footer.

### 2.9 Búsqueda, filtros y orden en el mercado

**Alcance:** aplica a ventas directas, subastas y peticiones de compra. No aplica (por ahora) a trades ni regalos.

**Filtros disponibles (combinables entre sí):**
- **Nombre**: texto libre, coincidencia parcial y sin distinguir mayúsculas/minúsculas (ej. "manteau" encuentra "Manteau" y "Wool Manteau").
- **Categoría / tipo de item**:
  - Equipo: armas, y armadura con su subtipo de slot (casco superior, casco medio, casco inferior, cuerpo, escudo, prenda/garment, calzado, accesorio).
  - Cartas: filtrables por el tipo de equipo en el que se pueden slotear (ej. "cartas de casco superior", "cartas de arma").
  - Consumibles / usables.
  - Miscelánea / Etc.
- **Rango de precio**: precio mínimo y máximo (sobre el precio de venta directa o el precio de subasta, según corresponda; en peticiones de compra, sobre el precio ofrecido).

**Orden de resultados:**
- Por defecto: fecha de publicación, de más reciente a más antigua.
- Alternativas seleccionables por el usuario: precio (ascendente/descendente), fecha de publicación (ascendente/descendente), nombre (A-Z / Z-A).

**Carga de resultados: botón "cargar más" con paginación por cursor** (no scroll infinito puro ni paginación numerada clásica). Motivo:
- El scroll infinito puro complica mantener filtros/orden reflejados en la URL (difícil compartir o recargar una búsqueda concreta) y puede degradar el rendimiento si el listado crece mucho sin virtualización.
- La paginación numérica clásica (OFFSET/LIMIT) se vuelve lenta e inconsistente si se publican o retiran items mientras el usuario navega entre páginas.
- Un cursor (basado en el último elemento cargado, no en el número de página) da una experiencia fluida similar al scroll infinito, es eficiente en la base de datos aunque el catálogo crezca mucho, y permite mantener filtros/orden en la URL.

**Implicaciones técnicas:**
- El modelo `Item` necesita campos de categoría y subtipo (arma, armadura + slot, carta + slot compatible, consumible, miscelánea) capturados durante el propio scraping, para no depender de parsear texto libre en cada búsqueda.
- Los campos usados para filtrar y ordenar (categoría, subtipo, precio, fecha, nombre) deben estar indexados en PostgreSQL para que la búsqueda siga siendo rápida a medida que crece el número de publicaciones.

### 2.10 Notificaciones privadas por Discord (DM)

**Cuándo se envía:** al completarse una transacción, se manda un mensaje privado (DM) por Discord solo a quien **recibe** esa transacción (no al que la origina, que ya sabe que la ha hecho):

| Evento | Quién recibe el DM |
|---|---|
| Compra (venta directa o subasta) | El vendedor: "X ha comprado tu [item]" |
| Petición de compra aceptada | Quien publicó la petición, al recibir el item que buscaba |
| Trade aceptado | Cada parte del trade, con el objeto que **ella** ha recibido a cambio (ambas partes reciben algo, así que ambas reciben su propio DM) |
| Regalo | Quien recibe el regalo |

**Formato del mensaje:**
- Preferentemente un embed ("tarjeta"), igual en espíritu al usado en el canal público: icono y nombre del item, quién origina la transacción, precio o detalle del intercambio, fecha, y enlace a la publicación/transacción en la web.
- Si no se puede construir el embed, se envía como alternativa un mensaje de texto plano con la misma información esencial (usuario, acción, item, precio).

**Manejo de fallos de entrega:** si el bot no puede enviarle el DM al usuario (por ejemplo, tiene los mensajes privados cerrados a miembros del servidor, o ha bloqueado al bot), no se hace nada adicional: no se reintenta ni se avisa por otra vía. La transacción queda igualmente reflejada en la web y en el canal público vía webhook.

**Requisito técnico:** los webhooks son unidireccionales y no pueden enviar DMs, así que esta función requiere un **bot de Discord** con permiso para abrir conversaciones privadas con miembros del servidor. El bot se incorpora en la **Fase 3** (ver roadmap), aprovechando que es cuando llegan peticiones de compra, trades y regalos, y se reutiliza en ese momento también para las compras simples de la Fase 1.

---

## 3. Desglose de tareas / roadmap

### Fase 0 — Preparación (antes de programar)
- [x] Crear aplicación en el [Discord Developer Portal](https://discord.com/developers/applications): OAuth2 (client id/secret) + Webhook en el canal del mercado. *(app de test; falta la definitiva de producción cuando la guild lo decida)*
- [x] Confirmar el `GUILD_ID` del servidor de la guild. *(valor de test en uso; pendiente el real)*
- [x] Contactar al autor de Midgardhub para informar del uso de los datos. *(confirmado sin problema — su web traduce una fuente coreana ya scrapeada)*
- [x] Crear repositorio, cuentas en Vercel, Neon/Supabase y GitHub Actions. *(Supabase en vez de Neon; sin GitHub Actions — el scraping es manual, no periódico, ver Fase 1.4)*

### Fase 1 — MVP (login + venta simple + notificación Discord)
- [x] Proyecto base Next.js + TypeScript + Tailwind. *(Next.js 16 + Tailwind v4, no 14/v3 — el plan se escribió antes de esas versiones)*
- [x] Autenticación con NextAuth (Auth.js) + provider Discord, con verificación de pertenencia al guild. *(NextAuth v5; sesión de 24h para re-verificar membresía periódicamente)*
- [x] Modelo de datos inicial (Prisma): `User`, `Item` (con categoría y subtipo de slot), `Listing` (solo venta directa por ahora). *(además ya se adelantó `Purchase`, `ItemOptionDef`/`ListingOption` (random options), `Listing.refineLevel`, `Item.weaponType`/`MagicalWeaponType` y `MarketConfig` — ver nota de estado actual)*
- [x] Script de scraping inicial: carga masiva de items de Midgardhub a la DB, incluyendo categoría y subtipo de slot de cada item. *(vive en un repo aparte: [ro-guild-market-scraper](https://github.com/CrowdControlTeam/ro-guild-market-scraper); manual y puntual, sin cron)*
- [x] CRUD de publicaciones: crear venta (item + cantidad + precio), listar mercado, ver detalle, marcar como vendida. *(ampliado: compra parcial real en vez de solo "marcar como vendida", ver nota de estado actual)*
- [x] Búsqueda y filtros sobre las ventas (nombre parcial, categoría/subtipo, rango de precio) + orden (precio, fecha, nombre) con paginación por cursor ("cargar más"). *(ampliado con filtros de tipo de arma, random option (por slot) y refine — ver nota de estado actual)*
- [x] Envío de webhook a Discord al crear una publicación.
- [x] Look & feel base "estilo RO" (layout, paleta, componentes principales).
- [x] Despliegue en Vercel + DB en Neon/Supabase. *(Supabase, conectado a Vercel vía su integración oficial — ver estado actual)*

### Fase 2 — Subastas
- [ ] Extender `Listing` con campos de subasta (precio inicial, duración, cierre, puja mínima).
- [ ] Sistema de pujas (`Bid`): validación de puja mínima incremental, historial.
- [ ] Job programado (cron) que cierra subastas expiradas y determina ganador.
- [ ] Notificación Discord (webhook del canal) al iniciar la subasta. El aviso privado al ganador se añade en la Fase 3, junto con el resto de notificaciones por DM.
- [ ] Extender la búsqueda, filtros y orden de la Fase 1 para incluir también las subastas.

### Fase 3 — Peticiones de compra, trades y regalos
- [ ] Modelo `BuyRequest` (petición de compra) + notificación Discord.
- [ ] Extender la búsqueda, filtros y orden de las Fases 1-2 para incluir también las peticiones de compra.
- [ ] Modelo `TradeOffer` (propuesta, contraoferta, aceptación/rechazo).
- [ ] Modelo `Gift` (registro de regalos, sin lógica de precio).
- [ ] Actualizar UI del mercado para filtrar por tipo de publicación (venta/subasta/petición/trade), combinable con los filtros de nombre/categoría/precio ya existentes.
- [ ] Dar de alta un bot de Discord (Discord Developer Portal) e invitarlo al servidor de la guild, con permiso para enviar mensajes privados a sus miembros.
- [ ] Servicio de envío de DMs (tarjeta/embed con fallback a texto plano) reutilizable para todos los eventos de transacción.
- [ ] DM al vendedor al completarse una compra (venta directa o subasta).
- [ ] DM al ganador de una subasta al cerrarse.
- [ ] DM a quien publicó la petición de compra cuando esta se acepta.
- [ ] DM a cada parte de un trade aceptado, con el objeto que ha recibido.
- [ ] DM a quien recibe un regalo.
- [ ] Manejo de fallos de envío de DM (usuario con los DMs cerrados): no reintentar, no bloquear el flujo de la transacción.

### Fase 4 — Pulido y extras
- [ ] Ampliar el bot creado en la Fase 3 con comandos rápidos (`/mercado buscar item`) y funciones de roles/moderación.
- [ ] Historial de transacciones por usuario ("mis compras", "mis ventas").
- [ ] Filtros avanzados adicionales (por stats del item, favoritos, alertas de búsqueda guardada que avisen por Discord cuando se publique algo que coincida).
- [ ] Panel de administración básico (borrar publicaciones, banear usuarios abusivos).
- [ ] Actualización periódica automática del catálogo de items (re-scraping incremental).
- [ ] Revisión de accesibilidad y responsive (móvil).

---

## 4. Normas a seguir durante el desarrollo

1. **Legal / propiedad intelectual**
   - No usar sprites, artwork ni assets oficiales de Gravity/RO. La estética se logra con paleta, tipografía y composición propias, no con arte extraído del juego.
   - Los iconos de items provienen de Midgardhub solo con fin funcional (identificar el objeto), con crédito visible a la fuente.
   - Respetar `robots.txt` y limitar la frecuencia del scraping; preferir contacto directo con el autor antes que scraping agresivo.

2. **Seguridad**
   - Nunca exponer el `client secret` de Discord, el token del bot ni la URL del webhook en el frontend — todo vive en variables de entorno del servidor.
   - Toda operación sensible (crear venta, pujar, aceptar trade) se valida **en el servidor**, nunca confiando solo en el cliente.
   - La pertenencia al guild se verifica en cada request sensible, no solo en el login (evita que alguien se quede con sesión tras salir del servidor).
   - Rate limiting básico en endpoints públicos para evitar spam de publicaciones o pujas.

3. **Integridad de los datos del mercado**
   - Toda transacción (venta, subasta, trade, regalo) queda registrada de forma inmutable (no se borra, se marca como cancelada/completada) para poder resolver disputas entre jugadores.
   - Los precios y cantidades se validan como enteros positivos; no se permiten publicaciones sin al menos un precio (venta o subasta) definido.

4. **Consistencia de diseño**
   - Design system propio definido una vez (colores, tipografía, componentes de "panel"), reutilizado en toda la web — no estilos ad-hoc por página.

5. **Desarrollo por fases**
   - Cada fase (subastas, trades, regalos) se implementa como módulo independiente que no rompe lo ya construido en el MVP. No mezclar features de fases distintas en la misma tanda de cambios.

6. **Calidad de código**
   - TypeScript en modo estricto, validación de datos de entrada con Zod (o similar) tanto en formularios como en API.
   - Componentes React reutilizables; lógica de negocio (cálculo de subastas, validaciones) con tests unitarios mínimos.

7. **Privacidad**
   - Solo se muestra la información imprescindible del usuario (nombre y avatar de Discord); no se solicitan datos personales adicionales.
   - El mercado y sus publicaciones son visibles únicamente para usuarios autenticados y verificados como miembros del guild — nunca en abierto.
   - Los DMs de transacción (2.10) solo contienen información de la propia transacción del destinatario, nunca datos de otros usuarios ajenos a ella. Si el envío falla, no se reintenta ni se expone el fallo al resto de usuarios.

8. **Copias de seguridad**
   - Backups periódicos (aunque sean manuales al principio) de la base de datos, dado que registra transacciones económicas del juego entre jugadores reales.

---

## 5. Stack recomendado (gratuito)

| Capa | Recomendación | Motivo |
|---|---|---|
| Frontend + Backend | **Next.js 14 (App Router) + TypeScript** | Ya conoces React; Next.js añade rutas API/Server Actions, SSR y despliegue muy sencillo en Vercel. |
| Estilos | **Tailwind CSS** | Rápido para montar un design system propio (paneles, paleta RO) sin depender de una librería con estética genérica. |
| Autenticación | **NextAuth.js (Auth.js) con provider de Discord** | Integración lista para OAuth2 de Discord; el callback permite comprobar el scope `guilds` y verificar el `GUILD_ID`. |
| ORM / Base de datos | **Prisma + PostgreSQL** | Tipado end-to-end con TypeScript, migraciones sencillas, y Postgres es más que suficiente para el volumen de una guild. |
| Hosting de la app | **Vercel (plan gratuito)** | Despliegue automático desde GitHub, pensado específicamente para Next.js, límites de sobra para el tráfico de una guild. |
| Hosting de la base de datos | **Neon** (Postgres serverless) o **Supabase** (Postgres + Storage) | Ambos con free tier permanente; Supabase además da almacenamiento gratuito, útil para alojar los iconos de items copiados. |
| Scraping periódico | **Node.js (Playwright o Cheerio, según si el contenido es dinámico) + GitHub Actions (cron)** | GitHub Actions permite programar el scraping (p. ej. semanal) sin coste, ejecutándose fuera de tu hosting principal. |
| Notificaciones | **Discord Webhooks** (fases 1-2, canal público) → **Bot con discord.js** (fase 3, DMs y cierre de subastas) | El webhook basta para publicar en el canal; el bot se incorpora en la Fase 3 porque los DMs y el aviso de cierre de subasta lo requieren (los webhooks son unidireccionales y no pueden mandar privados). |
| Validación | **Zod** | Validación compartida entre formularios de cliente y API del servidor. |
| Búsqueda y paginación | **Índices en PostgreSQL (categoría, subtipo, precio, fecha) + paginación por cursor con Prisma** | Filtros combinables y carga "cargar más" eficientes incluso con el catálogo y las publicaciones creciendo. |
| Testing | **Vitest** (unitario) + **Playwright** (e2e, fase posterior) | Ligeros, rápidos, integran bien con el resto del stack. |

### Resumen de cuentas gratuitas a crear
1. Discord Developer Portal (app OAuth2 + webhook).
2. GitHub (repositorio + Actions para el cron de scraping).
3. Vercel (hosting de la web).
4. Neon o Supabase (base de datos Postgres).

Con este stack, el coste de infraestructura es **0€** para el tamaño típico de una guild, con margen de sobra en todos los free tiers mencionados.

---

## 6. Próximos pasos sugeridos

1. Confirmar el `GUILD_ID` del Discord de la guild y crear la aplicación en el Discord Developer Portal.
2. Contactar al autor de Midgardhub para informar del uso previsto de los datos.
3. Arrancar el repositorio con Next.js + Tailwind + Prisma, y montar el login con Discord (Fase 1).
4. Una vez el login y la venta directa funcionen de punta a punta (incluida la notificación al canal de Discord), pasar a subastas (Fase 2).
