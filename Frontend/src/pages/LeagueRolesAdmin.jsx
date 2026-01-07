import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Edit2, Trash2, RotateCcw, Save, X,
  Users, Shield, UserCog, Lock, Crown, DollarSign,
  Star, Heart, Award, Briefcase, Calendar, ClipboardList, Flag,
  Key, Medal, Settings, Trophy, Wrench, Zap, FileText, CheckCircle, Network
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { leagueRolesApi } from '../services/api';

const ICON_OPTIONS = [
  { value: 'Crown', label: 'Crown', icon: Crown },
  { value: 'Shield', label: 'Shield', icon: Shield },
  { value: 'DollarSign', label: 'Money', icon: DollarSign },
  { value: 'Users', label: 'Users', icon: Users },
  { value: 'Star', label: 'Star', icon: Star },
  { value: 'Heart', label: 'Heart', icon: Heart },
  { value: 'Award', label: 'Award', icon: Award },
  { value: 'Medal', label: 'Medal', icon: Medal },
  { value: 'Trophy', label: 'Trophy', icon: Trophy },
  { value: 'Briefcase', label: 'Briefcase', icon: Briefcase },
  { value: 'Calendar', label: 'Calendar', icon: Calendar },
  { value: 'ClipboardList', label: 'Clipboard', icon: ClipboardList },
  { value: 'Flag', label: 'Flag', icon: Flag },
  { value: 'Key', label: 'Key', icon: Key },
  { value: 'Settings', label: 'Settings', icon: Settings },
  { value: 'Wrench', label: 'Wrench', icon: Wrench },
  { value: 'Zap', label: 'Zap', icon: Zap },
  { value: 'Network', label: 'Network', icon: Network },
  { value: 'UserCog', label: 'User Cog', icon: UserCog },
];

const getIconComponent = (iconName) => {
  const option = ICON_OPTIONS.find(o => o.value === iconName);
  return option?.icon || Users;
};

const COLOR_OPTIONS = [
  { value: 'red', label: 'Red', class: 'bg-red-500', bgClass: 'bg-red-100', textClass: 'text-red-700' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500', bgClass: 'bg-orange-100', textClass: 'text-orange-700' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500', bgClass: 'bg-yellow-100', textClass: 'text-yellow-700' },
  { value: 'green', label: 'Green', class: 'bg-green-500', bgClass: 'bg-green-100', textClass: 'text-green-700' },
  { value: 'teal', label: 'Teal', class: 'bg-teal-500', bgClass: 'bg-teal-100', textClass: 'text-teal-700' },
  { value: 'blue', label: 'Blue', class: 'bg-blue-500', bgClass: 'bg-blue-100', textClass: 'text-blue-700' },
  { value: 'indigo', label: 'Indigo', class: 'bg-indigo-500', bgClass: 'bg-indigo-100', textClass: 'text-indigo-700' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500', bgClass: 'bg-purple-100', textClass: 'text-purple-700' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500', bgClass: 'bg-pink-100', textClass: 'text-pink-700' },
  { value: 'gray', label: 'Gray', class: 'bg-gray-500', bgClass: 'bg-gray-100', textClass: 'text-gray-700' },
];

