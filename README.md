# Olannah

A Next.js + FastAPI + PostgreSQL application, containerized with Docker for local development.

**Tech stack:** Next.js (TypeScript, App Router) · FastAPI (Python) · PostgreSQL · Docker / Docker Compose

## Architecture

The frontend and backend run as separate containers, with a third container for PostgreSQL. The frontend fetches data from the backend server-side (inside its own Next.js server, not from the browser), which avoids needing CORS configuration on the backend.

All three containers run together locally via Docker Compose.

## Repo Structure

```
.
├── frontend/               Next.js app
├── backend/                FastAPI app
└── docker-compose.yml      Local dev stack: frontend + backend + postgres
```

## Prerequisites

- Docker and Docker Compose

## Quick Start

```bash
cp .env.example .env
docker compose up -d --build
```

Once the stack is running:

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend health: [http://localhost:8000/health](http://localhost:8000/health)
- Backend + database health: [http://localhost:8000/db-health](http://localhost:8000/db-health)

## Stopping

```bash
docker compose down
```
