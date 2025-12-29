import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { blogApi, assetApi } from '../services/api';
import { getAssetUrl } from '../services/api';
import { ArrowLeft, Save, Eye, EyeOff, Image, Bold, Italic, List, ListOrdered, Link as LinkIcon, Heading1, Heading2, Quote, Code, Upload } from 'lucide-react';

export default function BlogEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const contentRef = useRef(null);
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    content: '',
    featuredImageUrl: '',
    category: '',
    tags: '',
    isPublished: false
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const categories = [
    'Strategy',
    'Technique',
    'Equipment',
    'Fitness',
    'Mental Game',
    'Rules & Regulations',
    'Tournament Tips',
    'Beginner Tips',
    'Advanced Play',
    'Drills & Practice',
    'News & Updates'
  ];

  useEffect(() => {
    if (isEditing) {
      loadPost();
    }
  }, [id]);

  const loadPost = async () => {
    try {
      setLoading(true);
      const data = await blogApi.getPostById(id);
      setFormData({
        title: data.title || '',
        summary: data.summary || '',
        content: data.content || '',
        featuredImageUrl: data.featuredImageUrl || '',
        category: data.category || '',
        tags: data.tags || '',
        isPublished: data.isPublished || false
      });
    } catch (err) {
      console.error('Error loading post:', err);
      setError('Failed to load blog post');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const result = await assetApi.upload(file, 'blog');
      setFormData(prev => ({
        ...prev,
        featuredImageUrl: result.data?.url || result.url || result
      }));
    } catch (err) {
      console.error('Error uploading image:', err);
      alert('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const insertContentImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const result = await assetApi.upload(file, 'blog');
      const imageUrl = result.data?.url || result.url || result;
      const imageHtml = `<img src="${imageUrl}" alt="" class="max-w-full h-auto rounded-lg my-4" />`;

      setFormData(prev => ({
        ...prev,
        content: prev.content + imageHtml
      }));
    } catch (err) {
      console.error('Error uploading image:', err);
      alert('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const insertFormat = (tag, attributes = '') => {
    const textarea = contentRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = formData.content.substring(start, end);

    let newText;
    if (tag === 'a') {
      const url = prompt('Enter URL:');
      if (!url) return;
      newText = `<a href="${url}" target="_blank" class="text-primary-600 underline">${selectedText || 'Link text'}</a>`;
    } else if (tag === 'img') {
      document.getElementById('content-image-upload')?.click();
      return;
    } else {
      newText = `<${tag}${attributes}>${selectedText}</${tag}>`;
    }

    const newContent = formData.content.substring(0, start) + newText + formData.content.substring(end);
    setFormData(prev => ({ ...prev, content: newContent }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('Please enter a title');
      return;
    }

    if (!formData.content.trim()) {
      alert('Please enter content');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isEditing) {
        await blogApi.updatePost(id, formData);
      } else {
        await blogApi.createPost(formData);
      }

      navigate('/coach/blog');
    } catch (err) {
      console.error('Error saving post:', err);
      setError(err.message || 'Failed to save blog post');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    const wasPublished = formData.isPublished;
    setFormData(prev => ({ ...prev, isPublished: false }));

    try {
      setSaving(true);
      setError(null);

      const draftData = { ...formData, isPublished: false };

      if (isEditing) {
        await blogApi.updatePost(id, draftData);
      } else {
        await blogApi.createPost(draftData);
      }

      navigate('/coach/blog');
    } catch (err) {
      console.error('Error saving draft:', err);
      setError(err.message || 'Failed to save draft');
      setFormData(prev => ({ ...prev, isPublished: wasPublished }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/coach/blog')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Posts
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {previewMode ? 'Edit' : 'Preview'}
              </button>

              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Save Draft
              </button>

              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isEditing ? 'Update' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {previewMode ? (
          /* Preview Mode */
          <div className="bg-white rounded-xl shadow-sm p-8">
            {formData.featuredImageUrl && (
              <img
                src={getAssetUrl(formData.featuredImageUrl)}
                alt={formData.title}
                className="w-full h-64 object-cover rounded-lg mb-6"
              />
            )}
            <h1 className="text-3xl font-bold mb-4">{formData.title || 'Untitled'}</h1>
            {formData.summary && (
              <p className="text-xl text-gray-600 mb-6">{formData.summary}</p>
            )}
            <div
              className="prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: formData.content || '<p>No content yet...</p>' }}
            />
          </div>
        ) : (
          /* Edit Mode */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Featured Image */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Featured Image
              </label>
              {formData.featuredImageUrl ? (
                <div className="relative">
                  <img
                    src={getAssetUrl(formData.featuredImageUrl)}
                    alt="Featured"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, featuredImageUrl: '' }))}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 bg-gray-50">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-gray-500">
                    {uploadingImage ? 'Uploading...' : 'Click to upload featured image'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </label>
              )}
            </div>

            {/* Title */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Enter your blog title..."
                className="w-full text-3xl font-bold border-0 focus:ring-0 placeholder-gray-300"
              />
            </div>

            {/* Summary */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Summary (optional)
              </label>
              <textarea
                name="summary"
                value={formData.summary}
                onChange={handleChange}
                placeholder="Brief description of your post..."
                rows={2}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Content Editor */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content
              </label>

              {/* Toolbar */}
              <div className="flex flex-wrap gap-1 p-2 border border-gray-300 rounded-t-lg bg-gray-50">
                <button
                  type="button"
                  onClick={() => insertFormat('h2', ' class="text-2xl font-bold mt-6 mb-3"')}
                  className="p-2 hover:bg-gray-200 rounded"
                  title="Heading 2"
                >
                  <Heading1 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormat('h3', ' class="text-xl font-semibold mt-4 mb-2"')}
                  className="p-2 hover:bg-gray-200 rounded"
                  title="Heading 3"
                >
                  <Heading2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormat('strong')}
                  className="p-2 hover:bg-gray-200 rounded"
                  title="Bold"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormat('em')}
                  className="p-2 hover:bg-gray-200 rounded"
                  title="Italic"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormat('a')}
                  className="p-2 hover:bg-gray-200 rounded"
                  title="Link"
                >
                  <LinkIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormat('blockquote', ' class="border-l-4 border-primary-500 pl-4 italic my-4"')}
                  className="p-2 hover:bg-gray-200 rounded"
                  title="Quote"
                >
                  <Quote className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormat('code', ' class="bg-gray-100 px-2 py-1 rounded"')}
                  className="p-2 hover:bg-gray-200 rounded"
                  title="Code"
                >
                  <Code className="w-4 h-4" />
                </button>
                <label className="p-2 hover:bg-gray-200 rounded cursor-pointer" title="Insert Image">
                  <Image className="w-4 h-4" />
                  <input
                    id="content-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={insertContentImage}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </label>
              </div>

              <textarea
                ref={contentRef}
                name="content"
                value={formData.content}
                onChange={handleChange}
                placeholder="Write your blog post content here... (HTML supported)"
                rows={20}
                className="w-full border border-gray-300 border-t-0 rounded-b-lg p-4 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-2">
                You can use HTML tags for formatting. Use the toolbar above for common formatting options.
              </p>
            </div>

            {/* Category & Tags */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Select a category</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleChange}
                    placeholder="e.g., beginner, serve, strategy"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </div>

            {/* Publish Status */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="isPublished"
                  checked={formData.isPublished}
                  onChange={handleChange}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="text-gray-700">
                  Publish immediately (uncheck to save as draft)
                </span>
              </label>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
