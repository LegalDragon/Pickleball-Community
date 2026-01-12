import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Building2, ChevronRight, Users, MapPin, Globe, Mail, ExternalLink,
  Shield, Crown, Plus, Edit, Network, Loader2, ArrowLeft,
  Check, X, UserPlus, Building, Clock, AlertCircle, FileText, Download,
  Upload, DollarSign, TrendingUp, TrendingDown, RefreshCw, Eye, EyeOff, Trash2,
  Paperclip, ChevronDown, ChevronUp, Image
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { leaguesApi, sharedAssetApi, grantsApi, getSharedAssetUrl } from '../services/api';
import PublicProfileModal from '../components/ui/PublicProfileModal';

// Format file size helper
const formatFileSize = (bytes) => {
  if (!bytes) return '';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

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

  // Document management state
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

  // Transaction attachments state
  const [expandedTransactionId, setExpandedTransactionId] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentDescription, setAttachmentDescription] = useState('');

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
        response = await leaguesApi.updateDocument(id, editingDocument.id, documentData);
      } else {
        response = await leaguesApi.addDocument(id, documentData);
      }

      if (response.success) {
        setShowDocumentModal(false);
        loadLeague();
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
      const response = await leaguesApi.deleteDocument(id, docId);
      if (response.success) {
        loadLeague();
      }
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  // Grants handlers
  const loadGrantsData = async () => {
    if (!league) return;
    setGrantsLoading(true);
    try {
      const permRes = await grantsApi.getPermissions();
      if (permRes.success) {
        setGrantPermissions(permRes.data);
      }

      const [accountsRes, summaryRes, transactionsRes, clubsRes] = await Promise.all([
        grantsApi.getAccounts({ leagueId: league.id }),
        grantsApi.getAccountSummary(league.id),
        grantsApi.getTransactions({ leagueId: league.id, pageSize: 20 }),
        grantsApi.getClubs(league.id)
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

  const handleCreateTransaction = async () => {
    if (!transactionData.clubId || !transactionData.amount) {
      alert('Club and amount are required');
      return;
    }

    setSavingTransaction(true);
    try {
      const payload = {
        clubId: parseInt(transactionData.clubId),
        leagueId: league.id,
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
        loadGrantsData();
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

  const handleVoidTransaction = async (transactionId) => {
    const reason = prompt('Enter reason for voiding this transaction:');
    if (!reason) return;

    try {
      const response = await grantsApi.voidTransaction(transactionId, reason);
      if (response.success) {
        loadGrantsData();
      } else {
        alert(response.message || 'Failed to void transaction');
      }
    } catch (err) {
      console.error('Error voiding transaction:', err);
      alert('Failed to void transaction');
    }
  };

  // Attachment handlers
  const handleAttachmentUpload = async (transactionId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAttachment(true);
    try {
      // Upload file to shared asset service
      const assetType = sharedAssetApi.getAssetType(file);
      const uploadRes = await sharedAssetApi.upload(file, assetType, 'grant-attachment');

      if (uploadRes.data?.url) {
        // Add attachment to transaction
        const attachmentData = {
          fileName: file.name,
          fileUrl: uploadRes.data.url,
          fileType: file.type,
          fileSize: file.size,
          description: attachmentDescription || null
        };

        const response = await grantsApi.addTransactionAttachment(transactionId, attachmentData);
        if (response.success) {
          setAttachmentDescription('');
          loadGrantsData(); // Refresh to show new attachment
        } else {
          alert(response.message || 'Failed to add attachment');
        }
      }
    } catch (err) {
      console.error('Error uploading attachment:', err);
      alert('Failed to upload attachment');
    } finally {
      setUploadingAttachment(false);
      e.target.value = ''; // Reset file input
    }
  };

  const handleDeleteAttachment = async (transactionId, attachmentId) => {
    if (!confirm('Delete this attachment?')) return;

    try {
      const response = await grantsApi.deleteTransactionAttachment(transactionId, attachmentId);
      if (response.success) {
        loadGrantsData();
      } else {
        alert(response.message || 'Failed to delete attachment');
      }
    } catch (err) {
      console.error('Error deleting attachment:', err);
      alert('Failed to delete attachment');
    }
  };

  const toggleTransactionExpand = (transactionId) => {
    setExpandedTransactionId(prev => prev === transactionId ? null : transactionId);
    setAttachmentDescription('');
  };

  // Load grants data when tab changes to grants
  useEffect(() => {
    if (activeTab === 'grants' && league && league.canManage) {
      loadGrantsData();
    }
  }, [activeTab, league?.id, league?.canManage]);

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
            {['overview', 'sub-leagues', 'clubs', 'managers', 'documents', ...(canManage ? ['grants'] : []), ...(canManage && league.pendingRequests?.length > 0 ? ['requests'] : [])].map(tab => (
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

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Documents
                {league.documents?.length > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {league.documents.length}
                  </span>
                )}
              </h2>
              {canManage && (
                <button
                  onClick={() => openDocumentModal()}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Document
                </button>
              )}
            </div>
            {league.documents && league.documents.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {league.documents.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{doc.title}</span>
                        {!doc.isPublic && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <EyeOff className="w-3 h-3" />
                            Private
                          </span>
                        )}
                      </div>
                      {doc.description && (
                        <div className="text-sm text-gray-500 truncate">{doc.description}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        {doc.fileName && <span>{doc.fileName}</span>}
                        {doc.fileSize && <span className="ml-2">({formatFileSize(doc.fileSize)})</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <a
                        href={getSharedAssetUrl(doc.fileUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      {canManage && (
                        <>
                          <button
                            onClick={() => openDocumentModal(doc)}
                            className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No documents available</p>
                {canManage && (
                  <button
                    onClick={() => openDocumentModal()}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    Add your first document
                  </button>
                )}
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

        {/* Grants Tab (managers only) */}
        {activeTab === 'grants' && canManage && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Grant Management
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => loadGrantsData()}
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
                              <p className="text-xs text-gray-500">{account.leagueName} • {account.transactionCount || 0} transactions</p>
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
                            <th className="w-8"></th>
                            <th className="text-left p-2 font-medium text-gray-700">Date</th>
                            <th className="text-left p-2 font-medium text-gray-700">Club</th>
                            <th className="text-left p-2 font-medium text-gray-700">Type</th>
                            <th className="text-left p-2 font-medium text-gray-700">Description</th>
                            <th className="text-center p-2 font-medium text-gray-700">
                              <Paperclip className="w-4 h-4 mx-auto" />
                            </th>
                            <th className="text-right p-2 font-medium text-gray-700">Amount</th>
                            {grantPermissions?.canVoidTransactions && (
                              <th className="w-10"></th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {grantTransactions.map(tx => (
                            <>
                              <tr key={tx.id} className={`hover:bg-gray-50 ${tx.isVoided ? 'opacity-50 bg-red-50' : ''}`}>
                                <td className="p-2">
                                  <button
                                    onClick={() => toggleTransactionExpand(tx.id)}
                                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                  >
                                    {expandedTransactionId === tx.id ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </button>
                                </td>
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
                                <td className="p-2 text-center">
                                  {tx.attachments?.length > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                      <Paperclip className="w-3 h-3" />
                                      {tx.attachments.length}
                                    </span>
                                  )}
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
                              {/* Expanded row for attachments */}
                              {expandedTransactionId === tx.id && (
                                <tr key={`${tx.id}-attachments`}>
                                  <td colSpan={grantPermissions?.canVoidTransactions ? 8 : 7} className="bg-gray-50 p-4">
                                    <div className="space-y-3">
                                      <h5 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Paperclip className="w-4 h-4" />
                                        Attachments
                                      </h5>

                                      {/* Existing attachments */}
                                      {tx.attachments?.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {tx.attachments.map(attachment => (
                                            <div
                                              key={attachment.id}
                                              className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-200"
                                            >
                                              <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                {attachment.fileType?.startsWith('image/') ? (
                                                  <Image className="w-5 h-5 text-blue-600" />
                                                ) : (
                                                  <FileText className="w-5 h-5 text-blue-600" />
                                                )}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                  {attachment.fileName}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                  {attachment.fileSize && formatFileSize(attachment.fileSize)}
                                                  {attachment.uploadedByName && ` • ${attachment.uploadedByName}`}
                                                </p>
                                                {attachment.description && (
                                                  <p className="text-xs text-gray-600 truncate">{attachment.description}</p>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <a
                                                  href={getSharedAssetUrl(attachment.fileUrl)}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                                                  title="Download"
                                                >
                                                  <Download className="w-4 h-4" />
                                                </a>
                                                <button
                                                  onClick={() => handleDeleteAttachment(tx.id, attachment.id)}
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
                                        <p className="text-sm text-gray-500">No attachments yet</p>
                                      )}

                                      {/* Add attachment section */}
                                      {!tx.isVoided && (
                                        <div className="pt-2 border-t border-gray-200">
                                          <p className="text-xs font-medium text-gray-600 mb-2">Add Attachment</p>
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="text"
                                              placeholder="Description (optional)"
                                              value={attachmentDescription}
                                              onChange={(e) => setAttachmentDescription(e.target.value)}
                                              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                                            />
                                            <label className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer ${uploadingAttachment ? 'opacity-50 cursor-wait' : ''}`}>
                                              {uploadingAttachment ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                              ) : (
                                                <Upload className="w-4 h-4" />
                                              )}
                                              {uploadingAttachment ? 'Uploading...' : 'Upload'}
                                              <input
                                                type="file"
                                                onChange={(e) => handleAttachmentUpload(tx.id, e)}
                                                className="hidden"
                                                disabled={uploadingAttachment}
                                                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                                              />
                                            </label>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
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
                  className="w-4 h-4 text-blue-600 rounded"
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
                      {club.clubName} ({club.leagueName})
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
    </div>
  );
}
