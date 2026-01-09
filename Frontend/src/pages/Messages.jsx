import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MessageCircle, ArrowLeft, Send, MoreVertical, Search, Users, User,
  Check, CheckCheck, Reply, Trash2, Edit3, X, Bell, BellOff, Plus,
  Image, Smile, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Wifi, WifiOff, UserPlus, PanelLeftClose, PanelLeft, Info
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { messagingApi, friendsApi, getSharedAssetUrl } from '../services/api';
import { useSignalR, SignalREvents } from '../hooks/useSignalR';

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [showMobileConversation, setShowMobileConversation] = useState(false);
  const [conversationDetails, setConversationDetails] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [addingParticipants, setAddingParticipants] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // SignalR for real-time messaging
  const {
    connect,
    disconnect,
    on,
    off,
    sendTyping,
    isConnected,
    connectionState
  } = useSignalR();

  // Connect to SignalR when component mounts
  useEffect(() => {
    if (user) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);

  // Handle SignalR events
  useEffect(() => {
    if (!isConnected) return;

    // New message received
    const handleReceiveMessage = (notification) => {
      console.log('SignalR: Received message', notification);

      // Update messages if this is the current conversation
      if (selectedConversation?.id === notification.conversationId) {
        setMessages(prev => {
          // Check if message already exists (avoid duplicates)
          if (prev.some(m => m.id === notification.message.id)) {
            return prev;
          }
          return [...prev, notification.message];
        });

        // Scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }

      // Update conversation list
      setConversations(prev => {
        const updated = prev.map(c =>
          c.id === notification.conversationId
            ? {
                ...c,
                lastMessagePreview: notification.message.content?.substring(0, 50),
                lastMessageAt: notification.message.createdAt,
                lastMessageSenderName: notification.message.senderName,
                unreadCount: selectedConversation?.id === notification.conversationId
                  ? 0
                  : (c.unreadCount || 0) + 1
              }
            : c
        );
        // Move conversation to top
        const current = updated.find(c => c.id === notification.conversationId);
        if (current) {
          return [current, ...updated.filter(c => c.id !== notification.conversationId)];
        }
        return updated;
      });
    };

    // Message edited
    const handleMessageEdited = (message) => {
      console.log('SignalR: Message edited', message);
      setMessages(prev => prev.map(m =>
        m.id === message.id ? { ...m, content: message.content, editedAt: message.editedAt } : m
      ));
    };

    // Message deleted
    const handleMessageDeleted = ({ messageId, conversationId }) => {
      console.log('SignalR: Message deleted', messageId);
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, isDeleted: true, content: '[Message deleted]' } : m
      ));
    };

    // User typing indicator
    const handleUserTyping = (notification) => {
      if (notification.conversationId === selectedConversation?.id) {
        setTypingUsers(prev => ({
          ...prev,
          [notification.userId]: notification.isTyping ? notification.userName : null
        }));

        // Clear typing indicator after 3 seconds
        if (notification.isTyping) {
          setTimeout(() => {
            setTypingUsers(prev => ({
              ...prev,
              [notification.userId]: null
            }));
          }, 3000);
        }
      }
    };

    // Subscribe to events
    on(SignalREvents.ReceiveMessage, handleReceiveMessage);
    on(SignalREvents.MessageEdited, handleMessageEdited);
    on(SignalREvents.MessageDeleted, handleMessageDeleted);
    on(SignalREvents.UserTyping, handleUserTyping);

    return () => {
      off(SignalREvents.ReceiveMessage, handleReceiveMessage);
      off(SignalREvents.MessageEdited, handleMessageEdited);
      off(SignalREvents.MessageDeleted, handleMessageDeleted);
      off(SignalREvents.UserTyping, handleUserTyping);
    };
  }, [isConnected, selectedConversation, on, off]);

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (!isConnected || !selectedConversation) return;

    // Send typing indicator
    sendTyping(selectedConversation.id, true).catch(console.error);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(selectedConversation.id, false).catch(console.error);
    }, 2000);
  }, [isConnected, selectedConversation, sendTyping]);

  // Get list of typing users for current conversation
  const getTypingIndicator = () => {
    const typingNames = Object.values(typingUsers).filter(Boolean);
    if (typingNames.length === 0) return null;
    if (typingNames.length === 1) return `${typingNames[0]} is typing...`;
    return `${typingNames.slice(0, 2).join(', ')} are typing...`;
  };

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Handle conversation ID from URL
  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === parseInt(conversationId));
      if (conv) {
        handleSelectConversation(conv);
      }
    }
  }, [searchParams, conversations]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const response = await messagingApi.getConversations();
      setConversations(response.data || []);
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = async (conversation) => {
    setSelectedConversation(conversation);
    setShowMobileConversation(true);
    setMessages([]);
    setLoadingMessages(true);
    setSearchParams({ conversation: conversation.id });

    try {
      const [messagesRes, detailsRes] = await Promise.all([
        messagingApi.getMessages(conversation.id),
        messagingApi.getConversation(conversation.id)
      ]);

      setMessages(messagesRes.data?.messages || []);
      setHasMoreMessages(messagesRes.data?.hasMore || false);
      setConversationDetails(detailsRes.data);

      // Mark as read
      if (conversation.unreadCount > 0) {
        await messagingApi.markAsRead(conversation.id);
        // Update local state
        setConversations(prev => prev.map(c =>
          c.id === conversation.id ? { ...c, unreadCount: 0 } : c
        ));
      }

      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || sendingMessage) return;

    setSendingMessage(true);
    try {
      const response = await messagingApi.sendMessage(
        selectedConversation.id,
        newMessage.trim(),
        'Text',
        replyingTo?.id || null
      );

      if (response.data) {
        setMessages(prev => [...prev, response.data]);
        setNewMessage('');
        setReplyingTo(null);

        // Update conversation in list
        setConversations(prev => {
          const updated = prev.map(c =>
            c.id === selectedConversation.id
              ? {
                  ...c,
                  lastMessagePreview: newMessage.trim().substring(0, 50),
                  lastMessageAt: new Date().toISOString(),
                  lastMessageSenderName: `${user?.firstName} ${user?.lastName}`.trim()
                }
              : c
          );
          // Move to top
          const current = updated.find(c => c.id === selectedConversation.id);
          return [current, ...updated.filter(c => c.id !== selectedConversation.id)];
        });

        // Scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleLoadMoreMessages = async () => {
    if (!hasMoreMessages || loadingMessages || messages.length === 0) return;

    setLoadingMessages(true);
    try {
      const oldestMessage = messages[0];
      const response = await messagingApi.getMessages(
        selectedConversation.id,
        oldestMessage.id
      );

      if (response.data?.messages) {
        setMessages(prev => [...response.data.messages, ...prev]);
        setHasMoreMessages(response.data.hasMore || false);
      }
    } catch (err) {
      console.error('Error loading more messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleMuteConversation = async () => {
    if (!selectedConversation) return;
    try {
      await messagingApi.muteConversation(selectedConversation.id, !selectedConversation.isMuted);
      setSelectedConversation(prev => ({ ...prev, isMuted: !prev.isMuted }));
      setConversations(prev => prev.map(c =>
        c.id === selectedConversation.id ? { ...c, isMuted: !c.isMuted } : c
      ));
      setShowMenu(false);
    } catch (err) {
      console.error('Error muting conversation:', err);
    }
  };

  const handleOpenAddFriends = async () => {
    setShowMenu(false);
    setShowAddFriends(true);
    setLoadingFriends(true);
    try {
      const response = await friendsApi.getFriends();
      const allFriends = response.data?.data ?? response.data ?? [];
      // Filter out friends who are already participants
      const participantIds = conversationDetails?.participants?.map(p => p.userId) || [];
      const availableFriends = allFriends.filter(f => !participantIds.includes(f.id));
      setFriends(availableFriends);
    } catch (err) {
      console.error('Error loading friends:', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleAddFriendToChat = async (friendId) => {
    if (!selectedConversation || addingParticipants) return;
    setAddingParticipants(true);
    try {
      await messagingApi.addParticipants(selectedConversation.id, [friendId]);
      // Refresh conversation details
      const detailsRes = await messagingApi.getConversation(selectedConversation.id);
      setConversationDetails(detailsRes.data);
      // Remove added friend from list
      setFriends(prev => prev.filter(f => f.id !== friendId));
      // Update conversation type if needed
      if (selectedConversation.type === 'Direct') {
        setSelectedConversation(prev => ({ ...prev, type: 'FriendGroup' }));
        setConversations(prev => prev.map(c =>
          c.id === selectedConversation.id ? { ...c, type: 'FriendGroup' } : c
        ));
      }
    } catch (err) {
      console.error('Error adding friend to chat:', err);
    } finally {
      setAddingParticipants(false);
    }
  };

  const handleBackToList = () => {
    setShowMobileConversation(false);
    setSelectedConversation(null);
    setSearchParams({});
  };

  const formatMessageTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatConversationTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getTotalUnread = () => {
    return conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header - Always visible */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-4 px-4 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          {showMobileConversation && selectedConversation ? (
            <>
              <button
                onClick={handleBackToList}
                className="p-2.5 -ml-2 rounded-lg hover:bg-white/10 active:bg-white/20 md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {selectedConversation.displayAvatar ? (
                  <img
                    src={getSharedAssetUrl(selectedConversation.displayAvatar)}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    {selectedConversation.type === 'Direct' ? (
                      <User className="w-5 h-5" />
                    ) : (
                      <Users className="w-5 h-5" />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-semibold truncate">
                    {selectedConversation.displayName || selectedConversation.name || 'Conversation'}
                  </h1>
                  {conversationDetails?.participants && (
                    <p className="text-sm text-blue-100 truncate">
                      {selectedConversation.type === 'Direct'
                        ? 'Direct message'
                        : `${conversationDetails.participants.length} participants`}
                    </p>
                  )}
                </div>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2.5 rounded-lg hover:bg-white/10 active:bg-white/20 min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-lg shadow-lg border py-1 z-50">
                    <button
                      onClick={handleOpenAddFriends}
                      className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 active:bg-gray-100 flex items-center gap-3 min-h-[48px] touch-manipulation"
                    >
                      <UserPlus className="w-5 h-5" />
                      Add Friends
                    </button>
                    <button
                      onClick={handleMuteConversation}
                      className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 active:bg-gray-100 flex items-center gap-3 min-h-[48px] touch-manipulation"
                    >
                      {selectedConversation.isMuted ? (
                        <>
                          <Bell className="w-5 h-5" />
                          Unmute
                        </>
                      ) : (
                        <>
                          <BellOff className="w-5 h-5" />
                          Mute
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <MessageCircle className="w-8 h-8" />
              <div className="flex-1">
                <h1 className="text-xl font-bold">Messages</h1>
                {getTotalUnread() > 0 && (
                  <p className="text-sm text-blue-100">
                    {getTotalUnread()} unread message{getTotalUnread() !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              {/* Connection status indicator */}
              <div className="flex items-center gap-1" title={`SignalR: ${connectionState}`}>
                {isConnected ? (
                  <Wifi className="w-4 h-4 text-green-300" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-300" />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden max-w-6xl w-full mx-auto">
        {/* Conversation List - Hidden on mobile when viewing a conversation */}
        <div className={`
          flex-shrink-0 bg-white border-r flex flex-col transition-all duration-300
          ${showMobileConversation ? 'hidden md:flex' : 'flex'}
          ${sidebarCollapsed ? 'w-16' : 'w-full md:w-80 lg:w-96'}
        `}>
          {/* Collapse toggle - desktop only */}
          <div className="hidden md:flex items-center justify-end p-2 border-b">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          ) : conversations.length === 0 ? (
            <div className={`flex-1 flex flex-col items-center justify-center text-center ${sidebarCollapsed ? 'p-2' : 'p-6'}`}>
              <MessageCircle className={`text-gray-300 mb-4 ${sidebarCollapsed ? 'w-8 h-8' : 'w-16 h-16'}`} />
              {!sidebarCollapsed && (
                <>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No messages yet</h3>
                  <p className="text-gray-500 mb-4">
                    Start a conversation with a friend!
                  </p>
                  <button
                    onClick={() => navigate('/friends')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                  >
                    <Users className="w-5 h-5" />
                    Find Friends
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {conversations.map(conversation => (
                <button
                  key={conversation.id}
                  onClick={() => handleSelectConversation(conversation)}
                  className={`
                    w-full hover:bg-gray-50 active:bg-gray-100 border-b transition-colors text-left touch-manipulation
                    ${selectedConversation?.id === conversation.id ? 'bg-blue-50' : ''}
                    ${sidebarCollapsed ? 'p-2 flex items-center justify-center' : 'p-4 flex items-start gap-3 min-h-[72px]'}
                  `}
                  title={sidebarCollapsed ? (conversation.displayName || conversation.name || 'Conversation') : undefined}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {conversation.displayAvatar ? (
                      <img
                        src={getSharedAssetUrl(conversation.displayAvatar)}
                        alt=""
                        className={`rounded-full object-cover ${sidebarCollapsed ? 'w-10 h-10' : 'w-12 h-12'}`}
                      />
                    ) : (
                      <div className={`rounded-full bg-blue-100 flex items-center justify-center ${sidebarCollapsed ? 'w-10 h-10' : 'w-12 h-12'}`}>
                        {conversation.type === 'Direct' ? (
                          <User className={sidebarCollapsed ? 'w-5 h-5 text-blue-600' : 'w-6 h-6 text-blue-600'} />
                        ) : (
                          <Users className={sidebarCollapsed ? 'w-5 h-5 text-blue-600' : 'w-6 h-6 text-blue-600'} />
                        )}
                      </div>
                    )}
                    {conversation.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Content - hidden when collapsed */}
                  {!sidebarCollapsed && (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={`font-medium truncate ${
                          conversation.unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'
                        }`}>
                          {conversation.displayName || conversation.name || 'Conversation'}
                        </h3>
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                          {formatConversationTime(conversation.lastMessageAt)}
                        </span>
                      </div>
                      <p className={`text-sm truncate ${
                        conversation.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'
                      }`}>
                        {conversation.lastMessagePreview || 'No messages yet'}
                      </p>
                    </div>
                  )}

                  {/* Muted indicator - hidden when collapsed */}
                  {!sidebarCollapsed && conversation.isMuted && (
                    <BellOff className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Messages View - Full screen on mobile, side panel on desktop */}
        <div className={`
          flex-1 flex flex-col bg-gray-50
          ${showMobileConversation ? 'flex' : 'hidden md:flex'}
        `}>
          {selectedConversation ? (
            <>
              {/* Participants Panel - Top bar */}
              {conversationDetails?.participants && conversationDetails.participants.length > 0 && (
                <div className="bg-white border-b px-4 py-2 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowParticipants(!showParticipants)}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                    >
                      <Users className="w-4 h-4" />
                      <span className="font-medium">{conversationDetails.participants.length} participants</span>
                      {showParticipants ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Expanded participants list */}
                  {showParticipants && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {conversationDetails.participants.map(participant => (
                        <button
                          key={participant.userId}
                          onClick={() => setSelectedParticipant(
                            selectedParticipant?.userId === participant.userId ? null : participant
                          )}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
                            selectedParticipant?.userId === participant.userId
                              ? 'bg-blue-50 border-blue-300'
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {participant.avatar ? (
                            <img
                              src={getSharedAssetUrl(participant.avatar)}
                              alt=""
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="w-3 h-3 text-blue-600" />
                            </div>
                          )}
                          <span className="text-sm font-medium text-gray-700">
                            {participant.displayName || 'Unknown'}
                            {participant.userId === user?.id && ' (You)'}
                          </span>
                          {participant.role && participant.role !== 'Member' && (
                            <span className="text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                              {participant.role}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected participant details popup */}
                  {selectedParticipant && selectedParticipant.userId !== user?.id && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-3">
                        {selectedParticipant.avatar ? (
                          <img
                            src={getSharedAssetUrl(selectedParticipant.avatar)}
                            alt=""
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="w-6 h-6 text-blue-600" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {selectedParticipant.displayName}
                          </p>
                          {selectedParticipant.city && (
                            <p className="text-sm text-gray-500 truncate">
                              {selectedParticipant.city}{selectedParticipant.state && `, ${selectedParticipant.state}`}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => navigate(`/users/${selectedParticipant.userId}`)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1"
                        >
                          <User className="w-4 h-4" />
                          View Profile
                        </button>
                        <button
                          onClick={() => setSelectedParticipant(null)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Main messages area */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Messages */}
                <div
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto p-4 space-y-3"
                >
                  {/* Load more button */}
                  {hasMoreMessages && (
                    <div className="text-center">
                      <button
                        onClick={handleLoadMoreMessages}
                        disabled={loadingMessages}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {loadingMessages ? 'Loading...' : 'Load older messages'}
                      </button>
                    </div>
                  )}

                  {loadingMessages && messages.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                    </div>
                  ) : (
                    messages.map((message, index) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        isOwn={message.isOwn}
                        showAvatar={
                          !message.isOwn &&
                          (index === 0 || messages[index - 1].senderId !== message.senderId)
                        }
                        isGroupChat={selectedConversation?.type !== 'Direct'}
                        onReply={() => {
                          setReplyingTo(message);
                          inputRef.current?.focus();
                        }}
                      />
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Typing indicator */}
                {getTypingIndicator() && (
                  <div className="px-4 py-2 text-sm text-gray-500 italic">
                    {getTypingIndicator()}
                  </div>
                )}

                {/* Reply preview */}
                {replyingTo && (
                  <div className="px-4 py-2 bg-gray-100 border-t flex items-center gap-2">
                    <Reply className="w-4 h-4 text-gray-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500">
                        Replying to {replyingTo.senderName}
                      </p>
                      <p className="text-sm text-gray-700 truncate">
                        {replyingTo.content}
                      </p>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Message input - Mobile optimized */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 md:p-4 bg-white border-t flex items-end gap-2 safe-area-inset-bottom"
                >
                  <div className="flex-1 min-w-0">
                    <textarea
                      ref={inputRef}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onInput={handleTyping}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder="Type a message..."
                      rows={1}
                      className="w-full px-4 py-3 border border-gray-300 rounded-2xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      style={{ maxHeight: '120px', fontSize: '16px' }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sendingMessage}
                    className="p-3.5 md:p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 min-w-[48px] min-h-[48px] flex items-center justify-center touch-manipulation"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <MessageCircle className="w-20 h-20 text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Select a conversation
              </h3>
              <p className="text-gray-500">
                Choose a conversation from the list to start messaging
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        />
      )}

      {/* Add Friends Modal */}
      {showAddFriends && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Add Friends to Chat</h2>
              <button
                onClick={() => setShowAddFriends(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingFriends ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>No friends available to add</p>
                  <p className="text-sm mt-1">All your friends are already in this chat</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map(friend => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {friend.profileImageUrl ? (
                          <img
                            src={getSharedAssetUrl(friend.profileImageUrl)}
                            alt={friend.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                        )}
                        <span className="font-medium text-gray-900">{friend.name}</span>
                      </div>
                      <button
                        onClick={() => handleAddFriendToChat(friend.id)}
                        disabled={addingParticipants}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {addingParticipants ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, isOwn, showAvatar, isGroupChat, onReply }) {
  const [showActions, setShowActions] = useState(false);

  // Truncate name to max 12 characters
  const truncateName = (name) => {
    if (!name) return '';
    return name.length > 12 ? name.substring(0, 10) + '...' : name;
  };

  // Toggle actions on tap (for mobile)
  const handleTap = () => {
    if (!message.isDeleted) {
      setShowActions(!showActions);
    }
  };

  return (
    <div
      className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar and name for group chats - show for every message */}
      {!isOwn && isGroupChat && (
        <div className="flex flex-col items-center flex-shrink-0 w-10">
          {message.senderAvatar ? (
            <img
              src={getSharedAssetUrl(message.senderAvatar)}
              alt=""
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
          )}
          <span className="text-[10px] text-gray-500 mt-0.5 text-center truncate w-full">
            {truncateName(message.senderName)}
          </span>
        </div>
      )}

      {/* Avatar for direct messages - only show when showAvatar is true */}
      {!isOwn && !isGroupChat && (
        <div className="w-8 flex-shrink-0">
          {showAvatar && (
            message.senderAvatar ? (
              <img
                src={getSharedAssetUrl(message.senderAvatar)}
                alt=""
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
            )
          )}
        </div>
      )}

      <div className={`max-w-[70%] ${isOwn ? 'order-1' : ''}`}>
        {/* Reply preview */}
        {message.replyToMessage && (
          <div className={`
            text-xs px-3 py-1.5 rounded-t-lg border-l-2 mb-1
            ${isOwn ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-gray-100 border-gray-400 text-gray-600'}
          `}>
            <p className="font-medium">{message.replyToMessage.senderName}</p>
            <p className="truncate">{message.replyToMessage.content}</p>
          </div>
        )}

        {/* Message bubble */}
        <div
          onClick={handleTap}
          className={`
            px-4 py-2.5 rounded-2xl relative group cursor-pointer select-none touch-manipulation
            ${isOwn
              ? 'bg-blue-600 text-white rounded-tr-md'
              : 'bg-white text-gray-900 rounded-tl-md shadow-sm'
            }
          `}
        >

          {/* Content */}
          {message.isDeleted ? (
            <p className={`text-sm italic ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
              Message deleted
            </p>
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}

          {/* Time and status */}
          <div className={`
            flex items-center gap-1 mt-1
            ${isOwn ? 'justify-end' : 'justify-start'}
          `}>
            <span className={`text-xs ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
              {new Date(message.createdAt).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit'
              })}
            </span>
            {message.editedAt && (
              <span className={`text-xs ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
                (edited)
              </span>
            )}
          </div>
        </div>

        {/* Actions - Touch-friendly */}
        {showActions && !message.isDeleted && (
          <div className={`
            flex items-center gap-1 mt-1
            ${isOwn ? 'justify-end' : 'justify-start'}
          `}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReply();
                setShowActions(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-full text-sm font-medium touch-manipulation min-h-[36px]"
            >
              <Reply className="w-4 h-4" />
              <span className="hidden sm:inline">Reply</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
