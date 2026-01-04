import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Send, ArrowLeft, CheckCircle, MessageSquare, Bug, Lightbulb, User, HelpCircle } from 'lucide-react';
import { feedbackApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Icon mapping for categories
const iconMap = {
  Bug: Bug,
  Lightbulb: Lightbulb,
  MessageSquare: MessageSquare,
  User: User,
  HelpCircle: HelpCircle
};

const getIconComponent = (iconName) => {
  return iconMap[iconName] || MessageSquare;
};

// Color classes for categories
const getColorClasses = (color) => {
  const colorMap = {
    red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', ring: 'ring-red-500' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', ring: 'ring-yellow-500' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', ring: 'ring-blue-500' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', ring: 'ring-orange-500' },
    green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', ring: 'ring-green-500' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', ring: 'ring-purple-500' },
    gray: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', ring: 'ring-gray-500' }
  };
  return colorMap[color] || colorMap.blue;
};

export default function Feedback() {
  const { user, isAuthenticated } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    categoryId: '',
    subject: '',
    message: '',
    userEmail: '',
    userName: ''
  });

  useEffect(() => {
    loadCategories();
  }, []);

  // Pre-fill user info if authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      setFormData(prev => ({
        ...prev,
        userEmail: user.email || '',
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim()
      }));
    }
  }, [isAuthenticated, user]);

  const loadCategories = async () => {
    try {
      const response = await feedbackApi.getCategories();
      if (response.success) {
        setCategories(response.data || []);
        // Select first category by default
        if (response.data?.length > 0) {
          setFormData(prev => ({ ...prev, categoryId: response.data[0].id }));
        }
      }
    } catch (err) {
      console.error('Error loading categories:', err);
      setError('Failed to load feedback categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.categoryId) {
      setError('Please select a category');
      return;
    }
    if (!formData.subject.trim()) {
      setError('Please enter a subject');
      return;
    }
    if (!formData.message.trim()) {
      setError('Please enter your message');
      return;
    }

    setSubmitting(true);
    try {
      const response = await feedbackApi.submit({
        categoryId: parseInt(formData.categoryId),
        subject: formData.subject.trim(),
        message: formData.message.trim(),
        userEmail: formData.userEmail.trim() || null,
        userName: formData.userName.trim() || null
      });

      if (response.success) {
        setSubmitted(true);
      } else {
        setError(response.message || 'Failed to submit feedback');
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setFormData({
      categoryId: categories[0]?.id || '',
      subject: '',
      message: '',
      userEmail: isAuthenticated ? user?.email || '' : '',
      userName: isAuthenticated ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim() : ''
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-600 mb-6">
            Your feedback has been submitted successfully. We appreciate you taking the time to help us improve.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Submit Another
            </button>
            <Link
              to="/"
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-4">
            <Link to="/" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-3xl font-bold">Send Feedback</h1>
          </div>
          <p className="text-blue-100 text-lg">
            Help us improve by sharing your thoughts, reporting issues, or suggesting new features
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Category Selection */}
            <div className="p-6 border-b border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                What type of feedback do you have?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {categories.map(category => {
                  const IconComponent = getIconComponent(category.icon);
                  const colors = getColorClasses(category.color);
                  const isSelected = formData.categoryId === category.id;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, categoryId: category.id }))}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? `${colors.border} ${colors.bg} ring-2 ${colors.ring}`
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg ${colors.bg} ${colors.text} flex items-center justify-center mb-2`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="font-medium text-gray-900 text-sm">{category.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subject & Message */}
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Brief summary of your feedback"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  maxLength={200}
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Please provide as much detail as possible..."
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Contact Info (optional for anonymous) */}
              {!isAuthenticated && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500 mb-4">
                    Optional: Provide your contact info if you'd like us to follow up
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="userName" className="block text-sm font-medium text-gray-700 mb-1">
                        Your Name
                      </label>
                      <input
                        type="text"
                        id="userName"
                        value={formData.userName}
                        onChange={(e) => setFormData(prev => ({ ...prev, userName: e.target.value }))}
                        placeholder="John Doe"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="userEmail" className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="userEmail"
                        value={formData.userEmail}
                        onChange={(e) => setFormData(prev => ({ ...prev, userEmail: e.target.value }))}
                        placeholder="john@example.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Authenticated user info display */}
              {isAuthenticated && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500">
                    Submitting as <span className="font-medium text-gray-700">{formData.userName || formData.userEmail}</span>
                  </p>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Submit Feedback
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
