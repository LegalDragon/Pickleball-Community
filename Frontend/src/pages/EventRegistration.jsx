import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Calendar, MapPin, Users, DollarSign, ChevronLeft, ChevronRight,
  UserPlus, User, Loader2, AlertCircle, Check, Plus, LogIn,
  Copy, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { eventsApi, tournamentApi, getSharedAssetUrl } from '../services/api';

const STEPS = [
  { id: 1, name: 'Select Division', description: 'Choose your division' },
  { id: 2, name: 'Team Formation', description: 'Set up your team' },
  { id: 3, name: 'Confirmation', description: 'Review & complete' }
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

        setCurrentStep(3);
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

  // Handle join by code
  const handleJoinByCode = async () => {
    if (!joinCodeInput.trim()) {
      toast.error('Please enter a join code');
      return;
    }
    setJoiningByCode(true);
    try {
      const response = await tournamentApi.joinByCode(joinCodeInput.trim());
      if (response.success) {
        setRegistrationResult(response.data);
        setCurrentStep(3);
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
                const isSkipped = step.id === 2 && teamSize === 1;

                if (isSkipped) return null;

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
                    {index < STEPS.length - 1 && !isSkipped && (
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
      </div>
    </div>
  );
}
