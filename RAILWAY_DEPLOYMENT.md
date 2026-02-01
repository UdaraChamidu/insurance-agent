# Railway Deployment Guide

## Prerequisites
- Railway account (https://railway.app)
- GitHub repository (optional but recommended)

## Method 1: Deploy from GitHub (Recommended)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo>
git push -u origin main
```

### 2. Connect Railway to GitHub

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access your repository
5. Select your repository
6. Railway will auto-detect the Node.js project

### 3. Configure Build Settings

Railway should auto-detect, but verify:
- **Root Directory**: `/backend`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### 4. Set Environment Variables

In Railway dashboard:
1. Go to your project
2. Click "Variables" tab
3. Add:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `NODE_ENV`: production

### 5. Deploy

Railway will automatically deploy. Monitor the logs for any issues.

### 6. Get Your URLs

After deployment:
1. Click "Settings" tab
2. Under "Domains", click "Generate Domain"
3. You'll get: `https://your-app.up.railway.app`
4. WebSocket URL is the same but with `wss://` protocol

## Method 2: Deploy via CLI

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
```

### 2. Login
```bash
railway login
```

### 3. Initialize Project
```bash
cd backend
railway init
```

### 4. Link to Project
```bash
railway link
```

### 5. Set Environment Variables
```bash
railway variables set OPENAI_API_KEY=sk-your-key-here
railway variables set NODE_ENV=production
```

### 6. Deploy
```bash
railway up
```

### 7. Monitor Logs
```bash
railway logs
```

## Configuration

### Custom Domain (Optional)

1. In Railway dashboard, go to Settings
2. Click "Add Custom Domain"
3. Enter your domain
4. Update DNS records as instructed

### Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | Your OpenAI API key | Yes |
| `NODE_ENV` | Set to "production" | Yes |
| `PORT` | Port number (auto-set by Railway) | No |

## Monitoring

### View Logs
```bash
railway logs
```

Or in the Railway dashboard under "Deployments" > "Logs"

### Check Health
Visit: `https://your-app.railway.app/health`

Should return: `{"status":"ok"}`

## Troubleshooting

### Deployment Fails

**Check build logs:**
1. Railway dashboard > Deployments
2. Click on failed deployment
3. Review build logs

**Common issues:**
- Missing dependencies in package.json
- Incorrect start command
- Environment variables not set

### WebSocket Not Working

**Verify:**
1. Railway automatically supports WebSocket
2. No additional configuration needed
3. Use `wss://` protocol (not `ws://`)

**Test WebSocket:**
```javascript
const ws = new WebSocket('wss://your-app.railway.app');
ws.onopen = () => console.log('Connected!');
```

### Port Issues

Railway automatically assigns PORT environment variable. Your code uses:
```javascript
const PORT = process.env.PORT || 3001;
```

This is correct - don't hardcode the port.

## Updating Deployment

### Via GitHub
```bash
git add .
git commit -m "Update"
git push
```
Railway automatically redeploys on push to main branch.

### Via CLI
```bash
railway up
```

## Rollback

If deployment fails:

1. Railway dashboard > Deployments
2. Find a working deployment
3. Click "..." > "Redeploy"

## Cost Estimation

Railway pricing (as of 2024):
- **Hobby Plan**: $5/month
  - 500 hours of usage
  - Shared CPU
  - 512MB RAM
  - 1GB Disk

- **Pro Plan**: $20/month
  - Unlimited hours
  - Dedicated CPU
  - 8GB RAM
  - 100GB Disk

**Estimate for this project:**
- Hobby plan is sufficient for testing
- Pro plan recommended for production

## Scaling

Railway auto-scales within plan limits. For high traffic:

1. Upgrade to Pro plan
2. Use horizontal scaling (multiple instances)
3. Configure in Railway dashboard > Settings > Scaling

## Backup Strategy

1. **Code**: Keep in GitHub
2. **Logs**: Download from Railway dashboard
3. **Data**: If storing data, use external database

## Security Checklist

- ✅ Environment variables set (not in code)
- ✅ HTTPS enabled (automatic on Railway)
- ✅ CORS configured for production domain
- ✅ OpenAI API key protected
- ✅ No sensitive data in logs

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Railway Status: https://status.railway.app
