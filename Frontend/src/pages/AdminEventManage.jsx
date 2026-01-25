import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Calendar, MapPin, Building2, Users, DollarSign, Clock,
  Edit2, Eye, EyeOff, Check, X, RefreshCw, AlertTriangle, Save,
  Settings, Play, ClipboardList, Trophy, Layers, Share2, Map,
  ChevronDown, ChevronRight, Loader2, ExternalLink, Bell, UserCheck,
  BarChart3, FileText, Radio, Grid3X3, GitBranch
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { eventsApi, eventTypesApi, venuesApi, tournamentApi } from '../services/api';
import VenuePicker from '../components/ui/VenuePicker';
import PhaseManager from '../components/tournament/PhaseManager';
import SchedulePreview from '../components/tournament/SchedulePreview';

export default function AdminEventManage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [event, setEvent] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [eventTypes, setEventTypes] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Section states
  const [activeSection, setActiveSection] = useState('before'); // 'before' or 'gameday'
  const [expandedSections, setExpandedSections] = useState({
    eventDetails: true,
    venueLocation: true,
    registration: true,
    divisions: false,
    scheduling: false,
    quickActions: true,
    tournamentControl: true,
  });

  const [selectedDivision, setSelectedDivision] = useState(null);

  // Load event data
  useEffect(() => {
    loadEventData();
  }, [eventId]);

  const loadEventData = async () => {
    try {
      setLoading(true);
      const [eventRes, typesRes, dashboardRes] = await Promise.all([
        eventsApi.getEvent(eventId),
        eventTypesApi.list(),
        tournamentApi.getDashboard(eventId).catch(() => ({ success: false }))
      ]);

      if (eventRes.success && eventRes.data) {
        // Check if user can manage this event
        const isAdmin = user?.role === 'Admin';
        const isOrganizer = eventRes.data.organizedByUserId === user?.id;
        if (!isAdmin && !isOrganizer) {
          toast.error('You do not have permission to manage this event');
          navigate(`/event/${eventId}`);
          return;
        }
        setEvent(eventRes.data);
        populateForm(eventRes.data);
      } else {
        toast.error('Event not found');
        navigate(`/event/${eventId}`);
        return;
      }

      if (typesRes.success) {
        setEventTypes(typesRes.data || []);
      }

      if (dashboardRes.success && dashboardRes.data?.divisions) {
        setDivisions(dashboardRes.data.divisions);
        if (dashboardRes.data.divisions.length > 0 && !selectedDivision) {
          setSelectedDivision(dashboardRes.data.divisions[0]);
        }
      }
    } catch (err) {
      console.error('Error loading event:', err);
      toast.error('Failed to load event');
    } finally {
      setLoading(false);
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

  const populateForm = (eventData) => {
    const regOpen = extractDateTime(eventData.registrationOpenDate);
    const regClose = extractDateTime(eventData.registrationCloseDate);
    const startDate = extractDateTime(eventData.startDate);
    const endDate = extractDateTime(eventData.endDate);

    setEditForm({
      name: eventData.name || '',
      description: eventData.description || '',
      eventTypeId: eventData.eventTypeId || '',
      isPublished: eventData.isPublished || false,
      isActive: eventData.isActive || false,
      isPrivate: eventData.isPrivate || false,
      tournamentStatus: eventData.tournamentStatus || '',
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
    });
  };

  const handleFormChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
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

      // Use the regular update endpoint (accessible to organizers)
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
        courtId: editForm.venueId ? parseInt(editForm.venueId) : null,
        venueName: editForm.venueName || null,
        address: editForm.address || null,
        city: editForm.city || null,
        state: editForm.state || null,
        country: editForm.country || null,
        registrationFee: editForm.registrationFee ? parseFloat(editForm.registrationFee) : 0,
        perDivisionFee: editForm.perDivisionFee ? parseFloat(editForm.perDivisionFee) : 0,
        // Preserve existing image URLs
        posterImageUrl: event.posterImageUrl || null,
        bannerImageUrl: event.bannerImageUrl || null,
      };

      const response = await eventsApi.update(eventId, updateData);
      if (!response.success) {
        toast.error(response.message || 'Failed to save event');
        return;
      }

      // Update tournament status separately if changed
      if (editForm.tournamentStatus && editForm.tournamentStatus !== event.tournamentStatus) {
        const statusRes = await tournamentApi.updateTournamentStatus(eventId, editForm.tournamentStatus);
        if (!statusRes.success) {
          toast.warn('Event saved but status update failed');
        }
      }

      toast.success('Event saved successfully');
      setHasUnsavedChanges(false);
      loadEventData();
    } catch (err) {
      toast.error(err.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleVenueChange = async (venue) => {
    if (venue) {
      try {
        const response = await venuesApi.getVenue(venue.id);
        if (response.success && response.data) {
          const fullVenue = response.data;
          setEditForm(prev => ({
            ...prev,
            venueId: venue.id,
            venueName: fullVenue.name || venue.name,
            address: fullVenue.address || '',
            city: fullVenue.city || venue.city || '',
            state: fullVenue.state || venue.state || '',
            country: fullVenue.country || ''
          }));
          setHasUnsavedChanges(true);
          return;
        }
      } catch (err) {
        console.error('Error fetching venue details:', err);
      }
      setEditForm(prev => ({
        ...prev,
        venueId: venue.id,
        venueName: venue.name,
        address: '',
        city: venue.city || '',
        state: venue.state || '',
        country: ''
      }));
    } else {
      setEditForm(prev => ({
        ...prev,
        venueId: '',
        venueName: '',
        address: '',
        city: '',
        state: '',
        country: ''
      }));
    }
    setHasUnsavedChanges(true);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-800';
      case 'RegistrationOpen': return 'bg-green-100 text-green-800';
      case 'RegistrationClosed': return 'bg-yellow-100 text-yellow-800';
      case 'ScheduleReady': return 'bg-blue-100 text-blue-800';
      case 'Drawing': return 'bg-purple-100 text-purple-800';
      case 'Running': return 'bg-orange-100 text-orange-800';
      case 'Completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading event...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-gray-600">Event not found</p>
          <Link to="/admin/events" className="text-blue-600 hover:underline mt-2 block">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to={`/event/${eventId}`}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="Back to Event"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{event.name}</h1>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(editForm.tournamentStatus)}`}>
                    {editForm.tournamentStatus || 'Draft'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">Admin Management</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/event/${eventId}`}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                title="View Public Page"
              >
                <Eye className="w-5 h-5" />
              </Link>
              <button
                onClick={loadEventData}
                disabled={loading}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              {hasUnsavedChanges && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Changes
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveSection('before')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeSection === 'before'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Before Game Day
            </button>
            <button
              onClick={() => setActiveSection('gameday')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeSection === 'gameday'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Play className="w-4 h-4 inline mr-2" />
              Game Day
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeSection === 'before' ? (
          <BeforeGameDaySection
            event={event}
            editForm={editForm}
            eventTypes={eventTypes}
            divisions={divisions}
            selectedDivision={selectedDivision}
            setSelectedDivision={setSelectedDivision}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
            handleFormChange={handleFormChange}
            handleVenueChange={handleVenueChange}
            eventId={eventId}
          />
        ) : (
          <GameDaySection
            event={event}
            editForm={editForm}
            divisions={divisions}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
            handleFormChange={handleFormChange}
            eventId={eventId}
          />
        )}
      </div>
    </div>
  );
}

