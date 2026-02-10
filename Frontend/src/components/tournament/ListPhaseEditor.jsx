/**
 * ListPhaseEditor — List-based visual editor for tournament phase structures.
 * Extracted from PhaseTemplatesAdmin for reuse across the app.
 *
 * Props:
 *   visualState: { isFlexible, generateBracket, phases, advancementRules, exitPositions }
 *   onChange: (newVisualState) => void
 */
import { useState } from 'react'
import {
  Layers, Plus, Trash2, ChevronDown, ChevronUp, ArrowRight, Zap, Award
} from 'lucide-react'
import {
  PHASE_TYPES, BRACKET_TYPES, SEEDING_STRATEGIES, AWARD_TYPES,
  DEFAULT_PHASE, DEFAULT_ADVANCEMENT_RULE,
  autoGenerateRules
} from './structureEditorConstants'

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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              Phases ({vs.phases.length})
            </h4>
            <button type="button" onClick={addPhase}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              <Plus className="w-3 h-3" /> Add Phase
            </button>
          </div>

          {vs.phases.map((phase, idx) => {
            const collapsed = collapsedPhases.has(idx)
            const isBracket = BRACKET_TYPES.includes(phase.phaseType)
            const isPools = phase.phaseType === 'Pools'

            return (
              <div key={idx} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b cursor-pointer"
                  onClick={() => toggleCollapse(idx)}>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-bold">{idx + 1}</span>
                    <span className="font-medium text-sm text-gray-800">{phase.name}</span>
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">{phase.phaseType}</span>
                    <span className="text-xs text-gray-400">
                      {phase.phaseType === 'Award' 
                        ? `${phase.incomingSlotCount} in → 🏆` 
                        : phase.phaseType === 'Draw' 
                          ? `🎲 → ${phase.advancingSlotCount} out`
                          : `${phase.incomingSlotCount} in → ${phase.advancingSlotCount} out`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={e => { e.stopPropagation(); movePhase(idx, -1) }} disabled={idx === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30" title="Move up">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={e => { e.stopPropagation(); movePhase(idx, 1) }} disabled={idx === vs.phases.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30" title="Move down">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={e => { e.stopPropagation(); removePhase(idx) }} disabled={vs.phases.length <= 1}
                      className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30" title="Remove phase">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {!collapsed && (
                  <div className="p-3 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Phase Name</label>
                        <input type="text" value={phase.name}
                          onChange={e => updatePhase(idx, 'name', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Phase Type</label>
                        <select value={phase.phaseType}
                          onChange={e => updatePhase(idx, 'phaseType', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                          {PHASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Incoming Slots</label>
                        <input type="number" min={1} value={phase.incomingSlotCount}
                          onChange={e => updatePhase(idx, 'incomingSlotCount', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Advancing Slots</label>
                        <input type="number" min={0} value={phase.advancingSlotCount}
                          onChange={e => updatePhase(idx, 'advancingSlotCount', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
                      </div>
                      {isPools && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Pool Count</label>
                          <input type="number" min={1} value={phase.poolCount}
                            onChange={e => updatePhase(idx, 'poolCount', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Best Of</label>
                        <select value={phase.bestOf}
                          onChange={e => updatePhase(idx, 'bestOf', parseInt(e.target.value))}
                          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                          <option value={1}>1</option>
                          <option value={3}>3</option>
                          <option value={5}>5</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Duration (min)</label>
                        <input type="number" min={1} value={phase.matchDurationMinutes}
                          onChange={e => updatePhase(idx, 'matchDurationMinutes', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Seeding</label>
                        <select value={phase.seedingStrategy || 'Sequential'}
                          onChange={e => updatePhase(idx, 'seedingStrategy', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                          {SEEDING_STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    {isBracket && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={phase.includeConsolation || false}
                          onChange={e => updatePhase(idx, 'includeConsolation', e.target.checked)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
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

      {/* Advancement Rules */}
      {!vs.isFlexible && vs.phases.length > 1 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-purple-600" />
              Advancement Rules ({vs.advancementRules.length})
            </h4>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleAutoGenerate}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border"
                title="Auto-generate rules based on phase slot counts">
                <Zap className="w-3 h-3" /> Auto-generate
              </button>
              <button type="button" onClick={addRule}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700">
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
                          <select value={rule.sourcePhaseOrder}
                            onChange={e => updateRule(idx, 'sourcePhaseOrder', parseInt(e.target.value))}
                            className="w-full px-1 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500">
                            {vs.phases.map((p, i) => <option key={i} value={i + 1}>{i + 1}. {p.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          {srcHasPools ? (
                            <select value={rule.sourcePoolIndex ?? ''}
                              onChange={e => updateRule(idx, 'sourcePoolIndex', e.target.value === '' ? null : parseInt(e.target.value))}
                              className="w-full px-1 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500">
                              <option value="">Any</option>
                              {Array.from({ length: parseInt(srcPhase.poolCount) || 0 }, (_, i) => (
                                <option key={i} value={i}>Pool {i + 1}</option>
                              ))}
                            </select>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="number" min={1} value={rule.finishPosition}
                            onChange={e => updateRule(idx, 'finishPosition', parseInt(e.target.value) || 1)}
                            className="w-16 px-1 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500" />
                        </td>
                        <td className="px-3 py-1.5"><ArrowRight className="w-4 h-4 text-purple-400" /></td>
                        <td className="px-3 py-1.5">
                          <select value={rule.targetPhaseOrder}
                            onChange={e => updateRule(idx, 'targetPhaseOrder', parseInt(e.target.value))}
                            className="w-full px-1 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500">
                            {vs.phases.map((p, i) => <option key={i} value={i + 1}>{i + 1}. {p.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="number" min={1} value={rule.targetSlotNumber}
                            onChange={e => updateRule(idx, 'targetSlotNumber', parseInt(e.target.value) || 1)}
                            className="w-16 px-1 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500" />
                        </td>
                        <td className="px-3 py-1.5">
                          <button type="button" onClick={() => removeRule(idx)} className="p-1 text-gray-400 hover:text-red-500">
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

      {/* Exit Positions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-600" />
            Exit Positions ({vs.exitPositions.length})
          </h4>
          <button type="button" onClick={addExit}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700">
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
                <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-xs flex items-center justify-center font-bold flex-shrink-0">
                  #{ep.rank}
                </span>
                <input type="number" min={1} value={ep.rank}
                  onChange={e => updateExit(idx, 'rank', parseInt(e.target.value) || 1)}
                  className="w-16 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500" title="Rank" />
                <input type="text" value={ep.label}
                  onChange={e => updateExit(idx, 'label', e.target.value)}
                  placeholder="Label (e.g. Champion)"
                  className="flex-1 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500" />
                <select value={ep.awardType || 'none'}
                  onChange={e => updateExit(idx, 'awardType', e.target.value)}
                  className="px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500">
                  {AWARD_TYPES.map(a => <option key={a} value={a}>{a === 'none' ? 'No Award' : a}</option>)}
                </select>
                <button type="button" onClick={() => removeExit(idx)}
                  className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0">
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

export default ListPhaseEditor
