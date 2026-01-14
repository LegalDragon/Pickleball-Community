import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronUp,
  HelpCircle, Eye, EyeOff, Search, Filter, FolderOpen
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { helpApi } from '../services/api';
import HelpIcon, { clearHelpCache } from '../components/ui/HelpIcon';

export default function HelpTopicsAdmin({ embedded = false }) {
  const { user } = useAuth();
  const [topics, setTopics] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedCategories, setExpandedCategories] = useState({});

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [formData, setFormData] = useState({
    topicCode: '',
    title: '',
    content: '',
    category: '',
    sortOrder: 0,
    isActive: true
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTopics();
    loadCategories();
  }, [showInactive, categoryFilter]);

  const loadTopics = async () => {
    setLoading(true);
    try {
      const response = await helpApi.getAll(categoryFilter !== 'all' ? categoryFilter : null);
      if (response.success) {
        let data = response.data || [];
        if (!showInactive) {
          data = data.filter(t => t.isActive);
        }
        setTopics(data);

        // Group by category and expand all
        const cats = [...new Set(data.map(t => t.category).filter(Boolean))];
        const expanded = {};
        cats.forEach(c => { expanded[c] = true; });
        expanded['Uncategorized'] = true;
        setExpandedCategories(expanded);
      }
    } catch (err) {
      console.error('Error loading help topics:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await helpApi.getCategories();
      if (response.success) {
        setCategories(response.data || []);
      }
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Group topics by category
  const groupedTopics = topics.reduce((acc, topic) => {
    const cat = topic.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(topic);
    return acc;
  }, {});

  // Sort categories
  const sortedCategories = Object.keys(groupedTopics).sort((a, b) => {
    if (a === 'Uncategorized') return 1;
    if (b === 'Uncategorized') return -1;
    return a.localeCompare(b);
  });

  // Filter topics by search term
  const filteredCategories = sortedCategories.map(cat => ({
    name: cat,
    topics: groupedTopics[cat].filter(t =>
      t.topicCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.content?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(cat => cat.topics.length > 0);

  // CRUD handlers
  const handleCreate = () => {
    setEditingTopic(null);
    setFormData({
      topicCode: '',
      title: '',
      content: '',
      category: categoryFilter !== 'all' ? categoryFilter : '',
      sortOrder: topics.length,
      isActive: true
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleEdit = (topic) => {
    setEditingTopic(topic);
    setFormData({
      topicCode: topic.topicCode,
      title: topic.title || '',
      content: topic.content || '',
      category: topic.category || '',
      sortOrder: topic.sortOrder,
      isActive: topic.isActive
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.topicCode.trim() || !formData.content.trim()) {
      setError('Topic code and content are required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editingTopic) {
        const response = await helpApi.update(editingTopic.id, {
          title: formData.title,
          content: formData.content,
          category: formData.category || null,
          sortOrder: formData.sortOrder,
          isActive: formData.isActive
        });
        if (response.success) {
          setTopics(topics.map(t =>
            t.id === editingTopic.id ? response.data : t
          ));
          setIsModalOpen(false);
          clearHelpCache(); // Clear cache so changes appear immediately
        } else {
          setError(response.message || 'Failed to update topic');
        }
      } else {
        const response = await helpApi.create(formData);
        if (response.success) {
          setTopics([...topics, response.data]);
          setIsModalOpen(false);
          clearHelpCache();
        } else {
          setError(response.message || 'Failed to create topic');
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (topic) => {
    if (!confirm(`Are you sure you want to delete "${topic.topicCode}"?`)) return;
    try {
      const response = await helpApi.delete(topic.id);
      if (response.success) {
        if (showInactive) {
          setTopics(topics.map(t =>
            t.id === topic.id ? { ...t, isActive: false } : t
          ));
        } else {
          setTopics(topics.filter(t => t.id !== topic.id));
        }
        clearHelpCache();
      }
    } catch (err) {
      console.error('Error deleting topic:', err);
    }
  };

  const handleToggleActive = async (topic) => {
    try {
      const response = await helpApi.update(topic.id, {
        isActive: !topic.isActive
      });
      if (response.success) {
        if (!showInactive && topic.isActive) {
          // If hiding inactive and we're deactivating, remove from list
          setTopics(topics.filter(t => t.id !== topic.id));
        } else {
          setTopics(topics.map(t =>
            t.id === topic.id ? response.data : t
          ));
        }
        clearHelpCache();
      }
    } catch (err) {
      console.error('Error toggling topic:', err);
    }
  };

  if (user?.role !== 'Admin') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
          <Link to="/" className="mt-4 inline-block text-green-600 hover:underline">Return to Home</Link>
        </div>
      </div>
    );
  }

  const content = (
    <>
      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search topics..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              Show inactive
            </label>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 flex items-center gap-4 text-sm text-gray-500">
          <span>{topics.length} topics</span>
          <span>{filteredCategories.length} categories</span>
          <span>{topics.filter(t => t.isActive).length} active</span>
        </div>

        {/* Topics List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <HelpCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Help Topics Found</h3>
            <p className="text-gray-500 mb-6">
              {searchTerm ? 'No topics match your search.' : 'Get started by adding your first help topic.'}
            </p>
            {!searchTerm && (
              <button
                onClick={handleCreate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Plus className="w-5 h-5" />
                Add Help Topic
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCategories.map(({ name: category, topics: categoryTopics }) => (
              <div
                key={category}
                className="bg-white rounded-xl shadow-sm overflow-hidden"
              >
                {/* Category Header */}
                <div className="flex items-center justify-between p-4 bg-gray-50 border-b">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white">
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{category}</div>
                      <div className="text-xs text-gray-500">
                        {categoryTopics.length} topic{categoryTopics.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    {expandedCategories[category] ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </div>

                {/* Topics */}
                {expandedCategories[category] && (
                  <div className="divide-y divide-gray-100">
                    {categoryTopics.sort((a, b) => a.sortOrder - b.sortOrder).map(topic => (
                      <div
                        key={topic.id}
                        className={`p-4 hover:bg-gray-50 ${!topic.isActive ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded text-blue-700">
                                {topic.topicCode}
                              </code>
                              {!topic.isActive && (
                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                                  Inactive
                                </span>
                              )}
                            </div>
                            {topic.title && (
                              <div className="font-medium text-gray-900 mb-1">{topic.title}</div>
                            )}
                            <div className="text-sm text-gray-600 line-clamp-2">
                              {topic.content?.substring(0, 150)}
                              {topic.content?.length > 150 && '...'}
                            </div>
                            <div className="text-xs text-gray-400 mt-2">
                              Order: {topic.sortOrder}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleActive(topic)}
                              className={`p-2 rounded-lg ${
                                topic.isActive
                                  ? 'text-green-600 hover:bg-green-50'
                                  : 'text-gray-400 hover:bg-gray-100'
                              }`}
                              title={topic.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {topic.isActive ? (
                                <Eye className="w-4 h-4" />
                              ) : (
                                <EyeOff className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleEdit(topic)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(topic)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingTopic ? 'Edit Help Topic' : 'Add Help Topic'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Topic Code * <span className="text-gray-400 font-normal">(unique identifier)</span>
                </label>
                <input
                  type="text"
                  value={formData.topicCode}
                  onChange={(e) => setFormData({ ...formData, topicCode: e.target.value })}
                  placeholder="e.g., division.gamesPerMatch"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                  required
                  disabled={!!editingTopic}
                />
                {editingTopic && (
                  <p className="mt-1 text-xs text-gray-500">Topic code cannot be changed after creation</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Games per Match"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Events"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    list="category-suggestions"
                  />
                  <datalist id="category-suggestions">
                    {categories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content * <span className="text-gray-400 font-normal">(supports **bold**, *italic*, and - lists)</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Write help content here. Use **text** for bold, *text* for italic, and start lines with - for bullet points."
                  rows={10}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                  required
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Active (visible in UI)</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.topicCode.trim() || !formData.content.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editingTopic ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  Help Topics
                  <HelpIcon topicCode="admin.helpTopics" size="sm" />
                </h1>
                <p className="text-sm text-gray-500">Manage contextual help content throughout the app</p>
              </div>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-5 h-5" />
              Add Topic
            </button>
          </div>
        </div>
      </div>

      {content}
    </div>
  );
}
