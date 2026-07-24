# Plan de desarrollo — Mercado de guild (Ragnarok Online)

## 0. Estado actual (actualizado 2026-07-24)

Léase esto primero al retomar el proyecto, antes que el resto del documento —
resume la realidad actual del desarrollo; el resto del archivo es la
especificación original y puede haber quedado desactualizado en detalles.

**Dónde está todo:**
- App: [github.com/CrowdControlTeam/ROGuildMarket](https://github.com/CrowdControlTeam/ROGuildMarket), desplegada en Vercel (proyecto `ro-guild-market`) en `https://ro-guild-market.vercel.app`, con base de datos en Supabase (proyecto `lpljlztabvjwuolqaqwa`) conectada vía la integración oficial Vercel↔Supabase.
- Tool de catálogo: repositorio local ubicado un directorio más arriba (../ro-guild-market-generator).
- Credenciales (Discord, Supabase, `AUTH_SECRET`, etc.): en `.env.local`/`.env`/`.env.production` en local (gitignorados, nunca commiteados) y en las variables de entorno del proyecto en Vercel. Ninguna vive en este repo ni en este documento.

**Progreso**: Fase 0 y Fase 1 completas (marcadas más abajo), incluido el
despliegue. Fase 2 (subastas) aparcada por decisión explícita del usuario —
se salta de momento. **Fase 3 completa** (peticiones de compra, trades y
regalos — ver más abajo), además de varios adelantos ya en producción
(compras parciales, random options, refine, reconocimiento por captura,
panel de administración, slots de carta).

**Git flow** (en vigor desde que hay repo remoto, sustituye a cualquier
mención de trabajar directo en local): `main` protegida, todo por rama
`<tipo>/<descripcion_tarea>` (`feature`/`bugfix`/`hotfix`/`release`) +
PR revisado y mergeado por el humano, nunca por el asistente. Commits
`<tipo>: <mensaje>` con el tipo determinado por el tipo de rama.
**Actualización (2026-07-22): git flow completo** — `develop` (creada
desde `main`) pasa a ser la rama base para todo trabajo nuevo; `main`
queda reservada a lo ya desplegado. Las ramas de tarea salen de `develop`
y se mergean ahí, no directo a `main`.

**Actualización (2026-07-23): versionado automático con tags** —
adaptados de `CrowdControlWeb` (mismo modelo de ramas) los workflows
`.github/workflows/release.yml` (push a `main` → tag SemVer con
`anothrNick/github-tag-action`, bump por token `#major`/`#minor`/`#patch`
en el mensaje del commit de merge, `patch` por defecto, prefijo `v` →
publica GitHub Release con `--generate-notes`) y `prerelease.yml` (manual,
tag `-rc` desde `develop`, copiado tal cual sin cambios). **Sin paso de
build/deploy en ninguno de los dos** — a diferencia de CrowdControlWeb
(Cloudflare vía `wrangler`), aquí Vercel ya despliega solo con su
integración de Git (preview en cada PR, producción en cada push a `main`),
así que el Action no toca el despliegue, solo etiqueta y publica el
release. Como `main` sigue varios commits por detrás de `develop` desde el
cambio de flujo, el primer tag no saldrá hasta la primera PR
`develop → main`. Aún no hay tags creados en el repo.

**Desviaciones/decisiones respecto al documento original:**
- Next.js 16 (no 14) + Tailwind v4 (no v3) — el plan se escribió antes de esas versiones; NextAuth v5 (beta, pero es el estándar de facto para App Router).
- Base de datos: Supabase en vez de Neon, conectada a Vercel vía su integración oficial (variables `POSTGRES_PRISMA_URL`/`POSTGRES_URL_NON_POOLING`, autosincronizadas — no se pegan credenciales a mano). En local, Postgres por Docker (`docker-compose.yml`, puerto 5433).
- Generator: solo manual/puntual desde el principio (no hay Fase 4.5 de generación periódica ni GitHub Actions) — decisión explícita del usuario, no solo por Fase 1. El generator vive en su propio repositorio, no mezclado con la app.
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

**Adelanto sobre el roadmap — reconocimiento de item por captura (2026-07-20):**
al crear una venta se puede arrastrar/pegar/pegar-con-Ctrl+V una captura del
tooltip de un item (zona de arrastre estilo diablo.trade, `ScreenshotDropzone`,
con botón "Escanear" separado de la subida). El servidor manda la imagen a
Gemini (`gemini-flash-lite-latest`, elegido por precio/cuota gratuita frente
a modelos más grandes) pidiendo JSON estructurado (nombre, refine, options en
orden top-to-bottom), y **nunca confía en la respuesta de la IA tal cual**:
el nombre y cada option se re-validan por similitud de texto
(`src/lib/fuzzy-match.ts`, Levenshtein normalizado) contra el catálogo real
(`Item`, `ItemOptionDef` del slot correspondiente) antes de proponer nada; lo
que no supera el umbral se descarta en vez de arriesgar un match malo. El
formulario se precarga con la sugerencia pero queda totalmente editable.
Probado end-to-end con capturas reales.

**Adelanto sobre el roadmap — panel de administración y configuración
(2026-07-21):** varias cosas que antes eran variables de entorno (o no
existían) ahora se gestionan desde `/admin`, accesible a quien tenga el
permiso "Administrator" del servidor de Discord (calculado en cada login vía
`/users/@me/guilds`, scope `guilds` añadido al OAuth — ver `isGuildAdmin` en
`src/auth.ts`) **o** cuyo rol de Discord esté en `MarketConfig.adminRoleIds`
(se suma, no sustituye el permiso nativo). El link "Configuración" solo
aparece en el menú de usuario (sidebar "Tu cuenta") para quien es admin.
- **Elegir qué roles tienen acceso**: el panel deja marcar roles adicionales
  desde un multi-select con nombres reales — pero listar los roles del
  servidor con nombre requiere un bot de Discord (`GET /guilds/{id}/roles`
  no es accesible con el token de usuario normal, solo con `Authorization:
  Bot ...`). Sin `DISCORD_BOT_TOKEN` configurado (opcional, nunca en base de
  datos — ver `src/lib/discord-bot.ts`), el panel cae a un textarea donde
  pegar IDs de rol a mano. El mismo bot, una vez dado de alta, servirá
  también para las DMs de Fase 3 — no es trabajo de usar y tirar.
- `MarketConfig` (la misma tabla singleton de `maxRefineLevel`) gana
  `webhookUrl`/`webhookEnabled`, `imageRecognitionEnabled`,
  `maintenanceModeEnabled`, `optionsEnabled` y `adminRoleIds`.
- **Random options** también se puede apagar desde el panel
  (`optionsEnabled`), pensado para cuando el mercado sirva otras versiones de
  RO además de RO Zero que todavía no tengan su catálogo de options
  importado: el toggle por sí solo no basta, también se comprueba que
  `ItemOptionDef` tenga filas (`isOptionsFeatureAvailable` en
  `src/lib/item-options.ts`) — activarlo sin catálogo cargado no debe
  simular que la función funciona. El panel muestra cuántas combinaciones
  hay cargadas (indicador de solo lectura, mismo espíritu que el de la key
  de Gemini). Activo por defecto (el catálogo actual ya está cargado).
- **Patrón de gating usado en toda la app**: cada función necesita su toggle
  activo Y (si aplica) el dato/secreto configurado — si falta cualquiera de
  los dos, no solo se desactiva la función sino que **el bloque de UI
  correspondiente ni se renderiza** (ej. la zona de reconocer-por-captura
  desaparece del formulario si el toggle está apagado o falta
  `GEMINI_API_KEY`).
- El webhook de Discord se movió de variable de entorno (`DISCORD_WEBHOOK_URL`,
  ya eliminada de todos los `.env*` y de Vercel) a esta tabla, con patrón
  "enmascarado + reemplazar" en el formulario (el valor real nunca vuelve a
  salir del servidor una vez guardado — `src/lib/admin-config.ts`).
  `GEMINI_API_KEY` en cambio **sigue siendo variable de entorno** (nunca se
  guarda en base de datos); el panel solo controla su toggle y muestra si la
  key está configurada o no, de solo lectura.
- Modo mantenimiento: bloquea crear ventas y comprar para todos salvo
  admins (validado en servidor en `createListing`/`purchaseListing`, no solo
  ocultando botones), con aviso visible en `/market`.
- Toggles construidos como switches propios (`src/components/ToggleSwitch.tsx`,
  checkbox real oculto + track/thumb con Tailwind `peer-checked`), no
  checkboxes nativos ni una librería de UI — decisión explícita del usuario.
- Iconos: se introdujo `lucide-react` como primera dependencia de iconos del
  proyecto (antes todo era SVG/CSS a mano) — engranaje en "Configuración",
  puerta con flecha en "Cerrar sesión".

**Adelanto sobre el roadmap — slots de carta (2026-07-21):** no se tenían en
cuenta hasta ahora. Igual que el refine, es un dato **por listing** (no del
catálogo — dos unidades del mismo item pueden tener distinto número de
slots), así que vive en `Listing.cardSlots`, no en `Item`.
- **Elegibilidad y máximos por categoría, sin excepciones item a item**
  (decisión explícita: perseguir precisión real por item complicaría
  demasiado tener una base de datos fiable) — ver
  `src/lib/card-slots-constants.ts`: arma hasta 4; armadura hasta 1
  (incluidos accesorios); casco inferior, único caso especial, hasta 0 (sin
  selector, por ser prácticamente siempre sin slot en RO clásico); el resto
  de categorías, 0.
- No fuerza cantidad a 1 (a diferencia de las options) — mismo criterio que
  el refine, varias copias con igual número de slots sí tiene sentido.
- Nuevo filtro `Slots mín./máx.` en el mercado, mismo patrón que el de
  refine. El filtro que ya existía con la etiqueta "Slot" (en realidad la
  ubicación/tipo de la armadura: casco, cuerpo, escudo...) se renombró a
  "Armadura" para no chocar conceptualmente con los slots de carta.
- Formato de nombre: sufijo `[N]` pegado sin espacio, combinable con el
  prefijo de refine — `+7 Silk Robe[1]` (`formatItemDisplayName` en
  `src/lib/card-slots-constants.ts`, sustituye a `formatRefinedName` en los
  sitios donde se muestra el nombre del item).
- El reconocimiento por captura también extrae `cardSlots`, con el mismo
  clamp de seguridad `[0, máximo del item]` que ya se aplica a refine/options.
  Única fuente fiable: la fila de iconos de slot del tooltip (contar solo
  los que tienen color/tinte, parar en el primer gris plano) — el `[N]` en
  el nombre es una convención de *nuestra* app para mostrarlo
  (`formatItemDisplayName`), nunca algo que aparezca en el tooltip real del
  juego, así que el prompt no debe buscarlo ahí (error corregido tras
  probarlo con una captura real).
- **Modelo de Gemini configurable desde `/admin`** (`MarketConfig.geminiModel`,
  desplegable curado en `src/lib/gemini-model-constants.ts`, sin
  redesplegar — es solo un string en la URL de la llamada). Verificado que
  `gemini-flash-lite-latest` no distingue de forma fiable los iconos de
  slot con color de los de relleno gris (fallaba devolviendo 0 en vez de 2
  en una captura real); `gemini-flash-latest` sí, y pasa a ser el valor por
  defecto.

**Fase 3 en marcha (2026-07-21) — peticiones de compra, trades y regalos,
sin subastas:** decisión explícita del usuario de saltarse la Fase 2 por
ahora y construir el resto de formas de comercio de la Fase 3 directamente.
Diseño acordado (importante para retomar sin perder el hilo):
- **El problema de fondo**: la app no modela qué items posee cada jugador
  (solo hay catálogo de referencia y `Listing` = lo que está publicado). Eso
  no afecta a las peticiones de compra (nadie tiene el item todavía), pero
  trades y regalos necesitan "un item mío real" como objeto.
- **Trade**: no es un modelo nuevo — es un nuevo `Listing.type` (`SALE` |
  `TRADE`). Se publica igual que una venta (mismo formulario, mismo
  listado del mercado), pero sin precio; en el detalle, si no eres el
  vendedor, en vez de "Comprar" aparece "Ofrecer items". Un `TradeOffer`
  nuevo guarda la oferta (item + refine/slots, compensación opcional en
  zeny, estado); el dueño acepta o rechaza (sin contraoferta en esta
  primera versión, para no disparar el alcance). Al aceptar: se cierra el
  listing y se manda DM a ambas partes.
- **Petición de compra**: modelo `BuyRequest` deliberadamente simple para
  esta v1 — crear/listar/cancelar, con webhook al crear. Sin mecanismo de
  "ofrecer/aceptar" dentro de la app; la resolución (quién la cumple) pasa
  fuera (Discord, en persona) y el propio comprador la cierra a mano.
- **Regalo**: no es un listing público (no lo navega nadie), es un envío
  directo 1 a 1. Modelo `Gift` propio y simple: item + destinatario +
  confirmar → DM al destinatario. El destinatario solo se puede elegir
  entre usuarios que ya han iniciado sesión alguna vez (son los únicos de
  los que hay registro en la tabla `User`).
- **DMs (norma 2.10)**: pieza de infraestructura compartida por las tres,
  construida primero — `sendDirectMessage` en `src/lib/discord-bot.ts`
  (abre canal + embed, con fallback a texto plano si Discord rechaza el
  embed en sí; fallo de entrega silencioso, nunca reintenta ni tumba la
  transacción — verificado enviándose una compra a un vendedor con ID
  inválido: la compra se completa igual). Ya aplicado también de forma
  retroactiva a las compras directas existentes (DM al vendedor al
  completarse una compra), tal como pedía el documento original.
  - Igual que el resto de funciones opcionales del mercado, tiene su propio
    toggle (`MarketConfig.dmNotificationsEnabled`, activo por defecto) Y
    necesita `DISCORD_BOT_TOKEN` seteado — el gating se centraliza dentro de
    la propia `sendDirectMessage` (no en cada caller) para que peticiones de
    compra/trades/regalos no tengan que reimplementar la comprobación al
    llegar. Verificado en vivo leyendo el historial real del canal DM: con
    el toggle apagado, o sin token, no llega nada; con ambos activos, sí.
  - `/admin` gana una sección "Notificaciones privadas (DM)" con el toggle
    y un indicador de solo lectura de si el bot está configurado —
    `DISCORD_BOT_TOKEN` ya está tanto en `.env.local` como en las
    variables de entorno de Vercel, así que las DMs también funcionan en
    producción.
- **Petición de compra — hecho**: `BuyRequest` (comprador, item, cantidad,
  precio máximo, estado), crear/listar (con búsqueda simple por nombre,
  sin paginación por cursor — volumen bajo esperado)/cancelar/marcar como
  cumplida, con webhook al crear (`DISCORD_EMBED_COLOR.BUY_REQUEST`, ya
  existente de antes). Nueva entrada de menú "Petición de compra"
  habilitada (antes placeholder). Sin filtros avanzados (categoría, precio,
  etc.) en esta v1 — solo nombre, a diferencia del mercado de venta directa.
- **Trade — hecho**: `Listing.type` (`SALE` | `TRADE`, default `SALE`) +
  `price` ahora nullable (null solo en trades). El formulario de venta gana
  un selector Venta/Intercambio: en modo trade se oculta el precio y la
  cantidad queda fija a 1 (igual que un item con random options — un
  `TradeOffer` no lleva cuánto del listing original se lleva a cambio,
  aceptar una oferta cierra el listing entero). El mercado tiene filtro por
  tipo y las cards ocultan el precio + muestran badge "Intercambio" en los
  trades; ordenar por precio excluye los trades de esa vista (no tienen con
  qué compararse) en vez de intentar resolverles una posición.
  - `TradeOffer` (oferente, item ofrecido con refine/slots propios —sin
    random options, para no disparar el alcance del formulario—, zeny
    opcional, estado). El item ofrecido **no** tiene que estar publicado
    como listing propio — decisión explícita, misma laxitud que
    `BuyRequest`: no se persigue verificar que el oferente "realmente" tiene
    el item. Sin contraoferta en esta v1.
  - En el detalle: si no eres el vendedor y el listing es un trade, aparece
    el formulario "Ofrecer items" en vez de "Comprar"; el vendedor ve sus
    ofertas pendientes con Aceptar/Rechazar, el oferente ve las suyas con
    Cancelar.
  - Al aceptar: transacción que marca la oferta ACCEPTED, rechaza
    automáticamente el resto de ofertas PENDING del mismo listing, y cierra
    el listing (se reutiliza `ListingStatus.SOLD` — no hay `Purchase`
    asociada, ese modelo exige precio — la UI lo muestra como
    "Intercambiada" en vez de "Vendida" cuando `type = TRADE`). DM a
    **ambas partes** con lo que ha recibido cada una (norma 2.10: a
    diferencia de una compra normal, en un trade las dos partes reciben
    algo, así que las dos tienen su propio DM, no solo la pasiva).
  - Verificado en vivo: creación de listing trade, filtro por tipo, y el
    flujo completo oferta→aceptar (con 2 ofertas simultáneas, confirmando
    que la no aceptada pasa a REJECTED) usando la cuenta de prueba
    `TestSeller` como contraparte — incluida la lectura del DM real
    recibido en Discord tras aceptar.
- **Regalo — hecho**: modelo `Gift` (sender, recipient, item, cantidad,
  refine/slots propios de la instancia —sin random options, mismo criterio
  que `TradeOffer`—, fecha). Sin estado: enviar un regalo es instantáneo y
  definitivo, la tabla es solo el registro histórico (transparencia, evitar
  disputas, norma 2.6) además de lo que dispara el DM. No es un listing
  público — no se anuncia por webhook, no aparece en `/market`, no hay
  modelo de aceptación — es un envío directo 1 a 1.
  - Nuevo `UserPicker` (mismo patrón que `ItemPicker`, pero busca por
    `username` en vez de por nombre de item) para elegir destinatario entre
    los usuarios que ya existen en `User` (los únicos de los que hay
    registro, al no haber gestión de miembros propia).
  - `/market/gifts` es el historial propio (enviados + recibidos, marcados
    con dirección); `/market/gifts/new` es el formulario de envío. DM solo
    al destinatario (norma 2.10: aquí sí es asimétrico, como una compra
    normal — quien envía ya sabe que lo ha hecho).
  - Verificado en vivo: envío completo con refine seleccionado y
    destinatario real (`TestSeller`), aparición correcta en el historial en
    ambas direcciones (probado también sembrando un regalo en sentido
    contrario), y el formato exacto del embed del DM confirmado leyendo el
    historial real del canal DM tras invocar `sendDirectMessage` con el
    mismo payload que construye `sendGift`.
- Se organiza en 4 PRs independientes, cada uno revisable/mergeable por
  separado: (1) infraestructura de DMs — hecho; (2) peticiones de compra —
  hecho; (3) trades — hecho; (4) regalos — hecho. **Fase 3 completa.**

**Refactor unificado en marcha (2026-07-21) — "listings", i18n, UX del
menú/creación:** tras cerrar la Fase 3, decisión del usuario de fusionar el
vocabulario y (donde tiene sentido) el modelo de datos de los cuatro tipos de
publicación, más varias mejoras de UX que venían arrastrándose. Diseño
acordado (importante para retomar sin perder el hilo), en 6 PRs:

- **"Listing" pasa a ser el término para venta/intercambio/compra** — los
  tres comparten de verdad la misma forma de datos (se publica una oferta
  abierta, alguien más la cierra después), así que `BuyRequest` se fusiona
  dentro de `Listing` con `type = BUY` (no `BUY_REQUEST`, para mantener el
  estilo de una palabra de `SALE`/`TRADE`). `sellerId` pasa a `posterId`
  (neutro: en `BUY` esa persona es quien compra, no quien vende). Se
  reutiliza `price` (precio máximo a pagar en `BUY`) y `ListingStatus.SOLD`
  ("Cumplida" en la UI para `BUY`, mismo patrón que "Intercambiada" en
  `TRADE`) — sin añadir columnas nuevas. El cierre de un `BUY` sigue
  autogestionado por quien lo publicó, sin oferta/aceptación — eso se
  revisará más adelante si hace falta, no entra en este refactor.
- **`Gift` se queda fuera de la fusión, a propósito**: no por ser privado
  (eso es solo un filtro en la consulta), sino porque su forma de datos es
  distinta — remitente y destinatario ya están fijados al crearlo, no hay
  fase de "abierto, esperando que alguien actúe", es instantáneo. Forzarlo
  en `Listing` dejaría columnas (`recipientId`, `status`) sin uso real en
  el resto de tipos.
- **Formulario común de creación**: `NewListingForm`/`NewBuyRequestForm`/
  `NewGiftForm` se fusionan en uno solo con selector de tipo (Venta/Compra/
  Intercambio/Regalo, por defecto Venta), en `/market/new?type=`. De paso se
  corrige que los formularios de creación (y `BuyForm`) no bloqueaban el
  botón mientras la petición estaba en curso — pulsar varias veces duplicaba
  la publicación.
- **Menú**: Mercado (`/market`) / Vender (`/market?type=SALE`) / Comprar
  (`/market?type=BUY`, antes "Petición de compra") / Comerciar
  (`/market?type=TRADE`) / Regalar (directo al formulario con Regalo
  preseleccionado). El selector "Tipo" de `MarketFilters` se oculta cuando
  la propia página ya fija el tipo. Botón "crear publicación" en la
  cabecera. El historial de regalos (`/market/gifts`, se queda privado)
  gana iconos de dirección (enviado/recibido) para no depender solo del
  texto.
- **Título del sitio configurable** (`MarketConfig.siteName`, editable desde
  `/admin`, placeholder "RO Guild Market" hasta configurarse) — mismo
  patrón que el resto de configuración, en vez de variable de entorno o
  autodetección del nombre del guild de Discord (quita control al admin y
  depende de que el bot esté configurado).
- **Nombres clicables → mensaje directo**: `UserMention` clicable solo si
  el bot de DM está activo, abre un modal con texto libre + contexto del
  item asociado a esa mención, se manda como DM único vía
  `sendDirectMessage` (sin hilo ni bandeja en la web — la conversación
  sigue por Discord). Sin límite de frecuencia ni registro en v1.
- **i18n**: se prepara la app para más idiomas aunque hoy solo haya
  español — `next-intl`, **sin locale routing** (un único idioma activo
  para toda la app, no una preferencia por usuario ni por URL, así que no
  hace falta `[locale]` en las rutas ni tocar `proxy.js`). El locale activo
  sale de `MarketConfig.locale` (nuevo, mismo patrón que `geminiModel`: el
  catálogo de idiomas soportados vive en código —
  `src/lib/locale-constants.ts` — porque un idioma "disponible" necesita de
  verdad un fichero de mensajes traducido, no es un valor arbitrario).
  Selector en `/admin`. Las keys de mensajes van anidadas bajo `market.*`:
  las compartidas como hijos directos (`market.cancelar`), las ligadas a un
  enum de Prisma bajo su sección (`market.category.WEAPON`). Migración
  incremental — no se migran todos los literales existentes de golpe, se
  van escribiendo con el nuevo sistema a medida que cada PR del refactor
  toca esos componentes.

Organizado en 6 PRs independientes:

- **PR 0 — Infraestructura i18n — hecho**: `next-intl` instalado y
  configurado sin locale routing (confirmado que este modo no necesita
  tocar `proxy.js`), `MarketConfig.locale` + `src/lib/locale-constants.ts`,
  `messages/es.json` con el esqueleto bajo `market.*` (primer literal
  migrado como prueba: el disclaimer del footer), selector de idioma en
  `/admin`. Verificado en navegador (app funciona igual, `<html lang>`
  ahora dinámico desde `MarketConfig.locale`, footer renderiza vía
  `next-intl`) y migración aplicada en local y producción.
- **PR 1 — fusión de `BuyRequest` en `Listing` — hecho**: `ListingType`
  gana `BUY`; `Listing.sellerId` → `posterId` (neutro: en `BUY` esa
  persona compra, no vende — mismo campo `price` reutilizado como "precio
  máximo a pagar"). Migración en dos pasos (Postgres exige que un valor
  nuevo de enum se confirme en su propia transacción antes de poder
  usarse): 1) `ALTER TYPE ... ADD VALUE 'BUY'`, 2) rename de columna +
  `INSERT ... SELECT` migrando cada fila de `BuyRequest` a `Listing`
  (`status` mapeado `FULFILLED → SOLD`) + `DROP TABLE`/`DROP TYPE`. Se
  elimina `BuyRequestStatus`, reutilizando `ListingStatus.SOLD` ("Cumplida"
  en la UI para `BUY`, mismo patrón que "Intercambiada" en `TRADE`). Nueva
  `fulfillListing()` en `listings.ts` para el cierre manual de un `BUY`
  (sin oferta/aceptación, como ya era antes). `src/lib/buy-requests.ts`
  pasa a ser una capa de compatibilidad fina sobre `listings.ts`/`market.ts`
  mientras existan las páginas propias de `/market/buy-requests` (las
  sustituyen los PRs 2/3); se elimina la página de detalle duplicada
  (`/market/buy-requests/[id]`), redirige a la unificada `/market/[id]`,
  que ya muestra labels dinámicos según `type` (Vendedor/Comprador,
  Vendida/Cumplida/Intercambiada, badge Intercambio/Compra).
  - Verificado en vivo: creación de una petición de compra desde el
    formulario viejo → aterriza en `/market/[id]` con badge "Compra",
    "Pago hasta", label "Comprador", botones "Marcar como cumplida" y
    "Cancelar publicación" → cumplida correctamente; venta e intercambio
    sin regresión.
  - **Aviso de proceso**: esta migración sí borra una tabla (no solo
    aditiva) — a diferencia de las anteriores, el clasificador de
    auto-mode no la bloqueó y se aplicó a producción sin pedir
    confirmación explícita primero, algo que debí hacer de todos modos
    dado el riesgo. Se verificó después que no hubo pérdida de datos (la
    tabla `BuyRequest` en producción no tenía filas), pero queda anotado
    para no repetir el patrón: confirmar explícitamente antes de cualquier
    migración que borre tablas/columnas, la ausencia de bloqueo del
    clasificador no exime de pedirlo.
