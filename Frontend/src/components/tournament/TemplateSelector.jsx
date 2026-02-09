import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  FileText, Users, Check, X, Loader2, Grid3X3, Table,
  RefreshCcw, GitBranch, Layers, Trophy
} from 'lucide-react';
import { tournamentApi } from '../../services/api';

/**
 * TemplateSelector - Full-width template selection with visual flow preview
 */
export default function TemplateSelector({ divisionId, unitCount = 8, onApply, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [customUnitCount, setCustomUnitCount] = useState(unitCount);
  const [activeTab, setActiveTab] = useState('my'); // 'my' | 'system'
  const [viewMode, setViewMode] = useState('visual'); // 'visual' | 'data'

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const [systemResponse, myResponse] = await Promise.all([
        tournamentApi.getPhaseTemplates(),
        tournamentApi.getMyPhaseTemplates().catch(() => [])
      ]);
      
      const systemTemplates = (Array.isArray(systemResponse) ? systemResponse : (systemResponse?.data || []))
        .map(t => ({ ...t, isSystem: true }));
      const myTemplates = (Array.isArray(myResponse) ? myResponse : (myResponse?.data || []))
        .map(t => ({ ...t, isSystem: false }));
      
      setTemplates([...myTemplates, ...systemTemplates]);
      setActiveTab(myTemplates.length > 0 ? 'my' : 'system');
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort templates
  const filteredTemplates = useMemo(() => {
    return templates
      .filter(t => activeTab === 'my' ? !t.isSystem : t.isSystem)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [templates, activeTab]);

  const handleSelectTemplate = async (template) => {
    setSelectedTemplate(template);
    setCustomUnitCount(unitCount || template.defaultUnits);

    try {
      setPreviewLoading(true);
      const response = await tournamentApi.previewTemplate(
        template.id,
        divisionId,
        unitCount || template.defaultUnits
      );
      setPreview(response?.data || response);
    } catch (err) {
      console.error('Error loading preview:', err);
      setPreview(null);
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
        true
      );

      const result = response?.data || response;
      if (result?.success !== false) {
        const phaseIds = result?.createdPhaseIds || [];
        for (const phaseId of phaseIds) {
          try {
            await tournamentApi.generatePhaseSchedule(phaseId);
          } catch (err) {
            console.warn(`Failed to generate schedule for phase ${phaseId}`);
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

  // Calculate preview stats
  const previewStats = preview ? {
    phases: preview.phases?.length || 0,
    encounters: preview.totalEncounters || preview.phases?.reduce((sum, p) => sum + (p.encounterCount || 0), 0) || 0,
    teams: customUnitCount
  } : null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-xl p-8">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto" />
          <p className="mt-3 text-gray-600">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Configure Schedule</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {unitCount} registered teams
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 flex gap-2">
          <button
            onClick={() => setActiveTab('my')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'my'
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            My Templates ({templates.filter(t => !t.isSystem).length})
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'system'
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            System ({templates.filter(t => t.isSystem).length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Template List */}
          <div className="space-y-2 mb-6">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{activeTab === 'my' ? 'No custom templates yet' : 'No templates available'}</p>
              </div>
            ) : (
              filteredTemplates.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedTemplate?.id === template.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900">{template.name}</span>
                      {template.diagramText && (
                        <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">
                          {template.diagramText}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        {template.minUnits}-{template.maxUnits} teams
                      </span>
                      {selectedTemplate?.id === template.id && (
                        <Check className="w-5 h-5 text-purple-600" />
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Selected Template Details */}
          {selectedTemplate && (
            <div className="border-t pt-6">
              {/* Template Info */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{selectedTemplate.name}</h3>
                {selectedTemplate.description && (
                  <p className="text-sm text-gray-600 mt-1">{selectedTemplate.description}</p>
                )}
              </div>

              {/* Team Count */}
              <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Number of Teams</span>
                <input
                  type="number"
                  value={customUnitCount}
                  onChange={(e) => setCustomUnitCount(parseInt(e.target.value) || selectedTemplate.defaultUnits)}
                  min={selectedTemplate.minUnits}
                  max={selectedTemplate.maxUnits}
                  className="w-20 px-3 py-2 border rounded-lg text-center font-medium"
                />
                <span className="text-sm text-gray-400">
                  (Range: {selectedTemplate.minUnits}-{selectedTemplate.maxUnits})
                </span>
              </div>

              {/* View Mode Toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setViewMode('visual')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    viewMode === 'visual'
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                  Visual View
                </button>
                <button
                  onClick={() => setViewMode('data')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    viewMode === 'data'
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Table className="w-4 h-4" />
                  Data View
                </button>
              </div>

              {/* Preview Content */}
              {previewLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                </div>
              ) : preview?.phases?.length > 0 ? (
                viewMode === 'visual' ? (
                  <PhaseFlowDiagram phases={preview.phases} />
                ) : (
                  <PhaseDataView phases={preview.phases} />
                )
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">
                  No preview available
                </div>
              )}

              {/* Stats */}
              {previewStats && (
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{previewStats.phases}</div>
                    <div className="text-xs text-purple-600">Phases</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{previewStats.encounters}</div>
                    <div className="text-xs text-green-600">Encounters</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{previewStats.teams}</div>
                    <div className="text-xs text-blue-600">Teams</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!selectedTemplate || applying}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {applying ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
            Apply Template
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * React Flow diagram for phase visualization
 */
function PhaseFlowDiagram({ phases }) {
  const { nodes, edges } = useMemo(() => {
    const nodeList = [];
    const edgeList = [];
    
    const nodeWidth = 180;
    const nodeHeight = 80;
    const verticalGap = 100;
    const horizontalGap = 220;
    
    // Calculate positions - tree layout
    // For now, simple vertical layout
    phases.forEach((phase, index) => {
      const x = 200;
      const y = index * (nodeHeight + verticalGap) + 50;
      
      nodeList.push({
        id: `phase-${phase.order || index}`,
        type: 'phaseNode',
        position: { x, y },
        data: {
          label: phase.name,
          type: phase.type,
          inSlots: phase.incomingSlots || phase.inSlots,
          outSlots: phase.exitingSlots || phase.outSlots,
          poolCount: phase.poolCount,
          encounterCount: phase.encounterCount
        }
      });
      
      // Add edge to next phase
      if (index < phases.length - 1) {
        edgeList.push({
          id: `edge-${index}`,
          source: `phase-${phase.order || index}`,
          target: `phase-${phases[index + 1].order || index + 1}`,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#a78bfa', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#a78bfa' },
          label: `${phase.exitingSlots || phase.outSlots || '?'}`,
          labelStyle: { fill: '#7c3aed', fontWeight: 600 },
          labelBgStyle: { fill: '#f3e8ff' }
        });
      }
    });
    
    return { nodes: nodeList, edges: edgeList };
  }, [phases]);

  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

  // Update when phases change
  useEffect(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges]);

  const nodeTypes = useMemo(() => ({
    phaseNode: PhaseNode
  }), []);

  return (
    <div className="h-72 border rounded-lg overflow-hidden bg-gradient-to-b from-gray-50 to-white">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={true}
        zoomOnScroll={true}
        minZoom={0.5}
        maxZoom={1.5}
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

/**
 * Custom node component for phases
 */
function PhaseNode({ data }) {
  const getPhaseColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'roundrobin':
      case 'pools':
        return { bg: 'bg-emerald-500', light: 'bg-emerald-50' };
      case 'singleelimination':
      case 'bracket':
      case 'bracketround':
        return { bg: 'bg-amber-500', light: 'bg-amber-50' };
      case 'doubleelimination':
        return { bg: 'bg-purple-500', light: 'bg-purple-50' };
      default:
        return { bg: 'bg-blue-500', light: 'bg-blue-50' };
    }
  };

  const getPhaseIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'roundrobin':
        return <RefreshCcw className="w-4 h-4" />;
      case 'pools':
        return <Layers className="w-4 h-4" />;
      case 'singleelimination':
      case 'bracket':
      case 'bracketround':
        return <GitBranch className="w-4 h-4" />;
      default:
        return <Trophy className="w-4 h-4" />;
    }
  };

  const colors = getPhaseColor(data.type);

  return (
    <div className="bg-white rounded-lg shadow-md border-2 border-gray-200 min-w-[160px] overflow-hidden">
      <div className={`${colors.bg} text-white px-3 py-2 flex items-center gap-2`}>
        {getPhaseIcon(data.type)}
        <span className="font-medium text-sm truncate">{data.label}</span>
      </div>
      <div className="px-3 py-2 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>{data.type}</span>
          <span>{data.inSlots} in → {data.outSlots} out</span>
        </div>
        {data.poolCount > 1 && (
          <div className="text-purple-600 mt-1">{data.poolCount} pools</div>
        )}
        {data.encounterCount > 0 && (
          <div className="text-gray-500 mt-1">~{data.encounterCount} matches</div>
        )}
      </div>
    </div>
  );
}

/**
 * Data/list view for phases
 */
function PhaseDataView({ phases }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-700">#</th>
            <th className="px-4 py-2 text-left font-medium text-gray-700">Phase</th>
            <th className="px-4 py-2 text-left font-medium text-gray-700">Type</th>
            <th className="px-4 py-2 text-center font-medium text-gray-700">In</th>
            <th className="px-4 py-2 text-center font-medium text-gray-700">Out</th>
            <th className="px-4 py-2 text-center font-medium text-gray-700">Pools</th>
            <th className="px-4 py-2 text-center font-medium text-gray-700">Matches</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {phases.map((phase, index) => (
            <tr key={phase.order || index} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-500">{phase.order || index + 1}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{phase.name}</td>
              <td className="px-4 py-3 text-gray-600">{phase.type}</td>
              <td className="px-4 py-3 text-center">{phase.incomingSlots || phase.inSlots || '-'}</td>
              <td className="px-4 py-3 text-center">{phase.exitingSlots || phase.outSlots || '-'}</td>
              <td className="px-4 py-3 text-center">{phase.poolCount > 1 ? phase.poolCount : '-'}</td>
              <td className="px-4 py-3 text-center">{phase.encounterCount || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
