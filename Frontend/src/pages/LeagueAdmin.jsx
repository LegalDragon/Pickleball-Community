import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, Plus, Search, Edit, Trash2, ChevronRight, ChevronDown,
  Users, MapPin, Globe, Network, Shield, Check, X, Loader2,
  AlertCircle, Building, Clock, Save, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { leaguesApi, getAssetUrl, getSharedAssetUrl } from '../services/api';
import PublicProfileModal from '../components/ui/PublicProfileModal';

// Scope config
const SCOPE_OPTIONS = ['National', 'Regional', 'State', 'District', 'Local'];
const SCOPE_CONFIG = {
  National: { icon: Globe, color: 'text-purple-600', bg: 'bg-purple-100' },
  Regional: { icon: Network, color: 'text-blue-600', bg: 'bg-blue-100' },
  State: { icon: Building2, color: 'text-green-600', bg: 'bg-green-100' },
  District: { icon: Building, color: 'text-orange-600', bg: 'bg-orange-100' },
  Local: { icon: MapPin, color: 'text-gray-600', bg: 'bg-gray-100' }
};

const MANAGER_ROLES = ['Admin', 'President', 'Vice President', 'Director', 'Secretary', 'Treasurer', 'Moderator'];

export default function LeagueAdmin({ embedded = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // List view state
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');

  // Detail/Edit state
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    scope: 'Local',
    parentLeagueId: '',
    state: '',
    region: '',
    country: 'USA',
    website: '',
    contactEmail: ''
  });

  // Manager modal
  const [showAddManager, setShowAddManager] = useState(false);
  const [managerData, setManagerData] = useState({ userId: '', role: 'Admin', title: '' });
  const [addingManager, setAddingManager] = useState(false);

  // Request processing
  const [processingRequest, setProcessingRequest] = useState(null);

  // Profile modal
  const [profileModalUserId, setProfileModalUserId] = useState(null);

  useEffect(() => {
    loadLeagues();
  }, []);

  const loadLeagues = async () => {
    setLoading(true);
    try {
      const response = await leaguesApi.search({ pageSize: 100, query: searchQuery, scope: scopeFilter });
      if (response.success) {
        setLeagues(response.data?.items || []);
      }
    } catch (err) {
      console.error('Error loading leagues:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLeagueDetail = async (id) => {
    try {
      const response = await leaguesApi.getLeague(id);
      if (response.success) {
        setSelectedLeague(response.data);
        setFormData({
          name: response.data.name || '',
          description: response.data.description || '',
          scope: response.data.scope || 'Local',
          parentLeagueId: response.data.parentLeagueId || '',
          state: response.data.state || '',
          region: response.data.region || '',
          country: response.data.country || 'USA',
          website: response.data.website || '',
          contactEmail: response.data.contactEmail || ''
        });
      }
    } catch (err) {
      console.error('Error loading league:', err);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadLeagues();
  };

  const handleCreateNew = () => {
    setSelectedLeague(null);
    setIsCreating(true);
    setFormData({
      name: '',
      description: '',
      scope: 'Local',
      parentLeagueId: '',
      state: '',
      region: '',
      country: 'USA',
      website: '',
      contactEmail: ''
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('League name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        parentLeagueId: formData.parentLeagueId ? parseInt(formData.parentLeagueId) : null
      };

      let response;
      if (isCreating) {
        response = await leaguesApi.create(payload);
      } else {
        response = await leaguesApi.update(selectedLeague.id, payload);
      }

      if (response.success) {
        setIsCreating(false);
        if (response.data?.id) {
          loadLeagueDetail(response.data.id);
        } else {
          setSelectedLeague(null);
        }
        loadLeagues();
      } else {
        alert(response.message || 'Failed to save league');
      }
    } catch (err) {
      console.error('Error saving league:', err);
      alert('Failed to save league');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedLeague) return;
    if (!confirm(`Are you sure you want to delete "${selectedLeague.name}"?`)) return;

    try {
      const response = await leaguesApi.delete(selectedLeague.id);
      if (response.success) {
        setSelectedLeague(null);
        loadLeagues();
      } else {
        alert(response.message || 'Failed to delete league');
      }
    } catch (err) {
      console.error('Error deleting league:', err);
      alert('Failed to delete league');
    }
  };

  const handleAddManager = async () => {
    if (!managerData.userId) return;
    setAddingManager(true);
    try {
      const response = await leaguesApi.addManager(selectedLeague.id, {
        userId: parseInt(managerData.userId),
        role: managerData.role,
        title: managerData.title || null
      });
      if (response.success) {
        setShowAddManager(false);
        setManagerData({ userId: '', role: 'Admin', title: '' });
        loadLeagueDetail(selectedLeague.id);
      } else {
        alert(response.message || 'Failed to add manager');
      }
    } catch (err) {
      console.error('Error adding manager:', err);
      alert('Failed to add manager');
    } finally {
      setAddingManager(false);
    }
  };

  const handleRemoveManager = async (managerId) => {
    if (!confirm('Remove this manager?')) return;
    try {
      const response = await leaguesApi.removeManager(selectedLeague.id, managerId);
      if (response.success) {
        loadLeagueDetail(selectedLeague.id);
      }
    } catch (err) {
      console.error('Error removing manager:', err);
    }
  };

  const handleProcessRequest = async (requestId, approve) => {
    setProcessingRequest(requestId);
    try {
      const response = await leaguesApi.processRequest(selectedLeague.id, requestId, approve);
      if (response.success) {
        loadLeagueDetail(selectedLeague.id);
      }
    } catch (err) {
      console.error('Error processing request:', err);
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRemoveClub = async (membershipId) => {
    if (!confirm('Remove this club from the league?')) return;
    try {
      const response = await leaguesApi.removeClub(selectedLeague.id, membershipId);
      if (response.success) {
        loadLeagueDetail(selectedLeague.id);
      }
    } catch (err) {
      console.error('Error removing club:', err);
    }
  };

  // Get available parent leagues (exclude current and children)
  const availableParentLeagues = leagues.filter(l =>
    !selectedLeague || (l.id !== selectedLeague.id)
  );

  // Main content - used in both embedded and standalone modes
  const content = (
    <>
      {/* Header for embedded mode */}
      {embedded && (
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-indigo-600" />
            League Management
          </h2>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            Create League
          </button>
        </div>
      )}

      <div className="flex gap-6">
          {/* Left Panel - League List */}
          <div className="w-1/3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search leagues..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <select
                    value={scopeFilter}
                    onChange={(e) => { setScopeFilter(e.target.value); }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">All</option>
                    {SCOPE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </form>
              </div>

              <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : leagues.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Building2 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p>No leagues found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {leagues.map(league => {
                      const config = SCOPE_CONFIG[league.scope] || SCOPE_CONFIG.Local;
                      const Icon = config.icon;
                      const isSelected = selectedLeague?.id === league.id;
                      return (
                        <button
                          key={league.id}
                          onClick={() => { setIsCreating(false); loadLeagueDetail(league.id); }}
                          className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 ${
                            isSelected ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
                          }`}
                        >
                          <div className={`p-2 rounded-lg ${config.bg}`}>
                            <Icon className={`w-4 h-4 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">{league.name}</div>
                            <div className="text-xs text-gray-500">{league.scope}</div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Detail/Edit */}
          <div className="flex-1">
            {!selectedLeague && !isCreating ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a League</h3>
                <p className="text-gray-500 mb-4">Choose a league from the list or create a new one</p>
                <button
                  onClick={handleCreateNew}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  Create New League
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* League Form */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {isCreating ? 'Create New League' : 'Edit League'}
                    </h2>
                    {!isCreating && (
                      <button
                        onClick={handleDelete}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete league"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">League Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2"
                        placeholder="e.g., USA Pickleball"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg p-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Scope/Level *</label>
                      <select
                        value={formData.scope}
                        onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2"
                      >
                        {SCOPE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Parent League</label>
                      <select
                        value={formData.parentLeagueId}
                        onChange={(e) => setFormData({ ...formData, parentLeagueId: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2"
                      >
                        <option value="">None (Top Level)</option>
                        {availableParentLeagues.map(l => (
                          <option key={l.id} value={l.id}>{l.name} ({l.scope})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2"
                        placeholder="e.g., California"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                      <input
                        type="text"
                        value={formData.region}
                        onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2"
                        placeholder="e.g., Western"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2"
                        placeholder="https://..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                      <input
                        type="email"
                        value={formData.contactEmail}
                        onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => { setSelectedLeague(null); setIsCreating(false); }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {isCreating ? 'Create League' : 'Save Changes'}
                    </button>
                  </div>
                </div>

                {/* Managers Section (only for existing leagues) */}
                {!isCreating && selectedLeague && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-indigo-600" />
                        Managers
                      </h3>
                      <button
                        onClick={() => setShowAddManager(true)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </button>
                    </div>

                    {selectedLeague.managers?.length > 0 ? (
                      <div className="space-y-2">
                        {selectedLeague.managers.map(manager => (
                          <div key={manager.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <button onClick={() => setProfileModalUserId(manager.userId)}>
                                {manager.userProfileImageUrl ? (
                                  <img src={getSharedAssetUrl(manager.userProfileImageUrl)} alt="" className="w-10 h-10 rounded-full object-cover" />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-gray-500" />
                                  </div>
                                )}
                              </button>
                              <div>
                                <div className="font-medium text-gray-900">{manager.userName}</div>
                                <div className="text-sm text-gray-500">
                                  {manager.role}
                                  {manager.title && ` - ${manager.title}`}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveManager(manager.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No managers assigned yet</p>
                    )}
                  </div>
                )}

                {/* Pending Requests */}
                {!isCreating && selectedLeague?.pendingRequests?.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-orange-600" />
                      Pending Club Requests
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                        {selectedLeague.pendingRequests.length}
                      </span>
                    </h3>

                    <div className="space-y-3">
                      {selectedLeague.pendingRequests.map(request => (
                        <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium text-gray-900">{request.clubName}</div>
                            <div className="text-sm text-gray-500">
                              Requested by {request.requestedByName}
                            </div>
                            {request.message && (
                              <p className="text-sm text-gray-600 mt-1 italic">"{request.message}"</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleProcessRequest(request.id, true)}
                              disabled={processingRequest === request.id}
                              className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleProcessRequest(request.id, false)}
                              disabled={processingRequest === request.id}
                              className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Member Clubs */}
                {!isCreating && selectedLeague?.clubs?.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-600" />
                      Member Clubs
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                        {selectedLeague.clubs.length}
                      </span>
                    </h3>

                    <div className="space-y-2">
                      {selectedLeague.clubs.map(club => (
                        <div key={club.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium text-gray-900">{club.clubName}</div>
                            <div className="text-sm text-gray-500">
                              {club.clubCity && club.clubState && `${club.clubCity}, ${club.clubState}`}
                              {club.clubMemberCount > 0 && ` • ${club.clubMemberCount} members`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              club.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {club.status}
                            </span>
                            <button
                              onClick={() => handleRemoveClub(club.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Remove from league"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      {/* Add Manager Modal */}
      {showAddManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Add Manager</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID *</label>
                <input
                  type="number"
                  value={managerData.userId}
                  onChange={(e) => setManagerData({ ...managerData, userId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2"
                  placeholder="Enter user ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={managerData.role}
                  onChange={(e) => setManagerData({ ...managerData, role: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2"
                >
                  {MANAGER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title (optional)</label>
                <input
                  type="text"
                  value={managerData.title}
                  onChange={(e) => setManagerData({ ...managerData, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2"
                  placeholder="e.g., Regional Director"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddManager(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddManager}
                  disabled={!managerData.userId || addingManager}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {addingManager ? 'Adding...' : 'Add Manager'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {profileModalUserId && (
        <PublicProfileModal
          userId={profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
        />
      )}
    </>
  );

  // Return embedded or standalone version
  if (embedded) {
    return content;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header for standalone mode */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin/dashboard" className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Building2 className="w-7 h-7 text-indigo-600" />
                  League Management
                </h1>
                <p className="text-gray-600 mt-1">Manage leagues, hierarchy, and club memberships</p>
              </div>
            </div>
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              Create League
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {content}
      </div>
    </div>
  );
}
