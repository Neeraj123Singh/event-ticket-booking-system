# Ticketing API (`apps/api`)

Express REST service for events, bookings, analytics, and seeding. See the [root README](../../README.md) for environment variables and compose setup.

## Local run

```bash
cp .env.example .env   # fill DATABASE_URL
pnpm --filter api dev
```

Admin routes expect header `x-api-key: $ADMIN_API_KEY`.
