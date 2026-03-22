# 💾 RetroChord - Vintage Chat Application

A Discord-like chat application with authentic early-2000s Windows 98 aesthetics. Features real-time messaging, channels, direct messages, typing indicators, reactions, and presence system.

![RetroChord](https://img.shields.io/badge/style-retro-teal?style=flat-square)
![React](https://img.shields.io/badge/react-18.2-blue?style=flat-square)
![TypeScript](https://img.shields.io/badge/typescript-5.2-blue?style=flat-square)

## ✨ Features

- **Authentication**: Login/Signup with demo accounts
- **Real-time Chat**: Cross-tab messaging via localStorage events
- **Channels**: #general, #off-topic, #projects
- **Direct Messages**: One-on-one conversations
- **Typing Indicators**: See when others are typing
- **Reactions**: React to messages with emojis (👍 😊 😂 💾)
- **Presence System**: Online/Idle/Offline status
- **Profile Settings**: Customize avatar and bio
- **Retro UI**: Authentic Windows 98 design with beveled panels

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The app will be available at `http://localhost:3000`

### Demo Accounts

To test real-time chat between two users:

1. **Window 1**: Login as `retro@example.com` / `password123`
2. **Window 2** (or incognito): Login as `vapor@example.com` / `password123`
3. Start chatting! Messages appear in real-time.

## 🌐 Deploy to Vercel

### Method 1: Vercel CLI (Recommended)

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

### Method 2: GitHub + Vercel Dashboard

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel auto-detects Vite settings
   - Click "Deploy"

### Method 3: Deploy from Local Directory

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy directly
cd retro-chord
vercel --prod
```

## ⚙️ Configuration

### Build Settings (Auto-detected by Vercel)

- **Framework**: Vite
- **Build Command**: `npm run build` or `vite build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Environment Variables

This app uses localStorage for data persistence, so no backend environment variables are needed. However, if you want to add analytics or other services:

1. Go to Vercel Project Settings
2. Navigate to "Environment Variables"
3. Add your variables
4. Redeploy

## 📁 Project Structure

```
retro-chord/
├── src/
│   ├── app/                    # Page components
│   │   ├── login/             # Login page
│   │   ├── signup/            # Signup page
│   │   ├── forgot-password/   # Password recovery
│   │   └── app/               # Main app layout
│   │       ├── channel/       # Channel view
│   │       ├── dm/            # Direct messages
│   │       └── settings/      # Profile settings
│   ├── components/            # Reusable components
│   │   ├── layout/           # Layout components
│   │   ├── chat/             # Chat components
│   │   ├── lists/            # List components
│   │   └── ui/               # UI primitives
│   ├── features/             # Feature modules
│   │   ├── auth/            # Authentication
│   │   └── chat/            # Chat functionality
│   ├── lib/                 # Utilities
│   ├── styles/              # Global styles
│   └── types/               # TypeScript types
├── public/                   # Static assets
├── index.html               # HTML template
├── package.json             # Dependencies
├── vite.config.ts          # Vite configuration
├── vercel.json             # Vercel configuration
└── tsconfig.json           # TypeScript config
```

## 🎨 Design System

### Colors
- **Teal/Navy Palette**: Classic early-2000s colors
- **Windows 98 Gray**: #c0c0c0
- **Highlight Blue**: #000080

### Typography
- **Pixel Font**: Press Start 2P (headers)
- **System Font**: MS Sans Serif / Tahoma (body)

### Components
- Beveled panels (inset/outset borders)
- Windows 98-style buttons
- Retro scrollbars
- Pixel-perfect UI elements

## 🔧 Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **React Router** - Client-side routing
- **Vite** - Build tool & dev server
- **CSS** - Styling (no framework needed!)
- **localStorage** - Data persistence & real-time sync

## 📝 Important Notes

### Real-Time Functionality
- Uses **localStorage events** for cross-tab communication
- Works perfectly for local development and single-device testing
- For multi-user production use, consider adding:
  - WebSocket backend (Socket.io, Pusher, Ably)
  - Database (Firebase, Supabase, PostgreSQL)
  - Authentication service (Auth0, Clerk, Firebase Auth)

### Current Limitations
- Data stored in browser localStorage (per-device)
- No persistence across devices
- Perfect for demo/prototype purposes
- Ideal for showcasing UI/UX design

### Upgrading to Production
To make this production-ready with real multi-user support:

1. **Backend**: Add Node.js/Express or use Firebase
2. **Database**: PostgreSQL, MongoDB, or Firebase Firestore
3. **WebSockets**: Socket.io for real-time messaging
4. **Auth**: JWT tokens or OAuth providers
5. **Hosting**: Keep frontend on Vercel, backend on Railway/Render/Heroku

## 🐛 Troubleshooting

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### "Cannot find module" errors
Make sure you're in the project directory and have run `npm install`.

### Port already in use
```bash
# Change port in vite.config.ts or use:
npm run dev -- --port 3001
```

### Vercel Deployment Issues
- Ensure `vercel.json` is in root directory
- Check build logs in Vercel dashboard
- Verify Node.js version (18+ recommended)
- Make sure to run `npm install` locally first to generate `package-lock.json`

### Routing Issues (404 on refresh)
- The `vercel.json` file ensures SPA routing works
- All routes redirect to `index.html`
- This is already configured in the project

## 📄 License

MIT License - feel free to use this project for learning, prototypes, or as a foundation for your own retro-styled applications!

## 🎮 Credits

Built with nostalgia for the early days of the internet. Inspired by:
- Discord's interface design
- Windows 98 / 2000 aesthetic
- Early 2000s web design
- Retro computing culture

---

**Happy chatting! 💾✨**