// =====================================================
// Before Game Day Section
// =====================================================
function BeforeGameDaySection({
  event,
  editForm,
  eventTypes,
  divisions,
  selectedDivision,
  setSelectedDivision,
  expandedSections,
  toggleSection,
  handleFormChange,
  handleVenueChange,
  eventId
}) {
  return (
    <div className="space-y-6">
      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link
          to={`/event/${eventId}/court-planning`}
          className="p-4 bg-white rounded-xl border hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-3"
        >
          <div className="p-2 bg-blue-100 rounded-lg">
            <Map className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="font-medium text-gray-900">Court Planning</div>
            <div className="text-sm text-gray-500">Assign courts & times</div>
          </div>
        </Link>
        <Link
          to={`/event/${eventId}/notifications`}
          className="p-4 bg-white rounded-xl border hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-3"
        >
          <div className="p-2 bg-green-100 rounded-lg">
            <Bell className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="font-medium text-gray-900">Notifications</div>
            <div className="text-sm text-gray-500">Send mass notifications</div>
          </div>
        </Link>
        <Link
          to={`/tournament/${eventId}/manage`}
          className="p-4 bg-white rounded-xl border hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-3"
        >
          <div className="p-2 bg-purple-100 rounded-lg">
            <Trophy className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="font-medium text-gray-900">Tournament Manager</div>
            <div className="text-sm text-gray-500">Full tournament control</div>
          </div>
        </Link>
        <Link
          to={`/event/${eventId}/drawing`}
          className="p-4 bg-white rounded-xl border hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-3"
        >
          <div className="p-2 bg-orange-100 rounded-lg">
            <Radio className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <div className="font-medium text-gray-900">Live Drawing</div>
            <div className="text-sm text-gray-500">Drawing ceremony</div>
          </div>
        </Link>
      </div>

      {/* Event Details Section */}
      <CollapsibleSection
        title="Event Details"
        icon={Edit2}
        expanded={expandedSections.eventDetails}
        onToggle={() => toggleSection('eventDetails')}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
            <input
              type="text"
              value={editForm.name || ''}
              onChange={(e) => handleFormChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
            <select
              value={editForm.eventTypeId || ''}
              onChange={(e) => handleFormChange('eventTypeId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select type...</option>
              {eventTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={editForm.description || ''}
              onChange={(e) => handleFormChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tournament Status</label>
            <select
              value={editForm.tournamentStatus || ''}
              onChange={(e) => handleFormChange('tournamentStatus', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select status...</option>
              <option value="Draft">Draft</option>
              <option value="RegistrationOpen">Registration Open</option>
              <option value="RegistrationClosed">Registration Closed</option>
              <option value="ScheduleReady">Schedule Ready</option>
              <option value="Drawing">Drawing</option>
              <option value="Running">Running</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-6 items-center pt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.isPublished || false}
                onChange={(e) => handleFormChange('isPublished', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Published</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.isActive || false}
                onChange={(e) => handleFormChange('isActive', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.isPrivate || false}
                onChange={(e) => handleFormChange('isPrivate', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Private</span>
            </label>
          </div>
        </div>
      </CollapsibleSection>

      {/* Venue & Location Section */}
      <CollapsibleSection
        title="Venue & Location"
        icon={MapPin}
        expanded={expandedSections.venueLocation}
        onToggle={() => toggleSection('venueLocation')}
      >
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-blue-900 mb-2">
              <Building2 className="w-4 h-4 inline mr-1" />
              Venue Binding
            </label>
            <VenuePicker
              value={editForm.venueId ? {
                id: editForm.venueId,
                name: editForm.venueName,
                city: editForm.city,
                state: editForm.state
              } : null}
              onChange={handleVenueChange}
              label="Select Venue"
              placeholder="Select venue to bind..."
            />
            <p className="text-xs text-blue-700 mt-1">
              Binding a venue will auto-fill the address fields below
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Venue Name</label>
              <input
                type="text"
                value={editForm.venueName || ''}
                onChange={(e) => handleFormChange('venueName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={editForm.address || ''}
                onChange={(e) => handleFormChange('address', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={editForm.city || ''}
                onChange={(e) => handleFormChange('city', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                value={editForm.state || ''}
                onChange={(e) => handleFormChange('state', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input
                type="text"
                value={editForm.country || ''}
                onChange={(e) => handleFormChange('country', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Registration & Fees Section */}
      <CollapsibleSection
        title="Registration & Fees"
        icon={DollarSign}
        expanded={expandedSections.registration}
        onToggle={() => toggleSection('registration')}
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registration Fee ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editForm.registrationFee || 0}
                onChange={(e) => handleFormChange('registrationFee', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Per Division Fee ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editForm.perDivisionFee || 0}
                onChange={(e) => handleFormChange('perDivisionFee', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Registration Window
              <span className="text-xs font-normal text-gray-500">(optional)</span>
            </h4>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opens Date</label>
                <input
                  type="date"
                  value={editForm.registrationOpenDate || ''}
                  onChange={(e) => handleFormChange('registrationOpenDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opens Time</label>
                <input
                  type="time"
                  value={editForm.registrationOpenTime || ''}
                  onChange={(e) => handleFormChange('registrationOpenTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Closes Date</label>
                <input
                  type="date"
                  value={editForm.registrationCloseDate || ''}
                  onChange={(e) => handleFormChange('registrationCloseDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Closes Time</label>
                <input
                  type="time"
                  value={editForm.registrationCloseTime || ''}
                  onChange={(e) => handleFormChange('registrationCloseTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Divisions Section */}
      <CollapsibleSection
        title={`Divisions (${divisions.length})`}
        icon={Layers}
        expanded={expandedSections.divisions}
        onToggle={() => toggleSection('divisions')}
      >
        {divisions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p>No divisions configured</p>
            <Link
              to={`/tournament/${eventId}/manage`}
              className="text-blue-600 hover:underline text-sm mt-2 inline-block"
            >
              Go to Tournament Manager to add divisions
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {divisions.map(div => (
                <button
                  key={div.id}
                  onClick={() => setSelectedDivision(div)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedDivision?.id === div.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {div.name}
                  <span className="ml-2 text-xs opacity-75">
                    ({div.registeredUnits || 0} teams)
                  </span>
                </button>
              ))}
            </div>

            {selectedDivision && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-gray-900">{selectedDivision.name}</h4>
                    <p className="text-sm text-gray-500">
                      {selectedDivision.registeredUnits || 0} registered teams
                    </p>
                  </div>
                  <Link
                    to={`/tournament/${eventId}/manage`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Manage Division
                  </Link>
                </div>

                {/* Phase Manager */}
                <PhaseManager
                  divisionId={selectedDivision.id}
                  eventId={eventId}
                  readOnly={false}
                />
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>

      {/* Schedule Preview Section */}
      <CollapsibleSection
        title="Schedule Preview"
        icon={Calendar}
        expanded={expandedSections.scheduling}
        onToggle={() => toggleSection('scheduling')}
      >
        {selectedDivision ? (
          <SchedulePreview
            divisionId={selectedDivision.id}
            showFilters={true}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p>Select a division to view schedule</p>
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}

// =====================================================
// Game Day Section
// =====================================================
function GameDaySection({
  event,
  editForm,
  divisions,
  expandedSections,
  toggleSection,
  handleFormChange,
  eventId
}) {
  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <CollapsibleSection
        title="Quick Actions"
        icon={Play}
        expanded={expandedSections.quickActions}
        onToggle={() => toggleSection('quickActions')}
      >
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          <Link
            to={`/event/${eventId}/check-in`}
            className="p-4 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-sm hover:shadow-md"
          >
            <UserCheck className="w-6 h-6 mb-2" />
            <div className="font-semibold">Player Check-In</div>
            <div className="text-sm opacity-90">Check in arriving players</div>
          </Link>

          <Link
            to={`/event/${eventId}/scoreboard`}
            className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm hover:shadow-md"
          >
            <BarChart3 className="w-6 h-6 mb-2" />
            <div className="font-semibold">Scoreboard</div>
            <div className="text-sm opacity-90">View live scores</div>
          </Link>

          <Link
            to={`/tournament/${eventId}/manage`}
            className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all shadow-sm hover:shadow-md"
          >
            <Trophy className="w-6 h-6 mb-2" />
            <div className="font-semibold">Tournament Dashboard</div>
            <div className="text-sm opacity-90">Full tournament control</div>
          </Link>

          <Link
            to={`/event/${eventId}/td-dashboard`}
            className="p-4 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-sm hover:shadow-md"
          >
            <ClipboardList className="w-6 h-6 mb-2" />
            <div className="font-semibold">TD Dashboard</div>
            <div className="text-sm opacity-90">Tournament director view</div>
          </Link>

          <Link
            to={`/event/${eventId}/staff-dashboard`}
            className="p-4 bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-xl hover:from-teal-600 hover:to-teal-700 transition-all shadow-sm hover:shadow-md"
          >
            <Users className="w-6 h-6 mb-2" />
            <div className="font-semibold">Staff Dashboard</div>
            <div className="text-sm opacity-90">Staff role-based view</div>
          </Link>

          <Link
            to={`/event/${eventId}/court-planning`}
            className="p-4 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md"
          >
            <Map className="w-6 h-6 mb-2" />
            <div className="font-semibold">Court Planning</div>
            <div className="text-sm opacity-90">Manage court assignments</div>
          </Link>

          <Link
            to={`/event/${eventId}/notifications`}
            className="p-4 bg-gradient-to-br from-pink-500 to-pink-600 text-white rounded-xl hover:from-pink-600 hover:to-pink-700 transition-all shadow-sm hover:shadow-md"
          >
            <Bell className="w-6 h-6 mb-2" />
            <div className="font-semibold">Notifications</div>
            <div className="text-sm opacity-90">Send announcements</div>
          </Link>

          <Link
            to={`/event/${eventId}/drawing`}
            className="p-4 bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-xl hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-sm hover:shadow-md"
          >
            <Radio className="w-6 h-6 mb-2" />
            <div className="font-semibold">Live Drawing</div>
            <div className="text-sm opacity-90">Drawing ceremony</div>
          </Link>
        </div>
      </CollapsibleSection>

      {/* Tournament Control */}
      <CollapsibleSection
        title="Tournament Control"
        icon={Settings}
        expanded={expandedSections.tournamentControl}
        onToggle={() => toggleSection('tournamentControl')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tournament Status</label>
            <select
              value={editForm.tournamentStatus || ''}
              onChange={(e) => handleFormChange('tournamentStatus', e.target.value)}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select status...</option>
              <option value="Draft">Draft</option>
              <option value="RegistrationOpen">Registration Open</option>
              <option value="RegistrationClosed">Registration Closed</option>
              <option value="ScheduleReady">Schedule Ready</option>
              <option value="Drawing">Drawing</option>
              <option value="Running">Running</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Total Divisions</div>
              <div className="text-2xl font-bold text-gray-900">{divisions.length}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Total Teams</div>
              <div className="text-2xl font-bold text-gray-900">
                {divisions.reduce((sum, d) => sum + (d.registeredUnits || 0), 0)}
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Event Status</div>
              <div className="text-lg font-semibold text-gray-900">
                {editForm.tournamentStatus || 'Draft'}
              </div>
            </div>
          </div>

          {/* Division Quick Stats */}
          {divisions.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Division Overview</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Division</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-600">Teams</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-600">Schedule</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {divisions.map(div => (
                      <tr key={div.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{div.name}</td>
                        <td className="px-4 py-2 text-center">{div.registeredUnits || 0}</td>
                        <td className="px-4 py-2 text-center">
                          {div.scheduleReady ? (
                            <span className="text-green-600 flex items-center justify-center gap-1">
                              <Check className="w-4 h-4" />
                              Ready
                            </span>
                          ) : (
                            <span className="text-gray-400">Not Ready</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Link
                            to={`/event/${eventId}/division/${div.id}/schedule`}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            View Schedule
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}

// =====================================================
// Collapsible Section Component
// =====================================================
function CollapsibleSection({ title, icon: Icon, expanded, onToggle, children }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-gray-600" />
          <span className="font-medium text-gray-900">{title}</span>
        </div>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {expanded && (
        <div className="p-4 border-t">
          {children}
        </div>
      )}
    </div>
  );
}
