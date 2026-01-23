import { useState, useEffect } from 'react';
import { Plus, Trash2, DollarSign, Edit3, Loader2, ChevronDown, ChevronUp, Tag } from 'lucide-react';
import { tournamentApi } from '../services/api';
import { useToast } from '../contexts/ToastContext';

/**
 * Component for managing fee type templates at the event level.
 * Fee types define the available fee options (e.g., Early Bird, Regular, Late Registration)
 * that can be used by both event fees and division fees.
 */
export default function EventFeeTypesEditor({ eventId, onFeeTypesChange }) {
  const toast = useToast();
  const [feeTypes, setFeeTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingFeeType, setEditingFeeType] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFeeType, setNewFeeType] = useState({
    name: '',
    description: '',
    defaultAmount: 0,
    availableFrom: '',
    availableUntil: '',
    isActive: true
  });

  // Load fee types when eventId changes
  useEffect(() => {
    if (eventId) {
      loadFeeTypes();
    } else {
      setFeeTypes([]);
      setLoading(false);
    }
  }, [eventId]);

  const loadFeeTypes = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const response = await tournamentApi.getEventFeeTypes(eventId);
      if (response.success) {
        setFeeTypes(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load fee types:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFeeType = async () => {
    if (!newFeeType.name.trim()) {
      toast.error('Fee type name is required');
      return;
    }

    setSaving(true);
    try {
      const response = await tournamentApi.createEventFeeType(eventId, {
        name: newFeeType.name,
        description: newFeeType.description,
        defaultAmount: parseFloat(newFeeType.defaultAmount) || 0,
        availableFrom: newFeeType.availableFrom || null,
        availableUntil: newFeeType.availableUntil || null,
        isActive: true,
        sortOrder: feeTypes.length
      });

      if (response.success) {
        setFeeTypes([...feeTypes, response.data]);
        setNewFeeType({ name: '', description: '', defaultAmount: 0, availableFrom: '', availableUntil: '', isActive: true });
        setShowAddForm(false);
        toast.success('Fee type added');
        onFeeTypesChange?.();
      } else {
        toast.error(response.message || 'Failed to add fee type');
      }
    } catch (error) {
      toast.error('Failed to add fee type');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateFeeType = async (feeType) => {
    setSaving(true);
    try {
      const response = await tournamentApi.updateEventFeeType(eventId, feeType.id, {
        name: feeType.name,
        description: feeType.description,
        defaultAmount: parseFloat(feeType.defaultAmount) || 0,
        availableFrom: feeType.availableFrom || null,
        availableUntil: feeType.availableUntil || null,
        isActive: feeType.isActive,
        sortOrder: feeType.sortOrder
      });

      if (response.success) {
        setFeeTypes(feeTypes.map(ft => ft.id === feeType.id ? response.data : ft));
        setEditingFeeType(null);
        toast.success('Fee type updated');
        onFeeTypesChange?.();
      } else {
        toast.error(response.message || 'Failed to update fee type');
      }
    } catch (error) {
      toast.error('Failed to update fee type');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFeeType = async (feeTypeId) => {
    if (!confirm('Delete this fee type? This will fail if any fees are using it.')) return;

    setSaving(true);
    try {
      const response = await tournamentApi.deleteEventFeeType(eventId, feeTypeId);
      if (response.success) {
        setFeeTypes(feeTypes.filter(ft => ft.id !== feeTypeId));
        toast.success('Fee type deleted');
        onFeeTypesChange?.();
      } else {
        toast.error(response.message || 'Failed to delete fee type');
      }
    } catch (error) {
      toast.error('Failed to delete fee type');
    } finally {
      setSaving(false);
    }
  };

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
  };

  const hasFeeTypes = feeTypes.length > 0;
  const activeFeeTypes = feeTypes.filter(ft => ft.isActive && ft.isCurrentlyAvailable);

  if (!eventId) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm text-gray-500">Save the event first to define fee types.</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left p-4 hover:bg-gray-50"
      >
        <div>
          <h4 className="font-medium text-gray-900 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Fee Types
            {hasFeeTypes && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                {feeTypes.length} type{feeTypes.length !== 1 ? 's' : ''}
              </span>
            )}
          </h4>
          {!isExpanded && hasFeeTypes && (
            <p className="text-sm text-gray-500 mt-1">
              {feeTypes.map(ft => ft.name).join(', ')}
            </p>
          )}
          {!isExpanded && !hasFeeTypes && (
            <p className="text-sm text-gray-500 mt-1">
              Define fee types (Early Bird, Regular, Late) that can be used by event and division fees.
            </p>
          )}
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {isExpanded && (
        <div className="p-4 pt-0 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Help text */}
              <p className="text-sm text-gray-500">
                Define fee type templates here. These types can then be used when setting up event fees or division fees.
                Date ranges control when each fee type is available for registration.
              </p>

              {/* Fee type list */}
              {feeTypes.length > 0 && (
                <div className="space-y-2">
                  {feeTypes.map(feeType => (
                    <div key={feeType.id} className={`p-3 border rounded-lg ${feeType.isActive ? 'bg-white' : 'bg-gray-50'}`}>
                      {editingFeeType?.id === feeType.id ? (
                        // Edit mode
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                              <input
                                type="text"
                                value={editingFeeType.name}
                                onChange={(e) => setEditingFeeType({ ...editingFeeType, name: e.target.value })}
                                className="w-full border border-gray-300 rounded p-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Default Amount ($)</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editingFeeType.defaultAmount}
                                onChange={(e) => setEditingFeeType({ ...editingFeeType, defaultAmount: e.target.value })}
                                className="w-full border border-gray-300 rounded p-2 text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                            <input
                              type="text"
                              value={editingFeeType.description || ''}
                              onChange={(e) => setEditingFeeType({ ...editingFeeType, description: e.target.value })}
                              className="w-full border border-gray-300 rounded p-2 text-sm"
                              placeholder="Optional description"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Available From</label>
                              <input
                                type="datetime-local"
                                value={formatDateForInput(editingFeeType.availableFrom)}
                                onChange={(e) => setEditingFeeType({ ...editingFeeType, availableFrom: e.target.value || null })}
                                className="w-full border border-gray-300 rounded p-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Available Until</label>
                              <input
                                type="datetime-local"
                                value={formatDateForInput(editingFeeType.availableUntil)}
                                onChange={(e) => setEditingFeeType({ ...editingFeeType, availableUntil: e.target.value || null })}
                                className="w-full border border-gray-300 rounded p-2 text-sm"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={editingFeeType.isActive}
                                onChange={(e) => setEditingFeeType({ ...editingFeeType, isActive: e.target.checked })}
                                className="rounded"
                              />
                              Active
                            </label>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingFeeType(null)}
                              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateFeeType(editingFeeType)}
                              disabled={saving}
                              className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                            >
                              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        // View mode
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{feeType.name}</span>
                              <span className="text-green-600 font-medium">${feeType.defaultAmount}</span>
                              {!feeType.isActive && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Inactive</span>
                              )}
                              {feeType.isActive && !feeType.isCurrentlyAvailable && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Not in date range</span>
                              )}
                            </div>
                            {feeType.description && (
                              <p className="text-sm text-gray-500 mt-0.5">{feeType.description}</p>
                            )}
                            {(feeType.availableFrom || feeType.availableUntil) && (
                              <p className="text-xs text-gray-400 mt-1">
                                {feeType.availableFrom && `From: ${new Date(feeType.availableFrom).toLocaleDateString()}`}
                                {feeType.availableFrom && feeType.availableUntil && ' - '}
                                {feeType.availableUntil && `Until: ${new Date(feeType.availableUntil).toLocaleDateString()}`}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingFeeType({ ...feeType })}
                              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFeeType(feeType.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add new fee type form */}
              {showAddForm ? (
                <div className="p-3 border border-purple-200 bg-purple-50 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                      <input
                        type="text"
                        value={newFeeType.name}
                        onChange={(e) => setNewFeeType({ ...newFeeType, name: e.target.value })}
                        className="w-full border border-gray-300 rounded p-2 text-sm"
                        placeholder="e.g., Early Bird"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Default Amount ($)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newFeeType.defaultAmount}
                        onChange={(e) => setNewFeeType({ ...newFeeType, defaultAmount: e.target.value })}
                        className="w-full border border-gray-300 rounded p-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={newFeeType.description}
                      onChange={(e) => setNewFeeType({ ...newFeeType, description: e.target.value })}
                      className="w-full border border-gray-300 rounded p-2 text-sm"
                      placeholder="Optional description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Available From</label>
                      <input
                        type="datetime-local"
                        value={newFeeType.availableFrom}
                        onChange={(e) => setNewFeeType({ ...newFeeType, availableFrom: e.target.value })}
                        className="w-full border border-gray-300 rounded p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Available Until</label>
                      <input
                        type="datetime-local"
                        value={newFeeType.availableUntil}
                        onChange={(e) => setNewFeeType({ ...newFeeType, availableUntil: e.target.value })}
                        className="w-full border border-gray-300 rounded p-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setNewFeeType({ name: '', description: '', defaultAmount: 0, availableFrom: '', availableUntil: '', isActive: true });
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddFeeType}
                      disabled={saving || !newFeeType.name.trim()}
                      className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                      Add Fee Type
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="w-full p-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Fee Type
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
