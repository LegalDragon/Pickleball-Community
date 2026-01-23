import { useState, useEffect } from 'react';
import { Loader2, ChevronDown, ChevronUp, DollarSign, Calendar, Star, ToggleLeft, ToggleRight } from 'lucide-react';
import { tournamentApi } from '../services/api';
import { useToast } from '../contexts/ToastContext';

/**
 * Component for setting event-level fee amounts for each fee type.
 * Shows all defined fee types and allows setting an amount for each.
 * Creates/updates DivisionFee records with DivisionId=0.
 */
export default function EventFeesEditor({ eventId, onFeesChange }) {
  const toast = useToast();
  const [feeTypes, setFeeTypes] = useState([]);
  const [eventFees, setEventFees] = useState([]); // Existing event fees (DivisionId=0)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingFeeTypeId, setEditingFeeTypeId] = useState(null);
  const [editValues, setEditValues] = useState({});

  useEffect(() => {
    if (eventId) {
      loadData();
    } else {
      setFeeTypes([]);
      setEventFees([]);
      setLoading(false);
    }
  }, [eventId]);

  const loadData = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const [feeTypesResponse, feesResponse] = await Promise.all([
        tournamentApi.getEventFeeTypes(eventId),
        tournamentApi.getEventFees(eventId)
      ]);
      if (feeTypesResponse.success) {
        setFeeTypes(feeTypesResponse.data || []);
      }
      if (feesResponse.success) {
        setEventFees(feesResponse.data || []);
      }
    } catch (error) {
      console.error('Failed to load event fees:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get the existing event fee for a fee type (if any)
  const getEventFeeForType = (feeTypeId) => {
    return eventFees.find(f => f.feeTypeId === feeTypeId);
  };

  const handleStartEdit = (feeTypeId) => {
    const existingFee = getEventFeeForType(feeTypeId);
    setEditingFeeTypeId(feeTypeId);
    setEditValues({
      amount: existingFee?.amount ?? 0,
      isDefault: existingFee?.isDefault ?? false,
      availableFrom: existingFee?.availableFrom ? formatDateForInput(existingFee.availableFrom) : '',
      availableUntil: existingFee?.availableUntil ? formatDateForInput(existingFee.availableUntil) : '',
      isActive: existingFee?.isActive ?? true
    });
  };

  const handleCancelEdit = () => {
    setEditingFeeTypeId(null);
    setEditValues({});
  };

  const handleSaveFee = async (feeTypeId) => {
    const existingFee = getEventFeeForType(feeTypeId);
    setSaving(prev => ({ ...prev, [feeTypeId]: true }));

    try {
      const payload = {
        feeTypeId,
        amount: parseFloat(editValues.amount) || 0,
        isDefault: editValues.isDefault,
        availableFrom: editValues.availableFrom || null,
        availableUntil: editValues.availableUntil || null,
        isActive: editValues.isActive
      };

      let response;
      if (existingFee) {
        // Update existing fee
        response = await tournamentApi.updateEventFee(eventId, existingFee.id, payload);
      } else {
        // Create new fee
        response = await tournamentApi.createEventFee(eventId, payload);
      }

      if (response.success) {
        if (existingFee) {
          setEventFees(eventFees.map(f => f.id === existingFee.id ? response.data : f));
        } else {
          setEventFees([...eventFees, response.data]);
        }
        setEditingFeeTypeId(null);
        setEditValues({});
        toast.success(existingFee ? 'Fee updated' : 'Fee created');
        onFeesChange?.();
      } else {
        toast.error(response.message || 'Failed to save fee');
      }
    } catch (error) {
      toast.error('Failed to save fee');
    } finally {
      setSaving(prev => ({ ...prev, [feeTypeId]: false }));
    }
  };

  const handleToggleActive = async (feeTypeId) => {
    const existingFee = getEventFeeForType(feeTypeId);
    if (!existingFee) return;

    setSaving(prev => ({ ...prev, [feeTypeId]: true }));
    try {
      const response = await tournamentApi.updateEventFee(eventId, existingFee.id, {
        feeTypeId,
        amount: existingFee.amount,
        isDefault: existingFee.isDefault,
        availableFrom: existingFee.availableFrom,
        availableUntil: existingFee.availableUntil,
        isActive: !existingFee.isActive
      });

      if (response.success) {
        setEventFees(eventFees.map(f => f.id === existingFee.id ? response.data : f));
        toast.success(`Fee ${response.data.isActive ? 'enabled' : 'disabled'}`);
        onFeesChange?.();
      } else {
        toast.error(response.message || 'Failed to update fee');
      }
    } catch (error) {
      toast.error('Failed to update fee');
    } finally {
      setSaving(prev => ({ ...prev, [feeTypeId]: false }));
    }
  };

  const handleDeleteFee = async (feeTypeId) => {
    const existingFee = getEventFeeForType(feeTypeId);
    if (!existingFee) return;

    if (!confirm('Remove the amount for this fee type?')) return;

    setSaving(prev => ({ ...prev, [feeTypeId]: true }));
    try {
      const response = await tournamentApi.deleteEventFee(eventId, existingFee.id);
      if (response.success) {
        setEventFees(eventFees.filter(f => f.id !== existingFee.id));
        toast.success('Fee removed');
        onFeesChange?.();
      } else {
        toast.error(response.message || 'Failed to remove fee');
      }
    } catch (error) {
      toast.error('Failed to remove fee');
    } finally {
      setSaving(prev => ({ ...prev, [feeTypeId]: false }));
    }
  };

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toISOString().slice(0, 16);
  };

  const hasFeeTypes = feeTypes.length > 0;
  const configuredFees = eventFees.filter(f => f.isActive);

  if (!eventId) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm text-gray-500">Save the event first to configure fees.</p>
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
            <DollarSign className="w-4 h-4" />
            Event Fee Amounts
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
          {!isExpanded && !hasFeeTypes && (
            <p className="text-sm text-gray-500 mt-1">
              Define fee types first, then set amounts here.
            </p>
          )}
          {!isExpanded && hasFeeTypes && configuredFees.length === 0 && (
            <p className="text-sm text-gray-500 mt-1">
              No event fees configured yet. Click to set amounts.
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
          ) : !hasFeeTypes ? (
            <div className="text-center py-4 text-gray-500">
              <p>No fee types defined. Add fee types first.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500">
                Set the amount for each fee type. These are event-level fees that apply to all registrations.
              </p>

              {/* Fee types table */}
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
                    {feeTypes.map(feeType => {
                      const eventFee = getEventFeeForType(feeType.id);
                      const isEditing = editingFeeTypeId === feeType.id;
                      const isSaving = saving[feeType.id];

                      return (
                        <tr key={feeType.id} className={`${eventFee?.isActive === false ? 'bg-gray-50' : ''}`}>
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
                            ) : eventFee ? (
                              <span className={`font-medium ${eventFee.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                                ${eventFee.amount.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {eventFee ? (
                              <button
                                type="button"
                                onClick={() => handleToggleActive(feeType.id)}
                                disabled={isSaving}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                {isSaving ? (
                                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                ) : eventFee.isActive ? (
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
                            ) : eventFee?.isDefault ? (
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
                                  onClick={() => handleSaveFee(feeType.id)}
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
                                  onClick={() => handleStartEdit(feeType.id)}
                                  className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                                >
                                  {eventFee ? 'Edit' : 'Set Amount'}
                                </button>
                                {eventFee && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFee(feeType.id)}
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
                  </tbody>
                </table>
              </div>

              {/* Date range editing when in edit mode */}
              {editingFeeTypeId && (
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
