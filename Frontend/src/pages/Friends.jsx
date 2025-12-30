import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserPlus, Search, Check, X, Clock, MessageCircle,
  User, Calendar, ChevronRight, ArrowLeft, Gamepad2
} from 'lucide-react';
import Navigation from '../components/ui/Navigation';
import { useAuth } from '../contexts/AuthContext';
import { friendsApi, getAssetUrl } from '../services/api';

export default function Friends() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [previewUser, setPreviewUser] = useState(null);

  useEffect(() => {
    loadFriendsData();
  }, []);

  const loadFriendsData = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API calls when backend is ready
      // const [friendsRes, pendingRes, sentRes] = await Promise.all([
      //   friendsApi.getFriends(),
      //   friendsApi.getPendingRequests(),
      //   friendsApi.getSentRequests()
      // ]);
      // setFriends(friendsRes);
      // setPendingRequests(pendingRes);
      // setSentRequests(sentRes);

      // Placeholder data
      setFriends([]);
      setPendingRequests([]);
      setSentRequests([]);
    } catch (err) {
      console.error('Error loading friends data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      // TODO: Replace with actual API call
      // const results = await friendsApi.searchPlayers(query);
      // setSearchResults(results);
      setSearchResults([]);
    } catch (err) {
      console.error('Error searching players:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (userId) => {
    try {
      // TODO: Replace with actual API call
      // await friendsApi.sendRequest(userId);
      console.log('Sending friend request to:', userId);
      // Refresh data
      loadFriendsData();
      // Remove from search results
      setSearchResults(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      console.error('Error sending friend request:', err);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      // TODO: Replace with actual API call
      // await friendsApi.acceptRequest(requestId);
      console.log('Accepting request:', requestId);
      loadFriendsData();
    } catch (err) {
      console.error('Error accepting request:', err);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      // TODO: Replace with actual API call
      // await friendsApi.rejectRequest(requestId);
      console.log('Rejecting request:', requestId);
      loadFriendsData();
    } catch (err) {
      console.error('Error rejecting request:', err);
    }
  };

  const handleCancelRequest = async (requestId) => {
    try {
      // TODO: Replace with actual API call
      // await friendsApi.cancelRequest(requestId);
      console.log('Cancelling request:', requestId);
      loadFriendsData();
    } catch (err) {
      console.error('Error cancelling request:', err);
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
      <Navigation />

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
                    className="p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedFriend(friend)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {friend.profileImageUrl ? (
                          <img
                            src={getAssetUrl(friend.profileImageUrl)}
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
                          {friend.skillLevel && (
                            <span className="text-xs text-blue-600 font-medium">
                              Level {friend.skillLevel}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
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
                          className="flex items-center gap-4 cursor-pointer"
                          onClick={() => setPreviewUser(request.sender)}
                        >
                          {request.sender.profileImageUrl ? (
                            <img
                              src={getAssetUrl(request.sender.profileImageUrl)}
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
                            {request.sender.skillLevel && (
                              <span className="text-xs text-blue-600 font-medium">
                                Level {request.sender.skillLevel}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPreviewUser(request.sender)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="View Profile"
                          >
                            <User className="w-5 h-5" />
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
                        <div className="flex items-center gap-4">
                          {request.recipient.profileImageUrl ? (
                            <img
                              src={getAssetUrl(request.recipient.profileImageUrl)}
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
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {searching ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                </div>
              ) : searchQuery.length >= 2 && searchResults.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No players found matching "{searchQuery}"
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-3">
                  {searchResults.map(player => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        {player.profileImageUrl ? (
                          <img
                            src={getAssetUrl(player.profileImageUrl)}
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
                          {player.skillLevel && (
                            <span className="text-sm text-blue-600">
                              Level {player.skillLevel}
                            </span>
                          )}
                          {player.location && (
                            <p className="text-sm text-gray-500">{player.location}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleSendRequest(player.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                      >
                        <UserPlus className="w-4 h-4" />
                        Add Friend
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>Enter a name or email to search for players</p>
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
                src={getAssetUrl(friend.profileImageUrl)}
                alt={friend.name}
                className="w-24 h-24 rounded-full object-cover mx-auto mb-4"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <User className="w-12 h-12 text-blue-600" />
              </div>
            )}
            <h3 className="text-xl font-semibold text-gray-900">{friend.name}</h3>
            {friend.skillLevel && (
              <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                Level {friend.skillLevel}
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
                src={getAssetUrl(user.profileImageUrl)}
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
