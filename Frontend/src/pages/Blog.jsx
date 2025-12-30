import { useState, useEffect } from 'react';
import { FileText, Search, Tag, Calendar, User, MessageCircle, Heart, Edit2, Plus, X, Send } from 'lucide-react';
import Navigation from '../components/ui/Navigation';
import { useAuth } from '../contexts/AuthContext';
import { getAssetUrl } from '../services/api';

const CATEGORIES = [
  { value: 'all', label: 'All Posts' },
  { value: 'tips', label: 'Tips & Strategy' },
  { value: 'gear', label: 'Gear Reviews' },
  { value: 'tournaments', label: 'Tournament Stories' },
  { value: 'community', label: 'Community' },
  { value: 'news', label: 'News' },
];

// Minimum certification level required to publish blog posts
const MIN_PUBLISH_LEVEL = 3.5;

export default function Blog() {
  const { user, isAuthenticated } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  // Check if user can publish (based on certification level)
  const canPublish = isAuthenticated && user?.certificationLevel >= MIN_PUBLISH_LEVEL;

  // Load blog posts (placeholder for now - will connect to API when schema is provided)
  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true);
      try {
        // TODO: Replace with actual API call when schema is provided
        // const response = await blogApi.getPosts({ category });

        // Placeholder posts for now
        setPosts([]);
      } catch (err) {
        console.error('Error loading posts:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, [category]);

  const filteredPosts = posts.filter(post => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        post.title?.toLowerCase().includes(query) ||
        post.content?.toLowerCase().includes(query) ||
        post.authorName?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <FileText className="w-12 h-12" />
              <div>
                <h1 className="text-3xl font-bold">Community Blog</h1>
                <p className="text-purple-100 mt-1">
                  Stories, tips, and insights from the pickleball community
                </p>
              </div>
            </div>
            {canPublish ? (
              <button
                onClick={() => setShowWriteModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white text-purple-700 rounded-lg font-medium hover:bg-purple-50 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Write Post
              </button>
            ) : isAuthenticated ? (
              <div className="bg-purple-500/30 rounded-lg px-4 py-2 text-sm">
                <p className="font-medium">Reach level {MIN_PUBLISH_LEVEL}+ to publish</p>
                <p className="text-purple-200 text-xs">Get certified through peer reviews</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Publishing Info Banner */}
        {isAuthenticated && !canPublish && (
          <div className="mb-6 p-4 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6" />
              <div>
                <p className="font-medium">Want to write blog posts?</p>
                <p className="text-sm text-purple-600">
                  Get your skills certified to level {MIN_PUBLISH_LEVEL} or higher through peer reviews to unlock publishing privileges.
                  Your current level: {user?.certificationLevel?.toFixed(1) || 'Not certified'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search posts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-gray-500" />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {CATEGORIES.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Blog Posts */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
          </div>
        ) : filteredPosts.length > 0 ? (
          <div className="space-y-6">
            {filteredPosts.map(post => (
              <BlogPostCard
                key={post.id}
                post={post}
                onClick={() => setSelectedPost(post)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Posts Yet</h3>
            <p className="text-gray-500 mb-6">
              {searchQuery
                ? 'No posts match your search.'
                : 'Be the first to share your pickleball journey!'}
            </p>
            {canPublish && (
              <button
                onClick={() => setShowWriteModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Write the First Post
              </button>
            )}
          </div>
        )}
      </div>

      {/* Write Post Modal */}
      {showWriteModal && canPublish && (
        <WritePostModal
          onClose={() => setShowWriteModal(false)}
          onSave={(data) => {
            // TODO: Implement save when API is ready
            console.log('Saving post:', data);
            setShowWriteModal(false);
          }}
        />
      )}

      {/* View Post Modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          user={user}
          isAuthenticated={isAuthenticated}
          onClose={() => setSelectedPost(null)}
        />
      )}
    </div>
  );
}

function BlogPostCard({ post, onClick }) {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div
      className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="md:flex">
        {post.imageUrl && (
          <div className="md:w-64 flex-shrink-0">
            <img
              src={post.imageUrl}
              alt={post.title}
              className="w-full h-48 md:h-full object-cover"
            />
          </div>
        )}
        <div className="p-6 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
              {post.category}
            </span>
            <span className="text-sm text-gray-500">{formatDate(post.createdAt)}</span>
          </div>

          <h3 className="text-xl font-semibold text-gray-900 mb-2">{post.title}</h3>
          <p className="text-gray-600 mb-4 line-clamp-2">{post.excerpt || post.content?.slice(0, 150)}...</p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {post.authorImageUrl ? (
                <img
                  src={getAssetUrl(post.authorImageUrl)}
                  alt={post.authorName}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-purple-600" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">{post.authorName}</p>
                {post.authorLevel && (
                  <p className="text-xs text-gray-500">Level {post.authorLevel}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Heart className="w-4 h-4" />
                {post.likes || 0}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-4 h-4" />
                {post.commentCount || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WritePostModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: '',
    category: 'tips',
    content: '',
    excerpt: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Write New Post</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-purple-500 focus:border-purple-500"
            >
              {CATEGORIES.filter(c => c.value !== 'all').map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Short Summary</label>
            <input
              type="text"
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-purple-500 focus:border-purple-500"
              placeholder="A brief summary shown in previews"
              maxLength={200}
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
              className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              Publish Post
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PostDetailModal({ post, user, isAuthenticated, onClose }) {
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState(post.comments || []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    // TODO: Implement when API is ready
    const newComment = {
      id: Date.now(),
      content: comment,
      authorName: `${user?.firstName} ${user?.lastName}`,
      authorImageUrl: user?.profileImageUrl,
      createdAt: new Date().toISOString()
    };

    setComments([...comments, newComment]);
    setComment('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10">
          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">
            {post.category}
          </span>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {post.imageUrl && (
            <img
              src={post.imageUrl}
              alt={post.title}
              className="w-full h-64 object-cover rounded-lg mb-6"
            />
          )}

          <h1 className="text-2xl font-bold text-gray-900 mb-4">{post.title}</h1>

          <div className="flex items-center gap-3 mb-6 pb-6 border-b">
            {post.authorImageUrl ? (
              <img
                src={getAssetUrl(post.authorImageUrl)}
                alt={post.authorName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <User className="w-5 h-5 text-purple-600" />
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900">{post.authorName}</p>
              <p className="text-sm text-gray-500">{formatDate(post.createdAt)}</p>
            </div>
          </div>

          <div className="prose max-w-none mb-8">
            {post.content?.split('\n').map((paragraph, index) => (
              <p key={index} className="mb-4 text-gray-700">{paragraph}</p>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 pb-6 border-b">
            <button className="flex items-center gap-2 text-gray-500 hover:text-red-500 transition-colors">
              <Heart className="w-5 h-5" />
              <span>{post.likes || 0} Likes</span>
            </button>
            <span className="flex items-center gap-2 text-gray-500">
              <MessageCircle className="w-5 h-5" />
              <span>{comments.length} Comments</span>
            </span>
          </div>

          {/* Comments Section */}
          <div className="pt-6">
            <h3 className="font-semibold text-gray-900 mb-4">Comments</h3>

            {/* Comment Form - All authenticated users can comment */}
            {isAuthenticated ? (
              <form onSubmit={handleSubmitComment} className="mb-6">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex-shrink-0 flex items-center justify-center">
                    <User className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Add a comment..."
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-purple-500 focus:border-purple-500 resize-none"
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        type="submit"
                        disabled={!comment.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            ) : (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-gray-600">Sign in to leave a comment</p>
              </div>
            )}

            {/* Comments List */}
            <div className="space-y-4">
              {comments.length > 0 ? (
                comments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    {c.authorImageUrl ? (
                      <img
                        src={getAssetUrl(c.authorImageUrl)}
                        alt={c.authorName}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1 bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 text-sm">{c.authorName}</span>
                        <span className="text-xs text-gray-500">{formatDate(c.createdAt)}</span>
                      </div>
                      <p className="text-gray-700 text-sm">{c.content}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-4">
                  No comments yet. Be the first to share your thoughts!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
