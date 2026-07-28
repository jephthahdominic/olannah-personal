# Olannah

A Next.js + FastAPI + PostgreSQL application, containerized with Docker and deployed to AWS via Terraform and GitHub Actions.

**Tech stack:** Next.js (TypeScript, App Router) · FastAPI (Python) · PostgreSQL · Docker / Docker Compose · Terraform · GitHub Actions · AWS

## Architecture

The frontend and backend run as separate containers, with a third container for PostgreSQL. The frontend fetches data from the backend server-side (inside its own Next.js server, not from the browser), which avoids needing CORS configuration on the backend.

Locally, all three containers run together via Docker Compose. The same containers are designed to run the same way on a single EC2 instance, provisioned by Terraform, with GitHub Actions handling CI (build + test) and deployment: pushing images to ECR (authenticated via OIDC, no long-lived AWS keys) and updating the running containers over SSH.

## Repo Structure

```
.
├── frontend/               Next.js app
├── backend/                FastAPI app
├── infra/
│   ├── modules/dev-ec2/    Reusable Terraform module: EC2, ECR, IAM/OIDC
│   └── environments/dev/   Terraform root config for the dev environment
├── docker-compose.yml      Local dev stack: frontend + backend + postgres
└── .github/workflows/      CI/CD pipeline
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
