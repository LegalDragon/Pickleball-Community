import { X, DollarSign, ExternalLink, FileText, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { getSharedAssetUrl } from '../services/api';

export default function MemberPaymentModal({ isOpen, onClose, memberPayment }) {
  const toast = useToast();
  const [copied, setCopied] = useState(null);

  if (!isOpen || !memberPayment) return null;

  const { member, unit, division } = memberPayment;

  const isPdfUrl = (url) => {
    if (!url) return false;
    const lowercaseUrl = url.toLowerCase();
    return lowercaseUrl.endsWith('.pdf') || lowercaseUrl.includes('.pdf?');
  };

  const handleCopy = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const proofUrl = member.paymentProofUrl ? getSharedAssetUrl(member.paymentProofUrl) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
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
          {/* Member Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="font-medium text-gray-900">
              {member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Member'}
            </div>
            <div className="text-sm text-gray-500">
              {division?.name && <span>{division.name}</span>}
              {unit?.teamUnitName && <span> • {unit.teamUnitName}</span>}
            </div>
          </div>

          {/* Payment Status */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700">
            <DollarSign className="w-5 h-5" />
            <span className="font-medium">Payment Submitted</span>
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

            {/* Paid At */}
            {member.paidAt && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Paid On:</span>
                <span className="font-medium">{new Date(member.paidAt).toLocaleDateString()}</span>
              </div>
            )}

            {/* Reference ID */}
            {member.referenceId && (
              <div className="py-2 border-b">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Reference ID:</span>
                  <button
                    onClick={() => handleCopy(member.referenceId, 'referenceId')}
                    className="flex items-center gap-1 text-orange-600 hover:text-orange-700"
                  >
                    {copied === 'referenceId' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <code className="block mt-1 bg-gray-100 rounded px-2 py-1 text-sm font-mono">
                  {member.referenceId}
                </code>
              </div>
            )}

            {/* Payment Reference */}
            {member.paymentReference && (
              <div className="py-2 border-b">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Payment Reference:</span>
                  <button
                    onClick={() => handleCopy(member.paymentReference, 'paymentReference')}
                    className="flex items-center gap-1 text-orange-600 hover:text-orange-700"
                  >
                    {copied === 'paymentReference' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="mt-1 text-sm text-gray-700">{member.paymentReference}</div>
              </div>
            )}

            {/* Payment Proof */}
            {proofUrl && (
              <div className="py-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Payment Proof:</span>
                  <button
                    onClick={() => handleCopy(proofUrl, 'proofUrl')}
                    className="flex items-center gap-1 text-orange-600 hover:text-orange-700"
                  >
                    {copied === 'proofUrl' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="border rounded-lg p-3 bg-gray-50">
                  {isPdfUrl(proofUrl) ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-12 h-12 text-red-500" />
                      <a
                        href={proofUrl}
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
                        src={proofUrl}
                        alt="Payment proof"
                        className="max-h-48 rounded-lg object-contain"
                      />
                      <a
                        href={proofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:text-orange-700 flex items-center gap-1 text-sm"
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
        </div>
      </div>
    </div>
  );
}
