import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronUp, MessageSquare, Bug, Lightbulb, User, HelpCircle, Filter, RefreshCw, Eye, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { feedbackApi } from '../services/api';

const COLOR_OPTIONS = [
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'gray', label: 'Gray', class: 'bg-gray-500' }
];

const STATUS_OPTIONS = [
  { value: 'New', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'InProgress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'Resolved', label: 'Resolved', color: 'bg-green-100 text-green-800' },
  { value: 'Closed', label: 'Closed', color: 'bg-gray-100 text-gray-800' }
];

const iconMap = {
  Bug: Bug,
  Lightbulb: Lightbulb,
  MessageSquare: MessageSquare,
  User: User,
  HelpCircle: HelpCircle
};

export default function FeedbackAdmin({ embedded = false }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('entries');
  const [categories, setCategories] = useState([]);
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filtering
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [viewingEntry, setViewingEntry] = useState(null);

  // Form data
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    icon: 'MessageSquare',
    color: 'blue',
    sortOrder: 0,
    isActive: true
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'entries') {
      loadEntries();
    }
  }, [filterCategory, filterStatus, page]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadCategories(), loadEntries(), loadStats()]);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await feedbackApi.getAllCategories();
      if (response.success) {
        setCategories(response.data || []);
      }
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadEntries = async () => {
    try {
      const params = { page, pageSize: 20 };
      if (filterCategory) params.categoryId = filterCategory;
      if (filterStatus) params.status = filterStatus;

      const response = await feedbackApi.getEntries(params);
      if (response.success) {
        setEntries(response.data || []);
        setTotalPages(response.totalPages || 1);
      }
    } catch (err) {
      console.error('Error loading entries:', err);
    }
  };

  const loadStats = async () => {
    try {
      const response = await feedbackApi.getStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  // Category CRUD
  const handleOpenCategoryModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description || '',
        icon: category.icon || 'MessageSquare',
        color: category.color || 'blue',
        sortOrder: category.sortOrder || 0,
        isActive: category.isActive
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: '',
        description: '',
        icon: 'MessageSquare',
        color: 'blue',
        sortOrder: categories.length,
        isActive: true
      });
    }
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) return;

    setSaving(true);
    try {
      if (editingCategory) {
        await feedbackApi.updateCategory(editingCategory.id, categoryForm);
      } else {
        await feedbackApi.createCategory(categoryForm);
      }
      await loadCategories();
      setShowCategoryModal(false);
    } catch (err) {
      console.error('Error saving category:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      await feedbackApi.deleteCategory(id);
      await loadCategories();
    } catch (err) {
      console.error('Error deleting category:', err);
    }
  };

  // Entry management
  const handleViewEntry = (entry) => {
    setViewingEntry(entry);
    setShowEntryModal(true);
  };

  const handleUpdateEntryStatus = async (entryId, status) => {
    try {
      await feedbackApi.updateEntry(entryId, { status });
      await loadEntries();
      await loadStats();
      if (viewingEntry?.id === entryId) {
        setViewingEntry(prev => ({ ...prev, status }));
      }
    } catch (err) {
      console.error('Error updating entry:', err);
    }
  };

  const handleSaveEntryNotes = async () => {
    if (!viewingEntry) return;

    setSaving(true);
    try {
      await feedbackApi.updateEntry(viewingEntry.id, {
        status: viewingEntry.status,
        adminNotes: viewingEntry.adminNotes
      });
      await loadEntries();
      setShowEntryModal(false);
    } catch (err) {
      console.error('Error saving notes:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (id) => {
    if (!confirm('Are you sure you want to delete this feedback?')) return;

    try {
      await feedbackApi.deleteEntry(id);
      await loadEntries();
      await loadStats();
      setShowEntryModal(false);
    } catch (err) {
      console.error('Error deleting entry:', err);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusOption = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusOption.color}`}>
        {statusOption.label}
      </span>
    );
  };

  const content = (
    <>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-500">Total</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.newCount}</div>
              <div className="text-sm text-gray-500">New</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-yellow-200 p-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.inProgressCount}</div>
              <div className="text-sm text-gray-500">In Progress</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-green-200 p-4">
              <div className="text-2xl font-bold text-green-600">{stats.resolvedCount}</div>
              <div className="text-sm text-gray-500">Resolved</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-600">{stats.closedCount}</div>
              <div className="text-sm text-gray-500">Closed</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('entries')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'entries'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Feedback Entries
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'categories'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Categories
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : activeTab === 'entries' ? (
          /* Entries Tab */
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Filters */}
            <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={filterCategory}
                  onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Statuses</option>
                  {STATUS_OPTIONS.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Entries List */}
            <div className="divide-y divide-gray-200">
              {entries.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No feedback entries found</p>
                </div>
              ) : (
                entries.map(entry => (
                  <div
                    key={entry.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleViewEntry(entry)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 truncate">{entry.subject}</span>
                          {getStatusBadge(entry.status)}
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-2 mb-2">{entry.message}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span>{entry.categoryName}</span>
                          <span>{entry.userEmail || entry.userName || 'Anonymous'}</span>
                          <span>{formatDate(entry.createdAt)}</span>
                        </div>
                      </div>
                      <Eye className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Categories Tab */
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-semibold text-gray-900">Feedback Categories</h2>
              <button
                onClick={() => handleOpenCategoryModal()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Category
              </button>
            </div>

            <div className="divide-y divide-gray-200">
              {categories.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No categories created yet</p>
                </div>
              ) : (
                categories.map(category => {
                  const IconComponent = iconMap[category.icon] || MessageSquare;
                  const colorClass = COLOR_OPTIONS.find(c => c.value === category.color)?.class || 'bg-blue-500';

                  return (
                    <div key={category.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 ${colorClass} rounded-lg flex items-center justify-center text-white`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{category.name}</span>
                            {!category.isActive && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">Inactive</span>
                            )}
                          </div>
                          {category.description && (
                            <p className="text-sm text-gray-500">{category.description}</p>
                          )}
                          <span className="text-xs text-gray-400">{category.entryCount || 0} entries</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenCategoryModal(category)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h3>
              <button onClick={() => setShowCategoryModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Bug Report"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Brief description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setCategoryForm(prev => ({ ...prev, color: color.value }))}
                      className={`w-8 h-8 rounded-lg ${color.class} ${
                        categoryForm.color === color.value ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={categoryForm.isActive}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategory}
                disabled={saving || !categoryForm.name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entry View Modal */}
      {showEntryModal && viewingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="font-semibold text-gray-900">Feedback Details</h3>
              <button onClick={() => setShowEntryModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{viewingEntry.categoryName}</span>
                {getStatusBadge(viewingEntry.status)}
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 text-lg">{viewingEntry.subject}</h4>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700 whitespace-pre-wrap">{viewingEntry.message}</p>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>From: {viewingEntry.userName || viewingEntry.userEmail || 'Anonymous'}</span>
                {viewingEntry.userEmail && <span>({viewingEntry.userEmail})</span>}
              </div>

              <div className="text-sm text-gray-400">
                Submitted: {formatDate(viewingEntry.createdAt)}
              </div>

              {/* Status Update */}
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Update Status</label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map(status => (
                    <button
                      key={status.value}
                      onClick={() => handleUpdateEntryStatus(viewingEntry.id, status.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        viewingEntry.status === status.value
                          ? status.color + ' ring-2 ring-offset-1'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Admin Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes</label>
                <textarea
                  value={viewingEntry.adminNotes || ''}
                  onChange={(e) => setViewingEntry(prev => ({ ...prev, adminNotes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                  rows={3}
                  placeholder="Internal notes about this feedback..."
                />
              </div>
            </div>
            <div className="flex justify-between gap-3 p-4 border-t border-gray-200 sticky bottom-0 bg-white">
              <button
                onClick={() => handleDeleteEntry(viewingEntry.id)}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEntryModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Close
                </button>
                <button
                  onClick={handleSaveEntryNotes}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin/dashboard" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Feedback Management</h1>
                <p className="text-gray-500 text-sm">Manage feedback categories and view submissions</p>
              </div>
            </div>
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {content}
    </div>
  );
}
