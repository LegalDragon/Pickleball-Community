import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, Plus, Search, Edit, Trash2, ChevronRight, ChevronDown,
  Users, MapPin, Globe, Network, Shield, Check, X, Loader2,
  AlertCircle, Building, Clock, Save, ArrowLeft, ExternalLink,
  Upload, FileText, GripVertical, Eye, EyeOff, Image, DollarSign,
  TrendingUp, TrendingDown, Filter, Calendar, RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { leaguesApi, sharedAssetApi, grantsApi, getAssetUrl, getSharedAssetUrl } from '../services/api';
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

  // Avatar upload
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Document management
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);
  const [documentData, setDocumentData] = useState({
    title: '', description: '', fileUrl: '', fileName: '', fileType: '', fileSize: 0, isPublic: true
  });
  const [savingDocument, setSavingDocument] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);

  // Grants management state
  const [grantAccounts, setGrantAccounts] = useState([]);
  const [grantTransactions, setGrantTransactions] = useState([]);
  const [grantsSummary, setGrantsSummary] = useState(null);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [grantsClubs, setGrantsClubs] = useState([]);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionData, setTransactionData] = useState({
    clubId: '',
    transactionType: 'Credit',
    category: 'Donation',
    amount: '',
    description: '',
    donorName: '',
    donorEmail: '',
    grantPurpose: '',
    feeReason: '',
    notes: ''
  });
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [grantPermissions, setGrantPermissions] = useState(null);

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
        // Load grants data for this league
        loadGrantsData(id);
      }
    } catch (err) {
      console.error('Error loading league:', err);
    }
  };

  // Load grants data for the selected league
  const loadGrantsData = async (leagueId) => {
    setGrantsLoading(true);
    try {
      // Load permissions first
      const permRes = await grantsApi.getPermissions();
      if (permRes.success) {
        setGrantPermissions(permRes.data);
      }

      // Load accounts and summary in parallel
      const [accountsRes, summaryRes, transactionsRes, clubsRes] = await Promise.all([
        grantsApi.getAccounts({ leagueId }),
        grantsApi.getAccountSummary(leagueId),
        grantsApi.getTransactions({ leagueId, pageSize: 20 }),
        grantsApi.getClubs(leagueId)
      ]);

      if (accountsRes.success) {
        setGrantAccounts(accountsRes.data || []);
      }
      if (summaryRes.success) {
        setGrantsSummary(summaryRes.data);
      }
      if (transactionsRes.success) {
        setGrantTransactions(transactionsRes.data?.items || []);
      }
      if (clubsRes.success) {
        setGrantsClubs(clubsRes.data || []);
      }
    } catch (err) {
      console.error('Error loading grants data:', err);
    } finally {
      setGrantsLoading(false);
    }
  };

  // Create a new grant transaction
  const handleCreateTransaction = async () => {
    if (!transactionData.clubId || !transactionData.amount) {
      alert('Club and amount are required');
      return;
    }

    setSavingTransaction(true);
    try {
      const payload = {
        clubId: parseInt(transactionData.clubId),
        leagueId: selectedLeague.id,
        transactionType: transactionData.transactionType,
        category: transactionData.category,
        amount: parseFloat(transactionData.amount),
        description: transactionData.description || null,
        donorName: transactionData.donorName || null,
        donorEmail: transactionData.donorEmail || null,
        grantPurpose: transactionData.grantPurpose || null,
        feeReason: transactionData.feeReason || null,
        notes: transactionData.notes || null
      };

      const response = await grantsApi.createTransaction(payload);
      if (response.success) {
        setShowTransactionModal(false);
        setTransactionData({
          clubId: '',
          transactionType: 'Credit',
          category: 'Donation',
          amount: '',
          description: '',
          donorName: '',
          donorEmail: '',
          grantPurpose: '',
          feeReason: '',
          notes: ''
        });
        // Reload grants data
        loadGrantsData(selectedLeague.id);
      } else {
        alert(response.message || 'Failed to create transaction');
      }
    } catch (err) {
      console.error('Error creating transaction:', err);
      alert('Failed to create transaction');
    } finally {
      setSavingTransaction(false);
    }
  };

  // Void a transaction
  const handleVoidTransaction = async (transactionId) => {
    const reason = prompt('Enter reason for voiding this transaction:');
    if (!reason) return;

    try {
      const response = await grantsApi.voidTransaction(transactionId, reason);
      if (response.success) {
        loadGrantsData(selectedLeague.id);
      } else {
        alert(response.message || 'Failed to void transaction');
      }
    } catch (err) {
      console.error('Error voiding transaction:', err);
      alert('Failed to void transaction');
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

  // Avatar upload handler
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const response = await sharedAssetApi.upload(file, 'image', 'league-avatar');
      if (response.data?.url) {
        await leaguesApi.updateAvatar(selectedLeague.id, response.data.url);
        loadLeagueDetail(selectedLeague.id);
      }
    } catch (err) {
      console.error('Error uploading avatar:', err);
      alert('Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Document handlers
  const openDocumentModal = (doc = null) => {
    if (doc) {
      setEditingDocument(doc);
      setDocumentData({
        title: doc.title || '',
        description: doc.description || '',
        fileUrl: doc.fileUrl || '',
        fileName: doc.fileName || '',
        fileType: doc.fileType || '',
        fileSize: doc.fileSize || 0,
        isPublic: doc.isPublic !== false
      });
    } else {
      setEditingDocument(null);
      setDocumentData({
        title: '', description: '', fileUrl: '', fileName: '', fileType: '', fileSize: 0, isPublic: true
      });
    }
    setShowDocumentModal(true);
  };

  const handleDocumentFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDocument(true);
    try {
      const response = await sharedAssetApi.upload(file, 'document', 'league-document');
      if (response.data?.url) {
        setDocumentData(prev => ({
          ...prev,
          fileUrl: response.data.url,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        }));
      }
    } catch (err) {
      console.error('Error uploading document:', err);
      alert('Failed to upload document');
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleSaveDocument = async () => {
    if (!documentData.title.trim() || !documentData.fileUrl) {
      alert('Title and file are required');
      return;
    }

    setSavingDocument(true);
    try {
      let response;
      if (editingDocument) {
        response = await leaguesApi.updateDocument(selectedLeague.id, editingDocument.id, documentData);
      } else {
        response = await leaguesApi.addDocument(selectedLeague.id, documentData);
      }

      if (response.success) {
        setShowDocumentModal(false);
        loadLeagueDetail(selectedLeague.id);
      } else {
        alert(response.message || 'Failed to save document');
      }
    } catch (err) {
      console.error('Error saving document:', err);
      alert('Failed to save document');
    } finally {
      setSavingDocument(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!confirm('Delete this document?')) return;
    try {
      const response = await leaguesApi.deleteDocument(selectedLeague.id, docId);
      if (response.success) {
        loadLeagueDetail(selectedLeague.id);
      }
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  const handleReorderDocuments = async (docs) => {
    try {
      const documentIds = docs.map(d => d.id);
      await leaguesApi.reorderDocuments(selectedLeague.id, documentIds);
    } catch (err) {
      console.error('Error reordering documents:', err);
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
          <div className="flex items-center gap-3">
            <Link
              to="/leagues/structure"
              target="_blank"
              className="flex items-center gap-2 px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Network className="w-4 h-4" />
              View Structure
              <ExternalLink className="w-3 h-3" />
            </Link>
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              Create League
            </button>
          </div>
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

                  {/* Avatar Section - only for existing leagues */}
                  {!isCreating && selectedLeague && (
                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200">
                      <div className="relative">
                        {selectedLeague.avatarUrl ? (
                          <img
                            src={getSharedAssetUrl(selectedLeague.avatarUrl)}
                            alt={selectedLeague.name}
                            className="w-20 h-20 rounded-lg object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                            <Building2 className="w-10 h-10 text-gray-400" />
                          </div>
                        )}
                        {uploadingAvatar && (
                          <div className="absolute inset-0 bg-white/80 rounded-lg flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">League Avatar</label>
                        <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200">
                          <Image className="w-4 h-4" />
                          <span className="text-sm">Upload Image</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            className="hidden"
                            disabled={uploadingAvatar}
                          />
                        </label>
                        <p className="text-xs text-gray-500 mt-1">Recommended: 200x200px</p>
                      </div>
                    </div>
                  )}

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

                {/* Documents Section */}
                {!isCreating && selectedLeague && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        Documents
                        {selectedLeague.documents?.length > 0 && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                            {selectedLeague.documents.length}
                          </span>
                        )}
                      </h3>
                      <button
                        onClick={() => openDocumentModal()}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4" />
                        Add Document
                      </button>
                    </div>

                    {selectedLeague.documents?.length > 0 ? (
                      <div className="space-y-2">
                        {selectedLeague.documents.map((doc, index) => (
                          <div
                            key={doc.id}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group"
                          >
                            <div className="p-2 bg-blue-100 rounded">
                              <FileText className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 truncate">{doc.title}</span>
                                {!doc.isPublic && (
                                  <span className="flex items-center gap-1 text-xs text-gray-500">
                                    <EyeOff className="w-3 h-3" />
                                    Private
                                  </span>
                                )}
                              </div>
                              {doc.description && (
                                <p className="text-sm text-gray-500 truncate">{doc.description}</p>
                              )}
                              {doc.fileName && (
                                <p className="text-xs text-gray-400">{doc.fileName}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <a
                                href={getSharedAssetUrl(doc.fileUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-gray-500 hover:bg-gray-200 rounded"
                                title="Download"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => openDocumentModal(doc)}
                                className="p-1.5 text-gray-500 hover:bg-gray-200 rounded"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <FileText className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                        <p className="text-sm text-gray-500">No documents yet</p>
                        <button
                          onClick={() => openDocumentModal()}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                        >
                          Add your first document
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Grants Management Section */}
                {!isCreating && selectedLeague && grantPermissions?.isGrantManager && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        Grant Management
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => loadGrantsData(selectedLeague.id)}
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                          title="Refresh"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setShowTransactionModal(true)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          <Plus className="w-4 h-4" />
                          New Transaction
                        </button>
                      </div>
                    </div>

                    {grantsLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                      </div>
                    ) : (
                      <>
                        {/* Summary Cards */}
                        {grantsSummary && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                            <div className="bg-green-50 rounded-lg p-4">
                              <p className="text-sm text-green-700 font-medium">Total Balance</p>
                              <p className="text-2xl font-bold text-green-800">
                                ${(grantsSummary.totalBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-4">
                              <p className="text-sm text-blue-700 font-medium flex items-center gap-1">
                                <TrendingUp className="w-4 h-4" />
                                Total Credits
                              </p>
                              <p className="text-2xl font-bold text-blue-800">
                                ${(grantsSummary.totalCreditsAllTime || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                            <div className="bg-red-50 rounded-lg p-4">
                              <p className="text-sm text-red-700 font-medium flex items-center gap-1">
                                <TrendingDown className="w-4 h-4" />
                                Total Debits
                              </p>
                              <p className="text-2xl font-bold text-red-800">
                                ${(grantsSummary.totalDebitsAllTime || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Club Accounts */}
                        {grantAccounts.length > 0 && (
                          <div className="mb-6">
                            <h4 className="text-sm font-medium text-gray-700 mb-3">Club Accounts</h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {grantAccounts.map(account => (
                                <div key={account.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                      <Building2 className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-900">{account.clubName}</p>
                                      <p className="text-xs text-gray-500">{account.transactionCount} transactions</p>
                                    </div>
                                  </div>
                                  <div className={`text-lg font-bold ${account.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ${account.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recent Transactions */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Transactions</h4>
                          {grantTransactions.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b bg-gray-50">
                                    <th className="text-left p-2 font-medium text-gray-700">Date</th>
                                    <th className="text-left p-2 font-medium text-gray-700">Club</th>
                                    <th className="text-left p-2 font-medium text-gray-700">Type</th>
                                    <th className="text-left p-2 font-medium text-gray-700">Description</th>
                                    <th className="text-right p-2 font-medium text-gray-700">Amount</th>
                                    {grantPermissions?.canVoidTransactions && (
                                      <th className="w-10"></th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {grantTransactions.map(tx => (
                                    <tr key={tx.id} className={`hover:bg-gray-50 ${tx.isVoided ? 'opacity-50 bg-red-50' : ''}`}>
                                      <td className="p-2 text-gray-600 whitespace-nowrap">
                                        {new Date(tx.createdAt).toLocaleDateString()}
                                      </td>
                                      <td className="p-2 font-medium text-gray-900">{tx.clubName}</td>
                                      <td className="p-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                          tx.transactionType === 'Credit'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                        }`}>
                                          {tx.category}
                                        </span>
                                      </td>
                                      <td className="p-2 text-gray-700 max-w-xs truncate">
                                        {tx.description || tx.grantPurpose || tx.feeReason || (tx.donorName ? `From ${tx.donorName}` : '-')}
                                      </td>
                                      <td className={`p-2 text-right font-medium whitespace-nowrap ${
                                        tx.transactionType === 'Credit' ? 'text-green-600' : 'text-red-600'
                                      }`}>
                                        {tx.transactionType === 'Credit' ? '+' : '-'}
                                        ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      {grantPermissions?.canVoidTransactions && (
                                        <td className="p-2">
                                          {!tx.isVoided && (
                                            <button
                                              onClick={() => handleVoidTransaction(tx.id)}
                                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                                              title="Void Transaction"
                                            >
                                              <X className="w-4 h-4" />
                                            </button>
                                          )}
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-center py-6">
                              <DollarSign className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                              <p className="text-sm text-gray-500">No transactions yet</p>
                              <button
                                onClick={() => setShowTransactionModal(true)}
                                className="mt-2 text-sm text-green-600 hover:text-green-800"
                              >
                                Record your first transaction
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
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

      {/* Document Modal */}
      {showDocumentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editingDocument ? 'Edit Document' : 'Add Document'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={documentData.title}
                  onChange={(e) => setDocumentData({ ...documentData, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2"
                  placeholder="e.g., League Rules 2026"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={documentData.description}
                  onChange={(e) => setDocumentData({ ...documentData, description: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg p-2"
                  placeholder="Brief description of this document..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
                {documentData.fileUrl ? (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <FileText className="w-8 h-8 text-blue-600" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{documentData.fileName || 'Uploaded file'}</p>
                      {documentData.fileSize > 0 && (
                        <p className="text-xs text-gray-500">
                          {(documentData.fileSize / 1024).toFixed(1)} KB
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setDocumentData(prev => ({ ...prev, fileUrl: '', fileName: '', fileType: '', fileSize: 0 }))}
                      className="p-1.5 text-gray-500 hover:bg-gray-200 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                    {uploadingDocument ? (
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-gray-400 mb-1" />
                        <span className="text-sm text-gray-500">Click to upload</span>
                      </>
                    )}
                    <input
                      type="file"
                      onChange={handleDocumentFileUpload}
                      className="hidden"
                      disabled={uploadingDocument}
                    />
                  </label>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={documentData.isPublic}
                  onChange={(e) => setDocumentData({ ...documentData, isPublic: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="isPublic" className="text-sm text-gray-700 flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  Publicly visible
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowDocumentModal(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDocument}
                  disabled={!documentData.title || !documentData.fileUrl || savingDocument}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingDocument ? 'Saving...' : (editingDocument ? 'Update' : 'Add Document')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              New Transaction
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Club *</label>
                <select
                  value={transactionData.clubId}
                  onChange={(e) => setTransactionData({ ...transactionData, clubId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2"
                >
                  <option value="">Select a club</option>
                  {grantsClubs.map(club => (
                    <option key={`${club.clubId}-${club.leagueId}`} value={club.clubId}>
                      {club.clubName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select
                    value={transactionData.transactionType}
                    onChange={(e) => setTransactionData({ ...transactionData, transactionType: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  >
                    <option value="Credit">Credit (Add funds)</option>
                    <option value="Debit">Debit (Remove funds)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    value={transactionData.category}
                    onChange={(e) => setTransactionData({ ...transactionData, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  >
                    <option value="Donation">Donation</option>
                    <option value="Grant">Grant</option>
                    <option value="Fee">Fee</option>
                    <option value="Adjustment">Adjustment</option>
                    <option value="Refund">Refund</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={transactionData.amount}
                    onChange={(e) => setTransactionData({ ...transactionData, amount: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2 pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={transactionData.description}
                  onChange={(e) => setTransactionData({ ...transactionData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2"
                  placeholder="Brief description of this transaction"
                />
              </div>

              {/* Conditional fields based on category */}
              {transactionData.category === 'Donation' && (
                <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-medium text-blue-900">Donor Information</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">Donor Name</label>
                      <input
                        type="text"
                        value={transactionData.donorName}
                        onChange={(e) => setTransactionData({ ...transactionData, donorName: e.target.value })}
                        className="w-full border border-blue-200 rounded-lg p-2 text-sm"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">Donor Email</label>
                      <input
                        type="email"
                        value={transactionData.donorEmail}
                        onChange={(e) => setTransactionData({ ...transactionData, donorEmail: e.target.value })}
                        className="w-full border border-blue-200 rounded-lg p-2 text-sm"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>
                </div>
              )}

              {transactionData.category === 'Grant' && (
                <div className="bg-green-50 rounded-lg p-4">
                  <label className="block text-xs font-medium text-green-700 mb-1">Grant Purpose</label>
                  <input
                    type="text"
                    value={transactionData.grantPurpose}
                    onChange={(e) => setTransactionData({ ...transactionData, grantPurpose: e.target.value })}
                    className="w-full border border-green-200 rounded-lg p-2 text-sm"
                    placeholder="What is this grant for?"
                  />
                </div>
              )}

              {transactionData.category === 'Fee' && (
                <div className="bg-red-50 rounded-lg p-4">
                  <label className="block text-xs font-medium text-red-700 mb-1">Fee Reason</label>
                  <input
                    type="text"
                    value={transactionData.feeReason}
                    onChange={(e) => setTransactionData({ ...transactionData, feeReason: e.target.value })}
                    className="w-full border border-red-200 rounded-lg p-2 text-sm"
                    placeholder="Reason for this fee"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (internal)</label>
                <textarea
                  value={transactionData.notes}
                  onChange={(e) => setTransactionData({ ...transactionData, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2 h-20"
                  placeholder="Any additional notes..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowTransactionModal(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTransaction}
                  disabled={!transactionData.clubId || !transactionData.amount || savingTransaction}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {savingTransaction ? 'Creating...' : 'Create Transaction'}
                </button>
              </div>
            </div>
          </div>
        </div>
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
