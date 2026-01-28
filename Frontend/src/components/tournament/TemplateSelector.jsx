import { useState, useEffect } from 'react';
import {
  FileText, ChevronDown, ChevronRight, Users, Trophy, GitBranch,
  Grid3X3, Layers, Zap, Check, X, Loader2, Eye, ArrowRight
} from 'lucide-react';
import { tournamentApi } from '../../services/api';

const CATEGORY_INFO = {
  SingleElimination: { icon: GitBranch, label: 'Single Elimination', color: 'text-blue-600' },
  DoubleElimination: { icon: GitBranch, label: 'Double Elimination', color: 'text-purple-600' },
  RoundRobin: { icon: Grid3X3, label: 'Round Robin', color: 'text-green-600' },
  Pools: { icon: Layers, label: 'Pool Play', color: 'text-orange-600' },
  Combined: { icon: Zap, label: 'Pools + Bracket', color: 'text-indigo-600' },
  Custom: { icon: FileText, label: 'Custom', color: 'text-gray-600' },
};

/**
 * TemplateSelector - Select and apply pre-built tournament format templates
 *
 * @param {number} divisionId - Division to apply template to
 * @param {number} unitCount - Number of registered units (for filtering templates)
 * @param {function} onApply - Callback when template is applied
 * @param {function} onClose - Callback to close the selector
 */
