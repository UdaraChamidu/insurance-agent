# Vercel Deployment Guide

## Prerequisites
- Vercel account (https://vercel.com)
- GitHub repository (recommended)
- Railway backend deployed (see RAILWAY_DEPLOYMENT.md)

## Method 1: Deploy from GitHub (Recommended)

### 1. Push to GitHub

If not already done:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo>
git push -u origin main
```

### 2. Import to Vercel

1. Go to https://vercel.com
2. Click "Add New..." > "Project"
3. Import your GitHub repository
4. Vercel will auto-detect Vite/React

### 3. Configure Build Settings

Vercel should auto-detect, but verify:
- **Framework Preset**: Vite
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 4. Set Environment Variables

**CRITICAL**: Set these before deploying:

In Vercel dashboard > Settings > Environment Variables:

| Variable | Value | Example |
|----------|-------|---------|
| `VITE_API_URL` | Your Railway HTTP URL | `https://your-app.railway.app` |
| `VITE_WS_URL` | Your Railway WebSocket URL | `wss://your-app.railway.app` |

**Important**: 
- Use `https://` for API URL
- Use `wss://` for WebSocket URL (not `ws://`)
- No trailing slashes

### 5. Deploy

Click "Deploy" and wait for build to complete.

### 6. Test Deployment

1. Visit your Vercel URL (e.g., `https://your-app.vercel.app`)
2. Test the public site
3. Try scheduling a meeting
4. Test joining a meeting

## Method 2: Deploy via CLI

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Login
```bash
vercel login
```

### 3. Deploy
```bash
cd frontend
vercel
```

Follow the prompts:
- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N**
- Project name? **insurance-ai-frontend**
- Directory? **./frontend** or just **.** if already in frontend folder
- Override settings? **N**

### 4. Set Environment Variables
```bash
vercel env add VITE_API_URL
# Enter: https://your-app.railway.app

vercel env add VITE_WS_URL
# Enter: wss://your-app.railway.app
```

### 5. Deploy to Production
```bash
vercel --prod
```

## Configuration

### Custom Domain

1. Vercel dashboard > Settings > Domains
2. Add your domain
3. Update DNS records:
   - Type: CNAME
   - Name: www (or @)
   - Value: cname.vercel-dns.com

### Microsoft Booking Integration

Update the booking URL in the code:

**File**: `frontend/src/pages/SchedulePage.jsx`

```javascript
const MICROSOFT_BOOKING_URL = "https://outlook.office365.com/book/YourBookingPage";
```

Then redeploy:
```bash
vercel --prod
```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL (Railway) | `https://app.railway.app` |
| `VITE_WS_URL` | WebSocket URL (Railway) | `wss://app.railway.app` |

## Updating Deployment

### Via GitHub (Auto-deploy)
```bash
git add .
git commit -m "Update"
git push
```
Vercel automatically redeploys on push to main branch.

### Via CLI
```bash
vercel --prod
```

## Vercel Configuration File (Optional)

Create `vercel.json` in frontend directory for advanced config:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ]
}
```

## Performance Optimization

### Enable Edge Network
Vercel automatically uses Edge Network. No configuration needed.

### Image Optimization
If you add images, use Vercel's Image component:
```javascript
import Image from 'next/image' // If using Next.js
```

### Caching
Vercel automatically caches static assets.

For API calls, implement caching in your code:
```javascript
const response = await fetch(url, {
  headers: { 'Cache-Control': 'max-age=3600' }
});
```

## Monitoring

### View Logs
1. Vercel dashboard > Deployments
2. Click on deployment
3. View "Function Logs" tab

### Analytics
Enable Vercel Analytics:
1. Vercel dashboard > Analytics
2. Click "Enable"
3. Add to your app (free)

## Troubleshooting

### Build Fails

**Check build logs:**
1. Vercel dashboard > Deployments
2. Click failed deployment
3. Review build logs

**Common issues:**
- Environment variables not set
- Missing dependencies
- Build command incorrect
- TypeScript errors

### Environment Variables Not Working

**Remember:**
- Must start with `VITE_` prefix for Vite
- Must redeploy after adding/changing env vars
- Check capitalization (case-sensitive)

**Test in build logs:**
```javascript
console.log('API URL:', import.meta.env.VITE_API_URL);
```

### CORS Errors

Update backend CORS configuration in `backend/src/server.js`:

```javascript
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://your-app.vercel.app',
    'https://your-custom-domain.com'
  ],
  credentials: true
}));
```

Then redeploy backend to Railway.

### WebSocket Connection Fails

**Checklist:**
1. ✅ Using `wss://` (not `ws://`)
2. ✅ Railway backend supports WebSocket
3. ✅ CORS configured correctly
4. ✅ No browser console errors

**Test WebSocket:**
Open browser console on Vercel site:
```javascript
const ws = new WebSocket('wss://your-app.railway.app');
ws.onopen = () => console.log('WebSocket connected!');
ws.onerror = (err) => console.error('WebSocket error:', err);
```

## Security Best Practices

- ✅ Environment variables (not hardcoded)
- ✅ HTTPS only (automatic on Vercel)
- ✅ Security headers (add to vercel.json)
- ✅ CORS properly configured
- ✅ No API keys in client code

## Cost

Vercel pricing:
- **Hobby**: Free
  - 100GB bandwidth/month
  - Unlimited deployments
  - Perfect for this project in testing

- **Pro**: $20/month
  - 1TB bandwidth
  - Advanced analytics
  - Required for commercial use

## Rollback

If deployment breaks:

1. Vercel dashboard > Deployments
2. Find working deployment
3. Click "..." > "Promote to Production"

Or via CLI:
```bash
vercel rollback
```

## Preview Deployments

Every git branch gets a preview URL:
```bash
git checkout -b feature-branch
git push origin feature-branch
```

Vercel creates: `https://your-app-git-feature-branch.vercel.app`

## Production Checklist

Before going live:

- [ ] Environment variables set
- [ ] Custom domain configured
- [ ] Microsoft Booking URL updated
- [ ] Admin password changed
- [ ] Company branding updated
- [ ] CORS configured for production
- [ ] Test all user flows
- [ ] Test on mobile devices
- [ ] Check WebSocket connection
- [ ] Verify AI features work
- [ ] Monitor initial traffic

## Support

- Vercel Docs: https://vercel.com/docs
- Vercel Support: https://vercel.com/support
- Vercel Status: https://vercel-status.com
