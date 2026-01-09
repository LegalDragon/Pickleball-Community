import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2, RotateCcw, Save, X, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { teamUnitsApi } from '../services/api';

export default function TeamUnitsAdmin({ embedded = false }) {
  const { user } = useAuth();
  const [teamUnits, setTeamUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    unitCode: '',
    description: '',
    maleCount: 0,
    femaleCount: 0,
    unisexCount: 2,
    sortOrder: 0,
    isActive: true
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadTeamUnits();
  }, [showInactive]);

  const loadTeamUnits = async () => {
    setLoading(true);
    try {
      const response = showInactive
        ? await teamUnitsApi.getAllIncludingInactive()
        : await teamUnitsApi.getAll();
      if (response.success) {
        setTeamUnits(response.data || []);
      }
    } catch (err) {
      console.error('Error loading team units:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingUnit(null);
    setFormData({
      name: '',
      unitCode: '',
      description: '',
      maleCount: 0,
      femaleCount: 0,
      unisexCount: 2,
      sortOrder: teamUnits.length,
      isActive: true
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleEdit = (unit) => {
    setEditingUnit(unit);
    setFormData({
      name: unit.name,
      unitCode: unit.unitCode || '',
      description: unit.description || '',
      maleCount: unit.maleCount || 0,
      femaleCount: unit.femaleCount || 0,
      unisexCount: unit.unisexCount || 0,
      sortOrder: unit.sortOrder,
      isActive: unit.isActive
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
      if (editingUnit) {
        const response = await teamUnitsApi.update(editingUnit.id, formData);
        if (response.success) {
          setTeamUnits(teamUnits.map(u => u.id === editingUnit.id ? response.data : u));
          setIsModalOpen(false);
        } else {
          setError(response.message || 'Failed to update team unit');
        }
      } else {
        const response = await teamUnitsApi.create(formData);
        if (response.success) {
          setTeamUnits([...teamUnits, response.data]);
          setIsModalOpen(false);
        } else {
          setError(response.message || 'Failed to create team unit');
        }
      }
    } catch (err) {
      console.error('Error saving team unit:', err);
      setError(err.message || 'An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (unit) => {
    if (!confirm(`Are you sure you want to deactivate "${unit.name}"?`)) return;
    try {
      const response = await teamUnitsApi.delete(unit.id);
      if (response.success) {
        if (showInactive) {
          setTeamUnits(teamUnits.map(u => u.id === unit.id ? { ...u, isActive: false } : u));
        } else {
          setTeamUnits(teamUnits.filter(u => u.id !== unit.id));
        }
      }
    } catch (err) {
      console.error('Error deleting team unit:', err);
    }
  };

  const getTotalPlayers = (unit) => {
    return (unit.maleCount || 0) + (unit.femaleCount || 0) + (unit.unisexCount || 0);
  };

  const getPlayerBreakdown = (unit) => {
    const parts = [];
    if (unit.maleCount > 0) parts.push(`${unit.maleCount}M`);
    if (unit.femaleCount > 0) parts.push(`${unit.femaleCount}F`);
    if (unit.unisexCount > 0) parts.push(`${unit.unisexCount} Any`);
    return parts.length > 0 ? parts.join(' + ') : 'No players defined';
  };

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
        {/* Header with Add button for embedded mode */}
        {embedded && (
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Team Units</h2>
              <p className="text-sm text-gray-500">Manage division team configurations</p>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Team Unit
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Show inactive team units
          </label>
          <span className="text-sm text-gray-500">
            {teamUnits.length} team unit{teamUnits.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Team Units List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
          </div>
        ) : teamUnits.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Team Units</h3>
            <p className="text-gray-500 mb-6">Get started by adding your first team unit configuration.</p>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-5 h-5" />
              Add Team Unit
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Player Configuration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
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
                {teamUnits.map((unit) => (
                  <tr key={unit.id} className={!unit.isActive ? 'bg-gray-50 opacity-60' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900">{unit.name}</div>
                        {unit.description && (
                          <div className="text-xs text-gray-500">{unit.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {unit.unitCode ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-gray-100 text-gray-700 text-sm font-mono">
                          {unit.unitCode}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{getPlayerBreakdown(unit)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{getTotalPlayers(unit)} players</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {unit.isActive ? (
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
                          onClick={() => handleEdit(unit)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {unit.isActive && (
                          <button
                            onClick={() => handleDelete(unit)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Deactivate"
                          >
                            <Trash2 className="w-4 h-4" />
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
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingUnit ? 'Edit Team Unit' : 'Add Team Unit'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Men's Doubles"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Code</label>
                  <input
                    type="text"
                    value={formData.unitCode}
                    onChange={(e) => setFormData({ ...formData, unitCode: e.target.value.toUpperCase() })}
                    placeholder="e.g., MD"
                    maxLength={20}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500 font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description..."
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Male Players</label>
                  <input
                    type="number"
                    value={formData.maleCount}
                    onChange={(e) => setFormData({ ...formData, maleCount: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Female Players</label>
                  <input
                    type="number"
                    value={formData.femaleCount}
                    onChange={(e) => setFormData({ ...formData, femaleCount: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Any Gender</label>
                  <input
                    type="number"
                    value={formData.unisexCount}
                    onChange={(e) => setFormData({ ...formData, unisexCount: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <span className="font-medium">Total Players: </span>
                {(formData.maleCount || 0) + (formData.femaleCount || 0) + (formData.unisexCount || 0)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
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

              <div className="flex gap-3 pt-4 border-t">
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
                      {editingUnit ? 'Update' : 'Create'}
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
                <h1 className="text-2xl font-bold text-gray-900">Team Units</h1>
                <p className="text-sm text-gray-500">Manage division team configurations (e.g., Men's Doubles, Mixed Doubles)</p>
              </div>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Team Unit
            </button>
          </div>
        </div>
      </div>

      {content}
    </div>
  );
}
