import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { createChannel, updateChannel, deleteChannel, initializeDefaultChannels } from '../../features/channels/api';
import { Channel } from '../../types/channel';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getUnread, subscribeUnread } from '../../features/chat/unreadStore';
import './ChannelList.css';

interface ChannelListProps {
  onNavigate?: () => void;
  search?: string;
}

const ChannelList: React.FC<ChannelListProps> = ({ onNavigate, search = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; channel: Channel } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const initializedRef = useRef(false);
  // Re-render when any channel's unread state changes
  const [, forceUpdate] = useState(0);
  useEffect(() => subscribeUnread(() => forceUpdate(n => n + 1)), []);

  useEffect(() => {
    // Seed default channels once on first mount, then subscribe for real-time updates.
    const bootstrap = async () => {
      if (!initializedRef.current) {
        initializedRef.current = true;
        console.log('[ChannelList] Initializing default channels...');
        await initializeDefaultChannels().catch(console.error);
      }
    };
    bootstrap();

    console.log('[ChannelList] Subscribing to text channels');
    // Fetch all channels and filter client-side so docs without the isVoiceChannel
    // field (legacy data) are included. Firestore `== false` misses undefined fields.
    const unsub = onSnapshot(collection(db, 'channels'), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Channel))
        .filter((c) => !c.isVoiceChannel);
      list.sort((a, b) => (a.name < b.name ? -1 : 1));
      console.log(`[ChannelList] Channels updated: ${list.length}`);
      setChannels(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const isChannelActive = (channelId: string) =>
    location.pathname === `/app/channel/${channelId}`;

  const handleContextMenu = (e: React.MouseEvent, channel: Channel) => {
    e.preventDefault();
    if (user && (channel.createdBy === user.id || user.isAdmin)) {
      setContextMenu({ x: e.clientX, y: e.clientY, channel });
    }
  };

  const handleCreateChannel = async () => {
    if (!user || !newChannelName.trim()) return;
    try {
      await createChannel(newChannelName.trim(), user.id, newChannelDesc.trim(), false);
      setNewChannelName('');
      setNewChannelDesc('');
      setShowCreateModal(false);
      // No manual reload — onSnapshot fires automatically
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create channel');
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
      // No manual reload — onSnapshot fires automatically
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to edit channel');
    }
  };

  const handleDeleteChannel = async (channel: Channel) => {
    if (!user) return;
    if (confirm(`Delete #${channel.name}? This cannot be undone.`)) {
      try {
        await deleteChannel(channel.id, user.id);
        // No manual reload — onSnapshot fires automatically
        if (location.pathname === `/app/channel/${channel.id}`) {
          navigate('/app/channel/general');
        }
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to delete channel');
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

  const filteredChannels = channels.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="channel-list">
        {(!search || filteredChannels.length > 0) && (
          <div className="list-header pixel-font">
            <span>CHANNELS</span>
            <button
              className="create-channel-btn"
              onClick={() => setShowCreateModal(true)}
              title="Create Channel"
            >
              +
            </button>
          </div>
        )}
        {channels.length === 0 && !search && (
          <div style={{ padding: '8px', fontSize: '10px', color: '#666' }}>No channels found</div>
        )}
        {filteredChannels.map((channel) => (
          <div
            key={channel.id}
            className={`channel-item list-item-95 ${isChannelActive(channel.id) ? 'selected' : ''} ${getUnread(channel.id).unread > 0 && !isChannelActive(channel.id) ? 'has-unread' : ''}`}
            onClick={() => { navigate(`/app/channel/${channel.id}`); onNavigate?.(); }}
            onContextMenu={(e) => handleContextMenu(e, channel)}
          >
            <span className="channel-hash">#</span>
            <span className="channel-name">{channel.name}</span>
            {!isChannelActive(channel.id) && (() => {
              const u = getUnread(channel.id);
              if (u.mentions > 0) return <span className="unread-badge mention-badge">{u.mentions}</span>;
              if (u.unread > 0) return <span className="unread-dot" />;
              return null;
            })()}
          </div>
        ))}
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
            <div className="modal-header pixel-font">CREATE CHANNEL</div>
            <div className="modal-body">
              <label>
                Channel Name
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="my-channel"
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
            <div className="modal-header pixel-font">EDIT CHANNEL</div>
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

export default ChannelList;
