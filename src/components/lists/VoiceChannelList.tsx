import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { createChannel, updateChannel, deleteChannel } from '../../features/channels/api';
import { subscribeToVoicePresence } from '../../features/voice/api';
import { Channel } from '../../types/channel';
import { User } from '../../types/user';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import './VoiceChannelList.css';

interface VoiceChannelListProps {
  onNavigate?: () => void;
  search?: string;
}

const VoiceChannelList: React.FC<VoiceChannelListProps> = ({ onNavigate, search = '' }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [voiceChannels, setVoiceChannels] = useState<Channel[]>([]);
  // RTDB-sourced participant sets — updates instantly on hard disconnect (browser close, phone off).
  // Firestore participants[] has no onDisconnect equivalent so stale counts linger until the next
  // intentional leave. RTDB voicePresence/{channelId} is cleaned up server-side on disconnect.
  const [participantsByChannel, setParticipantsByChannel] = useState<Record<string, string[]>>({});
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; channel: Channel } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');

  // Real-time voice channels subscription
  useEffect(() => {
    console.log('[VoiceChannelList] Subscribing to voice channels');
    const unsub = onSnapshot(collection(db, 'channels'), (snap) => {
      const channels = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Channel))
        .filter((c) => c.isVoiceChannel === true);
      channels.sort((a, b) => (a.name < b.name ? -1 : 1));
      console.log(`[VoiceChannelList] Voice channels updated: ${channels.length}`);
      setVoiceChannels(channels);
    });
    return () => unsub();
  }, []);

  // Real-time users subscription (for participant name display)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const map = new Map<string, User>();
      snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() } as User));
      setUsers(map);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Subscribe to RTDB voicePresence for each channel.
  // RTDB has server-side onDisconnect so the count drops the moment a tab closes or
  // a phone loses connection — no stale counts from Firestore participants[].
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    voiceChannels.forEach(channel => {
      const unsubscribe = subscribeToVoicePresence(channel.id, (connectedIds) => {
        const ids = Array.from(connectedIds);
        console.log(`[VoiceChannelList] Channel ${channel.name} participants: ${ids.length}`);
        setParticipantsByChannel(prev => ({ ...prev, [channel.id]: ids }));
      });
      unsubscribers.push(unsubscribe);
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [voiceChannels]);

  const getUserById = (userId: string): User | undefined => users.get(userId);

  const handleContextMenu = (e: React.MouseEvent, channel: Channel) => {
    e.preventDefault();
    
    if (user && (channel.createdBy === user.id || user.isAdmin)) {
      setContextMenu({ x: e.clientX, y: e.clientY, channel });
    }
  };

  const handleCreateChannel = async () => {
    if (!user || !newChannelName.trim()) return;

    try {
      await createChannel(newChannelName.trim(), user.id, newChannelDesc.trim(), true);
      setNewChannelName('');
      setNewChannelDesc('');
      setShowCreateModal(false);
      // No manual reload needed — onSnapshot fires automatically
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create voice channel');
    }
  };

  const handleEditChannel = async () => {
    if (!user || !editingChannel || !newChannelName.trim()) return;

    try {
      await updateChannel(editingChannel.id, user.id, {
        name: newChannelName.trim(),
        description: newChannelDesc.trim()
      });
      setShowEditModal(false);
      setEditingChannel(null);
      setNewChannelName('');
      setNewChannelDesc('');
      // No manual reload needed — onSnapshot fires automatically
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to edit voice channel');
    }
  };

  const handleDeleteChannel = async (channel: Channel) => {
    if (!user) return;

    if (confirm(`Delete voice channel "${channel.name}"? This cannot be undone.`)) {
      try {
        await deleteChannel(channel.id, user.id);
        // No manual reload needed — onSnapshot fires automatically
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to delete voice channel');
      }
    }
    setContextMenu(null);
  };

  const openEditModal = (channel: Channel) => {
    setEditingChannel(channel);
    setNewChannelName(channel.name);
    setNewChannelDesc(channel.description || '');
    setShowEditModal(true);
    setContextMenu(null);
  };

  const handleJoinVoice = (channelId: string) => {
    navigate(`/app/voice/${channelId}`);
    onNavigate?.();
  };

  const toggleExpanded = (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedChannels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(channelId)) {
        newSet.delete(channelId);
      } else {
        newSet.add(channelId);
      }
      return newSet;
    });
  };

  const filteredVoiceChannels = voiceChannels.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="voice-channel-list">
        {(!search || filteredVoiceChannels.length > 0) && (
          <div className="list-header pixel-font">
            <span>VOICE CHANNELS</span>
            <button
              className="create-channel-btn"
              onClick={() => setShowCreateModal(true)}
              title="Create Voice Channel"
            >
              +
            </button>
          </div>
        )}
        {filteredVoiceChannels.map((channel) => {
          const participants = participantsByChannel[channel.id] || [];
          const participantCount = participants.length;
          const isExpanded = expandedChannels.has(channel.id);
          
          return (
            <div key={channel.id} className="voice-channel-wrapper">
              <div
                className="voice-channel-item list-item-95"
                onClick={() => handleJoinVoice(channel.id)}
                onContextMenu={(e) => handleContextMenu(e, channel)}
              >
                <div className="voice-channel-main">
                  {participantCount > 0 && (
                    <button 
                      className="expand-btn"
                      onClick={(e) => toggleExpanded(channel.id, e)}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  )}
                  <span className="voice-icon">🔊</span>
                  <span className="voice-channel-name">{channel.name}</span>
                  {participantCount > 0 && (
                    <span className="participant-badge">{participantCount}</span>
                  )}
                </div>
              </div>
              
              {isExpanded && participantCount > 0 && (
                <div className="participant-list">
                  {participants.map(userId => {
                    const participant = getUserById(userId);
                    return participant ? (
                      <div key={userId} className="participant-item">
                        <span className="participant-avatar">{participant.avatarUrl}</span>
                        <span className="participant-username">{participant.username}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="context-menu panel"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {!contextMenu.channel.isPermanent && (
            <div className="context-item" onClick={() => openEditModal(contextMenu.channel)}>
              ✏️ Edit Channel
            </div>
          )}
          {!contextMenu.channel.isPermanent && (
            <div className="context-item" onClick={() => handleDeleteChannel(contextMenu.channel)}>
              🗑️ Delete Channel
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header pixel-font">CREATE VOICE CHANNEL</div>
            <div className="modal-body">
              <label>
                Channel Name
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="gaming-voice"
                  className="input-95"
                />
              </label>
              <label>
                Description
                <input
                  type="text"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="Channel description"
                  className="input-95"
                />
              </label>
            </div>
            <div className="modal-footer">
              <button className="button-95" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className="button-95" onClick={handleCreateChannel}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingChannel && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header pixel-font">EDIT VOICE CHANNEL</div>
            <div className="modal-body">
              {!editingChannel.isPermanent && (
                <label>
                  Channel Name
                  <input
                    type="text"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    className="input-95"
                  />
                </label>
              )}
              <label>
                Description
                <input
                  type="text"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="Channel description"
                  className="input-95"
                />
              </label>
            </div>
            <div className="modal-footer">
              <button className="button-95" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button className="button-95" onClick={handleEditChannel}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceChannelList;