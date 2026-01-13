import { useState, useEffect } from 'react';
import { X, DollarSign, CheckCircle, AlertCircle, ExternalLink, FileText, Loader2, XCircle, User, Edit2, Upload } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { tournamentApi, sharedAssetApi, getSharedAssetUrl } from '../services/api';

export default function AdminPaymentModal({ isOpen, onClose, unit, event, onPaymentUpdated }) {
  const toast = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localMember, setLocalMember] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    paymentReference: '',
    paymentProofUrl: '',
    amountPaid: '',
    referenceId: ''
  });

  // Get the specific member to verify (passed via unit.selectedMember)
  const member = localMember || unit?.selectedMember;

  // Reset edit form when member changes
  useEffect(() => {
    if (member) {
      setEditForm({
        paymentReference: member.paymentReference || '',
        paymentProofUrl: member.paymentProofUrl || '',
        amountPaid: member.amountPaid > 0 ? member.amountPaid.toString() : '',
        referenceId: member.referenceId || ''
      });
    }
  }, [member]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setLocalMember(null);
      setIsEditing(false);
    }
  }, [isOpen]);

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
        const updatedMember = {
          ...member,
          hasPaid: false,
          paidAt: null,
          amountPaid: 0
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
      const response = await sharedAssetApi.upload(file);
      if (response.success && response.data?.url) {
        setEditForm(prev => ({ ...prev, paymentProofUrl: response.data.url }));
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
        referenceId: editForm.referenceId || null
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
              {isEditing ? 'Edit Payment Info' : 'Verify Payment'}
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
                  </div>
                )}
              </div>

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
