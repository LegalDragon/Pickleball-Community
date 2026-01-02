import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Edit2, Trash2, RotateCcw, Save, X, Search,
  // Building/Location icons
  Building, Building2, Home, Store, Warehouse, Factory, Landmark,
  // People/Access icons
  Users, UserPlus, UserCheck, User, Users2, Lock, Unlock, Key, Shield,
  // Nature/Outdoor icons
  TreePine, Mountain, Waves, Sun, Cloud, Leaf,
  // Activity icons
  CircleDot, Target, Trophy, Medal, Award, Crown, Flame, Zap,
  // Misc icons
  MapPin, Flag, Shuffle, DollarSign, Heart, Star, Globe, Compass, GraduationCap
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { venueTypesApi } from '../services/api';

// Icon options for venue types
const ICON_OPTIONS = [
  // Building/Location
  { value: 'Building', label: 'Building', icon: Building, category: 'Building' },
  { value: 'Building2', label: 'Building 2', icon: Building2, category: 'Building' },
  { value: 'Home', label: 'Home', icon: Home, category: 'Building' },
  { value: 'Store', label: 'Store', icon: Store, category: 'Building' },
  { value: 'Warehouse', label: 'Warehouse', icon: Warehouse, category: 'Building' },
  { value: 'Factory', label: 'Factory', icon: Factory, category: 'Building' },
  { value: 'Landmark', label: 'Landmark', icon: Landmark, category: 'Building' },
  { value: 'GraduationCap', label: 'School', icon: GraduationCap, category: 'Building' },

  // Access/People
  { value: 'Users', label: 'Users (Public)', icon: Users, category: 'Access' },
  { value: 'Lock', label: 'Lock (Private)', icon: Lock, category: 'Access' },
  { value: 'Unlock', label: 'Unlock', icon: Unlock, category: 'Access' },
  { value: 'Key', label: 'Key', icon: Key, category: 'Access' },
  { value: 'Shield', label: 'Shield', icon: Shield, category: 'Access' },
  { value: 'User', label: 'User', icon: User, category: 'Access' },
  { value: 'UserPlus', label: 'User Plus', icon: UserPlus, category: 'Access' },
  { value: 'UserCheck', label: 'User Check', icon: UserCheck, category: 'Access' },
  { value: 'Users2', label: 'Users Group', icon: Users2, category: 'Access' },

  // Nature/Outdoor
  { value: 'TreePine', label: 'Tree Pine', icon: TreePine, category: 'Nature' },
  { value: 'Mountain', label: 'Mountain', icon: Mountain, category: 'Nature' },
  { value: 'Waves', label: 'Waves', icon: Waves, category: 'Nature' },
  { value: 'Sun', label: 'Sun', icon: Sun, category: 'Nature' },
  { value: 'Cloud', label: 'Cloud', icon: Cloud, category: 'Nature' },
  { value: 'Leaf', label: 'Leaf', icon: Leaf, category: 'Nature' },

  // Activity/Sports
  { value: 'CircleDot', label: 'Circle Dot', icon: CircleDot, category: 'Activity' },
  { value: 'Target', label: 'Target', icon: Target, category: 'Activity' },
  { value: 'Trophy', label: 'Trophy', icon: Trophy, category: 'Activity' },
  { value: 'Medal', label: 'Medal', icon: Medal, category: 'Activity' },
  { value: 'Award', label: 'Award', icon: Award, category: 'Activity' },
  { value: 'Crown', label: 'Crown', icon: Crown, category: 'Activity' },
  { value: 'Flame', label: 'Flame', icon: Flame, category: 'Activity' },
  { value: 'Zap', label: 'Zap', icon: Zap, category: 'Activity' },

  // Misc
  { value: 'MapPin', label: 'Map Pin', icon: MapPin, category: 'Misc' },
  { value: 'Flag', label: 'Flag', icon: Flag, category: 'Misc' },
  { value: 'Shuffle', label: 'Shuffle (Mixed)', icon: Shuffle, category: 'Misc' },
  { value: 'DollarSign', label: 'Dollar Sign', icon: DollarSign, category: 'Misc' },
  { value: 'Heart', label: 'Heart', icon: Heart, category: 'Misc' },
  { value: 'Star', label: 'Star', icon: Star, category: 'Misc' },
  { value: 'Globe', label: 'Globe', icon: Globe, category: 'Misc' },
  { value: 'Compass', label: 'Compass', icon: Compass, category: 'Misc' },
];

