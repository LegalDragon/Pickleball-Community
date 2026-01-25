import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Search, Check, X, Clock, MessageCircle,
  User, Calendar, ChevronRight, ArrowLeft, Gamepad2, ExternalLink
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { friendsApi, messagingApi, getSharedAssetUrl } from '../services/api';
import PublicProfileModal from '../components/ui/PublicProfileModal';

export default function Friends() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [searchFilters, setSearchFilters] = useState({
    firstName: '',
    lastName: '',
    city: '',
    state: '',
    email: '',
    phone: ''
  });
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [previewUser, setPreviewUser] = useState(null);
  const [profileModalUserId, setProfileModalUserId] = useState(null);

  useEffect(() => {
    loadFriendsData();
  }, []);

  // Helper to extract data from response (handles both wrapped and unwrapped)
  const extractData = (response) => {
    const data = response.data?.data ?? response.data ?? [];
    return Array.isArray(data) ? data : [];
  };

  const loadFriendsData = async () => {
    setLoading(true);
    try {
      const [friendsRes, pendingRes, sentRes] = await Promise.all([
        friendsApi.getFriends(),
        friendsApi.getPendingRequests(),
        friendsApi.getSentRequests()
      ]);
      setFriends(extractData(friendsRes));
      setPendingRequests(extractData(pendingRes));
      setSentRequests(extractData(sentRes));
    } catch (err) {
      console.error('Error loading friends data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e?.preventDefault();

    // Check if at least one field has a value
    const hasFilters = Object.values(searchFilters).some(v => v.trim().length > 0);
    if (!hasFilters) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setSearching(true);
    setHasSearched(true);
    try {
      const response = await friendsApi.searchPlayers(searchFilters);
      setSearchResults(extractData(response));
    } catch (err) {
      console.error('Error searching players:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setSearchFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearSearch = () => {
    setSearchFilters({ firstName: '', lastName: '', city: '', state: '', email: '', phone: '' });
    setSearchResults([]);
    setHasSearched(false);
  };

  const handleSendRequest = async (userId) => {
    try {
      await friendsApi.sendRequest(userId);
      // Refresh data
      loadFriendsData();
      // Update search results to show pending status
      setSearchResults(prev => prev.map(u =>
        u.id === userId ? { ...u, hasPendingRequest: true } : u
      ));
    } catch (err) {
      console.error('Error sending friend request:', err);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await friendsApi.acceptRequest(requestId);
      loadFriendsData();
    } catch (err) {
      console.error('Error accepting request:', err);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await friendsApi.rejectRequest(requestId);
      loadFriendsData();
    } catch (err) {
      console.error('Error rejecting request:', err);
    }
  };

  const handleCancelRequest = async (requestId) => {
    try {
      await friendsApi.cancelRequest(requestId);
      loadFriendsData();
    } catch (err) {
      console.error('Error cancelling request:', err);
    }
  };

  const handleStartChat = async (friendId, e) => {
    e.stopPropagation(); // Prevent opening profile modal
    try {
      const response = await messagingApi.createDirectConversation(friendId);
      const conversationId = response?.data?.id || response?.id;
      if (conversationId) {
        navigate(`/messages?conversation=${conversationId}`);
      }
    } catch (err) {
      console.error('Error starting chat:', err);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Users className="w-12 h-12" />
            <div>
              <h1 className="text-3xl font-bold">Friends</h1>
              <p className="text-blue-100 mt-1">
                Connect with other pickleball players
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveTab('friends')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              activeTab === 'friends'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Users className="w-5 h-5" />
            Friends
            {friends.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'friends' ? 'bg-blue-500' : 'bg-gray-200'
              }`}>
                {friends.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Clock className="w-5 h-5" />
            Pending Requests
            {pendingRequests.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-red-500 text-white">
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              activeTab === 'search'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <UserPlus className="w-5 h-5" />
            Find Friends
          </button>
        </div>

        {/* Friends List Tab */}
        {activeTab === 'friends' && (
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">My Friends</h2>
              <p className="text-gray-500 text-sm mt-1">
                Your pickleball connections
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
              </div>
            ) : friends.length > 0 ? (
              <div className="divide-y">
                {friends.map(friend => (
                  <div
                    key={friend.id}
                    onClick={() => setProfileModalUserId(friend.friendUserId || friend.id)}
                    className="block p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {friend.profileImageUrl ? (
                          <img
                            src={getSharedAssetUrl(friend.profileImageUrl)}
                            alt={friend.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="w-6 h-6 text-blue-600" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-medium text-gray-900">{friend.name}</h3>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Calendar className="w-4 h-4" />
                            <span>Friends since {formatDate(friend.friendsSince)}</span>
                          </div>
                          {friend.experienceLevel && (
                            <span className="text-xs text-blue-600 font-medium">
                              {friend.experienceLevel}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleStartChat(friend.friendUserId || friend.id, e)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Send message"
                        >
                          <MessageCircle className="w-5 h-5" />
                        </button>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Friends Yet</h3>
                <p className="text-gray-500 mb-6">
                  Start connecting with other pickleball players!
                </p>
                <button
                  onClick={() => setActiveTab('search')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  <UserPlus className="w-5 h-5" />
                  Find Friends
                </button>
              </div>
            )}
          </div>
        )}

        {/* Pending Requests Tab */}
        {activeTab === 'pending' && (
          <div className="space-y-6">
            {/* Incoming Requests */}
            <div className="bg-white rounded-xl shadow-sm">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-900">Friend Requests</h2>
                <p className="text-gray-500 text-sm mt-1">
                  People who want to connect with you
                </p>
              </div>

              {pendingRequests.length > 0 ? (
                <div className="divide-y">
                  {pendingRequests.map(request => (
                    <div key={request.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div
                          onClick={() => setProfileModalUserId(request.sender.id)}
                          className="flex items-center gap-4 hover:opacity-80 transition-opacity cursor-pointer"
                        >
                          {request.sender.profileImageUrl ? (
                            <img
                              src={getSharedAssetUrl(request.sender.profileImageUrl)}
                              alt={request.sender.name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="w-6 h-6 text-blue-600" />
                            </div>
                          )}
                          <div>
                            <h3 className="font-medium text-gray-900">{request.sender.name}</h3>
                            <p className="text-sm text-gray-500">
                              Sent {formatDate(request.createdAt)}
                            </p>
                            {request.sender.experienceLevel && (
                              <span className="text-xs text-blue-600 font-medium">
                                {request.sender.experienceLevel}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setProfileModalUserId(request.sender.id)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="View Profile"
                          >
                            <ExternalLink className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleAcceptRequest(request.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                            title="Accept"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleRejectRequest(request.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Reject"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  No pending friend requests
                </div>
              )}
            </div>

            {/* Sent Requests */}
            <div className="bg-white rounded-xl shadow-sm">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Sent Requests</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Requests you've sent that are awaiting response
                </p>
              </div>

              {sentRequests.length > 0 ? (
                <div className="divide-y">
                  {sentRequests.map(request => (
                    <div key={request.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div
                          onClick={() => setProfileModalUserId(request.recipient.id)}
                          className="flex items-center gap-4 hover:opacity-80 transition-opacity cursor-pointer"
                        >
                          {request.recipient.profileImageUrl ? (
                            <img
                              src={getSharedAssetUrl(request.recipient.profileImageUrl)}
                              alt={request.recipient.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                              <User className="w-5 h-5 text-gray-500" />
                            </div>
                          )}
                          <div>
                            <h3 className="font-medium text-gray-900">{request.recipient.name}</h3>
                            <p className="text-sm text-gray-500">
                              Sent {formatDate(request.createdAt)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCancelRequest(request.id)}
                          className="text-sm text-gray-500 hover:text-red-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  No pending sent requests
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Find Players</h2>
              <p className="text-gray-500 text-sm mt-1">
                Search for players to connect with
              </p>
            </div>

            <div className="p-6">
              {/* Search Form */}
              <form onSubmit={handleSearch} className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      placeholder="Enter first name..."
                      value={searchFilters.firstName}
                      onChange={(e) => handleFilterChange('firstName', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      placeholder="Enter last name..."
                      value={searchFilters.lastName}
                      onChange={(e) => handleFilterChange('lastName', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      placeholder="Enter city..."
                      value={searchFilters.city}
                      onChange={(e) => handleFilterChange('city', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      placeholder="Enter state..."
                      value={searchFilters.state}
                      onChange={(e) => handleFilterChange('state', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="Enter exact email..."
                      value={searchFilters.email}
                      onChange={(e) => handleFilterChange('email', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      placeholder="Enter phone number..."
                      value={searchFilters.phone}
                      onChange={(e) => handleFilterChange('phone', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={searching}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Search className="w-4 h-4" />
                    {searching ? 'Searching...' : 'Search'}
                  </button>
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Clear
                  </button>
                </div>
              </form>

              {/* Search Results */}
              {searching ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                </div>
              ) : hasSearched && searchResults.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No players found matching your search criteria
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 mb-3">Found {searchResults.length} player(s)</p>
                  {searchResults.map(player => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div
                        onClick={() => setProfileModalUserId(player.id)}
                        className="flex items-center gap-4 hover:opacity-80 transition-opacity cursor-pointer"
                      >
                        {player.profileImageUrl ? (
                          <img
                            src={getSharedAssetUrl(player.profileImageUrl)}
                            alt={player.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="w-6 h-6 text-blue-600" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-medium text-gray-900">{player.name}</h3>
                          {player.experienceLevel && (
                            <span className="text-sm text-blue-600">
                              {player.experienceLevel}
                            </span>
                          )}
                          {player.location && (
                            <p className="text-sm text-gray-500">{player.location}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setProfileModalUserId(player.id)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="View Profile"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </button>
                        {player.isFriend ? (
                          <span className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium">
                            <Check className="w-4 h-4" />
                            Friends
                          </span>
                        ) : player.hasPendingRequest ? (
                          <span className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg font-medium">
                            <Clock className="w-4 h-4" />
                            Pending
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSendRequest(player.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                          >
                            <UserPlus className="w-4 h-4" />
                            Add Friend
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>Enter search criteria and click Search to find players</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Friend Detail Modal */}
      {selectedFriend && (
        <FriendDetailModal
          friend={selectedFriend}
          onClose={() => setSelectedFriend(null)}
        />
      )}

      {/* User Preview Modal */}
      {previewUser && (
        <UserPreviewModal
          user={previewUser}
          onClose={() => setPreviewUser(null)}
          onAccept={handleAcceptRequest}
          onReject={handleRejectRequest}
          pendingRequestId={pendingRequests.find(r => r.sender.id === previewUser.id)?.id}
        />
      )}

      {/* Public Profile Modal */}
      {profileModalUserId && (
        <PublicProfileModal
          userId={profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
          onFriendshipChange={loadFriendsData}
        />
      )}
    </div>
  );
}

function FriendDetailModal({ friend, onClose }) {
  const [gameHistory, setGameHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGameHistory();
  }, [friend.id]);

  const loadGameHistory = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const history = await friendsApi.getGameHistory(friend.id);
      // setGameHistory(history);
      setGameHistory([]);
    } catch (err) {
      console.error('Error loading game history:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">Friend Details</h2>
          <div className="w-9"></div>
        </div>

        <div className="p-6">
          {/* Profile Header */}
          <div className="text-center mb-6">
            {friend.profileImageUrl ? (
              <img
                src={getSharedAssetUrl(friend.profileImageUrl)}
                alt={friend.name}
                className="w-24 h-24 rounded-full object-cover mx-auto mb-4"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <User className="w-12 h-12 text-blue-600" />
              </div>
            )}
            <h3 className="text-xl font-semibold text-gray-900">{friend.name}</h3>
            {friend.experienceLevel && (
              <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                {friend.experienceLevel}
              </span>
            )}
            <p className="text-gray-500 mt-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Friends since {formatDate(friend.friendsSince)}
            </p>
          </div>

          {/* Player Info */}
          {(friend.playingStyle || friend.experienceLevel || friend.location) && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-gray-900 mb-3">Player Info</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {friend.experienceLevel && (
                  <div>
                    <p className="text-gray-500">Experience</p>
                    <p className="font-medium">{friend.experienceLevel}</p>
                  </div>
                )}
                {friend.playingStyle && (
                  <div>
                    <p className="text-gray-500">Playing Style</p>
                    <p className="font-medium">{friend.playingStyle}</p>
                  </div>
                )}
                {friend.location && (
                  <div>
                    <p className="text-gray-500">Location</p>
                    <p className="font-medium">{friend.location}</p>
                  </div>
                )}
                {friend.paddleBrand && (
                  <div>
                    <p className="text-gray-500">Paddle</p>
                    <p className="font-medium">{friend.paddleBrand}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Game History */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Gamepad2 className="w-5 h-5" />
              Game History
            </h4>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-600"></div>
              </div>
            ) : gameHistory.length > 0 ? (
              <div className="space-y-3">
                {gameHistory.map((game, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{game.type}</p>
                        <p className="text-sm text-gray-500">{formatDate(game.date)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${game.won ? 'text-green-600' : 'text-red-600'}`}>
                          {game.won ? 'Won' : 'Lost'}
                        </p>
                        <p className="text-sm text-gray-500">{game.score}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <Gamepad2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p>No games played together yet</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <Link
              to={`/profile/${friend.id}`}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium text-center hover:bg-blue-700"
            >
              View Full Profile
            </Link>
            <button className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              <MessageCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserPreviewModal({ user, onClose, onAccept, onReject, pendingRequestId }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6">
          {/* Profile Preview */}
          <div className="text-center mb-6">
            {user.profileImageUrl ? (
              <img
                src={getSharedAssetUrl(user.profileImageUrl)}
                alt={user.name}
                className="w-20 h-20 rounded-full object-cover mx-auto mb-4"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 text-blue-600" />
              </div>
            )}
            <h3 className="text-xl font-semibold text-gray-900">{user.name}</h3>
            {user.skillLevel && (
              <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                Level {user.skillLevel}
              </span>
            )}
          </div>

          {/* Quick Info */}
          {(user.experienceLevel || user.playingStyle || user.location) && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {user.experienceLevel && (
                  <div>
                    <p className="text-gray-500">Experience</p>
                    <p className="font-medium">{user.experienceLevel}</p>
                  </div>
                )}
                {user.playingStyle && (
                  <div>
                    <p className="text-gray-500">Style</p>
                    <p className="font-medium">{user.playingStyle}</p>
                  </div>
                )}
                {user.location && (
                  <div className="col-span-2">
                    <p className="text-gray-500">Location</p>
                    <p className="font-medium">{user.location}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          {pendingRequestId ? (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  onAccept(pendingRequestId);
                  onClose();
                }}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Accept Request
              </button>
              <button
                onClick={() => {
                  onReject(pendingRequestId);
                  onClose();
                }}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                Decline
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
