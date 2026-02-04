import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { tournamentApi } from '../services/api'
import {
  Layers, Plus, Edit2, Trash2, Check, X, RefreshCw, AlertTriangle,
  Copy, ChevronDown, ChevronUp, Eye, Code, FileJson, Save, GitBranch,
  Trophy, Users, Hash, ArrowRight, Clock, Zap, Settings, Award, Move,
  LayoutGrid, List, Shuffle, Repeat, Grid3X3, Swords, Target, GripVertical,
  ArrowLeft, Info, Lightbulb, MousePointer, Link, ChevronRight
} from 'lucide-react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  MarkerType,
  Panel,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'

const CATEGORIES = [
  { value: 'SingleElimination', label: 'Single Elimination', icon: GitBranch },
  { value: 'DoubleElimination', label: 'Double Elimination', icon: GitBranch },
  { value: 'RoundRobin', label: 'Round Robin', icon: RefreshCw },
  { value: 'Pools', label: 'Pools', icon: Layers },
  { value: 'Combined', label: 'Combined (Pools + Bracket)', icon: Trophy },
  { value: 'Custom', label: 'Custom', icon: Code }
]

const PHASE_TYPES = [
  'SingleElimination', 'DoubleElimination', 'RoundRobin', 'Pools', 'BracketRound', 'Swiss'
]

const BRACKET_TYPES = ['SingleElimination', 'DoubleElimination', 'BracketRound']

const SEEDING_STRATEGIES = ['CrossPool', 'Sequential', 'Manual']

const AWARD_TYPES = ['Gold', 'Silver', 'Bronze', 'none']

const DEFAULT_PHASE = {
  name: 'New Phase',
  phaseType: 'SingleElimination',
  sortOrder: 1,
  incomingSlotCount: 8,
  advancingSlotCount: 4,
  poolCount: 0,
  bestOf: 1,
  matchDurationMinutes: 30,
  seedingStrategy: 'Sequential',
  includeConsolation: false
}

const DEFAULT_EXIT_POSITION = { rank: 1, label: 'Champion', awardType: 'Gold' }

const DEFAULT_ADVANCEMENT_RULE = {
  sourcePhaseOrder: 1,
  targetPhaseOrder: 2,
  finishPosition: 1,
  targetSlotNumber: 1,
  sourcePoolIndex: null
}

// ── Helper: Parse structureJson into visual state ──
function parseStructureToVisual(jsonStr) {
  try {
    const s = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
    if (s.isFlexible) {
      return {
        isFlexible: true,
        generateBracket: s.generateBracket || { type: 'SingleElimination', consolation: false, calculateByes: true },
        exitPositions: Array.isArray(s.exitPositions) ? s.exitPositions : [],
        phases: [],
        advancementRules: []
      }
    }
    return {
      isFlexible: false,
      generateBracket: { type: 'SingleElimination', consolation: false, calculateByes: true },
      phases: Array.isArray(s.phases) ? s.phases.map((p, i) => ({
        name: p.name || `Phase ${i + 1}`,
        phaseType: p.phaseType || p.type || 'SingleElimination',
        sortOrder: p.sortOrder || i + 1,
        incomingSlotCount: p.incomingSlotCount ?? p.incomingSlots ?? 8,
        advancingSlotCount: p.advancingSlotCount ?? p.exitingSlots ?? 4,
        poolCount: p.poolCount || 0,
        bestOf: p.bestOf || 1,
        matchDurationMinutes: p.matchDurationMinutes || 30,
        seedingStrategy: p.seedingStrategy || 'Sequential',
        includeConsolation: p.includeConsolation || p.hasConsolationMatch || false
      })) : [],
      advancementRules: Array.isArray(s.advancementRules) ? s.advancementRules.map(r => ({
        sourcePhaseOrder: r.sourcePhaseOrder ?? r.fromPhase ?? 1,
        targetPhaseOrder: r.targetPhaseOrder ?? r.toPhase ?? 2,
        finishPosition: r.finishPosition ?? r.fromRank ?? 1,
        targetSlotNumber: r.targetSlotNumber ?? r.toSlot ?? 1,
        sourcePoolIndex: r.sourcePoolIndex ?? null
      })) : [],
      exitPositions: Array.isArray(s.exitPositions) ? s.exitPositions : []
    }
  } catch {
    return {
      isFlexible: false,
      generateBracket: { type: 'SingleElimination', consolation: false, calculateByes: true },
      phases: [{ ...DEFAULT_PHASE }],
      advancementRules: [],
      exitPositions: []
    }
  }
}

// ── Helper: Serialize visual state to JSON string ──
function serializeVisualToJson(vs) {
  if (vs.isFlexible) {
    return JSON.stringify({
      isFlexible: true,
      generateBracket: vs.generateBracket,
      exitPositions: vs.exitPositions
    }, null, 2)
  }
  const obj = {
    phases: vs.phases.map((p, i) => ({
      name: p.name,
      phaseType: p.phaseType,
      sortOrder: i + 1,
      incomingSlotCount: parseInt(p.incomingSlotCount) || 0,
      advancingSlotCount: parseInt(p.advancingSlotCount) || 0,
      poolCount: p.phaseType === 'Pools' ? (parseInt(p.poolCount) || 0) : 0,
      bestOf: parseInt(p.bestOf) || 1,
      matchDurationMinutes: parseInt(p.matchDurationMinutes) || 30,
      ...(p.seedingStrategy && p.seedingStrategy !== 'Sequential' ? { seedingStrategy: p.seedingStrategy } : {}),
      ...(BRACKET_TYPES.includes(p.phaseType) && p.includeConsolation ? { includeConsolation: true } : {})
    })),
    advancementRules: vs.advancementRules,
    ...(vs.exitPositions.length > 0 ? { exitPositions: vs.exitPositions } : {})
  }
  return JSON.stringify(obj, null, 2)
}

