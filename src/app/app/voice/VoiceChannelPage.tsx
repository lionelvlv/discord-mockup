import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { Channel } from '../../../types/channel';
import { useVoice } from '../../../features/voice/VoiceContext';

const VoiceChannelPage: React.FC = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const { activeVoice, joinVoice } = useVoice();

  useEffect(() => {
    if (!channelId) return;

    // Already in this exact call — navigate forward to general, not back.
    // navigate(-1) caused a loop: going back could land on the voice URL again,
    // re-triggering this effect, re-joining, and resetting the call.
    if (activeVoice?.channelId === channelId) {
      navigate('/app/channel/general', { replace: true });
      return;
    }

    const resolve = async () => {
      let channel: Channel | null = null;

      const directSnap = await getDoc(doc(db, 'channels', channelId)).catch(() => null);
      if (directSnap?.exists()) {
        channel = { id: directSnap.id, ...directSnap.data() } as Channel;
      } else {
        const q = query(
          collection(db, 'channels'),
          where('name', '==', channelId),
          where('isVoiceChannel', '==', true)
        );
        const nameSnap = await getDocs(q).catch(() => null);
        if (nameSnap && !nameSnap.empty) {
          channel = { id: nameSnap.docs[0].id, ...nameSnap.docs[0].data() } as Channel;
        }
      }

      if (!channel || !channel.isVoiceChannel) {
        navigate('/app/channel/general', { replace: true });
        return;
      }

      joinVoice(channel.id, channel.name);
      navigate('/app/channel/general', { replace: true });
    };

    resolve();
  }, [channelId]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
};

export default VoiceChannelPage;
