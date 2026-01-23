import { useState, useEffect } from 'react';
import { Loader2, ChevronDown, ChevronUp, DollarSign, Calendar, Star, ToggleLeft, ToggleRight, RefreshCw, Plus } from 'lucide-react';
import { tournamentApi } from '../services/api';
import { useToast } from '../contexts/ToastContext';

/**
 * Component for managing fee options for a division.
 * Matches the same table format as EventFeesEditor.
 * Shows all event fee types and allows setting amounts + custom fees.
 */
export default function DivisionFeesEditor({ divisionId, eventId, divisionFee, onFeesChange }) {
  const toast = useToast();
  const [feeTypes, setFeeTypes] = useState([]);
  const [fees, setFees] = useState([]); // Existing division fees
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingId, setEditingId] = useState(null); // feeTypeId for type-based, or 'custom-{id}' for custom fees
  const [editValues, setEditValues] = useState({});
  const [addingCustom, setAddingCustom] = useState(false);
  const [customFee, setCustomFee] = useState({ name: '', amount: 0 });

  useEffect(() => {
    if (divisionId && eventId) {
      loadData();
    } else {
      setFees([]);
      setFeeTypes([]);
      setLoading(false);
    }
  }, [divisionId, eventId]);

  const loadData = async () => {
    if (!divisionId || !eventId) return;
    setLoading(true);
    try {
      const [feesResponse, feeTypesResponse] = await Promise.all([
        tournamentApi.getDivisionFees(divisionId),
        tournamentApi.getEventFeeTypes(eventId)
      ]);
      if (feesResponse.success) {
        setFees(feesResponse.data || []);
      }
      if (feeTypesResponse.success) {
        setFeeTypes(feeTypesResponse.data || []);
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

  // Get the existing division fee for a fee type (if any)
  const getFeeForType = (feeTypeId) => {
    return fees.find(f => f.feeTypeId === feeTypeId);
  };

  // Get custom fees (fees without a feeTypeId)
  const getCustomFees = () => {
    return fees.filter(f => !f.feeTypeId);
  };

  const handleStartEdit = (feeTypeId, existingFee) => {
    setEditingId(feeTypeId);
    setEditValues({
      amount: existingFee?.amount ?? 0,
      isDefault: existingFee?.isDefault ?? false,
      availableFrom: existingFee?.availableFrom ? formatDateForInput(existingFee.availableFrom) : '',
      availableUntil: existingFee?.availableUntil ? formatDateForInput(existingFee.availableUntil) : '',
      isActive: existingFee?.isActive ?? true,
      name: existingFee?.name || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleSaveFee = async (feeTypeId, feeType = null) => {
    const existingFee = feeTypeId ? getFeeForType(feeTypeId) : null;
    const saveKey = feeTypeId || 'custom';
    setSaving(prev => ({ ...prev, [saveKey]: true }));

    try {
      const payload = {
        feeTypeId: feeTypeId || null,
        name: feeType?.name || editValues.name || 'Custom Fee',
        description: feeType?.description || '',
        amount: parseFloat(editValues.amount) || 0,
        isDefault: editValues.isDefault,
        availableFrom: editValues.availableFrom || null,
        availableUntil: editValues.availableUntil || null,
        isActive: editValues.isActive,
        sortOrder: fees.length
      };

      let response;
      if (existingFee) {
        response = await tournamentApi.updateDivisionFee(divisionId, existingFee.id, payload);
      } else {
        response = await tournamentApi.createDivisionFee(divisionId, payload);
      }

      if (response.success) {
        if (existingFee) {
          setFees(fees.map(f => f.id === existingFee.id ? response.data : f));
        } else {
          setFees([...fees, response.data]);
        }
        setEditingId(null);
        setEditValues({});
        toast.success(existingFee ? 'Fee updated' : 'Fee created');
        onFeesChange?.();
      } else {
        toast.error(response.message || 'Failed to save fee');
      }
    } catch (error) {
      toast.error('Failed to save fee');
    } finally {
      setSaving(prev => ({ ...prev, [saveKey]: false }));
    }
  };

  const handleSaveCustomFee = async (customFeeRecord) => {
    const saveKey = `custom-${customFeeRecord.id}`;
    setSaving(prev => ({ ...prev, [saveKey]: true }));

    try {
      const payload = {
        feeTypeId: null,
        name: editValues.name || customFeeRecord.name,
        description: '',
        amount: parseFloat(editValues.amount) || 0,
        isDefault: editValues.isDefault,
        availableFrom: editValues.availableFrom || null,
        availableUntil: editValues.availableUntil || null,
        isActive: editValues.isActive,
        sortOrder: customFeeRecord.sortOrder
      };

      const response = await tournamentApi.updateDivisionFee(divisionId, customFeeRecord.id, payload);

      if (response.success) {
        setFees(fees.map(f => f.id === customFeeRecord.id ? response.data : f));
        setEditingId(null);
        setEditValues({});
        toast.success('Fee updated');
        onFeesChange?.();
      } else {
        toast.error(response.message || 'Failed to save fee');
      }
    } catch (error) {
      toast.error('Failed to save fee');
    } finally {
      setSaving(prev => ({ ...prev, [saveKey]: false }));
    }
  };

  const handleToggleActive = async (fee) => {
    const saveKey = fee.feeTypeId || `custom-${fee.id}`;
    setSaving(prev => ({ ...prev, [saveKey]: true }));

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
      setSaving(prev => ({ ...prev, [saveKey]: false }));
    }
  };

  const handleDeleteFee = async (fee) => {
    if (!confirm('Remove this fee?')) return;

    const saveKey = fee.feeTypeId || `custom-${fee.id}`;
    setSaving(prev => ({ ...prev, [saveKey]: true }));

    try {
      const response = await tournamentApi.deleteDivisionFee(divisionId, fee.id);
      if (response.success) {
        setFees(fees.filter(f => f.id !== fee.id));
        toast.success('Fee removed');
        onFeesChange?.();
      } else {
        toast.error(response.message || 'Failed to remove fee');
      }
    } catch (error) {
      toast.error('Failed to remove fee');
    } finally {
      setSaving(prev => ({ ...prev, [saveKey]: false }));
    }
  };

  const handleAddCustomFee = async () => {
    if (!customFee.name.trim()) {
      toast.error('Fee name is required');
      return;
    }

    setSaving(prev => ({ ...prev, addCustom: true }));
    try {
      const response = await tournamentApi.createDivisionFee(divisionId, {
        feeTypeId: null,
        name: customFee.name,
        description: '',
        amount: parseFloat(customFee.amount) || 0,
        isDefault: false,
        isActive: true,
        sortOrder: fees.length
      });

      if (response.success) {
        setFees([...fees, response.data]);
        setAddingCustom(false);
        setCustomFee({ name: '', amount: 0 });
        toast.success('Fee added');
        onFeesChange?.();
      } else {
        toast.error(response.message || 'Failed to add fee');
      }
    } catch (error) {
      toast.error('Failed to add fee');
    } finally {
      setSaving(prev => ({ ...prev, addCustom: false }));
    }
  };

  const hasFeeTypes = feeTypes.length > 0;
  const customFees = getCustomFees();
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
            {!isExpanded && !hasFeeTypes && configuredFees.length === 0 && divisionFee > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                Using single division fee: ${divisionFee}
              </p>
            )}
            {!isExpanded && !hasFeeTypes && configuredFees.length === 0 && !divisionFee && (
              <p className="text-sm text-gray-500 mt-1">
                No fees configured. Click to set up fee options.
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

              {/* Fee types table */}
              {(hasFeeTypes || customFees.length > 0 || fees.length > 0) && (
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
                      {/* Fee types from event */}
                      {feeTypes.map(feeType => {
                        const divisionFeeRecord = getFeeForType(feeType.id);
                        const isEditing = editingId === feeType.id;
                        const isSaving = saving[feeType.id];

                        return (
                          <tr key={`type-${feeType.id}`} className={`${divisionFeeRecord?.isActive === false ? 'bg-gray-50' : ''}`}>
                            <td className="px-3 py-2">
                              <div>
                                <span className="font-medium text-gray-900">{feeType.name}</span>
                                {feeType.description && (
                                  <p className="text-xs text-gray-500">{feeType.description}</p>
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
                              ) : divisionFeeRecord ? (
                                <span className={`font-medium ${divisionFeeRecord.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                                  ${divisionFeeRecord.amount?.toFixed(2) || '0.00'}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {divisionFeeRecord ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleActive(divisionFeeRecord)}
                                  disabled={isSaving}
                                  className="text-gray-500 hover:text-gray-700"
                                >
                                  {isSaving ? (
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                  ) : divisionFeeRecord.isActive ? (
                                    <ToggleRight className="w-6 h-6 text-green-500" />
                                  ) : (
                                    <ToggleLeft className="w-6 h-6 text-gray-300" />
                                  )}
                                </button>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {isEditing ? (
                                <input
                                  type="checkbox"
                                  checked={editValues.isDefault}
                                  onChange={(e) => setEditValues({ ...editValues, isDefault: e.target.checked })}
                                  className="rounded"
                                />
                              ) : divisionFeeRecord?.isDefault ? (
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
                                    onClick={() => handleSaveFee(feeType.id, feeType)}
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
                                    onClick={() => handleStartEdit(feeType.id, divisionFeeRecord)}
                                    className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                                  >
                                    {divisionFeeRecord ? 'Edit' : 'Set Amount'}
                                  </button>
                                  {divisionFeeRecord && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteFee(divisionFeeRecord)}
                                      disabled={isSaving}
                                      className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Custom fees (not based on fee type) */}
                      {customFees.map(fee => {
                        const editKey = `custom-${fee.id}`;
                        const isEditing = editingId === editKey;
                        const isSaving = saving[editKey];

                        return (
                          <tr key={editKey} className={`${fee.isActive === false ? 'bg-gray-50' : ''}`}>
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editValues.name}
                                  onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                  placeholder="Fee name"
                                />
                              ) : (
                                <div>
                                  <span className="font-medium text-gray-900">{fee.name}</span>
                                  <span className="ml-2 text-xs text-gray-400">(custom)</span>
                                </div>
                              )}
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
                                    onClick={() => handleSaveCustomFee(fee)}
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
                                    onClick={() => handleStartEdit(editKey, fee)}
                                    className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFee(fee)}
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

                      {/* Add custom fee row */}
                      {addingCustom && (
                        <tr className="bg-green-50">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={customFee.name}
                              onChange={(e) => setCustomFee({ ...customFee, name: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                              placeholder="Fee name"
                              autoFocus
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={customFee.amount}
                                onChange={(e) => setCustomFee({ ...customFee, amount: e.target.value })}
                                className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="text-gray-300">-</span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="text-gray-300">-</span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={handleAddCustomFee}
                                disabled={saving.addCustom || !customFee.name.trim()}
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                {saving.addCustom ? 'Adding...' : 'Add'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAddingCustom(false);
                                  setCustomFee({ name: '', amount: 0 });
                                }}
                                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Date range editing when in edit mode */}
              {editingId && (
                <div className="p-3 border border-blue-200 bg-blue-50 rounded-lg">
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
              )}

              {/* Add custom fee button */}
              {!addingCustom && (
                <button
                  type="button"
                  onClick={() => setAddingCustom(true)}
                  className="w-full p-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Custom Fee
                </button>
              )}

              {/* Empty state when no fee types */}
              {!hasFeeTypes && customFees.length === 0 && fees.length === 0 && !addingCustom && (
                <div className="text-center py-4 text-gray-500">
                  <p>No fee types defined for this event. Add custom fees or define fee types at the event level.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
