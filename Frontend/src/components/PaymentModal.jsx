import { useState, useEffect, useMemo } from 'react';
import { X, DollarSign, Upload, CheckCircle, AlertCircle, Loader2, Image, ExternalLink, Copy, Check, FileText, Users } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { tournamentApi, sharedAssetApi, getSharedAssetUrl } from '../services/api';

const PAYMENT_METHODS = [
  { value: '', label: 'Select payment method...' },
  { value: 'Zelle', label: 'Zelle' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Venmo', label: 'Venmo' },
  { value: 'PayPal', label: 'PayPal' },
  { value: 'CreditCard', label: 'Credit Card' },
  { value: 'Check', label: 'Check' },
  { value: 'Other', label: 'Other' },
];

export default function PaymentModal({ isOpen, onClose, registration, event, onPaymentUpdated, userId }) {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [copied, setCopied] = useState(false);
  const [proofUrlCopied, setProofUrlCopied] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  // Helper to check if URL is a PDF
  const isPdfUrl = (url) => {
    if (!url) return false;
    const lowercaseUrl = url.toLowerCase();
    return lowercaseUrl.endsWith('.pdf') || lowercaseUrl.includes('.pdf?');
  };

  // Get accepted members who haven't paid yet
  const acceptedMembers = useMemo(() => {
    if (!registration?.members) return [];
    return registration.members.filter(m => m.inviteStatus === 'Accepted');
  }, [registration?.members]);

  const unpaidMembers = useMemo(() => {
    return acceptedMembers.filter(m => !m.hasPaid);
  }, [acceptedMembers]);

  // Calculate per-person amount
  const perPersonAmount = useMemo(() => {
    if (acceptedMembers.length === 0) return 0;
    const totalAmount = registration?.amountDue || 0;
    return totalAmount / acceptedMembers.length;
  }, [acceptedMembers.length, registration?.amountDue]);

  useEffect(() => {
    if (registration) {
      setPaymentReference(registration.paymentReference || '');
      setPaymentProofUrl(registration.paymentProofUrl || '');
      // Only set preview image for non-PDF files
      const proofUrl = registration.paymentProofUrl || '';
      setPreviewImage(proofUrl && !isPdfUrl(proofUrl) ? proofUrl : null);

      // Initialize selected members: default to just the current user (if they haven't paid)
      const currentMemberRecord = acceptedMembers.find(m => m.userId === userId);
      if (currentMemberRecord && !currentMemberRecord.hasPaid) {
        setSelectedMemberIds([currentMemberRecord.userId]);
      } else {
        // If current user already paid, select all unpaid members by default
        setSelectedMemberIds(unpaidMembers.map(m => m.userId));
      }
    }
  }, [registration, userId, acceptedMembers, unpaidMembers]);

  // Calculate payment amount based on selected members
  useEffect(() => {
    if (selectedMemberIds.length > 0 && perPersonAmount > 0) {
      const totalForSelected = selectedMemberIds.length * perPersonAmount;
      setPaymentAmount(totalForSelected.toFixed(2));
    } else {
      setPaymentAmount('');
    }
  }, [selectedMemberIds, perPersonAmount]);

  const referenceId = event && registration ? `E${event.id}-U${registration.unitId}-P${userId || 0}` : '';

  const handleCopyReferenceId = async () => {
    try {
      await navigator.clipboard.writeText(referenceId);
      setCopied(true);
      toast.success('Reference ID copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const handleCopyProofUrl = async () => {
    try {
      await navigator.clipboard.writeText(paymentProofUrl);
      setProofUrlCopied(true);
      toast.success('Proof URL copied to clipboard');
      setTimeout(() => setProofUrlCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  if (!isOpen || !registration) return null;

  // Find current user's member record to check their payment status
  const currentMember = registration.members?.find(m => m.userId === userId);
  const memberHasPaid = currentMember?.hasPaid || false;

  const amountDue = registration.amountDue || 0;
  const amountPaid = registration.amountPaid || 0;
  const remainingAmount = amountDue - amountPaid;
  const isPaid = registration.paymentStatus === 'Paid';

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload an image (JPG, PNG, GIF, WebP) or PDF file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      // Determine asset type based on file MIME type
      const assetType = file.type === 'application/pdf' ? 'document' : 'image';
      const response = await sharedAssetApi.upload(file, assetType, 'payment-proof', true);
      // Response has url directly (not wrapped in data), and it's a relative path
      if (response.success && response.url) {
        // Convert relative URL to absolute URL using shared auth base
        const fullUrl = getSharedAssetUrl(response.url);
        setPaymentProofUrl(fullUrl);
        if (file.type.startsWith('image/')) {
          setPreviewImage(fullUrl);
        } else {
          setPreviewImage(null);
        }
        toast.success('File uploaded successfully');
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!paymentMethod) {
      toast.error('Please select a payment method');
      return;
    }

    if (!paymentProofUrl && !paymentReference) {
      toast.error('Please upload payment proof or enter a payment reference');
      return;
    }

    if (selectedMemberIds.length === 0) {
      toast.error('Please select at least one team member to pay for');
      return;
    }

    setIsSubmitting(true);
    try {
      // Convert selectedMemberIds (userIds) to actual member record IDs for the API
      const memberRecordIds = acceptedMembers
        .filter(m => selectedMemberIds.includes(m.userId))
        .map(m => m.id);

      const response = await tournamentApi.uploadPaymentProof(event.id, registration.unitId, {
        paymentProofUrl,
        paymentReference,
        paymentMethod,
        amountPaid: paymentAmount ? parseFloat(paymentAmount) : null,
        memberIds: memberRecordIds,
      });

      if (response.success) {
        const memberCount = selectedMemberIds.length;
        toast.success(`Payment submitted for ${memberCount} team member${memberCount > 1 ? 's' : ''}`);
        onPaymentUpdated?.(response.data);
        onClose();
      } else {
        toast.error(response.message || 'Failed to submit payment information');
      }
    } catch (err) {
      console.error('Error submitting payment:', err);
      toast.error('Failed to submit payment information');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle member selection (using userId for unique identification)
  const toggleMemberSelection = (memberUserId) => {
    setSelectedMemberIds(prev => {
      if (prev.includes(memberUserId)) {
        return prev.filter(id => id !== memberUserId);
      } else {
        return [...prev, memberUserId];
      }
    });
  };

  // Select/deselect all unpaid members
  const toggleAllUnpaid = () => {
    if (selectedMemberIds.length === unpaidMembers.length) {
      // Deselect all, but keep at least current user selected
      const currentMemberRecord = acceptedMembers.find(m => m.userId === userId);
      if (currentMemberRecord && !currentMemberRecord.hasPaid) {
        setSelectedMemberIds([currentMemberRecord.userId]);
      } else {
        setSelectedMemberIds([]);
      }
    } else {
      // Select all unpaid
      setSelectedMemberIds(unpaidMembers.map(m => m.userId));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold">Payment</h2>
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
          {/* Admin Payment Instructions - Always at top if available */}
          {event.paymentInstructions && (
            <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
              <div className="text-sm font-semibold text-orange-800 mb-2">Payment Instructions</div>
              <div className="text-sm text-orange-700 whitespace-pre-wrap">{event.paymentInstructions}</div>
            </div>
          )}

          {/* Registration Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="font-medium text-gray-900">{registration.divisionName}</div>
            <div className="text-sm text-gray-500">
              {registration.teamUnitName && <span>{registration.teamUnitName}</span>}
              {registration.skillLevelName && <span> • {registration.skillLevelName}</span>}
            </div>
            {registration.partners?.length > 0 && (
              <div className="mt-1 text-sm text-gray-500">
                Partner: {registration.partners.map(p => p.name).join(', ')}
              </div>
            )}
          </div>

          {/* Payment Summary */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Registration Fee:</span>
              <span className="font-medium">${amountDue.toFixed(2)}</span>
            </div>
            {(memberHasPaid && currentMember?.amountPaid > 0) ? (
              <div className="flex justify-between text-green-600">
                <span>Your Payment:</span>
                <span className="font-medium">${currentMember.amountPaid.toFixed(2)}</span>
              </div>
            ) : amountPaid > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Amount Paid:</span>
                <span className="font-medium">${amountPaid.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Status Badge - show member's payment status */}
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            memberHasPaid ? 'bg-green-50 text-green-700' :
            'bg-orange-50 text-orange-700'
          }`}>
            {memberHasPaid ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-medium">
              {memberHasPaid ? 'Your Payment Submitted' : 'Payment Required'}
            </span>
          </div>

          {/* Show member's payment details if they have paid */}
          {memberHasPaid && currentMember && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-medium text-gray-900">Your Payment Details</h3>

              {currentMember.paidAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Paid On:</span>
                  <span className="font-medium">{new Date(currentMember.paidAt).toLocaleDateString()}</span>
                </div>
              )}

              {currentMember.referenceId && (
                <div className="text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Reference ID:</span>
                    <button
                      onClick={handleCopyReferenceId}
                      className="text-orange-600 hover:text-orange-700"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <code className="block mt-1 bg-gray-100 rounded px-2 py-1 text-xs font-mono">
                    {currentMember.referenceId}
                  </code>
                </div>
              )}

              {currentMember.paymentReference && (
                <div className="text-sm">
                  <span className="text-gray-600">Payment Reference:</span>
                  <div className="mt-1 text-gray-700">{currentMember.paymentReference}</div>
                </div>
              )}

              {currentMember.paymentProofUrl && (
                <div className="text-sm">
                  <span className="text-gray-600">Payment Proof:</span>
                  <div className="mt-2 border rounded-lg p-3 bg-gray-50">
                    {isPdfUrl(currentMember.paymentProofUrl) ? (
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="w-10 h-10 text-red-500" />
                        <a
                          href={getSharedAssetUrl(currentMember.paymentProofUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 hover:text-orange-700 flex items-center gap-1"
                        >
                          <ExternalLink className="w-4 h-4" />
                          View PDF
                        </a>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <img
                          src={getSharedAssetUrl(currentMember.paymentProofUrl)}
                          alt="Payment proof"
                          className="max-h-32 rounded-lg object-contain"
                        />
                        <a
                          href={getSharedAssetUrl(currentMember.paymentProofUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 hover:text-orange-700 flex items-center gap-1 text-xs"
                        >
                          <ExternalLink className="w-4 h-4" />
                          View Full Size
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment Form - show if member hasn't paid OR there are unpaid teammates */}
          {(!memberHasPaid || unpaidMembers.length > 0) && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Reference ID for Payment */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-700 mb-2">Your Reference ID</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 font-mono text-sm">
                    {referenceId}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyReferenceId}
                    className="flex items-center gap-1 px-3 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors text-sm font-medium"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Include this ID in your payment note/memo so the organizer can match your payment to your registration.
                </p>
              </div>

              {/* Member Selection - Pay for team */}
              {acceptedMembers.length > 1 && unpaidMembers.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">Paying for</span>
                    </div>
                    {unpaidMembers.length > 1 && (
                      <button
                        type="button"
                        onClick={toggleAllUnpaid}
                        className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                      >
                        {selectedMemberIds.length === unpaidMembers.length ? 'Select just me' : 'Select all'}
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {acceptedMembers.map(member => {
                      const isSelected = selectedMemberIds.includes(member.userId);
                      const isCurrentUser = member.userId === userId;
                      const alreadyPaid = member.hasPaid;

                      return (
                        <div
                          key={member.userId}
                          onClick={() => !alreadyPaid && toggleMemberSelection(member.userId)}
                          className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                            alreadyPaid
                              ? 'bg-green-50 border-green-200 cursor-not-allowed'
                              : isSelected
                                ? 'bg-orange-50 border-orange-300'
                                : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected || alreadyPaid}
                              disabled={alreadyPaid}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                if (!alreadyPaid) toggleMemberSelection(member.userId);
                              }}
                              className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 disabled:opacity-50"
                            />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {member.name || `Player ${member.userId}`}
                                {isCurrentUser && <span className="text-orange-600 ml-1">(you)</span>}
                              </div>
                              {alreadyPaid && (
                                <div className="text-xs text-green-600">Already paid</div>
                              )}
                            </div>
                          </div>
                          <div className={`text-sm font-medium ${alreadyPaid ? 'text-green-600' : 'text-gray-700'}`}>
                            ${perPersonAmount.toFixed(2)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedMemberIds.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">
                        Total for {selectedMemberIds.length} member{selectedMemberIds.length > 1 ? 's' : ''}:
                      </span>
                      <span className="text-lg font-semibold text-orange-600">
                        ${(selectedMemberIds.length * perPersonAmount).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 pl-7 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder={remainingAmount.toFixed(2)}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Adjust if you have a discount or are making a partial payment
                </p>
              </div>

              {/* Upload Payment Proof */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload Payment Proof
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-orange-400 transition-colors">
                  {previewImage ? (
                    <div className="space-y-2">
                      <img
                        src={previewImage}
                        alt="Payment proof"
                        className="max-h-32 mx-auto rounded-lg object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewImage(null);
                          setPaymentProofUrl('');
                        }}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ) : paymentProofUrl ? (
                    <div className="space-y-2">
                      {isPdfUrl(paymentProofUrl) && (
                        <div className="flex justify-center">
                          <FileText className="w-12 h-12 text-red-500" />
                        </div>
                      )}
                      <a
                        href={paymentProofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:text-orange-700 flex items-center justify-center gap-1"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {isPdfUrl(paymentProofUrl) ? 'View PDF' : 'View Uploaded File'}
                      </a>
                      <button
                        type="button"
                        onClick={() => setPaymentProofUrl('')}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={isUploading}
                      />
                      {isUploading ? (
                        <div className="flex items-center justify-center gap-2 text-gray-500">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Uploading...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-gray-500">
                          <Upload className="w-8 h-8" />
                          <span className="text-sm">Click to upload screenshot or receipt</span>
                          <span className="text-xs text-gray-400">JPG, PNG, GIF, WebP, or PDF (max 5MB)</span>
                        </div>
                      )}
                    </label>
                  )}
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                >
                  {PAYMENT_METHODS.map(method => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </div>

              {/* Payment Reference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Reference / Transaction ID
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g., Venmo @username, Zelle confirmation, etc."
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !paymentMethod || (!paymentProofUrl && !paymentReference)}
                className="w-full py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Submit Payment Proof
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
