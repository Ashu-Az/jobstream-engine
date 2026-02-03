# Railway Deployment Guide

## Step-by-Step Deployment Instructions

### 1. Create Railway Account & Install CLI

**Option A: Deploy via Website (Easiest)**
- Go to [railway.app](https://railway.app)
- Sign up with GitHub

**Option B: Deploy via CLI**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login
```

---

## Deploy Using Railway Dashboard (Recommended)

### Step 1: Create New Project

1. Go to [railway.app/new](https://railway.app/new)
2. Click "Deploy from GitHub repo"
3. Select your repository: `jobflow-hub`
4. Railway will detect your project

### Step 2: Add Database Services

**Add MongoDB:**
1. Click "New" → "Database" → "Add MongoDB"
2. Railway will create MongoDB instance
3. Note: Connection string will be automatically available as `MONGODB_URI`

**Add Redis:**
1. Click "New" → "Database" → "Add Redis"
2. Railway will create Redis instance
3. Note: Connection details will be automatically available

### Step 3: Configure Server Service

1. Click on your GitHub service
2. Go to "Settings" tab
3. Set the following:

**Root Directory:** `server`

**Environment Variables:**
```env
PORT=5001
NODE_ENV=production
MONGODB_URI=${{MongoDB.MONGODB_URI}}
REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}
QUEUE_CONCURRENCY=5
BATCH_SIZE=100
MAX_RETRY_ATTEMPTS=3
CRON_SCHEDULE=0 * * * *
REQUEST_TIMEOUT=30000
MAX_REQUESTS_PER_MINUTE=60
CLIENT_URL=https://your-frontend-url.vercel.app
```

**Note:** Railway automatically injects MongoDB and Redis URLs. Just reference them like above.

**Build Command:** (Auto-detected, but verify)
```bash
npm install
```

**Start Command:** (Auto-detected, but verify)
```bash
npm start
```

### Step 4: Add Worker Service

1. In your project, click "New" → "GitHub Repo" → Select same repo
2. This creates a second service from the same repo
3. Go to Settings:

**Root Directory:** `server`

**Start Command:**
```bash
npm run worker
```

**Environment Variables:**
Copy all the same environment variables from the server service (Railway makes this easy with variable groups)

### Step 5: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repo
3. Configure:

**Framework Preset:** Next.js
**Root Directory:** `client`
**Build Command:** `npm run build`
**Install Command:** `npm install`

**Environment Variables:**
```env
NEXT_PUBLIC_API_URL=https://your-railway-app.up.railway.app/api
NEXT_PUBLIC_SOCKET_URL=https://your-railway-app.up.railway.app
```

4. Deploy!

---

## Deploy Using Railway CLI (Alternative)

```bash
# Navigate to project
cd /Users/superashu/Desktop/project

# Login to Railway
railway login

# Initialize project
railway init

# Link to existing project or create new
railway link

# Add MongoDB
railway add --database mongodb

# Add Redis
railway add --database redis

# Set environment variables
railway variables set PORT=5001
railway variables set NODE_ENV=production
railway variables set QUEUE_CONCURRENCY=5
railway variables set BATCH_SIZE=100
railway variables set CRON_SCHEDULE="0 * * * *"

# Deploy server
cd server
railway up

# Deploy worker (in separate service)
railway service create worker
railway service worker
railway up
```

---

## Environment Variables Reference

### Server Service Variables

| Variable | Value | Source |
|----------|-------|--------|
| PORT | 5001 | Manual |
| NODE_ENV | production | Manual |
| MONGODB_URI | Auto-injected | Railway MongoDB |
| REDIS_HOST | Auto-injected | Railway Redis |
| REDIS_PORT | Auto-injected | Railway Redis |
| QUEUE_CONCURRENCY | 5 | Manual |
| BATCH_SIZE | 100 | Manual |
| MAX_RETRY_ATTEMPTS | 3 | Manual |
| CRON_SCHEDULE | 0 * * * * | Manual |
| REQUEST_TIMEOUT | 30000 | Manual |
| MAX_REQUESTS_PER_MINUTE | 60 | Manual |
| CLIENT_URL | Your Vercel URL | Manual |

### Worker Service Variables

Same as server (Railway allows variable sharing between services)

### Frontend (Vercel) Variables

| Variable | Value |
|----------|-------|
| NEXT_PUBLIC_API_URL | https://your-app.up.railway.app/api |
| NEXT_PUBLIC_SOCKET_URL | https://your-app.up.railway.app |

---

## Verify Deployment

### Check Server Logs
```bash
railway logs --service server
```

### Check Worker Logs
```bash
railway logs --service worker
```

### Test API
```bash
curl https://your-app.up.railway.app/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2024-02-03T12:00:00.000Z",
  "uptime": 123.456
}
```

### Test Trigger Import
```bash
curl -X POST https://your-app.up.railway.app/api/imports/trigger-bulk
```

---

## Common Issues & Solutions

### Issue 1: MongoDB Connection Failed
**Solution:** Make sure MongoDB service is linked and `MONGODB_URI` variable is set:
```bash
railway variables
```

### Issue 2: Redis Connection Failed
**Solution:** Verify Redis service is running:
```bash
railway status
```

### Issue 3: Worker Not Processing Jobs
**Solution:** Check worker logs and ensure both services share the same Redis instance:
```bash
railway logs --service worker
```

### Issue 4: CORS Errors
**Solution:** Update `CLIENT_URL` environment variable with your Vercel domain:
```bash
railway variables set CLIENT_URL=https://your-app.vercel.app
```

---

## Scaling

### Increase Worker Concurrency
```bash
railway variables set QUEUE_CONCURRENCY=10
```

### Add More Worker Instances
1. Duplicate worker service in Railway dashboard
2. Railway will run multiple worker containers
3. They'll automatically share the same Redis queue

### Monitor Resources
- Go to Railway dashboard
- Check "Metrics" tab for CPU/Memory usage
- Upgrade plan if needed

---

## Cost Estimate

**Railway Free Tier:**
- $5 free credit per month
- Enough for:
  - 1 Server instance
  - 1 Worker instance
  - MongoDB (shared)
  - Redis (shared)

**Estimated Usage:**
- Server: ~$3/month
- Worker: ~$2/month
- MongoDB: Free (shared tier)
- Redis: Free (shared tier)

**Total: ~$5/month (covered by free tier)**

**Vercel:**
- Frontend: Free (hobby tier)

---

## Auto-Deploy on Git Push

Railway automatically redeploys when you push to your GitHub repo:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

Railway will:
1. Detect changes
2. Rebuild services
3. Deploy automatically
4. Zero downtime (rolling deployment)

---

## Getting Your Railway URL

After deployment:

1. Go to Railway dashboard
2. Click on your server service
3. Go to "Settings" → "Domains"
4. You'll see: `your-app-name.up.railway.app`
5. Copy this URL
6. Use it in Vercel environment variables

---

## Support

- Railway Docs: https://docs.railway.app
- Discord: https://discord.gg/railway
- Status: https://status.railway.app

---

## Quick Commands Reference

```bash
# Login
railway login

# View services
railway status

# View logs (server)
railway logs --service server

# View logs (worker)
railway logs --service worker

# View environment variables
railway variables

# Set environment variable
railway variables set KEY=VALUE

# Open dashboard
railway open

# Deploy
railway up
```

---

You're all set! 🚀
