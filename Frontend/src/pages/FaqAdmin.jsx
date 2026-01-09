import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronUp, FolderPlus, HelpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { faqApi } from '../services/api';

const COLOR_OPTIONS = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
  { value: 'teal', label: 'Teal', class: 'bg-teal-500' }
];

export default function FaqAdmin({ embedded = false }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});

  // Category modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryFormData, setCategoryFormData] = useState({
    name: '', description: '', icon: '', color: 'blue', sortOrder: 0, isActive: true
  });

  // Entry modal
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [entryFormData, setEntryFormData] = useState({
    categoryId: '', question: '', answer: '', sortOrder: 0, isActive: true
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFaq();
  }, [showInactive]);

  const loadFaq = async () => {
    setLoading(true);
    try {
      const response = await faqApi.getAllCategories();
      if (response.success) {
        let data = response.data || [];
        if (!showInactive) {
          data = data.filter(c => c.isActive).map(c => ({
            ...c,
            entries: c.entries.filter(e => e.isActive)
          }));
        }
        setCategories(data);
        // Expand all categories by default
        const expanded = {};
        data.forEach(c => { expanded[c.id] = true; });
        setExpandedCategories(expanded);
      }
    } catch (err) {
      console.error('Error loading FAQ:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  // Category CRUD
  const handleCreateCategory = () => {
    setEditingCategory(null);
    setCategoryFormData({
      name: '', description: '', icon: '', color: 'blue',
      sortOrder: categories.length, isActive: true
    });
    setError('');
    setIsCategoryModalOpen(true);
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name,
      description: category.description || '',
      icon: category.icon || '',
      color: category.color || 'blue',
      sortOrder: category.sortOrder,
      isActive: category.isActive
    });
    setError('');
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryFormData.name.trim()) return;

    setSaving(true);
    setError('');
    try {
      if (editingCategory) {
        const response = await faqApi.updateCategory(editingCategory.id, categoryFormData);
        if (response.success) {
          setCategories(categories.map(c =>
            c.id === editingCategory.id ? { ...response.data, entries: c.entries } : c
          ));
          setIsCategoryModalOpen(false);
        } else {
          setError(response.message || 'Failed to update category');
        }
      } else {
        const response = await faqApi.createCategory(categoryFormData);
        if (response.success) {
          setCategories([...categories, response.data]);
          setIsCategoryModalOpen(false);
        } else {
          setError(response.message || 'Failed to create category');
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (category) => {
    if (!confirm(`Are you sure you want to delete "${category.name}" and all its entries?`)) return;
    try {
      const response = await faqApi.deleteCategory(category.id);
      if (response.success) {
        if (showInactive) {
          setCategories(categories.map(c =>
            c.id === category.id ? { ...c, isActive: false } : c
          ));
        } else {
          setCategories(categories.filter(c => c.id !== category.id));
        }
      }
    } catch (err) {
      console.error('Error deleting category:', err);
    }
  };

  // Entry CRUD
  const handleCreateEntry = (categoryId) => {
    setEditingEntry(null);
    const category = categories.find(c => c.id === categoryId);
    setEntryFormData({
      categoryId: categoryId,
      question: '', answer: '',
      sortOrder: category?.entries?.length || 0,
      isActive: true
    });
    setError('');
    setIsEntryModalOpen(true);
  };

  const handleEditEntry = (entry) => {
    setEditingEntry(entry);
    setEntryFormData({
      categoryId: entry.categoryId,
      question: entry.question,
      answer: entry.answer,
      sortOrder: entry.sortOrder,
      isActive: entry.isActive
    });
    setError('');
    setIsEntryModalOpen(true);
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!entryFormData.question.trim() || !entryFormData.answer.trim()) return;

    setSaving(true);
    setError('');
    try {
      if (editingEntry) {
        const response = await faqApi.updateEntry(editingEntry.id, entryFormData);
        if (response.success) {
          setCategories(categories.map(c => ({
            ...c,
            entries: c.entries.map(e =>
              e.id === editingEntry.id ? response.data : e
            )
          })));
          setIsEntryModalOpen(false);
        } else {
          setError(response.message || 'Failed to update entry');
        }
      } else {
        const response = await faqApi.createEntry(entryFormData);
        if (response.success) {
          setCategories(categories.map(c =>
            c.id === entryFormData.categoryId
              ? { ...c, entries: [...c.entries, response.data] }
              : c
          ));
          setIsEntryModalOpen(false);
        } else {
          setError(response.message || 'Failed to create entry');
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entry) => {
    if (!confirm('Are you sure you want to delete this FAQ entry?')) return;
    try {
      const response = await faqApi.deleteEntry(entry.id);
      if (response.success) {
        setCategories(categories.map(c => ({
          ...c,
          entries: showInactive
            ? c.entries.map(e => e.id === entry.id ? { ...e, isActive: false } : e)
            : c.entries.filter(e => e.id !== entry.id)
        })));
      }
    } catch (err) {
      console.error('Error deleting entry:', err);
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
        <div className="mb-6 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Show inactive items
          </label>
          <span className="text-sm text-gray-500">
            {categories.length} categories, {categories.reduce((sum, c) => sum + c.entries.length, 0)} entries
          </span>
        </div>

        {/* Categories List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <HelpCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No FAQ Categories</h3>
            <p className="text-gray-500 mb-6">Get started by adding your first FAQ category.</p>
            <button
              onClick={handleCreateCategory}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <FolderPlus className="w-5 h-5" />
              Add Category
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {categories.map(category => (
              <div
                key={category.id}
                className={`bg-white rounded-xl shadow-sm overflow-hidden ${!category.isActive ? 'opacity-60' : ''}`}
              >
                {/* Category Header */}
                <div className="flex items-center justify-between p-4 bg-gray-50 border-b">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <div className={`w-8 h-8 rounded-lg ${COLOR_OPTIONS.find(c => c.value === category.color)?.class || 'bg-blue-500'} flex items-center justify-center text-white`}>
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{category.name}</div>
                      <div className="text-xs text-gray-500">
                        {category.entries.length} entries • Order: {category.sortOrder}
                        {!category.isActive && ' • Inactive'}
                      </div>
                    </div>
                    {expandedCategories[category.id] ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleCreateEntry(category.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                      title="Add Entry"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEditCategory(category)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Edit Category"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {category.isActive && (
                      <button
                        onClick={() => handleDeleteCategory(category)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete Category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Entries */}
                {expandedCategories[category.id] && (
                  <div className="divide-y divide-gray-100">
                    {category.entries.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        No entries in this category.
                        <button
                          onClick={() => handleCreateEntry(category.id)}
                          className="ml-2 text-green-600 hover:underline"
                        >
                          Add one
                        </button>
                      </div>
                    ) : (
                      category.entries.map(entry => (
                        <div
                          key={entry.id}
                          className={`p-4 hover:bg-gray-50 ${!entry.isActive ? 'opacity-60' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 mb-1">{entry.question}</div>
                              <div className="text-sm text-gray-600 line-clamp-2">{entry.answer}</div>
                              <div className="text-xs text-gray-400 mt-1">
                                Order: {entry.sortOrder}
                                {!entry.isActive && ' • Inactive'}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEditEntry(entry)}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {entry.isActive && (
                                <button
                                  onClick={() => handleDeleteEntry(entry)}
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h2>
              <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  placeholder="e.g., Getting Started"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  placeholder="Brief description..."
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setCategoryFormData({ ...categoryFormData, color: option.value })}
                      className={`w-8 h-8 rounded-lg ${option.class} transition-all flex items-center justify-center ${
                        categoryFormData.color === option.value ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'
                      }`}
                    >
                      {categoryFormData.color === option.value && <span className="text-white text-sm font-bold">✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={categoryFormData.sortOrder}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, sortOrder: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={categoryFormData.isActive}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, isActive: e.target.checked })}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !categoryFormData.name.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div> : <Save className="w-4 h-4" />}
                  {editingCategory ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Entry Modal */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingEntry ? 'Edit FAQ Entry' : 'Add FAQ Entry'}
              </h2>
              <button onClick={() => setIsEntryModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEntry} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={entryFormData.categoryId}
                  onChange={(e) => setEntryFormData({ ...entryFormData, categoryId: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Select category...</option>
                  {categories.filter(c => c.isActive).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question *</label>
                <input
                  type="text"
                  value={entryFormData.question}
                  onChange={(e) => setEntryFormData({ ...entryFormData, question: e.target.value })}
                  placeholder="What is the question?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Answer *</label>
                <textarea
                  value={entryFormData.answer}
                  onChange={(e) => setEntryFormData({ ...entryFormData, answer: e.target.value })}
                  placeholder="Provide a helpful answer..."
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={entryFormData.sortOrder}
                    onChange={(e) => setEntryFormData({ ...entryFormData, sortOrder: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={entryFormData.isActive}
                      onChange={(e) => setEntryFormData({ ...entryFormData, isActive: e.target.checked })}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button type="button" onClick={() => setIsEntryModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !entryFormData.question.trim() || !entryFormData.answer.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div> : <Save className="w-4 h-4" />}
                  {editingEntry ? 'Update' : 'Create'}
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
                <h1 className="text-2xl font-bold text-gray-900">FAQ Management</h1>
                <p className="text-sm text-gray-500">Manage FAQ categories and entries</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                to="/faq"
                target="_blank"
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Preview
              </Link>
              <button
                onClick={handleCreateCategory}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <FolderPlus className="w-5 h-5" />
                Add Category
              </button>
            </div>
          </div>
        </div>
      </div>

      {content}
    </div>
  );
}
