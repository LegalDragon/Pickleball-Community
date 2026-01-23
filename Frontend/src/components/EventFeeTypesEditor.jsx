import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, Loader2, ChevronDown, ChevronUp, Tag, Check, X } from 'lucide-react';
import { tournamentApi } from '../services/api';
import { useToast } from '../contexts/ToastContext';

/**
 * Component for managing fee type names at the event level.
 * Fee types are just names (e.g., "Early Bird", "Regular", "Late Registration").
 * Actual amounts are set separately for event fees and division fees.
 */
export default function EventFeeTypesEditor({ eventId, onFeeTypesChange }) {
  const toast = useToast();
  const [feeTypes, setFeeTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

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
    if (!newName.trim()) {
      toast.error('Fee type name is required');
      return;
    }

    setSaving(true);
    try {
      const response = await tournamentApi.createEventFeeType(eventId, {
        name: newName.trim(),
        description: newDescription.trim() || null,
        isActive: true,
        sortOrder: feeTypes.length
      });

      if (response.success) {
        setFeeTypes([...feeTypes, response.data]);
        setNewName('');
        setNewDescription('');
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

  const handleStartEdit = (feeType) => {
    setEditingId(feeType.id);
    setEditingName(feeType.name);
    setEditingDescription(feeType.description || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
    setEditingDescription('');
  };

  const handleSaveEdit = async () => {
    if (!editingName.trim()) {
      toast.error('Fee type name is required');
      return;
    }

    setSaving(true);
    try {
      const feeType = feeTypes.find(ft => ft.id === editingId);
      const response = await tournamentApi.updateEventFeeType(eventId, editingId, {
        name: editingName.trim(),
        description: editingDescription.trim() || null,
        isActive: feeType.isActive,
        sortOrder: feeType.sortOrder
      });

      if (response.success) {
        setFeeTypes(feeTypes.map(ft => ft.id === editingId ? response.data : ft));
        setEditingId(null);
        setEditingName('');
        setEditingDescription('');
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

  const hasFeeTypes = feeTypes.length > 0;

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
              Define fee type names (e.g., Early Bird, Regular, Late) first.
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
              <p className="text-sm text-gray-500">
                Define fee type names here. Then set amounts for each type in the Event Fees section below.
              </p>

              {/* Fee type list */}
              {feeTypes.length > 0 && (
                <div className="space-y-2">
                  {feeTypes.map(feeType => (
                    <div key={feeType.id} className="flex items-center gap-2 p-2 border rounded-lg bg-white">
                      {editingId === feeType.id ? (
                        // Edit mode
                        <>
                          <div className="flex-1 flex gap-2">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                              placeholder="Name"
                              autoFocus
                            />
                            <input
                              type="text"
                              value={editingDescription}
                              onChange={(e) => setEditingDescription(e.target.value)}
                              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                              placeholder="Description (optional)"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            disabled={saving}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        // View mode
                        <>
                          <div className="flex-1">
                            <span className="font-medium text-gray-900">{feeType.name}</span>
                            {feeType.description && (
                              <span className="text-sm text-gray-500 ml-2">- {feeType.description}</span>
                            )}
                            {feeType.hasEventFee && (
                              <span className="text-xs text-green-600 ml-2">(${feeType.eventFeeAmount})</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(feeType)}
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
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add new fee type */}
              {showAddForm ? (
                <div className="flex items-center gap-2 p-2 border border-purple-200 bg-purple-50 rounded-lg">
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="Name (e.g., Early Bird)"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="Description (optional)"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddFeeType}
                    disabled={saving || !newName.trim()}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewName('');
                      setNewDescription('');
                    }}
                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
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
