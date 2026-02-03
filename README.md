# JobStream Engine

A job aggregation platform that pulls listings from multiple XML feeds, processes them through a Redis queue, and displays everything on a clean real-time dashboard.

## Live

| Service | URL |
|---------|-----|
| Frontend | https://jobstream-engine.vercel.app |
| Backend API | https://jobstream-engine-1.onrender.com |
| Worker | https://jobstream-engine1.onrender.com |

Hit the dashboard, click "Trigger Bulk Import", and watch it pull in jobs from 8 different feeds automatically. No setup needed on your end — if the database is empty it initializes everything by itself.

## How It Works

When you trigger an import, the server grabs all the active feed URLs from MongoDB and throws them into a Bull queue backed by Redis. The worker picks those jobs up (5 at a time), fetches the XML from each feed, parses out the job listings, and saves them to MongoDB. If a feed fails it retries up to 3 times with exponential backoff. Once a job finishes processing, Socket.IO pushes the update to the dashboard in real time.

```
Dashboard  →  Express Server  →  Redis (Bull Queue)  →  Worker
                   ↕                                      ↓
              MongoDB  ←──────────────────────────────────┘
```

## Tech Stack

- **Backend** — Node.js, Express, Mongoose, Bull, Socket.IO, Winston, xml2js
- **Frontend** — Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Lucide
- **Databases** — MongoDB (Atlas), Redis (Upstash)
- **Hosting** — Vercel (frontend), Render (backend + worker)

## Running Locally

You'll need Node 18+, MongoDB, and Redis running locally.

```bash
# Backend
cd server
npm install
npm run dev

# Worker (separate terminal)
cd server
npm run worker

# Frontend (separate terminal)
cd client
npm install
npm run dev
```

Or just use Docker and it spins up everything for you:

```bash
docker compose up -d
```

## Environment Variables

**server/.env**
```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/job-importer
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false
QUEUE_CONCURRENCY=5
BATCH_SIZE=100
CRON_SCHEDULE=0 * * * *
CLIENT_URL=http://localhost:3000
```

**client/.env.local**
```env
NEXT_PUBLIC_API_URL=http://localhost:5001/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5001
```

## API Endpoints

```
POST   /api/imports/trigger-bulk     Kick off all feeds at once
POST   /api/imports/trigger          Trigger a single feed by URL
GET    /api/imports/stats            Dashboard stats + queue info
GET    /api/imports/history          Paginated import history
GET    /api/imports/history/:id      Details on a specific import
GET    /api/imports/feeds            List all registered feeds
```

## Project Structure

```
jobstream-engine/
├── client/                 Next.js frontend
│   └── src/
│       ├── app/            Pages and layout
│       ├── components/     UI components (Header, StatsCards, ImportHistoryTable)
│       ├── lib/            API client
│       └── types/          TypeScript types
├── server/                 Express backend + worker
│   └── src/
│       ├── config/         Database connection
│       ├── controllers/    Route handlers
│       ├── middleware/     Error handling
│       ├── models/         Mongoose schemas (Job, JobFeed, ImportLog)
│       ├── queues/         Bull queue setup
│       ├── routes/         API routes
│       ├── services/       Business logic (cron, fetcher, importer)
│       ├── utils/          Logger, XML parser
│       └── workers/        Queue processor
├── docker-compose.yml      Local dev with Docker
└── README.md
```

## Feed Sources

The system pulls from these Jobicy feeds by default:

1. All Jobs (general feed)
2. Social Media Marketing
3. Seller — France region
4. Design & Multimedia
5. Data Science
6. Copywriting
7. Business
8. Management

New feeds auto-initialize on first run. If you clear the database and trigger an import, it recreates them without you having to do anything.

## License

MIT
