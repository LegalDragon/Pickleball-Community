import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles, ArrowLeft, Loader2, Save, Eye, AlertCircle,
  CheckCircle, Info
} from 'lucide-react';
import { siteContentApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';

export default function FeaturesAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [content, setContent] = useState(null);
  const [title, setTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const isAdmin = user?.role === 'Admin';

  useEffect(() => {
    if (!isAdmin) {
      navigate('/features');
      return;
    }
    loadContent();
  }, [isAdmin, navigate]);

  const loadContent = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await siteContentApi.getContent('features');
      if (response.success && response.data) {
        setContent(response.data);
        setTitle(response.data.title || '');
        setMarkdown(response.data.content || '');
      }
    } catch (err) {
      console.error('Error loading features:', err);
      // Content might not exist yet, that's okay
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await siteContentApi.updateContent('features', {
        title: title.trim(),
        content: markdown
      });

      if (response.success) {
        setSuccess('Content saved successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.message || 'Failed to save content');
      }
    } catch (err) {
      console.error('Error saving content:', err);
      setError('Failed to save content');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link to="/features" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Sparkles className="w-7 h-7" />
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-bold">Edit Features Page</h1>
              <p className="text-indigo-200 text-sm">
                Use Markdown to format the content
              </p>
            </div>
            <Link
              to="/features"
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">View Page</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
            <p className="text-gray-500">Loading content...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Alerts */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <p className="text-green-700">{success}</p>
              </div>
            )}

            {/* Title input */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Page Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Features & Guide"
              />
            </div>

            {/* Markdown help */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">Markdown Tips:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-600">
                    <li><code className="bg-blue-100 px-1 rounded"># Heading 1</code>, <code className="bg-blue-100 px-1 rounded">## Heading 2</code>, <code className="bg-blue-100 px-1 rounded">### Heading 3</code></li>
                    <li><code className="bg-blue-100 px-1 rounded">**bold**</code> for <strong>bold</strong>, <code className="bg-blue-100 px-1 rounded">*italic*</code> for <em>italic</em></li>
                    <li><code className="bg-blue-100 px-1 rounded">- item</code> for bullet lists, <code className="bg-blue-100 px-1 rounded">1. item</code> for numbered lists</li>
                    <li><code className="bg-blue-100 px-1 rounded">[link text](/path)</code> for internal links</li>
                    <li><code className="bg-blue-100 px-1 rounded">---</code> for horizontal line</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Editor and Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Editor */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Markdown Editor</span>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="lg:hidden text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    {showPreview ? 'Edit' : 'Preview'}
                  </button>
                </div>
                <div className={showPreview ? 'hidden lg:block' : ''}>
                  <textarea
                    value={markdown}
                    onChange={(e) => setMarkdown(e.target.value)}
                    className="w-full h-[500px] p-4 font-mono text-sm border-0 focus:ring-0 resize-none"
                    placeholder="# Welcome to Pickleball Community

Write your features and guide content here using Markdown..."
                  />
                </div>
              </div>

              {/* Preview */}
              <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${!showPreview ? 'hidden lg:block' : ''}`}>
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-700">Preview</span>
                </div>
                <div className="p-4 h-[500px] overflow-y-auto prose prose-sm max-w-none">
                  {markdown ? (
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => (
                          <h1 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-xl font-bold text-gray-800 mt-6 mb-3">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">
                            {children}
                          </h3>
                        ),
                        p: ({ children }) => (
                          <p className="text-gray-600 mb-3 text-sm leading-relaxed">
                            {children}
                          </p>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-gray-600">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-inside space-y-1 mb-3 text-sm text-gray-600">
                            {children}
                          </ol>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold text-gray-800">{children}</strong>
                        ),
                        a: ({ href, children }) => (
                          <a href={href} className="text-indigo-600 hover:underline">
                            {children}
                          </a>
                        ),
                        hr: () => <hr className="my-4 border-gray-200" />,
                        code: ({ children }) => (
                          <code className="bg-gray-100 px-1 py-0.5 rounded text-xs text-indigo-600">
                            {children}
                          </code>
                        )
                      }}
                    >
                      {markdown}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-gray-400 italic">Preview will appear here...</p>
                  )}
                </div>
              </div>
            </div>

            {/* Save button */}
            <div className="flex items-center justify-end gap-4">
              <Link
                to="/features"
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
