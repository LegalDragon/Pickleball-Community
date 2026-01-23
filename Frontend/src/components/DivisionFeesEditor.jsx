import { useState, useEffect } from 'react';
import { Plus, DollarSign, Loader2, ChevronDown, ChevronUp, Star, ToggleLeft, ToggleRight, RefreshCw, Calendar } from 'lucide-react';
import { tournamentApi } from '../services/api';
import { useToast } from '../contexts/ToastContext';

/**
 * Component for managing multiple fee options for a division
 * Matches the same format as EventFeesEditor
 */
export default function DivisionFeesEditor({ divisionId, eventId, divisionFee, onFeesChange }) {
  const toast = useToast();
  const [fees, setFees] = useState([]);
  const [feeTypes, setFeeTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFee, setNewFee] = useState({
    feeTypeId: '',
    name: '',
    description: '',
    amount: 0,
    isDefault: false,
    availableFrom: '',
    availableUntil: '',
    isActive: true
  });

  useEffect(() => {
    if (divisionId) {
      loadData();
    } else {
      setFees([]);
      setFeeTypes([]);
      setLoading(false);
    }
  }, [divisionId, eventId]);

  const loadData = async () => {
    if (!divisionId) return;
    setLoading(true);
    try {
      const requests = [tournamentApi.getDivisionFees(divisionId)];
      if (eventId) {
        requests.push(tournamentApi.getEventFeeTypes(eventId));
      }
      const results = await Promise.all(requests);
      if (results[0].success) {
        setFees(results[0].data || []);
      }
      if (results.length > 1 && results[1].success) {
        setFeeTypes(results[1].data || []);
      }
    } catch (error) {
      console.error('Failed to load fees:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toISOString().slice(0, 16);
  };

  const handleStartEdit = (fee) => {
    setEditingFeeId(fee.id);
    setEditValues({
      feeTypeId: fee.feeTypeId || '',
      name: fee.name,
      description: fee.description || '',
      amount: fee.amount ?? 0,
      isDefault: fee.isDefault ?? false,
      availableFrom: fee.availableFrom ? formatDateForInput(fee.availableFrom) : '',
      availableUntil: fee.availableUntil ? formatDateForInput(fee.availableUntil) : '',
      isActive: fee.isActive ?? true
    });
  };

  const handleCancelEdit = () => {
    setEditingFeeId(null);
    setEditValues({});
  };

  const handleSaveFee = async (feeId) => {
    if (!editValues.name?.trim()) {
      toast.error('Fee name is required');
      return;
    }

    setSaving(prev => ({ ...prev, [feeId]: true }));
    try {
      const payload = {
        feeTypeId: editValues.feeTypeId || null,
        name: editValues.name,
        description: editValues.description,
        amount: parseFloat(editValues.amount) || 0,
        isDefault: editValues.isDefault,
        availableFrom: editValues.availableFrom || null,
        availableUntil: editValues.availableUntil || null,
        isActive: editValues.isActive
      };

      const response = await tournamentApi.updateDivisionFee(divisionId, feeId, payload);
      if (response.success) {
        setFees(fees.map(f => f.id === feeId ? response.data : f));
        setEditingFeeId(null);
        setEditValues({});
        toast.success('Fee updated');
        onFeesChange?.();
      } else {
        toast.error(response.message || 'Failed to update fee');
      }
    } catch (error) {
      toast.error('Failed to update fee');
    } finally {
      setSaving(prev => ({ ...prev, [feeId]: false }));
    }
  };

  const handleToggleActive = async (fee) => {
    setSaving(prev => ({ ...prev, [fee.id]: true }));
    try {
      const response = await tournamentApi.updateDivisionFee(divisionId, fee.id, {
        feeTypeId: fee.feeTypeId || null,
        name: fee.name,
        description: fee.description,
        amount: fee.amount,
        isDefault: fee.isDefault,
        availableFrom: fee.availableFrom,
        availableUntil: fee.availableUntil,
        isActive: !fee.isActive
      });

      if (response.success) {
        setFees(fees.map(f => f.id === fee.id ? response.data : f));
        toast.success(`Fee ${response.data.isActive ? 'enabled' : 'disabled'}`);
        onFeesChange?.();
      } else {
        toast.error(response.message || 'Failed to update fee');
      }
    } catch (error) {
      toast.error('Failed to update fee');
    } finally {
      setSaving(prev => ({ ...prev, [fee.id]: false }));
    }
  };

  const handleDeleteFee = async (feeId) => {
    if (!confirm('Remove this fee option?')) return;

    setSaving(prev => ({ ...prev, [feeId]: true }));
    try {
      const response = await tournamentApi.deleteDivisionFee(divisionId, feeId);
      if (response.success) {
        setFees(fees.filter(f => f.id !== feeId));
        toast.success('Fee removed');
        onFeesChange?.();
      } else {
        toast.error(response.message || 'Failed to remove fee');
      }
    } catch (error) {
      toast.error('Failed to remove fee');
    } finally {
      setSaving(prev => ({ ...prev, [feeId]: false }));
    }
  };

  const handleFeeTypeChange = (feeTypeId, isNew = true) => {
    if (feeTypeId) {
      const feeType = feeTypes.find(ft => ft.id === parseInt(feeTypeId));
      if (feeType) {
        const values = {
          feeTypeId: feeType.id,
          name: feeType.name,
          description: feeType.description || '',
          amount: feeType.defaultAmount,
          availableFrom: feeType.availableFrom ? formatDateForInput(feeType.availableFrom) : '',
          availableUntil: feeType.availableUntil ? formatDateForInput(feeType.availableUntil) : ''
        };
        if (isNew) {
          setNewFee({ ...newFee, ...values });
        } else {
          setEditValues({ ...editValues, ...values });
        }
        return;
      }
    }
    if (isNew) {
      setNewFee({ ...newFee, feeTypeId: '' });
    } else {
      setEditValues({ ...editValues, feeTypeId: '' });
    }
  };

  const handleAddFee = async () => {
    if (!newFee.name.trim()) {
      toast.error('Fee name is required');
      return;
    }

    setSaving(prev => ({ ...prev, new: true }));
    try {
      const response = await tournamentApi.createDivisionFee(divisionId, {
        feeTypeId: newFee.feeTypeId || null,
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
        setNewFee({ feeTypeId: '', name: '', description: '', amount: 0, isDefault: false, availableFrom: '', availableUntil: '', isActive: true });
        setShowAddForm(false);
        toast.success('Fee added');
        onFeesChange?.();
      } else {
        toast.error(response.message || 'Failed to add fee');
      }
    } catch (error) {
      toast.error('Failed to add fee');
    } finally {
      setSaving(prev => ({ ...prev, new: false }));
    }
  };

  const hasFees = fees.length > 0;
  const configuredFees = fees.filter(f => f.isActive);

  if (!divisionId) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm text-gray-500">Save the division first to configure fees.</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between p-4 hover:bg-gray-50">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 flex items-center justify-between text-left"
        >
          <div>
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Division Fee Amounts
              {configuredFees.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {configuredFees.length} configured
                </span>
              )}
            </h4>
            {!isExpanded && configuredFees.length > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                {configuredFees.map(f => `${f.name}: $${f.amount}`).join(', ')}
              </p>
            )}
            {!isExpanded && !hasFees && divisionFee > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                Using single division fee: ${divisionFee}
              </p>
            )}
            {!isExpanded && !hasFees && !divisionFee && (
              <p className="text-sm text-gray-500 mt-1">
                No division fees configured yet. Click to add fee options.
              </p>
            )}
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            loadData();
          }}
          disabled={loading}
          className="ml-2 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          title="Refresh fees"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isExpanded && (
        <div className="p-4 pt-0 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500">
                Set fee options for this division (e.g., Early Bird, Regular, Late Registration).
              </p>

              {/* Fee table */}
              {hasFees && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-2">Fee Type</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-2 w-28">Amount</th>
                        <th className="text-center text-xs font-medium text-gray-500 uppercase px-3 py-2 w-20">Active</th>
                        <th className="text-center text-xs font-medium text-gray-500 uppercase px-3 py-2 w-20">Default</th>
                        <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-2 w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {fees.map(fee => {
                        const isEditing = editingFeeId === fee.id;
                        const isSaving = saving[fee.id];

                        return (
                          <tr key={fee.id} className={`${!fee.isActive ? 'bg-gray-50' : ''}`}>
                            <td className="px-3 py-2">
                              <div>
                                <span className="font-medium text-gray-900">{fee.name}</span>
                                {fee.description && (
                                  <p className="text-xs text-gray-500">{fee.description}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-500">$</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editValues.amount}
                                    onChange={(e) => setEditValues({ ...editValues, amount: e.target.value })}
                                    className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                                    autoFocus
                                  />
                                </div>
                              ) : (
                                <span className={`font-medium ${fee.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                                  ${fee.amount?.toFixed(2) || '0.00'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleActive(fee)}
                                disabled={isSaving}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                {isSaving ? (
                                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                ) : fee.isActive ? (
                                  <ToggleRight className="w-6 h-6 text-green-500" />
                                ) : (
                                  <ToggleLeft className="w-6 h-6 text-gray-300" />
                                )}
                              </button>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {isEditing ? (
                                <input
                                  type="checkbox"
                                  checked={editValues.isDefault}
                                  onChange={(e) => setEditValues({ ...editValues, isDefault: e.target.checked })}
                                  className="rounded"
                                />
                              ) : fee.isDefault ? (
                                <Star className="w-4 h-4 text-yellow-500 mx-auto" />
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {isEditing ? (
                                <div className="flex justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveFee(fee.id)}
                                    disabled={isSaving}
                                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    {isSaving ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(fee)}
                                    className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFee(fee.id)}
                                    disabled={isSaving}
                                    className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Date range editing when in edit mode */}
              {editingFeeId && (
                <div className="p-3 border border-blue-200 bg-blue-50 rounded-lg">
                  <div className="space-y-3">
                    {feeTypes.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Fee Type (optional)</label>
                        <select
                          value={editValues.feeTypeId || ''}
                          onChange={(e) => handleFeeTypeChange(e.target.value, false)}
                          className="w-full border border-gray-300 rounded p-2 text-sm"
                        >
                          <option value="">Custom (no fee type)</option>
                          {feeTypes.map(ft => (
                            <option key={ft.id} value={ft.id}>{ft.name} (${ft.defaultAmount})</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                        <input
                          type="text"
                          value={editValues.name || ''}
                          onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                          className="w-full border border-gray-300 rounded p-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                        <input
                          type="text"
                          value={editValues.description || ''}
                          onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                          className="w-full border border-gray-300 rounded p-2 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Date Range (optional)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Available From</label>
                        <input
                          type="datetime-local"
                          value={editValues.availableFrom || ''}
                          onChange={(e) => setEditValues({ ...editValues, availableFrom: e.target.value })}
                          className="w-full border border-gray-300 rounded p-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Available Until</label>
                        <input
                          type="datetime-local"
                          value={editValues.availableUntil || ''}
                          onChange={(e) => setEditValues({ ...editValues, availableUntil: e.target.value })}
                          className="w-full border border-gray-300 rounded p-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Add new fee form */}
              {showAddForm ? (
                <div className="p-3 border border-green-200 bg-green-50 rounded-lg space-y-3">
                  <h5 className="font-medium text-gray-900 text-sm">Add New Fee Option</h5>
                  {feeTypes.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Fee Type (optional)</label>
                      <select
                        value={newFee.feeTypeId || ''}
                        onChange={(e) => handleFeeTypeChange(e.target.value, true)}
                        className="w-full border border-gray-300 rounded p-2 text-sm"
                      >
                        <option value="">Custom (no fee type)</option>
                        {feeTypes.map(ft => (
                          <option key={ft.id} value={ft.id}>{ft.name} (${ft.defaultAmount})</option>
                        ))}
                      </select>
                    </div>
                  )}
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
                        setNewFee({ feeTypeId: '', name: '', description: '', amount: 0, isDefault: false, availableFrom: '', availableUntil: '', isActive: true });
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddFee}
                      disabled={saving.new || !newFee.name.trim()}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      {saving.new && <Loader2 className="w-3 h-3 animate-spin" />}
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
