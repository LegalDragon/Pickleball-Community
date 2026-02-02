import { useState, useEffect, useMemo } from 'react';
import { X, Search, Send, Copy, Check, Users, UserPlus, Loader2 } from 'lucide-react';
import { clubsApi, friendsApi } from '../../services/api';
import { videoRoomApi } from '../../services/videoRoomService';

export default function InviteToRoomModal({ clubId, clubName, roomCode, onClose }) {
  const [activeTab, setActiveTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMembers();
    loadFriends();
  }, []);

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const response = await clubsApi.getMembers(clubId);
      const data = response.data || response;
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadFriends = async () => {
    setLoadingFriends(true);
    try {
      const response = await friendsApi.getFriends();
      const data = response.data || response;
      setFriends(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading friends:', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const filteredMembers = useMemo(() => {
    if (!searchQuery) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(m => {
      const name = (m.firstName || '') + ' ' + (m.lastName || '') + ' ' + (m.userName || '') + ' ' + (m.displayName || '');
      return name.toLowerCase().includes(q);
    });
  }, [members, searchQuery]);

  const filteredFriends = useMemo(() => {
    if (!searchQuery) return friends;
    const q = searchQuery.toLowerCase();
    return friends.filter(f => {
      const name = (f.firstName || '') + ' ' + (f.lastName || '') + ' ' + (f.userName || '') + ' ' + (f.displayName || '') + ' ' + (f.friendName || '');
      return name.toLowerCase().includes(q);
    });
  }, [friends, searchQuery]);

  const toggleUser = (userId) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSendInvites = async () => {
    if (selectedUserIds.size === 0) return;
    setSending(true);
    setError(null);
    try {
      const response = await videoRoomApi.inviteToClubRoom(clubId, {
        userIds: Array.from(selectedUserIds),
        message: message || null
      });
      const data = response.data || response;
      if (data.success) {
        setSent(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError('Failed to send invites');
      }
    } catch (err) {
      console.error('Error sending invites:', err);
      setError('Failed to send invites. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/rooms/${roomCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getDisplayName = (item) => {
    if (item.displayName) return item.displayName;
    if (item.friendName) return item.friendName;
    if (item.firstName && item.lastName) return `${item.firstName} ${item.lastName}`;
    if (item.userName) return item.userName;
    return 'Unknown';
  };

  const getUserId = (item) => {
    return item.userId || item.friendId || item.id;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold text-gray-900">Invite to Video Room</h3>
            <p className="text-xs text-gray-500 mt-0.5">{clubName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => { setActiveTab('members'); setSearchQuery(''); }}
            className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'members'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4" />
            Club Members
          </button>
          <button
            onClick={() => { setActiveTab('friends'); setSearchQuery(''); }}
            className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'friends'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Friends
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab === 'members' ? 'members' : 'friends'}...`}
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0" style={{ maxHeight: '300px' }}>
          {activeTab === 'members' && (
            loadingMembers ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading members...
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                {searchQuery ? 'No members found' : 'No members available'}
              </div>
            ) : (
              filteredMembers.map((member) => {
                const uid = getUserId(member);
                const selected = selectedUserIds.has(uid);
                return (
                  <label
                    key={uid}
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                      selected ? 'bg-teal-50 border border-teal-200' : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleUser(uid)}
                      className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {getDisplayName(member)}
                      </p>
                      {member.role && (
                        <p className="text-xs text-gray-500">{member.role}</p>
                      )}
                    </div>
                  </label>
                );
              })
            )
          )}

          {activeTab === 'friends' && (
            loadingFriends ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading friends...
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                {searchQuery ? 'No friends found' : 'No friends available'}
              </div>
            ) : (
              filteredFriends.map((friend) => {
                const uid = getUserId(friend);
                const selected = selectedUserIds.has(uid);
                return (
                  <label
                    key={uid}
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                      selected ? 'bg-teal-50 border border-teal-200' : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleUser(uid)}
                      className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {getDisplayName(friend)}
                      </p>
                    </div>
                  </label>
                );
              })
            )
          )}
        </div>

        {/* Optional Message */}
        {selectedUserIds.size > 0 && (
          <div className="px-3 py-2 border-t">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a message (optional)"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-3 py-2 text-sm text-red-600 text-center">{error}</div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 p-4 border-t bg-gray-50 rounded-b-xl">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Link
              </>
            )}
          </button>

          <div className="flex-1" />

          {sent ? (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <Check className="w-4 h-4" />
              Invites sent!
            </div>
          ) : (
            <button
              onClick={handleSendInvites}
              disabled={selectedUserIds.size === 0 || sending}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send Invites {selectedUserIds.size > 0 && `(${selectedUserIds.size})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
