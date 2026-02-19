import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Users, Trophy, Calendar, Clock, MapPin, Play, Check, X,
  ChevronDown, ChevronUp, RefreshCw, Shuffle, Settings, Target,
  AlertCircle, Loader2, Plus, Edit2, DollarSign, Eye, Share2, LayoutGrid,
  Award, ArrowRight, Lock, Unlock, Save, Map, ExternalLink, FileText, User,
  CheckCircle, XCircle, MoreVertical, Upload, Send, Info, Radio, ClipboardList,
  Download, Lightbulb, Shield, Trash2, Building2, Layers, UserCheck, Grid3X3,
  Hammer, BookOpen, Phone, EyeOff, Edit3, Map as MapIcon, Mail, Image, Zap, Search
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useNotifications } from '../hooks/useNotifications';
import { tournamentApi, gameDayApi, eventsApi, objectAssetsApi, checkInApi, sharedAssetApi, getSharedAssetUrl, eventTypesApi, eventStaffApi, teamUnitsApi, skillLevelsApi, ageGroupsApi, objectAssetTypesApi, friendsApi } from '../services/api';
import ScheduleConfigModal, { PhaseFlowDiagram } from '../components/ScheduleConfigModal';
import GameSettingsModal from '../components/GameSettingsModal';
import DivisionFeesEditor from '../components/DivisionFeesEditor';
import MatchFormatEditor from '../components/MatchFormatEditor';
import PhaseManager from '../components/tournament/PhaseManager';
import ScheduleGridInline from '../components/tournament/ScheduleGridInline';
// DivisionSchedulingWizard removed - using individual modals
import PublicProfileModal from '../components/ui/PublicProfileModal';
import GameScoreModal from '../components/ui/GameScoreModal';
import VenuePicker from '../components/ui/VenuePicker';
import EventFeesEditor from '../components/EventFeesEditor';
import EventFeeTypesEditor from '../components/EventFeeTypesEditor';