export default function TemplateSelector({ divisionId, unitCount = 8, onApply, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(['Combined', 'SingleElimination']);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [customUnitCount, setCustomUnitCount] = useState(unitCount);

  useEffect(() => {
    fetchTemplates();
  }, [unitCount]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      // Get all templates, then filter by unit count on frontend for better UX
      const response = await tournamentApi.getPhaseTemplates();
      // Response is the array directly (axios interceptor returns response.data)
      setTemplates(Array.isArray(response) ? response : (response?.data || response || []));
    } catch (err) {
      setError('Failed to load templates');
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = async (template) => {
    setSelectedTemplate(template);
    setCustomUnitCount(unitCount || template.defaultUnits);

    // Load preview
    try {
      setPreviewLoading(true);
      const response = await tournamentApi.previewTemplate(
        template.id,
        divisionId,
        unitCount || template.defaultUnits
      );
      // Response is the preview object directly (axios interceptor returns response.data)
      setPreview(response?.data || response);
    } catch (err) {
      console.error('Error loading preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleApply = async () => {
    if (!selectedTemplate) return;

    try {
      setApplying(true);
      const response = await tournamentApi.applyTemplate(
        selectedTemplate.id,
        divisionId,
        customUnitCount,
        true // clear existing phases
      );

      // Response is the result object directly (axios interceptor returns response.data)
      const result = response?.data || response;
      if (result?.success !== false) {
        // Auto-generate schedules for each created phase
        const phaseIds = result?.createdPhaseIds || [];
        if (phaseIds.length > 0) {
          console.log('Generating schedules for phases:', phaseIds);
          for (const phaseId of phaseIds) {
            try {
              await tournamentApi.generatePhaseSchedule(phaseId);
            } catch (scheduleErr) {
              console.warn(`Failed to generate schedule for phase ${phaseId}:`, scheduleErr);
              // Continue with other phases even if one fails
            }
          }
        }
        onApply?.(result);
      } else {
        alert('Failed to apply template: ' + (result?.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error applying template:', err);
      alert('Failed to apply template');
    } finally {
      setApplying(false);
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Group templates by category
  const groupedTemplates = templates.reduce((acc, template) => {
    const category = template.category || 'Custom';
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {});

  // Filter and sort templates suitable for current unit count
  const suitableTemplates = templates.filter(t =>
    t.minUnits <= (customUnitCount || unitCount) &&
    t.maxUnits >= (customUnitCount || unitCount)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading templates...</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Select Tournament Format</h2>
            <p className="text-sm text-gray-500 mt-1">
              Choose a template for {unitCount} teams
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Template List */}
          <div className="w-1/2 border-r overflow-y-auto p-4">
            {/* Quick recommendations */}
            {suitableTemplates.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Zap className="w-4 h-4 mr-1 text-yellow-500" />
                  Recommended for {customUnitCount || unitCount} teams
                </h3>
                <div className="grid gap-2">
                  {suitableTemplates.slice(0, 4).map(template => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      isSelected={selectedTemplate?.id === template.id}
                      onSelect={() => handleSelectTemplate(template)}
                      recommended
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All templates by category */}
            <h3 className="text-sm font-medium text-gray-700 mb-2">All Formats</h3>
            {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => {
              const categoryInfo = CATEGORY_INFO[category] || CATEGORY_INFO.Custom;
              const isExpanded = expandedCategories.includes(category);

              return (
                <div key={category} className="mb-2">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <div className="flex items-center">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400 mr-2" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400 mr-2" />
                      )}
                      <categoryInfo.icon className={`w-4 h-4 mr-2 ${categoryInfo.color}`} />
                      <span className="font-medium text-gray-700">{categoryInfo.label}</span>
                    </div>
                    <span className="text-xs text-gray-400">{categoryTemplates.length}</span>
                  </button>

                  {isExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {categoryTemplates.map(template => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          isSelected={selectedTemplate?.id === template.id}
                          onSelect={() => handleSelectTemplate(template)}
                          compact
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Preview Panel */}
          <div className="w-1/2 overflow-y-auto p-4 bg-gray-50">
            {!selectedTemplate ? (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a template to preview</p>
                </div>
              </div>
            ) : previewLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : (
              <TemplatePreview
                template={selectedTemplate}
                preview={preview}
                unitCount={customUnitCount}
                onUnitCountChange={setCustomUnitCount}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleApply}
            disabled={!selectedTemplate || applying}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
          >
            {applying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Apply Template
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual template card
 */
function TemplateCard({ template, isSelected, onSelect, recommended = false, compact = false }) {
  const categoryInfo = CATEGORY_INFO[template.category] || CATEGORY_INFO.Custom;
  const CategoryIcon = categoryInfo.icon;

  const suitableForRange = `${template.minUnits}-${template.maxUnits} teams`;

  if (compact) {
    return (
      <button
        onClick={onSelect}
        className={`w-full text-left p-2 rounded-lg transition-colors ${
          isSelected
            ? 'bg-blue-100 border border-blue-300'
            : 'hover:bg-gray-100 border border-transparent'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{template.name}</span>
          <span className="text-xs text-gray-400">{suitableForRange}</span>
        </div>
        {template.diagramText && (
          <div className="text-xs text-gray-500 mt-0.5 font-mono">{template.diagramText}</div>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-lg transition-all ${
        isSelected
          ? 'bg-blue-100 border-2 border-blue-400 shadow-sm'
          : 'bg-white border border-gray-200 hover:border-blue-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start">
        <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-200' : 'bg-gray-100'} mr-3`}>
          <CategoryIcon className={`w-5 h-5 ${isSelected ? 'text-blue-600' : categoryInfo.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 truncate">{template.name}</h4>
            {recommended && (
              <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full flex-shrink-0">
                Recommended
              </span>
            )}
          </div>
          {template.description && (
            <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{template.description}</p>
          )}
          <div className="flex items-center mt-2 text-xs text-gray-400 space-x-3">
            <span className="flex items-center">
              <Users className="w-3 h-3 mr-1" />
              {suitableForRange}
            </span>
            {template.diagramText && (
              <span className="font-mono">{template.diagramText}</span>
            )}
          </div>
        </div>
        {isSelected && (
          <Check className="w-5 h-5 text-blue-600 ml-2 flex-shrink-0" />
        )}
      </div>
    </button>
  );
}

/**
 * Template preview showing phases and structure
 */
function TemplatePreview({ template, preview, unitCount, onUnitCountChange }) {
  const categoryInfo = CATEGORY_INFO[template.category] || CATEGORY_INFO.Custom;

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
        {template.description && (
          <p className="text-sm text-gray-600 mt-1">{template.description}</p>
        )}
      </div>

      {/* Unit count adjustment */}
      <div className="mb-4 p-3 bg-white rounded-lg border">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Number of Teams
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="number"
            value={unitCount}
            onChange={(e) => onUnitCountChange(parseInt(e.target.value) || template.defaultUnits)}
            min={template.minUnits}
            max={template.maxUnits}
            className="w-20 px-2 py-1 border rounded text-center"
          />
          <span className="text-sm text-gray-500">
            (Range: {template.minUnits}-{template.maxUnits})
          </span>
        </div>
      </div>

      {/* Phase visualization */}
      {preview?.phases && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Tournament Structure</h4>
          <div className="space-y-2">
            {preview.phases.map((phase, index) => (
              <div key={index} className="flex items-center">
                <div className="flex-1 bg-white rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mr-2">
                        {phase.order}
                      </span>
                      <span className="font-medium text-gray-900">{phase.name}</span>
                    </div>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {phase.type}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center text-xs text-gray-500 space-x-4">
                    <span className="flex items-center">
                      <ArrowRight className="w-3 h-3 mr-1" />
                      {phase.incomingSlots} in
                    </span>
                    <span className="flex items-center">
                      <Trophy className="w-3 h-3 mr-1" />
                      {phase.exitingSlots} out
                    </span>
                    {phase.poolCount > 1 && (
                      <span className="flex items-center">
                        <Layers className="w-3 h-3 mr-1" />
                        {phase.poolCount} pools
                      </span>
                    )}
                    <span>
                      ~{phase.encounterCount} matches
                    </span>
                  </div>
                </div>
                {index < preview.phases.length - 1 && (
                  <div className="w-8 flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary stats */}
      {preview && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{preview.totalRounds || preview.phases?.length || 0}</div>
            <div className="text-xs text-gray-500">Phases</div>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{preview.totalEncounters || 0}</div>
            <div className="text-xs text-gray-500">Total Matches</div>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">{unitCount}</div>
            <div className="text-xs text-gray-500">Teams</div>
          </div>
        </div>
      )}

      {/* Advancement rules preview */}
      {preview?.advancementRules?.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Advancement Rules</h4>
          <div className="bg-white rounded-lg border divide-y text-sm">
            {preview.advancementRules.slice(0, 6).map((rule, index) => (
              <div key={index} className="px-3 py-2 flex items-center justify-between">
                <span className="text-gray-600">
                  {rule.fromPhase} {rule.fromDescription}
                </span>
                <span className="flex items-center text-gray-400">
                  <ArrowRight className="w-4 h-4 mx-2" />
                  <span className="text-gray-700">
                    {rule.toPhase} Slot {rule.toSlot}
                  </span>
                </span>
              </div>
            ))}
            {preview.advancementRules.length > 6 && (
              <div className="px-3 py-2 text-gray-400 text-center">
                +{preview.advancementRules.length - 6} more rules
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
