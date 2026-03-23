# RetroChord

A real-time chat application styled after Windows 98, built with React, TypeScript, and Firebase. Supports text channels, direct messages, voice/video calls, custom emojis, per-user themes, and more.

![General](https://i.imgur.com/7DAcL49.png)

---

## Features

### Messaging
- Real-time text channels and direct messages
- @mention autocomplete with arrow-key navigation
- Clickable @mention pills that open the mentioned user's profile
- Inline message editing and deletion
- Emoji reactions with live counts, including custom server emojis
- File attachments — images, video, audio, and generic files
- GIF picker powered by GIPHY with category quick-picks and search
- Rich embeds — YouTube, Vimeo, Spotify, GitHub repos/PRs/gists, Imgur, and direct image links
- Typing indicators visible to other users in real time
- Full-text message search across all channels and DMs

![Embeds](https://i.imgur.com/4S6Xs95.png)

### Voice & Video
- Voice and video calls in dedicated voice channels
- Screen sharing with audio
- Minimizes to a compact widget in the left rail while you navigate — call stays live
- Retro audio processing on incoming voice (drive-thru/walkie-talkie effect)
- Speaking indicators per participant
- Live video thumbnails in participant cards

![Voice call with screenshare](https://i.imgur.com/DHfu8zs.png)

### Presence
- Online / Idle / Offline status shown on every user
- Heartbeat-based — goes offline within 90 seconds of closing the app, losing internet, or the device powering off
- Status updates live across all connected clients without polling

### Notifications & Unread
- Unread message indicators on channels and DMs in the left rail
- Red mention badge with count when someone @mentions you
- Mention sound plays immediately when a new @mention arrives
- Mention indicator fades as you scroll past the mentioned messages
- Notification bell in the top-right corner shows all your @mentions; click to jump directly to the message
- Notifications auto-clear when you open the relevant channel or DM

### Profiles & Settings
- Custom avatar — choose from preset emoji avatars or upload a photo
- Bio shown in profile popups
- Upload up to 10 custom server emojis per user (`:name:` syntax in messages and reactions)
- Click any avatar, username, or @mention in chat to open a profile popup with a direct message button

![Profile settings](https://i.imgur.com/7gYHYbR.png)

### Appearance
- Color themes — change panel backgrounds, chat area, accent color, text color, and titlebar gradient
- Six built-in presets: Win98, Dark, Rose, Forest, Ocean, Dusk
- Custom chat background image with opacity control; stays fixed behind messages while you scroll
- Font selector with 8 presets including a pixel font; upload a custom `.ttf/.otf/.woff` font
- All changes apply live and persist across sessions

![Theme](https://i.imgur.com/J9HZzsi.png)

### Admin
- Rename the server
- Manage all custom emojis across users
- View and delete user accounts

### Mobile
- Bottom navigation bar — Channels, Chat, Members, Call tabs
- Full call support via the Call tab
- Reaction picker opens as a centered overlay so it never clips off-screen
- Keyboard-aware layout — message list shrinks when the keyboard opens, composer stays at the bottom

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18, TypeScript, Vite |
| Routing | React Router v6 |
| Database | Firebase Firestore |
| Realtime | Firebase RTDB (presence + voice signaling) |
| Auth | Firebase Authentication |
| File storage | Cloudinary (unsigned upload preset) |
| Hosting | Vercel |
| Voice/Video | WebRTC (P2P) |
| GIFs | GIPHY API |

---

## Project Structure

```
src/
├── app/
│   ├── app/
│   │   ├── AppLayout.tsx          # Root layout, mobile tabs, voice panel
│   │   ├── channel/               # Text channel view
│   │   ├── dm/                    # Direct message view
│   │   ├── settings/              # Profile & appearance settings page
│   │   └── voice/                 # Voice channel view
│   └── login/ signup/ forgot-password/
│
├── components/
│   ├── chat/                      # Messages, composer, emoji/GIF pickers, unread watcher
│   ├── layout/                    # Left/right rails, search, notification bell, settings modals
│   ├── lists/                     # Channel, DM, member, and voice channel lists
│   ├── ui/                        # Avatar, presence dot, profile popup
│   └── voice/                     # Call panel, mini panel, participant cards, controls
│
├── features/
│   ├── auth/                      # Auth context, presence heartbeat
│   ├── channels/                  # Channel CRUD
│   ├── chat/                      # Messaging API, DM API, unread store
│   ├── customEmojis/              # Custom emoji upload and subscription
│   ├── serverSettings/            # Server name
│   ├── theme/                     # Theme store, CSS variable application
│   └── voice/                     # VoiceContext, WebRTC, RTDB signaling
│
├── lib/
│   ├── mediaUpload.ts             # Cloudinary upload, embed detection
│   ├── sounds.ts                  # Web Audio tone generation
│   ├── storage.ts                 # localStorage wrapper
│   └── time.ts                    # Smart relative timestamps
│
├── styles/                        # Global CSS, Win98 theme variables, retro UI classes
└── types/                         # TypeScript interfaces
```

---

## Setup

### 1. Firebase

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication → Email/Password**
3. Enable **Firestore Database**
4. Enable **Realtime Database**
5. Deploy rules and indexes:
   ```bash
   firebase use --add
   firebase deploy --only firestore --project <your-project-id>
   ```
6. Set RTDB rules in the console → Realtime Database → Rules:
   ```json
   {
     "rules": {
       "presence": {
         "$uid": { ".read": "auth != null", ".write": "$uid === auth.uid" }
       },
       "voicePresence": {
         "$channelId": {
           ".read": "auth != null",
           "$uid": { ".write": "$uid === auth.uid" }
         }
       }
     }
   }
   ```

### 2. Cloudinary

1. Create a free account at [cloudinary.com](https://cloudinary.com)
2. Go to **Settings → Upload → Upload presets** and add an unsigned preset
3. Note your **Cloud name** (short name, not the hash) and **preset name**

### 3. GIPHY (optional)

Create an app at [developers.giphy.com](https://developers.giphy.com) and copy the API key.

### 4. Environment Variables

Create `.env` in the project root:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=https://<project-id>-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
VITE_GIPHY_API_KEY=
```

### 5. Run locally

```bash
npm install
npm run dev
```

### 6. Deploy

Connect the GitHub repo in the Vercel dashboard and add the `VITE_*` environment variables under **Project → Settings → Environment Variables**.

> **First admin:** Set `isAdmin: true` manually on your user document in Firestore after registering.

---

## Notes for Improvement

- **Message search** is client-side (last 200 messages per channel). For larger servers, Algolia or Typesense would scale better.
- **Voice calls** are P2P mesh — quality degrades beyond ~4 participants. An SFU (e.g. LiveKit) would handle larger calls.
- **Push notifications** when the app is closed are not implemented — would require FCM integration.
- **Custom background images** are stored as base64 in `localStorage`. Very large images can approach the 5MB limit; IndexedDB would be more appropriate for this.
- **Invite links** with expiry are not yet implemented.
- **Channel permissions** (e.g. read-only announcement channels) are not yet implemented.
