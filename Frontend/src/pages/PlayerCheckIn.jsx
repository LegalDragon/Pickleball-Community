import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, XCircle, FileText, DollarSign,
  Loader2, AlertCircle, Trophy, Clock, Send, ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { checkInApi, eventsApi } from '../services/api';
import SignatureCanvas from '../components/SignatureCanvas';

export default function PlayerCheckIn() {
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();

  // Check if redo mode is enabled (allows re-signing waiver even if checked in)
  const redoMode = searchParams.get('redo') === 'waiver';

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [checkInStatus, setCheckInStatus] = useState(null);
  const [step, setStep] = useState(1); // 1: Waiver, 2: Payment, 3: Submit
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmPayment, setConfirmPayment] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [eventRes, statusRes] = await Promise.all([
        eventsApi.getEvent(eventId),
        checkInApi.getStatus(eventId, redoMode ? 'waiver' : null)
      ]);

      if (eventRes.success) {
        setEvent(eventRes.data);
      }

      if (statusRes.success) {
        setCheckInStatus(statusRes.data);
        // Determine current step based on status
        // In redo mode, always show waiver step (step 1) if there are pending waivers
        if (redoMode && statusRes.data.pendingWaivers?.length > 0) {
          setStep(1);
        } else if (!statusRes.data.waiverSigned && statusRes.data.pendingWaivers?.length > 0) {
          setStep(1);
        } else if (!statusRes.data.isCheckedIn) {
          setStep(2);
        } else {
          setStep(3);
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
      toast.error('Failed to load check-in data');
    } finally {
      setLoading(false);
    }
  }, [eventId, toast, redoMode]);

  useEffect(() => {
    if (isAuthenticated && eventId) {
      loadData();
    }
  }, [isAuthenticated, eventId, loadData]);

  const handleSignWaiver = async (waiverId, signatureData) => {
    try {
      await checkInApi.signWaiver(eventId, waiverId, signatureData);
      toast.success('Waiver signed successfully');
      setShowWaiverModal(false);
      await loadData();
    } catch (err) {
      console.error('Error signing waiver:', err);
      toast.error(err?.response?.data?.message || 'Failed to sign waiver');
    }
  };

  const handleRequestCheckIn = async () => {
    try {
      setSubmitting(true);
      const response = await checkInApi.requestCheckIn(eventId, confirmPayment);

      if (response.success) {
        toast.success('Check-in requested! Awaiting admin approval.');
        // Redirect to player dashboard
        navigate(`/event/${eventId}/game-day`);
      } else {
        toast.error(response.message || 'Failed to request check-in');
      }
    } catch (err) {
      console.error('Error requesting check-in:', err);
      toast.error(err?.response?.data?.message || 'Failed to request check-in');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Login Required</h2>
          <p className="text-gray-600">Please log in to check in for this event.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading check-in...</p>
        </div>
      </div>
    );
  }

  if (!checkInStatus?.isRegistered) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Not Registered</h2>
          <p className="text-gray-600 mb-4">You are not registered for this event.</p>
          <Link
            to={`/events/${eventId}`}
            className="text-orange-600 hover:text-orange-700 font-medium"
          >
            View Event Details
          </Link>
        </div>
      </div>
    );
  }

  const waiverSigned = checkInStatus?.waiverSigned;
  const pendingWaivers = checkInStatus?.pendingWaivers || [];
  const isAlreadyCheckedIn = checkInStatus?.isCheckedIn;

  // Show "already checked in" unless redo mode is enabled (admin sent link to re-sign waiver)
  if (isAlreadyCheckedIn && !redoMode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Already Checked In</h2>
          <p className="text-gray-600 mb-6">
            You have already completed check-in for this event.
          </p>
          <Link
            to={`/event/${eventId}/game-day`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors"
          >
            <Trophy className="w-5 h-5" />
            Go to Player Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold text-gray-900">Check-In</h1>
            <p className="text-sm text-gray-500">{event?.name}</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-orange-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
              waiverSigned ? 'bg-green-100 text-green-600' : step >= 1 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100'
            }`}>
              {waiverSigned ? <CheckCircle className="w-5 h-5" /> : '1'}
            </div>
            <span className="text-sm font-medium">Waiver</span>
          </div>
          <div className="w-8 h-0.5 bg-gray-200" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-orange-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
              step > 2 ? 'bg-green-100 text-green-600' : step >= 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100'
            }`}>
              {step > 2 ? <CheckCircle className="w-5 h-5" /> : '2'}
            </div>
            <span className="text-sm font-medium">Payment</span>
          </div>
          <div className="w-8 h-0.5 bg-gray-200" />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-orange-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
              step >= 3 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100'
            }`}>
              3
            </div>
            <span className="text-sm font-medium">Submit</span>
          </div>
        </div>

        {/* Step 1: Waiver */}
        <div className={`bg-white rounded-xl border p-6 ${step === 1 && (!waiverSigned || redoMode) ? 'ring-2 ring-orange-500' : ''}`}>
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${waiverSigned && !redoMode ? 'bg-green-100' : 'bg-orange-100'}`}>
              <FileText className={`w-6 h-6 ${waiverSigned && !redoMode ? 'text-green-600' : 'text-orange-600'}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">
                {redoMode ? 'Re-Sign Waiver' : 'Sign Waiver'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {redoMode
                  ? 'Please re-sign the event waiver as requested by the organizer'
                  : waiverSigned
                  ? 'You have signed the event waiver'
                  : 'Please read and sign the event waiver to continue'}
              </p>

              {waiverSigned && checkInStatus?.signedWaiverPdfUrl && (
                <a
                  href={checkInStatus.signedWaiverPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 mt-2"
                >
                  <FileText className="w-4 h-4" />
                  View Signed Waiver
                </a>
              )}

              {/* Show sign button if waiver not signed OR in redo mode */}
              {((!waiverSigned || redoMode) && pendingWaivers.length > 0) && (
                <button
                  onClick={() => setShowWaiverModal(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors"
                >
                  {redoMode && waiverSigned ? 'Re-Sign Waiver' : 'Sign Waiver'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
            {waiverSigned && !redoMode && (
              <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Step 2: Payment Verification */}
        <div className={`bg-white rounded-xl border p-6 ${step === 2 && waiverSigned ? 'ring-2 ring-orange-500' : ''}`}>
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${confirmPayment ? 'bg-green-100' : 'bg-orange-100'}`}>
              <DollarSign className={`w-6 h-6 ${confirmPayment ? 'text-green-600' : 'text-orange-600'}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Verify Payment</h3>
              <p className="text-sm text-gray-500 mt-1">
                Confirm that you have submitted payment for this event
              </p>

              {event?.paymentInstructions && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                  <strong>Payment Instructions:</strong>
                  <p className="mt-1 whitespace-pre-wrap">{event.paymentInstructions}</p>
                </div>
              )}

              {waiverSigned && (
                <label className="flex items-start gap-3 mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmPayment}
                    onChange={(e) => setConfirmPayment(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">
                    I confirm that I have submitted payment for this event registration
                  </span>
                </label>
              )}
            </div>
            {confirmPayment && (
              <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Step 3: Submit Check-In Request */}
        <div className={`bg-white rounded-xl border p-6 ${step === 3 || (waiverSigned && confirmPayment) ? 'ring-2 ring-orange-500' : ''}`}>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-orange-100">
              <Send className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Request Check-In</h3>
              <p className="text-sm text-gray-500 mt-1">
                Submit your check-in request for admin approval
              </p>

              <button
                onClick={handleRequestCheckIn}
                disabled={!waiverSigned || !confirmPayment || submitting}
                className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Submit Check-In Request
                  </>
                )}
              </button>

              {(!waiverSigned || !confirmPayment) && (
                <p className="mt-2 text-sm text-amber-600">
                  {!waiverSigned && 'Please sign the waiver first. '}
                  {!confirmPayment && 'Please confirm payment.'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex gap-3">
            <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">What happens next?</h4>
              <p className="text-sm text-blue-700 mt-1">
                After you submit your check-in request, an admin will review and approve it.
                You will be able to see your status on the Player Dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Waiver Modal */}
      {showWaiverModal && pendingWaivers.length > 0 && (
        <WaiverModal
          waiver={pendingWaivers[0]}
          playerName={checkInStatus?.playerName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
          onSign={handleSignWaiver}
          onClose={() => setShowWaiverModal(false)}
        />
      )}
    </div>
  );
}

// Simple markdown renderer for waiver content
function renderMarkdown(text) {
  if (!text) return null;

  // Convert markdown to HTML-like elements
  const lines = text.split('\n');
  const elements = [];
  let inList = false;
  let listItems = [];

  const processInlineMarkdown = (line) => {
    // Bold: **text** or __text__
    line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    line = line.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // Italic: *text* or _text_
    line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
    line = line.replace(/_(.+?)_/g, '<em>$1</em>');
    return line;
  };

  lines.forEach((line, idx) => {
    const trimmedLine = line.trim();

    // Empty line
    if (!trimmedLine) {
      if (inList) {
        elements.push(<ul key={`list-${idx}`} className="list-disc pl-5 mb-2">{listItems}</ul>);
        listItems = [];
        inList = false;
      }
      return;
    }

    // Headers
    if (trimmedLine.startsWith('### ')) {
      elements.push(<h5 key={idx} className="font-semibold text-gray-800 mt-3 mb-1">{trimmedLine.slice(4)}</h5>);
      return;
    }
    if (trimmedLine.startsWith('## ')) {
      elements.push(<h4 key={idx} className="font-bold text-gray-900 mt-4 mb-2">{trimmedLine.slice(3)}</h4>);
      return;
    }
    if (trimmedLine.startsWith('# ')) {
      elements.push(<h3 key={idx} className="text-lg font-bold text-gray-900 mt-4 mb-2">{trimmedLine.slice(2)}</h3>);
      return;
    }

    // List items
    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      inList = true;
      listItems.push(
        <li key={idx} className="mb-1" dangerouslySetInnerHTML={{ __html: processInlineMarkdown(trimmedLine.slice(2)) }} />
      );
      return;
    }

    // Numbered list
    if (/^\d+\.\s/.test(trimmedLine)) {
      const content = trimmedLine.replace(/^\d+\.\s/, '');
      elements.push(
        <div key={idx} className="flex gap-2 mb-1">
          <span className="text-gray-500">{trimmedLine.match(/^\d+/)[0]}.</span>
          <span dangerouslySetInnerHTML={{ __html: processInlineMarkdown(content) }} />
        </div>
      );
      return;
    }

    // Close any open list
    if (inList) {
      elements.push(<ul key={`list-${idx}`} className="list-disc pl-5 mb-2">{listItems}</ul>);
      listItems = [];
      inList = false;
    }

    // Regular paragraph
    elements.push(
      <p key={idx} className="mb-2" dangerouslySetInnerHTML={{ __html: processInlineMarkdown(trimmedLine) }} />
    );
  });

  // Close any remaining list
  if (inList && listItems.length > 0) {
    elements.push(<ul key="list-end" className="list-disc pl-5 mb-2">{listItems}</ul>);
  }

  return elements;
}

// Waiver Modal Component
function WaiverModal({ waiver, playerName, onSign, onClose }) {
  const [signature, setSignature] = useState('');
  const [signatureImage, setSignatureImage] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);

  // Signer role state
  const [signerRole, setSignerRole] = useState('Participant'); // Participant, Parent, Guardian
  const [guardianName, setGuardianName] = useState('');

  const isGuardianSigning = signerRole !== 'Participant';

  const handleSubmit = async () => {
    if (!signature || !signatureImage || !agreed) {
      return;
    }

    // Validate guardian name if signing as guardian
    if (isGuardianSigning && !guardianName.trim()) {
      return;
    }

    setSigning(true);
    try {
      await onSign(waiver.id, {
        signature,
        signatureImage,
        emergencyPhone,
        signerRole,
        parentGuardianName: isGuardianSigning ? guardianName.trim() : null
      });
    } finally {
      setSigning(false);
    }
  };

  // Determine if content is markdown (check file extension or content patterns)
  const isMarkdown = waiver.fileName?.toLowerCase().endsWith('.md') ||
    waiver.fileUrl?.toLowerCase().endsWith('.md') ||
    (waiver.content && /^#|\*\*|^-\s|^\d+\.\s/m.test(waiver.content));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-lg font-semibold">Sign Waiver</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Waiver Content */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2">{waiver.title}</h4>
            {waiver.content ? (
              <div className="mt-2 p-4 bg-gray-50 rounded-lg max-h-80 overflow-y-auto text-sm border border-gray-200">
                {isMarkdown ? (
                  <div className="prose prose-sm max-w-none">
                    {renderMarkdown(waiver.content)}
                  </div>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: waiver.content }} />
                )}
              </div>
            ) : waiver.fileUrl ? (
              <div className="mt-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <a
                  href={waiver.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  View Waiver Document (opens in new tab)
                </a>
                <p className="text-sm text-blue-600 mt-1">
                  Please read the full document before signing below.
                </p>
              </div>
            ) : null}
          </div>

          {/* Signer Role Selection */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Who is signing this waiver?
            </label>
            <div className="flex flex-wrap gap-3">
              <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                signerRole === 'Participant'
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400'
              }`}>
                <input
                  type="radio"
                  name="signerRole"
                  value="Participant"
                  checked={signerRole === 'Participant'}
                  onChange={(e) => setSignerRole(e.target.value)}
                  className="sr-only"
                />
                <span className="font-medium">Self (Participant)</span>
              </label>
              <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                signerRole === 'Parent'
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400'
              }`}>
                <input
                  type="radio"
                  name="signerRole"
                  value="Parent"
                  checked={signerRole === 'Parent'}
                  onChange={(e) => setSignerRole(e.target.value)}
                  className="sr-only"
                />
                <span className="font-medium">Parent</span>
              </label>
              <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                signerRole === 'Guardian'
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400'
              }`}>
                <input
                  type="radio"
                  name="signerRole"
                  value="Guardian"
                  checked={signerRole === 'Guardian'}
                  onChange={(e) => setSignerRole(e.target.value)}
                  className="sr-only"
                />
                <span className="font-medium">Legal Guardian</span>
              </label>
            </div>

            {/* Guardian Name Field */}
            {isGuardianSigning && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {signerRole === 'Parent' ? "Parent's" : "Guardian's"} Full Legal Name *
                </label>
                <input
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder={`Enter ${signerRole.toLowerCase()}'s full name`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  By signing as {signerRole.toLowerCase()}, you confirm you have legal authority to sign on behalf of {playerName || 'the participant'}.
                </p>
              </div>
            )}
          </div>

          {/* Emergency Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Emergency Contact Phone (optional)
            </label>
            <input
              type="tel"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Typed Signature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isGuardianSigning ? `Type ${signerRole.toLowerCase()}'s full legal name` : 'Type your full legal name'}
            </label>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder={isGuardianSigning ? guardianName || `${signerRole}'s Full Name` : playerName || 'Your Full Name'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Drawn Signature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isGuardianSigning ? `Draw ${signerRole.toLowerCase()}'s signature` : 'Draw your signature'}
            </label>
            <SignatureCanvas
              onSignatureChange={setSignatureImage}
              className="border border-gray-300 rounded-lg"
            />
          </div>

          {/* Agreement Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <span className="text-sm text-gray-700">
              {isGuardianSigning ? (
                <>I, as the {signerRole.toLowerCase()} of {playerName || 'the participant'}, have read and agree to the terms of this waiver.
                I confirm I have legal authority to sign on behalf of the participant and understand that by signing this document,
                I am waiving certain legal rights on their behalf.</>
              ) : (
                <>I have read and agree to the terms of this waiver. I understand that by signing this document,
                I am waiving certain legal rights.</>
              )}
            </span>
          </label>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!signature || !signatureImage || !agreed || signing}
              className="flex-1 px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {signing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing...
                </>
              ) : (
                'Sign Waiver'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
