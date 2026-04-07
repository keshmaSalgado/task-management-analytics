# Task Management App with Analytics

This is a full-stack starter project with:

- `frontend` - React app (clean UI for auth, task CRUD, analytics view)
- `backend` - Node.js + Express API (JWT login, task CRUD, SQLite)
- `analytics` - Go service (stats/report endpoints + background job)

## Architecture

- React calls:
  - Node API for auth/tasks
  - Go API for analytics stats/reports
- Node stores task data in SQLite (`backend/data/app.db`)
- Go reads the same SQLite DB and generates report files periodically

## Quick Start

### 1) Backend

```bash
cd backend
npm install
npm run dev
```

Runs on `http://localhost:4000`.

### 2) Analytics (Go)

```bash
cd analytics
go mod tidy
go run .
```

Runs on `http://localhost:5000`.

### 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`.

## Default Ports

- Frontend: `5173`
- Backend: `4000`
- Analytics: `5000`

## Environment Variables

### Backend (`backend/.env`)

- `PORT=4000`
- `JWT_SECRET=replace_this`
- `DB_PATH=./data/app.db`

### Analytics (`analytics/.env` optional)

- `PORT=5000`
- `DB_PATH=../backend/data/app.db`
- `REPORT_DIR=./reports`
- `JOB_INTERVAL_SECONDS=60`

### Frontend (`frontend/.env`)

- `VITE_API_URL=http://localhost:4000/api`
- `VITE_ANALYTICS_URL=http://localhost:5000`

