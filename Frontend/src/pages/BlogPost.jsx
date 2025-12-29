import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { blogApi } from '../services/api';
import { getAssetUrl } from '../services/api';
import { Calendar, User, Eye, Tag, ArrowLeft, Share2, Clock } from 'lucide-react';

export default function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [relatedPosts, setRelatedPosts] = useState([]);

  useEffect(() => {
    loadPost();
  }, [slug]);

  const loadPost = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try slug first, then fall back to ID if slug is numeric
      let data;
      if (/^\d+$/.test(slug)) {
        // Numeric - treat as ID
        data = await blogApi.getPostById(slug);
      } else {
        // String slug
        data = await blogApi.getPostBySlug(slug);
      }
      setPost(data);

      // Load related posts from same author
      if (data.author?.id) {
        try {
          const authorPosts = await blogApi.getCoachPosts(data.author.id);
          setRelatedPosts(authorPosts.filter(p => p.id !== data.id).slice(0, 3));
        } catch (err) {
          console.error('Error loading related posts:', err);
        }
      }
    } catch (err) {
      console.error('Error loading post:', err);
      setError('Blog post not found');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateReadTime = (content) => {
    const wordsPerMinute = 200;
    const words = content?.split(/\s+/).length || 0;
    const minutes = Math.ceil(words / wordsPerMinute);
    return minutes;
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: post.summary || post.title,
          url: url
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8" />
            <div className="h-12 bg-gray-200 rounded w-3/4 mb-4" />
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-8" />
            <div className="h-96 bg-gray-200 rounded mb-8" />
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Post Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            to="/blog"
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  const tags = post.tags?.split(',').map(t => t.trim()).filter(t => t) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>
        </div>
      </div>

      <article className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="mb-8">
          {post.category && (
            <Link
              to={`/blog?category=${encodeURIComponent(post.category)}`}
              className="inline-block px-3 py-1 bg-primary-100 text-primary-700 text-sm font-medium rounded-full mb-4 hover:bg-primary-200"
            >
              {post.category}
            </Link>
          )}

          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {post.title}
          </h1>

          {post.summary && (
            <p className="text-xl text-gray-600 mb-6">
              {post.summary}
            </p>
          )}

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-6 text-gray-500">
            <Link
              to={`/coach/${post.author.id}`}
              className="flex items-center gap-3 hover:text-primary-600"
            >
              {post.author.avatarUrl ? (
                <img
                  src={getAssetUrl(post.author.avatarUrl)}
                  alt={`${post.author.firstName} ${post.author.lastName}`}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary-600" />
                </div>
              )}
              <div>
                <p className="font-medium text-gray-900">
                  {post.author.firstName} {post.author.lastName}
                </p>
                <p className="text-sm">Coach</p>
              </div>
            </Link>

            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(post.publishedAt)}</span>
            </div>

            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{calculateReadTime(post.content)} min read</span>
            </div>

            <div className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              <span>{post.viewCount} views</span>
            </div>

            <button
              onClick={handleShare}
              className="flex items-center gap-1 hover:text-primary-600"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
          </div>
        </header>

        {/* Featured Image */}
        {post.featuredImageUrl && (
          <div className="mb-8 rounded-xl overflow-hidden">
            <img
              src={getAssetUrl(post.featuredImageUrl)}
              alt={post.title}
              className="w-full h-auto"
            />
          </div>
        )}

        {/* Content */}
        <div
          className="prose prose-lg max-w-none mb-12"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Tags */}
        {tags.length > 0 && (
          <div className="border-t border-b py-6 mb-12">
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-5 h-5 text-gray-400" />
              {tags.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Author Bio */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-12">
          <h3 className="text-lg font-semibold mb-4">About the Author</h3>
          <Link
            to={`/coach/${post.author.id}`}
            className="flex items-start gap-4"
          >
            {post.author.avatarUrl ? (
              <img
                src={getAssetUrl(post.author.avatarUrl)}
                alt={`${post.author.firstName} ${post.author.lastName}`}
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <User className="w-8 h-8 text-primary-600" />
              </div>
            )}
            <div>
              <h4 className="font-semibold text-gray-900 hover:text-primary-600">
                {post.author.firstName} {post.author.lastName}
              </h4>
              {post.author.bio && (
                <p className="text-gray-600 mt-1 line-clamp-3">{post.author.bio}</p>
              )}
              <span className="inline-block mt-2 text-primary-600 text-sm font-medium">
                View Profile &rarr;
              </span>
            </div>
          </Link>
        </div>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <div>
            <h3 className="text-2xl font-bold mb-6">More from this Coach</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map(relatedPost => (
                <Link
                  key={relatedPost.id}
                  to={`/blog/${relatedPost.slug}`}
                  className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  {relatedPost.featuredImageUrl ? (
                    <img
                      src={getAssetUrl(relatedPost.featuredImageUrl)}
                      alt={relatedPost.title}
                      className="w-full h-32 object-cover"
                    />
                  ) : (
                    <div className="w-full h-32 bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                      <span className="text-3xl font-bold text-primary-400">
                        {relatedPost.title.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="p-4">
                    <h4 className="font-semibold text-gray-900 line-clamp-2 hover:text-primary-600">
                      {relatedPost.title}
                    </h4>
                    <p className="text-sm text-gray-500 mt-2">
                      {formatDate(relatedPost.publishedAt)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