// ── Auto-generate advancement rules ──
function autoGenerateRules(phases) {
  const rules = []
  for (let i = 0; i < phases.length - 1; i++) {
    const src = phases[i]
    const tgt = phases[i + 1]
    const srcOrder = i + 1
    const tgtOrder = i + 2
    const slotsToAdvance = Math.min(
      parseInt(src.advancingSlotCount) || 0,
      parseInt(tgt.incomingSlotCount) || 0
    )
    if (src.phaseType === 'Pools' && (parseInt(src.poolCount) || 0) > 1) {
      const poolCount = parseInt(src.poolCount)
      const advPerPool = Math.max(1, Math.floor(slotsToAdvance / poolCount))
      let slot = 1
      for (let pool = 0; pool < poolCount; pool++) {
        for (let pos = 1; pos <= advPerPool; pos++) {
          rules.push({
            sourcePhaseOrder: srcOrder,
            targetPhaseOrder: tgtOrder,
            finishPosition: pos,
            targetSlotNumber: slot++,
            sourcePoolIndex: pool
          })
        }
      }
    } else {
      for (let pos = 1; pos <= slotsToAdvance; pos++) {
        rules.push({
          sourcePhaseOrder: srcOrder,
          targetPhaseOrder: tgtOrder,
          finishPosition: pos,
          targetSlotNumber: pos,
          sourcePoolIndex: null
        })
      }
    }
  }
  return rules
}


