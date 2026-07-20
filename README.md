# RO Guild Market

Mercado privado para la guild, con login por Discord. Ver [ro-guild-market-plan.md](./ro-guild-market-plan.md) para la especificación completa.

## Requisitos

- Node.js 20+
- Docker (para la base de datos local)

## Puesta en marcha

1. Copia `.env.example` a `.env.local` y rellena las credenciales de Discord (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID`, `DISCORD_WEBHOOK_URL`, `AUTH_SECRET`).
2. Levanta la base de datos local:
   ```bash
   docker compose up -d db
   ```
3. Instala dependencias y aplica las migraciones:
   ```bash
   npm install
   npx prisma migrate dev
   ```
4. Arranca el servidor de desarrollo:
   ```bash
   npm run dev
   ```

`POSTGRES_PRISMA_URL`/`POSTGRES_URL_NON_POOLING` ya vienen apuntando al Postgres local (`.env`, puerto 5433) — no hace falta tocarlos salvo que cambies la configuración de `docker-compose.yml`. En producción, la integración Vercel↔Supabase rellena esas mismas variables sola (no se pegan a mano).

## Prisma

- Esquema: `prisma/schema.prisma`
- Tras cualquier cambio de esquema: `npx prisma migrate dev --name <descripcion>`
- Explorar los datos: `npx prisma studio`

## Catálogo de items

La carga del catálogo de items vive en un repositorio aparte:
[ro-guild-market-generator](../ro-guild-market-generator). Es manual y puntual
(sin cron); tras ejecutarlo hay que copiar a mano los iconos generados a
`public/icons/items/` en este repo.
