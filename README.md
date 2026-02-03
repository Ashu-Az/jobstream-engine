# JobFlow Hub 🚀

Enterprise-grade job aggregation platform with intelligent queue processing and real-time analytics.

## Features

- **8 Integrated Job Feed Sources** - Automatically imports from Jobicy (7 feeds) and HigherEdJobs
- **Scalable Queue Processing** - Redis + Bull queue system handles 1M+ records efficiently
- **Real-time Dashboard** - Live updates via Socket.IO with beautiful shadcn/ui components
- **Auto-initialization** - Zero configuration required - feeds initialize automatically
- **Smart Import Tracking** - Comprehensive history with success/failure tracking
- **Docker Ready** - One-command deployment with docker-compose
- **Production Grade** - Error handling, retry logic, logging, and monitoring built-in

## Tech Stack

**Backend:**
- Node.js + Express
- MongoDB with Mongoose
- Redis + Bull Queue
- Socket.IO for real-time updates
- Winston for logging
- XML parsing with xml2js

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- Lucide React icons
- Axios + Socket.IO client

**Infrastructure:**
- Docker + Docker Compose
- MongoDB 7
- Redis 7

## Quick Start

### Using Docker (Recommended)

```bash
# Clone the repository
git clone <your-repo-url>
cd jobflow-hub

# Start all services
docker compose up -d

# View logs
docker compose logs -f
```

**Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001/api
- Health Check: http://localhost:5001/health

### Manual Setup

**Prerequisites:**
- Node.js 18+
- MongoDB running on localhost:27017
- Redis running on localhost:6379

**Backend Setup:**
```bash
cd server
npm install
npm run dev
```

**Worker Setup (in another terminal):**
```bash
cd server
npm run worker
```

**Frontend Setup (in another terminal):**
```bash
cd client
npm install
npm run dev
```

## Configuration

### Server Environment Variables

Create `server/.env`:

```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/job-importer
REDIS_HOST=localhost
REDIS_PORT=6379
QUEUE_CONCURRENCY=5
BATCH_SIZE=100
CRON_SCHEDULE=0 * * * *
CLIENT_URL=http://localhost:3000
```

### Client Environment Variables

Create `client/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5001/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5001
```

## API Endpoints

### Import Operations
- `POST /api/imports/trigger` - Trigger single feed import
- `POST /api/imports/trigger-bulk` - Trigger all active feeds
- `GET /api/imports/history` - Get import history (paginated)
- `GET /api/imports/:id` - Get specific import details
- `GET /api/imports/stats` - Get aggregate statistics

### Job Feeds
- `GET /api/feeds` - Get all job feeds
- `POST /api/feeds` - Create new feed (admin)
- `PUT /api/feeds/:id` - Update feed (admin)
- `DELETE /api/feeds/:id` - Delete feed (admin)

## Architecture

```
┌─────────────┐
│   Next.js   │
│  Dashboard  │
└──────┬──────┘
       │
       ├─── HTTP/REST ────┐
       │                  │
       └─── Socket.IO ────┤
                          │
                   ┌──────▼──────┐
                   │   Express   │
                   │   Server    │
                   └──────┬──────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
         ┌────▼────┐ ┌───▼────┐ ┌───▼────┐
         │ MongoDB │ │ Redis  │ │  Bull  │
         │         │ │ Cache  │ │ Queue  │
         └─────────┘ └────────┘ └───┬────┘
                                     │
                               ┌─────▼─────┐
                               │  Workers  │
                               │ (5 conc.) │
                               └───────────┘
```

## Job Feed Sources

1. **Jobicy - All Jobs** - General remote job listings
2. **Jobicy - SMM** - Social Media Marketing positions
3. **Jobicy - Seller (France)** - Sales roles in France
4. **Jobicy - Design & Multimedia** - Creative positions
5. **Jobicy - Data Science** - Data and analytics roles
6. **Jobicy - Copywriting** - Content and writing jobs
7. **Jobicy - Business** - Business and strategy roles
8. **Jobicy - Management** - Leadership positions

## Key Features Explained

### Auto-Initialization
On first run or when the database is empty, the system automatically initializes all job feeds. No manual setup required.

### Queue Processing
- Concurrent processing of up to 5 jobs
- Exponential backoff retry logic (3 attempts)
- Batch processing for efficient database operations
- Comprehensive error tracking and logging

### Real-time Updates
- Socket.IO broadcasts import progress
- Dashboard updates automatically on completion
- Failed imports trigger error notifications

### Import History
- Tracks every import with timestamp
- Records: total fetched, imported, new, updated, and failed jobs
- Pagination support for large datasets
- Detailed error messages for debugging

## Docker Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f [service-name]

# Rebuild and restart
docker compose up -d --build

# Clean slate (removes volumes)
docker compose down -v
```

## Monitoring

### Logs
Logs are stored in `server/logs/`:
- `combined.log` - All logs
- `error.log` - Error logs only

### Queue Dashboard
Access Bull Board at: http://localhost:5001/admin/queues (when implemented)

## Performance

- **Handles 1M+ records** efficiently with indexed MongoDB queries
- **Batch processing** reduces database load
- **Worker-based architecture** allows horizontal scaling
- **Connection pooling** for optimal database performance
- **Strategic indexing** on frequently queried fields

## Development

### Project Structure
```
jobflow-hub/
├── client/                 # Next.js frontend
│   ├── src/
│   │   ├── app/           # App router pages
│   │   ├── components/    # React components
│   │   ├── lib/           # Utilities & API client
│   │   └── types/         # TypeScript types
│   └── public/            # Static assets
├── server/                # Express backend
│   ├── src/
│   │   ├── controllers/   # Route handlers
│   │   ├── models/        # Mongoose schemas
│   │   ├── queues/        # Bull queue setup
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   ├── utils/         # Helper functions
│   │   └── workers/       # Queue workers
│   └── logs/              # Application logs
└── docker-compose.yml     # Docker orchestration
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Built with ❤️ using the MERN stack, Redis, and modern web technologies.**
