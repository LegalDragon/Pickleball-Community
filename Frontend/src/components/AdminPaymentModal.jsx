import { useState } from 'react';
import { X, DollarSign, CheckCircle, AlertCircle, ExternalLink, Image, FileText, Loader2, XCircle } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { tournamentApi, getSharedAssetUrl } from '../services/api';

export default function AdminPaymentModal({ isOpen, onClose, unit, event, onPaymentUpdated }) {
  const toast = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  if (!isOpen || !unit) return null;

  const amountDue = unit.amountDue || 0;
  const amountPaid = unit.amountPaid || 0;
  const paymentStatus = unit.paymentStatus || 'Pending';
  const isPaid = paymentStatus === 'Paid';
  const hasPendingProof = paymentStatus === 'PendingVerification';

  // Get full URL for payment proof
  const paymentProofUrl = unit.paymentProofUrl
    ? (unit.paymentProofUrl.startsWith('http') ? unit.paymentProofUrl : getSharedAssetUrl(unit.paymentProofUrl))
    : null;

  // Check if it's an image
  const isImage = paymentProofUrl && (
    paymentProofUrl.includes('/asset/') ||
    /\.(jpg|jpeg|png|gif|webp)$/i.test(paymentProofUrl)
  );

  const handleMarkAsPaid = async () => {
    setIsUpdating(true);
    try {
      const response = await tournamentApi.markAsPaid(event.id, unit.unitId);
      if (response.success) {
        toast.success('Marked as paid');
        onPaymentUpdated?.(unit.unitId, response.data);
        onClose();
      } else {
        toast.error(response.message || 'Failed to mark as paid');
      }
    } catch (err) {
      console.error('Error marking as paid:', err);
      toast.error('Failed to mark as paid');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUnmarkPaid = async () => {
    setIsUpdating(true);
    try {
      const response = await tournamentApi.unmarkPaid(event.id, unit.unitId);
      if (response.success) {
        toast.success('Payment unmarked');
        onPaymentUpdated?.(unit.unitId, response.data);
        onClose();
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold">Payment Details</h2>
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
          {/* Unit Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="font-medium text-gray-900">{unit.divisionName}</div>
            <div className="text-sm text-gray-500 mt-1">
              {unit.members?.map(m => m.lastName && m.firstName ? `${m.lastName}, ${m.firstName}` : (m.lastName || m.firstName || 'Player')).join(' & ') || unit.userName}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Unit ID: {unit.unitId}
            </div>
          </div>

          {/* Payment Summary */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Registration Fee:</span>
              <span className="font-medium">${amountDue.toFixed(2)}</span>
            </div>
            {amountPaid > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Amount Paid:</span>
                <span className="font-medium">${amountPaid.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium">Balance:</span>
              <span className={`font-bold ${(amountDue - amountPaid) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                ${(amountDue - amountPaid).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            isPaid ? 'bg-green-50 text-green-700' :
            hasPendingProof ? 'bg-blue-50 text-blue-700' :
            paymentStatus === 'Partial' ? 'bg-yellow-50 text-yellow-700' :
            'bg-orange-50 text-orange-700'
          }`}>
            {isPaid ? (
              <CheckCircle className="w-5 h-5" />
            ) : hasPendingProof ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span className="font-medium">
              {isPaid ? 'Payment Complete' :
               hasPendingProof ? 'Awaiting Verification' :
               paymentStatus === 'Partial' ? 'Partial Payment' :
               'Payment Pending'}
            </span>
          </div>

          {/* Reference ID */}
          {unit.referenceId && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="text-sm font-medium text-orange-700 mb-1">Reference ID</div>
              <code className="text-sm font-mono text-orange-900">{unit.referenceId}</code>
            </div>
          )}

          {/* Payment Reference */}
          {unit.paymentReference && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm font-medium text-gray-700 mb-1">Payment Reference</div>
              <div className="text-sm text-gray-900">{unit.paymentReference}</div>
            </div>
          )}

          {/* Payment Proof */}
          {paymentProofUrl && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Payment Proof</div>
              <div className="border rounded-lg overflow-hidden">
                {isImage ? (
                  <a href={paymentProofUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={paymentProofUrl}
                      alt="Payment proof"
                      className="w-full max-h-64 object-contain bg-gray-100"
                    />
                  </a>
                ) : (
                  <a
                    href={paymentProofUrl}
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

          {/* Paid Date */}
          {unit.paidAt && (
            <div className="text-sm text-gray-500">
              Paid on {new Date(unit.paidAt).toLocaleDateString()} at {new Date(unit.paidAt).toLocaleTimeString()}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {!isPaid ? (
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
                Mark as Paid
              </button>
            ) : (
              <button
                onClick={handleUnmarkPaid}
                disabled={isUpdating}
                className="flex-1 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Unmark Payment
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
