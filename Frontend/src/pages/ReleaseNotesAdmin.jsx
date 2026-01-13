import { useState, useEffect } from 'react';
import { releaseNotesApi } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import {
  Plus, Edit2, Trash2, X, Save, Loader2, Check, Eye, EyeOff,
  Calendar, Tag, FileText, Star, Clock, FlaskConical
} from 'lucide-react';

export default function ReleaseNotesAdmin({ embedded = false }) {
  const toast = useToast();
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRelease, setEditingRelease] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    version: '',
    title: '',
    content: '',
    releaseDate: new Date().toISOString().split('T')[0],
    isMajor: false,
    isTest: false
  });

  useEffect(() => {
    loadReleases();
  }, []);

  const loadReleases = async () => {
    setLoading(true);
    try {
      const response = await releaseNotesApi.getAllAdmin();
      if (response.success) {
        setReleases(response.data || []);
      } else {
        toast.error(response.message || 'Failed to load releases');
      }
    } catch (err) {
      console.error('Error loading releases:', err);
      toast.error('Failed to load releases');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingRelease(null);
    setFormData({
      version: '',
      title: '',
      content: '',
      releaseDate: new Date().toISOString().split('T')[0],
      isMajor: false,
      isTest: false
    });
    setShowModal(true);
  };

  const handleOpenEdit = (release) => {
    setEditingRelease(release);
    setFormData({
      version: release.version,
      title: release.title,
      content: release.content,
      releaseDate: release.releaseDate?.split('T')[0] || new Date().toISOString().split('T')[0],
      isMajor: release.isMajor,
      isTest: release.isTest || false
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.version.trim() || !formData.title.trim() || !formData.content.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const data = {
        version: formData.version.trim(),
        title: formData.title.trim(),
        content: formData.content.trim(),
        releaseDate: new Date(formData.releaseDate).toISOString(),
        isMajor: formData.isMajor,
        isTest: formData.isTest
      };

      let response;
      if (editingRelease) {
        response = await releaseNotesApi.update(editingRelease.id, data);
      } else {
        response = await releaseNotesApi.create(data);
      }

      if (response.success) {
        toast.success(editingRelease ? 'Release updated' : 'Release created');
        setShowModal(false);
        loadReleases();
      } else {
        toast.error(response.message || 'Failed to save');
      }
    } catch (err) {
      console.error('Error saving release:', err);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (release) => {
    try {
      const response = await releaseNotesApi.update(release.id, { isActive: !release.isActive });
      if (response.success) {
        toast.success(release.isActive ? 'Release hidden' : 'Release published');
        loadReleases();
      }
    } catch (err) {
      toast.error('Failed to update release');
    }
  };

  const handleToggleTest = async (release) => {
    try {
      const response = await releaseNotesApi.update(release.id, { isTest: !release.isTest });
      if (response.success) {
        toast.success(release.isTest ? 'Test mode disabled - visible to all users' : 'Test mode enabled - only visible to admins');
        loadReleases();
      }
    } catch (err) {
      toast.error('Failed to update release');
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await releaseNotesApi.delete(id);
      if (response.success) {
        toast.success('Release deleted');
        setDeleteConfirm(null);
        loadReleases();
      }
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Release Notes</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage system release announcements shown to users
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          New Release
        </button>
      </div>

      {/* Releases List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : releases.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No release notes yet</p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            Create your first release note
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Version
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Release Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created By
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {releases.map((release) => (
                <tr key={release.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {release.version}
                      </span>
                      {release.isMajor && (
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" title="Major release" />
                      )}
                      {release.isTest && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700" title="Test mode - only visible to admins">
                          <FlaskConical className="w-3 h-3" />
                          Test
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {release.title}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(release.releaseDate)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(release)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        release.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {release.isActive ? (
                        <>
                          <Eye className="w-3 h-3" />
                          Active
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" />
                          Hidden
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {release.createdByName || 'Unknown'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleTest(release)}
                        className={`p-1 rounded ${release.isTest ? 'text-purple-600 hover:bg-purple-50' : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'}`}
                        title={release.isTest ? 'Disable test mode' : 'Enable test mode (only visible to admins)'}
                      >
                        <FlaskConical className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(release)}
                        className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(release.id)}
                        className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {editingRelease ? 'Edit Release Note' : 'Create Release Note'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Version *
                  </label>
                  <input
                    type="text"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    placeholder="e.g., 2.1.0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Release Date *
                  </label>
                  <input
                    type="date"
                    value={formData.releaseDate}
                    onChange={(e) => setFormData({ ...formData, releaseDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="What's new in this release"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content * (Markdown supported)
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={10}
                  placeholder="## New Features&#10;- Feature 1&#10;- Feature 2&#10;&#10;## Bug Fixes&#10;- Fixed issue with..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isMajor"
                    checked={formData.isMajor}
                    onChange={(e) => setFormData({ ...formData, isMajor: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isMajor" className="text-sm text-gray-700">
                    Mark as major release (highlighted with star)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isTest"
                    checked={formData.isTest}
                    onChange={(e) => setFormData({ ...formData, isTest: e.target.checked })}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="isTest" className="text-sm text-gray-700 flex items-center gap-1">
                    <FlaskConical className="w-4 h-4 text-purple-500" />
                    Test mode (only visible to admin users for preview)
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingRelease ? 'Update' : 'Create'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Release?</h3>
            <p className="text-gray-600 mb-4">
              This will permanently delete this release note. Users who dismissed it will no longer see it in their history.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {content}
    </div>
  );
}
