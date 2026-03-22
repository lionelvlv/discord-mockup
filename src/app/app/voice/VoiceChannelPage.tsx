import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Channel } from '../../../types/channel';
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import VoicePanel from '../../../components/voice/VoicePanel';
import './voice.css';

const VoiceChannelPage: React.FC = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!channelId) return;
    setLoading(true);
    setChannel(null);
    console.log(`[VoiceChannelPage] Subscribing to voice channel ${channelId}`);

    let unsubDoc: (() => void) | null = null;
    let cancelled = false;

    const resolve = async () => {
      // Try as a Firestore document ID first
      const directSnap = await getDoc(doc(db, 'channels', channelId)).catch(() => null);
      if (cancelled) return;
      if (directSnap?.exists()) {
        const data = { id: directSnap.id, ...directSnap.data() } as Channel;
        if (!data.isVoiceChannel) {
          console.warn(`[VoiceChannelPage] Channel ${channelId} is not a voice channel`);
          navigate('/app/channel/general');
          return;
        }
        console.log(`[VoiceChannelPage] Resolved voice channel: ${data.name}`);
        setChannel(data);
        setLoading(false);
        unsubDoc = onSnapshot(doc(db, 'channels', data.id), (snap) => {
          if (snap.exists()) setChannel({ id: snap.id, ...snap.data() } as Channel);
        });
        return;
      }

      // Fallback: look up by name (legacy routes like /voice/voice-lobby)
      const q = query(
        collection(db, 'channels'),
        where('name', '==', channelId),
        where('isVoiceChannel', '==', true)
      );
      const nameSnap = await getDocs(q).catch(() => null);
      if (cancelled) return;
      if (nameSnap && !nameSnap.empty) {
        const data = { id: nameSnap.docs[0].id, ...nameSnap.docs[0].data() } as Channel;
        console.log(`[VoiceChannelPage] Resolved voice channel by name: ${data.name}`);
        setChannel(data);
        setLoading(false);
        unsubDoc = onSnapshot(doc(db, 'channels', data.id), (snap) => {
          if (snap.exists()) setChannel({ id: snap.id, ...snap.data() } as Channel);
        });
        return;
      }

      console.warn(`[VoiceChannelPage] Voice channel not found: ${channelId}`);
      navigate('/app/channel/general');
      setLoading(false);
    };

    resolve();

    return () => { cancelled = true; unsubDoc?.(); };
  }, [channelId, navigate]);

  const handleLeaveVoice = () => {
    navigate('/app/channel/general');
  };

  if (loading) {
    return (
      <div className="voice-channel-page">
        <div className="loading">Loading voice channel...</div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="voice-channel-page">
        <div className="error">Voice channel not found</div>
      </div>
    );
  }

  return (
    <div className="voice-channel-page">
      <VoicePanel
        channelId={channel.id}
        channelName={channel.name}
        onLeave={handleLeaveVoice}
      />
    </div>
  );
};

export default VoiceChannelPage;
