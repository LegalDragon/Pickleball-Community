import React, { useState, useEffect } from 'react'
import { eventStaffApi } from '../services/api'
import {
  Shield, Plus, Edit2, Trash2, Check, X, RefreshCw, AlertTriangle,
  Users, Calendar, MapPin, ClipboardList, UserCheck, Eye, Settings, ChevronDown, ChevronUp,
  DollarSign
} from 'lucide-react'

const StaffRolesAdmin = ({ embedded = false }) => {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingRole, setEditingRole] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    roleCategory: 'Staff',
    canManageSchedule: false,
    canManageCourts: false,
    canRecordScores: false,
    canCheckInPlayers: false,
    canManageLineups: false,
    canViewAllData: false,
    canManagePayments: false,
    canFullyManageEvent: false,
    allowSelfRegistration: true,
    sortOrder: 0
  })

  const roleCategories = [
    { value: 'Staff', label: 'Staff', description: 'Working staff with event duties' },
    { value: 'Spectator', label: 'Spectator', description: 'Non-playing attendee/observer' },
    { value: 'Volunteer', label: 'Volunteer', description: 'Volunteer helper' },
    { value: 'VIP', label: 'VIP', description: 'VIP guest or sponsor' },
    { value: 'Media', label: 'Media', description: 'Press/media personnel' }
  ]

  // Load global staff roles
  const loadRoles = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await eventStaffApi.getGlobalRoles()
      if (response.success) {
        setRoles(response.data || [])
      } else {
        setError(response.message || 'Failed to load staff roles')
      }
    } catch (err) {
      setError(err.message || 'Failed to load staff roles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoles()
  }, [])

  // Reset form for create
  const handleCreate = () => {
    setFormData({
      name: '',
      description: '',
      roleCategory: 'Staff',
      canManageSchedule: false,
      canManageCourts: false,
      canRecordScores: false,
      canCheckInPlayers: false,
      canManageLineups: false,
      canViewAllData: false,
      canManagePayments: false,
      canFullyManageEvent: false,
      allowSelfRegistration: true,
      sortOrder: roles.length + 1
    })
    setEditingRole(null)
    setShowCreateModal(true)
  }

  // Load role into form for editing
  const handleEdit = (role) => {
    setFormData({
      name: role.name,
      description: role.description || '',
      roleCategory: role.roleCategory || 'Staff',
      canManageSchedule: role.canManageSchedule,
      canManageCourts: role.canManageCourts,
      canRecordScores: role.canRecordScores,
      canCheckInPlayers: role.canCheckInPlayers,
      canManageLineups: role.canManageLineups,
      canViewAllData: role.canViewAllData,
      canManagePayments: role.canManagePayments,
      canFullyManageEvent: role.canFullyManageEvent,
      allowSelfRegistration: role.allowSelfRegistration,
      sortOrder: role.sortOrder
    })
    setEditingRole(role)
    setShowCreateModal(true)
  }

  // Save role (create or update)
  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Role name is required')
      return
    }

    setSaving(true)
    setError(null)
    try {
      let response
      if (editingRole) {
        response = await eventStaffApi.updateGlobalRole(editingRole.id, formData)
      } else {
        response = await eventStaffApi.createGlobalRole(formData)
      }

      if (response.success) {
        setShowCreateModal(false)
        setEditingRole(null)
        loadRoles()
      } else {
        setError(response.message || 'Failed to save role')
      }
    } catch (err) {
      setError(err.message || 'Failed to save role')
    } finally {
      setSaving(false)
    }
  }

  // Delete role
  const handleDelete = async (roleId) => {
    if (!confirm('Are you sure you want to delete this role?')) return

    try {
      const response = await eventStaffApi.deleteGlobalRole(roleId)
      if (response.success) {
        loadRoles()
      } else {
        setError(response.message || 'Failed to delete role')
      }
    } catch (err) {
      setError(err.message || 'Failed to delete role')
    }
  }

  // Permission toggle component
  const PermissionToggle = ({ label, icon: Icon, checked, onChange, description }) => (
    <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2 font-medium text-gray-900">
          <Icon className="w-4 h-4 text-gray-500" />
          {label}
        </div>
        {description && (
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
    </label>
  )

  return (
    <div className={embedded ? '' : 'max-w-4xl mx-auto p-6'}>
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-7 h-7 text-blue-600" />
              Staff Roles Management
            </h1>
            <p className="text-gray-600 mt-1">
              Configure global staff roles available for all events
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create Role
          </button>
        </div>
      )}

      {embedded && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Staff Roles</h2>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            Create Role
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Roles List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
            <span className="text-gray-500">Loading staff roles...</span>
          </div>
        ) : roles.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No staff roles configured. Click "Create Role" to add one.
          </div>
        ) : (
          <div className="divide-y">
            {roles.map(role => (
              <div key={role.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{role.name}</h3>
                      {/* Role Category Badge */}
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        role.roleCategory === 'Spectator' ? 'bg-yellow-100 text-yellow-700' :
                        role.roleCategory === 'Volunteer' ? 'bg-green-100 text-green-700' :
                        role.roleCategory === 'VIP' ? 'bg-amber-100 text-amber-700' :
                        role.roleCategory === 'Media' ? 'bg-pink-100 text-pink-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {role.roleCategory || 'Staff'}
                      </span>
                      {role.canFullyManageEvent && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                          Full Admin
                        </span>
                      )}
                      {!role.allowSelfRegistration && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                          Admin Assign Only
                        </span>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
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
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(role)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(role.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingRole ? 'Edit Staff Role' : 'Create Staff Role'}
              </h2>
              <button
                onClick={() => { setShowCreateModal(false); setEditingRole(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Tournament Director"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this role's responsibilities"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Role Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Category *</label>
                <select
                  value={formData.roleCategory}
                  onChange={(e) => {
                    const category = e.target.value
                    // If selecting Spectator, disable all permissions
                    if (category === 'Spectator') {
                      setFormData(prev => ({
                        ...prev,
                        roleCategory: category,
                        canManageSchedule: false,
                        canManageCourts: false,
                        canRecordScores: false,
                        canCheckInPlayers: false,
                        canManageLineups: false,
                        canViewAllData: false,
                        canManagePayments: false,
                        canFullyManageEvent: false
                      }))
                    } else {
                      setFormData(prev => ({ ...prev, roleCategory: category }))
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {roleCategories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {roleCategories.find(c => c.value === formData.roleCategory)?.description}
                </p>
              </div>

              {/* Full Admin Toggle - only for Staff category */}
              {formData.roleCategory === 'Staff' && (
                <div className="border-t pt-4">
                  <PermissionToggle
                    label="Full Event Admin"
                    icon={Settings}
                    checked={formData.canFullyManageEvent}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      canFullyManageEvent: e.target.checked,
                      // If full admin, enable all other permissions
                      ...(e.target.checked ? {
                        canManageSchedule: true,
                        canManageCourts: true,
                        canRecordScores: true,
                        canCheckInPlayers: true,
                        canManageLineups: true,
                        canViewAllData: true,
                        canManagePayments: true
                      } : {})
                    }))}
                    description="Has all permissions of the event organizer - can fully manage the event"
                  />
                </div>
              )}

              {/* Individual Permissions - only for Staff category */}
              {formData.roleCategory === 'Staff' ? (
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Permissions</label>
                  <div className="space-y-2">
                  <PermissionToggle
                    label="Manage Schedule"
                    icon={Calendar}
                    checked={formData.canManageSchedule}
                    onChange={(e) => setFormData(prev => ({ ...prev, canManageSchedule: e.target.checked }))}
                    description="Create and modify match schedules"
                  />
                  <PermissionToggle
                    label="Manage Courts"
                    icon={MapPin}
                    checked={formData.canManageCourts}
                    onChange={(e) => setFormData(prev => ({ ...prev, canManageCourts: e.target.checked }))}
                    description="Assign and manage court allocations"
                  />
                  <PermissionToggle
                    label="Record Scores"
                    icon={ClipboardList}
                    checked={formData.canRecordScores}
                    onChange={(e) => setFormData(prev => ({ ...prev, canRecordScores: e.target.checked }))}
                    description="Enter and update match scores"
                  />
                  <PermissionToggle
                    label="Check-in Players"
                    icon={UserCheck}
                    checked={formData.canCheckInPlayers}
                    onChange={(e) => setFormData(prev => ({ ...prev, canCheckInPlayers: e.target.checked }))}
                    description="Mark players as checked in"
                  />
                  <PermissionToggle
                    label="Manage Lineups"
                    icon={Users}
                    checked={formData.canManageLineups}
                    onChange={(e) => setFormData(prev => ({ ...prev, canManageLineups: e.target.checked }))}
                    description="Modify team lineups and player assignments"
                  />
                  <PermissionToggle
                    label="View All Data"
                    icon={Eye}
                    checked={formData.canViewAllData}
                    onChange={(e) => setFormData(prev => ({ ...prev, canViewAllData: e.target.checked }))}
                    description="Access to all event data including contact info"
                  />
                  <PermissionToggle
                    label="Manage Payments"
                    icon={DollarSign}
                    checked={formData.canManagePayments}
                    onChange={(e) => setFormData(prev => ({ ...prev, canManagePayments: e.target.checked }))}
                    description="View/approve payments, issue refunds, manage financial records"
                  />
                </div>
              </div>
              ) : (
                <div className="border-t pt-4">
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-600">
                      <strong>{formData.roleCategory}</strong> roles do not have staff permissions.
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      They can view the event schedule and receive announcements via their dashboard.
                    </p>
                  </div>
                </div>
              )}

              {/* Self Registration */}
              <div className="border-t pt-4">
                <PermissionToggle
                  label="Allow Self-Registration"
                  icon={Users}
                  checked={formData.allowSelfRegistration}
                  onChange={(e) => setFormData(prev => ({ ...prev, allowSelfRegistration: e.target.checked }))}
                  description="Users can volunteer for this role themselves (pending approval)"
                />
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Lower numbers appear first in lists</p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowCreateModal(false); setEditingRole(null); }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {editingRole ? 'Save Changes' : 'Create Role'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StaffRolesAdmin
