import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, ArrowLeft, Loader2, AlertCircle, Edit3,
  HelpCircle, BookOpen
} from 'lucide-react';
import { siteContentApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';

export default function Features() {
  const { user } = useAuth();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAdmin = user?.role === 'Admin';

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await siteContentApi.getContent('features');
      if (response.success) {
        setContent(response.data);
      } else {
        setError(response.message || 'Failed to load content');
      }
    } catch (err) {
      console.error('Error loading features:', err);
      setError('Failed to load features content');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Sparkles className="w-8 h-8" />
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold">
                {content?.title || 'Features & Guide'}
              </h1>
              {content?.updatedAt && (
                <p className="text-indigo-200 text-sm mt-1">
                  Last updated: {new Date(content.updatedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            {isAdmin && (
              <Link
                to="/admin/features"
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                <span className="hidden sm:inline">Edit</span>
              </Link>
            )}
          </div>

          {/* Quick links */}
          <div className="flex flex-wrap gap-3 mt-4">
            <Link
              to="/faq"
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              FAQ
            </Link>
            <Link
              to="/blog"
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Blog
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
            <p className="text-gray-500">Loading content...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={loadContent}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        ) : content ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 md:p-8 prose prose-indigo max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-3xl font-bold text-gray-900 mb-6 pb-4 border-b border-gray-200">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-gray-600 mb-4 leading-relaxed">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-2 mb-4 text-gray-600">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-2 mb-4 text-gray-600">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-gray-600">{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-gray-800">{children}</strong>
                  ),
                  a: ({ href, children }) => (
                    <Link
                      to={href || '#'}
                      className="text-indigo-600 hover:text-indigo-800 underline"
                    >
                      {children}
                    </Link>
                  ),
                  hr: () => (
                    <hr className="my-8 border-gray-200" />
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-indigo-500 pl-4 my-4 italic text-gray-600">
                      {children}
                    </blockquote>
                  ),
                  code: ({ children }) => (
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm text-indigo-600">
                      {children}
                    </code>
                  )
                }}
              >
                {content.content}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Content Yet</h3>
            <p className="text-gray-500">
              Features content will appear here once it's created.
            </p>
            {isAdmin && (
              <Link
                to="/admin/features"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Edit3 className="w-4 h-4" />
                Create Content
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
