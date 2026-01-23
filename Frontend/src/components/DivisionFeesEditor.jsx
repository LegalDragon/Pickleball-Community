import { useState, useEffect } from 'react';
import { Plus, Trash2, DollarSign, Edit3, Check, X, Loader2, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { tournamentApi } from '../services/api';
import { useToast } from '../contexts/ToastContext';

/**
 * Component for managing multiple fee options for a division
 * Used in the Edit Division modal in Events.jsx
 */
export default function DivisionFeesEditor({ divisionId, divisionFee, onFeesChange }) {
  const toast = useToast();
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingFee, setEditingFee] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFee, setNewFee] = useState({
    name: '',
    description: '',
    amount: 0,
    isDefault: false,
    availableFrom: '',
    availableUntil: '',
    isActive: true
  });

  // Load fees when divisionId changes
  useEffect(() => {
    if (divisionId) {
      loadFees();
    } else {
      setFees([]);
      setLoading(false);
    }
  }, [divisionId]);

  const loadFees = async () => {
    if (!divisionId) return;
    setLoading(true);
    try {
      const response = await tournamentApi.getDivisionFees(divisionId);
      if (response.success) {
        setFees(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load fees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFee = async () => {
    if (!newFee.name.trim()) {
      toast.error('Fee name is required');
      return;
    }

    setSaving(true);
    try {
      const response = await tournamentApi.createDivisionFee(divisionId, {
        name: newFee.name,
        description: newFee.description,
        amount: parseFloat(newFee.amount) || 0,
        isDefault: newFee.isDefault,
        availableFrom: newFee.availableFrom || null,
        availableUntil: newFee.availableUntil || null,
        isActive: true,
        sortOrder: fees.length
      });

      if (response.success) {
        setFees([...fees, response.data]);
        setNewFee({ name: '', description: '', amount: 0, isDefault: false, availableFrom: '', availableUntil: '', isActive: true });
        setShowAddForm(false);
        toast.success('Fee added');
        onFeesChange?.();
      } else {
        toast.error(response.message || 'Failed to add fee');
      }
    } catch (error) {
      toast.error('Failed to add fee');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateFee = async (fee) => {
    setSaving(true);
    try {
      const response = await tournamentApi.updateDivisionFee(divisionId, fee.id, {
        name: fee.name,
        description: fee.description,
        amount: parseFloat(fee.amount) || 0,
        isDefault: fee.isDefault,
        availableFrom: fee.availableFrom || null,
        availableUntil: fee.availableUntil || null,
        isActive: fee.isActive,
        sortOrder: fee.sortOrder
      });

      if (response.success) {
        setFees(fees.map(f => f.id === fee.id ? response.data : f));
        setEditingFee(null);
        toast.success('Fee updated');
        onFeesChange?.();
      } else {
        toast.error(response.message || 'Failed to update fee');
      }
    } catch (error) {
      toast.error('Failed to update fee');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFee = async (feeId) => {
    if (!confirm('Delete this fee option?')) return;

    setSaving(true);
    try {
      const response = await tournamentApi.deleteDivisionFee(divisionId, feeId);
      if (response.success) {
        setFees(fees.filter(f => f.id !== feeId));
        toast.success('Fee deleted');
        onFeesChange?.();
      } else {
        toast.error(response.message || 'Failed to delete fee');
      }
    } catch (error) {
      toast.error('Failed to delete fee');
    } finally {
      setSaving(false);
    }
  };

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
  };

  // Show summary when collapsed
  const hasFees = fees.length > 0;
  const defaultFee = fees.find(f => f.isDefault);
  const activeFees = fees.filter(f => f.isActive && f.isCurrentlyAvailable);

  if (!divisionId) {
    return (
      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm text-gray-500">Save the division first to add multiple fee options.</p>
      </div>
    );
  }

  return (
    <div className="border-t pt-4 mt-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h4 className="font-medium text-gray-900 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Fee Options
            {hasFees && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {fees.length} option{fees.length !== 1 ? 's' : ''}
              </span>
            )}
          </h4>
          {!isExpanded && hasFees && (
            <p className="text-sm text-gray-500 mt-1">
              {activeFees.length > 0
                ? `${activeFees.length} active: ${activeFees.map(f => `${f.name} ($${f.amount})`).join(', ')}`
                : 'No currently available fees'}
            </p>
          )}
          {!isExpanded && !hasFees && divisionFee > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              Using single fee: ${divisionFee}
            </p>
          )}
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Help text */}
              <p className="text-sm text-gray-500">
                Add multiple fee options (e.g., Early Bird, Regular, Late Registration).
                If no fee options are defined, the single division fee above will be used.
              </p>

              {/* Fee list */}
              {fees.length > 0 && (
                <div className="space-y-2">
                  {fees.map(fee => (
                    <div key={fee.id} className={`p-3 border rounded-lg ${fee.isActive ? 'bg-white' : 'bg-gray-50'}`}>
                      {editingFee?.id === fee.id ? (
                        // Edit mode
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                              <input
                                type="text"
                                value={editingFee.name}
                                onChange={(e) => setEditingFee({ ...editingFee, name: e.target.value })}
                                className="w-full border border-gray-300 rounded p-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Amount ($)</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editingFee.amount}
                                onChange={(e) => setEditingFee({ ...editingFee, amount: e.target.value })}
                                className="w-full border border-gray-300 rounded p-2 text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                            <input
                              type="text"
                              value={editingFee.description || ''}
                              onChange={(e) => setEditingFee({ ...editingFee, description: e.target.value })}
                              className="w-full border border-gray-300 rounded p-2 text-sm"
                              placeholder="Optional description"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Available From</label>
                              <input
                                type="datetime-local"
                                value={formatDateForInput(editingFee.availableFrom)}
                                onChange={(e) => setEditingFee({ ...editingFee, availableFrom: e.target.value || null })}
                                className="w-full border border-gray-300 rounded p-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Available Until</label>
                              <input
                                type="datetime-local"
                                value={formatDateForInput(editingFee.availableUntil)}
                                onChange={(e) => setEditingFee({ ...editingFee, availableUntil: e.target.value || null })}
                                className="w-full border border-gray-300 rounded p-2 text-sm"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={editingFee.isDefault}
                                onChange={(e) => setEditingFee({ ...editingFee, isDefault: e.target.checked })}
                                className="rounded"
                              />
                              Default selection
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={editingFee.isActive}
                                onChange={(e) => setEditingFee({ ...editingFee, isActive: e.target.checked })}
                                className="rounded"
                              />
                              Active
                            </label>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingFee(null)}
                              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateFee(editingFee)}
                              disabled={saving}
                              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
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
                              <span className="font-medium text-gray-900">{fee.name}</span>
                              <span className="text-green-600 font-medium">${fee.amount}</span>
                              {fee.isDefault && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                  <Star className="w-3 h-3" /> Default
                                </span>
                              )}
                              {!fee.isActive && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Inactive</span>
                              )}
                              {fee.isActive && !fee.isCurrentlyAvailable && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Not in date range</span>
                              )}
                            </div>
                            {fee.description && (
                              <p className="text-sm text-gray-500 mt-0.5">{fee.description}</p>
                            )}
                            {(fee.availableFrom || fee.availableUntil) && (
                              <p className="text-xs text-gray-400 mt-1">
                                {fee.availableFrom && `From: ${new Date(fee.availableFrom).toLocaleDateString()}`}
                                {fee.availableFrom && fee.availableUntil && ' - '}
                                {fee.availableUntil && `Until: ${new Date(fee.availableUntil).toLocaleDateString()}`}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingFee({ ...fee })}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFee(fee.id)}
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

              {/* Add new fee form */}
              {showAddForm ? (
                <div className="p-3 border border-blue-200 bg-blue-50 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                      <input
                        type="text"
                        value={newFee.name}
                        onChange={(e) => setNewFee({ ...newFee, name: e.target.value })}
                        className="w-full border border-gray-300 rounded p-2 text-sm"
                        placeholder="e.g., Early Bird"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Amount ($)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newFee.amount}
                        onChange={(e) => setNewFee({ ...newFee, amount: e.target.value })}
                        className="w-full border border-gray-300 rounded p-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={newFee.description}
                      onChange={(e) => setNewFee({ ...newFee, description: e.target.value })}
                      className="w-full border border-gray-300 rounded p-2 text-sm"
                      placeholder="Optional description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Available From</label>
                      <input
                        type="datetime-local"
                        value={newFee.availableFrom}
                        onChange={(e) => setNewFee({ ...newFee, availableFrom: e.target.value })}
                        className="w-full border border-gray-300 rounded p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Available Until</label>
                      <input
                        type="datetime-local"
                        value={newFee.availableUntil}
                        onChange={(e) => setNewFee({ ...newFee, availableUntil: e.target.value })}
                        className="w-full border border-gray-300 rounded p-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={newFee.isDefault}
                        onChange={(e) => setNewFee({ ...newFee, isDefault: e.target.checked })}
                        className="rounded"
                      />
                      Default selection
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setNewFee({ name: '', description: '', amount: 0, isDefault: false, availableFrom: '', availableUntil: '', isActive: true });
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddFee}
                      disabled={saving || !newFee.name.trim()}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                      Add Fee
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
                  Add Fee Option
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
