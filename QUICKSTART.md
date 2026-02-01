# Quick Start Guide

Get your Insurance AI Consultation Platform up and running in 15 minutes!

## ⚡ Prerequisites

Before you start, make sure you have:

- ✅ Node.js 18+ installed
- ✅ OpenAI API key ([Get one here](https://platform.openai.com/api-keys))
- ✅ Text editor (VS Code recommended)
- ✅ Terminal/Command Prompt

## 🚀 5-Minute Local Setup

### Step 1: Get the Code

Download or clone this repository to your computer.

### Step 2: Setup Backend

```bash
# Navigate to backend folder
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-your-key-here
```

**Windows users**: Use `copy` instead of `cp`
```bash
copy .env.example .env
```

### Step 3: Setup Frontend

```bash
# Open a new terminal
# Navigate to frontend folder
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# The default values are fine for local development
```

### Step 4: Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

You should see: `Server running on port 3001`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

You should see: `Local: http://localhost:3000`

### Step 5: Test It!

1. Open browser to `http://localhost:3000`
2. You should see the insurance company homepage
3. Click "Schedule Consultation"
4. Open `http://localhost:3000/admin` in another tab
5. Login with password: `admin123`
6. Click "Create Meeting Link"
7. Copy the generated link
8. Open in a new browser tab
9. Start a test meeting!

## 🎉 You're Done!

The app is now running locally. Here's what you can do:

### Test the Public Site
- Visit `http://localhost:3000`
- Explore the insurance landing page
- Click through the navigation

### Test Admin Features
- Visit `http://localhost:3000/admin`
- Login (password: `admin123`)
- Create a meeting link
- View the admin dashboard

### Test Video Meeting
1. Create a meeting link from admin panel
2. Join as client in one browser/tab
3. Join as admin in another browser/tab
4. Start speaking - watch transcription appear!
5. See AI suggestions in admin view

## 🐛 Troubleshooting

### "Cannot find module" errors
```bash
# Delete node_modules and reinstall
rm -rf node_modules
npm install
```

### Port 3000 or 3001 already in use
```bash
# Kill the process using the port (Mac/Linux)
lsof -ti:3000 | xargs kill
lsof -ti:3001 | xargs kill

# Or change the port in the code
# Backend: Change PORT in .env
# Frontend: Change port in vite.config.js
```

### OpenAI API errors
- Check your API key is correct
- Verify you have credits in your OpenAI account
- Make sure the .env file is in the backend folder

### Camera/Microphone not working
- Check browser permissions
- Make sure you're using HTTPS (or localhost)
- Try a different browser (Chrome recommended)

### WebSocket connection fails
- Make sure backend is running on port 3001
- Check browser console for errors
- Verify .env settings in frontend

## 📚 Next Steps

Now that it's running locally, you can:

1. **Customize the branding**
   - Edit `frontend/src/pages/HomePage.jsx`
   - Change company name, colors, text

2. **Configure Microsoft Booking**
   - Get your Booking page URL
   - Update in `frontend/src/pages/SchedulePage.jsx`

3. **Adjust AI behavior**
   - Edit system prompts in `backend/src/server.js`
   - Change AI model or parameters

4. **Deploy to production**
   - Follow `RAILWAY_DEPLOYMENT.md` for backend
   - Follow `VERCEL_DEPLOYMENT.md` for frontend

## 💡 Pro Tips

### Development Workflow

1. **Keep both terminals running** while developing
2. **Changes auto-reload** - just save and refresh browser
3. **Check browser console** for frontend errors
4. **Check terminal** for backend errors

### Testing Features

**To test transcription:**
- Join meeting as client
- Speak clearly into microphone
- Watch admin dashboard for transcription
- Check for AI suggestions

**To test video:**
- Use two browser windows side-by-side
- Or use different browsers (Chrome + Firefox)
- Or use incognito/private mode

### Common Development Tasks

**Clear meeting history:**
```bash
# Just restart the backend server
# Press Ctrl+C in backend terminal
# Run npm run dev again
```

**Reset admin password:**
```javascript
// Edit frontend/src/pages/AdminPage.jsx
const ADMIN_PASSWORD = 'your-new-password';
```

**Change transcription speed:**
```javascript
// Edit frontend/src/services/meetingService.js
const SEND_INTERVAL = CHUNKS_PER_SECOND * 1; // 1 second (faster)
const SEND_INTERVAL = CHUNKS_PER_SECOND * 3; // 3 seconds (slower)
```

## 🔗 Important URLs (Local Development)

- **Public Site**: http://localhost:3000
- **Schedule Page**: http://localhost:3000/schedule
- **Admin Login**: http://localhost:3000/admin
- **Admin Dashboard**: http://localhost:3000/admin/dashboard?meetingId=xxx
- **Meeting Room**: http://localhost:3000/meeting?meetingId=xxx
- **Backend API**: http://localhost:3001
- **Backend Health**: http://localhost:3001/health

## 📖 Additional Documentation

- **README.md** - Full project documentation
- **ARCHITECTURE.md** - Technical details
- **LATENCY_OPTIMIZATION.md** - Performance tuning
- **RAILWAY_DEPLOYMENT.md** - Deploy backend
- **VERCEL_DEPLOYMENT.md** - Deploy frontend

## 🆘 Still Having Issues?

1. **Check all terminals are running**
2. **Verify Node.js version** - run `node --version` (should be 18+)
3. **Clear browser cache** - Hard reload with Ctrl+Shift+R (Cmd+Shift+R on Mac)
4. **Restart everything** - Stop all terminals and start fresh
5. **Check the logs** - Both terminal and browser console

## ✅ Ready to Deploy?

Once everything works locally:

1. Push code to GitHub
2. Deploy backend to Railway
3. Deploy frontend to Vercel
4. Update environment variables
5. Test in production

See deployment guides for detailed instructions!

---

**Happy Building! 🚀**

If you run into any issues, check the troubleshooting section or review the full documentation.
