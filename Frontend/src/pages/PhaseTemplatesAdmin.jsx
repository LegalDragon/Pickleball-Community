import React, { useState, useEffect, useCallback } from 'react'
import { tournamentApi } from '../services/api'
import {
  Layers, Plus, Edit2, Trash2, Check, X, RefreshCw, AlertTriangle,
  Copy, ChevronDown, ChevronUp, Eye, Code, FileJson, Save, GitBranch,
  Trophy, Users, Hash, ArrowRight, Clock, Zap, Settings, Award, Move
} from 'lucide-react'

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
// VisualPhaseEditor — inline sub-component
// ══════════════════════════════════════════
const VisualPhaseEditor = ({ visualState, onChange }) => {
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
// Main PhaseTemplatesAdmin component
// ══════════════════════════════════════════
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

  // Editor mode: 'visual' or 'json'
  const [editorMode, setEditorMode] = useState('visual')
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

              {/* ═══ Structure Editor with Visual/JSON toggle ═══ */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Structure *
                  </label>
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => { if (editorMode !== 'visual') handleToggleMode() }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        editorMode === 'visual'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Visual Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (editorMode !== 'json') handleToggleMode() }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        editorMode === 'json'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      <Code className="w-3.5 h-3.5" />
                      Raw JSON
                    </button>
                  </div>
                </div>

                {editorMode === 'visual' && visualState ? (
                  <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
                    <VisualPhaseEditor
                      visualState={visualState}
                      onChange={handleVisualChange}
                    />
                  </div>
                ) : (
                  <div>
                    <textarea
                      value={formData.structureJson}
                      onChange={e => setFormData({ ...formData, structureJson: e.target.value })}
                      rows={16}
                      className="w-full px-3 py-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder='{"phases": [...], "advancementRules": [...]}'
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Edit raw JSON directly. Switch to Visual Editor to parse and edit visually.
                    </p>
                  </div>
                )}

                {showJsonPreview && editorMode === 'visual' && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
                    {renderStructurePreview({ structureJson: formData.structureJson })}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t flex items-center justify-between">
              <div className="flex items-center gap-2">
                {editorMode === 'visual' && (
                  <button
                    type="button"
                    onClick={() => setShowJsonPreview(!showJsonPreview)}
                    className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    {showJsonPreview ? 'Hide Preview' : 'Preview'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
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
        </div>
      )}
    </div>
  )
}

export default PhaseTemplatesAdmin
