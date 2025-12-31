import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { blogApi, userApi, getSharedAssetUrl } from '../services/api';
import {
  FileText, Tag, Users, Plus, Edit2, Trash2, X, Save,
  ChevronLeft, ChevronRight, Search, Check, User, AlertCircle,
  Eye, Clock, ArrowUpDown
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function BlogAdmin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('categories');
  const [loading, setLoading] = useState(true);

  // Categories state
  const [categories, setCategories] = useState([]);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Writers state
  const [writers, setWriters] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [showAddWriterModal, setShowAddWriterModal] = useState(false);

  // Posts state
  const [posts, setPosts] = useState([]);
  const [postFilter, setPostFilter] = useState('all'); // all, draft, published, archived

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'categories') {
      loadCategories();
    } else if (activeTab === 'writers') {
      loadWriters();
    } else if (activeTab === 'posts') {
      loadPosts();
    }
  }, [activeTab]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const response = await blogApi.getCategories(false);
      if (response?.success) {
        setCategories(response.data || []);
      }
    } catch (err) {
      console.error('Error loading categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadWriters = async () => {
    setLoading(true);
    try {
      const response = await blogApi.getWriters();
      if (response?.success) {
        setWriters(response.data || []);
      }
    } catch (err) {
      console.error('Error loading writers:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (postFilter !== 'all') {
        params.status = postFilter.charAt(0).toUpperCase() + postFilter.slice(1);
      }
      // Use getAllPosts for admin - includes drafts and archived
      const response = await blogApi.getAllPosts(params);
      if (response?.success) {
        setPosts(response.data?.items || response.data || []);
      }
    } catch (err) {
      console.error('Error loading posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const response = await userApi.getAllUsers();
      if (response?.success) {
        // Filter out users who are already writers
        const writerIds = writers.map(w => w.id);
        setAllUsers((response.data || []).filter(u => !writerIds.includes(u.id)));
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  // Category handlers
  const handleSaveCategory = async (data) => {
    try {
      if (editingCategory?.id) {
        await blogApi.updateCategory(editingCategory.id, data);
      } else {
        await blogApi.createCategory(data);
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      loadCategories();
    } catch (err) {
      console.error('Error saving category:', err);
      alert('Failed to save category. Please try again.');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm('Are you sure you want to delete this category? Posts in this category will become uncategorized.')) return;

    try {
      await blogApi.deleteCategory(id);
      loadCategories();
    } catch (err) {
      console.error('Error deleting category:', err);
      alert('Failed to delete category. Please try again.');
    }
  };

  // Writer handlers
  const handleAddWriter = async (userId) => {
    try {
      await blogApi.addWriter(userId);
      setShowAddWriterModal(false);
      loadWriters();
    } catch (err) {
      console.error('Error adding writer:', err);
      alert('Failed to add writer. Please try again.');
    }
  };

  const handleRemoveWriter = async (userId) => {
    if (!confirm('Are you sure you want to remove this writer? They will no longer be able to create or edit posts.')) return;

    try {
      await blogApi.removeWriter(userId);
      loadWriters();
    } catch (err) {
      console.error('Error removing writer:', err);
      alert('Failed to remove writer. Please try again.');
    }
  };

  // Post handlers
  const handleDeletePost = async (id) => {
    if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) return;

    try {
      await blogApi.deletePost(id);
      loadPosts();
    } catch (err) {
      console.error('Error deleting post:', err);
      alert('Failed to delete post. Please try again.');
    }
  };

  const handlePublishPost = async (id) => {
    try {
      await blogApi.publishPost(id);
      loadPosts();
    } catch (err) {
      console.error('Error publishing post:', err);
      alert('Failed to publish post. Please try again.');
    }
  };

  const handleArchivePost = async (id) => {
    try {
      await blogApi.archivePost(id);
      loadPosts();
    } catch (err) {
      console.error('Error archiving post:', err);
      alert('Failed to archive post. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const tabs = [
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'writers', label: 'Writers', icon: Users },
    { id: 'posts', label: 'All Posts', icon: FileText }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/admin/dashboard" className="p-2 hover:bg-white/10 rounded-lg">
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Blog Management</h1>
              <p className="text-purple-100">Manage categories, writers, and posts</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="flex border-b">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <>
            {/* Categories Tab */}
            {activeTab === 'categories' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Blog Categories</h2>
                  <button
                    onClick={() => {
                      setEditingCategory(null);
                      setShowCategoryModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Add Category
                  </button>
                </div>

                {categories.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Name</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Slug</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Description</th>
                          <th className="text-center py-3 px-4 font-medium text-gray-600">Posts</th>
                          <th className="text-center py-3 px-4 font-medium text-gray-600">Active</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map(cat => (
                          <tr key={cat.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium text-gray-900">{cat.name}</td>
                            <td className="py-3 px-4 text-gray-600">{cat.slug}</td>
                            <td className="py-3 px-4 text-gray-600 max-w-xs truncate">{cat.description || '-'}</td>
                            <td className="py-3 px-4 text-center text-gray-600">{cat.postCount || 0}</td>
                            <td className="py-3 px-4 text-center">
                              {cat.isActive ? (
                                <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                  <Check className="w-3 h-3 mr-1" /> Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => {
                                  setEditingCategory(cat);
                                  setShowCategoryModal(true);
                                }}
                                className="p-2 text-gray-400 hover:text-purple-600 rounded"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="p-2 text-gray-400 hover:text-red-600 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No categories yet. Create one to get started.</p>
                  </div>
                )}
              </div>
            )}

            {/* Writers Tab */}
            {activeTab === 'writers' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Blog Writers</h2>
                  <button
                    onClick={() => {
                      loadAllUsers();
                      setShowAddWriterModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Add Writer
                  </button>
                </div>

                <p className="text-sm text-gray-500 mb-6">
                  Writers can create and manage their own blog posts. Admins can manage all posts.
                </p>

                {writers.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {writers.map(writer => (
                      <div key={writer.id} className="border rounded-lg p-4 flex items-center gap-4">
                        {writer.profileImageUrl ? (
                          <img
                            src={getSharedAssetUrl(writer.profileImageUrl)}
                            alt={writer.firstName}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                            <User className="w-6 h-6 text-purple-600" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {writer.firstName} {writer.lastName}
                          </p>
                          <p className="text-sm text-gray-500 truncate">{writer.email}</p>
                          <p className="text-xs text-gray-400">{writer.postCount || 0} posts</p>
                        </div>
                        <button
                          onClick={() => handleRemoveWriter(writer.id)}
                          className="p-2 text-gray-400 hover:text-red-600 rounded"
                          title="Remove writer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No writers assigned yet. Add users as writers to let them create posts.</p>
                  </div>
                )}
              </div>
            )}

            {/* Posts Tab */}
            {activeTab === 'posts' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">All Blog Posts</h2>
                  <div className="flex items-center gap-2">
                    <select
                      value={postFilter}
                      onChange={(e) => {
                        setPostFilter(e.target.value);
                        setTimeout(loadPosts, 0);
                      }}
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="all">All Status</option>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                {posts.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Title</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Author</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Category</th>
                          <th className="text-center py-3 px-4 font-medium text-gray-600">Status</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                          <th className="text-center py-3 px-4 font-medium text-gray-600">Views</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {posts.map(post => (
                          <tr key={post.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <p className="font-medium text-gray-900 max-w-xs truncate">{post.title}</p>
                            </td>
                            <td className="py-3 px-4 text-gray-600">{post.authorName}</td>
                            <td className="py-3 px-4 text-gray-600">{post.categoryName || '-'}</td>
                            <td className="py-3 px-4 text-center">
                              {post.status === 'Published' && (
                                <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                  Published
                                </span>
                              )}
                              {post.status === 'Draft' && (
                                <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                                  Draft
                                </span>
                              )}
                              {post.status === 'Archived' && (
                                <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                  Archived
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-gray-600 text-sm">
                              {formatDate(post.publishedAt || post.createdAt)}
                            </td>
                            <td className="py-3 px-4 text-center text-gray-600">{post.viewCount || 0}</td>
                            <td className="py-3 px-4 text-right">
                              <Link
                                to={`/blog?post=${post.slug || post.id}`}
                                className="p-2 text-gray-400 hover:text-purple-600 rounded inline-block"
                                title="View post"
                              >
                                <Eye className="w-4 h-4" />
                              </Link>
                              {post.status === 'Draft' && (
                                <button
                                  onClick={() => handlePublishPost(post.id)}
                                  className="p-2 text-gray-400 hover:text-green-600 rounded"
                                  title="Publish"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}
                              {post.status === 'Published' && (
                                <button
                                  onClick={() => handleArchivePost(post.id)}
                                  className="p-2 text-gray-400 hover:text-yellow-600 rounded"
                                  title="Archive"
                                >
                                  <Clock className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeletePost(post.id)}
                                className="p-2 text-gray-400 hover:text-red-600 rounded"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No posts found.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Category Modal */}
      {showCategoryModal && (
        <CategoryModal
          category={editingCategory}
          onClose={() => {
            setShowCategoryModal(false);
            setEditingCategory(null);
          }}
          onSave={handleSaveCategory}
        />
      )}

      {/* Add Writer Modal */}
      {showAddWriterModal && (
        <AddWriterModal
          users={allUsers}
          search={userSearch}
          onSearchChange={setUserSearch}
          onClose={() => {
            setShowAddWriterModal(false);
            setUserSearch('');
          }}
          onAdd={handleAddWriter}
        />
      )}
    </div>
  );
}

function CategoryModal({ category, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    slug: category?.slug || '',
    description: category?.description || '',
    isActive: category?.isActive ?? true,
    sortOrder: category?.sortOrder || 0
  });
  const [saving, setSaving] = useState(false);

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (name) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: category ? prev.slug : generateSlug(name)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {category ? 'Edit Category' : 'New Category'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Category name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-purple-500 focus:border-purple-500"
              placeholder="category-slug"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Brief description of this category"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddWriterModal({ users, search, onSearchChange, onClose, onAdd }) {
  const filteredUsers = users.filter(u => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      u.firstName?.toLowerCase().includes(query) ||
      u.lastName?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Add Blog Writer</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {filteredUsers.length > 0 ? (
            <div className="space-y-2">
              {filteredUsers.map(u => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => onAdd(u.id)}
                >
                  {u.profileImageUrl ? (
                    <img
                      src={getSharedAssetUrl(u.profileImageUrl)}
                      alt={u.firstName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-purple-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                    <p className="text-sm text-gray-500 truncate">{u.email}</p>
                  </div>
                  <Plus className="w-5 h-5 text-purple-600" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {search ? 'No users match your search' : 'No more users to add'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
