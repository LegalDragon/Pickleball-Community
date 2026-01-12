import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus, Edit2, Trash2, Eye, Clock, Check, X, Search, ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { blogApi, getSharedAssetUrl } from '../services/api';

export default function MyBlog() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [editingPost, setEditingPost] = useState(null);

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await blogApi.getCategories();
        if (response?.success) {
          setCategories(response.data || []);
        }
      } catch (err) {
        console.error('Error loading categories:', err);
      }
    };
    loadCategories();
  }, []);

  // Load user's posts
  const loadPosts = async () => {
    setLoading(true);
    try {
      const response = await blogApi.getMyPosts();
      if (response?.success) {
        let filteredPosts = response.data || [];
        if (statusFilter !== 'all') {
          filteredPosts = filteredPosts.filter(p =>
            p.status?.toLowerCase() === statusFilter.toLowerCase()
          );
        }
        setPosts(filteredPosts);
      }
    } catch (err) {
      console.error('Error loading posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [statusFilter]);

  // Save post (create or update)
  const handleSavePost = async (data, publish = false) => {
    try {
      let savedPost;
      if (editingPost) {
        const response = await blogApi.updatePost(editingPost.id, data);
        savedPost = response?.data;
      } else {
        const response = await blogApi.createPost(data);
        savedPost = response?.data;
      }

      if (publish && savedPost?.id) {
        await blogApi.publishPost(savedPost.id);
      }

      setShowWriteModal(false);
      setEditingPost(null);
      loadPosts();
    } catch (err) {
      console.error('Error saving post:', err);
      alert('Failed to save post. Please try again.');
    }
  };

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

  // Fetch full post details before editing (list DTO doesn't include content)
  const handleEditPost = async (post) => {
    try {
      const response = await blogApi.getPost(post.slug || post.id);
      if (response?.success && response.data) {
        setEditingPost(response.data);
        setShowWriteModal(true);
      } else {
        // Fallback to list data if fetch fails
        setEditingPost(post);
        setShowWriteModal(true);
      }
    } catch (err) {
      console.error('Error loading post for edit:', err);
      // Fallback to list data
      setEditingPost(post);
      setShowWriteModal(true);
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

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'published':
        return <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full"><Check className="w-3 h-3 mr-1" />Published</span>;
      case 'draft':
        return <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full"><Clock className="w-3 h-3 mr-1" />Draft</span>;
      case 'archived':
        return <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">Archived</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/blog" className="p-2 hover:bg-white/10 rounded-lg">
                <ChevronLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold">My Blog Posts</h1>
                <p className="text-purple-100">Manage your drafts and published posts</p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingPost(null);
                setShowWriteModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white text-purple-700 rounded-lg font-medium hover:bg-purple-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Post
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="all">All Posts</option>
              <option value="draft">Drafts</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Posts List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
          </div>
        ) : posts.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Title</th>
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
                        {post.excerpt && (
                          <p className="text-sm text-gray-500 truncate max-w-xs">{post.excerpt}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{post.categoryName || '-'}</td>
                      <td className="py-3 px-4 text-center">{getStatusBadge(post.status)}</td>
                      <td className="py-3 px-4 text-gray-600 text-sm">
                        {formatDate(post.publishedAt || post.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600">{post.viewCount || 0}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {post.status?.toLowerCase() === 'published' && (
                            <Link
                              to={`/blog?post=${post.slug || post.id}`}
                              className="p-2 text-gray-400 hover:text-purple-600 rounded"
                              title="View post"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                          )}
                          <button
                            onClick={() => handleEditPost(post)}
                            className="p-2 text-gray-400 hover:text-purple-600 rounded"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {post.status?.toLowerCase() === 'draft' && (
                            <button
                              onClick={() => handlePublishPost(post.id)}
                              className="p-2 text-gray-400 hover:text-green-600 rounded"
                              title="Publish"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="p-2 text-gray-400 hover:text-red-600 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Posts Yet</h3>
            <p className="text-gray-500 mb-6">
              {statusFilter !== 'all'
                ? `You don't have any ${statusFilter} posts.`
                : 'Start writing your first blog post!'}
            </p>
            <button
              onClick={() => setShowWriteModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Write Your First Post
            </button>
          </div>
        )}
      </div>

      {/* Write/Edit Post Modal */}
      {showWriteModal && (
        <WritePostModal
          post={editingPost}
          categories={categories}
          onClose={() => {
            setShowWriteModal(false);
            setEditingPost(null);
          }}
          onSave={handleSavePost}
        />
      )}
    </div>
  );
}

function WritePostModal({ post, categories, onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: post?.title || '',
    categoryId: post?.categoryId || '',
    content: post?.content || '',
    excerpt: post?.excerpt || '',
    featuredImageUrl: post?.featuredImageUrl || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e, publish = false) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Convert empty strings to null for proper API serialization
      const dataToSend = {
        ...formData,
        categoryId: formData.categoryId ? parseInt(formData.categoryId, 10) : null,
        featuredImageUrl: formData.featuredImageUrl || null,
        excerpt: formData.excerpt || null
      };
      await onSave(dataToSend, publish);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900">
            {post ? 'Edit Post' : 'Write New Post'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Give your post a catchy title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">Select a category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Featured Image URL</label>
            <input
              type="text"
              value={formData.featuredImageUrl}
              onChange={(e) => setFormData({ ...formData, featuredImageUrl: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-purple-500 focus:border-purple-500"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Short Summary</label>
            <input
              type="text"
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-purple-500 focus:border-purple-500"
              placeholder="A brief summary shown in previews"
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              required
              rows={12}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Share your thoughts, tips, or story..."
            />
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
              className="px-6 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={saving}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
