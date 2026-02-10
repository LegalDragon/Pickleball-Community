import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Edit2, Trash2, Save, X, Bell, Mail, MessageSquare, Smartphone,
  Send, Eye, ToggleLeft, ToggleRight, Search, Filter, ChevronDown, ChevronRight,
  AlertCircle, CheckCircle, Clock, FileText, Copy, RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notificationSystemApi } from '../services/api';

const CHANNELS = [
  { value: 'Email', label: 'Email', icon: Mail, color: 'blue' },
  { value: 'SMS', label: 'SMS', icon: Smartphone, color: 'green' },
  { value: 'Push', label: 'Web Push', icon: Bell, color: 'purple' },
  { value: 'WhatsApp', label: 'WhatsApp', icon: MessageSquare, color: 'emerald' }
];

const STATUS_COLORS = {
  'Test': 'bg-yellow-100 text-yellow-800',
  'Queued': 'bg-blue-100 text-blue-800',
  'Sent': 'bg-green-100 text-green-800',
  'Failed': 'bg-red-100 text-red-800'
};

export default function NotificationSystemAdmin({ embedded = false }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('eventTypes');
  const [loading, setLoading] = useState(true);
  
  // Event Types state
  const [eventTypes, setEventTypes] = useState([]);
  const [expandedTypes, setExpandedTypes] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Templates state
  const [templates, setTemplates] = useState([]);
  const [templateFilters, setTemplateFilters] = useState({ eventTypeId: '', channel: '' });
  
  // Logs state
  const [logs, setLogs] = useState([]);
  const [logFilters, setLogFilters] = useState({ 
    eventTypeKey: '', channel: '', status: '', page: 1, pageSize: 50 
  });
  const [logPagination, setLogPagination] = useState({ totalCount: 0, totalPages: 0 });
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(''); // 'eventType', 'template', 'preview', 'send', 'logDetail'
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewResult, setPreviewResult] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    loadData();
  }, [activeTab, selectedCategory, templateFilters, logFilters]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'eventTypes') {
        const response = await notificationSystemApi.getEventTypes(selectedCategory || null);
        setEventTypes(response.data || []);
      } else if (activeTab === 'templates') {
        const response = await notificationSystemApi.getTemplates(templateFilters);
        setTemplates(response.data || []);
      } else if (activeTab === 'logs') {
        const response = await notificationSystemApi.getLogs(logFilters);
        setLogs(response.data?.items || []);
        setLogPagination({
          totalCount: response.data?.totalCount || 0,
          totalPages: response.data?.totalPages || 0
        });
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Event Type handlers
  const handleToggleEventType = async (id) => {
    try {
      await notificationSystemApi.toggleEventType(id);
      setEventTypes(types => types.map(t => 
        t.id === id ? { ...t, isActive: !t.isActive } : t
      ));
    } catch (err) {
      console.error('Error toggling event type:', err);
    }
  };

  const handleExpandType = async (id) => {
    if (expandedTypes[id]) {
      setExpandedTypes(prev => ({ ...prev, [id]: null }));
    } else {
      try {
        const response = await notificationSystemApi.getEventType(id);
        setExpandedTypes(prev => ({ ...prev, [id]: response.data }));
      } catch (err) {
        console.error('Error loading event type details:', err);
      }
    }
  };

  // Template handlers
  const handleCreateTemplate = (eventType = null) => {
    setEditingItem(null);
    setFormData({
      eventTypeId: eventType?.id || '',
      channel: 'Email',
      name: '',
      fxTaskCode: '',
      subject: '',
      body: '',
      isActive: true,
      isTestMode: true
    });
    setError('');
    setModalType('template');
    setIsModalOpen(true);
  };

  const handleEditTemplate = (template) => {
    setEditingItem(template);
    setFormData({
      name: template.name,
      fxTaskCode: template.fxTaskCode || '',
      subject: template.subject || '',
      body: template.body,
      isActive: template.isActive,
      isTestMode: template.isTestMode
    });
    setError('');
    setModalType('template');
    setIsModalOpen(true);
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingItem) {
        await notificationSystemApi.updateTemplate(editingItem.id, formData);
      } else {
        await notificationSystemApi.createTemplate(formData);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (template) => {
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
    try {
      await notificationSystemApi.deleteTemplate(template.id);
      loadData();
    } catch (err) {
      console.error('Error deleting template:', err);
    }
  };

  const handleToggleTestMode = async (template) => {
    try {
      const response = await notificationSystemApi.toggleTestMode(template.id);
      setTemplates(prev => prev.map(t => 
        t.id === template.id ? { ...t, isTestMode: response.data.isTestMode } : t
      ));
    } catch (err) {
      console.error('Error toggling test mode:', err);
    }
  };

  const handleToggleActive = async (template) => {
    try {
      const response = await notificationSystemApi.toggleActive(template.id);
      setTemplates(prev => prev.map(t => 
        t.id === template.id ? { ...t, isActive: response.data.isActive } : t
      ));
    } catch (err) {
      console.error('Error toggling active:', err);
    }
  };

  const handlePreview = async (template) => {
    setEditingItem(template);
    setFormData({ context: {} });
    setPreviewResult(null);
    setModalType('preview');
    setIsModalOpen(true);
  };

  const handleRunPreview = async () => {
    try {
      const response = await notificationSystemApi.previewTemplate(editingItem.id, formData.context);
      setPreviewResult(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Preview failed');
    }
  };

  // Log handlers
  const handleViewLog = async (log) => {
    try {
      const response = await notificationSystemApi.getLog(log.id);
      setSelectedLog(response.data);
      setModalType('logDetail');
      setIsModalOpen(true);
    } catch (err) {
      console.error('Error loading log:', err);
    }
  };

  // Access check
  if (user?.role !== 'Admin') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You need Admin access for this page.</p>
          <Link to="/" className="mt-4 inline-block text-green-600 hover:underline">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  const getChannelIcon = (channel) => {
    const ch = CHANNELS.find(c => c.value === channel);
    return ch ? ch.icon : Bell;
  };

  const getChannelColor = (channel) => {
    const ch = CHANNELS.find(c => c.value === channel);
    return ch ? ch.color : 'gray';
  };

  const content = (
    <>
      {/* Tabs */}
      <div className={embedded ? "bg-white rounded-t-xl" : "bg-white border-b"}>
        <div className={embedded ? "px-4" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"}>
          <nav className="flex gap-4">
            {[
              { id: 'eventTypes', label: 'Event Types', icon: FileText },
              { id: 'templates', label: 'Templates', icon: Mail },
              { id: 'logs', label: 'Logs', icon: Clock }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
          </div>
        ) : (
          <>
            {/* Event Types Tab */}
            {activeTab === 'eventTypes' && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">All Categories</option>
                      <option value="System">System</option>
                      <option value="Tournament">Tournament</option>
                      <option value="League">League</option>
                    </select>
                    <span className="text-sm text-gray-500">
                      {eventTypes.length} event type{eventTypes.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => loadData()}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {/* Event Types List */}
                <div className="bg-white rounded-lg shadow divide-y">
                  {eventTypes.map(eventType => (
                    <div key={eventType.id}>
                      <div className="p-4 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex items-center gap-4 flex-1">
                          <button
                            onClick={() => handleExpandType(eventType.id)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            {expandedTypes[eventType.id] ? (
                              <ChevronDown className="w-5 h-5" />
                            ) : (
                              <ChevronRight className="w-5 h-5" />
                            )}
                          </button>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{eventType.displayName}</span>
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                {eventType.category}
                              </span>
                              {!eventType.isActive && (
                                <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-600">
                                  Inactive
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1">
                              <code className="text-xs text-gray-500 font-mono">{eventType.eventKey}</code>
                              <span className="text-xs text-gray-400">
                                {eventType.activeTemplateCount}/{eventType.templateCount} templates active
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCreateTemplate(eventType)}
                            className="p-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50"
                            title="Add Template"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleEventType(eventType.id)}
                            className={`p-2 rounded-lg ${
                              eventType.isActive 
                                ? 'text-green-600 hover:bg-green-50' 
                                : 'text-gray-400 hover:bg-gray-100'
                            }`}
                            title={eventType.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {eventType.isActive ? (
                              <ToggleRight className="w-5 h-5" />
                            ) : (
                              <ToggleLeft className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {/* Expanded Templates */}
                      {expandedTypes[eventType.id] && (
                        <div className="bg-gray-50 px-4 pb-4 pt-2">
                          <div className="text-xs text-gray-500 mb-2 font-medium">
                            Merge Fields: {expandedTypes[eventType.id].availableMergeFields?.join(', ') || 'None'}
                          </div>
                          {expandedTypes[eventType.id].templates?.length > 0 ? (
                            <div className="space-y-2">
                              {expandedTypes[eventType.id].templates.map(template => {
                                const ChannelIcon = getChannelIcon(template.channel);
                                return (
                                  <div key={template.id} className="bg-white rounded-lg p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className={`p-2 rounded-lg bg-${getChannelColor(template.channel)}-100`}>
                                        <ChannelIcon className={`w-4 h-4 text-${getChannelColor(template.channel)}-600`} />
                                      </div>
                                      <div>
                                        <div className="font-medium text-sm">{template.name}</div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                                            template.isTestMode ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                                          }`}>
                                            {template.isTestMode ? 'Test Mode' : 'Live'}
                                          </span>
                                          {!template.isActive && (
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                              Inactive
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handlePreview(template)}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                                        title="Preview"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleEditTemplate(template)}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                                        title="Edit"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-gray-500 text-sm">
                              No templates yet.{' '}
                              <button
                                onClick={() => handleCreateTemplate(eventType)}
                                className="text-green-600 hover:underline"
                              >
                                Create one
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Templates Tab */}
            {activeTab === 'templates' && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <select
                      value={templateFilters.eventTypeId}
                      onChange={(e) => setTemplateFilters(prev => ({ ...prev, eventTypeId: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">All Event Types</option>
                      {eventTypes.map(et => (
                        <option key={et.id} value={et.id}>{et.displayName}</option>
                      ))}
                    </select>
                    <select
                      value={templateFilters.channel}
                      onChange={(e) => setTemplateFilters(prev => ({ ...prev, channel: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">All Channels</option>
                      {CHANNELS.map(ch => (
                        <option key={ch.value} value={ch.value}>{ch.label}</option>
                      ))}
                    </select>
                    <span className="text-sm text-gray-500">
                      {templates.length} template{templates.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCreateTemplate()}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Template
                  </button>
                </div>

                {/* Templates Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {templates.map(template => {
                        const ChannelIcon = getChannelIcon(template.channel);
                        return (
                          <tr key={template.id} className={!template.isActive ? 'bg-gray-50 opacity-60' : ''}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{template.name}</div>
                              {template.subject && (
                                <div className="text-xs text-gray-500 truncate max-w-xs">{template.subject}</div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-900">{template.eventTypeDisplayName}</div>
                              <code className="text-xs text-gray-400 font-mono">{template.eventTypeKey}</code>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <ChannelIcon className={`w-4 h-4 text-${getChannelColor(template.channel)}-600`} />
                                <span className="text-sm">{template.channel}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  template.isTestMode ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                                }`}>
                                  {template.isTestMode ? 'Test' : 'Live'}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  template.isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {template.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handlePreview(template)}
                                  className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                                  title="Preview"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleEditTemplate(template)}
                                  className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleToggleTestMode(template)}
                                  className={`p-2 rounded-lg ${
                                    template.isTestMode 
                                      ? 'text-yellow-600 hover:bg-yellow-50' 
                                      : 'text-green-600 hover:bg-green-50'
                                  }`}
                                  title={template.isTestMode ? 'Go Live' : 'Switch to Test'}
                                >
                                  {template.isTestMode ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteTemplate(template)}
                                  className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {templates.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No templates found</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Logs Tab */}
            {activeTab === 'logs' && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <select
                      value={logFilters.channel}
                      onChange={(e) => setLogFilters(prev => ({ ...prev, channel: e.target.value, page: 1 }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">All Channels</option>
                      {CHANNELS.map(ch => (
                        <option key={ch.value} value={ch.value}>{ch.label}</option>
                      ))}
                    </select>
                    <select
                      value={logFilters.status}
                      onChange={(e) => setLogFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">All Statuses</option>
                      <option value="Test">Test</option>
                      <option value="Queued">Queued</option>
                      <option value="Sent">Sent</option>
                      <option value="Failed">Failed</option>
                    </select>
                    <span className="text-sm text-gray-500">
                      {logPagination.totalCount} total log{logPagination.totalCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => loadData()}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {/* Logs Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {logs.map(log => {
                        const ChannelIcon = getChannelIcon(log.channel);
                        return (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                              <code className="text-xs font-mono text-gray-600">{log.eventTypeKey}</code>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <ChannelIcon className={`w-4 h-4 text-${getChannelColor(log.channel)}-600`} />
                                <span className="text-sm">{log.channel}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-900">{log.recipientName || 'Unknown'}</div>
                              <div className="text-xs text-gray-500">{log.recipientContact}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[log.status] || 'bg-gray-100'}`}>
                                {log.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleViewLog(log)}
                                className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {logs.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No logs found</p>
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {logPagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => setLogFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={logFilters.page === 1}
                      className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {logFilters.page} of {logPagination.totalPages}
                    </span>
                    <button
                      onClick={() => setLogFilters(prev => ({ ...prev, page: Math.min(logPagination.totalPages, prev.page + 1) }))}
                      disabled={logFilters.page >= logPagination.totalPages}
                      className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {modalType === 'template' && (editingItem ? 'Edit Template' : 'Create Template')}
                {modalType === 'preview' && 'Preview Template'}
                {modalType === 'logDetail' && 'Log Details'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Form */}
            {modalType === 'template' && (
              <form onSubmit={handleSaveTemplate} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                {!editingItem && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Event Type *</label>
                      <select
                        value={formData.eventTypeId}
                        onChange={(e) => setFormData({ ...formData, eventTypeId: parseInt(e.target.value) })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        required
                      >
                        <option value="">Select event type...</option>
                        {eventTypes.map(et => (
                          <option key={et.id} value={et.id}>{et.displayName} ({et.eventKey})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Channel *</label>
                      <select
                        value={formData.channel}
                        onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        required
                      >
                        {CHANNELS.map(ch => (
                          <option key={ch.value} value={ch.value}>{ch.label}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Registration Confirmed - Email"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">FX Task Code</label>
                  <input
                    type="text"
                    value={formData.fxTaskCode}
                    onChange={(e) => setFormData({ ...formData, fxTaskCode: e.target.value })}
                    placeholder="e.g., TOURNAMENT_REG (for FXNotification)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">Required for Email/SMS via FXNotification</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g., Registration Confirmed: {{eventName}}"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">Use {'{{field}}'} for merge fields</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Body *</label>
                  <textarea
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                    placeholder="Template body with {{mergeFields}}"
                    rows={6}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                    required
                  />
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isTestMode}
                      onChange={(e) => setFormData({ ...formData, isTestMode: e.target.checked })}
                      className="w-4 h-4 text-yellow-600 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Test Mode (log only, don't send)</span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        {editingItem ? 'Update' : 'Create'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Preview */}
            {modalType === 'preview' && editingItem && (
              <div className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">Template: {editingItem.name}</div>
                  <div className="text-xs text-gray-500">Channel: {editingItem.channel}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Context (JSON)</label>
                  <textarea
                    value={JSON.stringify(formData.context, null, 2)}
                    onChange={(e) => {
                      try {
                        setFormData({ ...formData, context: JSON.parse(e.target.value) });
                      } catch {
                        // Ignore parse errors while typing
                      }
                    }}
                    placeholder='{"playerName": "John", "eventName": "Spring Tournament"}'
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                  />
                </div>

                <button
                  onClick={handleRunPreview}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>

                {previewResult && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {previewResult.subject && (
                      <div>
                        <div className="text-xs text-gray-500 uppercase">Subject</div>
                        <div className="text-sm font-medium">{previewResult.subject}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-gray-500 uppercase">Body</div>
                      <pre className="text-sm whitespace-pre-wrap bg-white p-3 rounded border mt-1">
                        {previewResult.body}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Log Detail */}
            {modalType === 'logDetail' && selectedLog && (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 uppercase">Event</div>
                    <code className="text-sm font-mono">{selectedLog.eventTypeKey}</code>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase">Channel</div>
                    <div className="text-sm">{selectedLog.channel}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase">Status</div>
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[selectedLog.status]}`}>
                      {selectedLog.status}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase">Time</div>
                    <div className="text-sm">{new Date(selectedLog.createdAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase">Recipient</div>
                    <div className="text-sm">{selectedLog.recipientName || 'N/A'}</div>
                    <div className="text-xs text-gray-500">{selectedLog.recipientContact}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase">Template</div>
                    <div className="text-sm">{selectedLog.templateName || 'N/A'}</div>
                  </div>
                </div>

                {selectedLog.mergedSubject && (
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Subject</div>
                    <div className="bg-gray-50 rounded p-3 text-sm">{selectedLog.mergedSubject}</div>
                  </div>
                )}

                {selectedLog.mergedBody && (
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Body</div>
                    <pre className="bg-gray-50 rounded p-3 text-sm whitespace-pre-wrap">{selectedLog.mergedBody}</pre>
                  </div>
                )}

                {selectedLog.errorMessage && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="text-xs text-red-600 uppercase mb-1">Error</div>
                    <div className="text-sm text-red-700">{selectedLog.errorMessage}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Bell className="w-6 h-6 text-green-600" />
                  Notification System
                </h1>
                <p className="text-sm text-gray-500">Manage event types, templates, and view logs</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {content}
    </div>
  );
}
