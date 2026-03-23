import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../features/auth/useAuth';
import { subscribeToChannelMessages, sendMessage, getTypingUsers } from '../../../features/chat/api';
import { Channel } from '../../../types/channel';
import { Message, Attachment } from '../../../types/message';
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import ChannelHeader from '../../../components/layout/ChannelHeader';
import MessageList from '../../../components/chat/MessageList';
import MessageComposer from '../../../components/chat/MessageComposer';
import TypingIndicator from '../../../components/chat/TypingIndicator';
import './channel.css';

// Module-level cache: remembers the last messages for each channel so switching
// back to a previously-viewed channel shows content instantly while Firestore
// re-subscribes in the background.
const messageCache = new Map<string, Message[]>();

const ChannelPage: React.FC = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightMessageId = searchParams.get('highlight') ?? undefined;
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>(() => messageCache.get(channelId ?? '') ?? []);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  // If we have cached messages, skip the loading state — feel instant
  const [loading, setLoading] = useState(() => !messageCache.has(channelId ?? ''));

  // Resolve the channel — first try as a Firestore document ID, then fall back to
  // a name lookup. Once resolved we subscribe to the doc for live edits.
  // We use getDoc (one-time) for the name lookup so we never create a nested
  // onSnapshot that leaks on every collection update.
  useEffect(() => {
    if (!channelId) return;
    setLoading(true);
    setChannel(null);
    setResolvedId(null);
    console.log(`[ChannelPage] Subscribing to channel ${channelId}`);

    let unsubById: (() => void) | null = null;
    let cancelled = false;

    const resolve = async () => {
      // First: try as a document ID (the normal case after clicking a channel)
      const directSnap = await getDoc(doc(db, 'channels', channelId)).catch(() => null);
      if (cancelled) return;
      if (directSnap?.exists()) {
        const data = { id: directSnap.id, ...directSnap.data() } as Channel;
        console.log(`[ChannelPage] Channel resolved by ID: ${data.name}`);
        setResolvedId(data.id);
        setChannel(data);
        setLoading(false);

        // Now subscribe for live name/description edits
        unsubById = onSnapshot(doc(db, 'channels', data.id), (snap) => {
          if (snap.exists()) setChannel({ id: snap.id, ...snap.data() } as Channel);
        });
        return;
      }

      // Fallback: try by name (legacy /channel/general routes)
      const q = query(collection(db, 'channels'), where('name', '==', channelId));
      const nameSnap = await getDocs(q).catch(() => null);
      if (cancelled) return;
      if (nameSnap && !nameSnap.empty) {
        const data = { id: nameSnap.docs[0].id, ...nameSnap.docs[0].data() } as Channel;
        console.log(`[ChannelPage] Channel resolved by name: ${data.name}`);
        setResolvedId(data.id);
        setChannel(data);
        setLoading(false);

        // Subscribe for live edits on the resolved doc
        unsubById = onSnapshot(doc(db, 'channels', data.id), (snap) => {
          if (snap.exists()) setChannel({ id: snap.id, ...snap.data() } as Channel);
        });
        return;
      }

      if (cancelled) return;
      console.warn(`[ChannelPage] Channel not found: ${channelId}`);
      navigate('/app/channel/general');
      setLoading(false);
    };

    resolve();

    return () => { cancelled = true; unsubById?.(); };
  }, [channelId, navigate]);

  // Message subscription — re-subscribes whenever the resolved channel doc ID changes.
  // Uses resolvedId (the actual Firestore doc ID) not the raw URL param, so name-based
  // routes (/channel/general) still get the right messages.
  useEffect(() => {
    if (!resolvedId) return;

    const unsubscribe = subscribeToChannelMessages(resolvedId, (msgs) => {
      messageCache.set(resolvedId, msgs);
      setMessages(msgs);
    });

    const loadTyping = () => {
      const typing = getTypingUsers(resolvedId);
      setTypingUsers(typing.filter(id => id !== user?.id));
    };

    loadTyping();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'retrochord_typing') loadTyping();
    };

    window.addEventListener('storage', handleStorage);
    const typingInterval = setInterval(loadTyping, 1000);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
      clearInterval(typingInterval);
    };
  }, [resolvedId, user?.id]);

  const handleSendMessage = async (content: string, attachments?: Attachment[]) => {
    if (user && channel) {
      await sendMessage(user.id, content, channel.id, undefined, attachments, user.username, channel.name);
    }
  };

  if (loading) {
    return (
      <div className="channel-page">
        <div className="channel-error">Loading channel...</div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="channel-page">
        <div className="channel-error">Channel not found</div>
      </div>
    );
  }

  return (
    <div className="channel-page">
      <ChannelHeader
        name={channel.name}
        description={channel.description}
      />
      <div className="channel-content">
        <MessageList
          messages={messages}
          highlightMessageId={highlightMessageId}
          onHighlightClear={() => setSearchParams({})}
        />
        <TypingIndicator userIds={typingUsers} />
        <MessageComposer
          onSend={handleSendMessage}
          channelId={channel.id}
        />
      </div>
    </div>
  );
};

export default ChannelPage;
