import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Search, HelpCircle, ArrowLeft, Sparkles, BookOpen } from 'lucide-react';
import { faqApi } from '../services/api';

// Icon mapping for categories
const getIconComponent = (iconName) => {
  // Default icon
  return HelpCircle;
};

// Color classes for categories
const getColorClasses = (color) => {
  const colorMap = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
    red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
    pink: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
    teal: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' }
  };
  return colorMap[color] || colorMap.blue;
};

export default function Faq() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEntries, setExpandedEntries] = useState({});
  const [activeCategory, setActiveCategory] = useState(null);

  useEffect(() => {
    loadFaq();
  }, []);

  const loadFaq = async () => {
    setLoading(true);
    try {
      const response = await faqApi.getAll();
      if (response.success) {
        setCategories(response.data || []);
        // Expand first entry of each category by default
        const initialExpanded = {};
        (response.data || []).forEach(cat => {
          if (cat.entries && cat.entries.length > 0) {
            initialExpanded[cat.entries[0].id] = true;
          }
        });
        setExpandedEntries(initialExpanded);
      }
    } catch (err) {
      console.error('Error loading FAQ:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleEntry = (entryId) => {
    setExpandedEntries(prev => ({
      ...prev,
      [entryId]: !prev[entryId]
    }));
  };

  // Filter entries based on search
  const filteredCategories = categories.map(category => ({
    ...category,
    entries: category.entries.filter(entry =>
      entry.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category =>
    category.entries.length > 0 ||
    category.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Scroll to category
  const scrollToCategory = (categoryId) => {
    setActiveCategory(categoryId);
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-4">
            <Link to="/" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-3xl font-bold">Frequently Asked Questions</h1>
          </div>
          <p className="text-green-100 text-lg mb-6">
            Find answers to common questions about our pickleball community platform
          </p>

          {/* Search */}
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for answers..."
              className="w-full pl-12 pr-4 py-3 bg-white rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-300"
            />
          </div>

          {/* Related links */}
          <div className="flex flex-wrap gap-3 mt-6">
            <Link
              to="/features"
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Features & Guide
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
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-600"></div>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-center py-12">
            <HelpCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Results Found</h3>
            <p className="text-gray-500">
              {searchQuery ? 'Try a different search term' : 'No FAQ entries available'}
            </p>
          </div>
        ) : (
          <>
            {/* Category Quick Links */}
            {!searchQuery && (
              <div className="flex flex-wrap gap-2 mb-8">
                {categories.map(category => {
                  const colors = getColorClasses(category.color);
                  return (
                    <button
                      key={category.id}
                      onClick={() => scrollToCategory(category.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        activeCategory === category.id
                          ? `${colors.bg} ${colors.text}`
                          : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* FAQ Categories and Entries */}
            <div className="space-y-8">
              {filteredCategories.map(category => {
                const colors = getColorClasses(category.color);
                return (
                  <div key={category.id} id={`category-${category.id}`} className="scroll-mt-4">
                    {/* Category Header */}
                    <div className={`flex items-center gap-3 mb-4 pb-3 border-b ${colors.border}`}>
                      <div className={`w-10 h-10 rounded-lg ${colors.bg} ${colors.text} flex items-center justify-center`}>
                        <HelpCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">{category.name}</h2>
                        {category.description && (
                          <p className="text-sm text-gray-500">{category.description}</p>
                        )}
                      </div>
                      <span className="ml-auto bg-gray-100 text-gray-600 text-sm px-2 py-1 rounded-full">
                        {category.entries.length} questions
                      </span>
                    </div>

                    {/* Entries */}
                    <div className="space-y-3">
                      {category.entries.map(entry => (
                        <div
                          key={entry.id}
                          className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                        >
                          <button
                            onClick={() => toggleEntry(entry.id)}
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                          >
                            <span className="font-medium text-gray-900 pr-4">{entry.question}</span>
                            {expandedEntries[entry.id] ? (
                              <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            )}
                          </button>
                          {expandedEntries[entry.id] && (
                            <div className="px-4 pb-4 pt-0">
                              <div className="border-t border-gray-100 pt-4">
                                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                                  {entry.answer}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Contact Section */}
            <div className="mt-12 bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Still have questions?</h3>
              <p className="text-gray-600 mb-4">
                Can't find what you're looking for? Feel free to reach out to us.
              </p>
              <a
                href="mailto:support@pickleball.community"
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Contact Support
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
