# SPYDEE Production Deployment

This guide describes deploying SPYDEE as a production stack on a single host
with Docker Compose. The API, async worker, PostgreSQL, and the web UI (static
SPA + nginx reverse proxy) each run in a separate container.

```
                     ┌─────────┐
   Browser ── :80 ──▶│   web   │  nginx (SPA + /api proxy)
                     └────┬────┘
                          │ /api/v1
                     ┌────▼────┐
                     │   api   │  uvicorn + migrations
                     └────┬────┘
              ┌───────────┤───────────┐
   ┌──────────▼──┐  ┌─────▼─────┐  ┌──▼─────────┐
   │ postgres:16 │  │  worker   │  │ uploaddata │  volume
   └─────────────┘  └───────────┘  └────────────┘
```

## Prerequisites

- Linux host (or Docker Desktop on macOS/Windows with WSL2)
- Docker Engine 24+ and Docker Compose v2
- A DNS name / public reverse proxy if exposing beyond the host

## Quick start (single host)

```bash
# 1. Clone and enter the repository.

# 2. Create the production environment file.
cp .env.prod.example .env.prod
#    then edit .env.prod (all placeholder values must change).

# 3. Generate a strong SECRET_KEY and put it in .env.prod.
python -c "import secrets; print(secrets.token_urlsafe(48))"

# 4. Build and start the stack. Migrations run automatically at first boot.
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build

# 5. Check health.
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
curl http://localhost/api/v1/health

# 6. Follow the logs.
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f api
```

The web UI is served at `http://<host>/`. The OpenAPI docs live at
`http://<host>/api/docs`.

### Seeding demo content (optional)

Production containers never seed demo content automatically. To load the three
synthetic demo cases and the demo accounts, set `DEMO_MODE=true` in
`.env.prod` (or set it once for a throwaway environment) and run:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec api \
  python -m demo.generator.seed_db
```

Demo accounts are `admin/admin123`, `investigator/invest123`,
`supervisor/super123`. **Change or remove these immediately in any shared
environment.**

## Configuration reference

All settings come from `.env.prod` (see `.env.prod.example`).

| Variable            | Required | Default                  | Notes |
|---------------------|----------|--------------------------|-------|
| `POSTGRES_USER`     | no       | `spydee`                 | DB role |
| `POSTGRES_PASSWORD` | **yes**  | —                        | DB password, never default |
| `POSTGRES_DB`       | no       | `spydee`                 | Database name |
| `SECRET_KEY`        | **yes**  | —                        | JWT signing key, `secrets.token_urlsafe(48)` |
| `CORS_ORIGINS`      | no       | `http://localhost`       | Direct browser origins allowed |
| `DEMO_MODE`         | no       | `false`                  | `true` loads demo cases via seed |
| `WEB_PORT`          | no       | `80`                     | Host port for the web UI |
| `UVICORN_WORKERS`   | no       | `1`                      | API worker processes |
| `MAX_UPLOAD_BYTES`  | no       | `50000000`               | Max evidence file size (bytes) |
| `LLM_PROVIDER`      | no       | *(empty)*                | `ollama` to enable LLM answer polish |
| `OLLAMA_BASE_URL`   | no       | `host.docker.internal`   | Ollama endpoint reachable from the API |
| `OLLAMA_MODEL`      | no       | `llama3.1`               | Ollama model name |

- `LLM_PROVIDER` empty means the copilot returns fully deterministic,
  tool-backed answers with **no external service dependency**.
- If the copilot must never reach a network service, leave `LLM_PROVIDER`
  empty and do not set `OLLAMA_BASE_URL`.

## TLS / public reverse proxy

The bundled nginx only serves HTTP. Terminate TLS on the host or at an
upstream gateway:

- **Caddy** (single-binary, auto-HTTPS): proxy to `http://127.0.0.1:${WEB_PORT}`.
- **Host nginx**: proxy_pass to the same, set `X-Forwarded-Proto https`.
- **Traefik / cloud LB**: route to the host's published web port.

The web app calls `/api/v1` same-origin, so no CORS entry is needed when
served through the proxy. Direct API access from other origins requires the
origin to be listed in `CORS_ORIGINS`.

## Backups

```bash
# Full dump to a file on the host.
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > spydee-$(date +%F).sql

# Restore.
cat spydee-YYYY-MM-DD.sql | docker compose --env-file .env.prod \
  -f docker-compose.prod.yml exec -T db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Uploaded evidence lives in the `uploaddata` volume — back it up with the
database (`docker run --rm -v spydee_uploaddata:/data -v "$PWD":/backup
alpine tar czf /backup/uploads.tgz -C /data .`).

## Upgrades

```bash
git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml build
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

Schema migrations run automatically on API startup
(`alembic upgrade head`). Take a database backup before upgrading.

## Scaling notes

- The default stack runs one API process and one worker loop. For more
  throughput, raise `UVICORN_WORKERS` and scale the worker
  (`docker compose ... up -d --scale worker=2`). The worker polls its job
  table, so multiple replicas are safe.

## Security checklist

- [ ] Replace `SECRET_KEY` and `POSTGRES_PASSWORD` with strong unique values.
- [ ] Run the stack on a firewall-protected host or behind TLS.
- [ ] Do not expose container ports (`5432`) to the public network.
- [ ] Set `DEMO_MODE=false` unless actively demonstrating; never ship the demo
      accounts in a shared environment.
- [ ] Keep `OLLAMA_BASE_URL` restricted or `LLM_PROVIDER` empty if no LLM is needed.
- [ ] Back up `pgdata` and `uploaddata` regularly and test restores.

## Troubleshooting

- **API does not come up / migrations fail**: check
  `docker compose ... logs api`; ensure the DB password in `.env.prod` matches
  what the DB container used on its first boot (changing it later requires
  recreating the volume or `ALTER USER`).
- **Web UI loads but API returns 502**: confirm the `api` service is healthy:
  `docker compose ... logs api`.
- **Uploads rejected as too large**: raise `MAX_UPLOAD_BYTES` and the nginx
  `client_max_body_size` in `apps/web/nginx.conf` (60m default).
- **Copilot errors mentioning Ollama**: the API could not reach
  `OLLAMA_BASE_URL`. Set `LLM_PROVIDER=` to run fully offline.