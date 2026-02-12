import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { FileText, Search, Tag, Calendar, User, MessageCircle, Star, Edit2, Plus, X, Send, ArrowLeft, Trash2, Eye, Clock, ChevronRight, FolderOpen, Video, Upload, PlayCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { blogApi, ratingApi, getSharedAssetUrl } from '../services/api';

export default function Blog() {
  const { user, isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(searchParams.get('category') || '');
  const [selectedPostType, setSelectedPostType] = useState(searchParams.get('type') || '');
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Check if user can write blogs
  const canWrite = isAuthenticated && (user?.canWriteBlog || user?.role === 'Admin');

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

  // Load posts
  const loadPosts = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const currentPage = reset ? 1 : page;
      const response = await blogApi.getPosts({
        categoryId: selectedCategoryId || undefined,
        status: 'Published',
        page: currentPage,
        pageSize: 10
      });

      if (response?.success) {
        const newPosts = response.data?.items || response.data || [];
        if (reset) {
          setPosts(newPosts);
          setPage(1);
        } else {
          setPosts(prev => currentPage === 1 ? newPosts : [...prev, ...newPosts]);
        }
        setHasMore(newPosts.length >= 10);
      }
    } catch (err) {
      console.error('Error loading posts:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategoryId, page]);

  useEffect(() => {
    loadPosts(true);
  }, [selectedCategoryId]);

  // Handle category filter change
  const handleCategoryChange = (categoryId) => {
    setSelectedCategoryId(categoryId);
    if (categoryId) {
      setSearchParams({ category: categoryId });
    } else {
      setSearchParams({});
    }
  };

  // Filter posts by search query
  const filteredPosts = posts.filter(post => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        post.title?.toLowerCase().includes(query) ||
        post.excerpt?.toLowerCase().includes(query) ||
        post.authorName?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Handle post save (create or update)
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
      loadPosts(true);
    } catch (err) {
      console.error('Error saving post:', err);
      alert('Failed to save post. Please try again.');
    }
  };

  // Handle post view
  const handleViewPost = async (post) => {
    try {
      const response = await blogApi.getPost(post.slug || post.id);
      if (response?.success) {
        setSelectedPost(response.data);
      } else {
        setSelectedPost(post);
      }
    } catch (err) {
      console.error('Error loading post details:', err);
      setSelectedPost(post);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
            {canWrite && (
              <div className="flex items-center gap-3">
                <Link
                  to="/my-blog"
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500/30 text-white rounded-lg font-medium hover:bg-purple-500/50 transition-colors"
                >
                  <FolderOpen className="w-5 h-5" />
                  My Posts
                </Link>
                <button
                  onClick={() => {
                    setEditingPost(null);
                    setShowWriteModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-purple-700 rounded-lg font-medium hover:bg-purple-50 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Write Post
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                value={selectedCategoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Blog Posts */}
        {loading && posts.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
          </div>
        ) : filteredPosts.length > 0 ? (
          <div className="space-y-6">
            {filteredPosts.map(post => (
              <BlogPostCard
                key={post.id}
                post={post}
                onClick={() => handleViewPost(post)}
              />
            ))}

            {hasMore && (
              <div className="text-center pt-4">
                <button
                  onClick={() => {
                    setPage(p => p + 1);
                    loadPosts();
                  }}
                  disabled={loading}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
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
            {canWrite && (
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

      {/* Write/Edit Post Modal */}
      {showWriteModal && canWrite && (
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

      {/* View Post Modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          user={user}
          isAuthenticated={isAuthenticated}
          canEdit={canWrite && (selectedPost.authorId === user?.id || user?.role === 'Admin')}
          onClose={() => setSelectedPost(null)}
          onEdit={() => {
            setEditingPost(selectedPost);
            setSelectedPost(null);
            setShowWriteModal(true);
          }}
          onRefresh={() => handleViewPost(selectedPost)}
        />
      )}
    </div>
  );
}

function BlogPostCard({ post, onClick }) {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isVlog = post.postType === 'Vlog' || post.videoUrl || post.videoAssetId;

  return (
    <div
      className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="md:flex">
        {(post.featuredImageUrl || isVlog) && (
          <div className="md:w-64 flex-shrink-0 relative">
            {post.featuredImageUrl ? (
              <img
                src={getSharedAssetUrl(post.featuredImageUrl)}
                alt={post.title}
                className="w-full h-48 md:h-full object-cover"
              />
            ) : (
              <div className="w-full h-48 md:h-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
                <PlayCircle className="w-16 h-16 text-white/80" />
              </div>
            )}
            {isVlog && (
              <div className="absolute top-2 left-2 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded flex items-center gap-1">
                <Video className="w-3 h-3" />
                VLOG
              </div>
            )}
          </div>
        )}
        <div className="p-6 flex-1">
          <div className="flex items-center gap-2 mb-2">
            {post.categoryName && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                {post.categoryName}
              </span>
            )}
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDate(post.publishedAt || post.createdAt)}
            </span>
          </div>

          <h3 className="text-xl font-semibold text-gray-900 mb-2">{post.title}</h3>
          <p className="text-gray-600 mb-4 line-clamp-2">{post.excerpt || post.content?.slice(0, 150)}...</p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {post.authorProfileImageUrl ? (
                <img
                  src={getSharedAssetUrl(post.authorProfileImageUrl)}
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
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {post.viewCount || 0}
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

function WritePostModal({ post, categories, onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: post?.title || '',
    categoryId: post?.categoryId || '',
    content: post?.content || '',
    excerpt: post?.excerpt || '',
    featuredImageUrl: post?.featuredImageUrl || '',
    postType: post?.postType || 'Blog',
    videoUrl: post?.videoUrl || '',
    videoAssetId: post?.videoAssetId || null
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate video file
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }

    // Max 500MB
    if (file.size > 500 * 1024 * 1024) {
      alert('Video must be less than 500MB');
      return;
    }

    setUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('folder', 'videos');

      const response = await fetch('/api/assets/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: uploadFormData
      });

      const result = await response.json();
      if (result.success && result.data) {
        setFormData(prev => ({
          ...prev,
          videoAssetId: result.data.assetId,
          videoUrl: `/api/assets/${result.data.assetId}`
        }));
      } else {
        alert(result.message || 'Upload failed');
      }
    } catch (err) {
      console.error('Video upload error:', err);
      alert('Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e, publish = false) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Convert empty strings to null for proper API serialization
      const dataToSend = {
        ...formData,
        categoryId: formData.categoryId ? parseInt(formData.categoryId, 10) : null,
        featuredImageUrl: formData.featuredImageUrl || null,
        excerpt: formData.excerpt || null,
        videoUrl: formData.videoUrl || null,
        videoAssetId: formData.videoAssetId || null
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

          {/* Post Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Post Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="postType"
                  value="Blog"
                  checked={formData.postType === 'Blog'}
                  onChange={(e) => setFormData({ ...formData, postType: e.target.value })}
                  className="w-4 h-4 text-purple-600"
                />
                <FileText className="w-4 h-4 text-gray-600" />
                <span>Blog Post</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="postType"
                  value="Vlog"
                  checked={formData.postType === 'Vlog'}
                  onChange={(e) => setFormData({ ...formData, postType: e.target.value })}
                  className="w-4 h-4 text-purple-600"
                />
                <Video className="w-4 h-4 text-red-600" />
                <span>Video Post (Vlog)</span>
              </label>
            </div>
          </div>

          {/* Video Upload for Vlogs */}
          {formData.postType === 'Vlog' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <label className="block text-sm font-medium text-red-700 mb-2">
                <Video className="w-4 h-4 inline mr-1" />
                Upload Video *
              </label>
              {formData.videoUrl ? (
                <div className="space-y-3">
                  <video
                    src={formData.videoUrl}
                    controls
                    className="w-full max-h-64 rounded-lg bg-black"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, videoUrl: '', videoAssetId: null })}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove video
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg cursor-pointer hover:bg-red-700 transition-colors">
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Uploading...' : 'Choose Video'}
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                  <span className="text-sm text-gray-500">Max 500MB</span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Featured Image URL</label>
            <input
              type="text"
              value={formData.featuredImageUrl}
              onChange={(e) => setFormData({ ...formData, featuredImageUrl: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-purple-500 focus:border-purple-500"
              placeholder="https://example.com/image.jpg (optional thumbnail for video)"
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

function PostDetailModal({ post, user, isAuthenticated, canEdit, onClose, onEdit, onRefresh }) {
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(null);
  const [myRating, setMyRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  // Load comments
  useEffect(() => {
    const loadComments = async () => {
      setLoadingComments(true);
      try {
        const response = await blogApi.getComments(post.id);
        if (response?.success) {
          setComments(response.data || []);
        }
      } catch (err) {
        console.error('Error loading comments:', err);
      } finally {
        setLoadingComments(false);
      }
    };

    loadComments();
  }, [post.id]);

  // Load rating
  useEffect(() => {
    const loadRating = async () => {
      try {
        const summaryResponse = await ratingApi.getSummary('BlogPost', post.id);
        if (summaryResponse?.success) {
          setRating(summaryResponse.data);
        }

        if (isAuthenticated) {
          const myRatingResponse = await ratingApi.getMyRating('BlogPost', post.id);
          if (myRatingResponse?.success && myRatingResponse.data) {
            setMyRating(myRatingResponse.data.stars);
          }
        }
      } catch (err) {
        console.error('Error loading rating:', err);
      }
    };

    loadRating();
  }, [post.id, isAuthenticated]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setSubmitting(true);
    try {
      const response = await blogApi.addComment(post.id, comment.trim());
      if (response?.success) {
        setComments(prev => [...prev, response.data]);
        setComment('');
      }
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Failed to add comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRate = async (stars) => {
    if (!isAuthenticated) return;

    try {
      await ratingApi.rate('BlogPost', post.id, stars);
      setMyRating(stars);

      // Refresh rating summary
      const summaryResponse = await ratingApi.getSummary('BlogPost', post.id);
      if (summaryResponse?.success) {
        setRating(summaryResponse.data);
      }
    } catch (err) {
      console.error('Error rating post:', err);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await blogApi.deleteComment(commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (err) {
      console.error('Error deleting comment:', err);
      alert('Failed to delete comment. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            {post.categoryName && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">
                {post.categoryName}
              </span>
            )}
            {post.status === 'Draft' && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-sm font-medium rounded-full">
                Draft
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={onEdit}
                className="p-2 text-gray-400 hover:text-purple-600 rounded-lg"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Video Player for Vlogs */}
          {(post.postType === 'Vlog' || post.videoUrl || post.videoAssetId) && (
            <div className="mb-6">
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video
                  src={post.videoUrl || `/api/assets/${post.videoAssetId}`}
                  controls
                  className="w-full max-h-[400px]"
                  poster={post.featuredImageUrl ? getSharedAssetUrl(post.featuredImageUrl) : undefined}
                />
              </div>
              <div className="mt-2 flex items-center gap-2 text-red-600">
                <Video className="w-4 h-4" />
                <span className="text-sm font-medium">Video Post</span>
              </div>
            </div>
          )}

          {/* Featured Image (only show if no video or as thumbnail) */}
          {post.featuredImageUrl && !post.videoUrl && !post.videoAssetId && (
            <img
              src={getSharedAssetUrl(post.featuredImageUrl)}
              alt={post.title}
              className="w-full h-64 object-cover rounded-lg mb-6"
            />
          )}

          <h1 className="text-2xl font-bold text-gray-900 mb-4">{post.title}</h1>

          <div className="flex items-center gap-3 mb-6 pb-6 border-b">
            {post.authorProfileImageUrl ? (
              <img
                src={getSharedAssetUrl(post.authorProfileImageUrl)}
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
              <p className="text-sm text-gray-500">{formatDate(post.publishedAt || post.createdAt)}</p>
            </div>
          </div>

          <div className="prose max-w-none mb-8">
            {post.content?.split('\n').map((paragraph, index) => (
              paragraph.trim() ? <p key={index} className="mb-4 text-gray-700">{paragraph}</p> : null
            ))}
          </div>

          {/* Rating Section */}
          <div className="flex items-center gap-4 pb-6 border-b">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Rate this post:</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => handleRate(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    disabled={!isAuthenticated}
                    className="p-1 disabled:cursor-not-allowed"
                  >
                    <Star
                      className={`w-5 h-5 ${
                        star <= (hoverRating || myRating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
              {rating && (
                <span className="text-sm text-gray-500 ml-2">
                  ({rating.averageRating?.toFixed(1) || '0'} avg, {rating.totalRatings || 0} ratings)
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 ml-auto text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {post.viewCount || 0} views
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-4 h-4" />
                {comments.length} comments
              </span>
            </div>
          </div>

          {/* Comments Section */}
          <div className="pt-6">
            <h3 className="font-semibold text-gray-900 mb-4">Comments</h3>

            {/* Comment Form */}
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
                        disabled={!comment.trim() || submitting}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        {submitting ? 'Posting...' : 'Post'}
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
              {loadingComments ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600"></div>
                </div>
              ) : comments.length > 0 ? (
                comments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    {c.userProfileImageUrl ? (
                      <img
                        src={getSharedAssetUrl(c.userProfileImageUrl)}
                        alt={c.userName}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1 bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 text-sm">{c.userName}</span>
                          <span className="text-xs text-gray-500">{formatDate(c.createdAt)}</span>
                        </div>
                        {(c.userId === user?.id || user?.role === 'Admin') && (
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            className="p-1 text-gray-400 hover:text-red-500 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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
