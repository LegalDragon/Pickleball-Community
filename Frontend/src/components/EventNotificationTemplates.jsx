import { useState, useEffect } from 'react';
import { notificationTemplatesApi } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import {
  Bell, Edit2, Save, X, Eye, Loader2, Copy, Info,
  MessageSquare, Clock, CheckCircle, AlertTriangle, Trophy, UserCheck
} from 'lucide-react';

// Icon mapping for notification types
const TYPE_ICONS = {
  MatchScheduled: Clock,
  MatchStarting: Bell,
  MatchComplete: CheckCircle,
  ScoreUpdated: MessageSquare,
  CheckInReminder: UserCheck,
  BracketAdvance: Trophy
};

export default function EventNotificationTemplates({ eventId, eventName, onClose }) {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [notificationTypes, setNotificationTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [copying, setCopying] = useState(false);

  // Form state for editing
  const [formData, setFormData] = useState({
    subject: '',
    messageTemplate: '',
    isActive: true
  });

  useEffect(() => {
    loadData();
  }, [eventId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [templatesRes, typesRes] = await Promise.all([
        eventId ? notificationTemplatesApi.getForEvent(eventId) : notificationTemplatesApi.getDefaults(),
        notificationTemplatesApi.getTypes()
      ]);

      if (templatesRes.success) {
        setTemplates(templatesRes.data || []);
      }
      if (typesRes.success) {
        setNotificationTypes(typesRes.data || []);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      toast.error('Failed to load notification templates');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      subject: template.subject,
      messageTemplate: template.messageTemplate,
      isActive: template.isActive
    });
    setShowPreview(false);
    setPreviewData(null);
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
    setFormData({ subject: '', messageTemplate: '', isActive: true });
    setShowPreview(false);
    setPreviewData(null);
  };

  const handleSave = async () => {
    if (!formData.subject.trim() || !formData.messageTemplate.trim()) {
      toast.error('Subject and message are required');
      return;
    }

    setSaving(true);
    try {
      let response;
      if (editingTemplate.isDefault && eventId) {
        // Create event-specific override
        response = await notificationTemplatesApi.create({
          eventId,
          notificationType: editingTemplate.notificationType,
          subject: formData.subject.trim(),
          messageTemplate: formData.messageTemplate.trim(),
          isActive: formData.isActive
        });
      } else {
        // Update existing template
        response = await notificationTemplatesApi.update(editingTemplate.id, {
          subject: formData.subject.trim(),
          messageTemplate: formData.messageTemplate.trim(),
          isActive: formData.isActive
        });
      }

      if (response.success) {
        toast.success('Template saved successfully');
        handleCancelEdit();
        loadData();
      } else {
        toast.error(response.message || 'Failed to save template');
      }
    } catch (err) {
      console.error('Error saving template:', err);
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    try {
      const response = await notificationTemplatesApi.preview({
        subject: formData.subject,
        messageTemplate: formData.messageTemplate,
        notificationType: editingTemplate?.notificationType || ''
      });

      if (response.success) {
        setPreviewData(response.data);
        setShowPreview(true);
      }
    } catch (err) {
      console.error('Error generating preview:', err);
      toast.error('Failed to generate preview');
    }
  };

  const handleCopyDefaults = async () => {
    if (!eventId) return;

    setCopying(true);
    try {
      const response = await notificationTemplatesApi.copyDefaultsToEvent(eventId);
      if (response.success) {
        toast.success(response.message || 'Templates copied successfully');
        loadData();
      } else {
        toast.error(response.message || 'Failed to copy templates');
      }
    } catch (err) {
      console.error('Error copying templates:', err);
      toast.error('Failed to copy templates');
    } finally {
      setCopying(false);
    }
  };

  const handleToggleActive = async (template) => {
    try {
      const response = await notificationTemplatesApi.update(template.id, {
        isActive: !template.isActive
      });
      if (response.success) {
        toast.success(template.isActive ? 'Template disabled' : 'Template enabled');
        loadData();
      }
    } catch (err) {
      toast.error('Failed to update template');
    }
  };

  const getTypeInfo = (typeName) => {
    return notificationTypes.find(t => t.type === typeName);
  };

  const getIcon = (typeName) => {
    const Icon = TYPE_ICONS[typeName] || Bell;
    return Icon;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-500" />
            Notification Templates
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {eventId ? `Customize messages for ${eventName}` : 'Default notification templates'}
          </p>
        </div>
        {eventId && (
          <button
            onClick={handleCopyDefaults}
            disabled={copying}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50"
          >
            {copying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            Copy Defaults to Customize
          </button>
        )}
      </div>

      {/* Placeholders Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">Available Placeholders</h4>
            <p className="text-sm text-blue-700 mt-1">
              Use these placeholders in your messages. They will be replaced with actual values when sending:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {['{PlayerFirstName}', '{PlayerName}', '{OpponentName}', '{CourtName}', '{CourtNumber}',
                '{MatchTime}', '{EventName}', '{DivisionName}', '{RoundName}', '{Score}', '{Result}'].map(p => (
                <code key={p} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">{p}</code>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Templates List */}
      <div className="space-y-3">
        {templates.map((template) => {
          const Icon = getIcon(template.notificationType);
          const typeInfo = getTypeInfo(template.notificationType);
          const isEditing = editingTemplate?.id === template.id ||
            (editingTemplate?.notificationType === template.notificationType && template.isDefault);

          return (
            <div
              key={`${template.id}-${template.notificationType}`}
              className={`border rounded-lg overflow-hidden ${
                template.isActive ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50'
              }`}
            >
              {/* Template Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${template.isActive ? 'bg-blue-100' : 'bg-gray-200'}`}>
                    <Icon className={`w-5 h-5 ${template.isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{template.notificationType.replace(/([A-Z])/g, ' $1').trim()}</h4>
                      {template.isDefault && (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">Default</span>
                      )}
                      {!template.isActive && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">Disabled</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{typeInfo?.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing && (
                    <>
                      <button
                        onClick={() => handleToggleActive(template)}
                        className={`p-2 rounded-lg ${
                          template.isActive
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title={template.isActive ? 'Disable' : 'Enable'}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(template)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Template Content / Edit Form */}
              {isEditing ? (
                <div className="p-4 bg-blue-50/50">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                      <input
                        type="text"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="Notification subject..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Message Template</label>
                      <textarea
                        value={formData.messageTemplate}
                        onChange={(e) => setFormData({ ...formData, messageTemplate: e.target.value })}
                        rows={6}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                        placeholder="Message content with {Placeholders}..."
                      />
                    </div>

                    {/* Preview */}
                    {showPreview && previewData && (
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Preview</h5>
                        <div className="space-y-2">
                          <div className="text-sm">
                            <span className="font-medium text-gray-500">Subject:</span>{' '}
                            <span className="text-gray-900">{previewData.subject}</span>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-gray-500">Message:</span>
                            <pre className="mt-1 text-gray-900 whitespace-pre-wrap font-sans bg-gray-50 p-2 rounded text-sm">
                              {previewData.message}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2">
                      <button
                        onClick={handlePreview}
                        className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        <Eye className="w-4 h-4" />
                        Preview
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCancelEdit}
                          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">Subject:</span> {template.subject}
                  </div>
                  <pre className="text-sm text-gray-500 whitespace-pre-wrap font-sans bg-gray-50 p-2 rounded max-h-24 overflow-y-auto">
                    {template.messageTemplate}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No notification templates found</p>
        </div>
      )}
    </div>
  );
}
