import { useState, useEffect, useMemo } from 'react';
import { X, DollarSign, CheckCircle, AlertCircle, ExternalLink, FileText, Loader2, XCircle, User, Edit2, Upload, Users, UserPlus } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { tournamentApi, sharedAssetApi, getSharedAssetUrl } from '../services/api';

const PAYMENT_METHODS = [
  { value: '', label: 'Select method...' },
  { value: 'Zelle', label: 'Zelle' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Venmo', label: 'Venmo' },
  { value: 'PayPal', label: 'PayPal' },
  { value: 'CreditCard', label: 'Credit Card' },
  { value: 'Check', label: 'Check' },
  { value: 'Other', label: 'Other' },
];

export default function AdminPaymentModal({ isOpen, onClose, unit, event, onPaymentUpdated }) {
  const toast = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localMember, setLocalMember] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showApplyToTeammates, setShowApplyToTeammates] = useState(false);
  const [selectedTeammateIds, setSelectedTeammateIds] = useState([]);

  // Edit form state
  const [editForm, setEditForm] = useState({
    paymentReference: '',
    paymentProofUrl: '',
    amountPaid: '',
    referenceId: '',
    paymentMethod: ''
  });

  // Get the specific member to verify (passed via unit.selectedMember)
  const member = localMember || unit?.selectedMember;

  // Reset edit form when member changes
  useEffect(() => {
    if (member) {
      // If no amount paid, calculate the per-person amount as default
      let defaultAmount = '';
      if (member.amountPaid > 0) {
        defaultAmount = member.amountPaid.toString();
      } else if (unit?.members && event) {
        const acceptedCount = unit.members.filter(m => m.inviteStatus === 'Accepted').length;
        if (acceptedCount > 0) {
          const totalAmount = (event.registrationFee || 0) + (unit.divisionFee || 0);
          defaultAmount = (totalAmount / acceptedCount).toFixed(2);
        }
      }

      setEditForm({
        paymentReference: member.paymentReference || '',
        paymentProofUrl: member.paymentProofUrl || '',
        amountPaid: defaultAmount,
        referenceId: member.referenceId || '',
        paymentMethod: member.paymentMethod || ''
      });
    }
  }, [member, unit?.members, event, unit?.divisionFee]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setLocalMember(null);
      setIsEditing(false);
      setShowApplyToTeammates(false);
      setSelectedTeammateIds([]);
    }
  }, [isOpen]);

  // Get unpaid teammates (excluding current member)
  const unpaidTeammates = useMemo(() => {
    if (!unit?.members || !member) return [];
    return unit.members.filter(
      m => m.inviteStatus === 'Accepted' && !m.hasPaid && m.userId !== member.userId
    );
  }, [unit?.members, member]);

  // Calculate per-person amount
  const perPersonAmount = useMemo(() => {
    if (!unit?.members || !event) return 0;
    const acceptedCount = unit.members.filter(m => m.inviteStatus === 'Accepted').length;
    if (acceptedCount === 0) return 0;
    const totalAmount = (event.registrationFee || 0) + (unit.divisionFee || 0);
    return totalAmount / acceptedCount;
  }, [unit?.members, event, unit?.divisionFee]);

  // Toggle teammate selection
  const toggleTeammateSelection = (userId) => {
    setSelectedTeammateIds(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Select all unpaid teammates
  const selectAllUnpaid = () => {
    if (selectedTeammateIds.length === unpaidTeammates.length) {
      setSelectedTeammateIds([]);
    } else {
      setSelectedTeammateIds(unpaidTeammates.map(m => m.userId));
    }
  };

  // Apply payment to selected teammates
  const handleApplyToTeammates = async () => {
    if (selectedTeammateIds.length === 0) {
      toast.error('Please select at least one teammate');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await tournamentApi.applyPaymentToTeammates(
        event.id,
        unit.unitId,
        member.userId,
        selectedTeammateIds,
        true // redistribute amount
      );

      if (response.success) {
        toast.success(response.message || 'Payment applied to teammates');
        setShowApplyToTeammates(false);
        setSelectedTeammateIds([]);
        onPaymentUpdated?.(unit.unitId, response.data);
        onClose(); // Close to refresh the parent
      } else {
        toast.error(response.message || 'Failed to apply payment');
      }
    } catch (err) {
      console.error('Error applying payment to teammates:', err);
      toast.error('Failed to apply payment to teammates');
    } finally {
      setIsUpdating(false);
    }
  };

  // Check if there's any existing payment data (must be before early returns)
  const hasExistingPaymentData = member?.paymentProofUrl || member?.paymentReference || (member?.amountPaid > 0);

  // Auto-start in edit mode if no payment data and not paid (must be before early returns)
  useEffect(() => {
    if (member && !member.hasPaid && !hasExistingPaymentData && !isEditing) {
      setIsEditing(true);
    }
  }, [member, hasExistingPaymentData, isEditing]);

  if (!isOpen || !unit) return null;

  if (!member) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-md w-full p-4">
          <div className="text-center text-gray-500">No member selected</div>
          <button onClick={onClose} className="mt-4 w-full py-2 border rounded-lg">Close</button>
        </div>
      </div>
    );
  }

  const memberName = member.lastName && member.firstName
    ? `${member.lastName}, ${member.firstName}`
    : (member.lastName || member.firstName || 'Player');

  const getProofUrl = (url) => {
    if (!url) return null;
    // Always use local proxy - extract asset ID from any URL format
    // Handles: /asset/123, https://shared.funtimepb.com/asset/123, /api/assets/shared/123, etc.
    const assetMatch = url.match(/\/asset[s]?(?:\/shared)?\/(\d+)/);
    if (assetMatch) {
      return getSharedAssetUrl(`/asset/${assetMatch[1]}`);
    }
    // Fallback for relative paths
    return url.startsWith('http') ? url : getSharedAssetUrl(url);
  };

  const isPdfUrl = (url) => {
    if (!url) return false;
    const lowercaseUrl = url.toLowerCase();
    return lowercaseUrl.endsWith('.pdf') || lowercaseUrl.includes('.pdf?');
  };

  const isImageUrl = (url) => {
    if (!url) return false;
    if (isPdfUrl(url)) return false;
    return url.includes('/asset/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  };

  const memberProofUrl = getProofUrl(member.paymentProofUrl);
  const isPdf = isPdfUrl(memberProofUrl);
  const isImage = isImageUrl(memberProofUrl);

  // Determine if we should show "Add Payment" vs "Edit Payment" vs "Verify Payment"
  const isAddingPayment = isEditing && !member.hasPaid && !hasExistingPaymentData;

  const handleMarkAsPaid = async () => {
    setIsUpdating(true);
    try {
      const response = await tournamentApi.markMemberAsPaid(event.id, unit.unitId, member.userId);
      if (response.success) {
        toast.success('Payment verified');
        const updatedMember = {
          ...member,
          hasPaid: true,
          paidAt: response.data.paidAt,
          amountPaid: response.data.amountPaid,
          referenceId: response.data.referenceId
        };
        setLocalMember(updatedMember);
        onPaymentUpdated?.(unit.unitId, response.data);
      } else {
        toast.error(response.message || 'Failed to verify payment');
      }
    } catch (err) {
      console.error('Error verifying payment:', err);
      toast.error('Failed to verify payment');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUnmarkPaid = async () => {
    setIsUpdating(true);
    try {
      const response = await tournamentApi.unmarkMemberPaid(event.id, unit.unitId, member.userId);
      if (response.success) {
        toast.success('Payment unmarked');
        // Use response data which preserves payment info (proofUrl, reference, etc.)
        // Only hasPaid, paidAt, amountPaid are reset; other fields are preserved
        const updatedMember = {
          ...member,
          ...response.data
        };
        setLocalMember(updatedMember);
        onPaymentUpdated?.(unit.unitId, response.data);
      } else {
        toast.error(response.message || 'Failed to unmark payment');
      }
    } catch (err) {
      console.error('Error unmarking payment:', err);
      toast.error('Failed to unmark payment');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload an image or PDF file');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setIsUploading(true);
    try {
      const assetType = file.type === 'application/pdf' ? 'document' : 'image';
      const response = await sharedAssetApi.uploadViaProxy(file, assetType, 'payment-proof');
      if (response.success && response.url) {
        setEditForm(prev => ({ ...prev, paymentProofUrl: response.url }));
        toast.success('File uploaded');
      } else {
        toast.error(response.message || 'Failed to upload file');
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      toast.error('Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSavePaymentInfo = async () => {
    setIsUpdating(true);
    try {
      const updateData = {
        paymentReference: editForm.paymentReference || null,
        paymentProofUrl: editForm.paymentProofUrl || null,
        amountPaid: editForm.amountPaid ? parseFloat(editForm.amountPaid) : null,
        referenceId: editForm.referenceId || null,
        paymentMethod: editForm.paymentMethod || null
      };

      const response = await tournamentApi.updateMemberPayment(event.id, unit.unitId, member.userId, updateData);
      if (response.success) {
        toast.success('Payment info saved');
        const updatedMember = {
          ...member,
          ...response.data
        };
        setLocalMember(updatedMember);
        setIsEditing(false);
        onPaymentUpdated?.(unit.unitId, response.data);
      } else {
        toast.error(response.message || 'Failed to save payment info');
      }
    } catch (err) {
      console.error('Error saving payment info:', err);
      toast.error('Failed to save payment info');
    } finally {
      setIsUpdating(false);
    }
  };

  const editProofUrl = getProofUrl(editForm.paymentProofUrl);
  const editIsPdf = isPdfUrl(editForm.paymentProofUrl);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold">
              {isAddingPayment ? 'Add Payment' : isEditing ? 'Edit Payment Info' : 'Verify Payment'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Member Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-gray-400" />
              <div>
                <div className="font-medium text-gray-900">{memberName}</div>
                <div className="text-sm text-gray-500">{unit.divisionName}</div>
              </div>
            </div>
          </div>

          {isEditing ? (
            /* Edit Form */
            <div className="space-y-4">
              {/* Reference ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference ID
                </label>
                <input
                  type="text"
                  value={editForm.referenceId}
                  onChange={(e) => setEditForm(prev => ({ ...prev, referenceId: e.target.value }))}
                  placeholder={`E${event?.id}-U${unit?.unitId}-P${member?.userId}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              {/* Amount Paid */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount Paid
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.amountPaid}
                    onChange={(e) => setEditForm(prev => ({ ...prev, amountPaid: e.target.value }))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={editForm.paymentMethod}
                  onChange={(e) => setEditForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  {PAYMENT_METHODS.map(method => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </div>

              {/* Payment Reference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Reference
                </label>
                <textarea
                  value={editForm.paymentReference}
                  onChange={(e) => setEditForm(prev => ({ ...prev, paymentReference: e.target.value }))}
                  placeholder="Transaction ID, notes, etc."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              {/* Payment Proof Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Proof
                </label>
                <div className="space-y-2">
                  {editProofUrl ? (
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <a
                          href={editProofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-orange-600 hover:text-orange-700"
                        >
                          {editIsPdf ? (
                            <FileText className="w-5 h-5 text-red-500" />
                          ) : (
                            <ExternalLink className="w-4 h-4" />
                          )}
                          <span className="text-sm">
                            {editIsPdf ? 'View PDF' : 'View File'}
                          </span>
                        </a>
                        <button
                          type="button"
                          onClick={() => setEditForm(prev => ({ ...prev, paymentProofUrl: '' }))}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <div className="flex flex-col items-center justify-center">
                        {isUploading ? (
                          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-gray-400 mb-1" />
                            <span className="text-xs text-gray-500">Upload proof</span>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Edit Form Buttons */}
              <div className="flex gap-2 pt-2">
                {isAddingPayment ? (
                  <>
                    <button
                      onClick={async () => {
                        // Save payment info first, then mark as paid
                        setIsUpdating(true);
                        try {
                          // Save the payment info
                          const updateData = {
                            paymentReference: editForm.paymentReference || null,
                            paymentProofUrl: editForm.paymentProofUrl || null,
                            amountPaid: editForm.amountPaid ? parseFloat(editForm.amountPaid) : null,
                            referenceId: editForm.referenceId || null,
                            paymentMethod: editForm.paymentMethod || null,
                            hasPaid: true // Mark as paid
                          };
                          const response = await tournamentApi.updateMemberPayment(event.id, unit.unitId, member.userId, updateData);
                          if (response.success) {
                            toast.success('Payment added and verified');
                            const updatedMember = { ...member, ...response.data };
                            setLocalMember(updatedMember);
                            setIsEditing(false);
                            onPaymentUpdated?.(unit.unitId, response.data);
                          } else {
                            toast.error(response.message || 'Failed to add payment');
                          }
                        } catch (err) {
                          console.error('Error adding payment:', err);
                          toast.error('Failed to add payment');
                        } finally {
                          setIsUpdating(false);
                        }
                      }}
                      disabled={isUpdating}
                      className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {isUpdating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Save & Mark Paid
                    </button>
                    <button
                      onClick={onClose}
                      disabled={isUpdating}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleSavePaymentInfo}
                      disabled={isUpdating}
                      className="flex-1 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {isUpdating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      disabled={isUpdating}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* View Mode */
            <>
              {/* Payment Status */}
              <div className={`flex items-center gap-2 p-3 rounded-lg ${
                member.hasPaid ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
              }`}>
                {member.hasPaid ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                <span className="font-medium">
                  {member.hasPaid ? 'Payment Verified' : 'Awaiting Verification'}
                </span>
              </div>

              {/* Payment Details */}
              <div className="space-y-3">
                {/* Amount Paid */}
                {member.amountPaid > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-600">Amount Paid:</span>
                    <span className="font-medium text-green-600">${member.amountPaid.toFixed(2)}</span>
                  </div>
                )}

                {/* Payment Method */}
                {member.paymentMethod && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-600">Payment Method:</span>
                    <span className="font-medium">{member.paymentMethod}</span>
                  </div>
                )}

                {/* Paid Date */}
                {member.paidAt && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-600">Paid On:</span>
                    <span className="font-medium">{new Date(member.paidAt).toLocaleDateString()}</span>
                  </div>
                )}

                {/* Reference ID */}
                {member.referenceId && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="text-sm font-medium text-orange-700 mb-1">Reference ID</div>
                    <code className="text-sm font-mono text-orange-900">{member.referenceId}</code>
                  </div>
                )}

                {/* Payment Reference */}
                {member.paymentReference && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm font-medium text-gray-700 mb-1">Payment Reference</div>
                    <div className="text-sm text-gray-900">{member.paymentReference}</div>
                  </div>
                )}

                {/* Payment Proof */}
                {memberProofUrl && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-700">Payment Proof</div>
                    <div className="border rounded-lg overflow-hidden">
                      {isPdf ? (
                        <a
                          href={memberProofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col items-center gap-2 p-4 hover:bg-gray-50 transition-colors"
                        >
                          <FileText className="w-12 h-12 text-red-500" />
                          <span className="text-orange-600 hover:text-orange-700 flex items-center gap-1">
                            <ExternalLink className="w-4 h-4" />
                            View PDF
                          </span>
                        </a>
                      ) : isImage ? (
                        <a href={memberProofUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={memberProofUrl}
                            alt="Payment proof"
                            className="w-full max-h-64 object-contain bg-gray-100"
                          />
                        </a>
                      ) : (
                        <a
                          href={memberProofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-4 hover:bg-gray-50 transition-colors"
                        >
                          <FileText className="w-6 h-6 text-gray-400" />
                          <span className="text-orange-600 hover:text-orange-700">View Document</span>
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                        </a>
                      )}
                    </div>
                    {/* Quick Verify button right below proof */}
                    {!member.hasPaid && (
                      <button
                        onClick={handleMarkAsPaid}
                        disabled={isUpdating}
                        className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        {isUpdating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Verify Payment
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Apply to Teammates Section */}
              {member.hasPaid && unpaidTeammates.length > 0 && (
                <div className="border border-blue-200 rounded-lg bg-blue-50 p-3">
                  {!showApplyToTeammates ? (
                    <button
                      onClick={() => {
                        setShowApplyToTeammates(true);
                        setSelectedTeammateIds(unpaidTeammates.map(m => m.userId));
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 text-blue-700 hover:text-blue-800 font-medium"
                    >
                      <UserPlus className="w-4 h-4" />
                      Apply this payment to teammates ({unpaidTeammates.length} unpaid)
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">Apply to teammates</span>
                        </div>
                        <button
                          type="button"
                          onClick={selectAllUnpaid}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {selectedTeammateIds.length === unpaidTeammates.length ? 'Deselect all' : 'Select all'}
                        </button>
                      </div>

                      <div className="space-y-2">
                        {unpaidTeammates.map(teammate => {
                          const isSelected = selectedTeammateIds.includes(teammate.userId);
                          const name = teammate.lastName && teammate.firstName
                            ? `${teammate.lastName}, ${teammate.firstName}`
                            : (teammate.lastName || teammate.firstName || 'Player');

                          return (
                            <div
                              key={teammate.userId}
                              onClick={() => toggleTeammateSelection(teammate.userId)}
                              className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-blue-100 border-blue-300'
                                  : 'bg-white border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={() => toggleTeammateSelection(teammate.userId)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-gray-900">{name}</span>
                              </div>
                              <span className="text-sm font-medium text-gray-600">
                                ${perPersonAmount.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {selectedTeammateIds.length > 0 && (
                        <div className="pt-2 border-t border-blue-200">
                          <div className="flex justify-between items-center text-sm mb-2">
                            <span className="text-blue-800">
                              Will apply to {selectedTeammateIds.length} teammate{selectedTeammateIds.length > 1 ? 's' : ''}
                            </span>
                            <span className="font-medium text-blue-800">
                              ${(selectedTeammateIds.length * perPersonAmount).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={handleApplyToTeammates}
                          disabled={isUpdating || selectedTeammateIds.length === 0}
                          className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                          {isUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Apply Payment
                        </button>
                        <button
                          onClick={() => {
                            setShowApplyToTeammates(false);
                            setSelectedTeammateIds([]);
                          }}
                          disabled={isUpdating}
                          className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex gap-2">
                  {!member.hasPaid ? (
                    <button
                      onClick={handleMarkAsPaid}
                      disabled={isUpdating}
                      className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {isUpdating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Verify Payment
                    </button>
                  ) : (
                    <button
                      onClick={handleUnmarkPaid}
                      disabled={isUpdating}
                      className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {isUpdating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Unmark
                    </button>
                  )}
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                </div>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
