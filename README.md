# Insurance AI Consultation Platform

A real-time video consultation platform with AI-powered transcription and agent assistance for insurance consultations.

## 🎯 Features

- **Public Website**: Insurance company landing page with meeting scheduling
- **Microsoft Booking Integration**: Seamless appointment scheduling
- **Custom WebRTC Video**: High-quality, low-latency video conferencing
- **Real-time Transcription**: Using OpenAI Whisper API
- **AI Agent Assistance**: GPT-4 provides real-time suggestions to agents
- **Admin Dashboard**: Monitor conversations with live transcription and AI insights
- **Ultra-low Latency**: Optimized for real-time agent assistance

## 🏗️ Architecture

### Frontend (React + Vite)
- Public-facing insurance website
- Client meeting interface
- Admin dashboard with real-time features
- Deployed on Vercel

### Backend (Node.js + Express)
- WebSocket server for real-time communication
- WebRTC signaling server
- Audio processing and transcription
- OpenAI integration
- Deployed on Railway

## 📋 Prerequisites

- Node.js 18+ and npm
- OpenAI API key
- Railway account (for backend)
- Vercel account (for frontend)
- Microsoft 365 account (for Booking)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd insurance-ai-consultant
```

### 2. Backend Setup

```bash
cd backend
npm install

# Create .env file
cp .env.example .env

# Add your OpenAI API key to .env
# OPENAI_API_KEY=sk-...
```

### 3. Frontend Setup

```bash
cd frontend
npm install

# Create .env file
cp .env.example .env

# Update with your backend URLs (see deployment section)
```

### 4. Run Locally

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Visit `http://localhost:3000`

## 🌐 Deployment

### Deploy Backend to Railway

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login and initialize:
```bash
cd backend
railway login
railway init
```

3. Set environment variables:
```bash
railway variables set OPENAI_API_KEY=sk-your-key-here
```

4. Deploy:
```bash
railway up
```

5. Get your URLs:
```bash
railway domain
```

You'll get URLs like:
- `https://your-app.railway.app` (HTTP)
- `wss://your-app.railway.app` (WebSocket)

### Deploy Frontend to Vercel

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
cd frontend
vercel
```

3. Set environment variables in Vercel dashboard:
- `VITE_API_URL`: Your Railway HTTP URL
- `VITE_WS_URL`: Your Railway WebSocket URL (wss://)

4. Redeploy after setting env vars:
```bash
vercel --prod
```

### Configure Microsoft Booking

1. Go to Microsoft Bookings in Microsoft 365
2. Create a booking page for insurance consultations
3. Get the booking page URL
4. Update `MICROSOFT_BOOKING_URL` in `frontend/src/pages/SchedulePage.jsx`

## 📱 Usage

### For Clients

1. Visit the website
2. Click "Schedule Consultation"
3. Book via Microsoft Booking
4. Receive meeting link via email
5. Join meeting at scheduled time

### For Admins

1. Visit `/admin`
2. Login (default password: `admin123`)
3. View scheduled meetings
4. Click "Join Meeting" when client arrives
5. See real-time transcription and AI suggestions

## 🎨 Customization

### Branding

Update the following in `frontend/src/pages/HomePage.jsx`:
- Company name
- Colors (in Tailwind classes)
- Services offered
- Contact information

### AI Behavior

Modify the system prompt in `backend/src/server.js` in the `generateAIResponse` function:

```javascript
{
  role: 'system',
  content: `Your custom instructions here...`
}
```

### Transcription Settings

Adjust audio processing in `frontend/src/services/meetingService.js`:

```javascript
const SEND_INTERVAL = CHUNKS_PER_SECOND * 2; // Change to 1 for faster, 3 for less frequent
```

## 🔧 Configuration Options

### Audio Quality vs Latency

**For Lower Latency (faster AI responses):**
- Reduce `SEND_INTERVAL` in meetingService.js
- Use smaller audio chunks
- Trade-off: More API calls, higher cost

**For Better Transcription:**
- Increase `SEND_INTERVAL`
- Larger audio chunks
- Trade-off: Slower AI responses

### OpenAI Models

**For Speed:**
```javascript
model: 'gpt-3.5-turbo'  // Faster, cheaper
```

**For Quality:**
```javascript
model: 'gpt-4-turbo-preview'  // Better suggestions, slower
```

## 🔐 Security Notes

**IMPORTANT FOR PRODUCTION:**

1. **Change Admin Password**: Update `ADMIN_PASSWORD` in `AdminPage.jsx`
2. **Implement Real Auth**: Use JWT, OAuth, or Auth0
3. **Secure WebSocket**: Add authentication to WebSocket connections
4. **HTTPS Only**: Ensure all connections use HTTPS/WSS
5. **Rate Limiting**: Add rate limits to API endpoints
6. **Input Validation**: Validate all user inputs
7. **CORS**: Configure CORS properly for production domains

## 📊 Performance Optimization

### Reduce Latency

1. **Use Edge Functions**: Deploy to regions close to users
2. **Optimize Audio**: Use lower sample rates (8kHz for voice)
3. **Batch Wisely**: Balance between latency and API efficiency
4. **CDN**: Use Vercel's Edge Network
5. **WebSocket Pooling**: Reuse connections

### Cost Optimization

1. **Cache Responses**: Cache common AI responses
2. **Smart Chunking**: Only send audio when speaking
3. **Model Selection**: Use GPT-3.5 for simple suggestions
4. **Compression**: Compress audio before sending

## 🐛 Troubleshooting

### WebSocket Connection Fails

- Check Railway deployment status
- Verify WSS URL in frontend .env
- Check browser console for CORS errors

### No Audio Transcription

- Verify OpenAI API key is set
- Check browser microphone permissions
- Ensure audio chunks are being sent (check network tab)

### Video Not Working

- Check WebRTC STUN/TURN server configuration
- Verify browser permissions for camera/microphone
- Check firewall/network restrictions

### AI Suggestions Not Appearing

- Verify transcription is working first
- Check OpenAI API quota and limits
- Review backend logs for errors

## 📈 Future Enhancements

- [ ] Add RAG (Retrieval Augmented Generation) for company-specific knowledge
- [ ] Implement call recording and analysis
- [ ] Add sentiment analysis during calls
- [ ] Create post-call summary reports
- [ ] Multi-language support
- [ ] Screen sharing capability
- [ ] Integration with CRM systems
- [ ] Advanced analytics dashboard

## 🤝 Contributing

This is a private project. For questions or issues, contact the development team.

## 📄 License

Proprietary - All rights reserved

## 🆘 Support

For technical support:
- Check the troubleshooting section
- Review Railway and Vercel logs
- Contact: your-email@company.com

---

**Built with ❤️ using React, Node.js, WebRTC, and OpenAI**