const COLOR_OPTIONS = [
  { value: 'green', label: 'Green', class: 'bg-green-500', bgClass: 'bg-green-100', textClass: 'text-green-700' },
  { value: 'blue', label: 'Blue', class: 'bg-blue-500', bgClass: 'bg-blue-100', textClass: 'text-blue-700' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500', bgClass: 'bg-yellow-100', textClass: 'text-yellow-700' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500', bgClass: 'bg-purple-100', textClass: 'text-purple-700' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500', bgClass: 'bg-pink-100', textClass: 'text-pink-700' },
  { value: 'red', label: 'Red', class: 'bg-red-500', bgClass: 'bg-red-100', textClass: 'text-red-700' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500', bgClass: 'bg-orange-100', textClass: 'text-orange-700' },
  { value: 'teal', label: 'Teal', class: 'bg-teal-500', bgClass: 'bg-teal-100', textClass: 'text-teal-700' },
  { value: 'indigo', label: 'Indigo', class: 'bg-indigo-500', bgClass: 'bg-indigo-100', textClass: 'text-indigo-700' },
  { value: 'cyan', label: 'Cyan', class: 'bg-cyan-500', bgClass: 'bg-cyan-100', textClass: 'text-cyan-700' },
  { value: 'emerald', label: 'Emerald', class: 'bg-emerald-500', bgClass: 'bg-emerald-100', textClass: 'text-emerald-700' },
  { value: 'rose', label: 'Rose', class: 'bg-rose-500', bgClass: 'bg-rose-100', textClass: 'text-rose-700' },
  { value: 'amber', label: 'Amber', class: 'bg-amber-500', bgClass: 'bg-amber-100', textClass: 'text-amber-700' },
  { value: 'slate', label: 'Slate', class: 'bg-slate-500', bgClass: 'bg-slate-100', textClass: 'text-slate-700' },
];

// Get unique categories
const ICON_CATEGORIES = [...new Set(ICON_OPTIONS.map(o => o.category))];

export default function VenueTypesAdmin({ embedded = false }) {
  const { user } = useAuth();
  const [venueTypes, setVenueTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'Building2',
    color: 'green',
    sortOrder: 0,
    isActive: true
  });
  const [iconSearch, setIconSearch] = useState('');
  const [iconCategory, setIconCategory] = useState('All');
  const [error, setError] = useState('');

  // Filter icons based on search and category
  const filteredIcons = useMemo(() => {
    return ICON_OPTIONS.filter(option => {
      const matchesSearch = iconSearch === '' ||
        option.label.toLowerCase().includes(iconSearch.toLowerCase()) ||
        option.value.toLowerCase().includes(iconSearch.toLowerCase());
      const matchesCategory = iconCategory === 'All' || option.category === iconCategory;
      return matchesSearch && matchesCategory;
    });
  }, [iconSearch, iconCategory]);

  useEffect(() => {
    loadCourtTypes();
  }, [showInactive]);

  const loadCourtTypes = async () => {
    setLoading(true);
    try {
      const response = await venueTypesApi.getAll(showInactive);
      if (response.success) {
        setVenueTypes(response.data || []);
      }
    } catch (err) {
      console.error('Error loading venue types:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingType(null);
    setFormData({
      name: '',
      description: '',
      icon: 'Building2',
      color: 'green',
      sortOrder: venueTypes.length,
      isActive: true
    });
    setIconSearch('');
    setIconCategory('All');
    setError('');
    setIsModalOpen(true);
  };

  const handleEdit = (venueType) => {
    setEditingType(venueType);
    setFormData({
      name: venueType.name,
      description: venueType.description || '',
      icon: venueType.icon || 'Building2',
      color: venueType.color || 'green',
      sortOrder: venueType.sortOrder,
      isActive: venueType.isActive
    });
    setIconSearch('');
    setIconCategory('All');
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    setError('');
    try {
      if (editingType) {
        const response = await venueTypesApi.update(editingType.id, formData);
        if (response.success) {
          setVenueTypes(venueTypes.map(ct =>
            ct.id === editingType.id ? response.data : ct
          ));
          setIsModalOpen(false);
        } else {
          setError(response.message || 'Failed to update venue type');
        }
      } else {
        const response = await venueTypesApi.create(formData);
        if (response.success) {
          setVenueTypes([...venueTypes, response.data]);
          setIsModalOpen(false);
        } else {
          setError(response.message || 'Failed to create venue type');
        }
      }
    } catch (err) {
      console.error('Error saving venue type:', err);
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred while saving';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (venueType) => {
    if (!confirm(`Are you sure you want to deactivate "${venueType.name}"?`)) return;

    try {
      const response = await venueTypesApi.delete(venueType.id);
      if (response.success) {
        if (showInactive) {
          setVenueTypes(venueTypes.map(ct =>
            ct.id === venueType.id ? { ...ct, isActive: false } : ct
          ));
        } else {
          setVenueTypes(venueTypes.filter(ct => ct.id !== venueType.id));
        }
      }
    } catch (err) {
      console.error('Error deleting venue type:', err);
    }
  };

  const handleRestore = async (venueType) => {
    try {
      const response = await venueTypesApi.restore(venueType.id);
      if (response.success) {
        setVenueTypes(venueTypes.map(ct =>
          ct.id === venueType.id ? response.data : ct
        ));
      }
    } catch (err) {
      console.error('Error restoring venue type:', err);
    }
  };

  const getIconComponent = (iconName) => {
    const option = ICON_OPTIONS.find(o => o.value === iconName);
    if (option) {
      const IconComponent = option.icon;
      return <IconComponent className="w-5 h-5" />;
    }
    return <Building2 className="w-5 h-5" />;
  };

  const getColorClass = (colorName) => {
    const option = COLOR_OPTIONS.find(o => o.value === colorName);
    return option?.class || 'bg-gray-500';
  };

  // Check if user is admin
  if (user?.role !== 'Admin') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
          <Link to="/" className="mt-4 inline-block text-green-600 hover:underline">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  const content = (
    <>
      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="mb-6 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Show inactive venue types
          </label>
          <span className="text-sm text-gray-500">
            {venueTypes.length} venue type{venueTypes.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Venue Types List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
          </div>
        ) : venueTypes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Venue Types</h3>
            <p className="text-gray-500 mb-6">Get started by adding your first venue type.</p>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-5 h-5" />
              Add Venue Type
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Venue Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {venueTypes.map((venueType) => (
                  <tr key={venueType.id} className={!venueType.isActive ? 'bg-gray-50 opacity-60' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${getColorClass(venueType.color)} flex items-center justify-center text-white`}>
                          {getIconComponent(venueType.icon)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{venueType.name}</div>
                          <div className="text-xs text-gray-500">Order: {venueType.sortOrder}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {venueType.description || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {venueType.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(venueType)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {venueType.isActive ? (
                          <button
                            onClick={() => handleDelete(venueType)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Deactivate"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRestore(venueType)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Restore"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
            {/* Fixed Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingType ? 'Edit Venue Type' : 'Add Venue Type'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Error Message */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Public"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this venue type..."
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                {/* Icon Picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Icon
                  </label>
                  {/* Search and Category Filter */}
                  <div className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={iconSearch}
                        onChange={(e) => setIconSearch(e.target.value)}
                        placeholder="Search icons..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <select
                      value={iconCategory}
                      onChange={(e) => setIconCategory(e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="All">All</option>
                      {ICON_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  {/* Icon Grid */}
                  <div className="h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {filteredIcons.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        No icons found
                      </div>
                    ) : (
                      <div className="grid grid-cols-8 gap-1">
                        {filteredIcons.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, icon: option.value })}
                            className={`p-2 rounded-lg border-2 transition-all ${
                              formData.icon === option.value
                                ? 'border-green-500 bg-green-50 text-green-600 scale-105'
                                : 'border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                            }`}
                            title={`${option.label} (${option.category})`}
                          >
                            <option.icon className="w-5 h-5" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {filteredIcons.length} icons available
                  </div>
                </div>

                {/* Color Picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Background Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: option.value })}
                        className={`w-8 h-8 rounded-lg ${option.class} transition-all flex items-center justify-center ${
                          formData.color === option.value
                            ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                            : 'hover:scale-105'
                        }`}
                        title={option.label}
                      >
                        {formData.color === option.value && (
                          <span className="text-white text-sm font-bold">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort Order & Active */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                      min="0"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer pb-2">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700">Active</span>
                    </label>
                  </div>
                </div>

                {/* Preview */}
                <div className="pt-4 border-t">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preview
                  </label>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-12 h-12 rounded-lg ${getColorClass(formData.color)} flex items-center justify-center text-white`}>
                      {getIconComponent(formData.icon)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{formData.name || 'Venue Type Name'}</div>
                      <div className="text-sm text-gray-500">{formData.description || 'Description...'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fixed Footer with Actions */}
              <div className="flex gap-3 p-4 border-t bg-gray-50 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.name.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingType ? 'Update' : 'Create'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Venue Types</h1>
                <p className="text-sm text-gray-500">Manage court categories (Public, Private, Commercial, etc.)</p>
              </div>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Venue Type
            </button>
          </div>
        </div>
      </div>

      {content}
    </div>
  );
}
