import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { blogApi } from '../services/api';
import { getAssetUrl } from '../services/api';
import { Plus, Edit2, Trash2, Eye, EyeOff, Calendar, MoreVertical, Search, FileText } from 'lucide-react';

export default function BlogManagement() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all, published, drafts
  const [activeMenu, setActiveMenu] = useState(null);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const data = await blogApi.getMyPosts();
      setPosts(data);
    } catch (err) {
      console.error('Error loading posts:', err);
      setError('Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (postId) => {
    if (!confirm('Are you sure you want to delete this blog post?')) return;

    try {
      await blogApi.deletePost(postId);
      setPosts(posts.filter(p => p.id !== postId));
    } catch (err) {
      console.error('Error deleting post:', err);
      alert('Failed to delete post');
    }
  };

  const handleTogglePublish = async (postId) => {
    try {
      await blogApi.togglePublish(postId);
      setPosts(posts.map(p =>
        p.id === postId
          ? { ...p, isPublished: !p.isPublished, publishedAt: !p.isPublished ? new Date().toISOString() : p.publishedAt }
          : p
      ));
    } catch (err) {
      console.error('Error toggling publish:', err);
      alert('Failed to update publish status');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not published';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          post.summary?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' ||
                          (filter === 'published' && post.isPublished) ||
                          (filter === 'drafts' && !post.isPublished);
    return matchesSearch && matchesFilter;
  });

  const publishedCount = posts.filter(p => p.isPublished).length;
  const draftCount = posts.filter(p => !p.isPublished).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4" />
            <div className="h-12 bg-gray-200 rounded" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Blog Posts</h1>
              <p className="text-gray-500 mt-1">
                Manage your blog posts and share your expertise
              </p>
            </div>
            <Link
              to="/coach/blog/new"
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-5 h-5" />
              New Post
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500">Total Posts</p>
            <p className="text-2xl font-bold text-gray-900">{posts.length}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500">Published</p>
            <p className="text-2xl font-bold text-green-600">{publishedCount}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500">Drafts</p>
            <p className="text-2xl font-bold text-yellow-600">{draftCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  filter === 'all'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All ({posts.length})
              </button>
              <button
                onClick={() => setFilter('published')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  filter === 'published'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Published ({publishedCount})
              </button>
              <button
                onClick={() => setFilter('drafts')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  filter === 'drafts'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Drafts ({draftCount})
              </button>
            </div>
          </div>
        </div>

        {/* Posts List */}
        {filteredPosts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery || filter !== 'all' ? 'No posts found' : 'No blog posts yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery || filter !== 'all'
                ? 'Try adjusting your search or filter'
                : 'Start sharing your knowledge with a new blog post'}
            </p>
            {!searchQuery && filter === 'all' && (
              <Link
                to="/coach/blog/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Plus className="w-5 h-5" />
                Create Your First Post
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-200">
              {filteredPosts.map(post => (
                <div
                  key={post.id}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Thumbnail */}
                    <div className="flex-shrink-0">
                      {post.featuredImageUrl ? (
                        <img
                          src={getAssetUrl(post.featuredImageUrl)}
                          alt={post.title}
                          className="w-24 h-16 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-24 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <Link
                            to={`/coach/blog/edit/${post.id}`}
                            className="text-lg font-medium text-gray-900 hover:text-primary-600 line-clamp-1"
                          >
                            {post.title}
                          </Link>
                          {post.summary && (
                            <p className="text-gray-500 text-sm mt-1 line-clamp-1">
                              {post.summary}
                            </p>
                          )}
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`flex-shrink-0 px-2 py-1 text-xs font-medium rounded-full ${
                            post.isPublished
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {post.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {post.isPublished
                            ? `Published ${formatDate(post.publishedAt)}`
                            : `Created ${formatDate(post.createdAt)}`}
                        </span>
                        {post.category && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                            {post.category}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {post.viewCount} views
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {post.isPublished && (
                        <Link
                          to={`/blog/${post.slug}`}
                          target="_blank"
                          className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                          title="View Post"
                        >
                          <Eye className="w-5 h-5" />
                        </Link>
                      )}

                      <Link
                        to={`/coach/blog/edit/${post.id}`}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                        title="Edit"
                      >
                        <Edit2 className="w-5 h-5" />
                      </Link>

                      <button
                        onClick={() => handleTogglePublish(post.id)}
                        className={`p-2 rounded-lg ${
                          post.isPublished
                            ? 'text-gray-400 hover:text-yellow-600 hover:bg-yellow-50'
                            : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={post.isPublished ? 'Unpublish' : 'Publish'}
                      >
                        {post.isPublished ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>

                      <button
                        onClick={() => handleDelete(post.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
