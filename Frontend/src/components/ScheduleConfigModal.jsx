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
import dagre from 'dagre';
import {
  X, FileText, Check, Loader2, AlertTriangle,
  Table, Grid3X3, RefreshCcw, GitBranch, Layers, Trophy,
  Maximize2, Minimize2, ArrowRightLeft, ArrowDownUp
} from 'lucide-react';
import { tournamentApi } from '../services/api';
import { parseStructureToVisual, PHASE_TYPE_COLORS, PHASE_TYPE_ICONS } from './tournament/structureEditorConstants';

// Layout constants
const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;
const NODE_WIDTH_EXPANDED = 220;
const NODE_HEIGHT_EXPANDED = 120;

/**
 * Use dagre to compute tree layout positions
 */
function getLayoutedElements(nodes, edges, direction = 'TB', isExpanded = false) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  
  const nodeWidth = isExpanded ? NODE_WIDTH_EXPANDED : NODE_WIDTH;
  const nodeHeight = isExpanded ? NODE_HEIGHT_EXPANDED : NODE_HEIGHT;
  const nodeSep = isExpanded ? (direction === 'LR' ? 60 : 80) : (direction === 'LR' ? 40 : 60);
  const rankSep = isExpanded ? (direction === 'LR' ? 140 : 120) : (direction === 'LR' ? 100 : 80);
  
  g.setGraph({ rankdir: direction, nodesep: nodeSep, ranksep: rankSep });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * ScheduleConfigModal - Full-width template selection with visual flow preview
 */
