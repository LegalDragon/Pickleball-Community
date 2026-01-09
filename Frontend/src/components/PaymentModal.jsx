import { useState, useEffect } from 'react';
import { X, DollarSign, Upload, CheckCircle, AlertCircle, Loader2, Image, ExternalLink, Copy, Check } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { tournamentApi, sharedAssetApi, getSharedAssetUrl } from '../services/api';

export default function PaymentModal({ isOpen, onClose, registration, event, onPaymentUpdated }) {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (registration) {
      setPaymentReference(registration.paymentReference || '');
      setPaymentProofUrl(registration.paymentProofUrl || '');
      setPreviewImage(registration.paymentProofUrl || null);
      // Initialize payment amount to remaining balance
      const remaining = (registration.amountDue || 0) - (registration.amountPaid || 0);
      setPaymentAmount(remaining > 0 ? remaining.toFixed(2) : '');
    }
  }, [registration]);

  const referenceId = event && registration ? `E${event.id}-U${registration.unitId}` : '';

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

  if (!isOpen || !registration) return null;

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

    if (!paymentProofUrl && !paymentReference) {
      toast.error('Please upload payment proof or enter a payment reference');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await tournamentApi.uploadPaymentProof(event.id, registration.unitId, {
        paymentProofUrl,
        paymentReference,
        amountPaid: paymentAmount ? parseFloat(paymentAmount) : null,
      });

      if (response.success) {
        toast.success('Payment information submitted');
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
          {/* Important Payment Note - Always visible */}
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <DollarSign className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-blue-800 text-base">Payment is per team/pair, not per person</div>
                <div className="text-sm text-blue-700 mt-1">
                  {registration.partners?.length > 0
                    ? "Only ONE payment is needed for your team. Please coordinate with your partner to avoid paying twice."
                    : "The registration fee covers your entire team/unit entry."}
                </div>
              </div>
            </div>
          </div>

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
              <span className="text-gray-600">Registration Fee (per team):</span>
              <span className="font-medium">${amountDue.toFixed(2)}</span>
            </div>
            {amountPaid > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Amount Paid:</span>
                <span className="font-medium">-${amountPaid.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium">Amount Due:</span>
              <span className={`font-bold ${remainingAmount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                ${remainingAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            isPaid ? 'bg-green-50 text-green-700' :
            registration.paymentStatus === 'PendingVerification' ? 'bg-blue-50 text-blue-700' :
            registration.paymentStatus === 'Partial' ? 'bg-yellow-50 text-yellow-700' :
            'bg-orange-50 text-orange-700'
          }`}>
            {isPaid ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-medium">
              {isPaid ? 'Payment Complete' :
               registration.paymentStatus === 'PendingVerification' ? 'Awaiting Verification' :
               registration.paymentStatus === 'Partial' ? 'Partial Payment' :
               'Payment Required'}
            </span>
          </div>

          {/* Payment Form (only if not fully paid) */}
          {!isPaid && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Payment Instructions */}
              {event.paymentInstructions && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-blue-800 mb-1">Payment Instructions</div>
                  <div className="text-sm text-blue-700 whitespace-pre-wrap">{event.paymentInstructions}</div>
                </div>
              )}

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
                      <a
                        href={paymentProofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:text-orange-700 flex items-center justify-center gap-1"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Uploaded File
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
                disabled={isSubmitting || (!paymentProofUrl && !paymentReference)}
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

          {/* Already Paid Info */}
          {isPaid && registration.paidAt && (
            <div className="text-sm text-gray-500 text-center">
              Paid on {new Date(registration.paidAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