// ══════════════════════════════════════════
// ListPhaseEditor — inline sub-component (formerly VisualPhaseEditor)
// ══════════════════════════════════════════
const ListPhaseEditor = ({ visualState, onChange }) => {
  const [collapsedPhases, setCollapsedPhases] = useState(new Set())
  const vs = visualState

  const update = (patch) => onChange({ ...vs, ...patch })

  const toggleCollapse = (idx) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  // ── Phase helpers ──
  const updatePhase = (idx, field, value) => {
    const phases = [...vs.phases]
    phases[idx] = { ...phases[idx], [field]: value }
    update({ phases })
  }

  const addPhase = () => {
    const order = vs.phases.length + 1
    const prev = vs.phases[vs.phases.length - 1]
    const incoming = prev ? (parseInt(prev.advancingSlotCount) || 4) : 8
    update({
      phases: [...vs.phases, {
        ...DEFAULT_PHASE,
        name: `Phase ${order}`,
        sortOrder: order,
        incomingSlotCount: incoming,
        advancingSlotCount: Math.max(1, Math.floor(incoming / 2))
      }]
    })
  }

  const removePhase = (idx) => {
    if (vs.phases.length <= 1) return
    const phases = vs.phases.filter((_, i) => i !== idx).map((p, i) => ({ ...p, sortOrder: i + 1 }))
    const rules = vs.advancementRules.filter(r =>
      r.sourcePhaseOrder !== idx + 1 && r.targetPhaseOrder !== idx + 1
    ).map(r => ({
      ...r,
      sourcePhaseOrder: r.sourcePhaseOrder > idx + 1 ? r.sourcePhaseOrder - 1 : r.sourcePhaseOrder,
      targetPhaseOrder: r.targetPhaseOrder > idx + 1 ? r.targetPhaseOrder - 1 : r.targetPhaseOrder
    }))
    update({ phases, advancementRules: rules })
  }

  const movePhase = (idx, dir) => {
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= vs.phases.length) return
    const phases = [...vs.phases]
    ;[phases[idx], phases[swapIdx]] = [phases[swapIdx], phases[idx]]
    const reordered = phases.map((p, i) => ({ ...p, sortOrder: i + 1 }))
    update({ phases: reordered })
  }

  // ── Rule helpers ──
  const updateRule = (idx, field, value) => {
    const rules = [...vs.advancementRules]
    rules[idx] = { ...rules[idx], [field]: value }
    update({ advancementRules: rules })
  }

  const addRule = () => {
    const src = vs.phases.length >= 1 ? 1 : 1
    const tgt = vs.phases.length >= 2 ? 2 : 1
    update({
      advancementRules: [...vs.advancementRules, {
        ...DEFAULT_ADVANCEMENT_RULE,
        sourcePhaseOrder: src,
        targetPhaseOrder: tgt
      }]
    })
  }

  const removeRule = (idx) => {
    update({ advancementRules: vs.advancementRules.filter((_, i) => i !== idx) })
  }

  const handleAutoGenerate = () => {
    update({ advancementRules: autoGenerateRules(vs.phases) })
  }

  // ── Exit position helpers ──
  const updateExit = (idx, field, value) => {
    const exits = [...vs.exitPositions]
    exits[idx] = { ...exits[idx], [field]: value }
    update({ exitPositions: exits })
  }

  const addExit = () => {
    const nextRank = vs.exitPositions.length + 1
    const labels = ['Champion', 'Runner-up', '3rd Place', '4th Place']
    const awards = ['Gold', 'Silver', 'Bronze', 'none']
    update({
      exitPositions: [...vs.exitPositions, {
        rank: nextRank,
        label: labels[nextRank - 1] || `${nextRank}th Place`,
        awardType: awards[nextRank - 1] || 'none'
      }]
    })
  }

  const removeExit = (idx) => {
    update({ exitPositions: vs.exitPositions.filter((_, i) => i !== idx) })
  }

  // ── Flexible template toggle ──
  const toggleFlexible = () => {
    update({ isFlexible: !vs.isFlexible })
  }

  const updateBracketConfig = (field, value) => {
    update({ generateBracket: { ...vs.generateBracket, [field]: value } })
  }

  // ══ RENDER ══
  return (
    <div className="space-y-4">
      {/* Flexible toggle */}
      <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={vs.isFlexible}
            onChange={toggleFlexible}
            className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
          />
          <span className="text-sm font-medium text-purple-800">Flexible Template</span>
        </label>
        <span className="text-xs text-purple-600">
          Auto-generates bracket based on team count
        </span>
      </div>

      {vs.isFlexible ? (
        /* ── Flexible editor ── */
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-600" />
              Bracket Generation Config
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bracket Type</label>
                <select
                  value={vs.generateBracket.type || 'SingleElimination'}
                  onChange={e => updateBracketConfig('type', e.target.value)}
                  className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-purple-500"
                >
                  {PHASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vs.generateBracket.consolation || false}
                    onChange={e => updateBracketConfig('consolation', e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">Consolation</span>
                </label>
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vs.generateBracket.calculateByes || false}
                    onChange={e => updateBracketConfig('calculateByes', e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">Calculate Byes</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Standard phases editor ── */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              Phases ({vs.phases.length})
            </h4>
            <button
              type="button"
              onClick={addPhase}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-3 h-3" /> Add Phase
            </button>
          </div>

          {vs.phases.map((phase, idx) => {
            const collapsed = collapsedPhases.has(idx)
            const isBracket = BRACKET_TYPES.includes(phase.phaseType)
            const isPools = phase.phaseType === 'Pools'

            return (
              <div key={idx} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                {/* Phase header */}
                <div
                  className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b cursor-pointer"
                  onClick={() => toggleCollapse(idx)}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-sm text-gray-800">{phase.name}</span>
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">{phase.phaseType}</span>
                    <span className="text-xs text-gray-400">
                      {phase.incomingSlotCount} in → {phase.advancingSlotCount} out
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); movePhase(idx, -1) }}
                      disabled={idx === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Move up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); movePhase(idx, 1) }}
                      disabled={idx === vs.phases.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Move down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); removePhase(idx) }}
                      disabled={vs.phases.length <= 1}
                      className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30"
                      title="Remove phase"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {/* Phase body */}
                {!collapsed && (
                  <div className="p-3 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {/* Name */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Phase Name</label>
                        <input
                          type="text"
                          value={phase.name}
                          onChange={e => updatePhase(idx, 'name', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                      {/* Type */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Phase Type</label>
                        <select
                          value={phase.phaseType}
                          onChange={e => updatePhase(idx, 'phaseType', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                          {PHASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      {/* Incoming */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Incoming Slots</label>
                        <input
                          type="number" min={1}
                          value={phase.incomingSlotCount}
                          onChange={e => updatePhase(idx, 'incomingSlotCount', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                      {/* Advancing */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Advancing Slots</label>
                        <input
                          type="number" min={0}
                          value={phase.advancingSlotCount}
                          onChange={e => updatePhase(idx, 'advancingSlotCount', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                      {/* Pool Count (only for Pools) */}
                      {isPools && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Pool Count</label>
                          <input
                            type="number" min={1}
                            value={phase.poolCount}
                            onChange={e => updatePhase(idx, 'poolCount', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                      )}
                      {/* Best Of */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Best Of</label>
                        <select
                          value={phase.bestOf}
                          onChange={e => updatePhase(idx, 'bestOf', parseInt(e.target.value))}
                          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                          <option value={1}>1</option>
                          <option value={3}>3</option>
                          <option value={5}>5</option>
                        </select>
                      </div>
                      {/* Duration */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Duration (min)</label>
                        <input
                          type="number" min={1}
                          value={phase.matchDurationMinutes}
                          onChange={e => updatePhase(idx, 'matchDurationMinutes', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                      {/* Seeding Strategy */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Seeding</label>
                        <select
                          value={phase.seedingStrategy || 'Sequential'}
                          onChange={e => updatePhase(idx, 'seedingStrategy', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                          {SEEDING_STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    {/* Consolation checkbox (bracket types only) */}
                    {isBracket && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={phase.includeConsolation || false}
                          onChange={e => updatePhase(idx, 'includeConsolation', e.target.checked)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Include consolation bracket</span>
                      </label>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Advancement Rules (only for standard multi-phase) ── */}
      {!vs.isFlexible && vs.phases.length > 1 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-purple-600" />
              Advancement Rules ({vs.advancementRules.length})
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAutoGenerate}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border"
                title="Auto-generate rules based on phase slot counts"
              >
                <Zap className="w-3 h-3" /> Auto-generate
              </button>
              <button
                type="button"
                onClick={addRule}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Plus className="w-3 h-3" /> Add Rule
              </button>
            </div>
          </div>

          {vs.advancementRules.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-2">
              No advancement rules defined. Click "Auto-generate" to create defaults.
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="px-3 py-2 text-left font-medium">Source Phase</th>
                    <th className="px-3 py-2 text-left font-medium">Pool</th>
                    <th className="px-3 py-2 text-left font-medium">Finish Pos</th>
                    <th className="px-3 py-2 text-left font-medium">→</th>
                    <th className="px-3 py-2 text-left font-medium">Target Phase</th>
                    <th className="px-3 py-2 text-left font-medium">Slot #</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {vs.advancementRules.map((rule, idx) => {
                    const srcPhase = vs.phases[rule.sourcePhaseOrder - 1]
                    const srcHasPools = srcPhase && srcPhase.phaseType === 'Pools' && (parseInt(srcPhase.poolCount) || 0) > 1
                    return (
                      <tr key={idx} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-1.5">
                          <select
                            value={rule.sourcePhaseOrder}
                            onChange={e => updateRule(idx, 'sourcePhaseOrder', parseInt(e.target.value))}
                            className="w-full px-1 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500"
                          >
                            {vs.phases.map((p, i) => (
                              <option key={i} value={i + 1}>{i + 1}. {p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          {srcHasPools ? (
                            <select
                              value={rule.sourcePoolIndex ?? ''}
                              onChange={e => updateRule(idx, 'sourcePoolIndex', e.target.value === '' ? null : parseInt(e.target.value))}
                              className="w-full px-1 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="">Any</option>
                              {Array.from({ length: parseInt(srcPhase.poolCount) || 0 }, (_, i) => (
                                <option key={i} value={i}>Pool {i + 1}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number" min={1}
                            value={rule.finishPosition}
                            onChange={e => updateRule(idx, 'finishPosition', parseInt(e.target.value) || 1)}
                            className="w-16 px-1 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <ArrowRight className="w-4 h-4 text-purple-400" />
                        </td>
                        <td className="px-3 py-1.5">
                          <select
                            value={rule.targetPhaseOrder}
                            onChange={e => updateRule(idx, 'targetPhaseOrder', parseInt(e.target.value))}
                            className="w-full px-1 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500"
                          >
                            {vs.phases.map((p, i) => (
                              <option key={i} value={i + 1}>{i + 1}. {p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number" min={1}
                            value={rule.targetSlotNumber}
                            onChange={e => updateRule(idx, 'targetSlotNumber', parseInt(e.target.value) || 1)}
                            className="w-16 px-1 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <button
                            type="button"
                            onClick={() => removeRule(idx)}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Exit Positions ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-600" />
            Exit Positions ({vs.exitPositions.length})
          </h4>
          <button
            type="button"
            onClick={addExit}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus className="w-3 h-3" /> Add Position
          </button>
        </div>

        {vs.exitPositions.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-2">
            No exit positions defined. Add positions for final placement (Champion, Runner-up, etc.)
          </p>
        ) : (
          <div className="space-y-2">
            {vs.exitPositions.map((ep, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-white border rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-xs flex items-center justify-center font-bold flex-shrink-0">
                    #{ep.rank}
                  </span>
                </div>
                <input
                  type="number" min={1}
                  value={ep.rank}
                  onChange={e => updateExit(idx, 'rank', parseInt(e.target.value) || 1)}
                  className="w-16 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500"
                  title="Rank"
                />
                <input
                  type="text"
                  value={ep.label}
                  onChange={e => updateExit(idx, 'label', e.target.value)}
                  placeholder="Label (e.g. Champion)"
                  className="flex-1 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500"
                />
                <select
                  value={ep.awardType || 'none'}
                  onChange={e => updateExit(idx, 'awardType', e.target.value)}
                  className="px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500"
                >
                  {AWARD_TYPES.map(a => (
                    <option key={a} value={a}>{a === 'none' ? 'No Award' : a}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeExit(idx)}
                  className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


// ══════════════════════════════════════════
// Canvas Phase Editor — React Flow based
// ══════════════════════════════════════════

const PHASE_TYPE_COLORS = {
  SingleElimination: { bg: 'bg-indigo-500', light: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-700', hex: '#6366f1' },
  DoubleElimination: { bg: 'bg-purple-500', light: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', hex: '#a855f7' },
  RoundRobin: { bg: 'bg-green-500', light: 'bg-green-50', border: 'border-green-300', text: 'text-green-700', hex: '#22c55e' },
  Pools: { bg: 'bg-blue-500', light: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', hex: '#3b82f6' },
  Swiss: { bg: 'bg-amber-500', light: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', hex: '#f59e0b' },
  BracketRound: { bg: 'bg-rose-500', light: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700', hex: '#f43f5e' }
}

const PHASE_TYPE_ICONS = {
  SingleElimination: GitBranch,
  DoubleElimination: Swords,
  RoundRobin: Repeat,
  Pools: Grid3X3,
  Swiss: Shuffle,
  BracketRound: Target
}

const NODE_WIDTH = 220
const NODE_HEIGHT = 100

// Dagre auto-layout
function getLayoutedElements(nodes, edges) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 })

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  })
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id)
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}

// Custom Phase Node
const PhaseNode = memo(({ data, selected }) => {
  const colors = PHASE_TYPE_COLORS[data.phaseType] || PHASE_TYPE_COLORS.SingleElimination
  const Icon = PHASE_TYPE_ICONS[data.phaseType] || GitBranch

  return (
    <div
      className={`rounded-lg shadow-md border-2 overflow-hidden transition-all ${
        selected ? 'ring-2 ring-purple-400 ring-offset-2' : ''
      } ${colors.border}`}
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white" />
      <div className={`${colors.bg} px-3 py-1.5 flex items-center gap-2`}>
        <Icon className="w-3.5 h-3.5 text-white" />
        <span className="text-white text-xs font-semibold truncate flex-1">{data.label}</span>
        <span className="text-white/70 text-[10px]">#{data.sortOrder}</span>
      </div>
      <div className={`${colors.light} px-3 py-2`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-medium ${colors.text}`}>{data.phaseType}</span>
          <span className="text-xs text-gray-500">
            {data.incomingSlotCount} in → {data.advancingSlotCount} out
          </span>
        </div>
        {data.phaseType === 'Pools' && data.poolCount > 0 && (
          <div className="text-[10px] text-gray-400 mt-0.5">{data.poolCount} pools</div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white" />
    </div>
  )
})

const nodeTypes = { phaseNode: PhaseNode }

// Palette item
const PaletteItem = ({ phaseType, label }) => {
  const colors = PHASE_TYPE_COLORS[phaseType] || PHASE_TYPE_COLORS.SingleElimination
  const Icon = PHASE_TYPE_ICONS[phaseType] || GitBranch

  const onDragStart = (event) => {
    event.dataTransfer.setData('application/reactflow-phasetype', phaseType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${colors.light} ${colors.border}`}
    >
      <Icon className={`w-4 h-4 ${colors.text}`} />
      <span className={`text-xs font-medium ${colors.text}`}>{label}</span>
    </div>
  )
}

// Config Panel for selected node
const NodeConfigPanel = ({ phase, phaseIndex, onChange, onDelete }) => {
  if (!phase) return null
  const isBracket = BRACKET_TYPES.includes(phase.phaseType)
  const isPools = phase.phaseType === 'Pools'

  const update = (field, value) => onChange(phaseIndex, field, value)

  return (
    <div className="space-y-3 p-3">
      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <Settings className="w-4 h-4 text-purple-600" />
        Phase Config
      </h4>
      <div className="space-y-2">
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Name</label>
          <input type="text" value={phase.name} onChange={e => update('name', e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Type</label>
          <select value={phase.phaseType} onChange={e => update('phaseType', e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500">
            {PHASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-0.5">In Slots</label>
            <input type="number" min={1} value={phase.incomingSlotCount}
              onChange={e => update('incomingSlotCount', parseInt(e.target.value) || 0)}
              className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Adv Slots</label>
            <input type="number" min={0} value={phase.advancingSlotCount}
              onChange={e => update('advancingSlotCount', parseInt(e.target.value) || 0)}
              className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500" />
          </div>
        </div>
        {isPools && (
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Pool Count</label>
            <input type="number" min={1} value={phase.poolCount}
              onChange={e => update('poolCount', parseInt(e.target.value) || 0)}
              className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Best Of</label>
            <select value={phase.bestOf} onChange={e => update('bestOf', parseInt(e.target.value))}
              className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500">
              <option value={1}>1</option>
              <option value={3}>3</option>
              <option value={5}>5</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Duration</label>
            <input type="number" min={1} value={phase.matchDurationMinutes}
              onChange={e => update('matchDurationMinutes', parseInt(e.target.value) || 0)}
              className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500" />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Seeding</label>
          <select value={phase.seedingStrategy || 'Sequential'} onChange={e => update('seedingStrategy', e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500">
            {SEEDING_STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {isBracket && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={phase.includeConsolation || false}
              onChange={e => update('includeConsolation', e.target.checked)}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
            <span className="text-xs text-gray-700">Include consolation</span>
          </label>
        )}
      </div>
      <button type="button" onClick={onDelete}
        className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 mt-3">
        <Trash2 className="w-3.5 h-3.5" /> Delete Phase
      </button>
    </div>
  )
}

// Inner canvas component (needs ReactFlowProvider)
const CanvasPhaseEditorInner = ({ visualState, onChange }) => {
  const vs = visualState
  const reactFlowWrapper = useRef(null)
  const { screenToFlowPosition } = useReactFlow()
  const [selectedNodeId, setSelectedNodeId] = useState(null)

  // Convert visualState phases to React Flow nodes
  const buildNodes = useCallback((phases) => {
    return phases.map((phase, idx) => ({
      id: `phase-${idx}`,
      type: 'phaseNode',
      position: { x: 0, y: idx * 150 },
      data: {
        label: phase.name,
        phaseType: phase.phaseType,
        sortOrder: idx + 1,
        incomingSlotCount: phase.incomingSlotCount,
        advancingSlotCount: phase.advancingSlotCount,
        poolCount: phase.poolCount,
      },
    }))
  }, [])

  // Convert advancement rules to React Flow edges
  const buildEdges = useCallback((rules, phases) => {
    const edgeMap = new Map()
    rules.forEach((rule) => {
      const key = `${rule.sourcePhaseOrder}-${rule.targetPhaseOrder}`
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { sourcePhaseOrder: rule.sourcePhaseOrder, targetPhaseOrder: rule.targetPhaseOrder, count: 0 })
      }
      edgeMap.get(key).count++
    })

    return Array.from(edgeMap.values()).map(({ sourcePhaseOrder, targetPhaseOrder, count }) => {
      const srcPhase = phases[sourcePhaseOrder - 1]
      const label = srcPhase ? `Top ${count}` : `${count} slots`
      return {
        id: `e-${sourcePhaseOrder}-${targetPhaseOrder}`,
        source: `phase-${sourcePhaseOrder - 1}`,
        target: `phase-${targetPhaseOrder - 1}`,
        animated: true,
        label,
        style: { stroke: '#a78bfa' },
        labelStyle: { fontSize: 11, fontWeight: 600, fill: '#6d28d9' },
        labelBgStyle: { fill: '#f5f3ff', stroke: '#c4b5fd' },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 4,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#a78bfa' },
      }
    })
  }, [])

  // Initialize nodes/edges from visual state
  const initialNodes = useMemo(() => {
    const nodes = buildNodes(vs.phases)
    const edges = buildEdges(vs.advancementRules, vs.phases)
    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges)
    return layoutedNodes
  }, []) // Only on mount

  const initialEdges = useMemo(() => {
    return buildEdges(vs.advancementRules, vs.phases)
  }, []) // Only on mount

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Sync nodes/edges when visualState changes from outside (e.g., list editor toggle)
  const vsRef = useRef(vs)
  useEffect(() => {
    // Only re-sync if phases array length changed (structural change from outside)
    if (vsRef.current === vs) return
    const prevLen = vsRef.current.phases.length
    const newLen = vs.phases.length
    vsRef.current = vs

    // Always update node data to reflect current phase state
    setNodes(prev => {
      if (prev.length !== newLen) {
        // Structural change — full rebuild with layout
        const newNodes = buildNodes(vs.phases)
        const newEdges = buildEdges(vs.advancementRules, vs.phases)
        const { nodes: layoutedNodes } = getLayoutedElements(newNodes, newEdges)
        setEdges(newEdges)
        return layoutedNodes
      }
      // Just update data on existing nodes
      return prev.map((node, idx) => {
        const phase = vs.phases[idx]
        if (!phase) return node
        return {
          ...node,
          data: {
            label: phase.name,
            phaseType: phase.phaseType,
            sortOrder: idx + 1,
            incomingSlotCount: phase.incomingSlotCount,
            advancingSlotCount: phase.advancingSlotCount,
            poolCount: phase.poolCount,
          }
        }
      })
    })
  }, [vs, buildNodes, buildEdges, setNodes, setEdges])

  // When a connection is made, create advancement rules
  const onConnect = useCallback((params) => {
    const sourceIdx = parseInt(params.source.replace('phase-', ''))
    const targetIdx = parseInt(params.target.replace('phase-', ''))
    if (sourceIdx === targetIdx) return

    // Add edge
    setEdges((eds) => {
      // Check if edge already exists
      const exists = eds.some(e => e.source === params.source && e.target === params.target)
      if (exists) return eds
      const srcPhase = vs.phases[sourceIdx]
      const advancing = srcPhase ? parseInt(srcPhase.advancingSlotCount) || 1 : 1
      return addEdge({
        ...params,
        animated: true,
        label: `Top ${advancing}`,
        style: { stroke: '#a78bfa' },
        labelStyle: { fontSize: 11, fontWeight: 600, fill: '#6d28d9' },
        labelBgStyle: { fill: '#f5f3ff', stroke: '#c4b5fd' },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 4,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#a78bfa' },
      }, eds)
    })

    // Generate advancement rules for this connection
    const srcPhase = vs.phases[sourceIdx]
    const tgtPhase = vs.phases[targetIdx]
    const srcOrder = sourceIdx + 1
    const tgtOrder = targetIdx + 1
    const slotsToAdvance = Math.min(
      parseInt(srcPhase?.advancingSlotCount) || 1,
      parseInt(tgtPhase?.incomingSlotCount) || 1
    )

    const newRules = []
    if (srcPhase?.phaseType === 'Pools' && (parseInt(srcPhase.poolCount) || 0) > 1) {
      const poolCount = parseInt(srcPhase.poolCount)
      const advPerPool = Math.max(1, Math.floor(slotsToAdvance / poolCount))
      let slot = 1
      for (let pool = 0; pool < poolCount; pool++) {
        for (let pos = 1; pos <= advPerPool; pos++) {
          newRules.push({ sourcePhaseOrder: srcOrder, targetPhaseOrder: tgtOrder, finishPosition: pos, targetSlotNumber: slot++, sourcePoolIndex: pool })
        }
      }
    } else {
      for (let pos = 1; pos <= slotsToAdvance; pos++) {
        newRules.push({ sourcePhaseOrder: srcOrder, targetPhaseOrder: tgtOrder, finishPosition: pos, targetSlotNumber: pos, sourcePoolIndex: null })
      }
    }

    // Remove existing rules for this connection, then add new ones
    const filteredRules = vs.advancementRules.filter(
      r => !(r.sourcePhaseOrder === srcOrder && r.targetPhaseOrder === tgtOrder)
    )
    onChange({ ...vs, advancementRules: [...filteredRules, ...newRules] })
  }, [vs, onChange, setEdges])

  // When edges are deleted, remove corresponding advancement rules
  const onEdgesDelete = useCallback((deletedEdges) => {
    const pairsToRemove = deletedEdges.map(e => ({
      src: parseInt(e.source.replace('phase-', '')) + 1,
      tgt: parseInt(e.target.replace('phase-', '')) + 1,
    }))
    const filteredRules = vs.advancementRules.filter(r =>
      !pairsToRemove.some(p => p.src === r.sourcePhaseOrder && p.tgt === r.targetPhaseOrder)
    )
    onChange({ ...vs, advancementRules: filteredRules })
  }, [vs, onChange])

  // Node selection
  const onNodeClick = useCallback((_, node) => {
    setSelectedNodeId(node.id)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [])

  // Update phase config from panel
  const handlePhaseUpdate = useCallback((phaseIdx, field, value) => {
    const phases = [...vs.phases]
    phases[phaseIdx] = { ...phases[phaseIdx], [field]: value }
    onChange({ ...vs, phases })
  }, [vs, onChange])

  // Delete selected phase
  const handleDeletePhase = useCallback(() => {
    if (!selectedNodeId) return
    const idx = parseInt(selectedNodeId.replace('phase-', ''))
    if (vs.phases.length <= 1) return

    const phases = vs.phases.filter((_, i) => i !== idx).map((p, i) => ({ ...p, sortOrder: i + 1 }))
    const rules = vs.advancementRules.filter(r =>
      r.sourcePhaseOrder !== idx + 1 && r.targetPhaseOrder !== idx + 1
    ).map(r => ({
      ...r,
      sourcePhaseOrder: r.sourcePhaseOrder > idx + 1 ? r.sourcePhaseOrder - 1 : r.sourcePhaseOrder,
      targetPhaseOrder: r.targetPhaseOrder > idx + 1 ? r.targetPhaseOrder - 1 : r.targetPhaseOrder
    }))

    setSelectedNodeId(null)
    onChange({ ...vs, phases, advancementRules: rules })
  }, [selectedNodeId, vs, onChange])

  // Drop handler — add new phase from palette
  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((event) => {
    event.preventDefault()
    const phaseType = event.dataTransfer.getData('application/reactflow-phasetype')
    if (!phaseType) return

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const order = vs.phases.length + 1
    const prev = vs.phases[vs.phases.length - 1]
    const incoming = prev ? (parseInt(prev.advancingSlotCount) || 4) : 8

    const newPhase = {
      ...DEFAULT_PHASE,
      name: `${phaseType} Phase`,
      phaseType,
      sortOrder: order,
      incomingSlotCount: incoming,
      advancingSlotCount: Math.max(1, Math.floor(incoming / 2)),
      poolCount: phaseType === 'Pools' ? 4 : 0,
    }

    // Add node immediately at drop position
    const newNodeId = `phase-${vs.phases.length}`
    setNodes(prev => [...prev, {
      id: newNodeId,
      type: 'phaseNode',
      position,
      data: {
        label: newPhase.name,
        phaseType: newPhase.phaseType,
        sortOrder: order,
        incomingSlotCount: newPhase.incomingSlotCount,
        advancingSlotCount: newPhase.advancingSlotCount,
        poolCount: newPhase.poolCount,
      }
    }])

    onChange({ ...vs, phases: [...vs.phases, newPhase] })
  }, [vs, onChange, screenToFlowPosition, setNodes])

  // Auto-layout button
  const handleAutoLayout = useCallback(() => {
    const currentEdges = edges
    const { nodes: layoutedNodes } = getLayoutedElements(nodes, currentEdges)
    setNodes(layoutedNodes)
  }, [nodes, edges, setNodes])

  // Compute topological sort order and sync to phases
  const handleSyncSortOrder = useCallback(() => {
    // Build adjacency from edges
    const adj = new Map()
    const inDegree = new Map()
    nodes.forEach(n => { adj.set(n.id, []); inDegree.set(n.id, 0) })
    edges.forEach(e => {
      adj.get(e.source)?.push(e.target)
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1)
    })

    // Kahn's algorithm
    const queue = []
    inDegree.forEach((deg, id) => { if (deg === 0) queue.push(id) })
    const order = []
    while (queue.length > 0) {
      // Sort by Y position to maintain visual ordering for ties
      queue.sort((a, b) => {
        const na = nodes.find(n => n.id === a)
        const nb = nodes.find(n => n.id === b)
        return (na?.position?.y || 0) - (nb?.position?.y || 0)
      })
      const id = queue.shift()
      order.push(id)
      for (const neighbor of (adj.get(id) || [])) {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1)
        if (inDegree.get(neighbor) === 0) queue.push(neighbor)
      }
    }

    // Re-order phases by topological order
    const phases = [...vs.phases]
    const reordered = order.map((nodeId, newIdx) => {
      const oldIdx = parseInt(nodeId.replace('phase-', ''))
      return { ...phases[oldIdx], sortOrder: newIdx + 1 }
    })

    // Remap advancement rules
    const idxMap = new Map()
    order.forEach((nodeId, newIdx) => {
      const oldIdx = parseInt(nodeId.replace('phase-', ''))
      idxMap.set(oldIdx + 1, newIdx + 1)
    })
    const remappedRules = vs.advancementRules.map(r => ({
      ...r,
      sourcePhaseOrder: idxMap.get(r.sourcePhaseOrder) || r.sourcePhaseOrder,
      targetPhaseOrder: idxMap.get(r.targetPhaseOrder) || r.targetPhaseOrder,
    }))

    onChange({ ...vs, phases: reordered, advancementRules: remappedRules })
  }, [nodes, edges, vs, onChange])

  // Validation warnings
  const warnings = useMemo(() => {
    const w = []
    nodes.forEach((node, idx) => {
      if (idx === 0 && nodes.length > 0) return // First phase doesn't need incoming
      const hasIncoming = edges.some(e => e.target === node.id)
      if (!hasIncoming && nodes.length > 1) {
        w.push(`"${vs.phases[idx]?.name || node.id}" has no incoming connection`)
      }
    })
    return w
  }, [nodes, edges, vs.phases])

  const selectedPhaseIdx = selectedNodeId ? parseInt(selectedNodeId.replace('phase-', '')) : null
  const selectedPhase = selectedPhaseIdx !== null ? vs.phases[selectedPhaseIdx] : null

  return (
    <div className="flex border rounded-lg overflow-hidden bg-white h-full">
      {/* Left Palette */}
      <div className="w-48 border-r bg-gray-50 p-3 flex flex-col gap-2 flex-shrink-0 overflow-y-auto">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Phase Types</h4>
        <p className="text-[10px] text-gray-400 mb-2">Drag onto canvas</p>
        <PaletteItem phaseType="RoundRobin" label="Round Robin" />
        <PaletteItem phaseType="SingleElimination" label="Single Elim" />
        <PaletteItem phaseType="DoubleElimination" label="Double Elim" />
        <PaletteItem phaseType="Pools" label="Pools" />
        <PaletteItem phaseType="Swiss" label="Swiss" />
        <PaletteItem phaseType="BracketRound" label="Bracket Round" />
      </div>

      {/* Center Canvas */}
      <div className="flex-1" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
          proOptions={{ hideAttribution: true }}
          className="bg-gray-50"
        >
          <Background color="#e5e7eb" gap={20} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(node) => {
              const phaseType = node.data?.phaseType
              return PHASE_TYPE_COLORS[phaseType]?.hex || '#6366f1'
            }}
            style={{ height: 80, width: 120 }}
          />
          <Panel position="top-left" className="flex gap-1.5">
            <button onClick={handleAutoLayout}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border rounded-lg shadow-sm text-xs font-medium text-gray-600 hover:bg-gray-50">
              <LayoutGrid className="w-3.5 h-3.5" /> Auto Layout
            </button>
            <button onClick={handleSyncSortOrder}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border rounded-lg shadow-sm text-xs font-medium text-gray-600 hover:bg-gray-50">
              <ArrowRight className="w-3.5 h-3.5" /> Sync Order
            </button>
          </Panel>
          {warnings.length > 0 && (
            <Panel position="bottom-left">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 max-w-xs">
                {warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-700">
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* Right Config Panel */}
      {selectedPhase && (
        <div className="w-64 border-l bg-gray-50 overflow-y-auto flex-shrink-0">
          <NodeConfigPanel
            phase={selectedPhase}
            phaseIndex={selectedPhaseIdx}
            onChange={handlePhaseUpdate}
            onDelete={handleDeletePhase}
          />
        </div>
      )}
    </div>
  )
}

// Wrapped canvas editor with ReactFlowProvider
const CanvasPhaseEditor = ({ visualState, onChange }) => {
  return (
    <ReactFlowProvider>
      <CanvasPhaseEditorInner visualState={visualState} onChange={onChange} />
    </ReactFlowProvider>
  )
}


// ══════════════════════════════════════════
// Dynamic Instructions Component
// ══════════════════════════════════════════
const DynamicInstructions = ({ visualState, editorMode, visualSubMode, selectedNodeCount }) => {
  const phaseCount = visualState?.phases?.length || 0
  const ruleCount = visualState?.advancementRules?.length || 0
  const hasFlexible = visualState?.isFlexible

  const getInstructions = () => {
    if (editorMode === 'json') {
      return {
        icon: Code,
        title: 'Raw JSON Mode',
        tips: [
          'Edit the JSON structure directly',
          'Switch to Visual Editor to use the drag-and-drop canvas',
          'JSON is validated on save — invalid JSON will be rejected'
        ]
      }
    }
    if (visualSubMode === 'list') {
      return {
        icon: List,
        title: 'List Editor',
        tips: [
          'Click "+ Add Phase" to add phases sequentially',
          'Use arrows to reorder phases, click phases to expand settings',
          'Switch to Canvas view for a visual drag-and-drop experience'
        ]
      }
    }
    // Canvas mode
    if (hasFlexible) {
      return {
        icon: Zap,
        title: 'Flexible Template',
        tips: [
          'Flexible templates auto-generate brackets based on team count',
          'Uncheck "Flexible Template" to build a fixed structure with phases'
        ]
      }
    }
    if (phaseCount === 0) {
      return {
        icon: MousePointer,
        title: 'Get Started',
        color: 'blue',
        tips: [
          '👈 Drag a phase block from the left palette onto the canvas',
          'Start with your first phase (e.g., Pool Play or Round Robin)',
          'You can add more phases and connect them together'
        ]
      }
    }
    if (phaseCount === 1 && ruleCount === 0) {
      return {
        icon: Plus,
        title: 'Add More Phases',
        color: 'green',
        tips: [
          'Drag another phase block from the palette to create a multi-phase tournament',
          'Connect phases by dragging from the bottom handle (●) of one phase to the top handle of another',
          'Click a phase to configure its settings in the right panel'
        ]
      }
    }
    if (phaseCount >= 2 && ruleCount === 0) {
      return {
        icon: Link,
        title: 'Connect Your Phases',
        color: 'amber',
        tips: [
          '⚡ Drag from the bottom handle of a phase to the top handle of the next phase to connect them',
          'Connections define how teams advance between phases',
          'Use "Auto-layout" to arrange phases neatly'
        ]
      }
    }
    // Has phases and connections
    return {
      icon: Lightbulb,
      title: 'Tips',
      color: 'purple',
      tips: [
        `${phaseCount} phase${phaseCount > 1 ? 's' : ''}, ${ruleCount} connection${ruleCount > 1 ? 's' : ''} configured`,
        'Click any phase to edit its settings • Delete edges by clicking them',
        'Use "Sync Order" to update phase ordering from the canvas layout',
        phaseCount >= 3 ? 'Use "Auto-layout" to re-arrange phases neatly' : 'Drag phases to reposition them on the canvas'
      ]
    }
  }

  const info = getInstructions()
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
  }
  const colorClass = colors[info.color] || colors.purple

  return (
    <div className={`border rounded-lg px-3 py-2 text-sm ${colorClass}`}>
      <div className="flex items-start gap-2">
        <info.icon className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-70" />
        <div className="flex-1 min-w-0">
          <span className="font-medium">{info.title}:</span>{' '}
          {info.tips.map((tip, i) => (
            <span key={i}>
              {i > 0 && ' • '}{tip}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// Main PhaseTemplatesAdmin component
// ══════════════════════════════════════════
const PhaseTemplatesAdmin = ({ embedded = false }) => {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJsonPreview, setShowJsonPreview] = useState(false)
  const [showBasicInfo, setShowBasicInfo] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedTemplates, setExpandedTemplates] = useState({})
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Editor mode: 'visual' or 'json'
  const [editorMode, setEditorMode] = useState('visual')
  // Visual sub-mode: 'canvas' or 'list'
  const [visualSubMode, setVisualSubMode] = useState('canvas')
  // Visual state for the editor
  const [visualState, setVisualState] = useState(null)

  const defaultStructureJson = JSON.stringify({
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

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'SingleElimination',
    minUnits: 4,
    maxUnits: 16,
    defaultUnits: 8,
    diagramText: '',
    tags: '',
    structureJson: defaultStructureJson
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

  // ── Open modal: parse JSON → visual state ──
  const openModal = (fd) => {
    setFormData(fd)
    setVisualState(parseStructureToVisual(fd.structureJson))
    setEditorMode('visual')
    setShowCreateModal(true)
  }

  // Reset form for create
  const handleCreate = () => {
    openModal({
      name: '',
      description: '',
      category: 'SingleElimination',
      minUnits: 4,
      maxUnits: 16,
      defaultUnits: 8,
      diagramText: '',
      tags: '',
      structureJson: defaultStructureJson
    })
    setEditingTemplate(null)
  }

  // Clone existing template
  const handleClone = (template) => {
    const structure = typeof template.structureJson === 'string'
      ? template.structureJson
      : JSON.stringify(template.structureJson, null, 2)

    openModal({
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

    openModal({
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
  }

  // ── Visual state changed → serialize to JSON ──
  const handleVisualChange = useCallback((newVs) => {
    setVisualState(newVs)
    const json = serializeVisualToJson(newVs)
    setFormData(prev => ({ ...prev, structureJson: json }))
  }, [])

  // ── Toggle editor mode ──
  const handleToggleMode = () => {
    if (editorMode === 'visual') {
      // switching to JSON → already synced
      setEditorMode('json')
    } else {
      // switching to visual → re-parse JSON
      setVisualState(parseStructureToVisual(formData.structureJson))
      setEditorMode('visual')
    }
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
                    <>Phase {rule.fromPhase} #{rule.fromRank} → Phase {rule.toPhase} Slot {rule.toSlot}</>
                  ) : (
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

      {/* Full-Page Editor */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col overflow-hidden">
          {/* ── Top Bar ── */}
          <div className="bg-white border-b px-4 py-2 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back</span>
              </button>
              <div className="h-5 w-px bg-gray-300" />
              <h2 className="text-base font-semibold text-gray-800">
                {editingTemplate ? 'Edit Template' : 'Create New Template'}
              </h2>
              {formData.name && (
                <span className="text-sm text-gray-500">— {formData.name}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {editorMode === 'visual' && (
                <button
                  type="button"
                  onClick={() => setShowJsonPreview(!showJsonPreview)}
                  className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-purple-50"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showJsonPreview ? 'Hide Preview' : 'Preview'}
                </button>
              )}
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
              >
                {saving ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-3.5 h-3.5" /> {editingTemplate ? 'Update' : 'Create'}</>
                )}
              </button>
            </div>
          </div>

          {/* ── Collapsible Basic Info ── */}
          <div className="bg-white border-b flex-shrink-0">
            <button
              onClick={() => setShowBasicInfo(!showBasicInfo)}
              className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-3.5 h-3.5" />
                <span className="font-medium">Template Settings</span>
                {!showBasicInfo && formData.name && (
                  <span className="text-gray-400 ml-2">
                    {formData.name} • {CATEGORIES.find(c => c.value === formData.category)?.label} • {formData.minUnits}-{formData.maxUnits} teams
                  </span>
                )}
              </div>
              {showBasicInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showBasicInfo && (
              <div className="px-4 pb-3 space-y-3 border-t">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Template Name *</label>
                    <input type="text" value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., 8-Team Single Elimination"
                      className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
                    <select value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                      {CATEGORIES.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Min / Max / Default Teams</label>
                    <div className="flex gap-1">
                      <input type="number" value={formData.minUnits} min={2}
                        onChange={e => setFormData({ ...formData, minUnits: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Min" />
                      <input type="number" value={formData.maxUnits} min={2}
                        onChange={e => setFormData({ ...formData, maxUnits: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Max" />
                      <input type="number" value={formData.defaultUnits} min={2}
                        onChange={e => setFormData({ ...formData, defaultUnits: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Def" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tags</label>
                    <input type="text" value={formData.tags}
                      onChange={e => setFormData({ ...formData, tags: e.target.value })}
                      placeholder="bracket, elimination, popular"
                      className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                    <input type="text" value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of this tournament format..."
                      className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Diagram Text</label>
                    <input type="text" value={formData.diagramText}
                      onChange={e => setFormData({ ...formData, diagramText: e.target.value })}
                      placeholder="e.g., QF → SF → F"
                      className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Editor Mode Toolbar + Instructions ── */}
          <div className="bg-white border-b px-4 py-2 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                <button type="button"
                  onClick={() => { if (editorMode !== 'visual') handleToggleMode() }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    editorMode === 'visual' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-800'
                  }`}>
                  <Settings className="w-3.5 h-3.5" /> Visual Editor
                </button>
                <button type="button"
                  onClick={() => { if (editorMode !== 'json') handleToggleMode() }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    editorMode === 'json' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-800'
                  }`}>
                  <Code className="w-3.5 h-3.5" /> Raw JSON
                </button>
              </div>
              {editorMode === 'visual' && (
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                  <button type="button" onClick={() => setVisualSubMode('canvas')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      visualSubMode === 'canvas' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    <LayoutGrid className="w-3 h-3" /> Canvas
                  </button>
                  <button type="button" onClick={() => setVisualSubMode('list')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      visualSubMode === 'list' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    <List className="w-3 h-3" /> List
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 ml-4 max-w-2xl">
              <DynamicInstructions
                visualState={visualState}
                editorMode={editorMode}
                visualSubMode={visualSubMode}
              />
            </div>
          </div>

          {/* ── Main Editor Area (fills remaining space) ── */}
          <div className="flex-1 overflow-hidden">
            {editorMode === 'visual' && visualState ? (
              visualSubMode === 'canvas' ? (
                <div className="h-full">
                  <CanvasPhaseEditor
                    visualState={visualState}
                    onChange={handleVisualChange}
                  />
                </div>
              ) : (
                <div className="h-full overflow-y-auto p-4">
                  <div className="max-w-4xl mx-auto border rounded-lg p-4 bg-white shadow-sm space-y-4">
                    <ListPhaseEditor
                      visualState={visualState}
                      onChange={handleVisualChange}
                    />
                  </div>
                </div>
              )
            ) : (
              <div className="h-full overflow-y-auto p-4">
                <div className="max-w-4xl mx-auto">
                  <textarea
                    value={formData.structureJson}
                    onChange={e => setFormData({ ...formData, structureJson: e.target.value })}
                    className="w-full h-[calc(100vh-300px)] px-3 py-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder='{"phases": [...], "advancementRules": [...]}'
                  />
                </div>
              </div>
            )}

            {showJsonPreview && editorMode === 'visual' && (
              <div className="absolute bottom-4 right-4 w-96 max-h-64 overflow-y-auto p-3 bg-white rounded-lg border shadow-lg z-10">
                <h4 className="text-sm font-medium text-gray-700 mb-2">JSON Preview</h4>
                {renderStructurePreview({ structureJson: formData.structureJson })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default PhaseTemplatesAdmin
