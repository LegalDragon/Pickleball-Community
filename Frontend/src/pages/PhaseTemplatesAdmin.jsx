import React, { useState, useEffect } from 'react'
import { tournamentApi } from '../services/api'
import {
  Layers, Plus, Edit2, Trash2, Check, X, RefreshCw, AlertTriangle,
  Copy, ChevronDown, ChevronUp, Eye, Code, FileJson, Save, GitBranch,
  Trophy, Users, Hash, ArrowRight, Clock
} from 'lucide-react'

const CATEGORIES = [
  { value: 'SingleElimination', label: 'Single Elimination', icon: GitBranch },
  { value: 'DoubleElimination', label: 'Double Elimination', icon: GitBranch },
  { value: 'RoundRobin', label: 'Round Robin', icon: RefreshCw },
  { value: 'Pools', label: 'Pools', icon: Layers },
  { value: 'Combined', label: 'Combined (Pools + Bracket)', icon: Trophy },
  { value: 'Custom', label: 'Custom', icon: Code }
]

const PhaseTemplatesAdmin = ({ embedded = false }) => {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJsonPreview, setShowJsonPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedTemplates, setExpandedTemplates] = useState({})
  const [categoryFilter, setCategoryFilter] = useState('all')

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'SingleElimination',
    minUnits: 4,
    maxUnits: 16,
    defaultUnits: 8,
    diagramText: '',
    tags: '',
    structureJson: JSON.stringify({
      phases: [
        {
          name: 'Main Bracket',
          phaseType: 'SingleElimination',
          sortOrder: 1,
          incomingSlotCount: 8,
          advancingSlotCount: 1,
          poolCount: 0,
          bestOf: 1,
          matchDurationMinutes: 30
        }
      ],
      advancementRules: []
    }, null, 2)
  })

  // Load templates
  const loadTemplates = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await tournamentApi.getPhaseTemplates()
      if (Array.isArray(response)) {
        setTemplates(response)
      } else if (response.data) {
        setTemplates(response.data)
      } else {
        setTemplates([])
      }
    } catch (err) {
      setError(err.message || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  // Filter templates by category
  const filteredTemplates = categoryFilter === 'all'
    ? templates
    : templates.filter(t => t.category === categoryFilter)

  // Reset form for create
  const handleCreate = () => {
    setFormData({
      name: '',
      description: '',
      category: 'SingleElimination',
      minUnits: 4,
      maxUnits: 16,
      defaultUnits: 8,
      diagramText: '',
      tags: '',
      structureJson: JSON.stringify({
        phases: [
          {
            name: 'Main Bracket',
            phaseType: 'SingleElimination',
            sortOrder: 1,
            incomingSlotCount: 8,
            advancingSlotCount: 1,
            poolCount: 0,
            bestOf: 1,
            matchDurationMinutes: 30
          }
        ],
        advancementRules: []
      }, null, 2)
    })
    setEditingTemplate(null)
    setShowCreateModal(true)
  }

  // Clone existing template
  const handleClone = (template) => {
    const structure = typeof template.structureJson === 'string'
      ? template.structureJson
      : JSON.stringify(template.structureJson, null, 2)

    setFormData({
      name: `${template.name} (Copy)`,
      description: template.description || '',
      category: template.category,
      minUnits: template.minUnits,
      maxUnits: template.maxUnits,
      defaultUnits: template.defaultUnits,
      diagramText: template.diagramText || '',
      tags: template.tags || '',
      structureJson: structure
    })
    setEditingTemplate(null)
    setShowCreateModal(true)
  }

  // Load template into form for editing
  const handleEdit = (template) => {
    if (template.isSystemTemplate) {
      alert('System templates cannot be edited. Clone it instead to create a custom version.')
      return
    }

    const structure = typeof template.structureJson === 'string'
      ? template.structureJson
      : JSON.stringify(template.structureJson, null, 2)

    setFormData({
      name: template.name,
      description: template.description || '',
      category: template.category,
      minUnits: template.minUnits,
      maxUnits: template.maxUnits,
      defaultUnits: template.defaultUnits,
      diagramText: template.diagramText || '',
      tags: template.tags || '',
      structureJson: structure
    })
    setEditingTemplate(template)
    setShowCreateModal(true)
  }

  // Save (create or update)
  const handleSave = async () => {
    // Validate JSON
    try {
      JSON.parse(formData.structureJson)
    } catch (e) {
      alert('Invalid JSON in structure. Please fix the JSON syntax.')
      return
    }

    if (!formData.name.trim()) {
      alert('Template name is required')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        minUnits: parseInt(formData.minUnits),
        maxUnits: parseInt(formData.maxUnits),
        defaultUnits: parseInt(formData.defaultUnits),
        diagramText: formData.diagramText.trim(),
        tags: formData.tags.trim(),
        structureJson: formData.structureJson
      }

      if (editingTemplate) {
        await tournamentApi.updatePhaseTemplate(editingTemplate.id, payload)
      } else {
        await tournamentApi.createPhaseTemplate(payload)
      }

      setShowCreateModal(false)
      loadTemplates()
    } catch (err) {
      alert(err.message || 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  // Delete (deactivate)
  const handleDelete = async (template) => {
    if (template.isSystemTemplate) {
      alert('System templates cannot be deleted.')
      return
    }

    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) {
      return
    }

    try {
      await tournamentApi.deletePhaseTemplate(template.id)
      loadTemplates()
    } catch (err) {
      alert(err.message || 'Failed to delete template')
    }
  }

  // Toggle expand
  const toggleExpand = (id) => {
    setExpandedTemplates(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  // Render phase structure preview
  const renderStructurePreview = (template) => {
    try {
      const structure = typeof template.structureJson === 'string'
        ? JSON.parse(template.structureJson)
        : template.structureJson

      // Handle flexible templates that don't have explicit phases array
      if (structure.isFlexible) {
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="bg-purple-100 px-2 py-1 rounded text-purple-700 font-medium">
                Flexible Template
              </span>
            </div>
            {structure.generateBracket && (
              <p className="text-sm text-gray-600">
                Auto-generates {structure.generateBracket.type} bracket
                {structure.generateBracket.consolation && ' with consolation'}
                {structure.generateBracket.calculateByes && ', handles byes'}
              </p>
            )}
            {structure.generateFormat && (
              <p className="text-sm text-gray-600">
                Pool size: {structure.generateFormat.poolSize},
                {structure.generateFormat.advancePerPool} advance per pool → {structure.generateFormat.bracketType}
              </p>
            )}
          </div>
        )
      }

      if (!structure.phases || !Array.isArray(structure.phases)) {
        return <p className="text-gray-500 text-sm">No phases defined</p>
      }

      return (
        <div className="space-y-2">
          {structure.phases.map((phase, idx) => {
            // Support both naming conventions (DB uses type/incomingSlots, frontend form uses phaseType/incomingSlotCount)
            const phaseType = phase.phaseType || phase.type || 'Unknown'
            const incomingSlots = phase.incomingSlotCount ?? phase.incomingSlots ?? '?'
            const exitingSlots = phase.advancingSlotCount ?? phase.exitingSlots ?? '?'
            const poolCount = phase.poolCount || 0

            return (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="bg-gray-100 px-2 py-1 rounded text-gray-700 font-medium">
                  {phase.order || idx + 1}. {phase.name}
                </span>
                <span className="text-gray-500">
                  {phaseType}
                </span>
                {poolCount > 0 && (
                  <span className="text-blue-600">
                    {poolCount} pools
                  </span>
                )}
                <span className="text-gray-400">
                  {incomingSlots} in → {exitingSlots} out
                </span>
              </div>
            )
          })}
          {structure.advancementRules && Array.isArray(structure.advancementRules) && structure.advancementRules.length > 0 && (
            <div className="mt-2 pt-2 border-t">
              <p className="text-xs text-gray-500 font-medium mb-1">Advancement Rules:</p>
              {structure.advancementRules.slice(0, 3).map((rule, idx) => (
                <p key={idx} className="text-xs text-gray-500">
                  {rule.fromPhase ? (
                    // DB format: fromPhase, fromRank, toPhase, toSlot
                    <>Phase {rule.fromPhase} #{rule.fromRank} → Phase {rule.toPhase} Slot {rule.toSlot}</>
                  ) : (
                    // Frontend format: sourcePhaseOrder, finishPosition, targetPhaseOrder, targetSlotNumber
                    <>Phase {rule.sourcePhaseOrder} #{rule.finishPosition} → Phase {rule.targetPhaseOrder} Slot {rule.targetSlotNumber}</>
                  )}
                </p>
              ))}
              {structure.advancementRules.length > 3 && (
                <p className="text-xs text-gray-400">+{structure.advancementRules.length - 3} more...</p>
              )}
            </div>
          )}
          {structure.advancementRules === 'auto' && (
            <div className="mt-2 pt-2 border-t">
              <p className="text-xs text-gray-500">Advancement: Auto-calculated</p>
            </div>
          )}
        </div>
      )
    } catch (e) {
      return <p className="text-red-500 text-sm">Invalid JSON structure</p>
    }
  }

  // Get category icon
  const getCategoryIcon = (category) => {
    const cat = CATEGORIES.find(c => c.value === category)
    return cat ? cat.icon : Code
  }

  if (loading) {
    return (
      <div className={`${embedded ? '' : 'min-h-screen bg-gray-50 p-6'}`}>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mr-2" />
          <span className="text-gray-500">Loading templates...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`${embedded ? '' : 'min-h-screen bg-gray-50 p-6'}`}>
      <div className={`${embedded ? '' : 'max-w-6xl mx-auto'}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6 text-purple-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Phase Templates</h2>
              <p className="text-sm text-gray-500">
                Pre-built tournament structures for TDs to use
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadTemplates}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              New Template
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Category Filter */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">Filter:</span>
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1 rounded-full text-sm ${
              categoryFilter === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ({templates.length})
          </button>
          {CATEGORIES.map(cat => {
            const count = templates.filter(t => t.category === cat.value).length
            if (count === 0) return null
            return (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(cat.value)}
                className={`px-3 py-1 rounded-full text-sm ${
                  categoryFilter === cat.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.label} ({count})
              </button>
            )
          })}
        </div>

        {/* Templates List */}
        <div className="space-y-3">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No templates found. Create one to get started!
            </div>
          ) : (
            filteredTemplates.map(template => {
              const CategoryIcon = getCategoryIcon(template.category)
              const isExpanded = expandedTemplates[template.id]

              return (
                <div
                  key={template.id}
                  className={`bg-white rounded-lg border shadow-sm overflow-hidden ${
                    template.isSystemTemplate ? 'border-blue-200' : 'border-gray-200'
                  }`}
                >
                  {/* Template Header */}
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          template.isSystemTemplate ? 'bg-blue-100' : 'bg-purple-100'
                        }`}>
                          <CategoryIcon className={`w-5 h-5 ${
                            template.isSystemTemplate ? 'text-blue-600' : 'text-purple-600'
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{template.name}</h3>
                            {template.isSystemTemplate && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                System
                              </span>
                            )}
                            {!template.isActive && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {template.description || 'No description'}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {template.minUnits}-{template.maxUnits} teams
                            </span>
                            {template.diagramText && (
                              <span className="flex items-center gap-1">
                                <ArrowRight className="w-4 h-4" />
                                {template.diagramText}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleClone(template)}
                          className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                          title="Clone template"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        {!template.isSystemTemplate && (
                          <>
                            <button
                              onClick={() => handleEdit(template)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Edit template"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(template)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete template"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => toggleExpand(template.id)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg ml-2"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t bg-gray-50">
                      <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Phase Structure</h4>
                          {renderStructurePreview(template)}
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Raw JSON</h4>
                          <pre className="text-xs bg-gray-800 text-green-400 p-3 rounded-lg overflow-auto max-h-48">
                            {typeof template.structureJson === 'string'
                              ? template.structureJson
                              : JSON.stringify(template.structureJson, null, 2)}
                          </pre>
                        </div>
                      </div>
                      {template.tags && (
                        <div className="mt-3 pt-3 border-t">
                          <span className="text-xs text-gray-500">Tags: </span>
                          {template.tags.split(',').map((tag, i) => (
                            <span key={i} className="inline-block px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full mr-1">
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingTemplate ? 'Edit Template' : 'Create New Template'}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., 8-Team Single Elimination"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this tournament format..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Unit Count Range */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Teams
                  </label>
                  <input
                    type="number"
                    value={formData.minUnits}
                    onChange={e => setFormData({ ...formData, minUnits: e.target.value })}
                    min={2}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Teams
                  </label>
                  <input
                    type="number"
                    value={formData.maxUnits}
                    onChange={e => setFormData({ ...formData, maxUnits: e.target.value })}
                    min={2}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Teams
                  </label>
                  <input
                    type="number"
                    value={formData.defaultUnits}
                    onChange={e => setFormData({ ...formData, defaultUnits: e.target.value })}
                    min={2}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Diagram and Tags */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Diagram Text
                  </label>
                  <input
                    type="text"
                    value={formData.diagramText}
                    onChange={e => setFormData({ ...formData, diagramText: e.target.value })}
                    placeholder="e.g., QF -> SF -> F"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Visual representation shown to TDs</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={e => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="e.g., bracket, elimination, popular"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Comma-separated for search</p>
                </div>
              </div>

              {/* JSON Structure */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Structure JSON *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowJsonPreview(!showJsonPreview)}
                    className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    {showJsonPreview ? 'Hide Preview' : 'Show Preview'}
                  </button>
                </div>
                <textarea
                  value={formData.structureJson}
                  onChange={e => setFormData({ ...formData, structureJson: e.target.value })}
                  rows={12}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder='{"phases": [...], "advancementRules": [...]}'
                />
                <p className="text-xs text-gray-500 mt-1">
                  Define phases and advancement rules. Each phase needs: name, phaseType, sortOrder, incomingSlotCount, advancingSlotCount
                </p>

                {showJsonPreview && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
                    {renderStructurePreview({ structureJson: formData.structureJson })}
                  </div>
                )}
              </div>

              {/* JSON Structure Reference */}
              <details className="bg-gray-50 rounded-lg p-3">
                <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                  JSON Structure Reference
                </summary>
                <div className="mt-3 text-xs space-y-2">
                  <div>
                    <strong>Phase Object:</strong>
                    <pre className="bg-gray-800 text-green-400 p-2 rounded mt-1 overflow-auto">
{`{
  "name": "Semifinals",
  "phaseType": "SingleElimination", // or RoundRobin, DoubleElimination, Swiss
  "sortOrder": 1,
  "incomingSlotCount": 4,
  "advancingSlotCount": 2,
  "poolCount": 0, // 0 for bracket, 2+ for pools
  "bestOf": 1, // best of 1, 3, or 5
  "matchDurationMinutes": 30,
  "hasConsolationMatch": false
}`}
                    </pre>
                  </div>
                  <div>
                    <strong>Advancement Rule Object:</strong>
                    <pre className="bg-gray-800 text-green-400 p-2 rounded mt-1 overflow-auto">
{`{
  "sourcePhaseOrder": 1,
  "targetPhaseOrder": 2,
  "finishPosition": 1, // 1st place, 2nd place, etc.
  "targetSlotNumber": 1,
  "sourcePoolIndex": null // for pool-specific rules
}`}
                    </pre>
                  </div>
                </div>
              </details>
            </div>

            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingTemplate ? 'Update Template' : 'Create Template'}
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

export default PhaseTemplatesAdmin
