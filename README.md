<div align="center">

<h1>PsyPlatform</h1>
<hr>

**Psycho-emotional health monitoring in one place: standardized tests, AI analysis with fallbacks, live psychologist escalation**

![FastAPI](https://img.shields.io/badge/FASTAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/REACT-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/POSTGRESQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/DOCKER-compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![License](https://img.shields.io/badge/LICENSE-MIT-green?style=flat-square)

[Stack](#technical-stack) · [Quick start](#quick-start) · [License](#license)

</div>

> [!NOTE]
> Archived — this project is no longer maintained.

## What it is

A platform for monitoring the emotional state of employees and students. A user takes a standardized test, gets an AI analysis with course recommendations, and can escalate to a live psychologist over WebSocket. Admins and psychologists get analytics dashboards.

AI analysis tries Groq first, then Gemini, then a deterministic score-based fallback, so a test always returns a result even without API keys.

## Highlights

- Three-level analysis chain: Groq (LLaMA 3.3 70B), Google Gemini 2.5 Flash, deterministic fallback.
- Role-based access (user, psychologist, admin) with JWT and bcrypt.
- Real-time notifications for users and psychologists through WebSocket.
- Emotion capture from the camera in the browser (face-api.js), charts and heat map.
- UI in Russian, Kazakh and English.

## Technical stack

| Layer | Technology |
|-------|------------|
| Backend | Python, FastAPI 0.115, SQLAlchemy 2 (async), Alembic |
| Frontend | React 19, TypeScript 5.9, Vite 8, Tailwind CSS 4, Zustand, Recharts |
| Data | PostgreSQL 16 (asyncpg), SQLite via aiosqlite for local development |
| AI | Groq API, Google Gemini API |
| Infra | Docker Compose, Nginx, Cloudflare Tunnel |

## Quick start

Requirements: Docker with Compose. AI keys are optional because of the fallback.

```bash
cp .env.example .env     # add GROQ_API_KEY / GEMINI_API_KEY if available
docker compose up --build
```

The app is served by Nginx at `http://localhost`, the API docs at `http://localhost/api/docs`. Demo data (users, tests, courses) is seeded on first start. Apply migrations with:

```bash
docker compose exec backend alembic upgrade head
```

| Variable | Default in `.env.example` | Purpose |
|----------|---------------------------|---------|
| `DATABASE_URL` | `postgresql+asyncpg://app:app@db:5432/hackathon` | Database (`db` is the compose service) |
| `GROQ_API_KEY` | empty | Primary AI provider |
| `GEMINI_API_KEY` | empty | Fallback AI provider |
| `JWT_SECRET` | `your-super-secret-key-change-in-production` | JWT signing secret |
| `JWT_EXPIRE_MINUTES` | `1440` | Token lifetime |
| `CLOUDFLARE_TUNNEL_TOKEN` | empty | Optional public access |

## Project structure

```text
backend/    FastAPI app (api, core, models, services, seed), Alembic migrations
frontend/   React SPA: pages, components, stores, WebSocket hook
nginx/      Reverse proxy with WebSocket upgrade
docs/       Static demo bundle
```

## License

MIT, see [LICENSE](LICENSE).