export default function LeagueRolesAdmin({ embedded = false }) {
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: 'blue',
    icon: 'Users',
    sortOrder: 50,
    canManageLeague: false,
    canManageMembers: false,
    canManageClubs: false,
    canManageDocuments: false,
    canApproveRequests: false,
    isActive: true
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadRoles();
  }, [showInactive]);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const response = await leagueRolesApi.getAll(showInactive);
      if (response.success) {
        setRoles(response.data || []);
      }
    } catch (err) {
      console.error('Error loading league roles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      description: '',
      color: 'blue',
      icon: 'Users',
      sortOrder: roles.length * 10 + 10,
      canManageLeague: false,
      canManageMembers: false,
      canManageClubs: false,
      canManageDocuments: false,
      canApproveRequests: false,
      isActive: true
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleEdit = (role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      color: role.color || 'blue',
      icon: role.icon || 'Users',
      sortOrder: role.sortOrder,
      canManageLeague: role.canManageLeague,
      canManageMembers: role.canManageMembers,
      canManageClubs: role.canManageClubs,
      canManageDocuments: role.canManageDocuments,
      canApproveRequests: role.canApproveRequests,
      isActive: role.isActive
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    setError('');
    try {
      if (editingRole) {
        const response = await leagueRolesApi.update(editingRole.id, formData);
        if (response.success) {
          setRoles(roles.map(r =>
            r.id === editingRole.id ? response.data : r
          ));
          setIsModalOpen(false);
        } else {
          setError(response.message || 'Failed to update role');
        }
      } else {
        const response = await leagueRolesApi.create(formData);
        if (response.success) {
          setRoles([...roles, response.data]);
          setIsModalOpen(false);
        } else {
          setError(response.message || 'Failed to create role');
        }
      }
    } catch (err) {
      console.error('Error saving role:', err);
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred while saving';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role) => {
    if (role.isSystemRole) {
      alert('Cannot delete system roles');
      return;
    }
    if (!confirm(`Are you sure you want to delete "${role.name}"?`)) return;

    try {
      const response = await leagueRolesApi.delete(role.id);
      if (response.success) {
        if (showInactive) {
          setRoles(roles.map(r =>
            r.id === role.id ? { ...r, isActive: false } : r
          ));
        } else {
          setRoles(roles.filter(r => r.id !== role.id));
        }
      }
    } catch (err) {
      console.error('Error deleting role:', err);
    }
  };

  const handleRestore = async (role) => {
    try {
      const response = await leagueRolesApi.restore(role.id);
      if (response.success) {
        setRoles(roles.map(r =>
          r.id === role.id ? response.data : r
        ));
      }
    } catch (err) {
      console.error('Error restoring role:', err);
    }
  };

  const getColorClass = (colorName) => {
    const option = COLOR_OPTIONS.find(o => o.value === colorName);
    return option?.class || 'bg-gray-500';
  };

  const getColorBgClass = (colorName) => {
    const option = COLOR_OPTIONS.find(o => o.value === colorName);
    return option?.bgClass || 'bg-gray-100';
  };

  const getColorTextClass = (colorName) => {
    const option = COLOR_OPTIONS.find(o => o.value === colorName);
    return option?.textClass || 'text-gray-700';
  };

  // Check if user is admin
  if (user?.role !== 'Admin') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
          <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">
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
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Show inactive roles
          </label>
          <span className="text-sm text-gray-500">
            {roles.length} role{roles.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Roles List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : roles.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Network className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Roles</h3>
            <p className="text-gray-500 mb-6">Get started by adding your first league role.</p>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Role
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Permissions
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
                {roles.map((role) => (
                  <tr key={role.id} className={!role.isActive ? 'bg-gray-50 opacity-60' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${getColorClass(role.color)} flex items-center justify-center text-white`}>
                          {(() => {
                            const IconComponent = role.isSystemRole ? Lock : getIconComponent(role.icon);
                            return <IconComponent className="w-5 h-5" />;
                          })()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{role.name}</span>
                            {role.isSystemRole && (
                              <span className="px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">System</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{role.description || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {role.canManageLeague && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            <Settings className="w-3 h-3" />
                            League
                          </span>
                        )}
                        {role.canManageMembers && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            <Users className="w-3 h-3" />
                            Members
                          </span>
                        )}
                        {role.canManageClubs && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <Network className="w-3 h-3" />
                            Clubs
                          </span>
                        )}
                        {role.canManageDocuments && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                            <FileText className="w-3 h-3" />
                            Docs
                          </span>
                        )}
                        {role.canApproveRequests && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
                            <CheckCircle className="w-3 h-3" />
                            Approve
                          </span>
                        )}
                        {!role.canManageLeague && !role.canManageMembers && !role.canManageClubs && !role.canManageDocuments && !role.canApproveRequests && (
                          <span className="text-xs text-gray-400">No special permissions</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {role.isActive ? (
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
                          onClick={() => handleEdit(role)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {role.isActive ? (
                          <button
                            onClick={() => handleDelete(role)}
                            disabled={role.isSystemRole}
                            className={`p-2 rounded-lg transition-colors ${
                              role.isSystemRole
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={role.isSystemRole ? 'Cannot delete system roles' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRestore(role)}
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
                {editingRole ? 'Edit Role' : 'Add Role'}
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

                {/* System role warning */}
                {editingRole?.isSystemRole && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    This is a system role. Name cannot be changed.
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
                    placeholder="e.g., Regional Director"
                    disabled={editingRole?.isSystemRole}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
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
                    placeholder="Brief description of this role..."
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Color Picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Badge Color
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
                          <span className="text-white text-sm font-bold">&#10003;</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Icon Picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Icon
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ICON_OPTIONS.map((option) => {
                      const IconComp = option.icon;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, icon: option.value })}
                          className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all ${
                            formData.icon === option.value
                              ? 'border-blue-500 bg-blue-50 text-blue-600 scale-110'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:scale-105'
                          }`}
                          title={option.label}
                        >
                          <IconComp className="w-5 h-5" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sort Order */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
                </div>

                {/* Permissions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Permissions
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.canManageLeague}
                        onChange={(e) => setFormData({ ...formData, canManageLeague: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <Settings className="w-4 h-4 text-purple-600" />
                      <span className="text-sm text-gray-700">Can manage league settings</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.canManageMembers}
                        onChange={(e) => setFormData({ ...formData, canManageMembers: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-gray-700">Can manage league managers</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.canManageClubs}
                        onChange={(e) => setFormData({ ...formData, canManageClubs: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <Network className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-gray-700">Can manage member clubs</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.canManageDocuments}
                        onChange={(e) => setFormData({ ...formData, canManageDocuments: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <FileText className="w-4 h-4 text-orange-600" />
                      <span className="text-sm text-gray-700">Can manage documents</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.canApproveRequests}
                        onChange={(e) => setFormData({ ...formData, canApproveRequests: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <CheckCircle className="w-4 h-4 text-teal-600" />
                      <span className="text-sm text-gray-700">Can approve club join requests</span>
                    </label>
                  </div>
                </div>

                {/* Active */}
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                </div>

                {/* Preview */}
                <div className="pt-4 border-t">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preview
                  </label>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-10 h-10 rounded-lg ${getColorClass(formData.color)} flex items-center justify-center text-white`}>
                      {(() => {
                        const IconComponent = getIconComponent(formData.icon);
                        return <IconComponent className="w-5 h-5" />;
                      })()}
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-sm font-medium ${getColorBgClass(formData.color)} ${getColorTextClass(formData.color)}`}>
                      {formData.name || 'Role Name'}
                    </span>
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
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingRole ? 'Update' : 'Create'}
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
                <h1 className="text-2xl font-bold text-gray-900">League Roles</h1>
                <p className="text-sm text-gray-500">Define roles and permissions for league managers</p>
              </div>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Role
            </button>
          </div>
        </div>
      </div>

      {content}
    </div>
  );
}
