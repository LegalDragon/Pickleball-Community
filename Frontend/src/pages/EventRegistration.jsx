import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Calendar, MapPin, Users, DollarSign, ChevronLeft, ChevronRight,
  UserPlus, User, Loader2, AlertCircle, Check, Plus, LogIn,
  Copy, X, Upload, Image, FileText, ExternalLink, CreditCard,
  ScrollText, ChevronDown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { eventsApi, tournamentApi, sharedAssetApi, getSharedAssetUrl, checkInApi, eventStaffApi } from '../services/api';
import SignatureCanvas from '../components/SignatureCanvas';

const STEPS = [
  { id: 1, name: 'Select Division', description: 'Choose your division' },
  { id: 2, name: 'Team Formation', description: 'Set up your team' },
  { id: 3, name: 'Confirmation', description: 'Review & complete' },
  { id: 4, name: 'Waiver', description: 'Sign waiver' },
  { id: 5, name: 'Payment', description: 'Complete payment' }
];

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

export default function EventRegistration() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();

  // Data state
  const [event, setEvent] = useState(null);
  const [teamUnits, setTeamUnits] = useState([]);
  const [unitsLookingForPartners, setUnitsLookingForPartners] = useState([]);
  const [userRegistrations, setUserRegistrations] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);

  // Registration type state (Player or Staff)
  const [registrationType, setRegistrationType] = useState('Player');
  const [staffRoles, setStaffRoles] = useState([]);
  const [selectedStaffRoleId, setSelectedStaffRoleId] = useState(null);
  const [staffPreferredRoles, setStaffPreferredRoles] = useState([]);
  const [staffNotes, setStaffNotes] = useState('');
  const [staffContactPhone, setStaffContactPhone] = useState('');
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);

  // Registration state
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [selectedFeeId, setSelectedFeeId] = useState(null);
  const [selectedJoinMethod, setSelectedJoinMethod] = useState('Approval');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [registering, setRegistering] = useState(false);
  const [joiningByCode, setJoiningByCode] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [requestingToJoin, setRequestingToJoin] = useState(null);

  // Result state
  const [registrationResult, setRegistrationResult] = useState(null);
  const [newJoinCode, setNewJoinCode] = useState(null);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [selectedTeammateIds, setSelectedTeammateIds] = useState([]); // For paying for teammates
  const [unitMembers, setUnitMembers] = useState([]); // Members of the registered unit

  // Waiver state
  const [waivers, setWaivers] = useState([]);
  const [currentWaiverIndex, setCurrentWaiverIndex] = useState(0);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [signatureImage, setSignatureImage] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [signerRole, setSignerRole] = useState('Participant');
  const [guardianName, setGuardianName] = useState('');
  const [agreedToWaiver, setAgreedToWaiver] = useState(false);
  const [isSigningWaiver, setIsSigningWaiver] = useState(false);
  const [loadingWaivers, setLoadingWaivers] = useState(false);
  const waiverContentRef = useRef(null);

  // Load event data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load event (public endpoint - works for non-authenticated users too)
        const eventResponse = await eventsApi.getEventPublic(eventId);
        if (!eventResponse.success || !eventResponse.data) {
          setError('Event not found');
          return;
        }
        setEvent(eventResponse.data);

        // Load team units for reference
        try {
          const teamUnitsResponse = await eventsApi.getTeamUnits();
          if (teamUnitsResponse.success) {
            setTeamUnits(teamUnitsResponse.data || []);
          }
        } catch (e) {
          console.log('Could not load team units:', e);
        }

        // If authenticated, load user's existing registrations
        if (isAuthenticated) {
          try {
            const unitsResponse = await tournamentApi.getEventUnits(eventId);
            if (unitsResponse.success && unitsResponse.data) {
              const myUnits = unitsResponse.data.filter(u =>
                u.members?.some(m => m.userId === user?.id && m.inviteStatus === 'Accepted')
              );
              setUserRegistrations(myUnits);
            }
          } catch (e) {
            console.log('Could not load user registrations:', e);
          }
        }
      } catch (err) {
        console.error('Error loading event:', err);
        setError(err?.message || 'Failed to load event');
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      loadData();
    }
  }, [eventId, isAuthenticated, user?.id]);

  // Load units looking for partners when division is selected
  const loadUnitsLookingForPartners = async (divisionId) => {
    setLoadingUnits(true);
    try {
      const response = await tournamentApi.getUnitsLookingForPartners(eventId, divisionId);
      if (response.success) {
        // Filter out user's own units
        const filtered = (response.data || []).filter(u => u.captainUserId !== user?.id);
        setUnitsLookingForPartners(filtered);
      }
    } catch (err) {
      console.log('Error loading units:', err);
      setUnitsLookingForPartners([]);
    } finally {
      setLoadingUnits(false);
    }
  };

  // Load event waivers
  const loadWaivers = async () => {
    setLoadingWaivers(true);
    try {
      const response = await checkInApi.getWaivers(eventId);
      if (response.success && response.data?.length > 0) {
        setWaivers(response.data);
        setCurrentWaiverIndex(0);
        setHasScrolledToEnd(false);
        setSignatureImage('');
        setAgreedToWaiver(false);
      } else {
        setWaivers([]);
      }
    } catch (err) {
      console.log('Error loading waivers:', err);
      setWaivers([]);
    } finally {
      setLoadingWaivers(false);
    }
  };

  // Handle scroll to detect when user reaches the end of waiver content
  const handleWaiverScroll = useCallback((e) => {
    const element = e.target;
    const scrolledToBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 20;
    if (scrolledToBottom && !hasScrolledToEnd) {
      setHasScrolledToEnd(true);
    }
  }, [hasScrolledToEnd]);

  // Reset waiver state for next waiver
  const resetWaiverState = () => {
    setHasScrolledToEnd(false);
    setSignatureImage('');
    setAgreedToWaiver(false);
    setSignerRole('Participant');
    setGuardianName('');
    setEmergencyPhone('');
  };

  // Check if current waiver content needs scrolling
  const checkIfScrollNeeded = useCallback(() => {
    if (waiverContentRef.current) {
      const element = waiverContentRef.current;
      // If content doesn't need scrolling (fits in view), auto-reveal signing block
      if (element.scrollHeight <= element.clientHeight + 10) {
        setHasScrolledToEnd(true);
      }
    }
  }, []);

  // Check scroll need when waiver changes
  useEffect(() => {
    if (currentStep === 4 && waivers.length > 0) {
      setTimeout(checkIfScrollNeeded, 100);
    }
  }, [currentStep, currentWaiverIndex, waivers, checkIfScrollNeeded]);

  // Helper to determine if current signer is guardian/parent
  const isGuardianSigning = signerRole !== 'Participant';
  const currentWaiver = waivers[currentWaiverIndex];

  // Get player's full name for signature
  const playerFullName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';

  // Render markdown content (simplified version)
  const renderWaiverContent = (content) => {
    if (!content) return null;

    // Check if content looks like markdown
    const isMarkdown = /^#|\*\*|^-\s|^\d+\.\s/m.test(content);

    if (isMarkdown) {
      // Simple markdown rendering
      const lines = content.split('\n');
      return lines.map((line, i) => {
        // Headers
        if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
        if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold mt-3 mb-2">{line.slice(3)}</h2>;
        if (line.startsWith('### ')) return <h3 key={i} className="text-base font-bold mt-2 mb-1">{line.slice(4)}</h3>;
        // Bold
        const boldText = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // List items
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <li key={i} className="ml-4" dangerouslySetInnerHTML={{ __html: boldText.slice(2) }} />;
        }
        if (/^\d+\.\s/.test(line)) {
          return <li key={i} className="ml-4 list-decimal" dangerouslySetInnerHTML={{ __html: line.replace(/^\d+\.\s/, '') }} />;
        }
        // Empty line
        if (!line.trim()) return <br key={i} />;
        // Regular paragraph
        return <p key={i} className="mb-2" dangerouslySetInnerHTML={{ __html: boldText }} />;
      });
    }

    // Plain text or HTML
    return <div dangerouslySetInnerHTML={{ __html: content }} />;
  };

  // Check if user can register for a division
  const canRegisterForDivision = (divisionId) => {
    if (!event?.allowMultipleDivisions && userRegistrations.length > 0) {
      return false;
    }
    return !userRegistrations.some(u => u.divisionId === divisionId);
  };

  // Get team size for a division
  const getTeamSize = (division) => {
    if (!division) return 1;
    if (division.teamUnitId) {
      const teamUnit = teamUnits.find(t => t.id === division.teamUnitId);
      return teamUnit?.totalPlayers || division.teamSize || 1;
    }
    return division.teamSize || 1;
  };

  // Get the currently selected fee
  const getSelectedFee = () => {
    if (!selectedDivision || !selectedFeeId) return null;
    const availableFees = (selectedDivision.fees || []).filter(f => f.isActive && f.isCurrentlyAvailable);
    return availableFees.find(f => f.id === selectedFeeId) || null;
  };

  // Get the effective fee amount (selected fee or fallback to division/event fee)
  const getEffectiveFeeAmount = () => {
    const selectedFee = getSelectedFee();
    if (selectedFee) return selectedFee.amount;
    return selectedDivision?.divisionFee || event?.perDivisionFee || event?.registrationFee || 0;
  };

  // Check if division has multiple fee options
  const hasFeeOptions = (division) => {
    const availableFees = (division?.fees || []).filter(f => f.isActive && f.isCurrentlyAvailable);
    return availableFees.length > 0;
  };

  // Load staff roles when switching to staff registration
  useEffect(() => {
    if (registrationType === 'Staff' && eventId && staffRoles.length === 0) {
      loadStaffRoles();
    }
  }, [registrationType, eventId]);

  const loadStaffRoles = async () => {
    try {
      const res = await eventStaffApi.getAvailableRoles(eventId);
      if (res.success) {
        setStaffRoles(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load staff roles:', err);
    }
  };

  // Handle staff registration
  const handleStaffRegistration = async () => {
    if (!isAuthenticated) {
      toast.error('Please log in to register');
      return;
    }

    try {
      setIsSubmittingStaff(true);
      const res = await eventStaffApi.selfRegister(eventId, {
        roleId: selectedStaffRoleId || null,
        preferredRoles: staffPreferredRoles.length > 0 ? JSON.stringify(staffPreferredRoles) : null,
        notes: staffNotes || null,
        contactPhone: staffContactPhone || null
      });

      if (res.success) {
        toast.success('Staff registration submitted! Awaiting admin approval.');
        // Navigate to event detail or my-events
        navigate(`/events/${eventId}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to register as staff');
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  // Handle division selection
  const handleSelectDivision = (division) => {
    if (!canRegisterForDivision(division.id)) {
      toast.error('You are already registered for this division');
      return;
    }
    setSelectedDivision(division);

    // Auto-select default fee if division has multiple fee options
    const availableFees = (division.fees || []).filter(f => f.isActive && f.isCurrentlyAvailable);
    if (availableFees.length > 0) {
      const defaultFee = availableFees.find(f => f.isDefault) || availableFees[0];
      setSelectedFeeId(defaultFee.id);
    } else {
      setSelectedFeeId(null);
    }

    const teamSize = getTeamSize(division);

    if (teamSize === 1) {
      // Singles - skip to step 3 (confirmation)
      setCurrentStep(3);
    } else {
      // Doubles/Teams - go to step 2
      loadUnitsLookingForPartners(division.id);
      setCurrentStep(2);
    }
  };

  // Handle registration
  const handleRegister = async (partnerUserId = null) => {
    if (!isAuthenticated || !selectedDivision) return;

    // Validate fee selection if division has fee options
    if (hasFeeOptions(selectedDivision) && !selectedFeeId) {
      toast.error('Please select a fee option');
      return;
    }

    setRegistering(true);
    try {
      const teamSize = getTeamSize(selectedDivision);
      const response = await tournamentApi.registerForEvent(event.id, {
        eventId: event.id,
        divisionIds: [selectedDivision.id],
        partnerUserId: partnerUserId > 0 ? partnerUserId : null,
        joinMethod: teamSize > 1 ? selectedJoinMethod : 'Approval',
        selectedFeeId: selectedFeeId || null
      });

      if (response.success) {
        setRegistrationResult(response.data?.[0] || response.data);

        // Show warnings
        if (response.warnings?.length > 0) {
          response.warnings.forEach(w => toast.warning(w));
        }

        // If code-based join, show the code
        if (selectedJoinMethod === 'Code' && response.data?.[0]?.joinCode) {
          setNewJoinCode(response.data[0].joinCode);
        }

        // Load unit members for payment step
        const unitId = response.data?.[0]?.unitId || response.data?.unitId;
        if (unitId) {
          try {
            const unitsResponse = await tournamentApi.getEventUnits(event.id);
            if (unitsResponse.success) {
              const registeredUnit = unitsResponse.data?.find(u => u.id === unitId);
              if (registeredUnit?.members) {
                setUnitMembers(registeredUnit.members.filter(m => m.inviteStatus === 'Accepted'));
              }
            }
          } catch (e) {
            console.log('Could not load unit members:', e);
          }
        }

        // Load waivers for this event and navigate accordingly
        try {
          const waiverResponse = await checkInApi.getWaivers(eventId);
          if (waiverResponse.success && waiverResponse.data?.length > 0) {
            setWaivers(waiverResponse.data);
            setCurrentWaiverIndex(0);
            resetWaiverState();
            setCurrentStep(4); // Go to waiver step
          } else {
            // No waivers, check for payment
            const hasFee = getEffectiveFeeAmount() > 0;
            if (hasFee) {
              setCurrentStep(5); // Go to payment step
            } else {
              setCurrentStep(3); // Show success confirmation
            }
          }
        } catch (e) {
          console.log('Could not load waivers:', e);
          // No waivers or error, check for payment
          const hasFee = getEffectiveFeeAmount() > 0;
          if (hasFee) {
            setCurrentStep(5);
          } else {
            setCurrentStep(3);
          }
        }

        toast.success('Successfully registered!');
      } else {
        toast.error(response.message || 'Failed to register');
      }
    } catch (err) {
      console.error('Error registering:', err);
      toast.error(err?.message || 'Failed to register. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  // Helper to check if URL is a PDF
  const isPdfUrl = (url) => {
    if (!url) return false;
    const lowercaseUrl = url.toLowerCase();
    return lowercaseUrl.endsWith('.pdf') || lowercaseUrl.includes('.pdf?');
  };

  // Handle file upload for payment proof
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
      const assetType = file.type === 'application/pdf' ? 'document' : 'image';
      const response = await sharedAssetApi.upload(file, assetType, 'payment-proof', true);
      if (response.success && response.url) {
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

  // Calculate payment amount for selected members
  const getPaymentTotal = () => {
    const selectedFee = getSelectedFee();
    const feeAmount = selectedFee?.amount || getEffectiveFeeAmount();

    // If paying for self only
    if (selectedTeammateIds.length === 0) {
      return feeAmount;
    }

    // Calculate total for self + selected teammates
    // Each member should have their own selected fee stored
    let total = feeAmount; // Start with current user's fee

    selectedTeammateIds.forEach(memberId => {
      const member = unitMembers.find(m => m.id === memberId);
      if (member) {
        // Use member's selected fee if available, otherwise use current fee
        const memberFee = member.selectedFee?.amount || feeAmount;
        total += memberFee;
      }
    });

    return total;
  };

  // Get unpaid teammates (members who haven't paid yet, excluding current user)
  const getUnpaidTeammates = () => {
    return unitMembers.filter(m =>
      m.userId !== user?.id &&
      !m.hasPaid &&
      m.inviteStatus === 'Accepted'
    );
  };

  // Handle payment submission
  const handleSubmitPayment = async () => {
    if (!paymentMethod) {
      toast.error('Please select a payment method');
      return;
    }

    if (!paymentProofUrl && !paymentReference) {
      toast.error('Please upload payment proof or enter a payment reference');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const unitId = registrationResult?.unitId;
      if (!unitId) {
        toast.error('Registration not found');
        return;
      }

      // Get member IDs to pay for (self + selected teammates)
      const currentMember = unitMembers.find(m => m.userId === user?.id);
      const memberIds = [currentMember?.id, ...selectedTeammateIds].filter(Boolean);

      const response = await tournamentApi.uploadPaymentProof(event.id, unitId, {
        paymentProofUrl,
        paymentReference,
        paymentMethod,
        amountPaid: getPaymentTotal(),
        memberIds
      });

      if (response.success) {
        toast.success('Payment submitted successfully!');
        setCurrentStep(3); // Go to success step
      } else {
        toast.error(response.message || 'Failed to submit payment');
      }
    } catch (err) {
      console.error('Error submitting payment:', err);
      toast.error('Failed to submit payment');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Handle pay later
  const handlePayLater = () => {
    toast.info('You can complete payment later from your dashboard');
    setCurrentStep(3); // Go to success step
  };

  // Handle waiver signing
  const handleSignWaiver = async () => {
    if (!currentWaiver || !signatureImage || !agreedToWaiver) {
      toast.error('Please complete all required fields');
      return;
    }

    // Validate guardian name if signing as guardian
    if (isGuardianSigning && !guardianName.trim()) {
      toast.error(`Please enter the ${signerRole.toLowerCase()}'s full name`);
      return;
    }

    setIsSigningWaiver(true);
    try {
      const signatureData = {
        signature: isGuardianSigning ? guardianName.trim() : playerFullName,
        signatureImage,
        signerRole,
        parentGuardianName: isGuardianSigning ? guardianName.trim() : null,
        emergencyPhone: emergencyPhone || null
      };

      const response = await checkInApi.signWaiver(eventId, currentWaiver.id, signatureData);

      if (response.success) {
        // Check if there are more waivers to sign
        if (currentWaiverIndex < waivers.length - 1) {
          setCurrentWaiverIndex(currentWaiverIndex + 1);
          resetWaiverState();
          toast.success('Waiver signed! Please sign the next waiver.');
        } else {
          // All waivers signed, move to next step
          toast.success('All waivers signed successfully!');
          const hasFee = getEffectiveFeeAmount() > 0;
          if (hasFee) {
            setCurrentStep(5); // Go to payment step
          } else {
            setCurrentStep(3); // Go to success confirmation
          }
        }
      } else {
        toast.error(response.message || 'Failed to sign waiver');
      }
    } catch (err) {
      console.error('Error signing waiver:', err);
      toast.error(err?.response?.data?.message || 'Failed to sign waiver');
    } finally {
      setIsSigningWaiver(false);
    }
  };

  // Handle skip waivers (for testing or when waivers are optional)
  const handleSkipWaivers = () => {
    const hasFee = getEffectiveFeeAmount() > 0;
    if (hasFee) {
      setCurrentStep(5);
    } else {
      setCurrentStep(3);
    }
  };

  // Handle join by code
  const handleJoinByCode = async () => {
    if (!joinCodeInput.trim()) {
      toast.error('Please enter a join code');
      return;
    }

    // If division has fee options and no fee selected, require selection
    if (selectedDivision && hasFeeOptions(selectedDivision) && !selectedFeeId) {
      toast.error('Please select a fee option before joining');
      return;
    }

    setJoiningByCode(true);
    try {
      const response = await tournamentApi.joinByCode(joinCodeInput.trim(), selectedFeeId);
      if (response.success) {
        setRegistrationResult(response.data);

        // Get the division info from the joined team
        const unitId = response.data?.unitId;
        if (unitId) {
          try {
            const unitsResponse = await tournamentApi.getEventUnits(event.id);
            if (unitsResponse.success) {
              const joinedUnit = unitsResponse.data?.find(u => u.id === unitId);
              if (joinedUnit) {
                // Set the division for payment calculation
                const division = event.divisions?.find(d => d.id === joinedUnit.divisionId);
                if (division) {
                  setSelectedDivision(division);
                  // Auto-select default fee if not already selected
                  if (!selectedFeeId && hasFeeOptions(division)) {
                    const availableFees = division.fees.filter(f => f.isActive && f.isCurrentlyAvailable);
                    const defaultFee = availableFees.find(f => f.isDefault) || availableFees[0];
                    if (defaultFee) setSelectedFeeId(defaultFee.id);
                  }
                }
                // Set unit members for payment step
                setUnitMembers(joinedUnit.members?.filter(m => m.inviteStatus === 'Accepted') || []);
              }
            }
          } catch (e) {
            console.log('Could not load unit details:', e);
          }
        }

        // Load waivers and navigate accordingly
        try {
          const waiverResponse = await checkInApi.getWaivers(eventId);
          if (waiverResponse.success && waiverResponse.data?.length > 0) {
            setWaivers(waiverResponse.data);
            setCurrentWaiverIndex(0);
            resetWaiverState();
            setCurrentStep(4); // Go to waiver step
          } else {
            // No waivers, check for payment
            const hasFee = getEffectiveFeeAmount() > 0;
            if (hasFee) {
              setCurrentStep(5);
            } else {
              setCurrentStep(3);
            }
          }
        } catch (e) {
          console.log('Could not load waivers:', e);
          const hasFee = getEffectiveFeeAmount() > 0;
          if (hasFee) {
            setCurrentStep(5);
          } else {
            setCurrentStep(3);
          }
        }
        toast.success(response.message || 'Successfully joined the team!');
      } else {
        toast.error(response.message || 'Failed to join');
      }
    } catch (err) {
      toast.error(err?.message || 'Invalid join code. Please check and try again.');
    } finally {
      setJoiningByCode(false);
    }
  };

  // Handle request to join existing unit
  const handleRequestToJoin = async (unitId) => {
    setRequestingToJoin(unitId);
    try {
      const response = await tournamentApi.requestToJoinUnit(unitId);
      if (response.success) {
        toast.success('Join request sent! The captain will be notified.');
        // Remove from list
        setUnitsLookingForPartners(prev => prev.filter(u => u.id !== unitId));
      } else {
        toast.error(response.message || 'Failed to send request');
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to send request');
    } finally {
      setRequestingToJoin(null);
    }
  };

  // Format helpers
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Check registration status
  const isRegistrationOpen = event?.registrationOpenDate
    ? new Date(event.registrationOpenDate) <= new Date()
    : true;
  const isRegistrationClosed = event?.registrationCloseDate
    ? new Date(event.registrationCloseDate) < new Date()
    : false;
  const isEventPast = event?.endDate ? new Date(event.endDate) < new Date() : false;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading event...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Event Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'This event is not available.'}</p>
          <Link
            to="/events"
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            <ChevronLeft className="w-5 h-5" />
            Browse Events
          </Link>
        </div>
      </div>
    );
  }

  // Registration closed
  if (isEventPast || isRegistrationClosed || !isRegistrationOpen) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {isEventPast ? 'Event Has Ended' : isRegistrationClosed ? 'Registration Closed' : 'Registration Not Open Yet'}
          </h2>
          <p className="text-gray-600 mb-6">
            {!isRegistrationOpen && event.registrationOpenDate
              ? `Registration opens ${formatDate(event.registrationOpenDate)}`
              : 'Registration is no longer available for this event.'}
          </p>
          <Link
            to={`/events/${eventId}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            View Event Details
          </Link>
        </div>
      </div>
    );
  }

  // Not authenticated - show login prompt
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <Link to={`/events/${eventId}`} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ChevronLeft className="w-5 h-5" />
              Back to Event
            </Link>
          </div>
        </div>

        {/* Login Prompt */}
        <div className="max-w-md mx-auto px-4 py-12">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-8 h-8 text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In Required</h2>
            <p className="text-gray-600 mb-6">
              Please sign in or create an account to register for <span className="font-semibold">{event.name}</span>
            </p>

            <div className="space-y-3">
              <Link
                to="/login"
                state={{ from: { pathname: `/event/${eventId}/register` } }}
                className="block w-full px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors text-center"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                state={{ from: { pathname: `/event/${eventId}/register` } }}
                className="block w-full px-6 py-3 border-2 border-orange-600 text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors text-center"
              >
                Create Account
              </Link>
            </div>

            {/* Event Preview */}
            <div className="mt-8 pt-6 border-t text-left">
              <h3 className="font-semibold text-gray-900 mb-3">{event.name}</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {formatDate(event.startDate)}
                </div>
                {event.venueName && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {event.venueName}
                  </div>
                )}
                {event.divisions?.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {event.divisions.length} division{event.divisions.length !== 1 ? 's' : ''} available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main registration flow
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to={`/events/${eventId}`} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back to Event</span>
            </Link>
            <h1 className="font-semibold text-gray-900 truncate max-w-[200px] sm:max-w-none">
              {event.name}
            </h1>
            <div className="w-20"></div>
          </div>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <nav aria-label="Progress">
            <ol className="flex items-center justify-between">
              {STEPS.map((step, index) => {
                const isCompleted = currentStep > step.id;
                const isCurrent = currentStep === step.id;
                // Skip team formation step for singles
                const teamSize = selectedDivision ? getTeamSize(selectedDivision) : 1;
                const isTeamSkipped = step.id === 2 && teamSize === 1;
                // Skip waiver step if no waivers (we'll know after registration)
                const isWaiverSkipped = step.id === 4 && waivers.length === 0 && !registrationResult;
                // Skip payment step if no fee
                const hasFee = selectedDivision ? (hasFeeOptions(selectedDivision) || selectedDivision.divisionFee > 0 || event?.perDivisionFee > 0 || event?.registrationFee > 0) : (event?.perDivisionFee > 0 || event?.registrationFee > 0);
                const isPaymentSkipped = step.id === 5 && !hasFee;

                if (isTeamSkipped || isWaiverSkipped || isPaymentSkipped) return null;

                return (
                  <li key={step.id} className="flex-1 relative">
                    <div className="flex flex-col items-center">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                        ${isCompleted ? 'bg-orange-600 text-white' : ''}
                        ${isCurrent ? 'bg-orange-600 text-white ring-4 ring-orange-100' : ''}
                        ${!isCompleted && !isCurrent ? 'bg-gray-200 text-gray-500' : ''}
                      `}>
                        {isCompleted ? <Check className="w-5 h-5" /> : step.id}
                      </div>
                      <div className="mt-2 text-center">
                        <p className={`text-sm font-medium ${isCurrent ? 'text-orange-600' : 'text-gray-500'}`}>
                          {step.name}
                        </p>
                        <p className="text-xs text-gray-400 hidden sm:block">{step.description}</p>
                      </div>
                    </div>
                    {/* Connector line */}
                    {index < STEPS.length - 1 && !isTeamSkipped && !isWaiverSkipped && !isPaymentSkipped && (
                      <div className={`
                        absolute top-5 left-1/2 w-full h-0.5
                        ${isCompleted ? 'bg-orange-600' : 'bg-gray-200'}
                      `} style={{ transform: 'translateX(50%)' }} />
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Step 1: Select Division */}
        {currentStep === 1 && (
          <div className="space-y-4">
            {/* Registration Type Selection */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Registration Type</h2>
              <p className="text-gray-600 mb-4">How would you like to participate?</p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setRegistrationType('Player')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    registrationType === 'Player'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-orange-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <User className={`w-8 h-8 ${registrationType === 'Player' ? 'text-orange-600' : 'text-gray-400'}`} />
                    <div>
                      <div className="font-semibold text-gray-900">Player</div>
                      <div className="text-sm text-gray-500">Compete in the tournament</div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setRegistrationType('Staff')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    registrationType === 'Staff'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-orange-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users className={`w-8 h-8 ${registrationType === 'Staff' ? 'text-orange-600' : 'text-gray-400'}`} />
                    <div>
                      <div className="font-semibold text-gray-900">Staff/Volunteer</div>
                      <div className="text-sm text-gray-500">Help run the event</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Staff Registration Form */}
            {registrationType === 'Staff' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Staff Registration</h2>
                <p className="text-gray-600 mb-6">Register as a volunteer or staff member. No waiver or fees required.</p>

                {!isAuthenticated ? (
                  <div className="text-center py-8">
                    <LogIn className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600 mb-4">Please log in to register as staff</p>
                    <Link
                      to={`/login?redirect=/events/${eventId}/register`}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                    >
                      Log In
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Role Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Preferred Role (Optional)
                      </label>
                      <select
                        value={selectedStaffRoleId || ''}
                        onChange={(e) => setSelectedStaffRoleId(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">No preference / General volunteer</option>
                        {staffRoles.map(role => (
                          <option key={role.id} value={role.id}>
                            {role.name} {role.description && `- ${role.description}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Contact Phone */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contact Phone (Optional)
                      </label>
                      <input
                        type="tel"
                        value={staffContactPhone}
                        onChange={(e) => setStaffContactPhone(e.target.value)}
                        placeholder="Your phone number"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notes / Availability (Optional)
                      </label>
                      <textarea
                        value={staffNotes}
                        onChange={(e) => setStaffNotes(e.target.value)}
                        placeholder="Let organizers know your availability or any special skills..."
                        rows={3}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                      <span className="text-blue-800">
                        Your registration will be pending until approved by an event organizer.
                      </span>
                    </div>

                    <button
                      onClick={handleStaffRegistration}
                      disabled={isSubmittingStaff}
                      className="w-full py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSubmittingStaff ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <UserPlus className="w-5 h-5" />
                      )}
                      Submit Staff Registration
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Player Registration: Division Selection */}
            {registrationType === 'Player' && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Select a Division</h2>
              <p className="text-gray-600 mb-6">Choose the division you want to register for.</p>

              {/* Profile Reminder */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm mb-6">
                <span className="text-blue-800">
                  Ensure your <Link to="/profile" className="font-medium text-blue-600 hover:underline">profile name and gender</Link> are correct before registering.
                </span>
              </div>

              {/* Divisions List */}
              <div className="space-y-3">
                {event.divisions?.map((division) => {
                  const isRegistered = userRegistrations.some(u => u.divisionId === division.id);
                  const teamSize = getTeamSize(division);
                  const isFull = division.maxUnits && division.registeredCount >= division.maxUnits;

                  return (
                    <button
                      key={division.id}
                      onClick={() => !isRegistered && !isFull && handleSelectDivision(division)}
                      disabled={isRegistered || isFull}
                      className={`
                        w-full p-4 rounded-lg border-2 text-left transition-all
                        ${isRegistered ? 'border-green-300 bg-green-50 cursor-not-allowed' : ''}
                        ${isFull && !isRegistered ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60' : ''}
                        ${!isRegistered && !isFull ? 'border-gray-200 hover:border-orange-300 hover:bg-orange-50 cursor-pointer' : ''}
                      `}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{division.name}</h3>
                            {isRegistered && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                                <Check className="w-3 h-3" /> Registered
                              </span>
                            )}
                            {isFull && !isRegistered && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                                Full
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 text-sm">
                            {division.teamUnitName && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                {division.teamUnitName}
                              </span>
                            )}
                            {division.skillLevelName && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                {division.skillLevelName}
                              </span>
                            )}
                            {division.ageGroupName && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                {division.ageGroupName}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-gray-600">
                            {division.registeredCount || 0}
                            {division.maxUnits && ` / ${division.maxUnits}`}
                          </p>
                          <p className="text-gray-400 text-xs">
                            {teamSize === 1 ? 'Singles' : teamSize === 2 ? 'Doubles' : `Teams of ${teamSize}`}
                          </p>
                          {hasFeeOptions(division) ? (
                            <p className="text-orange-600 font-medium mt-1">
                              ${Math.min(...division.fees.filter(f => f.isActive && f.isCurrentlyAvailable).map(f => f.amount))}
                              {division.fees.filter(f => f.isActive && f.isCurrentlyAvailable).length > 1 && '+'}
                            </p>
                          ) : (division.divisionFee || event.perDivisionFee) ? (
                            <p className="text-orange-600 font-medium mt-1">
                              ${division.divisionFee || event.perDivisionFee}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            )}
          </div>
        )}

        {/* Step 2: Team Formation */}
        {currentStep === 2 && selectedDivision && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Team Formation</h2>
                  <p className="text-gray-600">{selectedDivision.name}</p>
                </div>
                <button
                  onClick={() => {
                    setCurrentStep(1);
                    setSelectedDivision(null);
                    setSelectedFeeId(null);
                    setSelectedJoinMethod('Approval');
                  }}
                  className="text-sm text-orange-600 hover:text-orange-700"
                >
                  Change Division
                </button>
              </div>

              {/* Fee Selection */}
              {hasFeeOptions(selectedDivision) && (
                <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Select Registration Fee
                  </h3>
                  <div className="space-y-2">
                    {selectedDivision.fees
                      .filter(f => f.isActive && f.isCurrentlyAvailable)
                      .map(fee => (
                        <label
                          key={fee.id}
                          className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedFeeId === fee.id
                              ? 'border-orange-500 bg-orange-100'
                              : 'border-gray-200 bg-white hover:border-orange-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="fee"
                              value={fee.id}
                              checked={selectedFeeId === fee.id}
                              onChange={() => setSelectedFeeId(fee.id)}
                              className="text-orange-600"
                            />
                            <div>
                              <span className="font-medium text-gray-900">{fee.name}</span>
                              {fee.description && (
                                <p className="text-sm text-gray-500">{fee.description}</p>
                              )}
                            </div>
                          </div>
                          <span className="text-lg font-semibold text-orange-600">${fee.amount}</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}

              {/* Show join code if just registered */}
              {newJoinCode ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                  <h4 className="font-semibold text-green-800 mb-2">Registration Successful!</h4>
                  <p className="text-sm text-green-700 mb-4">
                    Share this code with your partner to join your team:
                  </p>
                  <div className="bg-white border-2 border-green-300 rounded-lg p-4 mb-4">
                    <span className="text-3xl font-mono font-bold tracking-widest text-green-700">
                      {newJoinCode}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(newJoinCode);
                      toast.success('Code copied to clipboard!');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Code
                  </button>
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="block w-full mt-4 px-4 py-2 border border-green-300 text-green-700 rounded-lg font-medium hover:bg-green-50"
                  >
                    Continue
                  </button>
                </div>
              ) : (
                <>
                  {/* Create New Team Option */}
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      {getTeamSize(selectedDivision) === 2 ? 'Register & Find Partner' : 'Create New Team'}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      {getTeamSize(selectedDivision) === 2
                        ? 'Register now and find or invite a partner later.'
                        : 'Register as team captain and find players later.'}
                    </p>

                    {/* Join Method Selection */}
                    <div className="space-y-2 mb-4">
                      <p className="text-sm font-medium text-gray-700">How will your partner join?</p>
                      <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="joinMethod"
                          value="Approval"
                          checked={selectedJoinMethod === 'Approval'}
                          onChange={() => setSelectedJoinMethod('Approval')}
                          className="w-4 h-4 text-orange-600"
                        />
                        <div>
                          <div className="font-medium text-gray-900">I will approve join requests</div>
                          <div className="text-sm text-gray-500">Others can find you and request to join</div>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="joinMethod"
                          value="Code"
                          checked={selectedJoinMethod === 'Code'}
                          onChange={() => setSelectedJoinMethod('Code')}
                          className="w-4 h-4 text-orange-600"
                        />
                        <div>
                          <div className="font-medium text-gray-900">I will send my partner a join code</div>
                          <div className="text-sm text-gray-500">Get a code to share directly</div>
                        </div>
                      </label>
                    </div>

                    <button
                      onClick={() => handleRegister(-1)}
                      disabled={registering}
                      className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {registering ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Registering...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Register & Find Partner Later
                        </>
                      )}
                    </button>
                  </div>

                  <div className="border-t pt-6">
                    {/* Join by Code */}
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <UserPlus className="w-4 h-4" />
                      Join an Existing Team
                    </h3>

                    <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-sm font-medium text-purple-800 mb-2">Have a join code?</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={joinCodeInput}
                          onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                          placeholder="Enter 6-digit code"
                          maxLength={6}
                          className="flex-1 px-3 py-2 border border-purple-300 rounded-lg font-mono text-center text-lg tracking-widest"
                        />
                        <button
                          onClick={handleJoinByCode}
                          disabled={joiningByCode || joinCodeInput.length < 6}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
                        >
                          {joiningByCode ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join'}
                        </button>
                      </div>
                    </div>

                    {/* Units Looking for Partners */}
                    <p className="text-sm text-gray-600 mb-3">Or browse players looking for partners:</p>
                    {loadingUnits ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
                      </div>
                    ) : unitsLookingForPartners.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No one is currently looking for a partner in this division.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {unitsLookingForPartners.map(unit => (
                          <div key={unit.id} className="border rounded-lg p-3 hover:border-orange-300">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {unit.captainProfileImageUrl ? (
                                  <img
                                    src={getSharedAssetUrl(unit.captainProfileImageUrl)}
                                    alt=""
                                    className="w-10 h-10 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-medium">
                                    {unit.captainName?.charAt(0) || '?'}
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium text-gray-900">{unit.captainName}</p>
                                  {unit.captainCity && (
                                    <p className="text-sm text-gray-500">{unit.captainCity}</p>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleRequestToJoin(unit.id)}
                                disabled={requestingToJoin === unit.id}
                                className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200 disabled:opacity-50"
                              >
                                {requestingToJoin === unit.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  'Request to Join'
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-6">
              {registrationResult ? (
                // Success state
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">You're Registered!</h2>
                  <p className="text-gray-600 mb-6">
                    You have successfully registered for {selectedDivision?.name || 'this division'}.
                  </p>

                  {newJoinCode && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                      <p className="text-sm text-green-700 mb-2">Share this code with your partner:</p>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-2xl font-mono font-bold text-green-700">{newJoinCode}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(newJoinCode);
                            toast.success('Copied!');
                          }}
                          className="p-2 hover:bg-green-100 rounded"
                        >
                          <Copy className="w-4 h-4 text-green-600" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Payment Info */}
                  {(event.registrationFee > 0 || event.perDivisionFee > 0) && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 text-left">
                      <div className="flex items-center gap-2 text-orange-800 font-medium mb-2">
                        <DollarSign className="w-5 h-5" />
                        Payment Required
                      </div>
                      <p className="text-sm text-orange-700 mb-2">
                        Please complete payment to confirm your registration.
                      </p>
                      {event.paymentInstructions && (
                        <p className="text-sm text-orange-600">{event.paymentInstructions}</p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                      to={`/events/${eventId}`}
                      className="px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700"
                    >
                      View Event
                    </Link>
                    <Link
                      to="/member/dashboard"
                      className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                    >
                      Go to Dashboard
                    </Link>
                  </div>
                </div>
              ) : (
                // Confirmation for singles (direct registration)
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Confirm Registration</h2>

                  {/* Fee Selection for singles */}
                  {hasFeeOptions(selectedDivision) && (
                    <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Select Registration Fee
                      </h3>
                      <div className="space-y-2">
                        {selectedDivision.fees
                          .filter(f => f.isActive && f.isCurrentlyAvailable)
                          .map(fee => (
                            <label
                              key={fee.id}
                              className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                                selectedFeeId === fee.id
                                  ? 'border-orange-500 bg-orange-100'
                                  : 'border-gray-200 bg-white hover:border-orange-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="radio"
                                  name="fee"
                                  value={fee.id}
                                  checked={selectedFeeId === fee.id}
                                  onChange={() => setSelectedFeeId(fee.id)}
                                  className="text-orange-600"
                                />
                                <div>
                                  <span className="font-medium text-gray-900">{fee.name}</span>
                                  {fee.description && (
                                    <p className="text-sm text-gray-500">{fee.description}</p>
                                  )}
                                </div>
                              </div>
                              <span className="text-lg font-semibold text-orange-600">${fee.amount}</span>
                            </label>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h3 className="font-medium text-gray-900 mb-3">Registration Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Event</span>
                        <span className="font-medium">{event.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Division</span>
                        <span className="font-medium">{selectedDivision?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Player</span>
                        <span className="font-medium">{user?.firstName} {user?.lastName}</span>
                      </div>
                      {getEffectiveFeeAmount() > 0 && (
                        <div className="flex justify-between pt-2 border-t">
                          <span className="text-gray-600">
                            {getSelectedFee() ? getSelectedFee().name : 'Fee'}
                          </span>
                          <span className="font-medium text-orange-600">
                            ${getEffectiveFeeAmount()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setCurrentStep(1);
                        setSelectedDivision(null);
                        setSelectedFeeId(null);
                      }}
                      className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => handleRegister()}
                      disabled={registering}
                      className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {registering ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Registering...
                        </>
                      ) : (
                        'Confirm Registration'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Waiver */}
        {currentStep === 4 && registrationResult && waivers.length > 0 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-6">
              {/* Success message */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-center">
                <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-semibold text-green-800">Registration Successful!</h3>
                <p className="text-sm text-green-700 mt-1">
                  Please sign the required waiver{waivers.length > 1 ? 's' : ''} to complete your registration.
                </p>
                {newJoinCode && (
                  <div className="mt-3 p-3 bg-white border border-green-300 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Share this code with your partner:</p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-2xl font-mono font-bold text-green-700">{newJoinCode}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(newJoinCode);
                          toast.success('Copied!');
                        }}
                        className="p-1 hover:bg-green-100 rounded"
                      >
                        <Copy className="w-4 h-4 text-green-600" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Waiver header */}
              <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <ScrollText className="w-5 h-5" />
                Sign Waiver {waivers.length > 1 && `(${currentWaiverIndex + 1} of ${waivers.length})`}
              </h2>

              {loadingWaivers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                </div>
              ) : currentWaiver ? (
                <>
                  {/* Waiver title */}
                  <h3 className="font-medium text-gray-800 mb-4">{currentWaiver.title}</h3>

                  {/* Waiver content - scrollable */}
                  <div className="relative mb-4">
                    <div
                      ref={waiverContentRef}
                      onScroll={handleWaiverScroll}
                      className="max-h-80 overflow-y-auto p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm prose prose-sm max-w-none"
                    >
                      {currentWaiver.content ? (
                        renderWaiverContent(currentWaiver.content)
                      ) : currentWaiver.fileUrl ? (
                        <div className="text-center py-4">
                          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <a
                            href={currentWaiver.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            View Waiver Document
                          </a>
                          <p className="text-xs text-gray-500 mt-2">
                            Please read the full document before signing below.
                          </p>
                          <button
                            onClick={() => setHasScrolledToEnd(true)}
                            className="mt-4 text-sm text-orange-600 hover:underline"
                          >
                            I have read the waiver document
                          </button>
                        </div>
                      ) : (
                        <p className="text-gray-500">No waiver content available.</p>
                      )}
                    </div>

                    {/* Scroll indicator */}
                    {!hasScrolledToEnd && currentWaiver.content && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-100 to-transparent h-16 flex items-end justify-center pb-2 pointer-events-none">
                        <div className="flex items-center gap-1 text-sm text-orange-600 bg-white px-3 py-1 rounded-full shadow">
                          <ChevronDown className="w-4 h-4 animate-bounce" />
                          Scroll to read entire waiver
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Signing block - only visible after scrolling to end */}
                  {hasScrolledToEnd ? (
                    <div className="border-t pt-6 space-y-4">
                      {/* Signer Role Selection */}
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Who is signing this waiver?
                        </label>
                        <div className="flex flex-wrap gap-2">
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
                            <span className="font-medium text-sm">Self (Participant)</span>
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
                            <span className="font-medium text-sm">Parent</span>
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
                            <span className="font-medium text-sm">Legal Guardian</span>
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
                              By signing as {signerRole.toLowerCase()}, you confirm you have legal authority to sign on behalf of {playerFullName || 'the participant'}.
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

                      {/* Drawn Signature */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {isGuardianSigning ? `Draw ${signerRole.toLowerCase()}'s signature` : 'Draw your signature'} *
                        </label>
                        <SignatureCanvas
                          onSignatureChange={setSignatureImage}
                          className="border border-gray-300 rounded-lg"
                          width={Math.min(350, window.innerWidth - 80)}
                          height={150}
                        />
                      </div>

                      {/* Agreement Checkbox */}
                      <label className="flex items-start gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <input
                          type="checkbox"
                          checked={agreedToWaiver}
                          onChange={(e) => setAgreedToWaiver(e.target.checked)}
                          className="mt-1 w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        />
                        <span className="text-sm text-gray-700">
                          {isGuardianSigning ? (
                            <>I, as the {signerRole.toLowerCase()} of {playerFullName || 'the participant'}, have read and agree to the terms of this waiver.
                            I confirm I have legal authority to sign on behalf of the participant and understand that by signing this document,
                            I am waiving certain legal rights on their behalf.</>
                          ) : (
                            <>I have read and agree to the terms of this waiver. I understand that by signing this document,
                            I am waiving certain legal rights.</>
                          )}
                        </span>
                      </label>

                      {/* Submit Button */}
                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={handleSignWaiver}
                          disabled={!signatureImage || !agreedToWaiver || isSigningWaiver || (isGuardianSigning && !guardianName.trim())}
                          className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                          {isSigningWaiver ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Signing...
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              {currentWaiverIndex < waivers.length - 1 ? 'Sign & Continue' : 'Sign Waiver'}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <p className="text-sm">Please scroll through and read the entire waiver before signing.</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500 text-center py-8">No waiver found.</p>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Payment */}
        {currentStep === 5 && registrationResult && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-6">
              {/* Success message */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-center">
                <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-semibold text-green-800">Registration Successful!</h3>
                <p className="text-sm text-green-700 mt-1">
                  You're registered for {selectedDivision?.name}
                </p>
                {newJoinCode && (
                  <div className="mt-3 p-3 bg-white border border-green-300 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Share this code with your partner:</p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-2xl font-mono font-bold text-green-700">{newJoinCode}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(newJoinCode);
                          toast.success('Copied!');
                        }}
                        className="p-1 hover:bg-green-100 rounded"
                      >
                        <Copy className="w-4 h-4 text-green-600" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Complete Payment
              </h2>

              {/* Payment info */}
              {event.paymentInstructions && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-800">{event.paymentInstructions}</p>
                </div>
              )}

              {/* Reference ID */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-800">Your Payment Reference ID</p>
                    <p className="text-xs text-blue-600 mt-1">Include this in your payment memo/note</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-white px-3 py-2 rounded border border-blue-300 font-mono text-blue-900">
                      E{event.id}-U{registrationResult?.unitId}-P{user?.id}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`E${event.id}-U${registrationResult?.unitId}-P${user?.id}`);
                        toast.success('Reference ID copied!');
                      }}
                      className="p-2 hover:bg-blue-100 rounded text-blue-600"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Payment Summary - Members to pay for */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-gray-900 mb-3">Select Members to Pay For</h3>
                <div className="space-y-2">
                  {/* Current user - always checked and disabled */}
                  <div className="flex items-center justify-between p-3 border border-orange-500 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={true}
                        disabled={true}
                        className="rounded text-orange-600 cursor-not-allowed"
                      />
                      <div>
                        <span className="font-medium text-gray-900">{user?.firstName} {user?.lastName}</span>
                        <span className="text-xs text-gray-500 ml-2">(You)</span>
                        {getSelectedFee() && (
                          <span className="text-xs text-gray-500 ml-1">- {getSelectedFee().name}</span>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-orange-600">${getEffectiveFeeAmount()}</span>
                  </div>

                  {/* Teammates - optional */}
                  {getUnpaidTeammates().length > 0 && (
                    <>
                      <p className="text-xs text-gray-500 mt-3 mb-2 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Check teammates below if you want to pay for them too
                      </p>
                      {getUnpaidTeammates().map(member => {
                        const memberFee = member.selectedFee?.amount || getEffectiveFeeAmount();
                        return (
                          <label
                            key={member.id}
                            className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedTeammateIds.includes(member.id)
                                ? 'border-orange-500 bg-orange-50'
                                : 'border-gray-200 hover:border-orange-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selectedTeammateIds.includes(member.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTeammateIds([...selectedTeammateIds, member.id]);
                                  } else {
                                    setSelectedTeammateIds(selectedTeammateIds.filter(id => id !== member.id));
                                  }
                                }}
                                className="rounded text-orange-600"
                              />
                              <div>
                                <span className="text-gray-900">{member.firstName} {member.lastName}</span>
                                {member.selectedFee && (
                                  <span className="text-xs text-gray-500 ml-1">- {member.selectedFee.name}</span>
                                )}
                              </div>
                            </div>
                            <span className={`font-medium ${selectedTeammateIds.includes(member.id) ? 'text-orange-600' : 'text-gray-500'}`}>
                              ${memberFee}
                            </span>
                          </label>
                        );
                      })}
                    </>
                  )}

                  {/* Total */}
                  <div className="flex justify-between pt-4 mt-4 border-t-2 border-gray-300">
                    <span className="font-bold text-gray-900">Total to Pay</span>
                    <span className="font-bold text-xl text-orange-600">${getPaymentTotal()}</span>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3"
                >
                  {PAYMENT_METHODS.map(method => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </div>

              {/* Payment Reference */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Reference / Confirmation Number
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g., Zelle confirmation number"
                  className="w-full border border-gray-300 rounded-lg p-3"
                />
              </div>

              {/* Payment Proof Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Proof (Screenshot/Receipt)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  {previewImage ? (
                    <div className="relative">
                      <img src={previewImage} alt="Payment proof" className="max-h-48 mx-auto rounded" />
                      <button
                        onClick={() => {
                          setPreviewImage(null);
                          setPaymentProofUrl('');
                        }}
                        className="absolute top-0 right-0 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : paymentProofUrl && isPdfUrl(paymentProofUrl) ? (
                    <div className="text-center">
                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">PDF uploaded</p>
                      <a
                        href={paymentProofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 text-sm hover:underline flex items-center justify-center gap-1 mt-1"
                      >
                        View PDF <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        onClick={() => setPaymentProofUrl('')}
                        className="text-red-600 text-sm mt-2 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center cursor-pointer">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={isUploading}
                      />
                      {isUploading ? (
                        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-gray-400 mb-2" />
                          <span className="text-sm text-gray-500">Click to upload image or PDF</span>
                        </>
                      )}
                    </label>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handlePayLater}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                >
                  Pay Later
                </button>
                <button
                  onClick={handleSubmitPayment}
                  disabled={isSubmittingPayment || !paymentMethod}
                  className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmittingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Submit Payment (${getPaymentTotal()})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