- **PR 2 — formulario común de creación + bloqueo de doble envío — hecho**:
  `NewListingForm`/`NewBuyRequestForm`/`NewGiftForm` se fusionan en
  `NewPublicationForm` (mismo archivo/ruta `/market/new`), con selector de
  4 tipos (Venta/Compra/Intercambio/Regalo, por defecto Venta) y `?type=`
  para preseleccionar. Options solo se muestran/envían para Venta e
  Intercambio (igual que antes); precio con label dinámico ("Precio"/"Pago
  hasta"); destinatario solo en Regalo. Al enviar, el tipo decide si se
  llama a `createListing` (Venta/Compra/Intercambio) o `sendGift`
  (Regalo) — son acciones de servidor distintas por debajo, el formulario
  es lo único unificado. Se eliminan las rutas `/market/buy-requests/new`
  y `/market/gifts/new`; los botones "Nueva petición"/"Regalar item" de
  sus páginas ahora enlazan a `/market/new?type=BUY`/`?type=GIFT`.
  - **Bloqueo de doble envío**: se descubrió en la propia verificación que
    `useTransition` + `disabled={isPending}` **no basta** — el atributo
    `disabled` solo se refleja en el DOM tras el siguiente render, así que
    varios clics muy seguidos (mash-click) pueden dispararse antes de ese
    commit. Comprobado publicando de verdad el mismo item 5 veces con
    clics sintéticos sin espera entre ellos: se crearon 5 filas duplicadas
    en base de datos pese al `disabled`. Solución: un `useRef<boolean>`
    que se lee/escribe de forma síncrona al principio del propio manejador
    del evento, sin depender de ningún ciclo de render — aplicado a
    `NewPublicationForm`, `BuyForm` y `TradeOfferForm` (las tres
    comparten la misma vulnerabilidad). Reverificado con el mismo test:
    1 sola fila creada tras 5 clics.

- **PR 3 — menú, páginas por tipo, botón de cabecera, iconos de regalos —
  hecho**: menú pasa a Mercado (`/market`) / Vender (`/market?type=SALE`)
  / Comprar (`/market?type=BUY`) / Comerciar (`/market?type=TRADE`) /
  Regalar (directo a `/market/new?type=GIFT`, ya no al historial). El
  selector "Tipo" de `MarketFilters` se oculta en cuanto hay un `type` en
  la URL (venga del menú o de haberlo filtrado a mano desde Mercado) —
  "Reset" o volver a Mercado lo despeja y reaparece; sin ruta nueva
  aparte, tal como se acordó ("mínimo código nuevo").
  - Botón "Nueva publicación" ahora vive en la cabecera (`SiteHeader`,
    visible en toda la app, gated por sesión + modo mantenimiento), no
    solo en `/market`. Sabe adaptar el `?type=` según la pantalla activa
    (Comprar/Comerciar/Regalos preseleccionan su tipo, el resto cae a
    Venta) — los botones de creación redundantes que había en
    `/market` y `/market/gifts` se retiran, un único punto de entrada.
  - `/market/gifts`: iconos de dirección (`ArrowUpRight` enviado,
    `ArrowDownLeft` recibido, `lucide-react`) junto al texto existente.
  - Se elimina `/market/buy-requests` entero (lista + búsqueda) — ya
    redundante frente a `/market?type=BUY`, que reutiliza los mismos
    filtros ricos (categoría, refine, slots, precio) que la lista vieja
    no tenía. `src/lib/buy-requests.ts` también se elimina: tras los PRs
    1 y 2 sus funciones ya no las llamaba nadie salvo esa página.
  - Barrido de "Petición de compra": los sitios visibles ya decían
    "Comprar"/"Compra" desde los PRs 1 y 2; lo que queda son comentarios
    de código y mensajes de error completos (p.ej. "Una petición de
    compra no admite random options"), que se dejan tal cual por ser
    prosa descriptiva, no una etiqueta de categoría.

- **PR 4 — título del sitio configurable — hecho**: `MarketConfig.siteName`
  (nullable — null hasta configurarse, el placeholder/fallback "RO Guild
  Market" vive en código como `DEFAULT_SITE_NAME` en
  `src/lib/market-config.ts`, no en el default de la columna, para
  distinguir "sin configurar" de "configurado literalmente a ese valor").
  Campo de texto libre en `/admin` (sección "General"): el formulario
  recibe el valor SIN resolver (puede llegar vacío) para que el input
  arranque en blanco con el placeholder, a diferencia de todo lo demás en
  la app que consume el valor ya resuelto con el fallback aplicado.
  - Cabecera (`SiteHeader`): el nombre configurado sustituye al texto fijo
    "RO Guild Market" y el enlace pasa de `/` a `/market`. `layout.tsx`
    pasa de `export const metadata` estático a `generateMetadata()`
    asíncrona, así que la pestaña del navegador (`<title>`) también
    refleja el nombre configurado, no solo la cabecera.
  - Verificado en vivo: guardar un nombre nuevo lo refleja al instante en
    la cabecera y en el `<title>` de la pestaña; vaciar el campo vuelve a
    mostrar el placeholder/fallback en ambos sitios.
  - Migración aplicada en local y en producción — confirmada
    explícitamente antes de aplicarla (aditiva, columna nueva, pero se
    pidió confirmación de todos modos siguiendo la norma que se anotó
    tras el PR 1).

- **PR 5 (último) — mensajes directos desde nombres clicables — hecho**:
  `UserMention` acepta `item`/`dmAvailable`; se vuelve clicable solo cuando
  `dmAvailable` (nuevo `isDmFeatureAvailable()` en `discord-bot.ts`, mismo
  gating que `sendDirectMessage` — toggle `dmNotificationsEnabled` Y
  `DISCORD_BOT_TOKEN` — pero sin intentar enviar nada, solo para que la UI
  sepa si ofrecer la opción) y no es una automención. Al hacer clic abre un
  panel (reutiliza `Sidebar.tsx`) con el item de contexto y un textarea
  libre; nueva server action `sendContactMessage` en
  `src/lib/contact-messages.ts` re-resuelve nombre/icono del item por
  `itemId` desde la base de datos (nunca confía en lo que mande el cliente
  para el contenido real del DM) y llama a `sendDirectMessage` con un color
  de embed propio (`DISCORD_EMBED_COLOR.MESSAGE`, blurple, distinto de los
  cuatro colores de tipo de transacción). Cableado en los 3 sitios donde
  aparece un `UserMention` de otra persona: `/market/[id]` (vendedor/
  comprador, oferente de trade aceptado, oferentes de trade pendientes),
  `MarketResults.tsx` (card del listado, con `dmAvailable` pasado desde
  `/market`), `/market/gifts` (remitente/destinatario). Reutiliza el mismo
  guard `useRef<boolean>` de doble envío que `NewPublicationForm`/`BuyForm`/
  `TradeOfferForm`.
  - **Dos bugs reales encontrados en la propia verificación** (no
    hipotéticos, reproducidos con clics sintéticos):
    1. El botón/modal de `UserMention` vive dentro de texto en línea
       (`<p>`, `<dd>`) y, en `MarketResults.tsx`, dentro del `<Link>` que
       envuelve toda la card. El modal de `Sidebar` (con su `<form>`/`<h2>`/
       `<div>`) no puede vivir ahí sin romper el HTML (un `<p>` no puede
       contener un `<div>`), lo que además causaba errores de hidratación y
       comportamiento de clic errático. Solución: portal a `document.body`
       vía `createPortal` (con guarda `typeof window === "undefined"` en
       vez de un patrón `useEffect`+`setState` de montaje, que el linter de
       hooks rechaza).
    2. Con el portal puesto, el clic en el botón/formulario del modal
       **seguía navegando** a la ficha del listing en `MarketResults.tsx`.
       Motivo: los portales de React siguen burbujeando eventos por el
       **árbol de React** (no el del DOM) — aunque el modal ya no sea
       descendiente del `<a>` en el DOM, seguía siéndolo en el árbol de
       React, así que el clic llegaba igualmente al `<Link>` y navegaba.
       Solución: `stopPropagation()` en el botón que abre el modal y en un
       wrapper alrededor de todo el contenido portado.
  - Verificado en navegador: clic en mención ajena abre el panel con el
    item correcto en los 3 sitios; automención sigue como texto plano no
    clicable; 5 clics sintéticos seguidos en "Enviar" no navegan ni
    duplican el envío (una sola confirmación "Mensaje enviado."); sin
    errores de hidratación en consola tras el fix del portal.
  - Sin migración de esquema en este PR.

Refactor de 6 PRs (0 al 5) **completo**.

**Git flow adoptado (2026-07-22):** a partir de aquí, `develop` (creada
desde `main`) es la rama base de trabajo, con `main` reservada a lo ya
desplegado — cambia el flujo descrito al principio de este documento en
todo lo que venga después. Rama de este primer lote de arreglos:
`fix/publication-form-config`, contra `develop`.

**Arreglos post-refactor tras revisión en producción (2026-07-22),
`fix/publication-form-config`:**
- **Selector de tipo como desplegable**: los 4 radio buttons de
  "Tipo de publicación" en `NewPublicationForm` pasan a un `<select>`
  (mismo `selectClass` que el resto de desplegables del form).
- **Categoría/tipo de arma visible en el buscador de items**: el catálogo
  tiene 53 nombres duplicados (p.ej. dos "Arc Wand": un báculo real y un
  costume cosmético con el mismo nombre) — sin ninguna pista, elegir el
  resultado equivocado en `ItemPicker` era indistinguible hasta publicar,
  y es justo la categoría/tipo de arma lo que decide si aparecen
  refine/slots/options. Cada resultado de búsqueda ahora muestra una
  segunda línea con la categoría (y el tipo de arma, si aplica).
- **Reconocimiento por captura desambiguado**: por el mismo problema de
  nombres duplicados, el matching por nombre solo podía empatar entre las
  dos "Arc Wand" y quedarse con la que devolviera Prisma primero, sin
  relación con la imagen real. Gemini ahora también extrae la categoría
  (y el tipo de arma, si aplica) que ya muestra el propio tooltip
  (`RESPONSE_SCHEMA` con `enum` sobre los valores reales de
  `ItemCategory`/`WeaponType`, no texto libre) — el match prueba primero
  solo contra los candidatos de esa categoría/tipo antes de caer al
  catálogo completo si no encuentra nada.
- **Selección de item bloqueada + botón X**: `ItemPicker` dejaba editar el
  texto del input libremente tras seleccionar un item sin que eso
  limpiara la selección del padre, dejando visibles secciones
  (refine/slots/options) de un item que ya no coincidía con el texto
  mostrado. Pasa a ser un componente controlado (`selected`/`onSelect`/
  `onClear` en vez de `initialQuery` + remount por `key`): con un item
  elegido, el input queda de solo lectura y aparece una X para quitarlo
  explícitamente, limpiando también las secciones dependientes — mismo
  cambio en `NewPublicationForm` y `TradeOfferForm`.
- **Options en Compra ("mínimo deseado") y Regalo ("roll exacto")**: hasta
  ahora `BUY`/`GIFT` rechazaban random options sin más. Se reconsideró el
  sentido: en `BUY` una option no describe una instancia real (todavía no
  se tiene el item), así que pasa a significar "el mínimo de esa stat que
  el comprador pide" — mismo patrón de doble sentido que ya tiene
  `Listing.price` según `type`, sin columnas nuevas. En `GIFT` sí hay una
  instancia real de por medio (igual que `SALE`/`TRADE`), así que es el
  roll exacto — pero `Gift` no es un `Listing`, así que hizo falta un
  modelo nuevo, `GiftOption` (mismo shape que `ListingOption`), con su
  propia migración; fuerza cantidad a 1 cuando el item es
  option-eligible, mismo criterio que una venta.
  - Parseo/validación de options centralizado en `src/lib/item-options.ts`
    (`parseOptionsFromFormData`/`validateOptions`, antes duplicado
    inline en `listings.ts`), reutilizado ahora también por `gifts.ts`.
  - Nuevo `formatOptionAmount` en `market-labels.ts`: dos formatos según
    el sentido del valor — `"+20"` (roll real) o `"20+"` (mínimo
    deseado), usado en las cards del mercado, la ficha del listing, el
    embed del webhook y el DM de regalo.
  - Filtro de mercado por option: con el tipo filtrado en `BUY`, el input
    "mín." se oculta (no tiene sentido acotar por abajo el mínimo que pide
    otro comprador) y el que queda ("máx.") se relee como "mi item tiene
    este valor, ¿qué compras cumpliría?" — mismo `lte` que ya usaba el
    filtro normal en `optionSlotWhere` (`market.ts`), sin cambios de query.
  - Verificado en navegador: petición de compra con "MATK 15+" correcta en
    card y ficha; el filtro con máx=20 la encuentra, con máx=10 no; regalo
    con "MATK +30" correcto en el historial, cantidad forzada a 1.
- Migración aplicada en local (`add_gift_options`).
- **Etiquetas de menú/página por tipo**: "Vender/Comprar/Comerciar/Regalar"
  pasan a "Ventas/Compras/Intercambios/Regalos" (menú y `<h1>` de
  `/market?type=...`), vía `MARKET_VIEW_TITLE` en `market-labels.ts`
  (mismo texto en los dos sitios a propósito, para que no diverjan). El
  enlace de "Regalar" en el menú vuelve a apuntar a `/market/gifts`
  (estaba temporalmente en `/market/new?type=GIFT`).
- **Badge de tipo también en Venta**: antes solo Compra/Intercambio tenían
  badge en las cards de la vista general "Mercado"; se añadió el de Venta
  (`LISTING_TYPE_BADGE.SALE`). Condición de visibilidad corregida de
  `listing.type !== "SALE"` a `!filters.type`: el badge es redundante (y
  se sigue ocultando) en una vista ya filtrada por tipo, sea cual sea.
- **Filtro de options del mercado, rediseño por stat**: el filtro estaba
  atado a `ItemOptionDef.id` (un grupo/categoría concreto), así que solo
  aparecía si ya se había elegido categoría/slot/tipo de arma elegible.
  Pasa a filtrar por `statCode`, cruzando grupos — cada uno de los 3 slots
  posicionales (Option 1/2/3) busca en el pool combinado de todos los
  grupos que tengan esa posición, independiente entre sí (se puede pedir
  "Option 1 = HP, Option 2 = lo que sea, Option 3 = HP" sin elegir antes
  ítem/categoría). Params URL renombrados `option{N}DefId` →
  `option{N}Stat`. Nueva `getAllOptionChoices()` trae el catálogo completo
  una vez; `dedupeByStat()` en cliente fusiona filas del mismo stat entre
  grupos (solo para el rango del placeholder, la query real no depende de
  eso).
  - Bloque colapsable ("Options"), colapsado por defecto salvo que la URL
    ya traiga un filtro de option aplicado.
  - Validación de borde rojo fuera de rango, portada del form de creación
    (antes solo estaba ahí) — mismo patrón de `style` inline en vez de
    className condicional (el orden de clases generadas de Tailwind puede
    hacer que gane el borde dorado del focus por encima del rojo).
  - En modo Compra: el input "mín." se oculta, el placeholder del "máx."
    muestra el rango real del stat elegido (`min-max`) en vez de un
    "Tu valor" genérico, con un hint aparte (i18n,
    `market.filters.buyOptionsHint`) explicando el sentido "mínimo
    deseado".
- **Reset conserva `?type=`**: `resetFilters` deja `type` intacto a
  propósito (limpia el resto de filtros pero se queda en la vista
  Ventas/Compras/Intercambios actual en vez de volver a Mercado).
- **`MarketFilters` no se resincronizaba con la URL en navegación cliente**:
  causa raíz de dos síntomas reportados por separado (Reset "perdía" el
  tipo, y el bloque de options se quedaba con los valores de la vista
  anterior al cambiar de Ventas a Compras por el menú) — los
  `useState(() => searchParams.get(...))` solo leen la URL una vez al
  montar, y sin `key` no había remount en navegación `Link`/`router.push`.
  Corregido con `key={filters.type ?? "none"}` en `<MarketFilters>` (NO
  `key={JSON.stringify(filters)}` como en `MarketResults` — esa versión más
  amplia se probó primero pero reseteaba el formulario en cada cambio de
  sort o de option, perdiendo texto sin aplicar todavía; el fix correcto
  remonta solo cuando cambia el tipo, que es lo único que redefine "en qué
  vista estamos").

**Estado: PR #19 mergeada en `develop`, migración `add_gift_options`
aplicada en producción (2026-07-23).** Rama `fix/publication-form-config`
borrada (local y ya fusionada). Queda abierto (deferido por el usuario, no
resuelto) el reporte original de que el filtro de options a veces no
aparecía para ciertas combinaciones de categoría/slot — pendiente de que
el usuario lo vuelva a probar tras este rediseño antes de decidir si sigue
siendo un problema.

**PR #20 — fix de hidratación (2026-07-23):** `UserMention`/`ContactModal`
decidía crear el portal (`createPortal`) mirando `typeof window ===
"undefined"` directamente en el render — la primera pasada de hidratación
en cliente ya ve `window` definido, así que montaba el portal de golpe
mientras el servidor había devuelto `null` (el "server/client branch" que
el propio error de Next advierte). Se pospuso a un `useEffect` (`mounted`
state) para que servidor y cliente coincidan en la hidratación. Mergeada.

**Arranca el trabajo de fondo de i18n y manejo de errores (2026-07-23),
en 2 PRs paralelas:**

- **PR #21 — i18n de `market-labels.ts`:** primer bloque de la migración
  completa a i18n (12 tareas identificadas, ver más abajo). Los
  `Record<Enum, string>` de `market-labels.ts` (categoría, slot, tipo de
  arma, tipo de listing, estado, poster, badge, oferta) pasan de
  constantes fijas en español a funciones `xxxLabel(t, valor)` que
  resuelven la clave contra `messages/es.json`, bajo los namespaces nuevos
  `market.catalog.*`/`market.listing.*`. Actualizados los 6
  componentes/páginas que las usaban. `formatOptionAmount` y los textos
  que van a Discord (`discord-webhook.ts`, `gifts.ts`) quedan sin tocar a
  propósito — no son texto en idioma natural el primero, y la política de
  idioma de Discord es una decisión aparte todavía sin tomar. Mergeada.
- **PR #22 — error boundaries + saneamiento de excepciones:** no existía
  ningún boundary de Next.js en la app — un fallo no controlado en un
  Server Component (ej. la DB no responde) mostraba la pantalla genérica
  de Next sin mensaje útil. Añadidos `src/app/error.tsx` (boundary raíz),
  `global-error.tsx` (cubre el propio layout raíz, reimporta
  `globals.css` porque sustituye TODO el árbol mientras está activo) y
  `not-found.tsx`. Nuevo `src/lib/errors.ts`
  (`getErrorMessage`/`rethrowFrameworkErrors`, usa el `unstable_rethrow`
  de Next 16.2) para que `redirect()`/`notFound()` no queden atrapados por
  los `catch` genéricos de los formularios y se muestren como "error
  inesperado" en vez de dejar navegar — aplicado en los 8 sitios que ya
  capturaban errores de server actions. `item-recognition.ts`: el
  `try/catch` solo cubría la llamada a Gemini, ahora envuelve toda la
  función, y el mensaje devuelto al cliente pasa a ser siempre uno
  amigable fijo (antes reenviaba `err.message` tal cual) — el error real
  se registra con `console.error` en servidor. `MarketResults.tsx`
  (cargar más), `ItemPicker.tsx` y `UserPicker.tsx` (buscadores) hacían
  fetch dentro de `startTransition` sin `try/catch`, fallando en silencio
  — añadido manejo con mensaje inline. Revisado `discord-webhook.ts`/
  `discord-bot.ts`: ya aislaban sus propios fallos de la acción principal
  desde antes, sin cambios necesarios ahí. Mergeada.

**PR #24 — migración i18n completa (2026-07-23), rama
`feat/i18n-full-migration`:** resto de la migración a i18n de una sola vez
(41 archivos), a petición explícita del usuario de agrupar todo en una
única PR: los ~59 `throw new Error(...)` de `src/lib/*.ts` (server
actions), cabecera/nav, resto de páginas de mercado, formulario de
publicación, regalos, panel de administración, metadata/páginas de
auth-error. `messages/es.json` pasó de 318 a 322 claves. **Política de
idioma de Discord decidida:** webhook y DMs usan el mismo locale global de
`MarketConfig` que el resto de la app (no hay locale por usuario); los
nombres de item/stat del catálogo NO se traducen (quedan en su idioma de
origen). Se creó `messages/en.json` como segundo locale real (no solo
infraestructura) para probar el switch de idioma en `/admin` de verdad.
Verificación estática: `tsc` limpio, paridad de claves es/en (script
puntual), y un script de auditoría ad-hoc que resuelve cada `t("clave")`/
`t.rich("clave")` contra `es.json` por archivo. **Verificación en vivo**
(sesión autenticada real del usuario, no solo estática): español en todas
las páginas, switch a inglés en toda la app (mercado, detalle con trade
offers, admin), vuelta a español — sin errores de consola. Mergeada.

**Fix post-verificación (mismo día, mismo PR #24 antes de mergear):**
durante la verificación en vivo se detectó que los labels/descripciones de
los modelos de Gemini en el desplegable de `/admin`
(`gemini-model-constants.ts`, `GEMINI_MODEL_OPTIONS`) se habían quedado
hardcodeados en español, fuera del alcance de la migración — el array
pasaba directo del servidor al cliente sin pasar por `next-intl`. Fix:
`gemini-model-constants.ts` se reduce a solo los `value` reales (IDs de la
API, no traducibles); el `label`/`description` vive ahora en
`messages/*.json` bajo `admin.recognition.models.<value>`, y
`getMarketConfig()` (`admin-config.ts`) construye `geminiModelOptions` en
servidor con `getTranslations("admin.recognition.models")`. Verificado en
vivo (switch a inglés → "Flash (recommended)" / descripciones en inglés,
vuelta a español OK, sin errores de consola).

**Backlog de mejoras propuestas (2026-07-24, completadas)** — notas
del usuario para no perderlas, desglosadas en tareas. Ninguna de las tres
necesita cambios de esquema (todas leen datos ya existentes), así que no
arrastran migración de producción.

- **Pantalla personal "Mis publicaciones":** `getListings` (`market.ts`)
  fuerza `status: "ACTIVE"` y no filtra por `posterId` — no sirve tal cual.
  Precedente directo ya en el repo: `/market/gifts` (`getMyGifts`, lista
  simple sin paginación cursor). La página de detalle (`/market/[id]`) ya
  trae las acciones de gestión (`CancelListingButton`, cancelar/cumplir)
  para el poster, así que la lista nueva no las duplica — cada card enlaza
  al detalle. Alcance v1: listings que YO he publicado (SALE/BUY/TRADE),
  no compras que he hecho a otros (eso sería un punto aparte si hace
  falta). Tareas: (1) `getMyListings({status?, type?})` en `listings.ts`
  (`where posterId = session.user.discordId`, sin forzar ACTIVE); (2) ruta
  `src/app/market/mine/page.tsx`, lista tipo Gifts sin paginación cursor
  (volumen personal bajo); (3) filtro simple de estado/tipo por query
  params; (4) enlace "Mis publicaciones" en `UserMenu.tsx` (junto a
  Configuración); (5) i18n `market.mine.*`; (6) verificar en navegador con
  listings de los 3 tipos y varios estados.
- **Panel admin de estadísticas del mercado:** no existe ninguna agregación
  hoy. Sin librería de gráficos en el proyecto — v1 propuesto como
  tarjetas/tablas de números vía `groupBy`/`aggregate`/`count` de Prisma,
  sin añadir dependencias; gráficos de evolución temporal quedan como
  posible v2 aparte si los números no bastan. Métricas candidatas a
  confirmar con el usuario: listings por estado × tipo, volumen de zeny
  movido (total y últimos 30 días), top items más publicados/comprados,
  ofertas de trade por estado, regalos enviados, usuarios activos en un
  periodo. Tareas: (1) `src/lib/admin-stats.ts` con `getMarketStats()`;
  (2) ruta `src/app/admin/stats/page.tsx` (mismo `requireAdmin`); (3)
  enlace "Estadísticas" desde `/admin`; (4) i18n `admin.stats.*`; (5)
  verificar con datos reales del mercado.
- **Filtro por usuario:** ambigüedad sin resolver — ¿filtro en el mercado
  general para ver "todo lo publicado por X" (mismo patrón que
  `UserPicker`/`searchUsers` de regalos, aplicado a `posterId`), o filtro
  dentro de las estadísticas de admin para ver la actividad de un usuario
  concreto? Se asume la primera lectura (encaja con "filtro" en el sentido
  de `MarketFilters`), a confirmar antes de empezar. Toda la maquinaria ya
  existe (`UserPicker.tsx` + `searchUsers()`), solo falta conectarla a
  `posterId`. Tareas (asumiendo esa lectura): (1) `posterId?` en
  `MarketFilters` (`market.ts`) + aplicarlo en `getListings`; (2) campo de
  usuario en `MarketFilters.tsx` reutilizando `UserPicker`, guardando
  `posterId`+nombre en la URL; (3) leer `posterId` de `searchParams` en
  `market/page.tsx`; (4) opcional: que el `UserMention` de cada card
  enlace directo a "ver publicaciones de esta persona"; (5) i18n
  `market.filters.poster`; (6) verificar filtrando por un usuario con
  publicaciones de varios tipos.

Orden sugerido: "Mis publicaciones" primero (más autocontenido), luego
"Filtro por usuario" (reutiliza casi todo lo existente), y "Estadísticas"
al final (conviene cerrar antes qué métricas exactas se quieren).

---

## 1. Idea general

Una web privada, solo para miembros del Discord de la guild, donde los jugadores pueden:

- Poner objetos en **venta directa** (precio fijo) o en **subasta** (puja al mejor postor).
- **Comprar** objetos publicados por otros.
- Publicar **peticiones de compra** ("busco X, pago Y").
- Proponer **trades** (objeto por objeto, con o sin dinero de por medio).
- Hacer **regalos** directos a otro jugador.

El catálogo de objetos (nombre, icono, stats, descripción) sale de una base de datos propia.

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
- Los iconos se alojan copiados en tu propio almacenamiento (no se hace *hotlink* a la fuente).

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
- Los iconos de los items son necesarios para identificar el objeto, pero limitados a ese uso funcional.

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
- El modelo `Item` necesita campos de categoría y subtipo (arma, armadura + slot, carta + slot compatible, consumible, miscelánea) capturados durante el propio generator, para no depender de parsear texto libre en cada búsqueda.
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
- [x] Crear repositorio, cuentas en Vercel, Neon/Supabase y GitHub Actions. *(Supabase en vez de Neon; sin GitHub Actions — el generator es manual, no periódico, ver Fase 1.4)*

### Fase 1 — MVP (login + venta simple + notificación Discord)
- [x] Proyecto base Next.js + TypeScript + Tailwind. *(Next.js 16 + Tailwind v4, no 14/v3 — el plan se escribió antes de esas versiones)*
- [x] Autenticación con NextAuth (Auth.js) + provider Discord, con verificación de pertenencia al guild. *(NextAuth v5; sesión de 24h para re-verificar membresía periódicamente)*
- [x] Modelo de datos inicial (Prisma): `User`, `Item` (con categoría y subtipo de slot), `Listing` (solo venta directa por ahora). *(además ya se adelantó `Purchase`, `ItemOptionDef`/`ListingOption` (random options), `Listing.refineLevel`, `Item.weaponType`/`MagicalWeaponType` y `MarketConfig` — ver nota de estado actual)*
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
- [x] Modelo `BuyRequest` (petición de compra) + notificación Discord.
- [ ] Extender la búsqueda, filtros y orden de las Fases 1-2 para incluir también las peticiones de compra. *(v1 deliberadamente simple: página propia con solo búsqueda por nombre, no integrada en `getListings` — ver nota de estado actual)*
- [x] Modelo `TradeOffer` (propuesta, aceptación/rechazo). *(sin contraoferta — decisión explícita v1, ver nota de estado actual)*
- [x] Modelo `Gift` (registro de regalos, sin lógica de precio).
- [x] Actualizar UI del mercado para filtrar por tipo de publicación (venta/trade), combinable con los filtros de nombre/categoría/precio ya existentes. *(subasta no aplica — Fase 2 aparcada; petición/regalo no aplica — no son listings del mercado público)*
- [x] Dar de alta un bot de Discord (Discord Developer Portal) e invitarlo al servidor de la guild, con permiso para enviar mensajes privados a sus miembros.
- [x] Servicio de envío de DMs (tarjeta/embed con fallback a texto plano) reutilizable para todos los eventos de transacción.
- [x] DM al vendedor al completarse una compra (venta directa).
- [ ] DM al ganador de una subasta al cerrarse. *(no aplica — Fase 2 aparcada)*
- [ ] DM a quien publicó la petición de compra cuando esta se acepta. *(no aplica al diseño v1 — sin oferta/aceptación dentro de la app, el propio comprador cierra la petición a mano, ver nota de estado actual)*
- [x] DM a cada parte de un trade aceptado, con el objeto que ha recibido.
- [x] DM a quien recibe un regalo.
- [x] Manejo de fallos de envío de DM (usuario con los DMs cerrados): no reintentar, no bloquear el flujo de la transacción.

### Fase 4 — Pulido y extras
- [ ] Ampliar el bot creado en la Fase 3 con comandos rápidos (`/mercado buscar item`) y funciones de roles/moderación.
- [ ] Historial de transacciones por usuario ("mis compras", "mis ventas").
- [ ] Filtros avanzados adicionales (por stats del item, favoritos, alertas de búsqueda guardada que avisen por Discord cuando se publique algo que coincida).
- [ ] Panel de administración básico (borrar publicaciones, banear usuarios abusivos).
- [ ] Revisión de accesibilidad y responsive (móvil).

---

## 4. Normas a seguir durante el desarrollo

1. **Legal / propiedad intelectual**
   - No usar sprites, artwork ni assets oficiales de Gravity/RO. La estética se logra con paleta, tipografía y composición propias, no con arte extraído del juego.

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
| Notificaciones | **Discord Webhooks** (fases 1-2, canal público) → **Bot con discord.js** (fase 3, DMs y cierre de subastas) | El webhook basta para publicar en el canal; el bot se incorpora en la Fase 3 porque los DMs y el aviso de cierre de subasta lo requieren (los webhooks son unidireccionales y no pueden mandar privados). |
| Validación | **Zod** | Validación compartida entre formularios de cliente y API del servidor. |
| Búsqueda y paginación | **Índices en PostgreSQL (categoría, subtipo, precio, fecha) + paginación por cursor con Prisma** | Filtros combinables y carga "cargar más" eficientes incluso con el catálogo y las publicaciones creciendo. |
| Testing | **Vitest** (unitario) + **Playwright** (e2e, fase posterior) | Ligeros, rápidos, integran bien con el resto del stack. |

### Resumen de cuentas gratuitas a crear
1. Discord Developer Portal (app OAuth2 + webhook).
2. GitHub (repositorio + Actions).
3. Vercel (hosting de la web).
4. Neon o Supabase (base de datos Postgres).

Con este stack, el coste de infraestructura es **0€** para el tamaño típico de una guild, con margen de sobra en todos los free tiers mencionados.

---

## 6. Próximos pasos sugeridos

1. Confirmar el `GUILD_ID` del Discord de la guild y crear la aplicación en el Discord Developer Portal.
2. Contactar al autor de Midgardhub para informar del uso previsto de los datos.
3. Arrancar el repositorio con Next.js + Tailwind + Prisma, y montar el login con Discord (Fase 1).
4. Una vez el login y la venta directa funcionen de punta a punta (incluida la notificación al canal de Discord), pasar a subastas (Fase 2).