export default function ScheduleConfigModal({
  isOpen,
  onClose,
  division,
  onGenerate,
  isGenerating = false
}) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [customUnitCount, setCustomUnitCount] = useState(division?.registeredUnits || 8);
  const [activeTab, setActiveTab] = useState('system');
  const [viewMode, setViewMode] = useState('visual');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const unitCount = division?.registeredUnits || 8;
  const divisionId = division?.id;

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      setCustomUnitCount(unitCount);
      setSelectedTemplate(null);
      setPreview(null);
    }
  }, [isOpen, unitCount]);

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

  // Filter and sort templates alphabetically
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
      
      // First try to parse structureJson directly from template (like template editor does)
      if (template.structureJson) {
        const visualState = parseStructureToVisual(template.structureJson);
        if (visualState?.phases?.length > 0) {
          // Convert visual state to preview format
          const phases = visualState.phases.map((p, i) => ({
            order: p.sortOrder || i + 1,
            name: p.name || `Phase ${i + 1}`,
            type: p.phaseType || p.type || 'RoundRobin',
            incomingSlots: p.incomingSlotCount || p.incomingSlots || unitCount,
            exitingSlots: p.advancingSlotCount || p.exitingSlots || unitCount,
            poolCount: p.poolCount || null,
            encounterCount: calculateEncounters(p, unitCount),
            includeConsolation: p.includeConsolation || false
          }));
          
          setPreview({
            templateId: template.id,
            templateName: template.name,
            unitCount: unitCount || template.defaultUnits,
            phases,
            totalEncounters: phases.reduce((sum, p) => sum + (p.encounterCount || 0), 0),
            totalRounds: phases.length,
            advancementRules: visualState.advancementRules || []
          });
          setPreviewLoading(false);
          return;
        }
      }
      
      // Fall back to API preview
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
  
  // Helper to calculate encounter count based on phase type
  const calculateEncounters = (phase, teams) => {
    const n = phase.incomingSlotCount || phase.incomingSlots || teams;
    const type = (phase.phaseType || phase.type || '').toLowerCase();
    
    if (type.includes('roundrobin') || type.includes('round')) {
      return n * (n - 1) / 2;
    } else if (type.includes('pool')) {
      const poolCount = phase.poolCount || 1;
      const perPool = Math.ceil(n / poolCount);
      return poolCount * (perPool * (perPool - 1) / 2);
    } else {
      // Bracket - roughly n/2 matches per round
      return Math.ceil(n / 2);
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
        onGenerate?.();
        onClose();
      } else {
        alert('Failed to apply template: ' + (result?.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error applying template:', err);
      alert('Failed to apply template');
    } finally {
      setApplying(false);
      setShowConfirmation(false);
    }
  };

  // Calculate preview stats
  const previewStats = preview ? {
    phases: preview.phases?.length || 0,
    encounters: preview.totalEncounters || preview.phases?.reduce((sum, p) => sum + (p.encounterCount || 0), 0) || 0,
    teams: customUnitCount
  } : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Configure Schedule</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {division?.name} • {unitCount} registered teams
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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : (
            <>
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
                      <PhaseFlowDiagram phases={preview.phases} structureJson={selectedTemplate?.structureJson} />
                    ) : (
                      <PhaseDataView phases={preview.phases} />
                    )
                  ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-gray-400">
                      <AlertTriangle className="w-8 h-8 mb-2 text-amber-400" />
                      <p>No preview available</p>
                      <p className="text-xs mt-1">Template structure may be incomplete</p>
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
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-900">
            Cancel
          </button>
          <button
            onClick={() => setShowConfirmation(true)}
            disabled={!selectedTemplate || applying || isGenerating}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {(applying || isGenerating) ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
            Apply Template
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 bg-amber-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Replace Existing Schedule?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  This will remove all existing phases and encounters for this division and create new ones from the template.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={applying}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {applying && <Loader2 className="w-4 h-4 animate-spin" />}
                Yes, Apply Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * React Flow diagram for phase visualization with tree layout
 */
function PhaseFlowDiagram({ phases, structureJson }) {
  const [direction, setDirection] = useState('TB'); // 'TB' or 'LR'
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse structure to get advancement rules
  const structure = useMemo(() => {
    if (!structureJson) return null;
    try {
      return typeof structureJson === 'string' ? JSON.parse(structureJson) : structureJson;
    } catch {
      return null;
    }
  }, [structureJson]);

  // Build nodes and edges
  const { nodes, edges } = useMemo(() => {
    const nodeList = [];
    const edgeList = [];
    
    // Build nodes from phases
    phases.forEach((phase, index) => {
      const order = phase.order || (index + 1);
      nodeList.push({
        id: `phase-${order - 1}`,
        type: 'phaseNode',
        position: { x: 0, y: 0 }, // Will be set by dagre
        data: {
          label: phase.name,
          type: phase.type,
          inSlots: phase.incomingSlots || phase.inSlots,
          outSlots: phase.exitingSlots || phase.outSlots,
          poolCount: phase.poolCount,
          encounterCount: phase.encounterCount,
          order: order,
          isExpanded: isExpanded
        }
      });
    });

    // Build edges from advancement rules if available
    const advancementRules = structure?.advancementRules || [];
    
    if (advancementRules.length > 0) {
      // Group rules by source-target pair
      const edgeMap = new Map();
      advancementRules.forEach((rule) => {
        const key = `${rule.sourcePhaseOrder}-${rule.targetPhaseOrder}`;
        if (!edgeMap.has(key)) {
          edgeMap.set(key, { 
            sourcePhaseOrder: rule.sourcePhaseOrder, 
            targetPhaseOrder: rule.targetPhaseOrder, 
            count: 0, 
            rules: [] 
          });
        }
        const entry = edgeMap.get(key);
        entry.count++;
        entry.rules.push(rule);
      });

      // Create edges from grouped rules
      edgeMap.forEach(({ sourcePhaseOrder, targetPhaseOrder, count, rules }) => {
        const sortedByTarget = [...rules].sort((a, b) => a.targetSlotNumber - b.targetSlotNumber);
        const positions = sortedByTarget.map(r => r.finishPosition);
        const label = count === 1 ? `${positions[0]}` : positions.join(', ');

        edgeList.push({
          id: `e-${sourcePhaseOrder}-${targetPhaseOrder}`,
          source: `phase-${sourcePhaseOrder - 1}`,
          target: `phase-${targetPhaseOrder - 1}`,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#a78bfa', strokeWidth: 2, strokeDasharray: '5,5' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#a78bfa' },
          label: label,
          labelStyle: { fill: '#7c3aed', fontWeight: 600, fontSize: 12 },
          labelBgStyle: { fill: '#f3e8ff', stroke: '#c4b5fd' },
          labelBgPadding: [6, 4],
          labelBgBorderRadius: 8,
        });
      });
    } else {
      // Fallback: sequential edges if no advancement rules
      phases.forEach((phase, index) => {
        if (index < phases.length - 1) {
          const order = phase.order || (index + 1);
          const nextOrder = phases[index + 1].order || (index + 2);
          edgeList.push({
            id: `edge-${index}`,
            source: `phase-${order - 1}`,
            target: `phase-${nextOrder - 1}`,
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
    }
    
    // Apply dagre layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodeList, edgeList, direction, isExpanded);
    return { nodes: layoutedNodes, edges: layoutedEdges };
  }, [phases, structure, direction, isExpanded]);

  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

  useEffect(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges]);

  const nodeTypes = useMemo(() => ({ phaseNode: PhaseNode }), []);

  return (
    <div className="relative">
      {/* Layout Controls */}
      <div className="absolute top-2 left-2 z-10 flex gap-1">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`p-1.5 rounded border text-xs flex items-center gap-1 transition-colors ${
            isExpanded 
              ? 'bg-purple-100 border-purple-300 text-purple-700' 
              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
          title={isExpanded ? 'Collapse nodes' : 'Expand nodes'}
        >
          {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => setDirection(d => d === 'TB' ? 'LR' : 'TB')}
          className="p-1.5 rounded border bg-white border-gray-300 text-gray-600 hover:bg-gray-50 text-xs flex items-center gap-1 transition-colors"
          title={direction === 'TB' ? 'Switch to horizontal' : 'Switch to vertical'}
        >
          {direction === 'TB' ? <ArrowRightLeft className="w-3.5 h-3.5" /> : <ArrowDownUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="h-80 border rounded-lg overflow-hidden bg-gradient-to-b from-gray-50 to-white">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
          minZoom={0.3}
          maxZoom={2}
        >
          <Background color="#e5e7eb" gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

function PhaseNode({ data }) {
  // Map type names to standard keys
  const getPhaseTypeKey = (type) => {
    const t = type?.toLowerCase() || '';
    if (t === 'roundrobin') return 'RoundRobin';
    if (t === 'pools') return 'Pools';
    if (t === 'singleelimination' || t === 'bracket') return 'SingleElimination';
    if (t === 'bracketround') return 'BracketRound';
    if (t === 'doubleelimination') return 'DoubleElimination';
    if (t === 'award') return 'Award';
    if (t === 'draw') return 'Draw';
    return 'SingleElimination';
  };

  const phaseTypeKey = getPhaseTypeKey(data.type);
  const colors = PHASE_TYPE_COLORS[phaseTypeKey] || PHASE_TYPE_COLORS.SingleElimination;
  const Icon = PHASE_TYPE_ICONS[phaseTypeKey] || GitBranch;
  const isExpanded = data.isExpanded;

  return (
    <div 
      className={`bg-white rounded-lg shadow-md border-2 overflow-hidden transition-all ${colors.border}`}
      style={{ width: isExpanded ? 220 : 180 }}
    >
      {/* Header */}
      <div className={`${colors.bg} text-white px-3 py-1.5 flex items-center gap-2`}>
        <Icon className="w-3.5 h-3.5" />
        <span className="font-medium text-xs truncate flex-1">{data.label}</span>
        <span className="text-white/70 text-[10px]">#{data.order}</span>
      </div>
      
      {/* Content */}
      <div className={`${colors.light} px-3 py-2`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-medium ${colors.text}`}>{data.type}</span>
          <span className="text-xs text-gray-500">
            {data.type?.toLowerCase() === 'award' 
              ? `${data.inSlots} in → 🏆` 
              : `${data.inSlots} in → ${data.outSlots} out`}
          </span>
        </div>
        {data.poolCount > 1 && (
          <div className="text-[10px] text-gray-500 mt-0.5">{data.poolCount} pools</div>
        )}
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="bg-white border-t px-3 py-2 text-[10px] text-gray-500 space-y-1">
          <div className="flex justify-between">
            <span>Incoming:</span>
            <span className="font-medium text-gray-700">{data.inSlots} slots</span>
          </div>
          <div className="flex justify-between">
            <span>Advancing:</span>
            <span className="font-medium text-gray-700">{data.outSlots} slots</span>
          </div>
          {data.poolCount > 1 && (
            <div className="flex justify-between">
              <span>Pool size:</span>
              <span className="font-medium text-gray-700">~{Math.ceil(data.inSlots / data.poolCount)} each</span>
            </div>
          )}
          {data.encounterCount > 0 && (
            <div className="flex justify-between">
              <span>Matches:</span>
              <span className="font-medium text-gray-700">~{data.encounterCount}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
              <td className="px-4 py-3 text-center">{phase.encounterCount || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
