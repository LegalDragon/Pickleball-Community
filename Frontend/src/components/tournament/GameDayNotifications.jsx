import { useState, useEffect } from 'react';
import {
  Bell, Mail, MessageSquare, Smartphone, Clock, User,
  AlertTriangle, CheckCircle2, Info, Filter, Trash2,
  RefreshCw, Play, Pause, Settings
} from 'lucide-react';

/**
 * GameDayNotifications - Debug view for notifications that would be sent
 * Shows all pending notifications without actually sending them
 */
export default function GameDayNotifications({ eventId, event, debugMode = true }) {
  const [notifications, setNotifications] = useState([]);
  const [filters, setFilters] = useState({
    type: 'all',
    method: 'all',
    status: 'all'
  });
  const [sendingEnabled, setSendingEnabled] = useState(false);

  // Simulate notification queue - in production this would come from backend
  useEffect(() => {
    // Generate sample notifications based on event state
    generateSampleNotifications();
  }, [event]);

  const generateSampleNotifications = () => {
    const sampleNotifications = [];
    let id = 1;

    // Match start notifications
    event?.divisions?.forEach(div => {
      sampleNotifications.push({
        id: id++,
        type: 'match_start',
        method: 'push',
        recipient: { type: 'team', name: 'Team A', userId: 101 },
        subject: 'Match Starting Soon',
        content: `Your match in ${div.name} is starting in 5 minutes on Court 3`,
        status: 'pending',
        scheduledAt: new Date(Date.now() + 5 * 60000).toISOString(),
        createdAt: new Date().toISOString(),
        division: div.name
      });
    });

    // Score update notifications
    sampleNotifications.push({
      id: id++,
      type: 'score_update',
      method: 'push',
      recipient: { type: 'spectator', name: 'Match Followers', count: 15 },
      subject: 'Score Update',
      content: 'Match #5: Team A 11-8 Team B (Game 1 Complete)',
      status: 'pending',
      scheduledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      division: 'Open Doubles'
    });

    // Match complete notifications
    sampleNotifications.push({
      id: id++,
      type: 'match_complete',
      method: 'email',
      recipient: { type: 'team', name: 'Team B', userId: 102 },
      subject: 'Match Result',
      content: 'Your match has concluded. Final score: Team A defeats Team B 2-1',
      status: 'pending',
      scheduledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      division: 'Open Doubles'
    });

    // Advancement notifications
    sampleNotifications.push({
      id: id++,
      type: 'advancement',
      method: 'push',
      recipient: { type: 'team', name: 'Team A', userId: 101 },
      subject: 'Advancement to Semifinals',
      content: 'Congratulations! You have advanced to the Semifinals. Your next match will be announced shortly.',
      status: 'pending',
      scheduledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      division: 'Open Doubles'
    });

    // Court assignment notifications
    sampleNotifications.push({
      id: id++,
      type: 'court_assignment',
      method: 'sms',
      recipient: { type: 'team', name: 'Team C', userId: 103, phone: '+1***456' },
      subject: 'Court Assignment',
      content: 'Your match has been assigned to Court 7. Please report in 10 minutes.',
      status: 'pending',
      scheduledAt: new Date(Date.now() + 10 * 60000).toISOString(),
      createdAt: new Date().toISOString(),
      division: 'Mixed Doubles 3.5'
    });

    // Admin notification
    sampleNotifications.push({
      id: id++,
      type: 'admin_alert',
      method: 'push',
      recipient: { type: 'organizer', name: 'Tournament Director' },
      subject: 'Schedule Delay Alert',
      content: 'Pool A is running 15 minutes behind schedule. Consider adjusting court assignments.',
      status: 'pending',
      scheduledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      division: 'All'
    });

    setNotifications(sampleNotifications);
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(notif => {
    if (filters.type !== 'all' && notif.type !== filters.type) return false;
    if (filters.method !== 'all' && notif.method !== filters.method) return false;
    if (filters.status !== 'all' && notif.status !== filters.status) return false;
    return true;
  });

  const getMethodIcon = (method) => {
    switch (method) {
      case 'email': return <Mail className="w-4 h-4 text-blue-500" />;
      case 'sms': return <Smartphone className="w-4 h-4 text-green-500" />;
      case 'push': return <Bell className="w-4 h-4 text-purple-500" />;
      default: return <MessageSquare className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'match_start': return { label: 'Match Start', color: 'bg-yellow-100 text-yellow-700' };
      case 'score_update': return { label: 'Score Update', color: 'bg-blue-100 text-blue-700' };
      case 'match_complete': return { label: 'Match Complete', color: 'bg-green-100 text-green-700' };
      case 'advancement': return { label: 'Advancement', color: 'bg-purple-100 text-purple-700' };
      case 'court_assignment': return { label: 'Court Assignment', color: 'bg-orange-100 text-orange-700' };
      case 'admin_alert': return { label: 'Admin Alert', color: 'bg-red-100 text-red-700' };
      default: return { label: type, color: 'bg-gray-100 text-gray-700' };
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const handleSendNotification = (notifId) => {
    if (!sendingEnabled) {
      console.log('[DEBUG] Would send notification:', notifId);
      // In debug mode, just mark as "would send"
      setNotifications(prev => prev.map(n =>
        n.id === notifId ? { ...n, status: 'debug_sent', debugSentAt: new Date().toISOString() } : n
      ));
    } else {
      // Actually send the notification (not implemented yet)
      console.log('[SEND] Sending notification:', notifId);
    }
  };

  const handleSendAll = () => {
    if (!sendingEnabled) {
      console.log('[DEBUG] Would send all pending notifications');
      setNotifications(prev => prev.map(n =>
        n.status === 'pending' ? { ...n, status: 'debug_sent', debugSentAt: new Date().toISOString() } : n
      ));
    }
  };

  const clearDebugSent = () => {
    setNotifications(prev => prev.map(n =>
      n.status === 'debug_sent' ? { ...n, status: 'pending', debugSentAt: null } : n
    ));
  };

  // Stats
  const stats = {
    total: notifications.length,
    pending: notifications.filter(n => n.status === 'pending').length,
    debugSent: notifications.filter(n => n.status === 'debug_sent').length,
    byMethod: {
      push: notifications.filter(n => n.method === 'push').length,
      email: notifications.filter(n => n.method === 'email').length,
      sms: notifications.filter(n => n.method === 'sms').length
    }
  };

  return (
    <div className="space-y-4">
      {/* Debug Warning Banner */}
      {debugMode && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-yellow-800">Debug Mode Active</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Notifications are being logged but NOT actually sent. This view shows what notifications
              would be sent during live tournament execution.
            </p>
            <div className="mt-3 flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendingEnabled}
                  onChange={(e) => setSendingEnabled(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded border-gray-300"
                />
                <span className="text-sm font-medium text-yellow-800">Enable actual sending</span>
              </label>
              {sendingEnabled && (
                <span className="text-xs text-red-600 font-medium">⚠️ LIVE MODE - Notifications will be sent!</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">Total Notifications</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-gray-500">Pending</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-3">
          <Bell className="w-8 h-8 text-purple-500" />
          <div>
            <div className="text-xl font-bold text-gray-900">{stats.byMethod.push}</div>
            <div className="text-xs text-gray-500">Push</div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-3">
          <Mail className="w-8 h-8 text-blue-500" />
          <div>
            <div className="text-xl font-bold text-gray-900">{stats.byMethod.email}</div>
            <div className="text-xs text-gray-500">Email</div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-3">
          <Smartphone className="w-8 h-8 text-green-500" />
          <div>
            <div className="text-xl font-bold text-gray-900">{stats.byMethod.sms}</div>
            <div className="text-xs text-gray-500">SMS</div>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>

            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">All Types</option>
              <option value="match_start">Match Start</option>
              <option value="score_update">Score Update</option>
              <option value="match_complete">Match Complete</option>
              <option value="advancement">Advancement</option>
              <option value="court_assignment">Court Assignment</option>
              <option value="admin_alert">Admin Alert</option>
            </select>

            <select
              value={filters.method}
              onChange={(e) => setFilters({ ...filters, method: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">All Methods</option>
              <option value="push">Push</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>

            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="debug_sent">Debug Sent</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={clearDebugSent}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              Reset Debug
            </button>
            <button
              onClick={handleSendAll}
              className="px-4 py-1.5 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 flex items-center gap-2"
            >
              {sendingEnabled ? <Play className="w-4 h-4" /> : <Info className="w-4 h-4" />}
              {sendingEnabled ? 'Send All' : 'Mark All Sent (Debug)'}
            </button>
          </div>
        </div>
      </div>

      {/* Notification List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Content</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scheduled</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredNotifications.map(notif => {
              const typeInfo = getTypeLabel(notif.type);
              return (
                <tr key={notif.id} className={notif.status === 'debug_sent' ? 'bg-gray-50' : ''}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(notif.status)}
                      <span className="text-xs text-gray-500 capitalize">
                        {notif.status === 'debug_sent' ? 'Debug Sent' : notif.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getMethodIcon(notif.method)}
                      <span className="text-sm capitalize">{notif.method}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{notif.recipient.name}</div>
                        <div className="text-xs text-gray-500">{notif.recipient.type}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="text-sm font-medium text-gray-900">{notif.subject}</div>
                    <div className="text-xs text-gray-500 truncate">{notif.content}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-500">
                      {new Date(notif.scheduledAt).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {notif.status === 'pending' && (
                      <button
                        onClick={() => handleSendNotification(notif.id)}
                        className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        {sendingEnabled ? 'Send' : 'Mark Sent'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredNotifications.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p>No notifications match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
