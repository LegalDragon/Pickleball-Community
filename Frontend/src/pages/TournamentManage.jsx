import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Users, Trophy, Calendar, Clock, MapPin, Play, Check, X,
  ChevronDown, ChevronUp, RefreshCw, Shuffle, Settings, Target,
  AlertCircle, Loader2, Plus, Edit2, DollarSign, Eye, Share2, LayoutGrid,
  Award, ArrowRight, Lock, Unlock, Save, Map, ExternalLink, FileText, User,
  CheckCircle, XCircle, MoreVertical, Upload, Send, Info, Radio, ClipboardList,
  Download
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useNotifications } from '../hooks/useNotifications';
import { tournamentApi, gameDayApi, eventsApi, objectAssetsApi, checkInApi, sharedAssetApi, getSharedAssetUrl } from '../services/api';
import ScheduleConfigModal from '../components/ScheduleConfigModal';
import PublicProfileModal from '../components/ui/PublicProfileModal';
import GameScoreModal from '../components/ui/GameScoreModal';

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
  const [editingRank, setEditingRank] = useState(null);
  const [showAdvancementPreview, setShowAdvancementPreview] = useState(false);
  const [event, setEvent] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [error, setError] = useState(null);

  // Schedule generation state
  const [generatingSchedule, setGeneratingSchedule] = useState(false);

  // Schedule display state
  const [schedule, setSchedule] = useState(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [selectedGameForEdit, setSelectedGameForEdit] = useState(null); // Game object for score editing
  const [drawingResultsCollapsed, setDrawingResultsCollapsed] = useState(false); // Collapsible drawing results
  const [divisionUnits, setDivisionUnits] = useState([]); // Units for admin unit change

  // Modal states
  const [scheduleConfigModal, setScheduleConfigModal] = useState({ isOpen: false, division: null });

  // Add courts modal state
  const [showAddCourtsModal, setShowAddCourtsModal] = useState(false);
  const [numberOfCourts, setNumberOfCourts] = useState('');
  const [addingCourts, setAddingCourts] = useState(false);
  const [mapAsset, setMapAsset] = useState(null);
  const [showMapModal, setShowMapModal] = useState(false);

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

  useEffect(() => {
    if (eventId) {
      loadDashboard();
      loadEvent();
    }
  }, [eventId]);

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
        loadDashboard();
        if (selectedDivision?.scheduleReady) {
          loadSchedule(selectedDivision.id);
        }
      }
    });

    return () => {
      removeListener();
      leaveEvent(parseInt(eventId));
    };
  }, [eventId, isAuthenticated, connect, joinEvent, leaveEvent, addListener]);

  useEffect(() => {
    if (selectedDivision?.scheduleReady) {
      loadSchedule(selectedDivision.id);
    } else {
      setSchedule(null);
    }
  }, [selectedDivision]);

  const loadDashboard = async () => {
    try {
      const response = await tournamentApi.getDashboard(eventId);
      if (response.success) {
        setDashboard(response.data);
        if (!selectedDivision && response.data.divisions?.length > 0) {
          // Select first division with registrations, or first division if none have registrations
          const divisionsWithRegs = response.data.divisions.filter(d => d.registeredUnits > 0);
          setSelectedDivision(divisionsWithRegs.length > 0 ? divisionsWithRegs[0] : response.data.divisions[0]);
        }
      } else {
        setError(response.message || 'Failed to load tournament dashboard');
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load tournament dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadEvent = async () => {
    try {
      const response = await eventsApi.getEvent(eventId);
      if (response.success) {
        setEvent(response.data);
      }
      // Load map asset for the event (TypeName is lowercase 'map' in database)
      const assetsResponse = await objectAssetsApi.getAssets('Event', eventId);
      if (assetsResponse.success && assetsResponse.data) {
        const map = assetsResponse.data.find(a => a.assetTypeName?.toLowerCase() === 'map');
        setMapAsset(map || null);
      }
    } catch (err) {
      console.error('Error loading event:', err);
    }
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

  const loadSchedule = async (divisionId) => {
    setLoadingSchedule(true);
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
      setLoadingSchedule(false);
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
      const response = await sharedAssetApi.upload(file, assetType, 'payment-proof', true);
      if (response.success && response.url) {
        const fullUrl = getSharedAssetUrl(response.url);
        updateEditForm('paymentProofUrl', fullUrl);
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
                <Link to={`/events/${eventId}`} className="shrink-0">
                  <img
                    src={getSharedAssetUrl(event.posterImageUrl)}
                    alt={event.name || 'Event'}
                    className="w-12 h-12 rounded-lg object-cover hover:opacity-80 transition-opacity"
                  />
                </Link>
              )}
              <div>
                <Link to={`/events/${eventId}`} className="hover:text-orange-600 transition-colors">
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
                  to={`/events/${eventId}`}
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

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto">
            {['overview', 'divisions', 'courts', 'schedule', 'checkin', 'scoring', 'gameday'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'checkin' ? 'Check-in' : tab === 'gameday' ? 'Game Day' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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

            {/* Division Summary - only show divisions with registrations */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Division Status</h2>
              <div className="space-y-4">
                {dashboard?.divisions?.filter(d => d.registeredUnits > 0).map(div => (
                  <div key={div.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{div.name}</h3>
                        <div className="flex gap-4 text-sm text-gray-500 mt-1">
                          <span>{div.registeredUnits} / {div.maxUnits || '∞'} teams</span>
                          {div.waitlistedUnits > 0 && (
                            <span className="text-yellow-600">+{div.waitlistedUnits} waitlisted</span>
                          )}
                          <span>{div.completedMatches} / {div.totalMatches} matches</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {div.scheduleReady ? (
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
                ))}
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

        {/* Divisions Tab - only show divisions with registrations */}
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

            {dashboard?.divisions?.filter(d => d.registeredUnits > 0).map(div => (
              <div key={div.id} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{div.name}</h2>
                    <p className="text-sm text-gray-500">
                      {div.registeredUnits} teams registered
                      {div.scheduleReady && div.totalMatches > 0 && (
                        <span className="ml-2">• {div.totalMatches} matches scheduled</span>
                      )}
                    </p>
                  </div>
                  {isOrganizer && (
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {/* Generate/Re-generate Schedule - disabled after event starts */}
                      {!['Running', 'Started'].includes(dashboard?.tournamentStatus) && (
                        <button
                          onClick={() => handleOpenScheduleConfig(div)}
                          disabled={generatingSchedule}
                          className={`px-3 py-2 text-sm font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 ${
                            div.scheduleReady
                              ? 'text-gray-700 border border-gray-300 hover:bg-gray-50'
                              : 'text-white bg-orange-600 hover:bg-orange-700'
                          }`}
                        >
                          {generatingSchedule ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Calendar className="w-4 h-4" />
                          )}
                          {div.scheduleReady ? 'Re-configure' : 'Configure Schedule'}
                        </button>
                      )}

                      {/* View Schedule - links to printable schedule page */}
                      {div.scheduleReady && (
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
              </div>
            ))}
          </div>
        )}

        {/* Courts Tab */}
        {activeTab === 'courts' && (
          <div className="space-y-6">
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
                  onClick={() => loadDashboard()}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  title="Refresh courts"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
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
                            {court.currentGame.startedAt && (
                              <span className="text-xs text-orange-600 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTimeElapsed(court.currentGame.startedAt)}
                              </span>
                            )}
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
                            {court.nextGame.queuedAt && (
                              <span className="text-xs text-blue-600 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Queued {formatTimeElapsed(court.nextGame.queuedAt)}
                              </span>
                            )}
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
                onClick={loadDashboard}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <RefreshCw className="w-5 h-5" />
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
                                <div className="flex items-center gap-3">
                                  {/* Edit button on far left */}
                                  <button
                                    onClick={() => setSelectedGameForEdit({
                                      id: match.games?.[0]?.gameId || match.games?.[0]?.id || match.encounterId,
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
                                <div className="flex items-center gap-3">
                                  {/* Edit button on far left */}
                                  {!match.isBye && (
                                    <button
                                      onClick={() => setSelectedGameForEdit({
                                        id: match.games?.[0]?.gameId || match.games?.[0]?.id || match.encounterId,
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

        {/* Check-in Tab */}
        {activeTab === 'checkin' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Player Check-in</h2>
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

        {/* Scoring Tab */}
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
        {activeTab === 'gameday' && (
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
          readOnly={!selectedGameForEdit.hasGames}
          isAdmin={user?.role === 'Admin'}
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
                        href={editingPayment.form.paymentProofUrl}
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
