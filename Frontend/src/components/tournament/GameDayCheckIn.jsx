import { useState, useEffect } from 'react';
import {
  Users, CheckCircle, Clock, FileText, DollarSign, RefreshCw,
  Loader2, User, ChevronUp, ChevronDown, AlertCircle, XCircle,
  Eye, ExternalLink, Send, Edit2
} from 'lucide-react';
import { checkInApi, getSharedAssetUrl } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import PublicProfileModal from '../ui/PublicProfileModal';

/**
 * GameDayCheckIn - Player check-in management for tournament game day
 */
export default function GameDayCheckIn({ eventId, event, permissions, onRefresh }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [checkInData, setCheckInData] = useState(null);
  const [checkInFilter, setCheckInFilter] = useState('all');
  const [divisionFilter, setDivisionFilter] = useState('all');
  const [expandedPlayer, setExpandedPlayer] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);
  const [profileModalUserId, setProfileModalUserId] = useState(null);
  const [sendingWaiverRequest, setSendingWaiverRequest] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);

  useEffect(() => {
    loadCheckIns();
  }, [eventId]);

  const loadCheckIns = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  const handleManualCheckIn = async (userId) => {
    setProcessingAction({ userId, action: 'checkin' });
    try {
      const response = await checkInApi.manualCheckIn(eventId, userId, { signWaiver: false });
      if (response.success) {
        toast.success('Player checked in');
        loadCheckIns();
        onRefresh?.();
      } else {
        toast.error(response.message || 'Failed to check in player');
      }
    } catch (err) {
      console.error('Error checking in player:', err);
      toast.error('Failed to check in player');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleVoidCheckIn = async (userId) => {
    if (!confirm('Are you sure you want to void this check-in? This will also void the waiver and payment.')) return;
    setProcessingAction({ userId, action: 'void-checkin' });
    try {
      const response = await checkInApi.voidCheckIn(eventId, userId);
      if (response.success) {
        toast.success('Check-in voided');
        loadCheckIns();
        onRefresh?.();
      } else {
        toast.error(response.message || 'Failed to void check-in');
      }
    } catch (err) {
      console.error('Error voiding check-in:', err);
      toast.error('Failed to void check-in');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleOverrideWaiver = async (userId) => {
    setProcessingAction({ userId, action: 'waiver' });
    try {
      const response = await checkInApi.overrideWaiver(eventId, userId);
      if (response.success) {
        toast.success('Waiver overridden');
        loadCheckIns();
      } else {
        toast.error(response.message || 'Failed to override waiver');
      }
    } catch (err) {
      console.error('Error overriding waiver:', err);
      toast.error('Failed to override waiver');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleVoidWaiver = async (userId) => {
    if (!confirm('Are you sure you want to void this waiver?')) return;
    setProcessingAction({ userId, action: 'void-waiver' });
    try {
      const response = await checkInApi.voidWaiver(eventId, userId);
      if (response.success) {
        toast.success('Waiver voided');
        loadCheckIns();
      } else {
        toast.error(response.message || 'Failed to void waiver');
      }
    } catch (err) {
      console.error('Error voiding waiver:', err);
      toast.error('Failed to void waiver');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleOverridePayment = async (userId, markAsPaid) => {
    setProcessingAction({ userId, action: 'payment' });
    try {
      const response = markAsPaid
        ? await checkInApi.overridePayment(eventId, userId, { hasPaid: true })
        : await checkInApi.voidPayment(eventId, userId);
      if (response.success) {
        toast.success(markAsPaid ? 'Marked as paid' : 'Payment voided');
        loadCheckIns();
      } else {
        toast.error(response.message || 'Failed to update payment');
      }
    } catch (err) {
      console.error('Error updating payment:', err);
      toast.error('Failed to update payment');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleSendWaiverRequest = async (player) => {
    setSendingWaiverRequest(player.userId);
    try {
      // This would send an email/notification to the player
      toast.success(`Waiver request sent to ${player.email}`);
    } catch (err) {
      toast.error('Failed to send waiver request');
    } finally {
      setSendingWaiverRequest(null);
    }
  };

  // Filter and group players by division
  const getPlayersByDivision = () => {
    if (!checkInData?.players) return [];

    let filtered = checkInData.players;

    // Apply status filter
    if (checkInFilter === 'pending') {
      filtered = filtered.filter(p => !p.isCheckedIn);
    } else if (checkInFilter === 'checked-in') {
      filtered = filtered.filter(p => p.isCheckedIn);
    }

    // Apply division filter
    if (divisionFilter !== 'all') {
      filtered = filtered.filter(p => p.divisionId === parseInt(divisionFilter));
    }

    // Group by division
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

  const stats = {
    checkedIn: checkInData?.checkedInCount || 0,
    total: checkInData?.totalPlayers || 0,
    pending: (checkInData?.totalPlayers || 0) - (checkInData?.checkedInCount || 0),
    waiverSigned: checkInData?.waiverSignedCount || 0,
    paid: checkInData?.paidCount || 0
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Player Check-in</h2>
        <button
          onClick={loadCheckIns}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.checkedIn}</div>
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
              <div className="text-2xl font-bold text-gray-900">{stats.pending}</div>
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
              <div className="text-2xl font-bold text-gray-900">{stats.waiverSigned}</div>
              <div className="text-sm text-gray-500">Waivers</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.paid}</div>
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
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Divisions</option>
              {event?.divisions?.map(div => (
                <option key={div.id} value={div.id}>{div.name}</option>
              ))}
            </select>
          </div>
          {!checkInData && (
            <div className="flex items-end">
              <button
                onClick={loadCheckIns}
                disabled={loading}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                Load Players
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Player List */}
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
                {divGroup.players.map((player, playerIndex) => (
                  <div key={`${player.divisionId}-${player.userId}-${playerIndex}`} className="hover:bg-gray-50">
                    {/* Player Row */}
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => setExpandedPlayer(expandedPlayer === player.userId ? null : player.userId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setProfileModalUserId(player.userId);
                            }}
                            className="focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-full"
                          >
                            {player.avatarUrl ? (
                              <img
                                src={getSharedAssetUrl(player.avatarUrl)}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover hover:ring-2 hover:ring-orange-400"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:ring-2 hover:ring-orange-400">
                                <User className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                          </button>
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

                        <div className="flex items-center gap-2">
                          {/* Status badges */}
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            player.isCheckedIn
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {player.isCheckedIn ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {player.isCheckedIn ? 'Checked In' : 'Pending'}
                          </span>

                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            player.waiverSigned ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            <FileText className="w-3 h-3" />
                            {player.waiverSigned ? 'Waiver' : 'No Waiver'}
                          </span>

                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            player.hasPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                          }`}>
                            <DollarSign className="w-3 h-3" />
                            {player.hasPaid ? 'Paid' : 'Unpaid'}
                          </span>

                          {expandedPlayer === player.userId ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedPlayer === player.userId && (
                      <div className="px-4 pb-4">
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Waiver Section */}
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
                                </div>
                              )}
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
                                      Open Waiver
                                    </button>
                                    <button
                                      onClick={() => handleOverrideWaiver(player.userId)}
                                      disabled={processingAction?.userId === player.userId}
                                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                      Override
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

                            {/* Payment Section */}
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
                                    <p className="text-gray-500">Amount: ${player.amountPaid?.toFixed(2)}</p>
                                  )}
                                  {player.paymentMethod && (
                                    <p className="text-gray-500">Method: {player.paymentMethod}</p>
                                  )}
                                </div>
                              ) : (
                                <div className="text-sm">
                                  <div className="flex items-center gap-2 text-red-600">
                                    <XCircle className="w-4 h-4" />
                                    <span>Payment pending</span>
                                  </div>
                                </div>
                              )}
                              <div className="flex flex-wrap gap-2 pt-2">
                                {!player.hasPaid ? (
                                  <button
                                    onClick={() => handleOverridePayment(player.userId, true)}
                                    disabled={processingAction?.userId === player.userId}
                                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                  >
                                    <DollarSign className="w-4 h-4" />
                                    Mark Paid
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleOverridePayment(player.userId, false)}
                                    disabled={processingAction?.userId === player.userId}
                                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    Void Payment
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Check-in Actions */}
                          <div className="mt-6 pt-4 border-t border-gray-200">
                            <div className="flex items-center justify-between">
                              <div className="text-sm">
                                <span className="font-medium text-gray-700">Status: </span>
                                {player.isCheckedIn ? (
                                  <span className="text-green-600 font-medium">Checked In</span>
                                ) : player.waiverSigned && player.hasPaid ? (
                                  <span className="text-green-600">Ready for check-in</span>
                                ) : (
                                  <span className="text-yellow-600">
                                    Missing: {[!player.waiverSigned && 'Waiver', !player.hasPaid && 'Payment'].filter(Boolean).join(', ')}
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
                                    Check In
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
      ) : loading ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">Loading players...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Click refresh to load player check-in status</p>
        </div>
      )}

      {/* Profile Modal */}
      {profileModalUserId && (
        <PublicProfileModal
          userId={profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
        />
      )}
    </div>
  );
}