export default function TournamentManage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();
  const { connect, disconnect, joinEvent, leaveEvent, addListener, isConnected } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);

  // Pool management state
  const [poolStandings, setPoolStandings] = useState(null);
  const [calculatingRankings, setCalculatingRankings] = useState(false);
  const [finalizingPools, setFinalizingPools] = useState(false);
  const [downloadingStandings, setDownloadingStandings] = useState(false);
  const [exportingRegistrations, setExportingRegistrations] = useState(false);
  const [editingRank, setEditingRank] = useState(null);
  const [showAdvancementPreview, setShowAdvancementPreview] = useState(false);
  const [standingsViewMode, setStandingsViewMode] = useState('grouped'); // 'grouped' or 'flat'
  const [standingsSortBy, setStandingsSortBy] = useState('pool'); // 'pool', 'rank', 'matchesWon', 'gameDiff', 'pointDiff'
  const [event, setEvent] = useState(null);
  const [activeTab, setActiveTab] = useState('eventinfo');
  const [mainTab, setMainTab] = useState('preplanning'); // 'preplanning' or 'gameday'
  const [selectedDivision, setSelectedDivision] = useState(null);
  const selectedDivisionRef = useRef(null); // Ref to track selectedDivision for SignalR listener
  const [error, setError] = useState(null);

  // Schedule generation state
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [assigningNumbers, setAssigningNumbers] = useState(false);

  // Schedule display state
  const [schedule, setSchedule] = useState(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [selectedGameForEdit, setSelectedGameForEdit] = useState(null); // Game object for score editing
  const [drawingResultsCollapsed, setDrawingResultsCollapsed] = useState(false); // Collapsible drawing results
  const [divisionUnits, setDivisionUnits] = useState([]); // Units for admin unit change

  // Modal states
  const [scheduleConfigModal, setScheduleConfigModal] = useState({ isOpen: false, division: null });
  const [gameSettingsModal, setGameSettingsModal] = useState({ isOpen: false, division: null });
  // Wizard removed - using individual modals instead
  const [scheduleDropdownOpen, setScheduleDropdownOpen] = useState(null); // Track which division's schedule dropdown is open

  // Add courts modal state
  const [showAddCourtsModal, setShowAddCourtsModal] = useState(false);
  const [numberOfCourts, setNumberOfCourts] = useState('');
  const [addingCourts, setAddingCourts] = useState(false);
  const [mapAsset, setMapAsset] = useState(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [suggestedGame, setSuggestedGame] = useState(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  // Edit court modal state
  const [editingCourt, setEditingCourt] = useState(null);
  const [editCourtForm, setEditCourtForm] = useState({ label: '', status: '' });
  const [savingCourt, setSavingCourt] = useState(false);

  // Status update state
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Check-in management state
  const [checkInData, setCheckInData] = useState(null);
  const [loadingCheckIns, setLoadingCheckIns] = useState(false);
  const [checkInFilter, setCheckInFilter] = useState('all'); // all, pending, checked-in
  const [checkInDivisionFilter, setCheckInDivisionFilter] = useState('all');
  const [processingAction, setProcessingAction] = useState(null); // { userId, action }
  const [actionMenuOpen, setActionMenuOpen] = useState(null); // userId
  const [profileModalUserId, setProfileModalUserId] = useState(null);
  const [expandedPlayer, setExpandedPlayer] = useState(null); // userId for expanded details view
  const [editingPayment, setEditingPayment] = useState(null); // { player, form }
  const [savingPayment, setSavingPayment] = useState(false);
  const [uploadingPaymentProof, setUploadingPaymentProof] = useState(false);
  const [sendingWaiverRequest, setSendingWaiverRequest] = useState(null); // userId

  // Event Info editing state
  const [eventTypes, setEventTypes] = useState([]);
  const [editForm, setEditForm] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Staff management state
  const [staffList, setStaffList] = useState([]);
  const [staffRoles, setStaffRoles] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [addStaffForm, setAddStaffForm] = useState({ email: '', roleId: '', userId: null });
  const [addingStaff, setAddingStaff] = useState(false);
  const [pendingStaff, setPendingStaff] = useState([]);
  const [staffModalTab, setStaffModalTab] = useState('friends'); // 'friends' or 'email'
  const [friendsList, setFriendsList] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null); // Staff member being edited
  const [editStaffForm, setEditStaffForm] = useState({ roleId: '' });
  const [savingStaffEdit, setSavingStaffEdit] = useState(false);

  // Court groups state
  const [courtGroups, setCourtGroups] = useState([]);
  const [loadingCourtGroups, setLoadingCourtGroups] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [deletingGroupId, setDeletingGroupId] = useState(null);

  // Unit management state
  const [unitsData, setUnitsData] = useState(null); // All units grouped by division
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [registrationDivisionFilter, setRegistrationDivisionFilter] = useState('all'); // Filter for Registration Management
  const [registrationFeeTypeFilter, setRegistrationFeeTypeFilter] = useState('all'); // Fee type filter
  const [eventFeeTypes, setEventFeeTypes] = useState([]); // Fee types for the event
  const [selectedUnitsForMerge, setSelectedUnitsForMerge] = useState([]);
  const [processingUnitAction, setProcessingUnitAction] = useState(null); // { unitId, action }
  const [expandedUnit, setExpandedUnit] = useState(null); // unitId for expanded view
  const [movingUnitToDivision, setMovingUnitToDivision] = useState(null); // { unit, targetDivisionId }

  // Join requests state (TD/organizer view)
  const [joinRequests, setJoinRequests] = useState([]);
  const [loadingJoinRequests, setLoadingJoinRequests] = useState(false);
  const [respondingToRequest, setRespondingToRequest] = useState(null); // requestId being processed

  // Registration validation state
  const [validationResults, setValidationResults] = useState(null);
  const [loadingValidation, setLoadingValidation] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Payment management state
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [expandedPayment, setExpandedPayment] = useState(null);
  const [verifyingPayment, setVerifyingPayment] = useState(null);
  const [viewingProofUrl, setViewingProofUrl] = useState(null); // URL to display in modal
  const [uploadingProofForPayment, setUploadingProofForPayment] = useState(null);
  const proofFileInputRef = useRef(null);
  const [applyingPayment, setApplyingPayment] = useState(null); // paymentId being applied
  const [applicableRegistrations, setApplicableRegistrations] = useState(null); // registrations for apply modal
  const [showAllPlayers, setShowAllPlayers] = useState(false); // toggle to show all players in apply modal
  const [applyPlayerSearch, setApplyPlayerSearch] = useState(''); // search filter for apply modal
  const [selectedRegistrations, setSelectedRegistrations] = useState([]); // selected member IDs to apply to
  const [registrationsToUnapply, setRegistrationsToUnapply] = useState([]); // member IDs to remove payment from

  // Payment filter state
  const [paymentSearchName, setPaymentSearchName] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [paymentDivisionFilter, setPaymentDivisionFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [paymentSortBy, setPaymentSortBy] = useState('date'); // 'date', 'name', 'amount', 'status'
  const [paymentSortDir, setPaymentSortDir] = useState('desc'); // 'asc', 'desc'
  const [exportingPayments, setExportingPayments] = useState(false);

  // Division editing state
  const [editingDivision, setEditingDivision] = useState(null);
  const [showEditDivision, setShowEditDivision] = useState(false);
  const [savingDivision, setSavingDivision] = useState(false);
  const [teamUnits, setTeamUnits] = useState([]);
  const [skillLevels, setSkillLevels] = useState([]);
  const [ageGroups, setAgeGroups] = useState([]);

  // Documents management state
  const [documents, setDocuments] = useState([]);
  const [assetTypes, setAssetTypes] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [newDocument, setNewDocument] = useState({ title: '', isPublic: true, sortOrder: 0, objectAssetTypeId: null });
  const [editingDocument, setEditingDocument] = useState(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState(null);

  // Add Player registration state
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [playerSearchResults, setPlayerSearchResults] = useState([]);
  const [searchingPlayers, setSearchingPlayers] = useState(false);
  const [selectedPlayerForReg, setSelectedPlayerForReg] = useState(null);
  const [selectedDivisionForReg, setSelectedDivisionForReg] = useState('');
  const [registeringPlayer, setRegisteringPlayer] = useState(false);

  // Payment methods for dropdown
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

  // Court/Time Planning state
  const [planningData, setPlanningData] = useState(null); // Full planning data from API
  const [loadingPlanningData, setLoadingPlanningData] = useState(false);
  const [planningDivisionId, setPlanningDivisionId] = useState(''); // Selected division for planning
  const [planningPoolId, setPlanningPoolId] = useState('all'); // Selected pool/phase
  const [planningConfig, setPlanningConfig] = useState({
    gameDurationMinutes: 15,
    waitTimeMinutes: 5,
    courtCount: 4,
  });
  const [selectedEncountersForPlanning, setSelectedEncountersForPlanning] = useState([]); // Encounter IDs to plan
  const [planningCourtSelection, setPlanningCourtSelection] = useState('group'); // 'group' or 'individual'
  const [selectedCourtGroupForPlanning, setSelectedCourtGroupForPlanning] = useState('');
  const [selectedCourtsForPlanning, setSelectedCourtsForPlanning] = useState([]); // Individual court IDs
  const [planningStartTime, setPlanningStartTime] = useState('');
  const [generatedSchedule, setGeneratedSchedule] = useState([]); // Generated time slots
  const [courtTimeAllocations, setCourtTimeAllocations] = useState([]); // All saved allocations for timeline
  const [savingPlan, setSavingPlan] = useState(false);
  const [planningErrors, setPlanningErrors] = useState([]);

  // Backend scheduling integration state
  const [planningDivisionPhases, setPlanningDivisionPhases] = useState([]); // Phases for selected division
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [showPhaseManager, setShowPhaseManager] = useState(false);
  const [generatingPhaseEncounters, setGeneratingPhaseEncounters] = useState(null); // phaseId being generated
  const [backendScheduling, setBackendScheduling] = useState(false); // scheduling in progress
  const [schedulingResults, setSchedulingResults] = useState(null); // results from last generate
  const [validationData, setValidationData] = useState(null); // validation results
  const [loadingScheduleValidation, setLoadingScheduleValidation] = useState(false);
  const [scheduleGrid, setScheduleGrid] = useState(null); // grid data from schedulingGetGrid
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [clearingSchedule, setClearingSchedule] = useState(false);
  const [selectedPlanningPhaseId, setSelectedPlanningPhaseId] = useState(''); // Phase filter for scheduling
  const [courtAssignmentMode, setCourtAssignmentMode] = useState(false); // toggle court assignment UI
  const [selectedCourtGroupsForAssignment, setSelectedCourtGroupsForAssignment] = useState([]);
  const [assigningCourts, setAssigningCourts] = useState(false);
  
  // Phase diagram state for each division
  const [expandedPhaseDiagrams, setExpandedPhaseDiagrams] = useState(new Set()); // Set of division IDs with expanded diagrams
  const [divisionPhaseData, setDivisionPhaseData] = useState({}); // { divisionId: { phases, structureJson } }
  const [courtAssignmentTimeFrom, setCourtAssignmentTimeFrom] = useState('');
  const [courtAssignmentTimeTo, setCourtAssignmentTimeTo] = useState('');
  const [schedulingStartTime, setSchedulingStartTime] = useState('');
  const [schedulingClearExisting, setSchedulingClearExisting] = useState(true);
  const [schedulingRespectOverlap, setSchedulingRespectOverlap] = useState(true);
  const [advancementPhaseId, setAdvancementPhaseId] = useState(null); // phase for advancement config
  const [generatingAdvancement, setGeneratingAdvancement] = useState(false);
  const [autoScheduling, setAutoScheduling] = useState(false); // one-click auto-schedule in progress

  useEffect(() => {
    if (eventId) {
      loadDashboard();
      loadEvent();
      loadEventFeeTypes();
    }
  }, [eventId]);

  // Load reference data for division editing
  useEffect(() => {
    const loadTeamUnits = async () => {
      try {
        const response = await teamUnitsApi.getAll();
        if (response.success) {
          setTeamUnits(response.data || []);
        }
      } catch (err) {
        console.error('Error loading team units:', err);
      }
    };
    const loadSkillLevels = async () => {
      try {
        const response = await skillLevelsApi.getAll();
        if (response.success) {
          setSkillLevels(response.data || []);
        }
      } catch (err) {
        console.error('Error loading skill levels:', err);
      }
    };
    const loadAgeGroups = async () => {
      try {
        const response = await ageGroupsApi.getAll();
        if (response.success) {
          setAgeGroups(response.data || []);
        }
      } catch (err) {
        console.error('Error loading age groups:', err);
      }
    };
    loadTeamUnits();
    loadSkillLevels();
    loadAgeGroups();
  }, []);

  // Keep ref in sync with selectedDivision for SignalR listener
  useEffect(() => {
    selectedDivisionRef.current = selectedDivision;
  }, [selectedDivision]);

  // SignalR connection for real-time updates
  useEffect(() => {
    if (!eventId || !isAuthenticated) return;

    const setupSignalR = async () => {
      await connect();
      await joinEvent(parseInt(eventId));
    };

    setupSignalR();

    // Listen for game/score updates and refresh dashboard
    const removeListener = addListener((notification) => {
      if (notification.Type === 'ScoreUpdate' || notification.Type === 'GameUpdate') {
        console.log('Admin dashboard: Received game update, refreshing...', notification);
        // Show toast to admin
        toast.info(notification.Message || 'Score updated - refreshing...');
        loadDashboard();
        // Use ref to get current selectedDivision value (avoids stale closure)
        const currentDivision = selectedDivisionRef.current;
        if (currentDivision?.scheduleReady) {
          loadSchedule(currentDivision.id, true); // silent refresh
        }
      }
    });

    return () => {
      removeListener();
      leaveEvent(parseInt(eventId));
    };
  }, [eventId, isAuthenticated, connect, joinEvent, leaveEvent, addListener]);

  // Auto-refresh every 30 seconds as fallback for SignalR (silent - no loading spinners)
  useEffect(() => {
    if (!eventId) return;

    const refreshInterval = setInterval(() => {
      console.log('Auto-refresh: updating dashboard and schedule...');
      loadDashboard(true); // silent refresh
      const currentDivision = selectedDivisionRef.current;
      if (currentDivision?.scheduleReady) {
        loadSchedule(currentDivision.id, true); // silent refresh
      }
    }, 30000); // 30 seconds

    return () => clearInterval(refreshInterval);
  }, [eventId]);

  useEffect(() => {
    if (selectedDivision?.scheduleReady) {
      loadSchedule(selectedDivision.id);
    } else {
      setSchedule(null);
    }
  }, [selectedDivision]);

  const loadDashboard = async (silent = false) => {
    try {
      const response = await tournamentApi.getDashboard(eventId);
      if (response.success) {
        setDashboard(response.data);
        // Only auto-select division on initial load, not on silent refresh
        if (!silent && !selectedDivision && response.data.divisions?.length > 0) {
          // Select first division with registrations, or first division if none have registrations
          const divisionsWithRegs = response.data.divisions.filter(d => d.registeredUnits > 0);
          setSelectedDivision(divisionsWithRegs.length > 0 ? divisionsWithRegs[0] : response.data.divisions[0]);
        }
      } else if (!silent) {
        setError(response.message || 'Failed to load tournament dashboard');
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
      if (!silent) {
        setError('Failed to load tournament dashboard');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const loadEvent = async () => {
    try {
      const [eventRes, typesRes, assetsRes] = await Promise.all([
        eventsApi.getEvent(eventId),
        eventTypesApi.list(),
        objectAssetsApi.getAssets('Event', eventId)
      ]);

      if (eventRes.success) {
        setEvent(eventRes.data);
        populateEventForm(eventRes.data);
      }

      if (typesRes.success) {
        setEventTypes(typesRes.data || []);
      }

      if (assetsRes.success && assetsRes.data) {
        const map = assetsRes.data.find(a => a.assetTypeName?.toLowerCase() === 'map');
        setMapAsset(map || null);
      }
    } catch (err) {
      console.error('Error loading event:', err);
    }
  };

  // Helper to extract date and time from ISO date string
  const extractDateTime = (isoString) => {
    if (!isoString) return { date: '', time: '' };
    try {
      const dt = new Date(isoString);
      const date = dt.toISOString().split('T')[0];
      const time = dt.toTimeString().slice(0, 5);
      return { date, time };
    } catch {
      return { date: '', time: '' };
    }
  };

  const populateEventForm = (eventData) => {
    const regOpen = extractDateTime(eventData.registrationOpenDate);
    const regClose = extractDateTime(eventData.registrationCloseDate);
    const startDate = extractDateTime(eventData.startDate);
    const endDate = extractDateTime(eventData.endDate);

    setEditForm({
      name: eventData.name || '',
      description: eventData.description || '',
      eventTypeId: eventData.eventTypeId || '',
      isPublished: eventData.isPublished || false,
      isPrivate: eventData.isPrivate || false,
      venueId: eventData.venueId || '',
      venueName: eventData.venueName || '',
      address: eventData.address || '',
      city: eventData.city || '',
      state: eventData.state || '',
      country: eventData.country || '',
      registrationFee: eventData.registrationFee || 0,
      perDivisionFee: eventData.perDivisionFee || 0,
      registrationOpenDate: regOpen.date,
      registrationOpenTime: regOpen.time || '00:00',
      registrationCloseDate: regClose.date,
      registrationCloseTime: regClose.time || '23:59',
      startDate: startDate.date,
      startTime: startDate.time || '08:00',
      endDate: endDate.date,
      endTime: endDate.time || '18:00',
      // Logo & Banner with focus points
      posterImageUrl: eventData.posterImageUrl || '',
      posterFocusX: eventData.posterFocusX ?? 50,
      posterFocusY: eventData.posterFocusY ?? 50,
      bannerImageUrl: eventData.bannerImageUrl || '',
      bannerFocusX: eventData.bannerFocusX ?? 50,
      bannerFocusY: eventData.bannerFocusY ?? 50,
      // Contact Info
      contactName: eventData.contactName || '',
      contactEmail: eventData.contactEmail || '',
      contactPhone: eventData.contactPhone || '',
      paymentInstructions: eventData.paymentInstructions || '',
    });
    setHasUnsavedChanges(false);
  };

  const handleFormChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSaveEvent = async () => {
    setSavingEvent(true);
    try {
      const registrationOpenDate = editForm.registrationOpenDate
        ? `${editForm.registrationOpenDate}T${editForm.registrationOpenTime || '00:00'}:00`
        : null;
      const registrationCloseDate = editForm.registrationCloseDate
        ? `${editForm.registrationCloseDate}T${editForm.registrationCloseTime || '23:59'}:00`
        : null;
      const startDate = editForm.startDate
        ? `${editForm.startDate}T${editForm.startTime || '08:00'}:00`
        : event.startDate;
      const endDate = editForm.endDate
        ? `${editForm.endDate}T${editForm.endTime || '18:00'}:00`
        : event.endDate;

      const updateData = {
        name: editForm.name,
        description: editForm.description,
        eventTypeId: editForm.eventTypeId ? parseInt(editForm.eventTypeId) : event.eventTypeId,
        startDate,
        endDate,
        registrationOpenDate,
        registrationCloseDate,
        isPublished: editForm.isPublished,
        isPrivate: editForm.isPrivate,
        allowMultipleDivisions: event.allowMultipleDivisions ?? true,
        venueId: editForm.venueId ? parseInt(editForm.venueId) : null,
        venueName: editForm.venueName || null,
        address: editForm.address || null,
        city: editForm.city || null,
        state: editForm.state || null,
        country: editForm.country || null,
        registrationFee: editForm.registrationFee ? parseFloat(editForm.registrationFee) : 0,
        perDivisionFee: editForm.perDivisionFee ? parseFloat(editForm.perDivisionFee) : 0,
        // Logo & Banner with focus points
        posterImageUrl: editForm.posterImageUrl || null,
        posterFocusX: editForm.posterFocusX ?? 50,
        posterFocusY: editForm.posterFocusY ?? 50,
        bannerImageUrl: editForm.bannerImageUrl || null,
        bannerFocusX: editForm.bannerFocusX ?? 50,
        bannerFocusY: editForm.bannerFocusY ?? 50,
        // Contact Info
        contactName: editForm.contactName || null,
        contactEmail: editForm.contactEmail || null,
        contactPhone: editForm.contactPhone || null,
        paymentInstructions: editForm.paymentInstructions || null,
      };

      const response = await eventsApi.update(eventId, updateData);
      if (!response.success) {
        toast.error(response.message || 'Failed to save event');
        return;
      }

      toast.success('Event saved successfully');
      setHasUnsavedChanges(false);
      loadEvent();
    } catch (err) {
      console.error('Error saving event:', err);
      toast.error('Failed to save event');
    } finally {
      setSavingEvent(false);
    }
  };

  // Staff management functions
  const loadStaff = async () => {
    setLoadingStaff(true);
    try {
      const [staffRes, rolesRes, pendingRes] = await Promise.all([
        eventStaffApi.getEventStaff(eventId),
        eventStaffApi.getEventRoles(eventId),
        eventStaffApi.getPendingStaff(eventId).catch(() => ({ success: false }))
      ]);

      if (staffRes.success) {
        setStaffList(staffRes.data || []);
      }
      if (rolesRes.success) {
        setStaffRoles(rolesRes.data || []);
      }
      if (pendingRes.success) {
        setPendingStaff(pendingRes.data || []);
      }
    } catch (err) {
      console.error('Error loading staff:', err);
      toast.error('Failed to load staff');
    } finally {
      setLoadingStaff(false);
    }
  };

  // Load friends for staff modal
  const loadFriendsForStaff = async () => {
    setLoadingFriends(true);
    try {
      const response = await friendsApi.getFriends();
      const data = response.data?.data ?? response.data ?? [];
      setFriendsList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading friends:', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  // Open add staff modal and load friends
  const openAddStaffModal = () => {
    setShowAddStaffModal(true);
    setStaffModalTab('friends');
    setAddStaffForm({ email: '', roleId: '', userId: null });
    loadFriendsForStaff();
  };

  const handleAddStaff = async () => {
    if (!addStaffForm.roleId) {
      toast.error('Please select a role');
      return;
    }
    if (!addStaffForm.email && !addStaffForm.userId) {
      toast.error('Please select a friend or enter an email');
      return;
    }

    setAddingStaff(true);
    try {
      const payload = {
        roleId: parseInt(addStaffForm.roleId)
      };
      if (addStaffForm.userId) {
        payload.userId = addStaffForm.userId;
      } else {
        payload.email = addStaffForm.email;
      }

      const response = await eventStaffApi.assignStaff(eventId, payload);
      if (response.success) {
        toast.success('Staff member added');
        setShowAddStaffModal(false);
        setAddStaffForm({ email: '', roleId: '', userId: null });
        loadStaff();
      } else {
        toast.error(response.message || 'Failed to add staff');
      }
    } catch (err) {
      console.error('Error adding staff:', err);
      toast.error('Failed to add staff');
    } finally {
      setAddingStaff(false);
    }
  };

  const handleRemoveStaff = async (staffId) => {
    if (!confirm('Remove this staff member?')) return;

    try {
      const response = await eventStaffApi.removeStaff(eventId, staffId);
      if (response.success) {
        toast.success('Staff member removed');
        loadStaff();
      } else {
        toast.error(response.message || 'Failed to remove staff');
      }
    } catch (err) {
      console.error('Error removing staff:', err);
      toast.error('Failed to remove staff');
    }
  };

  const handleApproveStaff = async (staffId) => {
    try {
      const response = await eventStaffApi.approveStaff(eventId, staffId, {});
      if (response.success) {
        toast.success('Staff approved');
        loadStaff();
      } else {
        toast.error(response.message || 'Failed to approve staff');
      }
    } catch (err) {
      toast.error('Failed to approve staff');
    }
  };

  const handleDeclineStaff = async (staffId) => {
    try {
      const response = await eventStaffApi.declineStaff(eventId, staffId, 'Declined by organizer');
      if (response.success) {
        toast.success('Staff declined');
        loadStaff();
      } else {
        toast.error(response.message || 'Failed to decline staff');
      }
    } catch (err) {
      toast.error('Failed to decline staff');
    }
  };

  const openEditStaffModal = (staff) => {
    setEditingStaff(staff);
    setEditStaffForm({ roleId: staff.roleId?.toString() || '' });
  };

  const handleUpdateStaff = async () => {
    if (!editingStaff || !editStaffForm.roleId) return;

    setSavingStaffEdit(true);
    try {
      const response = await eventStaffApi.updateStaff(eventId, editingStaff.id, {
        roleId: parseInt(editStaffForm.roleId)
      });
      if (response.success) {
        toast.success('Staff role updated');
        setEditingStaff(null);
        loadStaff();
      } else {
        toast.error(response.message || 'Failed to update staff');
      }
    } catch (err) {
      console.error('Error updating staff:', err);
      toast.error('Failed to update staff');
    } finally {
      setSavingStaffEdit(false);
    }
  };

  // Court groups management
  const loadCourtGroups = async () => {
    setLoadingCourtGroups(true);
    try {
      const response = await tournamentApi.getCourtGroups(eventId);
      if (response.success) {
        setCourtGroups(response.data || []);
      }
    } catch (err) {
      console.error('Error loading court groups:', err);
    } finally {
      setLoadingCourtGroups(false);
    }
  };

  // Court/Time Planning Functions
  const loadPlanningData = async () => {
    setLoadingPlanningData(true);
    try {
      const response = await tournamentApi.getCourtPlanningData(eventId);
      if (response.success) {
        setPlanningData(response.data);
        // Build court time allocations from encounters that have scheduled times
        const allocations = (response.data?.encounters || [])
          .filter(e => e.scheduledTime && e.courtId)
          .map(e => ({
            encounterId: e.id,
            courtId: e.courtId,
            courtLabel: e.courtLabel,
            scheduledTime: new Date(e.scheduledTime),
            endTime: e.estimatedEndTime ? new Date(e.estimatedEndTime) :
              new Date(new Date(e.scheduledTime).getTime() + (e.estimatedDurationMinutes || 20) * 60000),
            divisionId: e.divisionId,
            divisionName: e.divisionName,
            unit1Name: e.unit1Name,
            unit2Name: e.unit2Name,
            encounterLabel: e.encounterLabel,
            encounterNumber: e.encounterNumber,
            status: e.status,
          }));
        setCourtTimeAllocations(allocations);
      } else {
        toast.error(response.message || 'Failed to load planning data');
      }
    } catch (err) {
      console.error('Error loading planning data:', err);
      toast.error('Failed to load planning data');
    } finally {
      setLoadingPlanningData(false);
    }
  };

  const getFilteredEncounters = () => {
    if (!planningData?.encounters) return [];
    let filtered = planningData.encounters.filter(e => !e.isBye);

    if (planningDivisionId) {
      filtered = filtered.filter(e => e.divisionId === parseInt(planningDivisionId));
    }
    if (planningPoolId && planningPoolId !== 'all') {
      // Filter by phase/pool
      if (planningPoolId.startsWith('phase_')) {
        const phaseId = parseInt(planningPoolId.replace('phase_', ''));
        filtered = filtered.filter(e => e.phaseId === phaseId);
      } else if (planningPoolId.startsWith('round_')) {
        const roundNum = parseInt(planningPoolId.replace('round_', ''));
        filtered = filtered.filter(e => e.roundNumber === roundNum);
      }
    }
    return filtered;
  };

  const getUnscheduledEncounters = () => {
    return getFilteredEncounters().filter(e => !e.scheduledTime || !e.courtId);
  };

  const getScheduledEncounters = () => {
    return getFilteredEncounters().filter(e => e.scheduledTime && e.courtId);
  };

  const calculateTimeEstimate = () => {
    const encounters = selectedEncountersForPlanning.length > 0
      ? selectedEncountersForPlanning
      : getUnscheduledEncounters().map(e => e.id);
    const matchCount = encounters.length;
    const { gameDurationMinutes, waitTimeMinutes, courtCount } = planningConfig;
    const totalMinutesPerMatch = gameDurationMinutes + waitTimeMinutes;
    const matchesPerCourt = Math.ceil(matchCount / courtCount);
    const totalMinutes = matchesPerCourt * totalMinutesPerMatch;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return { matchCount, totalMinutes, hours, minutes };
  };

  const getAvailableCourtsForPlanning = () => {
    if (planningCourtSelection === 'group' && selectedCourtGroupForPlanning) {
      const group = planningData?.courtGroups?.find(g => g.id === parseInt(selectedCourtGroupForPlanning));
      return group?.courts || [];
    }
    if (planningCourtSelection === 'individual') {
      return selectedCourtsForPlanning.map(courtId => {
        // Check court groups first
        for (const group of (planningData?.courtGroups || [])) {
          const court = group.courts?.find(c => c.id === courtId);
          if (court) return court;
        }
        // Check unassigned courts
        const unassigned = planningData?.unassignedCourts?.find(c => c.id === courtId);
        if (unassigned) return unassigned;
        return null;
      }).filter(Boolean);
    }
    return [];
  };

  const generateScheduleForSelection = () => {
    const encounters = selectedEncountersForPlanning.length > 0
      ? planningData.encounters.filter(e => selectedEncountersForPlanning.includes(e.id))
      : getUnscheduledEncounters();

    if (encounters.length === 0) {
      toast.error('No matches selected for scheduling');
      return;
    }

    if (!planningStartTime) {
      toast.error('Please enter a start time');
      return;
    }

    const courts = getAvailableCourtsForPlanning();
    if (courts.length === 0) {
      toast.error('Please select courts or a court group');
      return;
    }

    const { gameDurationMinutes, waitTimeMinutes } = planningConfig;
    const totalMinutesPerMatch = gameDurationMinutes + waitTimeMinutes;

    // Parse start time and combine with event date
    const eventDate = new Date(planningData.eventStartDate);
    const [hours, minutes] = planningStartTime.split(':').map(Number);
    const startDateTime = new Date(eventDate);
    startDateTime.setHours(hours, minutes, 0, 0);

    // Check for conflicts with existing allocations
    const existingAllocations = [...courtTimeAllocations];
    const newSchedule = [];
    const errors = [];

    // Track next available time for each court
    const courtNextAvailable = {};
    courts.forEach(court => {
      // Find last scheduled time for this court
      const courtAllocations = existingAllocations.filter(a => a.courtId === court.id);
      if (courtAllocations.length > 0) {
        const lastEnd = Math.max(...courtAllocations.map(a => a.endTime.getTime()));
        courtNextAvailable[court.id] = new Date(Math.max(startDateTime.getTime(), lastEnd));
      } else {
        courtNextAvailable[court.id] = new Date(startDateTime);
      }
    });

    // Assign encounters to courts using round-robin
    encounters.forEach((encounter, index) => {
      // Find court with earliest availability
      let earliestCourt = courts[0];
      let earliestTime = courtNextAvailable[courts[0].id];

      courts.forEach(court => {
        if (courtNextAvailable[court.id] < earliestTime) {
          earliestCourt = court;
          earliestTime = courtNextAvailable[court.id];
        }
      });

      const slotStart = new Date(courtNextAvailable[earliestCourt.id]);
      const slotEnd = new Date(slotStart.getTime() + totalMinutesPerMatch * 60000);

      // Check for conflicts
      const conflict = existingAllocations.find(a =>
        a.courtId === earliestCourt.id &&
        slotStart < a.endTime && slotEnd > a.scheduledTime
      );

      if (conflict) {
        errors.push(`Conflict on ${earliestCourt.courtLabel} at ${slotStart.toLocaleTimeString()}`);
      }

      newSchedule.push({
        encounterId: encounter.id,
        courtId: earliestCourt.id,
        courtLabel: earliestCourt.courtLabel,
        scheduledTime: slotStart,
        endTime: slotEnd,
        divisionId: encounter.divisionId,
        divisionName: encounter.divisionName,
        unit1Name: encounter.unit1Name,
        unit2Name: encounter.unit2Name,
        roundNumber: encounter.roundNumber,
        roundName: encounter.roundName,
        encounterLabel: encounter.encounterLabel,
        encounterNumber: encounter.encounterNumber,
        isNew: true,
      });

      // Update next available time for this court
      courtNextAvailable[earliestCourt.id] = slotEnd;
    });

    setGeneratedSchedule(newSchedule);
    setPlanningErrors(errors);

    if (newSchedule.length > 0) {
      toast.success(`Generated schedule for ${newSchedule.length} matches`);
    }
  };

  const applyGeneratedSchedule = () => {
    // Merge new schedule into allocations
    const newAllocations = [...courtTimeAllocations];
    generatedSchedule.forEach(slot => {
      // Remove any existing allocation for this encounter
      const existingIndex = newAllocations.findIndex(a => a.encounterId === slot.encounterId);
      if (existingIndex >= 0) {
        newAllocations.splice(existingIndex, 1);
      }
      newAllocations.push({ ...slot, isNew: true });
    });
    setCourtTimeAllocations(newAllocations);
    setGeneratedSchedule([]);
    setSelectedEncountersForPlanning([]);
    toast.success('Schedule applied. Click "Save Plan" to persist changes.');
  };

  const removeAllocation = (encounterId) => {
    setCourtTimeAllocations(prev => prev.filter(a => a.encounterId !== encounterId));
    setGeneratedSchedule(prev => prev.filter(s => s.encounterId !== encounterId));
  };

  const savePlanningData = async () => {
    const newAllocations = courtTimeAllocations.filter(a => a.isNew);
    if (newAllocations.length === 0) {
      toast.info('No new changes to save');
      return;
    }

    setSavingPlan(true);
    try {
      const assignments = newAllocations.map(a => ({
        encounterId: a.encounterId,
        courtId: a.courtId,
        scheduledTime: a.scheduledTime.toISOString(),
        estimatedStartTime: a.scheduledTime.toISOString(),
      }));

      const response = await tournamentApi.bulkAssignCourtsAndTimes(eventId, assignments);
      if (response.success) {
        toast.success(`Saved ${assignments.length} court/time assignments`);
        // Mark all as saved (not new)
        setCourtTimeAllocations(prev => prev.map(a => ({ ...a, isNew: false })));
        // Reload to get updated data
        loadPlanningData();
      } else {
        toast.error(response.message || 'Failed to save plan');
      }
    } catch (err) {
      console.error('Error saving plan:', err);
      toast.error('Failed to save planning data');
    } finally {
      setSavingPlan(false);
    }
  };

  const toggleEncounterSelection = (encounterId) => {
    setSelectedEncountersForPlanning(prev =>
      prev.includes(encounterId)
        ? prev.filter(id => id !== encounterId)
        : [...prev, encounterId]
    );
  };

  const selectAllUnscheduled = () => {
    setSelectedEncountersForPlanning(getUnscheduledEncounters().map(e => e.id));
  };

  const clearSelection = () => {
    setSelectedEncountersForPlanning([]);
  };

  // ========================================================
  // Backend Scheduling Integration Functions
  // ========================================================

  const loadDivisionPhases = async (divisionId) => {
    if (!divisionId) {
      setPlanningDivisionPhases([]);
      return;
    }
    setLoadingPhases(true);
    try {
      const response = await tournamentApi.getDivisionPhases(divisionId);
      if (response.success) {
        // Sort phases by phaseOrder to ensure correct display order
        const sortedPhases = [...(response.data || [])].sort((a, b) => 
          (a.phaseOrder || a.sortOrder || 0) - (b.phaseOrder || b.sortOrder || 0)
        );
        setPlanningDivisionPhases(sortedPhases);
      } else {
        toast.error(response.message || 'Failed to load phases');
      }
    } catch (err) {
      console.error('Error loading phases:', err);
      toast.error('Failed to load division phases');
    } finally {
      setLoadingPhases(false);
    }
  };

  // Load phase diagram data for a division
  const loadDivisionPhaseDiagram = async (divisionId) => {
    if (divisionPhaseData[divisionId]) return; // Already loaded
    try {
      // Get phases for display
      const phasesRes = await tournamentApi.getDivisionPhases(divisionId);
      if (phasesRes.success) {
        const phases = (phasesRes.data || []).map((p, i) => ({
          name: p.name,
          type: p.phaseType,
          order: p.phaseOrder || p.sortOrder || (i + 1),
          incomingSlots: p.incomingSlotCount,
          exitingSlots: p.advancingSlotCount,
          inSlots: p.incomingSlotCount,
          outSlots: p.advancingSlotCount,
          poolCount: p.poolCount,
          encounterCount: p.encounterCount
        }));
        
        // Build structureJson from advancementRules returned by API
        let structureJson = null;
        if (phasesRes.advancementRules && phasesRes.advancementRules.length > 0) {
          structureJson = {
            advancementRules: phasesRes.advancementRules.map(r => ({
              sourcePhaseOrder: r.sourcePhaseOrder,
              targetPhaseOrder: r.targetPhaseOrder,
              finishPosition: r.sourceRank || r.finishPosition,
              targetSlotNumber: r.targetSlotNumber
            }))
          };
        } else {
          // Fallback: try to get structureJson from the division in dashboard data
          const div = dashboard?.divisions?.find(d => d.id === divisionId);
          structureJson = div?.phaseTemplateJson || div?.structureJson || null;
        }
        
        setDivisionPhaseData(prev => ({
          ...prev,
          [divisionId]: { phases, structureJson }
        }));
      }
    } catch (err) {
      console.error('Error loading division phase diagram:', err);
    }
  };

  const togglePhaseDiagram = (divisionId) => {
    setExpandedPhaseDiagrams(prev => {
      const next = new Set(prev);
      if (next.has(divisionId)) {
        next.delete(divisionId);
      } else {
        next.add(divisionId);
        loadDivisionPhaseDiagram(divisionId);
      }
      return next;
    });
  };

  const handleGeneratePhaseEncounters = async (phaseId) => {
    setGeneratingPhaseEncounters(phaseId);
    try {
      const response = await tournamentApi.generatePhaseSchedule(phaseId);
      if (response.success) {
        toast.success(response.message || 'Encounters generated successfully');
        // Reload phases to get updated counts
        if (planningDivisionId) {
          await loadDivisionPhases(parseInt(planningDivisionId));
        }
      } else {
        toast.error(response.message || 'Failed to generate encounters');
      }
    } catch (err) {
      console.error('Error generating phase encounters:', err);
      toast.error('Failed to generate encounters');
    } finally {
      setGeneratingPhaseEncounters(null);
    }
  };

  const handleBackendScheduleGenerate = async () => {
    const divId = planningDivisionId ? parseInt(planningDivisionId) : null;
    const phId = selectedPlanningPhaseId ? parseInt(selectedPlanningPhaseId) : null;

    if (!divId) {
      toast.error('Please select a division');
      return;
    }

    // Get division settings for duration/rest
    const div = dashboard?.divisions?.find(d => d.id === divId);
    const matchDuration = div?.estimatedMatchDurationMinutes || planningConfig.gameDurationMinutes || 15;
    const restTime = div?.minRestTimeMinutes || planningConfig.waitTimeMinutes || 5;

    // Build start time from event date + time input
    let startTime = null;
    if (schedulingStartTime) {
      const eventDate = event?.startDate || dashboard?.event?.startDate;
      if (eventDate) {
        const d = new Date(eventDate);
        const [h, m] = schedulingStartTime.split(':').map(Number);
        d.setHours(h, m, 0, 0);
        startTime = d.toISOString();
      }
    }

    setBackendScheduling(true);
    setSchedulingResults(null);
    try {
      const response = await tournamentApi.schedulingGenerate({
        eventId: parseInt(eventId),
        divisionId: divId,
        phaseId: phId,
        startTime,
        matchDurationMinutes: matchDuration,
        restTimeMinutes: restTime,
        clearExisting: schedulingClearExisting,
        respectPlayerOverlap: schedulingRespectOverlap,
      });
      if (response.success) {
        setSchedulingResults(response.data);
        toast.success(response.data?.message || `Schedule generated: ${response.data?.assignedCount || 0} matches assigned`);
        // Auto-load validation and grid
        handleLoadValidation(divId);
        handleLoadScheduleGrid();
        // Refresh phases
        loadDivisionPhases(divId);
      } else {
        toast.error(response.message || 'Failed to generate schedule');
        setSchedulingResults({ error: response.message });
      }
    } catch (err) {
      console.error('Error generating schedule:', err);
      toast.error('Failed to generate schedule');
      setSchedulingResults({ error: err.message });
    } finally {
      setBackendScheduling(false);
    }
  };

  const handleLoadValidation = async (divId) => {
    const divisionId = divId || (planningDivisionId ? parseInt(planningDivisionId) : null);
    setLoadingScheduleValidation(true);
    try {
      const response = await tournamentApi.schedulingValidate(parseInt(eventId), divisionId);
      if (response.success) {
        setValidationData(response.data);
      }
    } catch (err) {
      console.error('Error loading validation:', err);
    } finally {
      setLoadingScheduleValidation(false);
    }
  };

  const handleLoadScheduleGrid = async () => {
    setLoadingGrid(true);
    try {
      const response = await tournamentApi.schedulingGetGrid(parseInt(eventId));
      if (response.success) {
        setScheduleGrid(response.data);
      }
    } catch (err) {
      console.error('Error loading schedule grid:', err);
    } finally {
      setLoadingGrid(false);
    }
  };

  const handleClearSchedule = async () => {
    const divId = planningDivisionId ? parseInt(planningDivisionId) : null;
    const phId = selectedPlanningPhaseId ? parseInt(selectedPlanningPhaseId) : null;

    if (!divId) {
      toast.error('Please select a division');
      return;
    }

    if (!confirm('Clear all scheduled times for this division/phase? This cannot be undone.')) return;

    setClearingSchedule(true);
    try {
      const response = await tournamentApi.schedulingClear(divId, phId);
      if (response.success) {
        toast.success(response.message || 'Schedule cleared');
        setSchedulingResults(null);
        setValidationData(null);
        setScheduleGrid(null);
        loadDivisionPhases(divId);
        handleLoadScheduleGrid();
      } else {
        toast.error(response.message || 'Failed to clear schedule');
      }
    } catch (err) {
      console.error('Error clearing schedule:', err);
      toast.error('Failed to clear schedule');
    } finally {
      setClearingSchedule(false);
    }
  };

  const handleAssignCourtGroupsToDivision = async () => {
    const divId = planningDivisionId ? parseInt(planningDivisionId) : null;
    if (!divId || selectedCourtGroupsForAssignment.length === 0) {
      toast.error('Select a division and at least one court group');
      return;
    }

    setAssigningCourts(true);
    try {
      const response = await tournamentApi.assignCourtGroupsToDivision(
        divId,
        selectedCourtGroupsForAssignment,
        courtAssignmentTimeFrom || null,
        courtAssignmentTimeTo || null
      );
      if (response.success) {
        toast.success('Court groups assigned to division');
        setSelectedCourtGroupsForAssignment([]);
        setCourtAssignmentMode(false);
        // Reload data
        loadDivisionPhases(divId);
      } else {
        toast.error(response.message || 'Failed to assign courts');
      }
    } catch (err) {
      console.error('Error assigning courts:', err);
      toast.error('Failed to assign court groups');
    } finally {
      setAssigningCourts(false);
    }
  };

  const handleGenerateAdvancementRules = async (targetPhaseId, sourcePhaseId) => {
    setGeneratingAdvancement(true);
    try {
      const response = await tournamentApi.generateAdvancementRules(targetPhaseId, sourcePhaseId);
      if (response.success) {
        toast.success('Advancement rules generated');
        if (planningDivisionId) {
          loadDivisionPhases(parseInt(planningDivisionId));
        }
      } else {
        toast.error(response.message || 'Failed to generate advancement rules');
      }
    } catch (err) {
      console.error('Error generating advancement rules:', err);
      toast.error('Failed to generate advancement rules');
    } finally {
      setGeneratingAdvancement(false);
    }
  };

  // ========================================================
  // One-Click Auto-Schedule All
  // ========================================================
  const handleAutoScheduleAll = async () => {
    setAutoScheduling(true);
    setSchedulingResults(null);
    try {
      // 1) Load current grid state
      const gridRes = await tournamentApi.schedulingGetGrid(parseInt(eventId));
      if (!gridRes.success) {
        toast.error(gridRes.message || 'Failed to load grid data');
        return;
      }
      const grid = gridRes.data;

      // Figure out event date for time block generation
      const eventDate = grid.eventDate || event?.startDate?.split('T')[0] || new Date().toISOString().split('T')[0];
      const startHour = grid.gridStartTime
        ? new Date(grid.gridStartTime).toISOString()
        : `${eventDate}T08:00:00`;
      const endHour = grid.gridEndTime
        ? new Date(grid.gridEndTime).toISOString()
        : `${eventDate}T18:00:00`;

      // 2) Build auto-allocate blocks per division
      const divisions = grid.divisions || [];
      const allCourts = grid.courts || [];
      const blocks = [];

      for (const div of divisions) {
        // Count unscheduled for this division
        const divEncounters = (grid.encounters || []).filter(e => e.divisionId === div.id);
        const unscheduled = divEncounters.filter(e => !e.courtId || !e.startTime);
        if (unscheduled.length === 0) continue;

        // Get available courts for this division (falls back to all event courts)
        let courtIds = allCourts.map(c => c.id);
        try {
          const courtsRes = await tournamentApi.schedulingGetAvailableCourts(div.id);
          if (courtsRes.success && courtsRes.data?.length > 0) {
            courtIds = courtsRes.data.map(c => c.id || c.courtId || c);
          }
        } catch (e) { /* use all courts */ }

        blocks.push({
          divisionId: div.id,
          phaseId: null,
          courtIds,
          courtGroupId: null,
          startTime: startHour,
          endTime: endHour,
        });
      }

      if (blocks.length === 0) {
        toast.info('All encounters are already scheduled!');
        handleLoadScheduleGrid();
        return;
      }

      // 3) Call auto-allocate
      const res = await tournamentApi.schedulingAutoAllocate({
        eventId: parseInt(eventId),
        blocks,
        clearExisting: false,
        respectPlayerOverlap: true,
      });

      if (res.success) {
        const totalAssigned = res.data?.totalAssigned || 0;
        const totalSkipped = res.data?.totalSkipped || 0;
        setSchedulingResults({
          message: `Auto-scheduled ${totalAssigned} matches${totalSkipped > 0 ? `, ${totalSkipped} could not be placed` : ''}`,
          assignedCount: totalAssigned,
          unassignedCount: totalSkipped,
          conflictCount: res.data?.conflicts?.length || 0,
          conflicts: res.data?.conflicts || [],
        });
        toast.success(`Auto-scheduled ${totalAssigned} matches`);
        if (totalSkipped > 0) {
          toast.warn(`${totalSkipped} matches could not be scheduled within time blocks`);
        }
      } else {
        toast.error(res.message || 'Auto-scheduling failed');
        setSchedulingResults({ error: res.message || 'Auto-scheduling failed' });
      }

      // 4) Refresh grid
      handleLoadScheduleGrid();
      if (planningDivisionId) {
        loadDivisionPhases(parseInt(planningDivisionId));
      }
    } catch (err) {
      console.error('Error auto-scheduling:', err);
      toast.error('Auto-scheduling failed');
      setSchedulingResults({ error: err.message });
    } finally {
      setAutoScheduling(false);
    }
  };

  // Handle move encounter from drag-and-drop grid
  const handleMoveEncounterInGrid = async (encounterId, data) => {
    try {
      const res = await tournamentApi.schedulingMoveEncounter(encounterId, data);
      if (res.success) {
        if (res.data?.hasConflicts) {
          toast.warn(res.message || 'Match moved with conflicts');
        } else {
          toast.success('Match moved');
        }
      } else {
        toast.error(res.message || 'Failed to move match');
      }
    } catch (err) {
      console.error('Error moving encounter:', err);
      toast.error('Failed to move match');
    }
  };

  // Generate schedule for a specific division (one-click per division)
  const handleGenerateScheduleForDivision = async (division) => {
    setBackendScheduling(true);
    setSchedulingResults(null);
    try {
      const response = await tournamentApi.schedulingGenerate({
        eventId: parseInt(eventId),
        divisionId: division.id,
        clearExisting: true,
        respectPlayerOverlap: true,
      });
      if (response.success) {
        setSchedulingResults(response.data);
        toast.success(response.data?.message || `Schedule generated for ${division.name}`);
        handleLoadScheduleGrid();
        if (planningDivisionId) {
          loadDivisionPhases(parseInt(planningDivisionId));
        }
        handleLoadValidation(division.id);
      } else {
        toast.error(response.message || 'Failed to generate schedule');
        setSchedulingResults({ error: response.message });
      }
    } catch (err) {
      console.error('Error generating schedule for division:', err);
      toast.error('Failed to generate schedule');
    } finally {
      setBackendScheduling(false);
    }
  };

  const handleCreateCourtGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }
    setCreatingGroup(true);
    try {
      const response = await tournamentApi.createCourtGroup({
        eventId: parseInt(eventId),
        groupName: newGroupName.trim()
      });
      if (response.success) {
        toast.success('Court group created');
        setNewGroupName('');
        loadCourtGroups();
      } else {
        toast.error(response.message || 'Failed to create group');
      }
    } catch (err) {
      console.error('Error creating court group:', err);
      toast.error('Failed to create court group');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleDeleteCourtGroup = async (groupId) => {
    if (!confirm('Delete this court group? Courts will be unassigned.')) return;
    setDeletingGroupId(groupId);
    try {
      const response = await tournamentApi.deleteCourtGroup(groupId);
      if (response.success) {
        toast.success('Court group deleted');
        loadCourtGroups();
      } else {
        toast.error(response.message || 'Failed to delete group');
      }
    } catch (err) {
      console.error('Error deleting court group:', err);
      toast.error('Failed to delete court group');
    } finally {
      setDeletingGroupId(null);
    }
  };

  const handleAddCourtToGroup = async (groupId, courtId) => {
    try {
      const response = await tournamentApi.addCourtToGroup(groupId, courtId);
      if (response.success) {
        toast.success('Court added to group');
        loadCourtGroups();
        loadDashboard();
      } else {
        toast.error(response.message || 'Failed to add court');
      }
    } catch (err) {
      console.error('Error adding court to group:', err);
      toast.error('Failed to add court');
    }
  };

  const handleRemoveCourtFromGroup = async (groupId, courtId) => {
    try {
      const response = await tournamentApi.removeCourtFromGroup(groupId, courtId);
      if (response.success) {
        toast.success('Court removed from group');
        loadCourtGroups();
        loadDashboard();
      } else {
        toast.error(response.message || 'Failed to remove court');
      }
    } catch (err) {
      console.error('Error removing court from group:', err);
      toast.error('Failed to remove court');
    }
  };

  // Get courts not in any group
  const getUnassignedCourts = () => {
    if (!dashboard?.courts || courtGroups.length === 0) return dashboard?.courts || [];
    const assignedCourtIds = new Set();
    courtGroups.forEach(group => {
      (group.courts || []).forEach(court => assignedCourtIds.add(court.id));
    });
    return dashboard.courts.filter(court => !assignedCourtIds.has(court.id));
  };

  const handleAddCourts = async () => {
    const num = parseInt(numberOfCourts);
    if (!num || num < 1 || num > 100) {
      toast.error('Please enter a number between 1 and 100');
      return;
    }

    setAddingCourts(true);
    try {
      // Calculate starting number based on existing courts
      const existingCount = dashboard?.courts?.length || 0;
      const response = await tournamentApi.bulkCreateCourts(eventId, num, 'Court', existingCount + 1);
      if (response.success) {
        toast.success(response.message || `Added ${num} court${num > 1 ? 's' : ''}`);
        setShowAddCourtsModal(false);
        setNumberOfCourts('');
        loadDashboard(); // Refresh to show new courts
      } else {
        toast.error(response.message || 'Failed to add courts');
      }
    } catch (err) {
      console.error('Error adding courts:', err);
      toast.error('Failed to add courts');
    } finally {
      setAddingCourts(false);
    }
  };

  const handleEditCourt = (court) => {
    setEditingCourt(court);
    setEditCourtForm({ label: court.courtLabel, status: court.status });
  };

  const handleSaveCourt = async () => {
    if (!editingCourt) return;

    setSavingCourt(true);
    try {
      const response = await gameDayApi.updateCourt(editingCourt.id, {
        label: editCourtForm.label,
        status: editCourtForm.status
      });
      if (response.success) {
        toast.success('Court updated');
        setEditingCourt(null);
        loadDashboard(); // Refresh to show updated court
      } else {
        toast.error(response.message || 'Failed to update court');
      }
    } catch (err) {
      console.error('Error updating court:', err);
      toast.error('Failed to update court');
    } finally {
      setSavingCourt(false);
    }
  };

  const handleDeleteCourt = async (courtId) => {
    if (!confirm('Delete this court? This cannot be undone.')) return;

    try {
      const response = await gameDayApi.deleteCourt(courtId);
      if (response.success) {
        toast.success('Court deleted');
        loadDashboard();
      } else {
        toast.error(response.message || 'Failed to delete court');
      }
    } catch (err) {
      console.error('Error deleting court:', err);
      toast.error('Failed to delete court');
    }
  };

  const handleToggleDivisionActive = async (division) => {
    const newStatus = !division.isActive;
    const action = newStatus ? 'activate' : 'deactivate';

    if (!newStatus && division.registeredUnits > 0) {
      if (!confirm(`This division has ${division.registeredUnits} registered teams. Deactivating will hide it from public view. Continue?`)) {
        return;
      }
    }

    try {
      const response = await eventsApi.updateDivision(eventId, division.id, { isActive: newStatus });
      if (response.success) {
        toast.success(`Division ${newStatus ? 'activated' : 'deactivated'}`);
        loadDashboard();
      } else {
        toast.error(response.message || `Failed to ${action} division`);
      }
    } catch (err) {
      console.error(`Error ${action}ing division:`, err);
      toast.error(`Failed to ${action} division`);
    }
  };

  // Open edit division modal
  const handleOpenEditDivision = (division) => {
    setEditingDivision({
      id: division.id,
      name: division.name || '',
      description: division.description || '',
      teamUnitId: division.teamUnitId || null,
      skillLevelId: division.skillLevelId || null,
      ageGroupId: division.ageGroupId || null,
      maxUnits: division.maxUnits || '',
      maxPlayers: division.maxPlayers || '',
      divisionFee: division.divisionFee || '',
      scheduleStatus: division.scheduleReady ? 'Generated' : 'NotGenerated'
    });
    setShowEditDivision(true);
  };

  // Open add division modal with empty form
  const handleOpenAddDivision = () => {
    setEditingDivision({
      id: null,
      name: '',
      description: '',
      teamUnitId: null,
      skillLevelId: null,
      ageGroupId: null,
      maxUnits: '',
      maxPlayers: '',
      divisionFee: '',
      scheduleStatus: 'NotGenerated'
    });
    setShowEditDivision(true);
  };

  // Save division changes (both add and edit)
  const handleSaveDivision = async () => {
    if (!editingDivision) return;

    if (!editingDivision.name?.trim()) {
      toast.error('Division name is required');
      return;
    }

    setSavingDivision(true);
    try {
      const divisionData = {
        name: editingDivision.name,
        description: editingDivision.description,
        teamUnitId: editingDivision.teamUnitId || null,
        skillLevelId: editingDivision.skillLevelId || null,
        ageGroupId: editingDivision.ageGroupId || null,
        maxUnits: editingDivision.maxUnits ? parseInt(editingDivision.maxUnits) : null,
        maxPlayers: editingDivision.maxPlayers ? parseInt(editingDivision.maxPlayers) : null,
        divisionFee: editingDivision.divisionFee ? parseFloat(editingDivision.divisionFee) : null
      };

      let response;
      if (editingDivision.id) {
        // Update existing division
        response = await eventsApi.updateDivision(eventId, editingDivision.id, divisionData);
      } else {
        // Create new division
        response = await eventsApi.addDivision(eventId, divisionData);
      }

      if (response.success) {
        toast.success(editingDivision.id ? 'Division updated successfully' : 'Division created successfully');
        setShowEditDivision(false);
        setEditingDivision(null);
        loadDashboard();
        loadEvent();
      } else {
        toast.error(response.message || `Failed to ${editingDivision.id ? 'update' : 'create'} division`);
      }
    } catch (err) {
      console.error('Error saving division:', err);
      toast.error(`Failed to ${editingDivision.id ? 'update' : 'create'} division`);
    } finally {
      setSavingDivision(false);
    }
  };

  // Search for users to add as players
  const handleSearchPlayers = async (query) => {
    if (!query || query.length < 2) {
      setPlayerSearchResults([]);
      return;
    }
    setSearchingPlayers(true);
    try {
      const response = await tournamentApi.searchUsersForRegistration(eventId, query);
      if (response.success) {
        setPlayerSearchResults(response.data || []);
      }
    } catch (err) {
      console.error('Error searching players:', err);
    } finally {
      setSearchingPlayers(false);
    }
  };

  // Admin register a player
  const handleAdminRegisterPlayer = async () => {
    if (!selectedPlayerForReg || !selectedDivisionForReg) {
      toast.error('Please select a player and division');
      return;
    }
    setRegisteringPlayer(true);
    try {
      const response = await tournamentApi.adminRegisterUser(eventId, {
        userId: selectedPlayerForReg.userId,
        divisionId: parseInt(selectedDivisionForReg)
      });
      if (response.success) {
        toast.success(`${selectedPlayerForReg.name || selectedPlayerForReg.email} registered successfully`);
        setShowAddPlayer(false);
        setPlayerSearchQuery('');
        setPlayerSearchResults([]);
        setSelectedPlayerForReg(null);
        setSelectedDivisionForReg('');
        loadCheckIns();
        loadDashboard();
      } else {
        toast.error(response.message || 'Failed to register player');
      }
    } catch (err) {
      console.error('Error registering player:', err);
      toast.error('Failed to register player');
    } finally {
      setRegisteringPlayer(false);
    }
  };

  // Load event documents using ObjectAssets API
  const loadDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const response = await objectAssetsApi.getAssets('Event', eventId);
      if (response.success) {
        setDocuments(response.data || []);
      }
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setLoadingDocuments(false);
    }
  };

  // Load asset types for Event
  const loadAssetTypes = async () => {
    try {
      const response = await objectAssetTypesApi.getAll({ objectTypeName: 'Event' });
      if (response.success) {
        setAssetTypes(response.data || []);
      }
    } catch (err) {
      console.error('Error loading asset types:', err);
    }
  };

  // Get icon for asset type
  const getIconForAssetType = (typeName) => {
    switch (typeName?.toLowerCase()) {
      case 'waiver': return Shield;
      case 'map': return MapIcon;
      case 'rules': return BookOpen;
      case 'contacts': return Phone;
      default: return FileText;
    }
  };

  // Get color for asset type
  const getColorForAssetType = (colorClass) => {
    switch (colorClass) {
      case 'red': return { bg: 'bg-red-100', text: 'text-red-600' };
      case 'green': return { bg: 'bg-green-100', text: 'text-green-600' };
      case 'purple': return { bg: 'bg-purple-100', text: 'text-purple-600' };
      case 'blue': return { bg: 'bg-blue-100', text: 'text-blue-600' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-600' };
    }
  };

  // Handle document file upload
  const handleDocumentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be less than 10MB');
      return;
    }

    if (!newDocument.title.trim()) {
      toast.error('Please enter a document title first');
      return;
    }

    if (!newDocument.objectAssetTypeId) {
      toast.error('Please select a document type');
      return;
    }

    setUploadingDocument(true);
    try {
      // Upload file to shared assets
      const uploadResponse = await sharedAssetApi.uploadViaProxy(file, 'document', 'event');
      const fileUrl = uploadResponse?.url;

      if (!fileUrl) {
        toast.error('Failed to upload file');
        return;
      }

      // Create document record using ObjectAssets API
      const response = await objectAssetsApi.addAsset('Event', eventId, {
        objectAssetTypeId: newDocument.objectAssetTypeId,
        title: newDocument.title.substring(0, 200),
        fileUrl: fileUrl,
        fileName: file.name.substring(0, 200),
        fileType: file.type?.substring(0, 50),
        fileSize: file.size,
        isPublic: newDocument.isPublic,
        sortOrder: newDocument.sortOrder
      });

      if (response.success) {
        toast.success('Document added successfully');
        setDocuments([...documents, response.data]);
        setShowAddDocument(false);
        setNewDocument({ title: '', isPublic: true, sortOrder: 0, objectAssetTypeId: null });
      } else {
        toast.error(response.message || 'Failed to add document');
      }
    } catch (err) {
      console.error('Error adding document:', err);
      toast.error('Failed to add document');
    } finally {
      setUploadingDocument(false);
    }
  };

  // Update document
  const handleUpdateDocument = async (docId, updates) => {
    try {
      const response = await objectAssetsApi.updateAsset('Event', eventId, docId, updates);
      if (response.success) {
        setDocuments(documents.map(d => d.id === docId ? response.data : d));
        setEditingDocument(null);
        toast.success('Document updated');
      } else {
        toast.error(response.message || 'Failed to update document');
      }
    } catch (err) {
      console.error('Error updating document:', err);
      toast.error('Failed to update document');
    }
  };

  // Delete document
  const handleDeleteDocument = async (docId) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    setDeletingDocumentId(docId);
    try {
      const response = await objectAssetsApi.deleteAsset('Event', eventId, docId);
      if (response.success) {
        setDocuments(documents.filter(d => d.id !== docId));
        toast.success('Document deleted');
      } else {
        toast.error(response.message || 'Failed to delete document');
      }
    } catch (err) {
      console.error('Error deleting document:', err);
      toast.error('Failed to delete document');
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const loadSchedule = async (divisionId, silent = false) => {
    if (!silent) setLoadingSchedule(true);
    try {
      const response = await tournamentApi.getSchedule(divisionId);
      if (response.success) {
        setSchedule(response.data);
      }
      // Also load division units for admin unit change feature
      const unitsResponse = await tournamentApi.getDivisionUnits(divisionId);
      if (unitsResponse.success) {
        setDivisionUnits(unitsResponse.data || []);
      }
    } catch (err) {
      console.error('Error loading schedule:', err);
    } finally {
      if (!silent) setLoadingSchedule(false);
    }
  };

  const handleChangeEncounterUnits = async (encounterId, unit1Id, unit2Id) => {
    try {
      const response = await tournamentApi.updateEncounterUnits(encounterId, unit1Id, unit2Id);
      if (response.success) {
        toast.success('Teams updated successfully');
      } else {
        toast.error(response.message || 'Failed to update teams');
      }
    } catch (err) {
      console.error('Error updating encounter units:', err);
      toast.error('Failed to update teams');
      throw err;
    }
  };

  // Pool management functions
  const handleCalculateRankings = async () => {
    if (!selectedDivision) return;

    setCalculatingRankings(true);
    try {
      const response = await gameDayApi.calculatePoolRankings(eventId, selectedDivision.id);
      if (response.success) {
        setPoolStandings(response.data);
        toast.success('Pool rankings calculated');
        loadSchedule(selectedDivision.id);
      } else {
        toast.error(response.message || 'Failed to calculate rankings');
      }
    } catch (err) {
      console.error('Error calculating rankings:', err);
      toast.error('Failed to calculate rankings');
    } finally {
      setCalculatingRankings(false);
    }
  };

  const handleFinalizePools = async () => {
    if (!selectedDivision) return;

    const advanceCount = selectedDivision.playoffFromPools || 2;
    if (!confirm(`This will finalize pool play and advance the top ${advanceCount} team(s) from each pool to playoffs. Continue?`)) {
      return;
    }

    setFinalizingPools(true);
    try {
      const response = await gameDayApi.finalizePools(eventId, selectedDivision.id);
      if (response.success) {
        toast.success(`${response.data?.advancedCount || 0} teams advanced to playoffs`);
        setShowAdvancementPreview(false);
        loadDashboard();
        loadSchedule(selectedDivision.id);
      } else {
        toast.error(response.message || 'Failed to finalize pools');
      }
    } catch (err) {
      console.error('Error finalizing pools:', err);
      toast.error('Failed to finalize pools');
    } finally {
      setFinalizingPools(false);
    }
  };

  const handleResetPools = async () => {
    if (!selectedDivision) return;

    if (!confirm('This will reset pool finalization and clear playoff assignments. Continue?')) {
      return;
    }

    try {
      const response = await gameDayApi.resetPools(eventId, selectedDivision.id);
      if (response.success) {
        toast.success('Pool finalization reset');
        loadDashboard();
        loadSchedule(selectedDivision.id);
      } else {
        toast.error(response.message || 'Failed to reset pools');
      }
    } catch (err) {
      console.error('Error resetting pools:', err);
      toast.error('Failed to reset pools');
    }
  };

  const handleDownloadSchedule = async () => {
    if (!selectedDivision) return;

    setDownloadingStandings(true);
    try {
      const response = await tournamentApi.downloadScoresheet(selectedDivision.id);

      // Create blob and download
      const blob = new Blob([response], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedDivision?.name || 'Division'}_Scoresheet.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Scoresheet downloaded');
    } catch (err) {
      console.error('Error downloading scoresheet:', err);
      toast.error('Failed to download scoresheet');
    } finally {
      setDownloadingStandings(false);
    }
  };

  // Check-in management functions
  const loadCheckIns = async () => {
    setLoadingCheckIns(true);
    try {
      const response = await checkInApi.getEventCheckIns(eventId);
      if (response.success) {
        setCheckInData(response.data);
      } else {
        toast.error(response.message || 'Failed to load check-in data');
      }
    } catch (err) {
      console.error('Error loading check-ins:', err);
      toast.error('Failed to load check-in data');
    } finally {
      setLoadingCheckIns(false);
    }
  };

  const handleManualCheckIn = async (userId) => {
    setProcessingAction({ userId, action: 'checkin' });
    try {
      const response = await checkInApi.manualCheckIn(eventId, userId, { signWaiver: false });
      if (response.success) {
        toast.success('Player checked in');
        loadCheckIns();
        loadDashboard();
      } else {
        toast.error(response.message || 'Failed to check in player');
      }
    } catch (err) {
      console.error('Error checking in player:', err);
      toast.error('Failed to check in player');
    } finally {
      setProcessingAction(null);
      setActionMenuOpen(null);
    }
  };

  const handleVoidCheckIn = async (userId) => {
    if (!confirm('Are you sure you want to void this check-in? This will also void the waiver and payment, allowing the player to re-sign and re-pay.')) return;
    setProcessingAction({ userId, action: 'void-checkin' });
    try {
      const response = await checkInApi.voidCheckIn(eventId, userId);
      if (response.success) {
        toast.success(response.message || 'Check-in voided - player can now re-sign waiver and re-submit payment');
        loadCheckIns();
        loadDashboard();
      } else {
        toast.error(response.message || 'Failed to void check-in');
      }
    } catch (err) {
      console.error('Error voiding check-in:', err);
      toast.error('Failed to void check-in');
    } finally {
      setProcessingAction(null);
      setActionMenuOpen(null);
    }
  };

  const handleOverrideWaiver = async (userId) => {
    setProcessingAction({ userId, action: 'override-waiver' });
    try {
      const response = await checkInApi.overrideWaiver(eventId, userId);
      if (response.success) {
        toast.success('Waiver requirement overridden');
        loadCheckIns();
      } else {
        toast.error(response.message || 'Failed to override waiver');
      }
    } catch (err) {
      console.error('Error overriding waiver:', err);
      toast.error('Failed to override waiver');
    } finally {
      setProcessingAction(null);
      setActionMenuOpen(null);
    }
  };

  const handleVoidWaiver = async (userId) => {
    if (!confirm('Are you sure you want to void this waiver signature?')) return;
    setProcessingAction({ userId, action: 'void-waiver' });
    try {
      const response = await checkInApi.voidWaiver(eventId, userId);
      if (response.success) {
        toast.success('Waiver signature voided');
        loadCheckIns();
      } else {
        toast.error(response.message || 'Failed to void waiver');
      }
    } catch (err) {
      console.error('Error voiding waiver:', err);
      toast.error('Failed to void waiver');
    } finally {
      setProcessingAction(null);
      setActionMenuOpen(null);
    }
  };

  const handleOverridePayment = async (userId, hasPaid) => {
    if (!hasPaid && !confirm('Are you sure you want to void this payment?')) return;
    setProcessingAction({ userId, action: hasPaid ? 'mark-paid' : 'void-payment' });
    try {
      const response = await checkInApi.overridePayment(eventId, userId, hasPaid);
      if (response.success) {
        toast.success(hasPaid ? 'Payment marked as paid' : 'Payment voided');
        loadCheckIns();
      } else {
        toast.error(response.message || 'Failed to update payment');
      }
    } catch (err) {
      console.error('Error updating payment:', err);
      toast.error('Failed to update payment');
    } finally {
      setProcessingAction(null);
      setActionMenuOpen(null);
    }
  };

  // Start editing payment for a player
  const startEditPayment = (player) => {
    setEditingPayment({
      player,
      form: {
        hasPaid: player.hasPaid,
        amountPaid: player.amountPaid?.toString() || '',
        paymentMethod: player.paymentMethod || '',
        paymentReference: player.paymentReference || '',
        paymentProofUrl: player.paymentProofUrl || '',
      }
    });
  };

  // Save edited payment
  const saveEditedPayment = async () => {
    if (!editingPayment) return;
    setSavingPayment(true);
    try {
      const { player, form } = editingPayment;
      const response = await tournamentApi.updateMemberPayment(eventId, player.unitId, player.userId, {
        hasPaid: form.hasPaid,
        amountPaid: form.amountPaid ? parseFloat(form.amountPaid) : 0,
        paymentMethod: form.paymentMethod || null,
        paymentReference: form.paymentReference || null,
        paymentProofUrl: form.paymentProofUrl || null,
      });
      if (response.success) {
        toast.success('Payment updated successfully');
        setEditingPayment(null);
        loadCheckIns();
      } else {
        toast.error(response.message || 'Failed to update payment');
      }
    } catch (err) {
      console.error('Error updating payment:', err);
      toast.error('Failed to update payment');
    } finally {
      setSavingPayment(false);
    }
  };

  // Update edit form field
  const updateEditForm = (field, value) => {
    setEditingPayment(prev => ({
      ...prev,
      form: { ...prev.form, [field]: value }
    }));
  };

  // Handle payment proof upload
  const handlePaymentProofUpload = async (e) => {
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

    setUploadingPaymentProof(true);
    try {
      const assetType = file.type === 'application/pdf' ? 'document' : 'image';
      const response = await sharedAssetApi.uploadViaProxy(file, assetType, 'payment-proof');
      if (response.success && response.url) {
        // Store raw URL (e.g. /asset/123) - getSharedAssetUrl transforms it when displaying
        updateEditForm('paymentProofUrl', response.url);
        toast.success('File uploaded successfully');
      } else {
        toast.error(response.message || 'Failed to upload file');
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      toast.error('Failed to upload file');
    } finally {
      setUploadingPaymentProof(false);
    }
  };

  // Handle admin proof upload for payment records in Payments tab
  const handleAdminProofUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingProofForPayment) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload an image (JPG, PNG, GIF, WebP) or PDF');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be less than 5MB');
      return;
    }

    const paymentId = uploadingProofForPayment;
    setUploadingProofForPayment('uploading');
    try {
      const assetType = file.type === 'application/pdf' ? 'document' : 'image';
      const uploadRes = await sharedAssetApi.uploadViaProxy(file, assetType, 'payment-proof');
      if (uploadRes.success && uploadRes.url) {
        const response = await tournamentApi.updatePaymentProof(paymentId, {
          paymentProofUrl: uploadRes.url
        });
        if (response.success) {
          toast.success('Payment proof uploaded');
          loadPaymentSummary();
        } else {
          toast.error(response.message || 'Failed to save proof');
        }
      } else {
        toast.error(uploadRes.message || 'Upload failed');
      }
    } catch (err) {
      console.error('Error uploading proof:', err);
      toast.error('Failed to upload proof');
    } finally {
      setUploadingProofForPayment(null);
      if (proofFileInputRef.current) proofFileInputRef.current.value = '';
    }
  };

  // Handle logo upload
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload an image file (JPG, PNG, GIF, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const response = await sharedAssetApi.uploadViaProxy(file, 'image', 'event-logo');
      if (response.success && response.url) {
        handleFormChange('posterImageUrl', response.url);
        toast.success('Logo uploaded successfully');
      } else {
        toast.error(response.message || 'Failed to upload logo');
      }
    } catch (err) {
      console.error('Error uploading logo:', err);
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Handle banner upload
  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload an image file (JPG, PNG, GIF, WebP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploadingBanner(true);
    try {
      const response = await sharedAssetApi.uploadViaProxy(file, 'image', 'event-banner');
      if (response.success && response.url) {
        handleFormChange('bannerImageUrl', response.url);
        toast.success('Banner uploaded successfully');
      } else {
        toast.error(response.message || 'Failed to upload banner');
      }
    } catch (err) {
      console.error('Error uploading banner:', err);
      toast.error('Failed to upload banner');
    } finally {
      setUploadingBanner(false);
    }
  };

  // Send waiver request to player
  const handleSendWaiverRequest = async (player) => {
    setSendingWaiverRequest(player.userId);
    setActionMenuOpen(null);
    try {
      const response = await checkInApi.sendWaiverRequest(eventId, player.userId);
      if (response.success) {
        toast.success(`Waiver request sent to ${player.firstName}`);
      } else {
        toast.error(response.message || 'Failed to send waiver request');
      }
    } catch (err) {
      console.error('Error sending waiver request:', err);
      toast.error('Failed to send waiver request');
    } finally {
      setSendingWaiverRequest(null);
    }
  };

  // Filter players for check-in tab
  const getFilteredPlayers = () => {
    if (!checkInData?.players) return [];
    let filtered = checkInData.players;

    // Apply division filter
    if (checkInDivisionFilter !== 'all') {
      filtered = filtered.filter(p => p.divisionId === parseInt(checkInDivisionFilter));
    }

    // Apply status filter
    if (checkInFilter === 'pending') {
      filtered = filtered.filter(p => !p.isCheckedIn);
    } else if (checkInFilter === 'checked-in') {
      filtered = filtered.filter(p => p.isCheckedIn);
    }

    return filtered;
  };

  // Group players by division
  const getPlayersByDivision = () => {
    const filtered = getFilteredPlayers();
    const grouped = {};
    filtered.forEach(player => {
      if (!grouped[player.divisionId]) {
        grouped[player.divisionId] = {
          divisionId: player.divisionId,
          divisionName: player.divisionName,
          players: []
        };
      }
      grouped[player.divisionId].players.push(player);
    });
    return Object.values(grouped);
  };

  // Unit Management functions
  const loadUnits = async () => {
    setLoadingUnits(true);
    try {
      const response = await tournamentApi.getEventUnits(eventId);
      if (response.success) {
        // Group units by division
        const grouped = {};
        (response.data || []).forEach(unit => {
          if (unit.status === 'Cancelled') return;
          const divId = unit.divisionId;
          // Skip units without a valid divisionId
          if (!divId) return;
          if (!grouped[divId]) {
            // Try to get division name from event data if not in unit
            const divisionFromEvent = event?.divisions?.find(d => d.id === divId);
            grouped[divId] = {
              divisionId: divId,
              divisionName: unit.divisionName || divisionFromEvent?.name || '',
              units: []
            };
          }
          grouped[divId].units.push(unit);
        });
        setUnitsData(grouped);
      } else {
        toast.error(response.message || 'Failed to load units');
      }
    } catch (err) {
      console.error('Error loading units:', err);
      toast.error('Failed to load units');
    } finally {
      setLoadingUnits(false);
    }
  };

  const loadJoinRequests = async () => {
    setLoadingJoinRequests(true);
    try {
      const response = await tournamentApi.getEventJoinRequests(eventId);
      if (response.success) {
        setJoinRequests(response.data?.pendingRequests || []);
      } else {
        toast.error(response.message || 'Failed to load join requests');
      }
    } catch (err) {
      console.error('Error loading join requests:', err);
      toast.error('Failed to load join requests');
    } finally {
      setLoadingJoinRequests(false);
    }
  };

  const handleRespondToJoinRequest = async (requestId, accept) => {
    setRespondingToRequest(requestId);
    try {
      const response = await tournamentApi.respondToJoinRequest(requestId, accept);
      if (response.success) {
        toast.success(accept ? 'Join request accepted' : 'Join request declined');
        // Refresh join requests and dashboard
        loadJoinRequests();
        loadDashboard(true);
      } else {
        toast.error(response.message || 'Failed to respond to join request');
      }
    } catch (err) {
      console.error('Error responding to join request:', err);
      toast.error('Failed to respond to join request');
    } finally {
      setRespondingToRequest(null);
    }
  };

  const loadEventFeeTypes = async () => {
    try {
      const response = await tournamentApi.getEventFeeTypes(eventId);
      if (response.success) {
        setEventFeeTypes(response.data || []);
      }
    } catch (err) {
      console.error('Error loading fee types:', err);
    }
  };

  const handleExportRegistrations = async () => {
    setExportingRegistrations(true);
    try {
      const response = await tournamentApi.exportRegistrations(eventId);
      const blob = new Blob([response], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Registrations_${eventId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Registrations exported');
    } catch (err) {
      console.error('Error exporting registrations:', err);
      toast.error('Failed to export registrations');
    } finally {
      setExportingRegistrations(false);
    }
  };

  const handleExportPayments = async () => {
    setExportingPayments(true);
    try {
      const filters = {
        searchName: paymentSearchName || undefined,
        paymentStatus: paymentStatusFilter || undefined,
        divisionId: paymentDivisionFilter || undefined,
        paymentMethod: paymentMethodFilter || undefined
      };
      const response = await tournamentApi.exportPayments(eventId, filters);
      const blob = new Blob([response], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payments_${eventId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Payments exported');
    } catch (err) {
      console.error('Error exporting payments:', err);
      toast.error('Failed to export payments');
    } finally {
      setExportingPayments(false);
    }
  };

  const validateRegistrations = async () => {
    setLoadingValidation(true);
    try {
      const response = await tournamentApi.validateRegistrations(eventId);
      if (response.success) {
        setValidationResults(response.data);
        setShowValidationModal(true);
      } else {
        toast.error(response.message || 'Failed to validate registrations');
      }
    } catch (err) {
      console.error('Error validating registrations:', err);
      toast.error('Failed to validate registrations');
    } finally {
      setLoadingValidation(false);
    }
  };

  const handleBreakUnit = async (unit) => {
    if (!confirm(`Break "${unit.name}" apart? Each member will become their own registration.`)) return;
    setProcessingUnitAction({ unitId: unit.id, action: 'break' });
    try {
      const response = await tournamentApi.adminBreakUnit(unit.id);
      if (response.success) {
        toast.success('Unit broken apart - members now have individual registrations');
        loadUnits();
        loadDashboard();
      } else {
        toast.error(response.message || 'Failed to break unit');
      }
    } catch (err) {
      console.error('Error breaking unit:', err);
      toast.error(err.message || 'Failed to break unit');
    } finally {
      setProcessingUnitAction(null);
    }
  };

  const handleMergeUnits = async () => {
    if (selectedUnitsForMerge.length !== 2) {
      toast.error('Select exactly 2 units to merge');
      return;
    }
    const [target, source] = selectedUnitsForMerge;
    if (target.divisionId !== source.divisionId) {
      toast.error('Units must be in the same division to merge');
      return;
    }
    if (!confirm(`Merge "${source.name}" into "${target.name}"? Members from the second unit will join the first.`)) return;

    setProcessingUnitAction({ unitId: target.id, action: 'merge' });
    try {
      const response = await tournamentApi.mergeRegistrations(eventId, target.id, source.id);
      if (response.success) {
        toast.success('Units merged successfully');
        setSelectedUnitsForMerge([]);
        loadUnits();
        loadDashboard();
      } else {
        toast.error(response.message || 'Failed to merge units');
      }
    } catch (err) {
      console.error('Error merging units:', err);
      toast.error(err.message || 'Failed to merge units');
    } finally {
      setProcessingUnitAction(null);
    }
  };

  const handleMoveUnitToDivision = async (unit, newDivisionId) => {
    if (!confirm(`Move "${unit.name}" to a different division? Fees will be adjusted if possible.`)) return;
    setProcessingUnitAction({ unitId: unit.id, action: 'move' });
    try {
      const response = await tournamentApi.moveRegistration(eventId, unit.id, newDivisionId);
      if (response.success) {
        const feeWarning = response.message?.includes('Warning') ? ' ' + response.message : '';
        toast.success('Unit moved to new division.' + feeWarning);
        setMovingUnitToDivision(null);
        loadUnits();
        loadDashboard();
      } else {
        toast.error(response.message || 'Failed to move unit');
      }
    } catch (err) {
      console.error('Error moving unit:', err);
      toast.error(err.message || 'Failed to move unit');
    } finally {
      setProcessingUnitAction(null);
    }
  };

  const handleRemoveMember = async (unit, member, forceRemove = false) => {
    const acceptedCount = unit.members?.filter(m => m.inviteStatus === 'Accepted').length || 0;
    const isLastMember = acceptedCount <= 1;
    
    // Only show initial confirmation if not a force removal
    if (!forceRemove) {
      const confirmMessage = isLastMember
        ? `Cancel registration for ${member.firstName} ${member.lastName}? This will remove the entire registration.`
        : `Remove ${member.firstName} ${member.lastName} from "${unit.name}"?`;

      if (!confirm(confirmMessage)) return;
    }
    
    setProcessingUnitAction({ unitId: unit.id, action: 'remove-member' });
    try {
      const response = await tournamentApi.removeRegistration(eventId, unit.id, member.userId, forceRemove);
      if (response.success) {
        toast.success(isLastMember ? 'Registration cancelled' : 'Member removed from unit');
        loadUnits();
        loadDashboard();
        loadCheckIns();
      } else {
        // Check if this is a payment warning that can be force-overridden
        if (response.message?.includes('payment') && !forceRemove) {
          const forceConfirm = confirm(
            `${response.message}\n\nClick OK to confirm removal, or Cancel to abort.`
          );
          if (forceConfirm) {
            setProcessingUnitAction(null);
            return handleRemoveMember(unit, member, true);
          }
        } else {
          toast.error(response.message || 'Failed to remove member');
        }
      }
    } catch (err) {
      console.error('Error removing member:', err);
      toast.error(err.message || 'Failed to remove member');
    } finally {
      setProcessingUnitAction(null);
    }
  };

  const toggleUnitForMerge = (unit) => {
    setSelectedUnitsForMerge(prev => {
      const exists = prev.find(u => u.id === unit.id);
      if (exists) {
        return prev.filter(u => u.id !== unit.id);
      }
      if (prev.length >= 2) {
        return [prev[1], unit]; // Replace oldest selection
      }
      return [...prev, unit];
    });
  };

  const getUnitsByDivision = () => {
    if (!unitsData) return [];
    // Filter out divisions without a valid divisionId or name, and with no units
    const allDivisions = Object.values(unitsData).filter(d => d.units.length > 0 && d.divisionId && d.divisionName);
    if (registrationDivisionFilter === 'all') return allDivisions;
    return allDivisions.filter(d => d.divisionId === parseInt(registrationDivisionFilter));
  };

  // Payment Management functions
  const loadPaymentSummary = async (filters = {}) => {
    setLoadingPayments(true);
    try {
      // Build filter params from state or passed filters
      const filterParams = {
        searchName: (filters.searchName !== undefined ? filters.searchName : paymentSearchName) || undefined,
        paymentStatus: (filters.paymentStatus !== undefined ? filters.paymentStatus : paymentStatusFilter) || undefined,
        divisionId: filters.divisionId !== undefined ? filters.divisionId : (paymentDivisionFilter ? parseInt(paymentDivisionFilter) : undefined),
        paymentMethod: (filters.paymentMethod !== undefined ? filters.paymentMethod : paymentMethodFilter) || undefined,
      };

      // Remove undefined values
      Object.keys(filterParams).forEach(key => {
        if (filterParams[key] === undefined || filterParams[key] === '') {
          delete filterParams[key];
        }
      });

      const response = await tournamentApi.getPaymentSummary(eventId, filterParams);
      if (response.success) {
        setPaymentSummary(response.data);
      } else {
        toast.error(response.message || 'Failed to load payments');
      }
    } catch (err) {
      console.error('Error loading payments:', err);
      toast.error('Failed to load payments');
    } finally {
      setLoadingPayments(false);
    }
  };

  // Debounced payment search
  const handlePaymentSearchChange = (value) => {
    setPaymentSearchName(value);
    // Debounce the actual search
    const timeoutId = setTimeout(() => {
      loadPaymentSummary({ searchName: value });
    }, 300);
    return () => clearTimeout(timeoutId);
  };

  // Handle payment filter changes
  const handlePaymentFilterChange = (filterType, value) => {
    switch (filterType) {
      case 'status':
        setPaymentStatusFilter(value);
        loadPaymentSummary({ paymentStatus: value });
        break;
      case 'division':
        setPaymentDivisionFilter(value);
        loadPaymentSummary({ divisionId: value ? parseInt(value) : undefined });
        break;
      case 'method':
        setPaymentMethodFilter(value);
        loadPaymentSummary({ paymentMethod: value });
        break;
    }
  };

  // Clear all payment filters
  const clearPaymentFilters = () => {
    setPaymentSearchName('');
    setPaymentStatusFilter('');
    setPaymentDivisionFilter('');
    setPaymentMethodFilter('');
    loadPaymentSummary({
      searchName: '',
      paymentStatus: '',
      divisionId: undefined,
      paymentMethod: ''
    });
  };

  const handleVerifyPayment = async (paymentId) => {
    setVerifyingPayment(paymentId);
    try {
      const response = await tournamentApi.verifyPayment(paymentId);
      if (response.success) {
        toast.success('Payment verified');
        loadPaymentSummary();
      } else {
        toast.error(response.message || 'Failed to verify payment');
      }
    } catch (err) {
      console.error('Error verifying payment:', err);
      toast.error('Failed to verify payment');
    } finally {
      setVerifyingPayment(null);
    }
  };

  const handleUnverifyPayment = async (paymentId) => {
    if (!confirm('Unverify this payment? The payment will be marked as pending again.')) return;
    setVerifyingPayment(paymentId);
    try {
      const response = await tournamentApi.unverifyPayment(paymentId);
      if (response.success) {
        toast.success('Payment unverified');
        loadPaymentSummary();
      } else {
        toast.error(response.message || 'Failed to unverify payment');
      }
    } catch (err) {
      console.error('Error unverifying payment:', err);
      toast.error('Failed to unverify payment');
    } finally {
      setVerifyingPayment(null);
    }
  };

  // Fetch applicable registrations for a payment
  const handleOpenApplyPayment = async (paymentId) => {
    setApplyingPayment(paymentId);
    setSelectedRegistrations([]);
    setRegistrationsToUnapply([]);
    setShowAllPlayers(false);
    setApplyPlayerSearch('');
    try {
      const response = await tournamentApi.getApplicableRegistrations(paymentId);
      if (response.success) {
        setApplicableRegistrations(response.data);
        // Auto-select unpaid registrations from payer only
        const unpaidMemberIds = response.data.registrations
          .filter(r => !r.hasPaid && !r.alreadyLinkedToThisPayment)
          .map(r => r.memberId);
        setSelectedRegistrations(unpaidMemberIds);
      } else {
        toast.error(response.message || 'Failed to load registrations');
        setApplyingPayment(null);
      }
    } catch (err) {
      console.error('Error loading applicable registrations:', err);
      toast.error('Failed to load registrations');
      setApplyingPayment(null);
    }
  };

  // Refresh applicable registrations with filters
  const refreshApplicableRegistrations = async (includeAll, search) => {
    if (!applyingPayment) return;
    try {
      const response = await tournamentApi.getApplicableRegistrations(applyingPayment, { 
        includeAllPlayers: includeAll, 
        search: search || undefined 
      });
      if (response.success) {
        // Preserve payment info but update registrations
        setApplicableRegistrations(prev => ({
          ...prev,
          registrations: response.data.registrations
        }));
      }
    } catch (err) {
      console.error('Error refreshing registrations:', err);
    }
  };

  // Apply/unapply payment to selected registrations
  const handleApplyPayment = async () => {
    if (selectedRegistrations.length === 0 && registrationsToUnapply.length === 0) {
      toast.error('Please select at least one registration to apply or remove');
      return;
    }
    try {
      let applySuccess = true;
      let unapplySuccess = true;
      
      // First, unapply from any registrations that were unchecked
      if (registrationsToUnapply.length > 0) {
        const unapplyResponse = await tournamentApi.unapplyPaymentFromRegistrations(applyingPayment, registrationsToUnapply);
        unapplySuccess = unapplyResponse.success;
        if (!unapplySuccess) {
          toast.error(unapplyResponse.message || 'Failed to remove payment from some registrations');
        }
      }
      
      // Then, apply to newly selected registrations
      if (selectedRegistrations.length > 0) {
        const applyResponse = await tournamentApi.applyPaymentToRegistrations(applyingPayment, selectedRegistrations);
        applySuccess = applyResponse.success;
        if (!applySuccess) {
          toast.error(applyResponse.message || 'Failed to apply payment');
        }
      }
      
      if (applySuccess && unapplySuccess) {
        const actions = [];
        if (selectedRegistrations.length > 0) actions.push(`applied to ${selectedRegistrations.length}`);
        if (registrationsToUnapply.length > 0) actions.push(`removed from ${registrationsToUnapply.length}`);
        toast.success(`Payment ${actions.join(' and ')} registration(s)`);
      }
      
      setApplyingPayment(null);
      setApplicableRegistrations(null);
      setSelectedRegistrations([]);
      setRegistrationsToUnapply([]);
      loadPaymentSummary();
    } catch (err) {
      console.error('Error applying payment:', err);
      toast.error('Failed to apply payment');
    }
  };

  const handleOverrideRank = async (unitId, poolRank) => {
    try {
      const response = await gameDayApi.overrideRank(unitId, { poolRank });
      if (response.success) {
        toast.success('Rank updated');
        setEditingRank(null);
        loadSchedule(selectedDivision.id);
      } else {
        toast.error(response.message || 'Failed to update rank');
      }
    } catch (err) {
      console.error('Error updating rank:', err);
      toast.error('Failed to update rank');
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!confirm(`Are you sure you want to change tournament status to "${newStatus}"?`)) return;

    setUpdatingStatus(true);
    try {
      const response = await tournamentApi.updateTournamentStatus(eventId, newStatus);
      if (response.success) {
        loadDashboard();
        loadEvent();
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleOpenScheduleConfig = (division) => {
    setScheduleConfigModal({ isOpen: true, division });
  };

  const handleResetTournament = async () => {
    if (!confirm('Are you sure you want to reset all tournament data?\n\nThis will clear:\n• Drawing results (unit numbers, pools, seeds)\n• All game scores and statuses\n• Court assignments\n\nThe schedule structure will be preserved.\n\nThis action cannot be undone.')) {
      return;
    }

    try {
      const response = await tournamentApi.resetTournament(eventId);
      if (response.success) {
        toast.success(response.message || 'Tournament reset successfully');
        loadDashboard();
        if (selectedDivision?.id) {
          loadSchedule(selectedDivision.id);
        }
      } else {
        toast.error(response.message || 'Failed to reset tournament');
      }
    } catch (err) {
      console.error('Error resetting tournament:', err);
      toast.error('Failed to reset tournament');
    }
  };

  const handleGenerateSchedule = async (config) => {
    const division = scheduleConfigModal.division;
    if (!division) return;

    // If template was applied via TemplateSelector, just refresh and close
    if (config.templateApplied) {
      toast.success('Template applied successfully!');
      loadDashboard();
      setScheduleConfigModal({ isOpen: false, division: null });
      if (selectedDivision?.id === division.id) {
        setSelectedDivision({ ...selectedDivision, scheduleReady: true });
        loadSchedule(division.id);
      }
      return;
    }

    setGeneratingSchedule(true);
    try {
      const response = await tournamentApi.generateSchedule(division.id, {
        divisionId: division.id,
        scheduleType: config.scheduleType,
        targetUnits: config.targetUnits,
        poolCount: config.poolCount,
        bestOf: config.bestOf,
        playoffFromPools: config.playoffFromPools
      });
      if (response.success) {
        loadDashboard();
        setScheduleConfigModal({ isOpen: false, division: null });
        // Update selected division if this is the one
        if (selectedDivision?.id === division.id) {
          setSelectedDivision({ ...selectedDivision, scheduleReady: true });
          loadSchedule(division.id);
        }
      } else {
        alert(response.message || 'Failed to generate schedule');
      }
    } catch (err) {
      console.error('Error generating schedule:', err);
      alert('Failed to generate schedule');
    } finally {
      setGeneratingSchedule(false);
    }
  };

  const handleAssignUnitNumbers = async (divisionId) => {
    if (!confirm('Assign random unit numbers to all teams? This is typically done before revealing the schedule.')) return;

    setAssigningNumbers(true);
    try {
      const response = await tournamentApi.assignUnitNumbers(divisionId);
      if (response.success) {
        loadDashboard();
      } else {
        alert(response.message || 'Failed to assign numbers');
      }
    } catch (err) {
      console.error('Error assigning numbers:', err);
    } finally {
      setAssigningNumbers(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link to="/events" className="text-orange-600 hover:underline">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const isOrganizer = event?.organizedByUserId === user?.id || user?.role === 'Admin';
  const statusColors = {
    Draft: 'bg-gray-100 text-gray-700',
    RegistrationOpen: 'bg-green-100 text-green-700',
    RegistrationClosed: 'bg-yellow-100 text-yellow-700',
    ScheduleReady: 'bg-blue-100 text-blue-700',
    Drawing: 'bg-orange-100 text-orange-700',
    Running: 'bg-purple-100 text-purple-700',
    Completed: 'bg-gray-100 text-gray-700',
    Cancelled: 'bg-red-100 text-red-700'
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/events" className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              {/* Event logo/image - links to event detail */}
              {event?.posterImageUrl && (
                <Link to={`/event/${eventId}`} className="shrink-0">
                  <img
                    src={getSharedAssetUrl(event.posterImageUrl)}
                    alt={event.name || 'Event'}
                    className="w-12 h-12 rounded-lg object-cover hover:opacity-80 transition-opacity"
                  />
                </Link>
              )}
              <div>
                <Link to={`/event/${eventId}`} className="hover:text-orange-600 transition-colors">
                  <h1 className="text-xl font-bold text-gray-900">{dashboard?.eventName || 'Tournament'}</h1>
                </Link>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[dashboard?.tournamentStatus] || 'bg-gray-100 text-gray-700'}`}>
                    {dashboard?.tournamentStatus?.replace(/([A-Z])/g, ' $1').trim() || 'Unknown'}
                  </span>
                  {event && (
                    <span className="text-sm text-gray-500">
                      {formatDate(event.startDate)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Status-based action buttons */}
              {(dashboard?.tournamentStatus === 'Draft' || dashboard?.tournamentStatus === 'RegistrationOpen') && (
                <Link
                  to={`/event/${eventId}`}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium text-sm flex items-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  Register for Event
                </Link>
              )}
              {dashboard?.tournamentStatus === 'Drawing' && (
                <Link
                  to={`/event/${eventId}/drawing`}
                  className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${
                    isOrganizer
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-orange-600 text-white hover:bg-orange-700'
                  }`}
                >
                  {isOrganizer ? (
                    <>
                      <Settings className="w-4 h-4" />
                      Manage Drawing
                    </>
                  ) : (
                    <>
                      <div className="relative">
                        <Radio className="w-4 h-4" />
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-400 rounded-full animate-ping" />
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-400 rounded-full" />
                      </div>
                      Live Drawing
                    </>
                  )}
                </Link>
              )}
              {(dashboard?.tournamentStatus === 'Running' || dashboard?.tournamentStatus === 'Started') && (
                <Link
                  to={isOrganizer
                    ? `/tournament/${eventId}/manage`
                    : `/event/${eventId}/gameday`
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center gap-2"
                >
                  {isOrganizer ? (
                    <>
                      <ClipboardList className="w-4 h-4" />
                      Admin Dashboard
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Dashboard
                    </>
                  )}
                </Link>
              )}

              {/* Send Notification link - organizers only */}
              {isOrganizer && (
                <Link
                  to={`/event/${eventId}/notifications`}
                  className="px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm flex items-center gap-2"
                  title="Send Notification"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Notify</span>
                </Link>
              )}

              {/* Game Day Live link - organizers only */}
              {isOrganizer && (dashboard?.tournamentStatus === 'Running' || dashboard?.tournamentStatus === 'Started' || dashboard?.divisions?.some(d => d.totalMatches > 0)) && (
                <Link
                  to={`/tournament/${eventId}/gameday`}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm flex items-center gap-2"
                  title="Game Day Live"
                >
                  <Radio className="w-4 h-4" />
                  <span className="hidden sm:inline">Game Day</span>
                </Link>
              )}

              {/* Status dropdown - organizers only */}
              {isOrganizer && (
                <select
                  value={dashboard?.tournamentStatus || ''}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  disabled={updatingStatus}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="Draft">Draft</option>
                  <option value="RegistrationOpen">Registration Open</option>
                  <option value="RegistrationClosed">Registration Closed</option>
                  <option value="ScheduleReady">Schedule Ready</option>
                  <option value="Drawing">Drawing</option>
                  <option value="Running">Running</option>
                  <option value="Completed">Completed</option>
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs - organized by workflow */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Tab Groups */}
          <div className="flex border-b border-gray-200 mb-2">
            {[
              { key: 'preplanning', label: 'Pre-Planning', icon: '📋' },
              { key: 'gameday', label: 'Game Day Execution', icon: '🎮' }
            ].map(tabGroup => (
              <button
                key={tabGroup.key}
                onClick={() => {
                  setMainTab(tabGroup.key);
                  // Set default sub-tab when switching main tabs
                  if (tabGroup.key === 'preplanning') {
                    setActiveTab('eventinfo');
                  } else if (tabGroup.key === 'gameday') {
                    setActiveTab('overview');
                  }
                }}
                className={`px-6 py-3 font-semibold text-sm transition-colors ${
                  mainTab === tabGroup.key
                    ? 'border-b-2 border-orange-600 text-orange-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="mr-2">{tabGroup.icon}</span>
                {tabGroup.label}
              </button>
            ))}
          </div>

          {/* Sub-tabs based on main tab selection */}
          <div className="flex overflow-x-auto">
            <div className="flex">
              {/* Pre-Planning sub-tabs */}
              {mainTab === 'preplanning' ? (
                [
                  { key: 'eventinfo', label: 'Event Info' },
                  { key: 'divisions', label: 'Divisions' },
                  { key: 'courts', label: 'Courts' },
                  { key: 'registrations', label: 'Registrations', badge: dashboard?.stats?.pendingJoinRequests },
                  { key: 'payments', label: 'Payments' },
                  { key: 'documents', label: 'Documents' },
                  { key: 'staff', label: 'Staff' },
                  { key: 'planning', label: 'Planning' }
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key);
                      if (tab.key === 'staff' && staffList.length === 0) {
                        loadStaff();
                      }
                      if (tab.key === 'payments' && !paymentSummary) {
                        loadPaymentSummary();
                      }
                      if (tab.key === 'courts' && courtGroups.length === 0) {
                        loadCourtGroups();
                      }
                      if (tab.key === 'registrations') {
                        loadJoinRequests();
                      }
                      if (tab.key === 'documents' && documents.length === 0) {
                        loadDocuments();
                        loadAssetTypes();
                      }
                      if (tab.key === 'planning' && courtGroups.length === 0) {
                        loadCourtGroups();
                      }
                    }}
                    className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap relative ${
                      activeTab === tab.key
                        ? 'border-orange-600 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                    {tab.badge > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <>
                  {/* Left tabs */}
                  {[
                    { key: 'overview', label: 'Overview' },
                    { key: 'checkin', label: 'Check-in' },
                    { key: 'schedule', label: 'Schedule' },
                    { key: 'bycourt', label: 'By Court' }
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => {
                        setActiveTab(tab.key);
                        if (tab.key === 'checkin' && !checkInData) {
                          loadCheckIns();
                        }
                      }}
                      className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === tab.key
                          ? 'border-orange-600 text-orange-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                  {/* Spacer */}
                  <div className="flex-1" />
                  {/* Right tabs */}
                  {[
                    { key: 'scoring', label: 'Scoring' },
                    { key: 'gamedayexec', label: 'Game Day' }
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === tab.key
                          ? 'border-orange-600 text-orange-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Event Info Tab */}
        {activeTab === 'eventinfo' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Event Information</h2>
              <div className="flex items-center gap-3">
                {hasUnsavedChanges && (
                  <span className="text-sm text-orange-600">Unsaved changes</span>
                )}
                <button
                  onClick={handleSaveEvent}
                  disabled={savingEvent || !hasUnsavedChanges}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingEvent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </div>

            {/* Basic Details */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-500" />
                Basic Details
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                  <input
                    type="text"
                    value={editForm.name || ''}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editForm.description || ''}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                    <select
                      value={editForm.eventTypeId || ''}
                      onChange={(e) => handleFormChange('eventTypeId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">Select type...</option>
                      {eventTypes.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-6 pt-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.isPublished || false}
                        onChange={(e) => handleFormChange('isPublished', e.target.checked)}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-700">Published</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.isPrivate || false}
                        onChange={(e) => handleFormChange('isPrivate', e.target.checked)}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-700">Private</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Venue & Location */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-gray-500" />
                Venue & Location
              </h3>
              <div className="space-y-4">
                <VenuePicker
                  value={editForm.venueId ? { id: editForm.venueId, name: editForm.venueName, city: editForm.city, state: editForm.state } : null}
                  onChange={(venue) => {
                    if (venue) {
                      handleFormChange('venueId', venue.id);
                      handleFormChange('venueName', venue.name);
                      handleFormChange('address', venue.address);
                      handleFormChange('city', venue.city);
                      handleFormChange('state', venue.state);
                      handleFormChange('country', venue.country);
                    } else {
                      handleFormChange('venueId', '');
                    }
                  }}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Venue Name (if not listed)</label>
                    <input
                      type="text"
                      value={editForm.venueName || ''}
                      onChange={(e) => handleFormChange('venueName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                      placeholder="Custom venue name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={editForm.address || ''}
                      onChange={(e) => handleFormChange('address', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={editForm.city || ''}
                      onChange={(e) => handleFormChange('city', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={editForm.state || ''}
                      onChange={(e) => handleFormChange('state', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <input
                      type="text"
                      value={editForm.country || ''}
                      onChange={(e) => handleFormChange('country', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dates & Times */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-500" />
                Dates & Times
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Start</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={editForm.startDate || ''}
                      onChange={(e) => handleFormChange('startDate', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    />
                    <input
                      type="time"
                      value={editForm.startTime || ''}
                      onChange={(e) => handleFormChange('startTime', e.target.value)}
                      className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event End</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={editForm.endDate || ''}
                      onChange={(e) => handleFormChange('endDate', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    />
                    <input
                      type="time"
                      value={editForm.endTime || ''}
                      onChange={(e) => handleFormChange('endTime', e.target.value)}
                      className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registration Opens</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={editForm.registrationOpenDate || ''}
                      onChange={(e) => handleFormChange('registrationOpenDate', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    />
                    <input
                      type="time"
                      value={editForm.registrationOpenTime || ''}
                      onChange={(e) => handleFormChange('registrationOpenTime', e.target.value)}
                      className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registration Closes</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={editForm.registrationCloseDate || ''}
                      onChange={(e) => handleFormChange('registrationCloseDate', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    />
                    <input
                      type="time"
                      value={editForm.registrationCloseTime || ''}
                      onChange={(e) => handleFormChange('registrationCloseTime', e.target.value)}
                      className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Fees */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-gray-500" />
                Registration Fees
              </h3>

              {/* Fee Types */}
              <div>
                <EventFeeTypesEditor
                  eventId={parseInt(eventId)}
                  onFeeTypesChange={() => loadDashboard()}
                />
              </div>

              {/* Event Fee Options */}
              <div className="mt-4">
                <EventFeesEditor
                  eventId={parseInt(eventId)}
                  onFeesChange={() => loadDashboard()}
                />
              </div>
            </div>

            {/* Logo & Banner */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Image className="w-5 h-5 text-gray-500" />
                Logo & Banner Images
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Event Logo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Event Logo</label>
                  {editForm.posterImageUrl ? (
                    <div className="space-y-2">
                      <div
                        className="relative cursor-crosshair"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = ((e.clientX - rect.left) / rect.width) * 100;
                          const y = ((e.clientY - rect.top) / rect.height) * 100;
                          handleFormChange('posterFocusX', Math.round(x));
                          handleFormChange('posterFocusY', Math.round(y));
                        }}
                      >
                        <img
                          src={getSharedAssetUrl(editForm.posterImageUrl)}
                          alt="Event Logo"
                          className="w-full h-48 object-contain bg-gray-50 rounded-lg border border-gray-200"
                        />
                        {/* Focus point indicator */}
                        <div
                          className="absolute w-6 h-6 -ml-3 -mt-3 pointer-events-none"
                          style={{
                            left: `${editForm.posterFocusX || 50}%`,
                            top: `${editForm.posterFocusY || 50}%`
                          }}
                        >
                          <div className="w-full h-full rounded-full border-2 border-orange-500 bg-orange-500/30">
                            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-orange-500 -translate-y-1/2" />
                            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-orange-500 -translate-x-1/2" />
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleFormChange('posterImageUrl', ''); }}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 text-center">
                        Click on image to set focus point ({Math.round(editForm.posterFocusX || 50)}%, {Math.round(editForm.posterFocusY || 50)}%)
                      </p>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex flex-col items-center justify-center py-4">
                        {uploadingLogo ? (
                          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-500">Click to upload logo</p>
                            <p className="text-xs text-gray-400 mt-1">JPG, PNG, GIF, WebP (max 5MB)</p>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={uploadingLogo}
                      />
                    </label>
                  )}
                </div>

                {/* Event Banner */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Event Banner</label>
                  {editForm.bannerImageUrl ? (
                    <div className="space-y-2">
                      <div
                        className="relative cursor-crosshair"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = ((e.clientX - rect.left) / rect.width) * 100;
                          const y = ((e.clientY - rect.top) / rect.height) * 100;
                          handleFormChange('bannerFocusX', Math.round(x));
                          handleFormChange('bannerFocusY', Math.round(y));
                        }}
                      >
                        <img
                          src={getSharedAssetUrl(editForm.bannerImageUrl)}
                          alt="Event Banner"
                          className="w-full h-48 object-cover bg-gray-50 rounded-lg border border-gray-200"
                        />
                        {/* Focus point indicator */}
                        <div
                          className="absolute w-6 h-6 -ml-3 -mt-3 pointer-events-none"
                          style={{
                            left: `${editForm.bannerFocusX || 50}%`,
                            top: `${editForm.bannerFocusY || 50}%`
                          }}
                        >
                          <div className="w-full h-full rounded-full border-2 border-orange-500 bg-orange-500/30">
                            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-orange-500 -translate-y-1/2" />
                            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-orange-500 -translate-x-1/2" />
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleFormChange('bannerImageUrl', ''); }}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 text-center">
                        Click on image to set focus point ({Math.round(editForm.bannerFocusX || 50)}%, {Math.round(editForm.bannerFocusY || 50)}%)
                      </p>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex flex-col items-center justify-center py-4">
                        {uploadingBanner ? (
                          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-500">Click to upload banner</p>
                            <p className="text-xs text-gray-400 mt-1">JPG, PNG, GIF, WebP (max 10MB)</p>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleBannerUpload}
                        disabled={uploadingBanner}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-gray-500" />
                Contact Information
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <User className="w-4 h-4 inline mr-1" />
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={editForm.contactName || ''}
                      onChange={(e) => handleFormChange('contactName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                      placeholder="Tournament Director"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Mail className="w-4 h-4 inline mr-1" />
                      Contact Email
                    </label>
                    <input
                      type="email"
                      value={editForm.contactEmail || ''}
                      onChange={(e) => handleFormChange('contactEmail', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                      placeholder="contact@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Phone className="w-4 h-4 inline mr-1" />
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={editForm.contactPhone || ''}
                      onChange={(e) => handleFormChange('contactPhone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    Payment Instructions
                  </label>
                  <textarea
                    value={editForm.paymentInstructions || ''}
                    onChange={(e) => handleFormChange('paymentInstructions', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter payment instructions (e.g., Venmo: @username, Zelle: email@example.com)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This will be shown to players on the registration/payment page.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Users className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {dashboard?.stats?.totalRegistrations || 0}
                    </div>
                    <div className="text-sm text-gray-500">Registered</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Check className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {dashboard?.stats?.checkedInPlayers || 0}
                    </div>
                    <div className="text-sm text-gray-500">Checked In</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Target className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {dashboard?.stats?.completedMatches || 0} / {dashboard?.stats?.totalMatches || 0}
                    </div>
                    <div className="text-sm text-gray-500">Matches</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <MapPin className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {dashboard?.stats?.inUseCourts || 0} / {dashboard?.stats?.availableCourts + dashboard?.stats?.inUseCourts || 0}
                    </div>
                    <div className="text-sm text-gray-500">Courts in Use</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Summary */}
            {(dashboard?.stats?.totalAmountDue > 0 || dashboard?.stats?.paymentsSubmitted > 0) && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  Payment Summary
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-orange-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-orange-600">
                      {dashboard?.stats?.paymentsSubmitted || 0}
                    </div>
                    <div className="text-sm text-gray-600">Payments Submitted</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-green-600">
                      {dashboard?.stats?.paymentsPaid || 0}
                    </div>
                    <div className="text-sm text-gray-600">Verified Paid</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-yellow-600">
                      {dashboard?.stats?.paymentsPending || 0}
                    </div>
                    <div className="text-sm text-gray-600">Pending</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-blue-600">
                      ${(dashboard?.stats?.totalAmountPaid || 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">
                      of ${(dashboard?.stats?.totalAmountDue || 0).toFixed(2)} Collected
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Division Summary - show all divisions */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Division Status</h2>
              <div className="space-y-4">
                {(!dashboard?.divisions || dashboard.divisions.length === 0) ? (
                  <p className="text-sm text-gray-500">No divisions created yet.</p>
                ) : (
                  dashboard.divisions.map(div => (
                    <div key={div.id} className={`border rounded-lg p-4 ${div.registeredUnits === 0 ? 'border-dashed border-gray-300 bg-gray-50' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{div.name}</h3>
                          <div className="flex gap-4 text-sm text-gray-500 mt-1">
                            <span>{div.registeredUnits} / {div.maxUnits || '∞'} teams</span>
                            {div.waitlistedUnits > 0 && (
                              <span className="text-yellow-600">+{div.waitlistedUnits} waitlisted</span>
                            )}
                            {div.registeredUnits > 0 && (
                              <>
                                <span>{div.totalMatches} matches</span>
                                <span>{div.totalGames} games</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {div.registeredUnits === 0 ? (
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">
                              No Registrations
                            </span>
                          ) : div.scheduleReady ? (
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                              Schedule Ready
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                              No Schedule
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Progress bar */}
                      {div.totalMatches > 0 && (
                        <div className="mt-3">
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-500 transition-all"
                              style={{ width: `${(div.completedMatches / div.totalMatches) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Court Status */}
            {dashboard?.courts?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Court Status</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {dashboard.courts.map(court => (
                    <div
                      key={court.id}
                      className={`border rounded-lg p-4 ${
                        court.status === 'InUse' ? 'border-orange-300 bg-orange-50' :
                        court.status === 'Available' ? 'border-green-300 bg-green-50' :
                        'border-gray-200'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{court.courtLabel}</div>
                      <div className={`text-sm ${
                        court.status === 'InUse' ? 'text-orange-600' :
                        court.status === 'Available' ? 'text-green-600' :
                        'text-gray-500'
                      }`}>
                        {court.status}
                      </div>
                      {court.currentGame && (
                        <div className="text-xs text-gray-500 mt-1">
                          Game #{court.currentGame.gameNumber}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Divisions Tab - show all divisions for organizers */}
        {activeTab === 'divisions' && (
          <div className="space-y-6">
            {/* Reset Tournament Button - for testing/dry runs */}
            {isOrganizer && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-yellow-800">Testing Mode</h3>
                    <p className="text-xs text-yellow-600 mt-1">
                      Reset all tournament data (drawings, scores, court assignments) while keeping schedule structure.
                    </p>
                  </div>
                  <button
                    onClick={handleResetTournament}
                    className="px-4 py-2 text-sm font-medium text-yellow-800 bg-yellow-100 border border-yellow-300 rounded-lg hover:bg-yellow-200 flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reset Tournament
                  </button>
                </div>
              </div>
            )}

            {/* Add Division Button */}
            {isOrganizer && (
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Tournament Divisions</h2>
                <div className="flex items-center gap-2">
                  <Link
                    to="/my-templates"
                    className="px-4 py-2 text-sm font-medium text-purple-600 border border-purple-300 rounded-lg hover:bg-purple-50 flex items-center gap-2"
                    title="Create or manage your own phase templates"
                  >
                    <Layers className="w-4 h-4" />
                    My Templates
                  </Link>
                  <Link
                    to={`/tournament/${eventId}/schedules`}
                    className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    View All Schedules
                  </Link>
                  <button
                    onClick={handleOpenAddDivision}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Division
                  </button>
                </div>
              </div>
            )}

            {/* Show message if no divisions exist */}
            {(!dashboard?.divisions || dashboard.divisions.length === 0) && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                <Layers className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Divisions Created</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Create divisions to organize your tournament by skill level, age group, or format.
                </p>
                {isOrganizer && (
                  <button
                    onClick={handleOpenAddDivision}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Division
                  </button>
                )}
              </div>
            )}

            {dashboard?.divisions?.map(div => (
              <div key={div.id} className={`bg-white rounded-xl shadow-sm p-6 ${!div.isActive ? 'opacity-60 border-2 border-dashed border-gray-300' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-gray-900">{div.name}</h2>
                      {!div.isActive && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-600 rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {div.registeredUnits} teams registered
                      {div.scheduleReady && div.totalMatches > 0 && (
                        <span className="ml-2">• {div.totalMatches} matches scheduled</span>
                      )}
                    </p>
                  </div>
                  {isOrganizer && (
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {/* Edit Division */}
                      <button
                        onClick={() => handleOpenEditDivision(div)}
                        className="px-3 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 flex items-center gap-2"
                        title="Edit division settings"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>

                      {/* Toggle Active Status */}
                      <button
                        onClick={() => handleToggleDivisionActive(div)}
                        className={`px-3 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${
                          div.isActive
                            ? 'text-gray-600 border border-gray-300 hover:bg-gray-50'
                            : 'text-green-700 border border-green-300 bg-green-50 hover:bg-green-100'
                        }`}
                        title={div.isActive ? 'Deactivate division' : 'Activate division'}
                      >
                        {div.isActive ? <Eye className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {div.isActive ? 'Active' : 'Activate'}
                      </button>

                      {/* Schedule Button Group - Phases, Formats, Court Time */}
                      {div.isActive && (
                        <div className="relative">
                          <button
                            onClick={() => setScheduleDropdownOpen(scheduleDropdownOpen === div.id ? null : div.id)}
                            className="px-3 py-2 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 flex items-center gap-2"
                          >
                            <Calendar className="w-4 h-4" />
                            Schedule
                            <ChevronDown className={`w-4 h-4 transition-transform ${scheduleDropdownOpen === div.id ? 'rotate-180' : ''}`} />
                          </button>
                          {scheduleDropdownOpen === div.id && (
                            <>
                              {/* Click-away overlay */}
                              <div className="fixed inset-0 z-10" onClick={() => setScheduleDropdownOpen(null)} />
                              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                              <button
                                onClick={() => {
                                  handleOpenScheduleConfig(div);
                                  setScheduleDropdownOpen(null);
                                }}
                                disabled={generatingSchedule}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                              >
                                <Layers className="w-4 h-4" />
                                Phases
                                {!div.scheduleReady && <span className="ml-auto text-xs text-orange-500">Setup</span>}
                              </button>
                              <button
                                onClick={() => {
                                  setGameSettingsModal({ isOpen: true, division: div });
                                  setScheduleDropdownOpen(null);
                                }}
                                disabled={!div.scheduleReady}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:text-gray-400"
                              >
                                <Settings className="w-4 h-4" />
                                Formats
                                {!div.scheduleReady && <span className="ml-auto text-xs text-gray-400">Need phases</span>}
                              </button>
                              <Link
                                to={`/tournament/${eventId}/schedule-dashboard`}
                                onClick={() => setScheduleDropdownOpen(null)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Clock className="w-4 h-4" />
                                Court Time
                              </Link>
                            </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* View Schedule - links to printable schedule page */}
                      {div.isActive && div.scheduleReady && (
                        <Link
                          to={`/event/${eventId}/division/${div.id}/schedule`}
                          className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View Schedule
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                {/* Status indicators */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {div.scheduleReady ? (
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Schedule Ready
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                      No Schedule
                    </span>
                  )}

                  {div.unitsAssigned ? (
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
                      <Shuffle className="w-3 h-3" />
                      Units Assigned
                    </span>
                  ) : div.scheduleReady && (
                    <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                      Awaiting Draw
                    </span>
                  )}

                  {div.registeredUnits > 0 && (
                    <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {div.registeredUnits} units
                    </span>
                  )}
                </div>

                {/* Progress or status message */}
                {div.registeredUnits === 0 ? (
                  <p className="text-gray-500 text-center py-4 mt-4 bg-gray-50 rounded-lg">
                    No teams registered yet
                  </p>
                ) : div.scheduleReady ? (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Match Progress</span>
                      <span>{div.completedMatches} / {div.totalMatches}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 transition-all"
                        style={{ width: `${div.totalMatches > 0 ? (div.completedMatches / div.totalMatches) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mt-4">
                    Configure and generate a schedule to begin tournament play
                  </p>
                )}

                {/* Phase Diagram Toggle */}
                {div.scheduleReady && (
                  <div className="mt-4 border-t pt-4">
                    <button
                      onClick={() => togglePhaseDiagram(div.id)}
                      className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700"
                    >
                      <Layers className="w-4 h-4" />
                      {expandedPhaseDiagrams.has(div.id) ? 'Hide' : 'Show'} Phase Structure
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedPhaseDiagrams.has(div.id) ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {expandedPhaseDiagrams.has(div.id) && (
                      <div className="mt-3">
                        {divisionPhaseData[div.id]?.phases?.length > 0 ? (
                          <PhaseFlowDiagram 
                            phases={divisionPhaseData[div.id].phases}
                            structureJson={divisionPhaseData[div.id].structureJson}
                          />
                        ) : (
                          <div className="h-32 flex items-center justify-center text-gray-400">
                            <Loader2 className="w-5 h-5 animate-spin" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Courts Tab */}
        {activeTab === 'courts' && (
          <div className="space-y-6">
            {/* Court Groups Management */}
            {isOrganizer && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-600" />
                    Court Groups ({courtGroups.length})
                  </h3>
                </div>

                {/* Create New Group */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="New group name..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateCourtGroup()}
                  />
                  <button
                    onClick={handleCreateCourtGroup}
                    disabled={creatingGroup || !newGroupName.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {creatingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add Group
                  </button>
                </div>

                {/* Court Groups List */}
                {courtGroups.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4 bg-gray-50 rounded-lg">
                    No court groups yet. Create groups to organize courts by location.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {courtGroups.map(group => (
                      <div key={group.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div
                          className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                          onClick={() => setExpandedGroupId(expandedGroupId === group.id ? null : group.id)}
                        >
                          <div className="flex items-center gap-3">
                            {expandedGroupId === group.id ? (
                              <ChevronUp className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            )}
                            <span className="font-medium text-gray-900">{group.groupName}</span>
                            <span className="text-sm text-gray-500">({group.courts?.length || 0} courts)</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCourtGroup(group.id);
                            }}
                            disabled={deletingGroupId === group.id}
                            className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title="Delete group"
                          >
                            {deletingGroupId === group.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        {expandedGroupId === group.id && (
                          <div className="p-4 bg-white border-t border-gray-200">
                            {/* Courts in this group */}
                            {group.courts?.length > 0 ? (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {group.courts.map(court => (
                                  <div
                                    key={court.id}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm"
                                  >
                                    <span>{court.courtLabel}</span>
                                    <button
                                      onClick={() => handleRemoveCourtFromGroup(group.id, court.id)}
                                      className="text-blue-500 hover:text-red-600"
                                      title="Remove from group"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-500 text-sm mb-3">No courts assigned to this group</p>
                            )}

                            {/* Add court to this group */}
                            {dashboard?.courts?.length > 0 && (
                              <div className="flex items-center gap-2">
                                <select
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleAddCourtToGroup(group.id, parseInt(e.target.value));
                                      e.target.value = '';
                                    }
                                  }}
                                  defaultValue=""
                                >
                                  <option value="">Add court to this group...</option>
                                  {dashboard.courts
                                    .filter(c => !(group.courts || []).some(gc => gc.id === c.id))
                                    .map(court => (
                                      <option key={court.id} value={court.id}>
                                        {court.courtLabel}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Unassigned Courts */}
                {getUnassignedCourts().length > 0 && courtGroups.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Unassigned Courts ({getUnassignedCourts().length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {getUnassignedCourts().map(court => (
                        <div
                          key={court.id}
                          className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm"
                        >
                          <span>{court.courtLabel}</span>
                          <select
                            className="text-xs border-none bg-transparent text-blue-600 cursor-pointer focus:ring-0"
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAddCourtToGroup(parseInt(e.target.value), court.id);
                              }
                            }}
                            defaultValue=""
                          >
                            <option value="">→ Add to...</option>
                            {courtGroups.map(group => (
                              <option key={group.id} value={group.id}>
                                {group.groupName}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-gray-900">Tournament Courts</h2>
                {mapAsset && (() => {
                  const url = mapAsset.fileUrl?.toLowerCase() || '';
                  const isImage = url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png') || url.endsWith('.gif') || url.endsWith('.webp') || (mapAsset.fileType && mapAsset.fileType.startsWith('image/'));
                  return isImage ? (
                    <button
                      onClick={() => setShowMapModal(true)}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <Map className="w-4 h-4" />
                      View Court Map
                    </button>
                  ) : (
                    <a
                      href={getSharedAssetUrl(mapAsset.fileUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <Map className="w-4 h-4" />
                      View Court Map
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    loadDashboard();
                    if (selectedDivision?.scheduleReady) {
                      loadSchedule(selectedDivision.id);
                    }
                  }}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  title="Refresh courts"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                {isOrganizer && (
                  <button
                    onClick={async () => {
                      setLoadingSuggestion(true);
                      try {
                        const response = await gameDayApi.suggestNextGame(eventId);
                        if (response.success && response.data) {
                          setSuggestedGame(response.data);
                        } else {
                          toast.info(response.message || 'No games available to suggest');
                        }
                      } catch (err) {
                        toast.error('Failed to get suggestion');
                      } finally {
                        setLoadingSuggestion(false);
                      }
                    }}
                    disabled={loadingSuggestion}
                    className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    {loadingSuggestion ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Lightbulb className="w-4 h-4" />
                    )}
                    Suggest Next
                  </button>
                )}
                {isOrganizer && (
                  <button
                    onClick={() => setShowAddCourtsModal(true)}
                    className="px-3 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Courts
                  </button>
                )}
              </div>
            </div>

            {/* Suggested Game Card */}
            {suggestedGame && (
              <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Lightbulb className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Suggested Next Game</h4>
                      <p className="text-sm text-blue-700 mt-0.5">{suggestedGame.reason}</p>
                      <div className="mt-2 p-3 bg-white rounded-lg border border-blue-100">
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {suggestedGame.unit1Players} vs {suggestedGame.unit2Players}
                        </div>
                        <div className="text-xs text-gray-500">
                          {suggestedGame.divisionName} • {suggestedGame.poolName} • Match #{suggestedGame.matchNumber}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {dashboard?.courts?.filter(c => c.status === 'Available').length > 0 && suggestedGame.gameId && (
                      <select
                        onChange={async (e) => {
                          const courtId = parseInt(e.target.value);
                          if (courtId) {
                            try {
                              await gameDayApi.queueGame(suggestedGame.gameId, courtId);
                              toast.success('Game queued to court');
                              setSuggestedGame(null);
                              loadDashboard();
                            } catch (err) {
                              toast.error('Failed to queue game');
                            }
                          }
                        }}
                        className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                        defaultValue=""
                      >
                        <option value="" disabled>Queue to court...</option>
                        {dashboard?.courts?.filter(c => c.status === 'Available').map(c => (
                          <option key={c.id} value={c.id}>{c.courtLabel}</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => setSuggestedGame(null)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {dashboard?.courts?.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Courts Configured</h3>
                <p className="text-gray-500 mb-4">Add courts to start assigning games</p>
                {isOrganizer && (
                  <button
                    onClick={() => setShowAddCourtsModal(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Courts
                  </button>
                )}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboard?.courts?.map(court => {
                  // Helper to format time elapsed
                  const formatTimeElapsed = (startTime) => {
                    if (!startTime) return '';
                    const start = new Date(startTime);
                    const now = new Date();
                    const diffMs = now - start;
                    const diffMins = Math.floor(diffMs / 60000);
                    if (diffMins < 1) return 'Just started';
                    if (diffMins < 60) return `${diffMins}m`;
                    const hours = Math.floor(diffMins / 60);
                    const mins = diffMins % 60;
                    return `${hours}h ${mins}m`;
                  };

                  return (
                    <div key={court.id} className="bg-white rounded-xl shadow-sm p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-gray-900">{court.courtLabel}</h3>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            court.status === 'InUse' ? 'bg-orange-100 text-orange-700' :
                            court.status === 'Available' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {court.status}
                          </span>
                          {isOrganizer && (
                            <button
                              onClick={() => handleEditCourt(court)}
                              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                              title="Edit court"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Current Game */}
                      {court.currentGame ? (
                        <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-orange-700 uppercase">Current Game</span>
                            <div className="flex items-center gap-2">
                              {court.currentGame.startedAt && (
                                <span className="text-xs text-orange-600 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatTimeElapsed(court.currentGame.startedAt)}
                                </span>
                              )}
                              {isOrganizer && (
                                <button
                                  onClick={() => setSelectedGameForEdit({
                                    id: court.currentGame.gameId,
                                    encounterId: court.currentGame.encounterId || court.currentGame.matchId,
                                    unit1Score: court.currentGame.unit1Score || 0,
                                    unit2Score: court.currentGame.unit2Score || 0,
                                    tournamentCourtId: court.id,
                                    status: court.currentGame.status || 'Playing',
                                    unit1: { id: court.currentGame.unit1Id, name: court.currentGame.unit1Name || court.currentGame.unit1Players },
                                    unit2: { id: court.currentGame.unit2Id, name: court.currentGame.unit2Name || court.currentGame.unit2Players },
                                    bestOf: 1,
                                    hasGames: true
                                  })}
                                  className="text-xs text-orange-700 hover:text-orange-800 flex items-center gap-1"
                                  title="Edit score"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  Edit
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="text-sm font-medium text-gray-900">
                            {court.currentGame.unit1Players || 'TBD'} vs {court.currentGame.unit2Players || 'TBD'}
                          </div>
                          {court.currentGame.unit1Score !== null && court.currentGame.unit2Score !== null && (
                            <div className="text-sm text-gray-600 mt-1">
                              Score: {court.currentGame.unit1Score} - {court.currentGame.unit2Score}
                            </div>
                          )}
                          {court.currentGame.divisionName && (
                            <div className="text-xs text-gray-500 mt-1">
                              {court.currentGame.divisionName} • {court.currentGame.roundName || `Game ${court.currentGame.gameNumber}`}
                            </div>
                          )}
                        </div>
                      ) : court.status === 'Available' ? (
                        <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <span className="text-sm text-gray-500">No game in progress</span>
                        </div>
                      ) : null}

                      {/* Next Game */}
                      {court.nextGame && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-blue-700 uppercase">Next Game</span>
                            <div className="flex items-center gap-2">
                              {court.nextGame.queuedAt && (
                                <span className="text-xs text-blue-600 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Queued {formatTimeElapsed(court.nextGame.queuedAt)}
                                </span>
                              )}
                              {isOrganizer && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await gameDayApi.startGame(court.nextGame.gameId);
                                      loadDashboard();
                                      toast.success('Game started');
                                    } catch (err) {
                                      toast.error('Failed to start game');
                                    }
                                  }}
                                  className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 flex items-center gap-1"
                                  title="Start game"
                                >
                                  <Play className="w-3 h-3" />
                                  Start
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="text-sm font-medium text-gray-900">
                            {court.nextGame.unit1Players || 'TBD'} vs {court.nextGame.unit2Players || 'TBD'}
                          </div>
                          {court.nextGame.divisionName && (
                            <div className="text-xs text-gray-500 mt-1">
                              {court.nextGame.divisionName} • {court.nextGame.roundName || `Game ${court.nextGame.gameNumber}`}
                            </div>
                          )}
                        </div>
                      )}

                      {court.locationDescription && (
                        <p className="text-xs text-gray-500 mt-2">{court.locationDescription}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Add Courts Modal */}
        {showAddCourtsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-sm w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Courts</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Courts
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={numberOfCourts}
                  onChange={(e) => setNumberOfCourts(e.target.value)}
                  placeholder="Enter number (1-100)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-500">
                  Courts will be labeled "Court 1", "Court 2", etc.
                  {dashboard?.courts?.length > 0 && ` (starting from Court ${dashboard.courts.length + 1})`}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleAddCourts}
                  disabled={addingCourts || !numberOfCourts}
                  className="flex-1 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {addingCourts ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Add Courts
                </button>
                <button
                  onClick={() => {
                    setShowAddCourtsModal(false);
                    setNumberOfCourts('');
                  }}
                  disabled={addingCourts}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Court Modal */}
        {editingCourt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-sm w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Court</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Court Name
                  </label>
                  <input
                    type="text"
                    value={editCourtForm.label}
                    onChange={(e) => setEditCourtForm(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="Court name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editCourtForm.status}
                    onChange={(e) => setEditCourtForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="Available">Available</option>
                    <option value="InUse">In Use</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveCourt}
                  disabled={savingCourt || !editCourtForm.label}
                  className="flex-1 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {savingCourt ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save
                </button>
                <button
                  onClick={() => handleDeleteCourt(editingCourt.id)}
                  disabled={savingCourt}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50"
                >
                  Delete
                </button>
                <button
                  onClick={() => setEditingCourt(null)}
                  disabled={savingCourt}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Match Schedule</h2>
              <button
                onClick={() => {
                  loadDashboard();
                  if (selectedDivision?.scheduleReady) {
                    loadSchedule(selectedDivision.id);
                  }
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <RefreshCw className={`w-5 h-5 ${loadingSchedule ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Division selector - only show divisions with registrations */}
            {(() => {
              const divisionsWithRegs = dashboard?.divisions?.filter(d => d.registeredUnits > 0) || [];
              return divisionsWithRegs.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {divisionsWithRegs.map(div => (
                    <button
                      key={div.id}
                      onClick={() => setSelectedDivision(div)}
                      className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap ${
                        selectedDivision?.id === div.id
                          ? 'bg-orange-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {div.name}
                    </button>
                  ))}
                </div>
              );
            })()}

            {selectedDivision?.scheduleReady ? (
              loadingSchedule ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                </div>
              ) : schedule ? (
                <div className="space-y-6">
                  {/* Drawing Results - Collapsible */}
                  {schedule.poolStandings?.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <button
                        onClick={() => setDrawingResultsCollapsed(!drawingResultsCollapsed)}
                        className="w-full px-4 py-3 bg-gray-50 border-b flex items-center justify-between hover:bg-gray-100 transition-colors"
                      >
                        <h3 className="font-medium text-gray-900 flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-orange-500" />
                          Drawing Results
                          <span className="text-sm font-normal text-gray-500">
                            ({schedule.poolStandings.reduce((total, pool) => total + (pool.standings?.length || 0), 0)} teams in {schedule.poolStandings.length} pool{schedule.poolStandings.length > 1 ? 's' : ''})
                          </span>
                        </h3>
                        {drawingResultsCollapsed ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      {!drawingResultsCollapsed && (
                        <div className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {schedule.poolStandings.map((pool, poolIdx) => (
                              <div key={pool.poolNumber ?? `pool-${poolIdx}`} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                {pool.poolName && (
                                  <h4 className="font-semibold text-gray-800 mb-3">{pool.poolName}</h4>
                                )}
                                <div className="space-y-2">
                                  {pool.standings?.map((entry, entryIdx) => (
                                    <div key={entry.unitNumber ?? `entry-${entryIdx}`} className="flex items-start gap-2 text-sm">
                                      <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-orange-500 text-white font-bold rounded">
                                        {entry.unitNumber}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <div className="font-medium text-gray-900">{entry.unitName}</div>
                                        {entry.members && entry.members.length > 0 && (
                                          <div className="flex flex-wrap gap-2 mt-1">
                                            {entry.members.map((member, memberIdx) => (
                                              <button
                                                key={member.userId ?? `member-${memberIdx}`}
                                                onClick={() => setProfileModalUserId(member.userId)}
                                                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-orange-600 transition-colors"
                                                title={`View ${member.firstName} ${member.lastName}'s profile`}
                                              >
                                                {member.profileImageUrl ? (
                                                  <img
                                                    src={getSharedAssetUrl(member.profileImageUrl)}
                                                    alt=""
                                                    className="w-5 h-5 rounded-full object-cover border border-gray-200"
                                                  />
                                                ) : (
                                                  <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                                                    <User className="w-3 h-3 text-gray-400" />
                                                  </div>
                                                )}
                                                <span className="hover:underline">
                                                  {member.firstName} {member.lastName}
                                                </span>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                        {/* Fallback: Show players string if members array not available */}
                                        {(!entry.members || entry.members.length === 0) && entry.players && (
                                          <div className="text-xs text-gray-500 mt-0.5">{entry.players}</div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pool Play Rounds */}
                  {schedule.rounds?.filter(r => r.roundType === 'Pool').length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b">
                        <h3 className="font-medium text-gray-900 flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-blue-500" />
                          Pool Play Schedule
                        </h3>
                      </div>
                      <div className="divide-y">
                        {schedule.rounds.filter(r => r.roundType === 'Pool').map((round, roundIdx) => (
                          <div key={roundIdx}>
                            <div className="px-4 py-2 bg-gray-100 text-sm font-medium text-gray-700">
                              {round.roundName || `Pool Round ${round.roundNumber}`}
                            </div>
                            {round.matches?.filter(m => !m.isBye).map((match, matchIdx) => (
                              <div key={matchIdx} className="p-4 border-t border-gray-100">
                                {/* Scheduled time and court info */}
                                {(match.scheduledTime || match.courtLabel) && (
                                  <div className="flex items-center gap-3 mb-2 text-sm">
                                    {match.scheduledTime && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                                        <Clock className="w-3 h-3" />
                                        {new Date(match.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    )}
                                    {match.courtLabel && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded">
                                        <MapPin className="w-3 h-3" />
                                        {match.courtLabel}
                                      </span>
                                    )}
                                  </div>
                                )}
                                <div className="flex items-center gap-3">
                                  {/* Edit button on far left */}
                                  <button
                                    onClick={() => setSelectedGameForEdit({
                                      id: match.games?.[0]?.gameId || match.games?.[0]?.id || match.encounterId,
                                      encounterId: match.encounterId,
                                      ...(match.games?.[0] || {}),
                                      unit1: { id: match.unit1Id, name: match.unit1Name || match.unit1SeedInfo, members: match.unit1Members || [] },
                                      unit2: { id: match.unit2Id, name: match.unit2Name || match.unit2SeedInfo, members: match.unit2Members || [] },
                                      unit1Score: match.games?.[0]?.unit1Score ?? match.unit1Score ?? 0,
                                      unit2Score: match.games?.[0]?.unit2Score ?? match.unit2Score ?? 0,
                                      bestOf: match.bestOf || 1,
                                      matchNumber: match.matchNumber,
                                      status: match.games?.[0]?.status || match.status || 'New',
                                      games: match.games || [],
                                      courtLabel: match.courtLabel,
                                      winnerUnitId: match.winnerUnitId,
                                      hasGames: match.games?.length > 0
                                    })}
                                    className="p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors"
                                    title="Edit match"
                                  >
                                    <Edit2 className="w-5 h-5" />
                                  </button>
                                  <div className="text-sm text-gray-400 w-8">#{match.matchNumber}</div>
                                  <div className="flex-1 grid grid-cols-3 gap-4 items-center">
                                    <div className={`text-right flex items-center justify-end gap-2 ${match.winnerName === match.unit1Name ? 'font-semibold text-green-600' : ''}`}>
                                      {match.unit1Number && (
                                        <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-700 font-semibold rounded text-xs">
                                          {match.unit1Number}
                                        </span>
                                      )}
                                      <span className={match.unit1Name ? 'text-gray-900' : 'text-gray-600'}>
                                        {match.unit1Name || match.unit1SeedInfo || (match.unit1Number ? `Unit #${match.unit1Number}` : '')}
                                      </span>
                                    </div>
                                    <div className="text-center">
                                      {match.score ? (
                                        <span className="font-medium text-gray-700">{match.score}</span>
                                      ) : (
                                        <span className="text-gray-400">vs</span>
                                      )}
                                    </div>
                                    <div className={`flex items-center gap-2 ${match.winnerName === match.unit2Name ? 'font-semibold text-green-600' : ''}`}>
                                      {match.unit2Number && (
                                        <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-700 font-semibold rounded text-xs">
                                          {match.unit2Number}
                                        </span>
                                      )}
                                      <span className={match.unit2Name ? 'text-gray-900' : 'text-gray-600'}>
                                        {match.unit2Name || match.unit2SeedInfo || (match.unit2Number ? `Unit #${match.unit2Number}` : '')}
                                      </span>
                                    </div>
                                  </div>
                                  {/* Court pre-assignment */}
                                  <select
                                    value={match.courtId || ''}
                                    onChange={async (e) => {
                                      const courtId = e.target.value ? parseInt(e.target.value) : null;
                                      try {
                                        await tournamentApi.preAssignCourt(match.encounterId, courtId);
                                        toast.success(courtId ? 'Court assigned' : 'Court unassigned');
                                        loadSchedule(selectedDivision?.id);
                                      } catch (err) {
                                        toast.error('Failed to assign court');
                                      }
                                    }}
                                    className="px-2 py-1 text-xs border border-gray-200 rounded bg-white min-w-[80px]"
                                    title="Pre-assign court"
                                  >
                                    <option value="">No Court</option>
                                    {dashboard?.courts?.map(c => (
                                      <option key={c.id} value={c.id}>{c.courtLabel}</option>
                                    ))}
                                  </select>
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    match.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                    match.status === 'InProgress' ? 'bg-orange-100 text-orange-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {match.status || 'Scheduled'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Playoff/Bracket Rounds */}
                  {schedule.rounds?.filter(r => r.roundType === 'Bracket' || r.roundType === 'ThirdPlace').length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <div className="px-4 py-3 bg-yellow-50 border-b">
                        <h3 className="font-medium text-gray-900 flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-yellow-500" />
                          Playoff Bracket
                          {schedule.playoffFromPools && (
                            <span className="text-sm font-normal text-gray-500">
                              (Top {schedule.playoffFromPools} from each pool advance)
                            </span>
                          )}
                        </h3>
                      </div>
                      <div className="divide-y">
                        {schedule.rounds.filter(r => r.roundType === 'Bracket' || r.roundType === 'ThirdPlace').map((round, roundIdx) => (
                          <div key={roundIdx}>
                            <div className={`px-4 py-2 text-sm font-medium text-gray-700 ${
                              round.roundType === 'ThirdPlace' ? 'bg-amber-50' : 'bg-yellow-100'
                            }`}>
                              {round.roundType === 'ThirdPlace' ? '🥉 ' : ''}
                              {round.roundName || `Playoff Round ${round.roundNumber}`}
                            </div>
                            {round.matches?.map((match, matchIdx) => (
                              <div key={matchIdx} className="p-4 border-t border-gray-100">
                                {/* Scheduled time and court info */}
                                {!match.isBye && (match.scheduledTime || match.courtLabel) && (
                                  <div className="flex items-center gap-3 mb-2 text-sm">
                                    {match.scheduledTime && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                                        <Clock className="w-3 h-3" />
                                        {new Date(match.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    )}
                                    {match.courtLabel && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded">
                                        <MapPin className="w-3 h-3" />
                                        {match.courtLabel}
                                      </span>
                                    )}
                                  </div>
                                )}
                                <div className="flex items-center gap-3">
                                  {/* Edit button on far left */}
                                  {!match.isBye && (
                                    <button
                                      onClick={() => setSelectedGameForEdit({
                                        id: match.games?.[0]?.gameId || match.games?.[0]?.id || match.encounterId,
                                        encounterId: match.encounterId,
                                        ...(match.games?.[0] || {}),
                                        unit1: { id: match.unit1Id, name: match.unit1Name || match.unit1SeedInfo, members: match.unit1Members || [] },
                                        unit2: { id: match.unit2Id, name: match.unit2Name || match.unit2SeedInfo, members: match.unit2Members || [] },
                                        unit1Score: match.games?.[0]?.unit1Score ?? match.unit1Score ?? 0,
                                        unit2Score: match.games?.[0]?.unit2Score ?? match.unit2Score ?? 0,
                                        bestOf: match.bestOf || 1,
                                        matchNumber: match.matchNumber,
                                        status: match.games?.[0]?.status || match.status || 'New',
                                        games: match.games || [],
                                        courtLabel: match.courtLabel,
                                        winnerUnitId: match.winnerUnitId,
                                        hasGames: match.games?.length > 0
                                      })}
                                      className="p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors"
                                      title="Edit match"
                                    >
                                      <Edit2 className="w-5 h-5" />
                                    </button>
                                  )}
                                  {match.isBye && <div className="w-9" />}
                                  <div className="text-sm text-gray-400 w-8">#{match.matchNumber}</div>
                                  <div className="flex-1 grid grid-cols-3 gap-4 items-center">
                                    <div className={`text-right flex items-center justify-end gap-2 ${match.winnerName === match.unit1Name ? 'font-semibold text-green-600' : ''}`}>
                                      {match.isBye && !match.unit1Name ? (
                                        <span className="italic text-gray-400">BYE</span>
                                      ) : (
                                        <>
                                          {match.unit1Number && (
                                            <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-700 font-semibold rounded text-xs">
                                              {match.unit1Number}
                                            </span>
                                          )}
                                          <span className={match.unit1Name ? 'text-gray-900' : 'text-blue-600 font-medium'}>
                                            {match.unit1Name || match.unit1SeedInfo || (match.unit1Number ? `Unit #${match.unit1Number}` : '')}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    <div className="text-center">
                                      {match.isBye ? (
                                        <span className="text-gray-300">—</span>
                                      ) : match.score ? (
                                        <span className="font-medium text-gray-700">{match.score}</span>
                                      ) : (
                                        <span className="text-gray-400">vs</span>
                                      )}
                                    </div>
                                    <div className={`flex items-center gap-2 ${match.winnerName === match.unit2Name ? 'font-semibold text-green-600' : ''}`}>
                                      {match.isBye && !match.unit2Name ? (
                                        <span className="italic text-gray-400">BYE</span>
                                      ) : (
                                        <>
                                          {match.unit2Number && (
                                            <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-700 font-semibold rounded text-xs">
                                              {match.unit2Number}
                                            </span>
                                          )}
                                          <span className={match.unit2Name ? 'text-gray-900' : 'text-blue-600 font-medium'}>
                                            {match.unit2Name || match.unit2SeedInfo || (match.unit2Number ? `Unit #${match.unit2Number}` : '')}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  {/* Court pre-assignment */}
                                  {!match.isBye && (
                                    <select
                                      value={match.courtId || ''}
                                      onChange={async (e) => {
                                        const courtId = e.target.value ? parseInt(e.target.value) : null;
                                        try {
                                          await tournamentApi.preAssignCourt(match.encounterId, courtId);
                                          toast.success(courtId ? 'Court assigned' : 'Court unassigned');
                                          loadSchedule(selectedDivision?.id);
                                        } catch (err) {
                                          toast.error('Failed to assign court');
                                        }
                                      }}
                                      className="px-2 py-1 text-xs border border-gray-200 rounded bg-white min-w-[80px]"
                                      title="Pre-assign court"
                                    >
                                      <option value="">No Court</option>
                                      {dashboard?.courts?.map(c => (
                                        <option key={c.id} value={c.id}>{c.courtLabel}</option>
                                      ))}
                                    </select>
                                  )}
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    match.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                    match.status === 'InProgress' ? 'bg-orange-100 text-orange-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {match.status || 'Scheduled'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Other Round Types (not Pool, Bracket, or ThirdPlace) */}
                  {schedule.rounds?.filter(r => r.roundType !== 'Pool' && r.roundType !== 'Bracket' && r.roundType !== 'ThirdPlace').map((round, roundIdx) => (
                    <div key={roundIdx} className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b">
                        <h3 className="font-medium text-gray-900">
                          {round.roundName || `${round.roundType} - Round ${round.roundNumber}`}
                        </h3>
                      </div>
                      <div className="divide-y">
                        {round.matches?.map((match, matchIdx) => (
                          <div key={matchIdx} className="p-4">
                            <div className="flex items-center gap-3">
                              {/* Edit button on far left */}
                              {!match.isBye && (
                                <button
                                  onClick={() => setSelectedGameForEdit({
                                    id: match.games?.[0]?.gameId || match.games?.[0]?.id || match.encounterId,
                                    encounterId: match.encounterId,
                                    ...(match.games?.[0] || {}),
                                    unit1: { id: match.unit1Id, name: match.unit1Name || match.unit1SeedInfo, members: match.unit1Members || [] },
                                    unit2: { id: match.unit2Id, name: match.unit2Name || match.unit2SeedInfo, members: match.unit2Members || [] },
                                    unit1Score: match.games?.[0]?.unit1Score ?? match.unit1Score ?? 0,
                                    unit2Score: match.games?.[0]?.unit2Score ?? match.unit2Score ?? 0,
                                    bestOf: match.bestOf || 1,
                                    matchNumber: match.matchNumber,
                                    status: match.games?.[0]?.status || match.status || 'New',
                                    games: match.games || [],
                                    courtLabel: match.courtLabel,
                                    winnerUnitId: match.winnerUnitId,
                                    hasGames: match.games?.length > 0
                                  })}
                                  className="p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors"
                                  title="Edit match"
                                >
                                  <Edit2 className="w-5 h-5" />
                                </button>
                              )}
                              {match.isBye && <div className="w-9" />}
                              <div className="text-sm text-gray-400 w-8">#{match.matchNumber}</div>
                              <div className="flex-1 grid grid-cols-3 gap-4 items-center">
                                <div className={`text-right flex items-center justify-end gap-2 ${match.winnerName === match.unit1Name ? 'font-semibold text-green-600' : ''}`}>
                                  {match.isBye && !match.unit1Name ? (
                                    <span className="italic text-gray-400">BYE</span>
                                  ) : (
                                    <>
                                      {match.unit1Number && (
                                        <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-700 font-semibold rounded text-xs">
                                          {match.unit1Number}
                                        </span>
                                      )}
                                      <span className={match.unit1Name ? 'text-gray-900' : 'text-blue-600 font-medium'}>
                                        {match.unit1Name || match.unit1SeedInfo || (match.unit1Number ? `Unit #${match.unit1Number}` : '')}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <div className="text-center">
                                  {match.isBye ? (
                                    <span className="text-gray-300">—</span>
                                  ) : match.score ? (
                                    <span className="font-medium text-gray-700">{match.score}</span>
                                  ) : (
                                    <span className="text-gray-400">vs</span>
                                  )}
                                </div>
                                <div className={`flex items-center gap-2 ${match.winnerName === match.unit2Name ? 'font-semibold text-green-600' : ''}`}>
                                  {match.isBye && !match.unit2Name ? (
                                    <span className="italic text-gray-400">BYE</span>
                                  ) : (
                                    <>
                                      {match.unit2Number && (
                                        <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-700 font-semibold rounded text-xs">
                                          {match.unit2Number}
                                        </span>
                                      )}
                                      <span className={match.unit2Name ? 'text-gray-900' : 'text-blue-600 font-medium'}>
                                        {match.unit2Name || match.unit2SeedInfo || (match.unit2Number ? `Unit #${match.unit2Number}` : '')}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              {/* Court pre-assignment */}
                              {!match.isBye && (
                                <select
                                  value={match.courtId || ''}
                                  onChange={async (e) => {
                                    const courtId = e.target.value ? parseInt(e.target.value) : null;
                                    try {
                                      await tournamentApi.preAssignCourt(match.encounterId, courtId);
                                      toast.success(courtId ? 'Court assigned' : 'Court unassigned');
                                      loadSchedule(selectedDivision?.id);
                                    } catch (err) {
                                      toast.error('Failed to assign court');
                                    }
                                  }}
                                  className="px-2 py-1 text-xs border border-gray-200 rounded bg-white min-w-[80px]"
                                  title="Pre-assign court"
                                >
                                  <option value="">No Court</option>
                                  {dashboard?.courts?.map(c => (
                                    <option key={c.id} value={c.id}>{c.courtLabel}</option>
                                  ))}
                                </select>
                              )}
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                match.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                match.status === 'InProgress' ? 'bg-orange-100 text-orange-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {match.status || 'Scheduled'}
                              </span>
                            </div>
                            {match.courtLabel && (
                              <div className="mt-2 ml-12 text-sm text-gray-500 flex items-center gap-2">
                                <MapPin className="w-3 h-3" />
                                {match.courtLabel}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Pool Standings Management */}
                  {schedule.poolStandings?.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">Pool Standings</h3>
                          {selectedDivision?.scheduleStatus === 'PoolsFinalized' && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              Finalized
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Download scoresheet button - always available */}
                          <button
                            onClick={handleDownloadSchedule}
                            disabled={downloadingStandings}
                            className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {downloadingStandings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            Excel
                          </button>
                          {isOrganizer && (
                            <>
                              {selectedDivision?.scheduleStatus !== 'PoolsFinalized' ? (
                                <>
                                  <button
                                    onClick={handleCalculateRankings}
                                    disabled={calculatingRankings}
                                    className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50"
                                  >
                                    {calculatingRankings ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                    Calculate Rankings
                                  </button>
                                  <button
                                    onClick={handleFinalizePools}
                                    disabled={finalizingPools}
                                    className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-1.5 disabled:opacity-50"
                                  >
                                    {finalizingPools ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                                    Finalize & Advance
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={handleResetPools}
                                  className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 flex items-center gap-1.5"
                                >
                                  <Unlock className="w-4 h-4" />
                                  Reset Finalization
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Advancement Info */}
                      {selectedDivision?.playoffFromPools && selectedDivision?.scheduleStatus !== 'PoolsFinalized' && (
                        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-sm text-blue-700 flex items-center gap-2">
                          <ArrowRight className="w-4 h-4" />
                          Top {selectedDivision.playoffFromPools} from each pool will advance to playoffs
                        </div>
                      )}

                      {/* View Toggle */}
                      <div className="px-4 py-2 border-b flex items-center gap-2">
                        <span className="text-sm text-gray-500">View:</span>
                        <button
                          onClick={() => setStandingsViewMode('grouped')}
                          className={`px-3 py-1 text-sm rounded-lg ${standingsViewMode === 'grouped' ? 'bg-orange-100 text-orange-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                          By Pool
                        </button>
                        <button
                          onClick={() => setStandingsViewMode('flat')}
                          className={`px-3 py-1 text-sm rounded-lg ${standingsViewMode === 'flat' ? 'bg-orange-100 text-orange-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                          All Teams
                        </button>
                      </div>

                      {standingsViewMode === 'flat' ? (
                        /* Flat view - all teams in one table with pool column */
                        <div className="p-4">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="text-gray-500 border-b bg-gray-50">
                                <tr>
                                  <th
                                    className="text-left py-2 px-2 cursor-pointer hover:bg-gray-100"
                                    onClick={() => setStandingsSortBy(standingsSortBy === 'pool' ? 'pool-desc' : 'pool')}
                                    title="Sort by Pool"
                                  >
                                    Pool {standingsSortBy.startsWith('pool') && (standingsSortBy === 'pool' ? '↑' : '↓')}
                                  </th>
                                  <th
                                    className="text-left py-2 px-2 cursor-pointer hover:bg-gray-100"
                                    onClick={() => setStandingsSortBy(standingsSortBy === 'rank' ? 'rank-desc' : 'rank')}
                                    title="Sort by Rank"
                                  >
                                    # {standingsSortBy.startsWith('rank') && (standingsSortBy === 'rank' ? '↑' : '↓')}
                                  </th>
                                  <th className="text-left py-2 px-2">Team</th>
                                  <th
                                    className="text-center py-2 px-2 cursor-pointer hover:bg-gray-100"
                                    onClick={() => setStandingsSortBy(standingsSortBy === 'matchesWon' ? 'matchesWon-desc' : 'matchesWon')}
                                    title="Sort by Matches Won"
                                  >
                                    MW {standingsSortBy.startsWith('matchesWon') && (standingsSortBy === 'matchesWon-desc' ? '↓' : '↑')}
                                  </th>
                                  <th className="text-center py-2 px-2" title="Matches Lost">ML</th>
                                  <th className="text-center py-2 px-2" title="Games Won">GW</th>
                                  <th className="text-center py-2 px-2" title="Games Lost">GL</th>
                                  <th
                                    className="text-center py-2 px-2 cursor-pointer hover:bg-gray-100"
                                    onClick={() => setStandingsSortBy(standingsSortBy === 'gameDiff' ? 'gameDiff-desc' : 'gameDiff')}
                                    title="Sort by Game Differential"
                                  >
                                    G+/- {standingsSortBy.startsWith('gameDiff') && (standingsSortBy === 'gameDiff-desc' ? '↓' : '↑')}
                                  </th>
                                  <th className="text-center py-2 px-2" title="Points For">PF</th>
                                  <th className="text-center py-2 px-2" title="Points Against">PA</th>
                                  <th
                                    className="text-center py-2 px-2 cursor-pointer hover:bg-gray-100"
                                    onClick={() => setStandingsSortBy(standingsSortBy === 'pointDiff' ? 'pointDiff-desc' : 'pointDiff')}
                                    title="Sort by Point Differential"
                                  >
                                    P+/- {standingsSortBy.startsWith('pointDiff') && (standingsSortBy === 'pointDiff-desc' ? '↓' : '↑')}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  // Flatten all standings with pool info
                                  const allStandings = schedule.poolStandings.flatMap(pool =>
                                    (pool.standings || []).map(s => ({ ...s, poolNumber: pool.poolNumber, poolName: pool.poolName }))
                                  );

                                  // Sort based on current sort setting
                                  const sorted = [...allStandings].sort((a, b) => {
                                    switch (standingsSortBy) {
                                      case 'pool': return (a.poolNumber || 0) - (b.poolNumber || 0);
                                      case 'pool-desc': return (b.poolNumber || 0) - (a.poolNumber || 0);
                                      case 'rank': return (a.rank || 0) - (b.rank || 0);
                                      case 'rank-desc': return (b.rank || 0) - (a.rank || 0);
                                      case 'matchesWon': return (a.matchesWon || 0) - (b.matchesWon || 0);
                                      case 'matchesWon-desc': return (b.matchesWon || 0) - (a.matchesWon || 0);
                                      case 'gameDiff': return ((a.gamesWon || 0) - (a.gamesLost || 0)) - ((b.gamesWon || 0) - (b.gamesLost || 0));
                                      case 'gameDiff-desc': return ((b.gamesWon || 0) - (b.gamesLost || 0)) - ((a.gamesWon || 0) - (a.gamesLost || 0));
                                      case 'pointDiff': return (a.pointDifferential || 0) - (b.pointDifferential || 0);
                                      case 'pointDiff-desc': return (b.pointDifferential || 0) - (a.pointDifferential || 0);
                                      default: return (a.poolNumber || 0) - (b.poolNumber || 0) || (a.rank || 0) - (b.rank || 0);
                                    }
                                  });

                                  return sorted.map((standing, idx) => {
                                    const willAdvance = selectedDivision?.playoffFromPools && standing.rank <= selectedDivision.playoffFromPools;
                                    const gameDiff = (standing.gamesWon || 0) - (standing.gamesLost || 0);

                                    return (
                                      <tr key={idx} className={`border-b last:border-0 ${willAdvance ? 'bg-green-50' : ''}`}>
                                        <td className="py-2 px-2 font-medium text-orange-600">
                                          {standing.poolName || `Pool ${standing.poolNumber}`}
                                        </td>
                                        <td className="py-2 px-2">
                                          <span className={`font-medium ${willAdvance ? 'text-green-600' : 'text-gray-400'}`}>
                                            {standing.rank}
                                          </span>
                                        </td>
                                        <td className="py-2 px-2">
                                          <div className="text-gray-900 font-medium">{standing.unitName || `Unit #${standing.unitNumber}`}</div>
                                        </td>
                                        <td className="py-2 px-2 text-center font-medium text-green-600">{standing.matchesWon}</td>
                                        <td className="py-2 px-2 text-center text-red-600">{standing.matchesLost}</td>
                                        <td className="py-2 px-2 text-center text-gray-600">{standing.gamesWon}</td>
                                        <td className="py-2 px-2 text-center text-gray-600">{standing.gamesLost}</td>
                                        <td className={`py-2 px-2 text-center font-medium ${gameDiff > 0 ? 'text-green-600' : gameDiff < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                          {gameDiff > 0 ? '+' : ''}{gameDiff}
                                        </td>
                                        <td className="py-2 px-2 text-center text-gray-600">{standing.pointsFor || 0}</td>
                                        <td className="py-2 px-2 text-center text-gray-600">{standing.pointsAgainst || 0}</td>
                                        <td className={`py-2 px-2 text-center font-medium ${(standing.pointDifferential || 0) > 0 ? 'text-green-600' : (standing.pointDifferential || 0) < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                          {(standing.pointDifferential || 0) > 0 ? '+' : ''}{standing.pointDifferential || 0}
                                        </td>
                                      </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                      /* Grouped view - separate tables per pool */
                      <div className="p-4 space-y-6">
                        {schedule.poolStandings.map((pool, poolIdx) => (
                          <div key={poolIdx}>
                            <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                              {pool.poolName || `Pool ${pool.poolNumber}`}
                              <span className="text-xs text-gray-400">({pool.standings?.length || 0} teams)</span>
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="text-gray-500 border-b bg-gray-50">
                                  <tr>
                                    <th className="text-left py-2 px-2 w-12">#</th>
                                    <th className="text-left py-2 px-2">Team</th>
                                    <th className="text-center py-2 px-2" title="Matches Won">MW</th>
                                    <th className="text-center py-2 px-2" title="Matches Lost">ML</th>
                                    <th className="text-center py-2 px-2" title="Games Won">GW</th>
                                    <th className="text-center py-2 px-2" title="Games Lost">GL</th>
                                    <th className="text-center py-2 px-2" title="Game Differential">G+/-</th>
                                    <th className="text-center py-2 px-2" title="Points For">PF</th>
                                    <th className="text-center py-2 px-2" title="Points Against">PA</th>
                                    <th className="text-center py-2 px-2" title="Point Differential">P+/-</th>
                                    {isOrganizer && selectedDivision?.scheduleStatus !== 'PoolsFinalized' && (
                                      <th className="text-center py-2 px-2 w-16">Edit</th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {pool.standings?.filter(s => s != null).map((standing, idx) => {
                                    const willAdvance = selectedDivision?.playoffFromPools &&
                                      standing.rank <= selectedDivision.playoffFromPools;
                                    const isEditing = editingRank && editingRank.unitId === standing.unitId;

                                    return (
                                      <tr
                                        key={idx}
                                        className={`border-b last:border-0 ${
                                          willAdvance ? 'bg-green-50' : ''
                                        } ${standing.advancedToPlayoff ? 'bg-green-100' : ''}`}
                                      >
                                        <td className="py-2 px-2">
                                          {isEditing && editingRank ? (
                                            <input
                                              type="number"
                                              min="1"
                                              value={editingRank.rank}
                                              onChange={(e) => setEditingRank({ ...editingRank, rank: parseInt(e.target.value) || 1 })}
                                              className="w-12 px-1 py-0.5 text-center border border-gray-300 rounded"
                                              autoFocus
                                            />
                                          ) : (
                                            <span className={`font-medium ${willAdvance ? 'text-green-600' : 'text-gray-400'}`}>
                                              {standing.rank}
                                              {standing.advancedToPlayoff && <Award className="w-3 h-3 inline ml-1 text-green-600" />}
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 px-2">
                                          <div className="text-gray-900 font-medium">
                                            {standing.unitName || `Unit #${standing.unitNumber}`}
                                          </div>
                                          {standing.players && (
                                            <div className="text-xs text-gray-500">{standing.players}</div>
                                          )}
                                        </td>
                                        <td className="py-2 px-2 text-center font-medium text-green-600">{standing.matchesWon}</td>
                                        <td className="py-2 px-2 text-center text-red-600">{standing.matchesLost}</td>
                                        <td className="py-2 px-2 text-center text-gray-600">{standing.gamesWon}</td>
                                        <td className="py-2 px-2 text-center text-gray-600">{standing.gamesLost}</td>
                                        <td className={`py-2 px-2 text-center font-medium ${
                                          (standing.gamesWon - standing.gamesLost) > 0 ? 'text-green-600' :
                                          (standing.gamesWon - standing.gamesLost) < 0 ? 'text-red-600' : 'text-gray-400'
                                        }`}>
                                          {(standing.gamesWon - standing.gamesLost) > 0 ? '+' : ''}{standing.gamesWon - standing.gamesLost}
                                        </td>
                                        <td className="py-2 px-2 text-center text-gray-600">{standing.pointsFor || 0}</td>
                                        <td className="py-2 px-2 text-center text-gray-600">{standing.pointsAgainst || 0}</td>
                                        <td className={`py-2 px-2 text-center font-medium ${
                                          standing.pointDifferential > 0 ? 'text-green-600' :
                                          standing.pointDifferential < 0 ? 'text-red-600' : 'text-gray-400'
                                        }`}>
                                          {standing.pointDifferential > 0 ? '+' : ''}{standing.pointDifferential}
                                        </td>
                                        {isOrganizer && selectedDivision?.scheduleStatus !== 'PoolsFinalized' && (
                                          <td className="py-2 px-2 text-center">
                                            {isEditing && editingRank ? (
                                              <div className="flex items-center justify-center gap-1">
                                                <button
                                                  onClick={() => handleOverrideRank(standing.unitId, editingRank.rank)}
                                                  className="p-1 text-green-600 hover:bg-green-100 rounded"
                                                  title="Save"
                                                >
                                                  <Save className="w-4 h-4" />
                                                </button>
                                                <button
                                                  onClick={() => setEditingRank(null)}
                                                  className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                                  title="Cancel"
                                                >
                                                  <X className="w-4 h-4" />
                                                </button>
                                              </div>
                                            ) : (
                                              <button
                                                onClick={() => setEditingRank({ unitId: standing.unitId, rank: standing.rank || 1 })}
                                                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                                title="Edit rank"
                                              >
                                                <Edit2 className="w-4 h-4" />
                                              </button>
                                            )}
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                      )}

                      {/* Summary Stats */}
                      <div className="px-4 py-3 bg-blue-50 border-t text-sm flex items-center gap-6">
                        {(() => {
                          const allStandings = schedule.poolStandings.flatMap(pool => pool.standings || []);
                          const totalMatches = allStandings.reduce((sum, s) => sum + (s.matchesWon || 0), 0);
                          const totalGames = allStandings.reduce((sum, s) => sum + (s.gamesWon || 0), 0);
                          return (
                            <>
                              <span className="font-medium text-blue-800">
                                Total Matches: <span className="text-blue-900">{totalMatches}</span>
                              </span>
                              <span className="font-medium text-blue-800">
                                Total Games: <span className="text-blue-900">{totalGames}</span>
                              </span>
                            </>
                          );
                        })()}
                      </div>

                      {/* Legend */}
                      <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500 flex items-center gap-4">
                        <span>MW = Matches Won</span>
                        <span>GW = Games Won</span>
                        <span>PF = Points For</span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded bg-green-100 border border-green-200"></span>
                          Will advance to playoffs
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <p className="text-gray-600">
                    Schedule for {selectedDivision.name} is ready.
                    {selectedDivision.completedMatches} of {selectedDivision.totalMatches} matches completed.
                  </p>
                </div>
              )
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Schedule Yet</h3>
                <p className="text-gray-500 mb-4">
                  Generate a schedule from the Divisions tab when you have enough registrations
                </p>
              </div>
            )}
          </div>
        )}

        {/* By Court Tab - Shows schedule grouped by court */}
        {activeTab === 'bycourt' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Schedule By Court</h2>
              <button
                onClick={() => {
                  loadDashboard();
                  dashboard?.divisions?.forEach(div => {
                    if (div.scheduleReady) loadSchedule(div.id);
                  });
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {dashboard?.courts?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboard.courts.map(court => {
                  // Get all matches assigned to this court from the schedule
                  const courtMatches = [];

                  // Collect matches from all divisions' schedules
                  if (schedule?.rounds) {
                    schedule.rounds.forEach(round => {
                      round.matches?.forEach(match => {
                        if (match.courtId === court.id) {
                          courtMatches.push({
                            ...match,
                            roundName: round.roundName,
                            roundType: round.roundType
                          });
                        }
                      });
                    });
                  }

                  // Sort by scheduled time
                  courtMatches.sort((a, b) => {
                    if (!a.scheduledTime) return 1;
                    if (!b.scheduledTime) return -1;
                    return new Date(a.scheduledTime) - new Date(b.scheduledTime);
                  });

                  return (
                    <div key={court.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <div className={`px-4 py-3 border-b ${
                        court.status === 'InUse' ? 'bg-orange-50' :
                        court.status === 'Available' ? 'bg-green-50' : 'bg-gray-50'
                      }`}>
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {court.courtLabel}
                          </h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            court.status === 'InUse' ? 'bg-orange-100 text-orange-700' :
                            court.status === 'Available' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {court.status || 'Available'}
                          </span>
                        </div>
                        {courtMatches.length > 0 && (
                          <p className="text-sm text-gray-500 mt-1">
                            {courtMatches.length} match{courtMatches.length !== 1 ? 'es' : ''} scheduled
                          </p>
                        )}
                      </div>
                      <div className="divide-y max-h-80 overflow-y-auto">
                        {courtMatches.length > 0 ? (
                          courtMatches.map((match, idx) => (
                            <div key={idx} className="p-3 hover:bg-gray-50">
                              <div className="flex items-start gap-2">
                                {/* Edit button - only for organizers/admins */}
                                {isOrganizer && (
                                  <button
                                    onClick={() => setSelectedGameForEdit({
                                      id: match.games?.[0]?.gameId || match.games?.[0]?.id || match.encounterId,
                                      encounterId: match.encounterId,
                                      ...(match.games?.[0] || {}),
                                      unit1: { id: match.unit1Id, name: match.unit1Name || match.unit1SeedInfo, members: match.unit1Members || [] },
                                      unit2: { id: match.unit2Id, name: match.unit2Name || match.unit2SeedInfo, members: match.unit2Members || [] },
                                      unit1Score: match.games?.[0]?.unit1Score ?? match.unit1Score ?? 0,
                                      unit2Score: match.games?.[0]?.unit2Score ?? match.unit2Score ?? 0,
                                      bestOf: match.bestOf || 1,
                                      matchNumber: match.matchNumber,
                                      status: match.games?.[0]?.status || match.status || 'New',
                                      games: match.games || [],
                                      courtLabel: match.courtLabel,
                                      winnerUnitId: match.winnerUnitId,
                                      hasGames: match.games?.length > 0
                                    })}
                                    className="p-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors flex-shrink-0"
                                    title="Edit match"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                                <div className="flex-1 min-w-0">
                                  {match.scheduledTime && (
                                    <div className="flex items-center gap-1 text-xs text-blue-600 mb-1">
                                      <Clock className="w-3 h-3" />
                                      {new Date(match.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  )}
                                  <div className="text-sm">
                                    <span className="text-gray-400 mr-2">#{match.matchNumber}</span>
                                    <span className={match.status === 'Completed' ? 'text-green-600' : 'text-gray-900'}>
                                      {match.unit1Name || match.unit1SeedInfo || `Unit #${match.unit1Number || '?'}`}
                                    </span>
                                    <span className="text-gray-400 mx-2">vs</span>
                                    <span className={match.status === 'Completed' ? 'text-green-600' : 'text-gray-900'}>
                                      {match.unit2Name || match.unit2SeedInfo || `Unit #${match.unit2Number || '?'}`}
                                    </span>
                                  </div>
                                  {match.score && (
                                    <div className="text-xs text-gray-500 mt-1">{match.score}</div>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                      match.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                      match.status === 'InProgress' ? 'bg-orange-100 text-orange-700' :
                                      'bg-gray-100 text-gray-600'
                                    }`}>
                                      {match.status || 'Scheduled'}
                                    </span>
                                    {match.roundName && (
                                      <span className="text-xs text-gray-400">{match.roundName}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-400 text-sm">
                            No matches scheduled
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Courts Configured</h3>
                <p className="text-gray-500">
                  Add courts in the Courts section under Pre-Planning to see the schedule by court.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Registrations Tab */}
        {activeTab === 'registrations' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Registration Management</h2>
              <div className="flex items-center gap-2">
                {isOrganizer && (
                  <button
                    onClick={handleExportRegistrations}
                    disabled={exportingRegistrations}
                    className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 flex items-center gap-2 disabled:opacity-50"
                  >
                    {exportingRegistrations ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Excel
                  </button>
                )}
                {isOrganizer && (
                  <button
                    onClick={validateRegistrations}
                    disabled={loadingValidation}
                    className="px-4 py-2 text-sm font-medium text-orange-700 bg-orange-100 rounded-lg hover:bg-orange-200 flex items-center gap-2 disabled:opacity-50"
                  >
                    {loadingValidation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    Validate
                  </button>
                )}
                {isOrganizer && (
                  <button
                    onClick={() => setShowAddPlayer(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Player
                  </button>
                )}
                <button
                  onClick={() => { loadUnits(); loadDashboard(); }}
                  disabled={loadingUnits}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                >
                  <RefreshCw className={`w-5 h-5 ${loadingUnits ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Pending Join Requests Section */}
            {isOrganizer && (joinRequests.length > 0 || loadingJoinRequests) && (
              <div className="bg-white rounded-xl shadow-sm border border-orange-200">
                <div className="px-4 py-3 border-b border-orange-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-orange-600" />
                    <h3 className="font-semibold text-gray-900">Pending Join Requests</h3>
                    {joinRequests.length > 0 && (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
                        {joinRequests.length}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={loadJoinRequests}
                    disabled={loadingJoinRequests}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingJoinRequests ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  {loadingJoinRequests && joinRequests.length === 0 ? (
                    <div className="px-4 py-6 text-center text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Loading join requests...
                    </div>
                  ) : (
                    joinRequests.map(req => (
                      <div key={req.requestId} className="px-4 py-3 flex items-center gap-3">
                        {/* Profile image */}
                        <div className="flex-shrink-0">
                          {req.requesterProfileImage ? (
                            <img
                              src={req.requesterProfileImage}
                              alt={req.requesterName}
                              className="w-9 h-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
                              <User className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                        </div>
                        {/* Request details */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">
                            <span className="font-medium text-gray-900">{req.requesterName}</span>
                            <span className="text-gray-500"> wants to join </span>
                            <span className="font-medium text-gray-900">{req.unitName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                            <span className="bg-gray-100 px-1.5 py-0.5 rounded">{req.divisionName}</span>
                            <span>·</span>
                            <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                            {req.message && (
                              <>
                                <span>·</span>
                                <span className="italic truncate max-w-[200px]">"{req.message}"</span>
                              </>
                            )}
                          </div>
                        </div>
                        {/* Action buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleRespondToJoinRequest(req.requestId, true)}
                            disabled={respondingToRequest === req.requestId}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                          >
                            {respondingToRequest === req.requestId ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            Accept
                          </button>
                          <button
                            onClick={() => handleRespondToJoinRequest(req.requestId, false)}
                            disabled={respondingToRequest === req.requestId}
                            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 disabled:opacity-50 flex items-center gap-1"
                          >
                            {respondingToRequest === req.requestId ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <X className="w-3 h-3" />
                            )}
                            Decline
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Division Filter */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
                  <select
                    value={registrationDivisionFilter}
                    onChange={(e) => setRegistrationDivisionFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="all">All Divisions</option>
                    {dashboard?.divisions?.filter(d => d.registeredUnits > 0).map(div => (
                      <option key={div.id} value={div.id}>{div.name}</option>
                    ))}
                  </select>
                </div>
                {eventFeeTypes.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fee Type</label>
                    <select
                      value={registrationFeeTypeFilter}
                      onChange={(e) => setRegistrationFeeTypeFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="all">All Fee Types</option>
                      {eventFeeTypes.map(ft => (
                        <option key={ft.id} value={ft.id}>{ft.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {!unitsData && (
                  <div className="flex items-end">
                    <button
                      onClick={loadUnits}
                      disabled={loadingUnits}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {loadingUnits ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                      Load Registrations
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Unit Registration List */}
            {!unitsData ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">Click refresh to load registrations</p>
                <button
                  onClick={loadUnits}
                  disabled={loadingUnits}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                  {loadingUnits ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                  Load Registrations
                </button>
              </div>
            ) : getUnitsByDivision().length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No registered units found</p>
              </div>
            ) : (
                <div className="space-y-4">
                  {getUnitsByDivision().map(divGroup => {
                    const teamSize = divGroup.units[0]?.requiredPlayers || 2;
                    const sortedUnits = [...divGroup.units].sort((a, b) => {
                      const aComplete = a.isComplete ? 1 : 0;
                      const bComplete = b.isComplete ? 1 : 0;
                      return bComplete - aComplete;
                    });

                    return (
                      <div key={divGroup.divisionId} className="border rounded-lg overflow-hidden bg-white">
                        {/* Division Header */}
                        <div className="p-4 bg-gray-50 border-b">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h4 className="font-semibold text-gray-900 text-lg">{divGroup.divisionName}</h4>
                            </div>
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-1.5">
                              <CheckCircle className="w-4 h-4" />
                              Registered
                            </span>
                          </div>
                        </div>

                        {/* Units count and merge toolbar */}
                        <div className="px-4 py-3 border-b bg-gray-50/50 flex items-center justify-between">
                          <h5 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            {divGroup.units.length} {teamSize > 2 ? 'Teams' : teamSize === 2 ? 'Pairs' : 'Players'} Registered
                          </h5>

                          {/* Merge toolbar */}
                          {selectedUnitsForMerge.length > 0 && selectedUnitsForMerge[0]?.divisionId === divGroup.divisionId && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">{selectedUnitsForMerge.length} selected</span>
                              <button
                                onClick={handleMergeUnits}
                                disabled={selectedUnitsForMerge.length !== 2 || processingUnitAction?.action === 'merge'}
                                className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                              >
                                {processingUnitAction?.action === 'merge' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Users className="w-3 h-3" />}
                                Merge
                              </button>
                              <button
                                onClick={() => setSelectedUnitsForMerge([])}
                                className="px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Unit rows */}
                        <div className="divide-y divide-gray-100">
                          {sortedUnits.map((unit, idx) => {
                            const isComplete = unit.isComplete;
                            const isSelected = selectedUnitsForMerge.some(u => u.id === unit.id);
                            const isProcessing = processingUnitAction?.unitId === unit.id;
                            const acceptedMembers = unit.members?.filter(m => m.inviteStatus === 'Accepted') || [];

                            return (
                              <div
                                key={unit.id}
                                className={`px-2 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 ${
                                  isComplete ? 'bg-white' : 'bg-amber-50/50'
                                } ${idx % 2 === 1 && isComplete ? 'bg-gray-50/50' : ''} ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
                              >
                                {/* Checkbox for merge (incomplete units only) */}
                                {!isComplete && (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleUnitForMerge({ ...unit, divisionId: divGroup.divisionId })}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 shrink-0"
                                  />
                                )}

                                {/* Unit number */}
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                                  isComplete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {idx + 1}
                                </div>

                                {/* Members inline */}
                                <div className="flex-1 flex flex-wrap items-center gap-2 min-w-0">
                                  {acceptedMembers.map((member, mIdx) => (
                                    <div key={mIdx} className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => member.userId && setProfileModalUserId(member.userId)}
                                        className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors"
                                      >
                                        {member.profileImageUrl ? (
                                          <img src={getSharedAssetUrl(member.profileImageUrl)} alt="" className="w-5 h-5 rounded-full object-cover" />
                                        ) : (
                                          <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-medium">
                                            {(member.firstName || 'P')[0].toUpperCase()}
                                          </div>
                                        )}
                                        <span className="text-sm max-w-[80px] sm:max-w-[150px] truncate text-gray-700">
                                          {member.lastName && member.firstName
                                            ? `${member.lastName}, ${member.firstName}`
                                            : member.lastName || member.firstName || 'Player'}
                                        </span>
                                      </button>
                                      {/* Payment status $ icon */}
                                      <span
                                        className={`flex items-center justify-center w-5 h-5 rounded-full ${member.hasPaid ? 'bg-green-500' : 'bg-gray-300'}`}
                                        title={member.hasPaid ? 'Paid' : 'Unpaid'}
                                      >
                                        <DollarSign className={`w-3 h-3 ${member.hasPaid ? 'text-white' : 'text-gray-500'}`} />
                                      </span>
                                      {/* Remove member button - show for singles or when team has multiple members */}
                                      <button
                                        onClick={() => handleRemoveMember(unit, member)}
                                        disabled={isProcessing}
                                        className="p-0.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                                        title={acceptedMembers.length === 1 ? "Cancel registration" : "Remove player"}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ))}

                                  {/* Empty slots for incomplete units */}
                                  {!isComplete && Array.from({ length: Math.max(0, (unit.requiredPlayers || 2) - acceptedMembers.length) }).map((_, i) => (
                                    <div key={`empty-${i}`} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-100 border border-dashed border-gray-300 shrink-0">
                                      <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 text-xs">?</div>
                                      <span className="hidden sm:inline text-sm text-gray-400">Needed</span>
                                    </div>
                                  ))}
                                </div>

                                {/* Status badge and actions */}
                                <div className="shrink-0 flex items-center gap-2">
                                  {isComplete ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                                      <Check className="w-3 h-3" />
                                      <span className="hidden sm:inline">Team Complete</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-full">
                                      <Clock className="w-3 h-3" />
                                      <span className="hidden sm:inline">Looking</span>
                                    </span>
                                  )}

                                  {/* Break unit button (for complete units with >1 member) */}
                                  {isComplete && acceptedMembers.length > 1 && (
                                    <button
                                      onClick={() => handleBreakUnit(unit)}
                                      disabled={isProcessing}
                                      className="p-1 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors disabled:opacity-50"
                                      title="Break unit apart"
                                    >
                                      {isProcessing && processingUnitAction?.action === 'break' ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Hammer className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}

                                  {/* Move to different division */}
                                  {dashboard?.divisions?.filter(d => d.id !== divGroup.divisionId).length > 0 && (
                                    <button
                                      onClick={() => setMovingUnitToDivision({ unit: { ...unit, divisionId: divGroup.divisionId }, targetDivisionId: null })}
                                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                      title="Move to different division"
                                    >
                                      <ArrowRight className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Move Division Modal */}
                  {movingUnitToDivision && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                      <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h3 className="font-semibold text-lg mb-4">Move to Different Division</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Move "{movingUnitToDivision.unit?.name}" to a different division. Fees will be adjusted automatically.
                        </p>
                        <select
                          value={movingUnitToDivision.targetDivisionId || ''}
                          onChange={(e) => setMovingUnitToDivision({
                            ...movingUnitToDivision,
                            targetDivisionId: parseInt(e.target.value)
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 mb-4"
                        >
                          <option value="">Select division...</option>
                          {dashboard?.divisions?.filter(d => d.id !== movingUnitToDivision.unit?.divisionId).map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setMovingUnitToDivision(null)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => movingUnitToDivision.targetDivisionId && handleMoveUnitToDivision(movingUnitToDivision.unit, movingUnitToDivision.targetDivisionId)}
                            disabled={!movingUnitToDivision.targetDivisionId || processingUnitAction?.action === 'move'}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                          >
                            {processingUnitAction?.action === 'move' ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : null}
                            Move
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
          </div>
        )}

        {/* Check-in Tab - Player Check-in Management */}
        {activeTab === 'checkin' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Player Check-in & Status</h2>
              <button
                onClick={() => { loadCheckIns(); loadDashboard(); }}
                disabled={loadingCheckIns}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${loadingCheckIns ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Check-in stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {checkInData?.checkedInCount || dashboard?.stats?.checkedInPlayers || 0}
                    </div>
                    <div className="text-sm text-gray-500">Checked In</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Clock className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {(checkInData?.totalPlayers || dashboard?.stats?.totalRegistrations || 0) - (checkInData?.checkedInCount || dashboard?.stats?.checkedInPlayers || 0)}
                    </div>
                    <div className="text-sm text-gray-500">Pending</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {checkInData?.waiverSignedCount || 0}
                    </div>
                    <div className="text-sm text-gray-500">Waivers Signed</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {checkInData?.paidCount || 0}
                    </div>
                    <div className="text-sm text-gray-500">Paid</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={checkInFilter}
                    onChange={(e) => setCheckInFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="all">All Players</option>
                    <option value="pending">Pending Check-in</option>
                    <option value="checked-in">Checked In</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
                  <select
                    value={checkInDivisionFilter}
                    onChange={(e) => setCheckInDivisionFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="all">All Divisions</option>
                    {dashboard?.divisions?.filter(d => d.registeredUnits > 0).map(div => (
                      <option key={div.id} value={div.id}>{div.name}</option>
                    ))}
                  </select>
                </div>
                {!checkInData && (
                  <div className="flex items-end">
                    <button
                      onClick={loadCheckIns}
                      disabled={loadingCheckIns}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {loadingCheckIns ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                      Load Players
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Player list by division */}
            {checkInData?.players ? (
              <div className="space-y-6">
                {getPlayersByDivision().map(divGroup => (
                  <div key={divGroup.divisionId} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b">
                      <h3 className="font-semibold text-gray-900">{divGroup.divisionName}</h3>
                      <p className="text-sm text-gray-500">
                        {divGroup.players.filter(p => p.isCheckedIn).length} / {divGroup.players.length} checked in
                      </p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {divGroup.players.map(player => (
                        <div key={`${player.divisionId}-${player.userId}`} className="hover:bg-gray-50">
                          {/* Clickable row - whole bar expands details */}
                          <div
                            className="p-4 cursor-pointer"
                            onClick={() => setExpandedPlayer(expandedPlayer === player.userId ? null : player.userId)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {/* Avatar - clickable for profile */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setProfileModalUserId(player.userId);
                                  }}
                                  className="focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-full"
                                  title="View profile"
                                >
                                  {player.avatarUrl ? (
                                    <img
                                      src={getSharedAssetUrl(player.avatarUrl)}
                                      alt=""
                                      className="w-10 h-10 rounded-full object-cover hover:ring-2 hover:ring-orange-400 transition-all"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:ring-2 hover:ring-orange-400 transition-all">
                                      <User className="w-5 h-5 text-gray-400" />
                                    </div>
                                  )}
                                </button>

                                {/* Player info - clickable for profile */}
                                <div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setProfileModalUserId(player.userId);
                                    }}
                                    className="font-medium text-gray-900 hover:text-orange-600 text-left"
                                  >
                                    {player.firstName} {player.lastName}
                                  </button>
                                  <div className="text-sm text-gray-500">
                                    {player.unitName} • {player.email}
                                  </div>
                                </div>
                              </div>

                              {/* Status indicators and actions */}
                              <div className="flex items-center gap-2">
                                {/* Status badges */}
                                <div className="flex items-center gap-2">
                                  {/* Check-in status */}
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                    player.isCheckedIn
                                      ? 'bg-green-100 text-green-700'
                                      : player.checkInStatus === 'Requested'
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {player.isCheckedIn ? (
                                      <CheckCircle className="w-3 h-3" />
                                    ) : player.checkInStatus === 'Requested' ? (
                                      <AlertCircle className="w-3 h-3" />
                                    ) : (
                                      <Clock className="w-3 h-3" />
                                    )}
                                    {player.isCheckedIn ? 'Checked In' : player.checkInStatus === 'Requested' ? 'Requested' : 'Pending'}
                                  </span>

                                  {/* Waiver status */}
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                    player.waiverSigned
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    <FileText className="w-3 h-3" />
                                    {player.waiverSigned ? 'Waiver' : 'No Waiver'}
                                  </span>

                                  {/* Payment status */}
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                    player.hasPaid
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-red-100 text-red-600'
                                  }`}>
                                    <DollarSign className="w-3 h-3" />
                                    {player.hasPaid ? 'Paid' : 'Unpaid'}
                                  </span>

                                  {/* Expand indicator */}
                                  {expandedPlayer === player.userId ? (
                                    <ChevronUp className="w-4 h-4 text-gray-400" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Expanded details section */}
                          {expandedPlayer === player.userId && (
                            <div className="px-4 pb-4">
                              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {/* Waiver Section with Actions */}
                                  <div className="space-y-3">
                                    <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                      <FileText className="w-4 h-4 text-blue-600" />
                                      Waiver Status
                                    </h4>
                                    {player.waiverSigned ? (
                                      <div className="text-sm space-y-1">
                                        <div className="flex items-center gap-2 text-green-600">
                                          <CheckCircle className="w-4 h-4" />
                                          <span>Waiver signed</span>
                                        </div>
                                        {player.waiverSignedAt && (
                                          <p className="text-gray-500">
                                            Signed: {new Date(player.waiverSignedAt).toLocaleString()}
                                          </p>
                                        )}
                                        {player.waiverSignature && (
                                          <p className="text-gray-500 truncate">
                                            Signature: {player.waiverSignature}
                                          </p>
                                        )}
                                        {player.signedWaiverPdfUrl && (
                                          <a
                                            href={getSharedAssetUrl(player.signedWaiverPdfUrl)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                                          >
                                            <Eye className="w-4 h-4" />
                                            View Signed Waiver
                                          </a>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-sm">
                                        <div className="flex items-center gap-2 text-yellow-600">
                                          <AlertCircle className="w-4 h-4" />
                                          <span>Waiver not signed</span>
                                        </div>
                                        <p className="text-gray-500 mt-1">
                                          Player needs to sign the waiver before check-in
                                        </p>
                                      </div>
                                    )}
                                    {/* Waiver Action Buttons */}
                                    <div className="flex flex-wrap gap-2 pt-2">
                                      {!player.waiverSigned ? (
                                        <>
                                          <button
                                            onClick={() => {
                                              const checkInUrl = `${window.location.origin}/event/${eventId}/check-in?redo=waiver&userId=${player.userId}`;
                                              window.open(checkInUrl, '_blank');
                                            }}
                                            className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium flex items-center gap-2"
                                          >
                                            <ExternalLink className="w-4 h-4" />
                                            Open Waiver Page
                                          </button>
                                          <button
                                            onClick={() => handleSendWaiverRequest(player)}
                                            disabled={sendingWaiverRequest === player.userId}
                                            className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                          >
                                            {sendingWaiverRequest === player.userId ? (
                                              <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                              <Send className="w-4 h-4" />
                                            )}
                                            Send Request
                                          </button>
                                          <button
                                            onClick={() => handleOverrideWaiver(player.userId)}
                                            disabled={processingAction?.userId === player.userId}
                                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                          >
                                            <CheckCircle className="w-4 h-4" />
                                            Override Waiver
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          onClick={() => handleVoidWaiver(player.userId)}
                                          disabled={processingAction?.userId === player.userId}
                                          className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                        >
                                          <XCircle className="w-4 h-4" />
                                          Void Waiver
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Payment Section with Actions */}
                                  <div className="space-y-3">
                                    <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                      <DollarSign className="w-4 h-4 text-emerald-600" />
                                      Payment Status
                                    </h4>
                                    {player.hasPaid ? (
                                      <div className="text-sm space-y-1">
                                        <div className="flex items-center gap-2 text-green-600">
                                          <CheckCircle className="w-4 h-4" />
                                          <span>Payment received</span>
                                        </div>
                                        {player.amountPaid > 0 && (
                                          <p className="text-gray-500">
                                            Amount: ${player.amountPaid?.toFixed(2) || '0.00'}
                                          </p>
                                        )}
                                        {player.paymentMethod && (
                                          <p className="text-gray-500">
                                            Method: {player.paymentMethod}
                                          </p>
                                        )}
                                        {player.paidAt && (
                                          <p className="text-gray-500">
                                            Paid: {new Date(player.paidAt).toLocaleString()}
                                          </p>
                                        )}
                                        {player.paymentReference && (
                                          <p className="text-gray-500 truncate">
                                            Reference: {player.paymentReference}
                                          </p>
                                        )}
                                        {player.paymentProofUrl && (
                                          <a
                                            href={getSharedAssetUrl(player.paymentProofUrl)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                                          >
                                            <Eye className="w-4 h-4" />
                                            View Payment Proof
                                          </a>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-sm">
                                        <div className="flex items-center gap-2 text-red-600">
                                          <XCircle className="w-4 h-4" />
                                          <span>Payment pending</span>
                                        </div>
                                        <p className="text-gray-500 mt-1">
                                          Player has not submitted payment
                                        </p>
                                        {player.paymentProofUrl && (
                                          <a
                                            href={getSharedAssetUrl(player.paymentProofUrl)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                                          >
                                            <Eye className="w-4 h-4" />
                                            View Payment Proof (Pending)
                                          </a>
                                        )}
                                      </div>
                                    )}
                                    {/* Payment Action Buttons */}
                                    <div className="flex flex-wrap gap-2 pt-2">
                                      {!player.hasPaid ? (
                                        <>
                                          <button
                                            onClick={() => handleOverridePayment(player.userId, true)}
                                            disabled={processingAction?.userId === player.userId}
                                            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                          >
                                            <DollarSign className="w-4 h-4" />
                                            Mark as Paid
                                          </button>
                                          <button
                                            onClick={() => startEditPayment(player)}
                                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                            Edit Payment
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            onClick={() => handleOverridePayment(player.userId, false)}
                                            disabled={processingAction?.userId === player.userId}
                                            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                          >
                                            <XCircle className="w-4 h-4" />
                                            Void Payment
                                          </button>
                                          <button
                                            onClick={() => startEditPayment(player)}
                                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                            Edit Payment
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Check-in Actions */}
                                <div className="mt-6 pt-4 border-t border-gray-200">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm">
                                      <span className="font-medium text-gray-700">Check-in Status: </span>
                                      {player.isCheckedIn ? (
                                        <span className="text-green-600 font-medium">Checked In</span>
                                      ) : player.waiverSigned && player.hasPaid ? (
                                        <span className="text-green-600">Ready for check-in</span>
                                      ) : (
                                        <span className="text-yellow-600">
                                          Missing: {[
                                            !player.waiverSigned && 'Waiver',
                                            !player.hasPaid && 'Payment'
                                          ].filter(Boolean).join(', ')}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex gap-2">
                                      {!player.isCheckedIn ? (
                                        <button
                                          onClick={() => handleManualCheckIn(player.userId)}
                                          disabled={processingAction?.userId === player.userId}
                                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium flex items-center gap-2"
                                        >
                                          {processingAction?.userId === player.userId && processingAction?.action === 'checkin' ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <CheckCircle className="w-4 h-4" />
                                          )}
                                          Check In Player
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleVoidCheckIn(player.userId)}
                                          disabled={processingAction?.userId === player.userId}
                                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium flex items-center gap-2"
                                        >
                                          {processingAction?.userId === player.userId && processingAction?.action === 'void-checkin' ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <XCircle className="w-4 h-4" />
                                          )}
                                          Void Check-in
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {player.isCheckedIn && (
                                    <p className="text-xs text-gray-500 mt-2">
                                      <strong>Note:</strong> Voiding check-in will also void the waiver signature and payment record, allowing the player to start the check-in process over.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {getPlayersByDivision().length === 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No players match the current filters</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">Click "Load Players" to view individual check-in status</p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Player Self Check-in</span>
              </div>
              <p className="text-sm">
                Players can check in from their Member Dashboard after signing the waiver and completing payment.
                Check-in is typically enabled when the tournament status is set to "Running".
              </p>
            </div>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            <input
              type="file"
              ref={proofFileInputRef}
              className="hidden"
              accept="image/*,.pdf"
              onChange={handleAdminProofUpload}
            />
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Payment Management</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPayments}
                  disabled={exportingPayments || loadingPayments}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg disabled:opacity-50"
                  title="Export to Excel"
                >
                  <Download className="w-4 h-4" />
                  {exportingPayments ? 'Exporting...' : 'Export'}
                </button>
                <button
                  onClick={() => loadPaymentSummary()}
                  disabled={loadingPayments}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                >
                  <RefreshCw className={`w-5 h-5 ${loadingPayments ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Search and Filter Controls */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Search by Name */}
                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Search Player</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={paymentSearchName}
                      onChange={(e) => handlePaymentSearchChange(e.target.value)}
                      placeholder="Search by player name..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Payment Status Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select
                    value={paymentStatusFilter}
                    onChange={(e) => handlePaymentFilterChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="PendingVerification">Pending Verification</option>
                    <option value="Verified">Verified</option>
                  </select>
                </div>

                {/* Division Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Division</label>
                  <select
                    value={paymentDivisionFilter}
                    onChange={(e) => handlePaymentFilterChange('division', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">All Divisions</option>
                    {event?.divisions?.map(div => (
                      <option key={div.id} value={div.id}>{div.name}</option>
                    ))}
                  </select>
                </div>

                {/* Payment Method Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Method</label>
                  <select
                    value={paymentMethodFilter}
                    onChange={(e) => handlePaymentFilterChange('method', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">All Methods</option>
                    <option value="Cash">Cash</option>
                    <option value="Zelle">Zelle</option>
                    <option value="Venmo">Venmo</option>
                    <option value="PayPal">PayPal</option>
                    <option value="CreditCard">Credit Card</option>
                    <option value="Check">Check</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Active filters indicator and clear button */}
              {(paymentSearchName || paymentStatusFilter || paymentDivisionFilter || paymentMethodFilter) && (
                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {paymentSearchName && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                        Name: {paymentSearchName}
                        <button onClick={() => { setPaymentSearchName(''); loadPaymentSummary({ searchName: '' }); }} className="hover:text-orange-900">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {paymentStatusFilter && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                        Status: {paymentStatusFilter}
                        <button onClick={() => handlePaymentFilterChange('status', '')} className="hover:text-orange-900">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {paymentDivisionFilter && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                        Division: {event?.divisions?.find(d => d.id === parseInt(paymentDivisionFilter))?.name || paymentDivisionFilter}
                        <button onClick={() => handlePaymentFilterChange('division', '')} className="hover:text-orange-900">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {paymentMethodFilter && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                        Method: {paymentMethodFilter}
                        <button onClick={() => handlePaymentFilterChange('method', '')} className="hover:text-orange-900">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                  </div>
                  <button
                    onClick={clearPaymentFilters}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>

            {loadingPayments && !paymentSummary ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : paymentSummary ? (
              <>
                {/* Payment Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="text-2xl font-bold text-gray-900">${paymentSummary.totalPaid?.toFixed(2) || '0.00'}</div>
                    <div className="text-sm text-gray-500">Total Collected</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="text-2xl font-bold text-gray-900">${paymentSummary.totalExpected?.toFixed(2) || '0.00'}</div>
                    <div className="text-sm text-gray-500">Total Expected</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className={`text-2xl font-bold ${paymentSummary.totalOutstanding > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      ${paymentSummary.totalOutstanding?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-sm text-gray-500">Outstanding</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {paymentSummary.unitsFullyPaid || 0} / {paymentSummary.totalUnits || 0}
                    </div>
                    <div className="text-sm text-gray-500">Fully Paid</div>
                  </div>
                </div>

                {/* Recent Payments List */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">Payment Records</h3>
                      <p className="text-sm text-gray-500">{paymentSummary.recentPayments?.length || 0} payment{paymentSummary.recentPayments?.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Sort by:</span>
                      <select
                        value={paymentSortBy}
                        onChange={(e) => setPaymentSortBy(e.target.value)}
                        className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="date">Date</option>
                        <option value="name">Name</option>
                        <option value="amount">Amount</option>
                        <option value="status">Status</option>
                      </select>
                      <button
                        onClick={() => setPaymentSortDir(paymentSortDir === 'asc' ? 'desc' : 'asc')}
                        className="p-1 hover:bg-gray-200 rounded"
                        title={paymentSortDir === 'asc' ? 'Ascending' : 'Descending'}
                      >
                        {paymentSortDir === 'asc' ? (
                          <ChevronUp className="w-4 h-4 text-gray-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  {paymentSummary.recentPayments?.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {[...paymentSummary.recentPayments].sort((a, b) => {
                        let comparison = 0;
                        switch (paymentSortBy) {
                          case 'name':
                            comparison = (a.userName || '').localeCompare(b.userName || '');
                            break;
                          case 'amount':
                            comparison = (a.amount || 0) - (b.amount || 0);
                            break;
                          case 'status':
                            comparison = (a.status || '').localeCompare(b.status || '');
                            break;
                          case 'date':
                          default:
                            comparison = new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
                            break;
                        }
                        return paymentSortDir === 'asc' ? comparison : -comparison;
                      }).map(payment => {
                        const isExpanded = expandedPayment === payment.id;
                        const isVerifying = verifyingPayment === payment.id;

                        return (
                          <div key={payment.id} className="hover:bg-gray-50">
                            {/* Payment row */}
                            <div
                              className="p-4 cursor-pointer"
                              onClick={() => setExpandedPayment(isExpanded ? null : payment.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {/* User avatar */}
                                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                    <DollarSign className="w-5 h-5 text-gray-400" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900">{payment.userName || 'Unknown'}</div>
                                    <div className="text-sm text-gray-500 flex items-center gap-2">
                                      <span>${payment.amount?.toFixed(2) || '0.00'}</span>
                                      {payment.paymentMethod && (
                                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded">{payment.paymentMethod}</span>
                                      )}
                                      {payment.paymentReference && (
                                        <span className="text-xs text-gray-400">Ref: {payment.paymentReference}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    payment.status === 'Verified' ? 'bg-green-100 text-green-700' :
                                    payment.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                    payment.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {payment.status || 'Pending'}
                                  </span>
                                  {payment.paymentProofUrl && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setViewingProofUrl(payment.paymentProofUrl);
                                      }}
                                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                      title="View proof"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                  )}
                                  {isExpanded ? (
                                    <ChevronUp className="w-5 h-5 text-gray-400" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5 text-gray-400" />
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Expanded details */}
                            {isExpanded && (
                              <div className="px-4 pb-4">
                                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                                  {/* Payment details */}
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="text-gray-500">Submitted:</span>
                                      <span className="ml-2 text-gray-900">
                                        {payment.createdAt ? new Date(payment.createdAt).toLocaleString() : 'Unknown'}
                                      </span>
                                    </div>
                                    {payment.verifiedAt && (
                                      <div>
                                        <span className="text-gray-500">Verified:</span>
                                        <span className="ml-2 text-gray-900">
                                          {new Date(payment.verifiedAt).toLocaleString()}
                                        </span>
                                      </div>
                                    )}
                                    {payment.referenceId && (
                                      <div>
                                        <span className="text-gray-500">System Ref:</span>
                                        <span className="ml-2 text-gray-900 font-mono text-xs">{payment.referenceId}</span>
                                      </div>
                                    )}
                                    <div>
                                      <span className="text-gray-500">Applied:</span>
                                      <span className="ml-2 text-gray-900">${payment.totalApplied?.toFixed(2) || '0.00'}</span>
                                    </div>
                                  </div>

                                  {/* Applied to */}
                                  {payment.appliedTo?.length > 0 && (
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-700 mb-2">Applied to:</h4>
                                      <div className="flex flex-wrap gap-2">
                                        {payment.appliedTo.map((app, idx) => (
                                          <span key={idx} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded" title={app.unitName}>
                                            {app.userName}{app.divisionName ? ` - ${app.divisionName}` : ''} (${app.amountApplied?.toFixed(2)})
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Notes */}
                                  {payment.notes && (
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-700 mb-1">Notes:</h4>
                                      <p className="text-sm text-gray-600">{payment.notes}</p>
                                    </div>
                                  )}

                                  {/* Actions */}
                                  <div className="pt-3 border-t border-gray-200 flex gap-2">
                                    {payment.status !== 'Verified' ? (
                                      <button
                                        onClick={() => handleVerifyPayment(payment.id)}
                                        disabled={isVerifying}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                                      >
                                        {isVerifying ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Check className="w-4 h-4" />
                                        )}
                                        Verify Payment
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleUnverifyPayment(payment.id)}
                                        disabled={isVerifying}
                                        className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 disabled:opacity-50 flex items-center gap-2"
                                      >
                                        {isVerifying ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <X className="w-4 h-4" />
                                        )}
                                        Unverify
                                      </button>
                                    )}
                                    {payment.paymentProofUrl && (
                                      <button
                                        onClick={() => setViewingProofUrl(payment.paymentProofUrl)}
                                        className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-2"
                                      >
                                        <Eye className="w-4 h-4" />
                                        View Proof
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setUploadingProofForPayment(payment.id);
                                        proofFileInputRef.current?.click();
                                      }}
                                      disabled={uploadingProofForPayment === 'uploading'}
                                      className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 flex items-center gap-2"
                                    >
                                      {uploadingProofForPayment === 'uploading' ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Upload className="w-4 h-4" />
                                      )}
                                      Upload Proof
                                    </button>
                                    <button
                                      onClick={() => handleOpenApplyPayment(payment.id)}
                                      className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 flex items-center gap-2"
                                    >
                                      <UserCheck className="w-4 h-4" />
                                      Apply Payment
                                    </button>
                                  </div>
                                </div>

                                {/* Apply Payment Panel */}
                                {applyingPayment === payment.id && applicableRegistrations && (
                                  <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className="font-medium text-green-800">Apply Payment to Registrations</h4>
                                      <button
                                        onClick={() => { setApplyingPayment(null); setApplicableRegistrations(null); }}
                                        className="text-green-600 hover:text-green-800"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                    <div className="text-sm text-green-700 mb-3">
                                      Payment: ${applicableRegistrations.payment?.amount?.toFixed(2)} | 
                                      Applied: ${applicableRegistrations.payment?.alreadyApplied?.toFixed(2)} | 
                                      Remaining: ${applicableRegistrations.payment?.remaining?.toFixed(2)}
                                    </div>
                                    
                                    {/* Show All Players Toggle & Search */}
                                    <div className="flex flex-col sm:flex-row gap-3 mb-3 p-3 bg-white rounded-lg border">
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={showAllPlayers}
                                          onChange={(e) => {
                                            setShowAllPlayers(e.target.checked);
                                            refreshApplicableRegistrations(e.target.checked, applyPlayerSearch);
                                          }}
                                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                        />
                                        <span className="text-sm text-gray-700">Show all players in event</span>
                                      </label>
                                      {showAllPlayers && (
                                        <div className="flex-1 relative">
                                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                          <input
                                            type="text"
                                            placeholder="Search player by name..."
                                            value={applyPlayerSearch}
                                            onChange={(e) => {
                                              setApplyPlayerSearch(e.target.value);
                                              // Debounce search
                                              clearTimeout(window.applySearchTimeout);
                                              window.applySearchTimeout = setTimeout(() => {
                                                refreshApplicableRegistrations(showAllPlayers, e.target.value);
                                              }, 300);
                                            }}
                                            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                          />
                                        </div>
                                      )}
                                    </div>

                                    {applicableRegistrations.registrations?.length > 0 ? (
                                      <div className="space-y-2 mb-4">
                                        {applicableRegistrations.registrations.map(reg => {
                                          // Determine if checkbox should be checked
                                          const isAlreadyLinked = reg.alreadyLinkedToThisPayment;
                                          const isBeingRemoved = registrationsToUnapply.includes(reg.memberId);
                                          const isNewlySelected = selectedRegistrations.includes(reg.memberId);
                                          const isChecked = isNewlySelected || (isAlreadyLinked && !isBeingRemoved);
                                          
                                          return (
                                          <label key={reg.memberId} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${isAlreadyLinked && !isBeingRemoved ? 'bg-green-100' : isBeingRemoved ? 'bg-red-50' : reg.hasPaid ? 'bg-gray-100' : 'bg-white'} border ${isBeingRemoved ? 'border-red-300' : ''}`}>
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={(e) => {
                                                if (isAlreadyLinked) {
                                                  // For already-linked items, toggle the unapply list
                                                  if (e.target.checked) {
                                                    setRegistrationsToUnapply(registrationsToUnapply.filter(id => id !== reg.memberId));
                                                  } else {
                                                    setRegistrationsToUnapply([...registrationsToUnapply, reg.memberId]);
                                                  }
                                                } else {
                                                  // For new items, toggle the selected list
                                                  if (e.target.checked) {
                                                    setSelectedRegistrations([...selectedRegistrations, reg.memberId]);
                                                  } else {
                                                    setSelectedRegistrations(selectedRegistrations.filter(id => id !== reg.memberId));
                                                  }
                                                }
                                              }}
                                              className={`rounded ${isBeingRemoved ? 'border-red-300 text-red-600 focus:ring-red-500' : 'border-green-300 text-green-600 focus:ring-green-500'}`}
                                            />
                                            <div className="flex-1">
                                              <div className="font-medium text-gray-900">
                                                {reg.userName}
                                                {showAllPlayers && !reg.isPayerRegistration && (
                                                  <span className="ml-2 text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">Other</span>
                                                )}
                                              </div>
                                              <div className="text-xs text-gray-500">{reg.divisionName} • {reg.unitName}</div>
                                            </div>
                                            <div className="text-right">
                                              <div className="text-sm font-medium">${reg.amountDue?.toFixed(2)}</div>
                                              {isBeingRemoved ? (
                                                <div className="text-xs text-red-600">Will be removed</div>
                                              ) : isAlreadyLinked ? (
                                                <div className="text-xs text-green-600">Already applied</div>
                                              ) : reg.hasPaid ? (
                                                <div className="text-xs text-gray-500">Paid (${reg.amountPaid?.toFixed(2)})</div>
                                              ) : (
                                                <div className="text-xs text-orange-600">Unpaid</div>
                                              )}
                                            </div>
                                          </label>
                                        )})}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-500 mb-4">
                                        {showAllPlayers && applyPlayerSearch 
                                          ? `No players found matching "${applyPlayerSearch}"`
                                          : showAllPlayers 
                                            ? 'No registrations found in this event'
                                            : 'No registrations found for this payer in this event'}
                                      </p>
                                    )}
                                    <div className="flex justify-end gap-2">
                                      <button
                                        onClick={() => { setApplyingPayment(null); setApplicableRegistrations(null); setRegistrationsToUnapply([]); }}
                                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={handleApplyPayment}
                                        disabled={selectedRegistrations.length === 0 && registrationsToUnapply.length === 0}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                                      >
                                        <Check className="w-4 h-4" />
                                        {selectedRegistrations.length > 0 && registrationsToUnapply.length > 0 ? (
                                          <>Apply to {selectedRegistrations.length}, Remove from {registrationsToUnapply.length}</>
                                        ) : registrationsToUnapply.length > 0 ? (
                                          <>Remove from {registrationsToUnapply.length} Registration{registrationsToUnapply.length !== 1 ? 's' : ''}</>
                                        ) : (
                                          <>Apply to {selectedRegistrations.length} Registration{selectedRegistrations.length !== 1 ? 's' : ''}</>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p>No payment records yet</p>
                    </div>
                  )}
                </div>

                {/* Division Payment Breakdown */}
                {paymentSummary.divisionPayments?.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b">
                      <h3 className="font-semibold text-gray-900">Division Breakdown</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {paymentSummary.divisionPayments.map(div => (
                        <div key={div.divisionId} className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-900">{div.divisionName}</div>
                              <div className="text-sm text-gray-500">
                                {div.unitsFullyPaid || 0} paid / {div.totalUnits || 0} total
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-gray-900">${div.totalPaid?.toFixed(2) || '0.00'}</div>
                              <div className={`text-sm ${div.isBalanced ? 'text-green-600' : 'text-orange-600'}`}>
                                {div.isBalanced ? 'Balanced' : `$${(div.totalExpected - div.totalPaid)?.toFixed(2)} outstanding`}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">Click refresh to load payment data</p>
                <button
                  onClick={loadPaymentSummary}
                  disabled={loadingPayments}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                  {loadingPayments ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                  Load Payments
                </button>
              </div>
            )}
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <h2 className="font-semibold text-gray-900">Event Documents</h2>
                  <span className="text-sm text-gray-500">({documents.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadDocuments}
                    disabled={loadingDocuments}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-5 h-5 ${loadingDocuments ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setShowAddDocument(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Document
                  </button>
                </div>
              </div>

              {loadingDocuments ? (
                <div className="p-8 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
                </div>
              ) : documents.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No documents uploaded yet</p>
                  <p className="text-sm">Add rules, schedules, waivers, or other event materials</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {documents.map((doc) => {
                    const IconComponent = getIconForAssetType(doc.assetTypeName);
                    const colors = getColorForAssetType(doc.assetTypeColorClass);
                    return (
                      <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`p-2 rounded-lg ${colors.bg} flex-shrink-0`}>
                            <IconComponent className={`w-5 h-5 ${colors.text}`} />
                          </div>
                          <div className="min-w-0">
                            {editingDocument?.id === doc.id ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={editingDocument.title}
                                  onChange={(e) => setEditingDocument({ ...editingDocument, title: e.target.value })}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  autoFocus
                                />
                                <div className="flex flex-wrap gap-1">
                                  {assetTypes.map(type => {
                                    const TypeIcon = getIconForAssetType(type.typeName);
                                    return (
                                      <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => setEditingDocument({ ...editingDocument, objectAssetTypeId: type.id })}
                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                                          editingDocument.objectAssetTypeId === type.id
                                            ? 'bg-orange-100 text-orange-700 border border-orange-300'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                      >
                                        <TypeIcon className="w-3 h-3" />
                                        {type.displayName}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-gray-500">Sort:</label>
                                  <input
                                    type="number"
                                    value={editingDocument.sortOrder}
                                    onChange={(e) => setEditingDocument({ ...editingDocument, sortOrder: parseInt(e.target.value) || 0 })}
                                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                                    min="0"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 flex-wrap">
                                {doc.assetTypeDisplayName && (
                                  <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded capitalize">{doc.assetTypeDisplayName}</span>
                                )}
                                <p className="font-medium text-gray-900 truncate">{doc.title}</p>
                              </div>
                            )}
                            <p className="text-sm text-gray-500 truncate">{doc.fileName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {doc.isPublic ? (
                                <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                                  <Eye className="w-3 h-3" /> Public
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                  <EyeOff className="w-3 h-3" /> Registered Only
                                </span>
                              )}
                              {doc.fileSize && (
                                <span className="text-xs text-gray-400">
                                  {(doc.fileSize / 1024).toFixed(0)} KB
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {editingDocument?.id === doc.id ? (
                            <>
                              <button
                                onClick={() => setEditingDocument({ ...editingDocument, isPublic: !editingDocument.isPublic })}
                                className={`p-2 rounded ${editingDocument.isPublic ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'}`}
                                title={editingDocument.isPublic ? 'Make Private' : 'Make Public'}
                              >
                                {editingDocument.isPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleUpdateDocument(doc.id, { title: editingDocument.title, isPublic: editingDocument.isPublic, objectAssetTypeId: editingDocument.objectAssetTypeId, sortOrder: editingDocument.sortOrder })}
                                className="p-2 text-green-600 hover:bg-green-50 rounded"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingDocument(null)}
                                className="p-2 text-gray-400 hover:bg-gray-100 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <a
                                href={getSharedAssetUrl(doc.fileUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                title="Open Document"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => setEditingDocument({ id: doc.id, title: doc.title, isPublic: doc.isPublic, objectAssetTypeId: doc.objectAssetTypeId, sortOrder: doc.sortOrder || 0 })}
                                className="p-2 text-gray-400 hover:bg-gray-100 rounded"
                                title="Edit"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteDocument(doc.id)}
                                disabled={deletingDocumentId === doc.id}
                                className="p-2 text-red-400 hover:bg-red-50 rounded disabled:opacity-50"
                                title="Delete"
                              >
                                {deletingDocumentId === doc.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Document Form */}
              {showAddDocument && (
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <div className="space-y-3">
                    {/* Document Type Selector */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Document Type *</label>
                      {assetTypes.length === 0 ? (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                          No document types available. Please run Migration_098_ObjectAssets.sql.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                          {assetTypes.map(type => {
                            const IconComponent = getIconForAssetType(type.typeName);
                            const colors = getColorForAssetType(type.colorClass);
                            return (
                              <button
                                key={type.id}
                                type="button"
                                onClick={() => setNewDocument({ ...newDocument, objectAssetTypeId: type.id })}
                                className={`p-2 rounded-lg border-2 text-center transition-all ${
                                  newDocument.objectAssetTypeId === type.id
                                    ? 'border-orange-500 bg-orange-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className={`mx-auto w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center mb-1`}>
                                  <IconComponent className={`w-4 h-4 ${colors.text}`} />
                                </div>
                                <span className={`text-xs font-medium ${
                                  newDocument.objectAssetTypeId === type.id ? 'text-orange-700' : 'text-gray-600'
                                }`}>{type.displayName}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Document Title *</label>
                      <input
                        type="text"
                        value={newDocument.title}
                        onChange={(e) => setNewDocument({ ...newDocument, title: e.target.value })}
                        placeholder="e.g., Tournament Rules, Schedule, Waiver Form"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newDocument.isPublic}
                          onChange={(e) => setNewDocument({ ...newDocument, isPublic: e.target.checked })}
                          className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                        />
                        <span className="text-sm text-gray-700">Public (visible to everyone)</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700">Sort Order:</label>
                        <input
                          type="number"
                          value={newDocument.sortOrder}
                          onChange={(e) => setNewDocument({ ...newDocument, sortOrder: parseInt(e.target.value) || 0 })}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex-1">
                        <input
                          type="file"
                          onChange={handleDocumentUpload}
                          disabled={uploadingDocument || !newDocument.title.trim() || !newDocument.objectAssetTypeId}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.rtf,.png,.jpg,.jpeg,.md,.html,.htm"
                        />
                        <span className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                          uploadingDocument || !newDocument.title.trim() || !newDocument.objectAssetTypeId
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-orange-600 text-white hover:bg-orange-700'
                        }`}>
                          {uploadingDocument ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4" />
                              Select & Upload File
                            </>
                          )}
                        </span>
                      </label>
                      <button
                        onClick={() => {
                          setShowAddDocument(false);
                          setNewDocument({ title: '', isPublic: true, sortOrder: 0, objectAssetTypeId: null });
                        }}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Accepted formats: PDF, Word, Excel, text files, images. Max 10MB.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Proof Modal */}
        {viewingProofUrl && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
              {/* Sticky header */}
              <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
                <h3 className="font-semibold">Payment Proof</h3>
                <button
                  onClick={() => setViewingProofUrl(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {/* Scrollable image area */}
              <div className="p-4 overflow-auto flex-1 flex items-center justify-center">
                <img
                  src={getSharedAssetUrl(viewingProofUrl)}
                  alt="Payment proof"
                  className="max-w-full max-h-[60vh] object-contain"
                />
              </div>
              {/* Sticky footer */}
              <div className="p-4 border-t flex justify-end gap-2 flex-shrink-0">
                <a
                  href={getSharedAssetUrl(viewingProofUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Full Size
                </a>
                <button
                  onClick={() => setViewingProofUrl(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Staff Tab */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Staff Management</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadStaff}
                  disabled={loadingStaff}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                >
                  <RefreshCw className={`w-5 h-5 ${loadingStaff ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={openAddStaffModal}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Staff
                </button>
              </div>
            </div>

            {/* Pending Staff Approvals */}
            {pendingStaff.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <h3 className="font-medium text-yellow-900 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Pending Approvals ({pendingStaff.length})
                </h3>
                <div className="space-y-2">
                  {pendingStaff.map(staff => (
                    <div key={staff.id} className="flex items-center justify-between bg-white rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{staff.userName || staff.userEmail}</div>
                          <div className="text-sm text-gray-500">{staff.roleName}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveStaff(staff.id)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                          title="Approve"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeclineStaff(staff.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Decline"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Staff List */}
            <div className="bg-white rounded-xl shadow-sm">
              <div className="p-4 border-b">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  Event Staff ({staffList.length})
                </h3>
              </div>
              {loadingStaff ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
                  <p className="text-gray-500 mt-2">Loading staff...</p>
                </div>
              ) : staffList.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No staff assigned to this event</p>
                  <p className="text-sm text-gray-400 mt-1">Click "Add Staff" to invite team members</p>
                </div>
              ) : (
                <div className="divide-y">
                  {staffList.map(staff => (
                    <div key={staff.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                      <Link 
                        to={`/member/${staff.userId}`}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                      >
                        {staff.userProfileImageUrl ? (
                          <img
                            src={staff.userProfileImageUrl}
                            alt={staff.userName || 'Staff'}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = '';
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"
                          style={{ display: staff.userProfileImageUrl ? 'none' : 'flex' }}
                        >
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 hover:text-orange-600">{staff.userName || staff.userEmail}</div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                              {staff.roleName}
                            </span>
                            {staff.status && staff.status !== 'Active' && (
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                staff.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {staff.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditStaffModal(staff)}
                          className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                          title="Edit role"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveStaff(staff.id)}
                          className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                          title="Remove staff"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Edit Staff Modal */}
            {editingStaff && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                  <div className="p-6 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">Edit Staff Role</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Change role for {editingStaff.userName || editingStaff.userEmail}
                    </p>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                      <select
                        value={editStaffForm.roleId}
                        onChange={(e) => setEditStaffForm({ ...editStaffForm, roleId: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">Select a role</option>
                        {staffRoles.map(role => (
                          <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                    <button
                      onClick={() => setEditingStaff(null)}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateStaff}
                      disabled={savingStaffEdit || !editStaffForm.roleId}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {savingStaffEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Available Roles Reference */}
            <div className="bg-white rounded-xl shadow-sm">
              <div className="p-4 border-b">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Available Roles & Permissions
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Reference guide for assigning staff to appropriate roles
                </p>
              </div>
              <div className="divide-y">
                {staffRoles.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No roles configured. Contact an admin to set up staff roles.
                  </div>
                ) : (
                  staffRoles.map(role => (
                    <div key={role.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{role.name}</span>
                            {role.canFullyManageEvent && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                                Full Admin
                              </span>
                            )}
                            {!role.allowSelfRegistration && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                                Admin Assign
                              </span>
                            )}
                          </div>
                          {role.description && (
                            <p className="text-sm text-gray-500 mt-1">{role.description}</p>
                          )}
                        </div>
                      </div>
                      {/* Permission badges */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {role.canManageSchedule && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
                            <Calendar className="w-3 h-3" /> Schedule
                          </span>
                        )}
                        {role.canManageCourts && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded">
                            <MapPin className="w-3 h-3" /> Courts
                          </span>
                        )}
                        {role.canRecordScores && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 text-xs rounded">
                            <ClipboardList className="w-3 h-3" /> Scores
                          </span>
                        )}
                        {role.canCheckInPlayers && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 text-teal-700 text-xs rounded">
                            <UserCheck className="w-3 h-3" /> Check-in
                          </span>
                        )}
                        {role.canManageLineups && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded">
                            <Users className="w-3 h-3" /> Lineups
                          </span>
                        )}
                        {role.canViewAllData && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                            <Eye className="w-3 h-3" /> View All
                          </span>
                        )}
                        {role.canManagePayments && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded">
                            <DollarSign className="w-3 h-3" /> Payments
                          </span>
                        )}
                        {!role.canManageSchedule && !role.canManageCourts && !role.canRecordScores &&
                         !role.canCheckInPlayers && !role.canManageLineups && !role.canViewAllData &&
                         !role.canManagePayments && !role.canFullyManageEvent && (
                          <span className="text-xs text-gray-400 italic">No specific permissions</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Staff Modal */}
        {showAddStaffModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Add Staff Member</h3>
              </div>

              {/* Tabs */}
              <div className="flex border-b">
                <button
                  onClick={() => {
                    setStaffModalTab('friends');
                    setAddStaffForm(prev => ({ ...prev, email: '', userId: null }));
                  }}
                  className={`flex-1 px-4 py-3 text-sm font-medium ${
                    staffModalTab === 'friends'
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Users className="w-4 h-4 inline mr-2" />
                  My Friends
                </button>
                <button
                  onClick={() => {
                    setStaffModalTab('email');
                    setAddStaffForm(prev => ({ ...prev, email: '', userId: null }));
                  }}
                  className={`flex-1 px-4 py-3 text-sm font-medium ${
                    staffModalTab === 'email'
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  By Email
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Friends Tab */}
                {staffModalTab === 'friends' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Friend</label>
                    {loadingFriends ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                      </div>
                    ) : friendsList.length === 0 ? (
                      <div className="text-center py-6 text-gray-500">
                        <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No friends yet</p>
                        <p className="text-xs mt-1">Add friends to quickly invite them as staff</p>
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                        {friendsList.map(friend => {
                          const friendUserId = friend.friendUserId || friend.id;
                          const isSelected = addStaffForm.userId === friendUserId;
                          return (
                            <button
                              key={friend.id}
                              onClick={() => setAddStaffForm(prev => ({
                                ...prev,
                                userId: friendUserId,
                                email: ''
                              }))}
                              className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 ${
                                isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                              }`}
                            >
                              {friend.profileImageUrl ? (
                                <img
                                  src={getSharedAssetUrl(friend.profileImageUrl)}
                                  alt=""
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                  <User className="w-4 h-4 text-gray-500" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 text-sm truncate">{friend.name}</p>
                                {friend.experienceLevel && (
                                  <p className="text-xs text-gray-500">{friend.experienceLevel}</p>
                                )}
                              </div>
                              {isSelected && (
                                <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Email Tab */}
                {staffModalTab === 'email' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={addStaffForm.email}
                      onChange={(e) => setAddStaffForm(prev => ({ ...prev, email: e.target.value, userId: null }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      placeholder="staff@example.com"
                    />
                  </div>
                )}

                {/* Role Selection (always shown) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={addStaffForm.roleId}
                    onChange={(e) => setAddStaffForm(prev => ({ ...prev, roleId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select role...</option>
                    {staffRoles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
                <button
                  onClick={() => {
                    setShowAddStaffModal(false);
                    setAddStaffForm({ email: '', roleId: '', userId: null });
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddStaff}
                  disabled={addingStaff || (!addStaffForm.email && !addStaffForm.userId) || !addStaffForm.roleId}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {addingStaff ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add Staff
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Planning Tab - Court/Pool assignments for divisions */}
        {activeTab === 'planning' && (
          <div className="space-y-6">
            {/* Header with actions */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Scheduling & Planning</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAutoScheduleAll}
                  disabled={autoScheduling || backendScheduling}
                  className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 flex items-center gap-2 text-sm font-semibold shadow-sm"
                >
                  {autoScheduling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  Auto-Schedule All
                </button>
                <Link
                  to={`/tournament/${eventId}/schedule-dashboard`}
                  className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 flex items-center gap-2 text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  Schedule Dashboard
                </Link>
                <Link
                  to={`/event/${eventId}/auto-scheduler`}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  Advanced
                </Link>
                <button
                  onClick={() => {
                    loadCourtGroups();
                    if (planningDivisionId) {
                      loadDivisionPhases(parseInt(planningDivisionId));
                    }
                    handleLoadScheduleGrid();
                  }}
                  disabled={loadingPhases || loadingGrid}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <RefreshCw className={`w-5 h-5 ${(loadingPhases || loadingGrid) ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Division selector with per-division Generate button */}
            {(() => {
              const divisionsWithRegs = dashboard?.divisions?.filter(d => d.registeredUnits > 0) || [];
              return divisionsWithRegs.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 items-center">
                  {divisionsWithRegs.map(div => (
                    <div key={div.id} className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setPlanningDivisionId(String(div.id));
                          setSelectedPlanningPhaseId('');
                          loadDivisionPhases(div.id);
                          setSchedulingResults(null);
                          setValidationData(null);
                        }}
                        className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                          planningDivisionId === String(div.id)
                            ? 'bg-orange-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-50 border'
                        }`}
                      >
                        {div.name}
                        <span className="ml-1.5 text-xs opacity-75">({div.registeredUnits})</span>
                      </button>
                      {planningDivisionId === String(div.id) && (
                        <button
                          onClick={() => handleGenerateScheduleForDivision(div)}
                          disabled={backendScheduling}
                          className="px-2.5 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 disabled:opacity-50 text-xs font-medium flex items-center gap-1 whitespace-nowrap"
                          title={`Generate schedule for ${div.name}`}
                        >
                          {backendScheduling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shuffle className="w-3 h-3" />}
                          Generate
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            {!planningDivisionId && (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Select a division above to start scheduling</p>
              </div>
            )}

            {planningDivisionId && (
              <>
                {/* Section 1: Division Phase Overview */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b flex items-center justify-between">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-blue-500" />
                      Division Phases
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowPhaseManager(!showPhaseManager)}
                        className="px-3 py-1.5 text-sm bg-white text-blue-700 rounded-lg hover:bg-blue-50 border border-blue-200 flex items-center gap-1"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Configure Phases
                      </button>
                    </div>
                  </div>

                  {/* PhaseManager modal-like section */}
                  {showPhaseManager && (
                    <div className="border-b bg-gray-50 p-4">
                      <PhaseManager
                        divisionId={parseInt(planningDivisionId)}
                        eventId={parseInt(eventId)}
                        unitCount={dashboard?.divisions?.find(d => d.id === parseInt(planningDivisionId))?.registeredUnits || 8}
                      />
                    </div>
                  )}

                  <div className="p-4">
                    {loadingPhases ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        <span className="ml-2 text-gray-500 text-sm">Loading phases...</span>
                      </div>
                    ) : planningDivisionPhases.length === 0 ? (
                      <div className="text-center py-6">
                        <Layers className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm mb-3">No phases configured for this division</p>
                        <button
                          onClick={() => setShowPhaseManager(true)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        >
                          <Plus className="w-4 h-4 inline mr-1" />
                          Add Phases
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {planningDivisionPhases.map(phase => {
                          const totalEncounters = phase.encounterCount || phase.encounters?.length || 0;
                          const scheduledCount = phase.scheduledCount || 0;
                          const unscheduledCount = totalEncounters - scheduledCount;
                          const isCompleted = phase.status === 'Completed';
                          const statusColors = {
                            Pending: 'bg-gray-100 text-gray-700',
                            InProgress: 'bg-blue-100 text-blue-700',
                            Completed: 'bg-green-100 text-green-700',
                            Locked: 'bg-purple-100 text-purple-700',
                          };

                          return (
                            <div key={phase.id} className={`p-4 rounded-lg border ${
                              selectedPlanningPhaseId === String(phase.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                            }`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => setSelectedPlanningPhaseId(
                                      selectedPlanningPhaseId === String(phase.id) ? '' : String(phase.id)
                                    )}
                                    className="text-left"
                                  >
                                    <div className="font-medium text-gray-900">{phase.name}</div>
                                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                      <span>{phase.phaseType}</span>
                                      <span>•</span>
                                      <span>{totalEncounters} encounters</span>
                                      {totalEncounters > 0 && (
                                        <>
                                          <span>•</span>
                                          <span className="text-green-600">{scheduledCount} scheduled</span>
                                          {unscheduledCount > 0 && (
                                            <>
                                              <span>•</span>
                                              <span className="text-yellow-600">{unscheduledCount} unscheduled</span>
                                            </>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </button>
                                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusColors[phase.status] || 'bg-gray-100 text-gray-700'}`}>
                                    {phase.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {totalEncounters === 0 && (
                                    <button
                                      onClick={() => handleGeneratePhaseEncounters(phase.id)}
                                      disabled={generatingPhaseEncounters === phase.id}
                                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                                    >
                                      {generatingPhaseEncounters === phase.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Play className="w-3.5 h-3.5" />
                                      )}
                                      Generate Encounters
                                    </button>
                                  )}
                                  {isCompleted && (
                                    <button
                                      onClick={() => setAdvancementPhaseId(advancementPhaseId === phase.id ? null : phase.id)}
                                      className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 flex items-center gap-1"
                                    >
                                      <Award className="w-3.5 h-3.5" />
                                      Advance Winners
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Phase Advancement Config */}
                              {advancementPhaseId === phase.id && (
                                <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                                  <h4 className="text-sm font-medium text-purple-800 mb-2">Phase Advancement</h4>
                                  <p className="text-xs text-purple-600 mb-3">
                                    Auto-generate advancement rules to move winners to the next phase.
                                  </p>
                                  {planningDivisionPhases.filter(p => p.sortOrder > phase.sortOrder).length > 0 ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-gray-700">Advance to:</span>
                                      {planningDivisionPhases
                                        .filter(p => p.sortOrder > phase.sortOrder)
                                        .map(targetPhase => (
                                          <button
                                            key={targetPhase.id}
                                            onClick={() => handleGenerateAdvancementRules(targetPhase.id, phase.id)}
                                            disabled={generatingAdvancement}
                                            className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                                          >
                                            {generatingAdvancement ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                                            {targetPhase.name}
                                          </button>
                                        ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500">No subsequent phases to advance to.</p>
                                  )}
                                </div>
                              )}

                              {/* Progress bar */}
                              {totalEncounters > 0 && (
                                <div className="mt-2">
                                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div
                                      className="bg-green-500 h-1.5 rounded-full transition-all"
                                      style={{ width: `${totalEncounters > 0 ? (scheduledCount / totalEncounters) * 100 : 0}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 2: Court Group Assignment */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b flex items-center justify-between">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <Grid3X3 className="w-5 h-5 text-green-500" />
                      Court Assignment
                      <span className="text-xs text-gray-500 font-normal">({courtGroups.length} groups)</span>
                    </h3>
                    <button
                      onClick={() => setCourtAssignmentMode(!courtAssignmentMode)}
                      className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 ${
                        courtAssignmentMode
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-white text-green-700 hover:bg-green-50 border border-green-200'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {courtAssignmentMode ? 'Close' : 'Assign Courts'}
                    </button>
                  </div>

                  {courtAssignmentMode && (
                    <div className="p-4 space-y-4">
                      {courtGroups.length === 0 ? (
                        <div className="text-center py-4">
                          <p className="text-sm text-gray-500 mb-2">No court groups configured.</p>
                          <button
                            onClick={() => setActiveTab('courts')}
                            className="text-sm text-orange-600 hover:underline"
                          >
                            Go to Courts tab to create groups →
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {courtGroups.map(group => (
                              <button
                                key={group.id}
                                onClick={() => {
                                  setSelectedCourtGroupsForAssignment(prev =>
                                    prev.includes(group.id)
                                      ? prev.filter(id => id !== group.id)
                                      : [...prev, group.id]
                                  );
                                }}
                                className={`p-3 rounded-lg border text-left transition-colors ${
                                  selectedCourtGroupsForAssignment.includes(group.id)
                                    ? 'border-green-400 bg-green-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="font-medium text-sm">{group.groupName}</div>
                                <div className="text-xs text-gray-500">{group.courtCount || group.courts?.length || 0} courts</div>
                              </button>
                            ))}
                          </div>

                          <div className="flex flex-wrap items-end gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Valid From (optional)</label>
                              <input
                                type="time"
                                value={courtAssignmentTimeFrom}
                                onChange={(e) => setCourtAssignmentTimeFrom(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Valid To (optional)</label>
                              <input
                                type="time"
                                value={courtAssignmentTimeTo}
                                onChange={(e) => setCourtAssignmentTimeTo(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                              />
                            </div>
                            <button
                              onClick={handleAssignCourtGroupsToDivision}
                              disabled={assigningCourts || selectedCourtGroupsForAssignment.length === 0}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm flex items-center gap-1"
                            >
                              {assigningCourts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              Assign Selected Groups
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Current court summary */}
                  {!courtAssignmentMode && courtGroups.length > 0 && (
                    <div className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {courtGroups.map(group => (
                          <span key={group.id} className="px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                            {group.groupName}: {group.courtCount || group.courts?.length || 0} courts
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 3: Auto-Schedule */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-orange-500" />
                      Generate Schedule
                    </h3>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Division info from settings */}
                    {(() => {
                      const div = dashboard?.divisions?.find(d => d.id === parseInt(planningDivisionId));
                      return div && (
                        <div className="flex flex-wrap gap-4 p-3 bg-gray-50 rounded-lg text-sm">
                          <div>
                            <span className="text-gray-500">Match Duration:</span>{' '}
                            <span className="font-medium">{div.estimatedMatchDurationMinutes || 15} min</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Rest Time:</span>{' '}
                            <span className="font-medium">{div.minRestTimeMinutes || 5} min</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Teams:</span>{' '}
                            <span className="font-medium">{div.registeredUnits}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Phase filter */}
                    {planningDivisionPhases.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phase (optional)</label>
                        <select
                          value={selectedPlanningPhaseId}
                          onChange={(e) => setSelectedPlanningPhaseId(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="">All Phases</option>
                          {planningDivisionPhases.map(phase => (
                            <option key={phase.id} value={phase.id}>
                              {phase.name} ({phase.encounterCount || 0} encounters)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Schedule options */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                        <input
                          type="time"
                          value={schedulingStartTime}
                          onChange={(e) => setSchedulingStartTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <div className="flex items-center gap-4 pt-6">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={schedulingClearExisting}
                            onChange={(e) => setSchedulingClearExisting(e.target.checked)}
                            className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                          />
                          Clear existing
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={schedulingRespectOverlap}
                            onChange={(e) => setSchedulingRespectOverlap(e.target.checked)}
                            className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                          />
                          Avoid player overlap
                        </label>
                      </div>
                      <div className="flex items-end gap-2">
                        <button
                          onClick={handleBackendScheduleGenerate}
                          disabled={backendScheduling || !planningDivisionId}
                          className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                        >
                          {backendScheduling ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Shuffle className="w-4 h-4" />
                          )}
                          Generate Schedule
                        </button>
                        <button
                          onClick={handleClearSchedule}
                          disabled={clearingSchedule || !planningDivisionId}
                          className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 flex items-center gap-1"
                          title="Clear schedule"
                        >
                          {clearingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Scheduling Results */}
                    {schedulingResults && (
                      <div className={`p-4 rounded-lg ${schedulingResults.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                        {schedulingResults.error ? (
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <div className="font-medium text-red-800">Scheduling failed</div>
                              <div className="text-sm text-red-600 mt-1">{schedulingResults.error}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <div className="font-medium text-green-800">
                                {schedulingResults.message || 'Schedule generated successfully'}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                                {schedulingResults.assignedCount !== undefined && (
                                  <div className="text-sm">
                                    <span className="text-gray-500">Assigned:</span>{' '}
                                    <span className="font-medium text-green-700">{schedulingResults.assignedCount}</span>
                                  </div>
                                )}
                                {schedulingResults.unassignedCount !== undefined && schedulingResults.unassignedCount > 0 && (
                                  <div className="text-sm">
                                    <span className="text-gray-500">Unassigned:</span>{' '}
                                    <span className="font-medium text-yellow-700">{schedulingResults.unassignedCount}</span>
                                  </div>
                                )}
                                {schedulingResults.courtsUsed !== undefined && (
                                  <div className="text-sm">
                                    <span className="text-gray-500">Courts used:</span>{' '}
                                    <span className="font-medium">{schedulingResults.courtsUsed}</span>
                                  </div>
                                )}
                                {schedulingResults.conflictCount !== undefined && schedulingResults.conflictCount > 0 && (
                                  <div className="text-sm">
                                    <span className="text-gray-500">Conflicts:</span>{' '}
                                    <span className="font-medium text-red-600">{schedulingResults.conflictCount}</span>
                                  </div>
                                )}
                              </div>
                              {schedulingResults.conflicts?.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {schedulingResults.conflicts.slice(0, 5).map((c, i) => (
                                    <div key={i} className="text-xs text-red-600">⚠ {c.message || c}</div>
                                  ))}
                                  {schedulingResults.conflicts.length > 5 && (
                                    <div className="text-xs text-gray-500">...and {schedulingResults.conflicts.length - 5} more</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 4: Visual Schedule Grid & Validation */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-violet-50 border-b flex items-center justify-between">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <Eye className="w-5 h-5 text-purple-500" />
                      Visual Schedule Grid
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLoadValidation()}
                        disabled={loadingScheduleValidation}
                        className="px-3 py-1.5 text-sm bg-white text-purple-700 rounded-lg hover:bg-purple-50 border border-purple-200 flex items-center gap-1"
                      >
                        {loadingScheduleValidation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                        Validate
                      </button>
                      <button
                        onClick={handleLoadScheduleGrid}
                        disabled={loadingGrid}
                        className="px-3 py-1.5 text-sm bg-white text-purple-700 rounded-lg hover:bg-purple-50 border border-purple-200 flex items-center gap-1"
                      >
                        {loadingGrid ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LayoutGrid className="w-3.5 h-3.5" />}
                        {scheduleGrid ? 'Refresh Grid' : 'Load Grid'}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Validation results */}
                    {validationData && (
                      <div className={`p-4 rounded-lg ${
                        (validationData.conflicts?.length || 0) === 0 && (validationData.warnings?.length || 0) === 0
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-yellow-50 border border-yellow-200'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          {(validationData.conflicts?.length || 0) === 0 && (validationData.warnings?.length || 0) === 0 ? (
                            <>
                              <CheckCircle className="w-5 h-5 text-green-500" />
                              <span className="font-medium text-green-800">Schedule is valid — no conflicts found</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-5 h-5 text-yellow-500" />
                              <span className="font-medium text-yellow-800">
                                {validationData.conflicts?.length || 0} conflict(s), {validationData.warnings?.length || 0} warning(s)
                              </span>
                            </>
                          )}
                        </div>

                        {validationData.conflicts?.length > 0 && (
                          <div className="space-y-1 mt-2">
                            <div className="text-xs font-medium text-red-700 uppercase tracking-wider">Conflicts</div>
                            {validationData.conflicts.map((c, i) => (
                              <div key={i} className="text-sm text-red-600 flex items-start gap-1.5">
                                <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                <span>{c.message || c.description || JSON.stringify(c)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {validationData.warnings?.length > 0 && (
                          <div className="space-y-1 mt-2">
                            <div className="text-xs font-medium text-yellow-700 uppercase tracking-wider">Warnings</div>
                            {validationData.warnings.map((w, i) => (
                              <div key={i} className="text-sm text-yellow-700 flex items-start gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                <span>{w.message || w.description || JSON.stringify(w)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Summary stats */}
                        {(validationData.totalScheduled !== undefined || validationData.totalUnscheduled !== undefined) && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-200">
                            {validationData.totalScheduled !== undefined && (
                              <div className="text-sm">
                                <span className="text-gray-500">Scheduled:</span>{' '}
                                <span className="font-medium text-green-700">{validationData.totalScheduled}</span>
                              </div>
                            )}
                            {validationData.totalUnscheduled !== undefined && (
                              <div className="text-sm">
                                <span className="text-gray-500">Unscheduled:</span>{' '}
                                <span className="font-medium text-yellow-700">{validationData.totalUnscheduled}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Drag-and-Drop Schedule Grid */}
                    <ScheduleGridInline
                      gridData={scheduleGrid}
                      loading={loadingGrid}
                      onMoveEncounter={handleMoveEncounterInGrid}
                      onRefresh={handleLoadScheduleGrid}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}


        {/* Scoring Tab - merged into Overview, keeping for backwards compatibility */}
        {activeTab === 'scoring' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Score Management</h2>
              <button
                onClick={loadDashboard}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {/* Scoring stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="text-2xl font-bold text-gray-900">
                  {dashboard?.stats?.completedMatches || 0}
                </div>
                <div className="text-sm text-gray-500">Completed</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="text-2xl font-bold text-orange-600">
                  {dashboard?.stats?.inProgressGames || 0}
                </div>
                <div className="text-sm text-gray-500">In Progress</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="text-2xl font-bold text-gray-900">
                  {(dashboard?.stats?.totalMatches || 0) - (dashboard?.stats?.completedMatches || 0) - (dashboard?.stats?.inProgressGames || 0)}
                </div>
                <div className="text-sm text-gray-500">Pending</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="text-2xl font-bold text-gray-900">
                  {dashboard?.stats?.totalMatches || 0}
                </div>
                <div className="text-sm text-gray-500">Total Matches</div>
              </div>
            </div>

            {/* Scoring workflow explanation */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-gray-900 mb-4">Score Submission Workflow</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-medium">1</div>
                  <div>
                    <div className="font-medium text-gray-900">Game Assigned to Court</div>
                    <div className="text-sm text-gray-500">Tournament director assigns a game to an available court</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-medium">2</div>
                  <div>
                    <div className="font-medium text-gray-900">Players Notified</div>
                    <div className="text-sm text-gray-500">Both teams receive notification to report to their assigned court</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-medium">3</div>
                  <div>
                    <div className="font-medium text-gray-900">Score Submitted</div>
                    <div className="text-sm text-gray-500">After the game, one team submits the score</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-medium">4</div>
                  <div>
                    <div className="font-medium text-gray-900">Score Confirmed</div>
                    <div className="text-sm text-gray-500">The opposing team confirms the score, completing the game</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Score Submission</span>
              </div>
              <p className="text-sm">
                Players submit and confirm scores from their Events page. When a score is disputed,
                the tournament director can manually enter the correct score.
              </p>
            </div>
          </div>
        )}

        {/* Game Day Tab */}
        {activeTab === 'gamedayexec' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Game Day Manager</h2>
            </div>

            {/* Game Day Manager Link Card */}
            <Link
              to={`/gameday/${eventId}/manage`}
              className="block bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="p-4 bg-blue-100 rounded-xl">
                  <Play className="w-8 h-8 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Open Game Day Manager</h3>
                  <p className="text-gray-600 mt-1">
                    Manage live games, courts, and real-time scoring during the event
                  </p>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-400 rotate-[-90deg]" />
              </div>
            </Link>

            {/* Quick Info */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-gray-500" />
                  Game Day Features
                </h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Create and manage ad-hoc games
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Assign games to courts in real-time
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Live score tracking and updates
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    View games by court or division
                  </li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-3">When to Use</h3>
                <p className="text-sm text-blue-700">
                  Use the Game Day Manager during your tournament for quick game creation,
                  court assignments, and live scoring. This is ideal for managing the flow of
                  games on event day.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Schedule Configuration Modal */}
      <ScheduleConfigModal
        isOpen={scheduleConfigModal.isOpen}
        onClose={() => setScheduleConfigModal({ isOpen: false, division: null })}
        division={scheduleConfigModal.division}
        onGenerate={handleGenerateSchedule}
        isGenerating={generatingSchedule}
      />

      {/* Game Settings Modal (Formats per phase/match) */}
      <GameSettingsModal
        isOpen={gameSettingsModal.isOpen}
        onClose={() => setGameSettingsModal({ isOpen: false, division: null })}
        division={gameSettingsModal.division}
        eventId={eventId}
        onSave={() => loadDashboard()}
      />

      {/* Public Profile Modal */}
      {profileModalUserId && (
        <PublicProfileModal
          userId={profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
        />
      )}

      {/* Game Score Edit Modal */}
      {selectedGameForEdit && (
        <GameScoreModal
          game={selectedGameForEdit}
          courts={dashboard?.courts || []}
          divisionUnits={divisionUnits}
          onClose={() => setSelectedGameForEdit(null)}
          onSuccess={() => {
            setSelectedGameForEdit(null);
            loadSchedule(selectedDivision?.id);
            loadDashboard();
          }}
          onPlayerClick={(userId) => setProfileModalUserId(userId)}
          onSaveScore={selectedGameForEdit.hasGames ? async (gameId, unit1Score, unit2Score, finish) => {
            await tournamentApi.adminUpdateScore(gameId, unit1Score, unit2Score, finish);
          } : undefined}
          onAssignCourt={selectedGameForEdit.hasGames ? async (gameId, courtId) => {
            await tournamentApi.assignGameToCourt(gameId, courtId);
          } : undefined}
          onStatusChange={selectedGameForEdit.hasGames ? async (gameId, status) => {
            await tournamentApi.updateGameStatus(gameId, status);
          } : undefined}
          onChangeUnits={handleChangeEncounterUnits}
          readOnly={false}
          isAdmin={user?.role === 'Admin'}
          showAllCourts={true}
          showScoreHistory={true}
          eventId={parseInt(eventId)}
        />
      )}

      {/* Edit Payment Modal */}
      {editingPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-orange-600" />
                <h2 className="text-lg font-semibold">Edit Payment</h2>
              </div>
              <button
                onClick={() => setEditingPayment(null)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-gray-900">
                  {editingPayment.player.firstName} {editingPayment.player.lastName}
                </p>
                <p className="text-gray-500">{editingPayment.player.divisionName}</p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPayment.form.hasPaid}
                    onChange={(e) => updateEditForm('hasPaid', e.target.checked)}
                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Payment Received</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editingPayment.form.amountPaid}
                    onChange={(e) => updateEditForm('amountPaid', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 pl-7 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={editingPayment.form.paymentMethod}
                  onChange={(e) => updateEditForm('paymentMethod', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  {PAYMENT_METHODS.map(method => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Reference</label>
                <input
                  type="text"
                  value={editingPayment.form.paymentReference}
                  onChange={(e) => updateEditForm('paymentReference', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="e.g., Zelle confirmation, transaction ID"
                />
              </div>

              {/* Payment Proof Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Proof</label>
                {editingPayment.form.paymentProofUrl ? (
                  <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <a
                        href={getSharedAssetUrl(editingPayment.form.paymentProofUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        View Proof
                      </a>
                      <button
                        type="button"
                        onClick={() => updateEditForm('paymentProofUrl', '')}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center">
                      {uploadingPaymentProof ? (
                        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-gray-400 mb-1" />
                          <span className="text-xs text-gray-500">Upload screenshot or receipt</span>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={handlePaymentProofUpload}
                      disabled={uploadingPaymentProof}
                    />
                  </label>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingPayment(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditedPayment}
                  disabled={savingPayment}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {savingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Validation Results Modal */}
      {showValidationModal && validationResults && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1010]">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Registration Validation Results</h3>
                <div className="flex gap-4 mt-1 text-sm">
                  {validationResults.totalErrors > 0 && (
                    <span className="text-red-600 font-medium">{validationResults.totalErrors} Errors</span>
                  )}
                  {validationResults.totalWarnings > 0 && (
                    <span className="text-yellow-600 font-medium">{validationResults.totalWarnings} Warnings</span>
                  )}
                  {validationResults.totalInfo > 0 && (
                    <span className="text-blue-600 font-medium">{validationResults.totalInfo} Info</span>
                  )}
                  {validationResults.totalErrors === 0 && validationResults.totalWarnings === 0 && validationResults.totalInfo === 0 && (
                    <span className="text-green-600 font-medium">No issues found!</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowValidationModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {validationResults.issues.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900">All registrations are valid!</p>
                  <p className="text-gray-500">No issues were found with the current registrations.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Group by category */}
                  {validationResults.summary.map(item => (
                    <div key={`${item.category}-${item.severity}`} className="border rounded-lg overflow-hidden">
                      <div className={`px-4 py-2 font-medium flex items-center justify-between ${
                        item.severity === 'Error' ? 'bg-red-50 text-red-800' :
                        item.severity === 'Warning' ? 'bg-yellow-50 text-yellow-800' :
                        'bg-blue-50 text-blue-800'
                      }`}>
                        <span className="flex items-center gap-2">
                          {item.severity === 'Error' && <XCircle className="w-4 h-4" />}
                          {item.severity === 'Warning' && <AlertCircle className="w-4 h-4" />}
                          {item.severity === 'Info' && <Info className="w-4 h-4" />}
                          {item.category}
                        </span>
                        <span className="text-sm">{item.issueCount} issue{item.issueCount !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="divide-y">
                        {validationResults.issues
                          .filter(i => i.category === item.category && i.severity === item.severity)
                          .map((issue, idx) => (
                            <div key={idx} className="px-4 py-2 text-sm">
                              <div className="flex items-center gap-2 flex-wrap">
                                {issue.divisionName && (
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                    {issue.divisionName}
                                  </span>
                                )}
                                {issue.unitName && (
                                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                    {issue.unitName}
                                  </span>
                                )}
                                {issue.userName && (
                                  <button
                                    onClick={() => issue.userId && setProfileModalUserId(issue.userId)}
                                    className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200"
                                  >
                                    {issue.userName}
                                  </button>
                                )}
                              </div>
                              <p className="text-gray-600 mt-1">{issue.message}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t flex justify-end">
              <button
                onClick={() => setShowValidationModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Player Modal */}
      {showAddPlayer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1010]">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Add Player Registration</h3>
              <button
                onClick={() => {
                  setShowAddPlayer(false);
                  setPlayerSearchQuery('');
                  setPlayerSearchResults([]);
                  setSelectedPlayerForReg(null);
                  setSelectedDivisionForReg('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Division Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Division *</label>
                <select
                  value={selectedDivisionForReg}
                  onChange={(e) => setSelectedDivisionForReg(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2"
                >
                  <option value="">Select division...</option>
                  {dashboard?.divisions?.filter(d => d.isActive).map(div => (
                    <option key={div.id} value={div.id}>{div.name}</option>
                  ))}
                </select>
              </div>

              {/* Player Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Player *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={playerSearchQuery}
                    onChange={(e) => {
                      setPlayerSearchQuery(e.target.value);
                      handleSearchPlayers(e.target.value);
                    }}
                    placeholder="Search by name or email..."
                    className="w-full border border-gray-300 rounded-lg p-2 pr-10"
                  />
                  {searchingPlayers && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                  )}
                </div>
              </div>

              {/* Search Results */}
              {playerSearchResults.length > 0 && !selectedPlayerForReg && (
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                  {playerSearchResults.map(player => (
                    <button
                      key={player.userId}
                      onClick={() => {
                        setSelectedPlayerForReg(player);
                        setPlayerSearchQuery(player.name || player.email);
                        setPlayerSearchResults([]);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b last:border-b-0"
                    >
                      {player.profileImageUrl ? (
                        <img
                          src={getSharedAssetUrl(player.profileImageUrl)}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-500" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-900">{player.name || 'Unknown'}</div>
                        <div className="text-sm text-gray-500">{player.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Player */}
              {selectedPlayerForReg && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {selectedPlayerForReg.profileImageUrl ? (
                        <img
                          src={getSharedAssetUrl(selectedPlayerForReg.profileImageUrl)}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-500" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-900">{selectedPlayerForReg.name || 'Unknown'}</div>
                        <div className="text-sm text-gray-500">{selectedPlayerForReg.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPlayerForReg(null);
                        setPlayerSearchQuery('');
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {playerSearchQuery.length > 0 && playerSearchQuery.length < 2 && (
                <p className="text-sm text-gray-500">Type at least 2 characters to search</p>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddPlayer(false);
                  setPlayerSearchQuery('');
                  setPlayerSearchResults([]);
                  setSelectedPlayerForReg(null);
                  setSelectedDivisionForReg('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAdminRegisterPlayer}
                disabled={registeringPlayer || !selectedPlayerForReg || !selectedDivisionForReg}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {registeringPlayer && <Loader2 className="w-4 h-4 animate-spin" />}
                Register Player
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Division Modal */}
      {showEditDivision && editingDivision && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1010]">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{editingDivision.id ? 'Edit Division' : 'Add Division'}</h3>
              <button
                onClick={() => {
                  setShowEditDivision(false);
                  setEditingDivision(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Basic Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Division Name</label>
                <input
                  type="text"
                  value={editingDivision.name || ''}
                  onChange={(e) => setEditingDivision({ ...editingDivision, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editingDivision.description || ''}
                  onChange={(e) => setEditingDivision({ ...editingDivision, description: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg p-2"
                />
              </div>

              {/* Division Classification */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium text-gray-900 mb-3">Division Classification</h4>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Team Format</label>
                    <select
                      value={editingDivision.teamUnitId || ''}
                      onChange={(e) => setEditingDivision({ ...editingDivision, teamUnitId: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full border border-gray-300 rounded-lg p-2"
                    >
                      <option value="">Select format...</option>
                      {teamUnits.map(unit => (
                        <option key={unit.id} value={unit.id}>{unit.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Skill Level</label>
                    <select
                      value={editingDivision.skillLevelId || ''}
                      onChange={(e) => setEditingDivision({ ...editingDivision, skillLevelId: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full border border-gray-300 rounded-lg p-2"
                    >
                      <option value="">Select skill level...</option>
                      {skillLevels.map(level => (
                        <option key={level.id} value={level.id}>{level.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Age Group</label>
                    <select
                      value={editingDivision.ageGroupId || ''}
                      onChange={(e) => setEditingDivision({ ...editingDivision, ageGroupId: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full border border-gray-300 rounded-lg p-2"
                    >
                      <option value="">Select age group...</option>
                      {ageGroups.map(group => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Teams</label>
                  <input
                    type="number"
                    min="1"
                    value={editingDivision.maxUnits || ''}
                    onChange={(e) => setEditingDivision({ ...editingDivision, maxUnits: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Players</label>
                  <input
                    type="number"
                    min="1"
                    value={editingDivision.maxPlayers || ''}
                    onChange={(e) => setEditingDivision({ ...editingDivision, maxPlayers: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Division Fee ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingDivision.divisionFee || ''}
                    onChange={(e) => setEditingDivision({ ...editingDivision, divisionFee: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {editingDivision.id ? 'Single fee for all registrations. Use "Fee Options" below for multiple fee tiers.' : 'Base fee for registrations. You can add fee options after creating the division.'}
                  </p>
                </div>
              </div>

              {/* Division Fee Options - only show when editing existing division */}
              {editingDivision.id && (
                <DivisionFeesEditor
                  divisionId={editingDivision.id}
                  eventId={parseInt(eventId)}
                  divisionFee={editingDivision.divisionFee || 0}
                  onFeesChange={() => loadEvent()}
                />
              )}

              {/* Match Format Configuration - only show when editing existing division */}
              {editingDivision.id && (
                <MatchFormatEditor
                  divisionId={editingDivision.id}
                  onConfigChange={() => loadEvent()}
                />
              )}

              {/* Schedule Status Display */}
              {editingDivision.scheduleStatus && editingDivision.scheduleStatus !== 'NotGenerated' && (
                <div className="border-t pt-4 mt-4">
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <span className="text-sm text-gray-700">
                      Schedule Status: <strong>{editingDivision.scheduleStatus}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditDivision(false);
                  setEditingDivision(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDivision}
                disabled={savingDivision}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
              >
                {savingDivision && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingDivision.id ? 'Save Changes' : 'Create Division'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Modal */}
      {showMapModal && mapAsset && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowMapModal(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowMapModal(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 flex items-center gap-2"
            >
              <X className="w-6 h-6" />
              Close
            </button>
            <img
              src={getSharedAssetUrl(mapAsset.fileUrl)}
              alt="Court Map"
              className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
            />
            <div className="flex justify-center mt-4">
              <a
                href={getSharedAssetUrl(mapAsset.fileUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open in New Tab
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
