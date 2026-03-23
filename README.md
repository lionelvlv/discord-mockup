# RetroChord

A real-time chat application styled after Windows 98, built with React, TypeScript, and Firebase. Supports text channels, direct messages, voice/video calls, custom emojis, per-user themes, and more.

![General](https://i.imgur.com/7DAcL49.png)

---

## Features

### Messaging
- **Text channels** with real-time message delivery via Firestore `onSnapshot`
- **Direct messages** — one-on-one conversations between any two users
- **@mention autocomplete** — type `@` to get a live dropdown of matching users; arrow keys + Enter/Tab to select
- **@mention highlighting** — mentioned names render as clickable blue pills in messages
- **Message editing** — hover any own message, click ✏️, edit inline, Enter to save / Esc to cancel; `(edited)` tag shown
- **Message deletion** — own messages or admin delete
- **Reactions** — emoji picker anchored to each message; custom emoji reactions supported; counts update live
- **File attachments** — images, video, audio, and generic files up to 100MB via Cloudinary
- **GIF picker** — GIPHY integration with category quick-picks, search, result caching, and "Load more"
- **Embed rendering** — YouTube, Vimeo, Spotify, GitHub repos/PRs/gists, Imgur images/albums, direct image URLs, Giphy/Tenor CDN links
- **Typing indicators** — "X is typing…" shown to other users while composing, polling-based via Firestore
- **Message search** — full-text search across all channels and DMs in parallel; results cached 2 minutes; click to scroll to message with a highlight flash

![Embeds](https://i.imgur.com/4S6Xs95.png)

### Voice & Video
- **WebRTC P2P mesh** — peer-to-peer voice/video using Firebase RTDB for signaling
- **Screen sharing** — share your screen while in a call; audio is included in the share stream
- **Mini panel** — call minimizes to a compact rail widget when you navigate away; the WebRTC connection stays live
- **Retro audio processing** — incoming voice runs through a Web Audio chain (highpass 300Hz → lowpass 3400Hz → peaking EQ → waveshaper → gain) for a walkie-talkie/drive-thru aesthetic
- **Speaking indicator** — visual dot pulses when a participant is speaking (volume threshold detection)
- **Participant cards** — show avatar, name, speaking state, and live video/screenshare thumbnails
- **Join/leave sounds** — generated via Web Audio API, no external audio files

![Voice call with screenshare](https://i.imgur.com/DHfu8zs.png)

### Presence
- **Heartbeat-based presence** — every 30 seconds the client writes `{ online: true, lastSeen: timestamp }` to Firebase RTDB
- **Age-based status** — `lastSeen < 90s` = online, `< 5min` = idle, `> 5min` = offline
- **`onDisconnect().remove()`** — server-side cleanup fires when TCP closes (device power-off, kill, crash)
- **`visibilitychange`** — heartbeat pauses when the tab is backgrounded (mobile focus loss); user ages to idle within 90s
- **`beforeunload`** — immediate offline write on tab close
- **MemberList reconciliation** — subscribes to the RTDB `/presence` root; when any user's node is removed (onDisconnect fired), immediately marks them offline in Firestore without waiting for the heartbeat to expire

### Notifications & Unread
- **`GlobalUnreadWatcher`** — a single invisible component that subscribes to the last 50 messages of every channel and DM the user has open. Runs outside any view component so all channels are tracked even when not visible
- **Unread badges** — grey dot for unread messages, red badge with count for @mentions; appear in both the channel list and DM list
- **Mention sound** — two-tone ping via Web Audio API, fires on new `@username` messages only
- **Persist across reloads** — `lastRead:{id}` timestamps stored in `localStorage`; badge counts are correct on next visit
- **Auto-read** — navigating to a channel calls `markRead(id)` instantly (no lag waiting for a Firestore snapshot)
- **IntersectionObserver** — when a mentioned message scrolls 50%+ into the viewport, the badge decrements and the blue left-border indicator fades
- **Notification bell** — top-right bell shows @mentions and DM mentions; clicking navigates directly to the message with a highlight; opening a channel auto-clears its notifications from the bell

### Profiles & Settings
- **Avatar** — choose from preset emoji avatars or upload a custom image (Cloudinary, 4MB limit)
- **Bio** — short free-text bio shown in profile popups
- **Custom emojis** — upload up to 10 personal emojis (256KB each); use them as `:name:` in any message or reaction
- **Clickable usernames** — click any avatar or username in the chat, or any @mention pill, to open a profile popup; includes presence, bio, and a "Send Message" DM button
- **Profile popup** — `position: fixed` so it never clips the viewport; smart desktop positioning (flips direction at edges); centered upper-third on mobile

![Profile settings](https://i.imgur.com/7gYHYbR.png)

### Appearance / Themes
- **Color pickers** — panel background, chat area, accent/selected, text color, titlebar gradient
- **Presets** — Win98 (default), Dark, Rose, Forest, Ocean, Dusk
- **Chat background image** — upload any image (5MB max); renders as `position: fixed` behind all messages via a CSS `::before` pseudo-element so it never scrolls; opacity slider 0–100%
- **Font selector** — 8 presets including Press Start 2P (pixel, loaded from Google Fonts); custom font upload (.ttf/.otf/.woff, 3MB max) injects a `@font-face` rule live
- **Live preview** — all changes apply instantly to the entire UI without saving; themes persist in `localStorage`
- **Admin settings** — server name, custom emoji management, member list

![Theme settings](https://i.imgur.com/J9HZzsi.png)

### Mobile
- **Bottom navigation bar** — Channels / Chat / Members / Call tabs
- **iOS keyboard fix** — `visualViewport` resize listener + `position: fixed` on `body` prevents the keyboard from scrolling the document; the layout shrinks, the composer stays at the bottom
- **Reaction picker** — `position: fixed` full-screen backdrop on mobile; tap outside to close
- **Touch-aware popups** — profile popup listens to `touchstart` as well as `mousedown` for outside-click dismissal
- **Responsive settings page** — color grid, font picker, and background preview adapt to narrow screens

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
| Voice/Video | WebRTC (P2P mesh, no SFU) |
| GIFs | GIPHY API |
| Fonts | Google Fonts (Press Start 2P) |

---

## Project Structure

```
src/
├── app/
│   ├── app/
│   │   ├── AppLayout.tsx          # Root layout — 3-column grid, mobile tabs, voice panel mount
│   │   ├── App.css                # Grid layout, mobile responsive, keyboard fix CSS vars
│   │   ├── channel/
│   │   │   ├── ChannelPage.tsx    # Channel view — message subscription + cache + read tracking
│   │   │   └── channel.css
│   │   ├── dm/
│   │   │   ├── DMPage.tsx         # DM view — same pattern as ChannelPage, keyed by userId
│   │   │   └── dm.css
│   │   ├── settings/
│   │   │   ├── ProfileSettings.tsx  # Full-page settings: avatar, bio, custom emojis, appearance
│   │   │   └── settings.css
│   │   └── voice/
│   │       └── VoiceChannelPage.tsx  # Handles join/re-expand/leave navigation without loops
│   ├── login/ signup/ forgot-password/   # Auth pages
│
├── components/
│   ├── chat/
│   │   ├── GlobalUnreadWatcher.tsx  # Invisible — subscribes to all channels/DMs, drives badges
│   │   ├── MessageList.tsx          # Shared user cache singleton; IntersectionObserver for mentions
│   │   ├── MessageItem.tsx          # Inline edit, reactions, profile popup on avatar/username/mention
│   │   ├── MessageComposer.tsx      # @mention autocomplete, file upload, GIF/emoji pickers
│   │   ├── EmojiPicker.tsx          # 8 standard categories + custom emoji tab, recent tracking
│   │   ├── GifPicker.tsx            # GIPHY search + categories, module-level cache
│   │   ├── CustomEmojiRenderer.tsx  # Splits message text on :tokens:, URLs, @mentions → inline renders
│   │   └── TypingIndicator.tsx
│   ├── layout/
│   │   ├── LeftRail.tsx             # Server name, search, channel/voice/DM lists, user panel
│   │   ├── RightRail.tsx            # Member list + notification bell
│   │   ├── ChannelSearch.tsx        # Debounced full-text search across channels + DMs
│   │   ├── NotificationBell.tsx     # Fixed-position panel, dynamic anchor via getBoundingClientRect
│   │   ├── ServerSettings.tsx       # Admin: rename server, manage emojis/members
│   │   └── UserPanel.tsx            # Bottom-left: avatar, username, settings/logout
│   ├── lists/
│   │   ├── ChannelList.tsx          # Text channels with unread badges
│   │   ├── DMList.tsx               # DMs with unread badges
│   │   ├── MemberList.tsx           # Online/offline groups; RTDB presence reconciliation
│   │   └── VoiceChannelList.tsx     # Voice channels with participant counts
│   ├── ui/
│   │   ├── Avatar.tsx               # Handles emoji, text initials, and photo avatars
│   │   ├── PresenceDot.tsx          # online/idle/offline colored dot
│   │   └── ProfilePopup.tsx         # Shared popup: smart positioning, DM button, touch-aware close
│   └── voice/
│       ├── VoicePanel.tsx           # Main call UI; syncs participants/controls to VoiceContext
│       ├── VoiceMiniPanel.tsx       # Compact rail widget when call is minimized
│       ├── VoiceParticipantCard.tsx # Per-user card: audio processing, video track, speaking detection
│       └── VoiceControls.tsx        # Mute/camera/screenshare/leave buttons
│
├── features/
│   ├── auth/
│   │   ├── useAuth.tsx    # AuthContext: heartbeat presence, RTDB onDisconnect, visibilitychange
│   │   └── api.ts         # login/logout/signup/updateProfile
│   ├── channels/api.ts    # createChannel, updateChannel, deleteChannel, initializeDefaults
│   ├── chat/
│   │   ├── api.ts         # sendMessage, editMessage, deleteMessage, toggleReaction,
│   │   │                  # subscribeToChannelMessages/DMs, searchChannelMessages/DMs,
│   │   │                  # createMentionNotifications, subscribeToNotifications
│   │   ├── dmApi.ts       # getDMId (deterministic composite key), getOrCreateDM, markDMSeen
│   │   └── unreadStore.ts # Singleton: data map, notify(), updateUnread, markRead, markMentionSeen
│   ├── customEmojis/api.ts  # addCustomEmoji (Cloudinary + Firestore), subscribeToCustomEmojis
│   ├── serverSettings/api.ts
│   ├── theme/
│   │   └── themeStore.ts  # applyTheme() writes CSS vars to :root; persists to localStorage
│   └── voice/
│       ├── VoiceContext.tsx  # activeVoice, isExpanded, participants, controls — shared state
│       ├── api.ts            # RTDB presence for voice channels, signaling doc CRUD
│       └── webrtc.ts         # RTCPeerConnection management, offer/answer/ICE, screenshare
│
├── lib/
│   ├── constants.ts      # PRESET_AVATARS, MAX_FILE_SIZE, etc.
│   ├── mediaUpload.ts    # Cloudinary upload, MIME validation, embed detection (YouTube/Spotify/GitHub/…)
│   ├── sounds.ts         # SoundManager: lazy AudioContext, Web Audio tone generation
│   ├── storage.ts        # localStorage wrapper with JSON parse/stringify
│   └── time.ts           # formatTime (smart relative), formatDate, formatDateTime
│
├── styles/
│   ├── globals.css       # html/body/root reset, .msg-mention, .message-highlight-flash
│   ├── theme.css         # CSS custom properties, chat background ::before, Win98 base colors
│   └── retro-effects.css # panel-outset/inset, button-95, list-item-95, Win98 UI classes
│
└── types/
    ├── channel.ts   # Channel interface
    ├── message.ts   # Message, Reaction, Attachment interfaces
    ├── user.ts      # User, PresenceStatus interfaces
    └── voice.ts     # VoiceState, VoiceParticipant interfaces
```

---

## Firebase Collections

| Collection | Key fields | Notes |
|---|---|---|
| `users` | `username`, `avatarUrl`, `bio`, `presence`, `isAdmin`, `isDeleted` | |
| `messages` | `channelId` or `dmId`, `senderId`, `content`, `timestamp`, `deleted`, `reactions[]`, `attachments[]`, `editedAt?` | |
| `channels` | `name`, `description`, `isVoiceChannel`, `isPermanent`, `createdBy` | |
| `directMessages` | `userA`, `userB`, `closedBy[]`, `lastSeenBy{}` | ID is deterministic: `sort([a,b]).join('_')` |
| `voiceChannels` | `participants[]` | Mirrors RTDB voice presence |
| `signaling` | `from`, `to`, `channelId`, `type`, `payload`, `timestamp` | Ephemeral; deleted after read |
| `notifications` | `toUserId`, `fromUserId`, `type`, `channelId?`, `dmId?`, `messageId`, `preview`, `read` | |
| `customEmojis` | `name`, `url`, `uploadedBy`, `username`, `createdAt` | |
| `serverSettings` | `name` | Single doc: `serverSettings/main` |

## RTDB Paths

| Path | Value | Notes |
|---|---|---|
| `presence/{userId}` | `{ online: bool, lastSeen: number }` | Heartbeat every 30s; `onDisconnect().remove()` |
| `voicePresence/{channelId}/{userId}` | `true` | Set on join; removed on leave or disconnect |

---

## Setup

### 1. Firebase

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** → Email/Password
3. Enable **Firestore Database** (production mode)
4. Enable **Realtime Database**
5. Deploy rules and indexes:
   ```bash
   firebase use --add   # select your project
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
2. Go to **Settings → Upload → Upload presets** → Add unsigned preset
3. Note the **Cloud name** (short name, not the hash) and **preset name**

### 3. GIPHY (optional, for GIF picker)

1. Create an app at [developers.giphy.com](https://developers.giphy.com)
2. Copy the API key

### 4. Environment Variables

Create `.env` in the project root (or add to Vercel environment variables):

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=https://<project-id>-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_CLOUDINARY_CLOUD_NAME=        # short name (e.g. "myapp", not the c-hash)
VITE_CLOUDINARY_UPLOAD_PRESET=     # unsigned preset name
VITE_GIPHY_API_KEY=                # optional
```

### 5. Run locally

```bash
npm install
npm run dev
```

### 6. Deploy to Vercel

Connect the GitHub repo in the Vercel dashboard. All `VITE_*` environment variables need to be added under **Project → Settings → Environment Variables**.

```bash
# Or deploy from CLI:
vercel --prod
```

The first user to register automatically becomes admin (set `isAdmin: true` manually in Firestore for now, or add a server-side function to promote the first user).

---

## Key Implementation Decisions

### Voice calls — always-mounted VoicePanel
The call panel is **never unmounted** while in a call. Instead of toggling `{isExpanded ? <VoicePanel/> : null}`, it's always in the DOM and CSS class-switches between `--fullscreen` and `--mini` (which hides it with `width: 0; height: 0; overflow: hidden`). This keeps the WebRTC connections alive during navigation. A mini compact widget (`VoiceMiniPanel`) appears in the left rail when minimized.

### Presence — heartbeat + TTL over boolean strings
Simple `online/offline` string presence fails when a device is killed (onDisconnect fires but only after TCP timeout, ~5 minutes). The solution stores `{ online: bool, lastSeen: timestamp }` and computes status client-side from age: `< 90s` = online, `< 5min` = idle, `> 5min` = offline. Even if onDisconnect is delayed, users age out of "online" within 90 seconds. `MemberList` also subscribes to the RTDB `/presence` root directly so any node removal (onDisconnect fired) immediately triggers a Firestore write without waiting for the heartbeat interval.

### Unread tracking — outside the view
`GlobalUnreadWatcher` is a zero-render component that subscribes to the last 50 messages of every channel and DM simultaneously. This is necessary because `MessageList` only mounts for the currently-visible channel — other channels' new messages would never be counted. The watcher uses `orderBy(timestamp DESC) + limit(50)` so it always has the newest messages, and detects new arrivals by comparing `latestTs > prevMaxTs` (not array length, which stays at 50 once a channel fills up).

### Message cache — instant channel switching
`ChannelPage` and `DMPage` each use a module-level `Map<id, Message[]>` cache. On mount, `useState` is initialized from the cache (`() => cache.get(id) ?? []`) so the previous channel's messages display immediately while the Firestore subscription re-fetches in the background. This makes switching between channels feel instant with no loading flash.

### Background image — `position: fixed` pseudo-element
Chat backgrounds use `position: fixed` (not `absolute`) on a `::before` pseudo-element on the `.channel-content` container. Absolute positioning would scroll with the message list. Fixed anchors to the viewport so the image stays stationary while messages scroll over it. All messages sit on `z-index: 1` above `z-index: 0` on the pseudo-element.

### DM IDs — deterministic composite key
DM conversation IDs are `sort([userA, userB]).join('_')` — computed in `dmApi.ts`. This means any two users always resolve to the same DM document without a query, making `getOrCreateDM` a single `getDoc` + conditional `setDoc` instead of a collection scan.

### iOS keyboard
Mobile Safari scrolls `window` when a text input is focused (to bring it above the keyboard), leaving blank space below. The fix: `document.addEventListener('focusin')` on `INPUT`/`TEXTAREA` resets `window.scrollTo(0, 0)` at 100ms and 400ms (bracketing the keyboard animation), while `window.visualViewport` resize events update `--app-height` CSS variable. The app layout uses `height: var(--app-height, 100dvh)` and `body { position: fixed }` on mobile to prevent document scroll entirely.

---

## Firestore Indexes Required

These composite indexes need to exist (deploy via `firebase deploy --only firestore`):

| Collection | Fields |
|---|---|
| `messages` | `channelId ASC, deleted ASC, timestamp ASC` |
| `messages` | `channelId ASC, deleted ASC, timestamp DESC` |
| `messages` | `dmId ASC, deleted ASC, timestamp ASC` |
| `messages` | `dmId ASC, deleted ASC, timestamp DESC` |
| `notifications` | `toUserId ASC, timestamp DESC` |
| `notifications` | `toUserId ASC, read ASC` |

---

## Areas for Improvement

**Scalability**
- Message search is client-side (fetches last 200 messages per channel in parallel). For large servers, replace with Algolia or Typesense full-text search.
- `GlobalUnreadWatcher` subscribes to all channels simultaneously — fine for small servers, but a server with 50+ channels would benefit from subscribing only to channels the user has visited recently.
- Voice calls use P2P mesh (all participants connect to each other). For calls with more than ~4 people, quality degrades. An SFU (Selective Forwarding Unit) like LiveKit or mediasoup would scale better.

**Security**
- Firestore `allow read: if request.auth != null` on notifications is broader than ideal; ideally filtered server-side. Firebase doesn't support row-level security on list queries so this requires a Cloud Function intermediary.
- Custom emoji uploads go directly to Cloudinary unsigned — no server-side validation beyond file size. A signed upload via a Cloud Function would add MIME type enforcement.
- First admin must be set manually in Firestore. Consider a Cloud Function that promotes the first registered user.

**Features**
- Message threads / replies
- Read receipts ("Seen by X")
- Channel-level permissions (e.g. read-only announcement channels)
- Invite links with expiry
- Pushwoosh/FCM push notifications for mobile when the app is closed
- Message pinning
- User blocking

**Polish**
- The retro audio chain on voice calls is deliberately lo-fi. A toggle to disable it would be a small but useful addition.
- Custom emoji uploads store the full base64 image in localStorage as part of the theme (background images). Large images will approach the 5MB localStorage limit; migrating to IndexedDB would fix this.
- `Press Start 2P` is loaded from Google Fonts on demand; it could be self-hosted for GDPR compliance.
