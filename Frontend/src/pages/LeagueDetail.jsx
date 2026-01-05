import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Building2, ChevronRight, Users, MapPin, Globe, Mail, ExternalLink,
  Shield, Crown, Plus, Settings, Edit, Network, Loader2, ArrowLeft,
  Check, X, UserPlus, Building, Clock, AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { leaguesApi, getSharedAssetUrl } from '../services/api';
import PublicProfileModal from '../components/ui/PublicProfileModal';

// Scope icons and colors
const SCOPE_CONFIG = {
  National: { icon: Globe, color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200' },
  Regional: { icon: Network, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
  State: { icon: Building2, color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' },
  District: { icon: Building, color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-200' },
  Local: { icon: MapPin, color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-200' }
};

const getScopeConfig = (scope) => SCOPE_CONFIG[scope] || SCOPE_CONFIG.Local;

// Manager role colors
const ROLE_COLORS = {
  Admin: 'bg-purple-100 text-purple-700',
  President: 'bg-blue-100 text-blue-700',
  'Vice President': 'bg-blue-100 text-blue-700',
  Director: 'bg-green-100 text-green-700',
  Secretary: 'bg-yellow-100 text-yellow-700',
  Treasurer: 'bg-orange-100 text-orange-700',
  Moderator: 'bg-gray-100 text-gray-700'
};

// Add Manager Modal
function AddManagerModal({ isOpen, onClose, onAdd, loading }) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('Admin');
  const [title, setTitle] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd({ userId: parseInt(userId), role, title: title || null });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Add Manager</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
            <input
              type="number"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Enter user ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="Admin">Admin</option>
              <option value="President">President</option>
              <option value="Vice President">Vice President</option>
              <option value="Director">Director</option>
              <option value="Secretary">Secretary</option>
              <option value="Treasurer">Treasurer</option>
              <option value="Moderator">Moderator</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Regional Director - Southeast"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !userId}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Manager'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LeagueDetail() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [profileModalUserId, setProfileModalUserId] = useState(null);
  const [showAddManager, setShowAddManager] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadLeague();
  }, [id]);

  const loadLeague = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await leaguesApi.getLeague(id);
      if (response.success) {
        setLeague(response.data);
      } else {
        setError(response.message || 'Failed to load league');
      }
    } catch (err) {
      console.error('Error loading league:', err);
      setError('Failed to load league');
    } finally {
      setLoading(false);
    }
  };

  const handleAddManager = async (data) => {
    try {
      setActionLoading(true);
      const response = await leaguesApi.addManager(id, data);
      if (response.success) {
        setShowAddManager(false);
        loadLeague(); // Refresh
      } else {
        alert(response.message || 'Failed to add manager');
      }
    } catch (err) {
      console.error('Error adding manager:', err);
      alert('Failed to add manager');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveManager = async (managerId) => {
    if (!confirm('Are you sure you want to remove this manager?')) return;

    try {
      setActionLoading(true);
      const response = await leaguesApi.removeManager(id, managerId);
      if (response.success) {
        loadLeague();
      } else {
        alert(response.message || 'Failed to remove manager');
      }
    } catch (err) {
      console.error('Error removing manager:', err);
      alert('Failed to remove manager');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProcessRequest = async (requestId, approve) => {
    try {
      setActionLoading(true);
      const response = await leaguesApi.processRequest(id, requestId, approve);
      if (response.success) {
        loadLeague();
      } else {
        alert(response.message || 'Failed to process request');
      }
    } catch (err) {
      console.error('Error processing request:', err);
      alert('Failed to process request');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">League Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'The league you are looking for does not exist.'}</p>
          <button
            onClick={() => navigate('/leagues')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Leagues
          </button>
        </div>
      </div>
    );
  }

  const config = getScopeConfig(league.scope);
  const ScopeIcon = config.icon;
  const canManage = league.canManage;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with banner */}
      <div className="bg-white border-b border-gray-200">
        {league.bannerUrl && (
          <div className="h-48 bg-gradient-to-r from-blue-600 to-purple-600 overflow-hidden">
            <img
              src={getSharedAssetUrl(league.bannerUrl)}
              alt=""
              className="w-full h-full object-cover opacity-80"
            />
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Breadcrumbs */}
          {league.breadcrumbs && league.breadcrumbs.length > 0 && (
            <nav className="flex items-center gap-2 text-sm mb-4">
              <Link to="/leagues" className="text-blue-600 hover:underline">Leagues</Link>
              {league.breadcrumbs.map((crumb, index) => (
                <span key={crumb.id} className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  {index === league.breadcrumbs.length - 1 ? (
                    <span className="text-gray-600">{crumb.name}</span>
                  ) : (
                    <Link to={`/leagues/${crumb.id}`} className="text-blue-600 hover:underline">
                      {crumb.name}
                    </Link>
                  )}
                </span>
              ))}
            </nav>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {league.avatarUrl ? (
              <img
                src={getSharedAssetUrl(league.avatarUrl)}
                alt={league.name}
                className="w-20 h-20 rounded-xl object-cover shadow-md"
              />
            ) : (
              <div className={`w-20 h-20 rounded-xl ${config.bg} flex items-center justify-center shadow-md`}>
                <ScopeIcon className={`w-10 h-10 ${config.color}`} />
              </div>
            )}

            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{league.name}</h1>
                <span className={`text-sm px-3 py-1 rounded-full ${config.bg} ${config.color} font-medium`}>
                  {league.scope}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600">
                {league.state && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {league.state}{league.region && `, ${league.region}`}
                  </span>
                )}
                {league.website && (
                  <a
                    href={league.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Website
                  </a>
                )}
                {league.contactEmail && (
                  <a
                    href={`mailto:${league.contactEmail}`}
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <Mail className="w-4 h-4" />
                    Contact
                  </a>
                )}
              </div>
            </div>

            {canManage && (
              <button
                onClick={() => navigate(`/leagues/${id}/edit`)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Settings className="w-4 h-4" />
                Manage
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-gray-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{league.childLeagueCount || 0}</div>
              <div className="text-sm text-gray-500">Sub-Leagues</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{league.clubCount || 0}</div>
              <div className="text-sm text-gray-500">Clubs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{league.managerCount || 0}</div>
              <div className="text-sm text-gray-500">Managers</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-6 overflow-x-auto">
            {['overview', 'sub-leagues', 'clubs', 'managers', ...(canManage && league.pendingRequests?.length > 0 ? ['requests'] : [])].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-1 border-b-2 text-sm font-medium whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
                {tab === 'requests' && league.pendingRequests?.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
                    {league.pendingRequests.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {league.description && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-3">About</h2>
                <p className="text-gray-600 whitespace-pre-wrap">{league.description}</p>
              </div>
            )}

            {/* Quick stats cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {league.childLeagues && league.childLeagues.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Network className="w-5 h-5 text-blue-600" />
                    Sub-Leagues
                  </h3>
                  <div className="space-y-2">
                    {league.childLeagues.slice(0, 5).map(child => (
                      <Link
                        key={child.id}
                        to={`/leagues/${child.id}`}
                        className="block text-sm text-blue-600 hover:underline truncate"
                      >
                        {child.name}
                      </Link>
                    ))}
                    {league.childLeagues.length > 5 && (
                      <button
                        onClick={() => setActiveTab('sub-leagues')}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        +{league.childLeagues.length - 5} more
                      </button>
                    )}
                  </div>
                </div>
              )}

              {league.clubs && league.clubs.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5 text-green-600" />
                    Member Clubs
                  </h3>
                  <div className="space-y-2">
                    {league.clubs.slice(0, 5).map(club => (
                      <Link
                        key={club.id}
                        to={`/clubs?id=${club.clubId}`}
                        className="block text-sm text-blue-600 hover:underline truncate"
                      >
                        {club.clubName}
                      </Link>
                    ))}
                    {league.clubs.length > 5 && (
                      <button
                        onClick={() => setActiveTab('clubs')}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        +{league.clubs.length - 5} more
                      </button>
                    )}
                  </div>
                </div>
              )}

              {league.managers && league.managers.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-purple-600" />
                    Leadership
                  </h3>
                  <div className="space-y-2">
                    {league.managers.slice(0, 5).map(manager => (
                      <div key={manager.id} className="flex items-center gap-2 text-sm">
                        <span className="text-gray-900">{manager.userName}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${ROLE_COLORS[manager.role] || 'bg-gray-100 text-gray-700'}`}>
                          {manager.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sub-Leagues Tab */}
        {activeTab === 'sub-leagues' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Sub-Leagues</h2>
            </div>
            {league.childLeagues && league.childLeagues.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {league.childLeagues.map(child => {
                  const childConfig = getScopeConfig(child.scope);
                  const ChildIcon = childConfig.icon;
                  return (
                    <Link
                      key={child.id}
                      to={`/leagues/${child.id}`}
                      className="flex items-center gap-4 p-4 hover:bg-gray-50"
                    >
                      {child.avatarUrl ? (
                        <img
                          src={getSharedAssetUrl(child.avatarUrl)}
                          alt={child.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className={`w-12 h-12 rounded-lg ${childConfig.bg} flex items-center justify-center`}>
                          <ChildIcon className={`w-6 h-6 ${childConfig.color}`} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">{child.name}</div>
                        <div className="text-sm text-gray-500">{child.scope}</div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Network className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No sub-leagues</p>
              </div>
            )}
          </div>
        )}

        {/* Clubs Tab */}
        {activeTab === 'clubs' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Member Clubs</h2>
            </div>
            {league.clubs && league.clubs.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {league.clubs.map(club => (
                  <Link
                    key={club.id}
                    to={`/clubs?id=${club.clubId}`}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50"
                  >
                    {club.clubLogoUrl ? (
                      <img
                        src={getSharedAssetUrl(club.clubLogoUrl)}
                        alt={club.clubName}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Users className="w-6 h-6 text-blue-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{club.clubName}</div>
                      <div className="text-sm text-gray-500">
                        {club.clubCity && club.clubState && `${club.clubCity}, ${club.clubState}`}
                        {club.clubMemberCount > 0 && ` • ${club.clubMemberCount} members`}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      club.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {club.status}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No member clubs yet</p>
              </div>
            )}
          </div>
        )}

        {/* Managers Tab */}
        {activeTab === 'managers' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Managers</h2>
              {canManage && (
                <button
                  onClick={() => setShowAddManager(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Manager
                </button>
              )}
            </div>
            {league.managers && league.managers.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {league.managers.map(manager => (
                  <div key={manager.id} className="flex items-center gap-4 p-4">
                    <button
                      onClick={() => setProfileModalUserId(manager.userId)}
                      className="flex-shrink-0"
                    >
                      {manager.userProfileImageUrl ? (
                        <img
                          src={getSharedAssetUrl(manager.userProfileImageUrl)}
                          alt={manager.userName}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                          <Users className="w-6 h-6 text-gray-500" />
                        </div>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => setProfileModalUserId(manager.userId)}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        {manager.userName}
                      </button>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded text-xs ${ROLE_COLORS[manager.role] || 'bg-gray-100 text-gray-700'}`}>
                          {manager.role}
                        </span>
                        {manager.title && (
                          <span className="text-sm text-gray-500">{manager.title}</span>
                        )}
                      </div>
                    </div>
                    {canManage && manager.userId !== user?.id && (
                      <button
                        onClick={() => handleRemoveManager(manager.id)}
                        disabled={actionLoading}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Remove manager"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No managers assigned</p>
              </div>
            )}
          </div>
        )}

        {/* Pending Requests Tab (managers only) */}
        {activeTab === 'requests' && canManage && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Pending Club Requests</h2>
            </div>
            {league.pendingRequests && league.pendingRequests.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {league.pendingRequests.map(request => (
                  <div key={request.id} className="p-4">
                    <div className="flex items-start gap-4">
                      {request.clubLogoUrl ? (
                        <img
                          src={getSharedAssetUrl(request.clubLogoUrl)}
                          alt={request.clubName}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Users className="w-6 h-6 text-blue-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">{request.clubName}</div>
                        <div className="text-sm text-gray-500">
                          {request.clubCity && request.clubState && `${request.clubCity}, ${request.clubState}`}
                        </div>
                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Requested by {request.requestedByName}
                        </div>
                        {request.message && (
                          <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                            "{request.message}"
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleProcessRequest(request.id, true)}
                          disabled={actionLoading}
                          className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                          title="Approve"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleProcessRequest(request.id, false)}
                          disabled={actionLoading}
                          className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
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
                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No pending requests</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddManagerModal
        isOpen={showAddManager}
        onClose={() => setShowAddManager(false)}
        onAdd={handleAddManager}
        loading={actionLoading}
      />

      {profileModalUserId && (
        <PublicProfileModal
          userId={profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
        />
      )}
    </div>
  );
}
