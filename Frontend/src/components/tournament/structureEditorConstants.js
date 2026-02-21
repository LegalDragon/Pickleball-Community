/**
 * Shared constants, defaults, and helper functions for tournament structure editing.
 * Used by ListPhaseEditor, CanvasPhaseEditor, TournamentStructureEditor, and PhaseTemplatesAdmin.
 */
import {
  GitBranch, RefreshCw, Layers, Trophy, Code, Users, Shuffle, Repeat,
  Grid3X3, Swords, Target, Award
} from 'lucide-react'

// ── Category definitions ──
export const CATEGORIES = [
  { value: 'SingleElimination', label: 'Single Elimination', icon: GitBranch },
  { value: 'DoubleElimination', label: 'Double Elimination', icon: GitBranch },
  { value: 'RoundRobin', label: 'Round Robin', icon: RefreshCw },
  { value: 'Pools', label: 'Pools', icon: Layers },
  { value: 'Combined', label: 'Combined (Pools + Bracket)', icon: Trophy },
  { value: 'Custom', label: 'Custom', icon: Code }
]

// ── Phase types ──
export const PHASE_TYPES = [
  'Draw', 'SingleElimination', 'DoubleElimination', 'RoundRobin', 'Pools', 'BracketRound', 'Swiss', 'Award'
]

export const BRACKET_TYPES = ['SingleElimination', 'DoubleElimination', 'BracketRound']

export const SEEDING_STRATEGIES = ['Sequential', 'Folded', 'CrossPool', 'Manual']

/**
 * Get folded bracket slot for a given seed position.
 * For 8 teams: 1→1, 2→3, 3→5, 4→7, 5→8, 6→6, 7→4, 8→2
 * This ensures top seeds are on opposite sides and #1 plays #8, #2 plays #7, etc.
 */
export function getFoldedBracketSlot(position, totalSlots) {
  const half = totalSlots / 2
  if (position <= half) {
    // First half: positions 1,2,3,4 → slots 1,3,5,7 (odd slots)
    return position * 2 - 1
  } else {
    // Second half: positions 5,6,7,8 → slots 8,6,4,2 (even slots in reverse)
    return (totalSlots - position + 1) * 2
  }
}

export const AWARD_TYPES = ['Gold', 'Silver', 'Bronze', 'none']

// ── Default objects ──
export const DEFAULT_PHASE = {
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

export const DEFAULT_EXIT_POSITION = { rank: 1, label: 'Champion', awardType: 'Gold' }

export const DEFAULT_ADVANCEMENT_RULE = {
  sourcePhaseOrder: 1,
  targetPhaseOrder: 2,
  finishPosition: 1,
  targetSlotNumber: 1,
  sourcePoolIndex: null
}

// ── Phase type visual config (for canvas editor) ──
export const PHASE_TYPE_COLORS = {
  Draw: { bg: 'bg-cyan-500', light: 'bg-cyan-50', border: 'border-cyan-300', text: 'text-cyan-700', hex: '#06b6d4' },
  SingleElimination: { bg: 'bg-indigo-500', light: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-700', hex: '#6366f1' },
  DoubleElimination: { bg: 'bg-purple-500', light: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', hex: '#a855f7' },
  RoundRobin: { bg: 'bg-green-500', light: 'bg-green-50', border: 'border-green-300', text: 'text-green-700', hex: '#22c55e' },
  Pools: { bg: 'bg-blue-500', light: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', hex: '#3b82f6' },
  Swiss: { bg: 'bg-amber-500', light: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', hex: '#f59e0b' },
  BracketRound: { bg: 'bg-rose-500', light: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700', hex: '#f43f5e' },
  Award: { bg: 'bg-yellow-500', light: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700', hex: '#eab308' }
}

export const PHASE_TYPE_ICONS = {
  Draw: Users,
  SingleElimination: GitBranch,
  DoubleElimination: Swords,
  RoundRobin: Repeat,
  Pools: Grid3X3,
  Swiss: Shuffle,
  BracketRound: Target,
  Award: Award
}

// ── Parse structureJson into visual state ──
export function parseStructureToVisual(jsonStr) {
  try {
    const s = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
    if (s.isFlexible) {
      return {
        isFlexible: true,
        generateBracket: s.generateBracket || { type: 'SingleElimination', consolation: false, calculateByes: true },
        exitPositions: Array.isArray(s.exitPositions) ? s.exitPositions : [],
        phases: [],
        advancementRules: [],
        canvasLayout: null
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
        includeConsolation: p.includeConsolation || p.hasConsolationMatch || false,
        awardType: p.awardType || null,
        drawMethod: p.drawMethod || null
      })) : [],
      advancementRules: Array.isArray(s.advancementRules) ? s.advancementRules.map(r => ({
        // New format uses phase names; old format used sortOrder
        sourcePhase: r.sourcePhase ?? null,
        targetPhase: r.targetPhase ?? null,
        // Keep old format for backward compatibility during transition
        sourcePhaseOrder: r.sourcePhaseOrder ?? r.fromPhase ?? null,
        targetPhaseOrder: r.targetPhaseOrder ?? r.toPhase ?? null,
        finishPosition: r.finishPosition ?? r.fromRank ?? 1,
        targetSlotNumber: r.targetSlotNumber ?? r.toSlot ?? 1,
        sourcePoolIndex: r.sourcePoolIndex ?? null
      })) : [],
      exitPositions: Array.isArray(s.exitPositions) ? s.exitPositions : [],
      // Canvas layout: saved node positions and direction
      canvasLayout: s.canvasLayout || null
    }
  } catch {
    return {
      isFlexible: false,
      generateBracket: { type: 'SingleElimination', consolation: false, calculateByes: true },
      phases: [{ ...DEFAULT_PHASE }],
      advancementRules: [],
      exitPositions: [],
      canvasLayout: null
    }
  }
}

// ── Serialize visual state to JSON string ──
export function serializeVisualToJson(vs) {
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
      sortOrder: parseInt(p.sortOrder) || (i + 1),
      incomingSlotCount: parseInt(p.incomingSlotCount) || 0,
      advancingSlotCount: parseInt(p.advancingSlotCount) || 0,
      poolCount: p.phaseType === 'Pools' ? (parseInt(p.poolCount) || 0) : 0,
      bestOf: parseInt(p.bestOf) || 1,
      matchDurationMinutes: parseInt(p.matchDurationMinutes) || 30,
      ...(p.seedingStrategy && p.seedingStrategy !== 'Sequential' ? { seedingStrategy: p.seedingStrategy } : {}),
      ...(BRACKET_TYPES.includes(p.phaseType) && p.includeConsolation ? { includeConsolation: true } : {}),
      ...(p.phaseType === 'Award' && p.awardType ? { awardType: p.awardType } : {}),
      ...(p.phaseType === 'Draw' && p.drawMethod ? { drawMethod: p.drawMethod } : {})
    })),
    advancementRules: vs.advancementRules.map(r => ({
      sourcePhase: r.sourcePhase,
      targetPhase: r.targetPhase,
      finishPosition: r.finishPosition,
      targetSlotNumber: r.targetSlotNumber,
      sourcePoolIndex: r.sourcePoolIndex
    })),
    ...(vs.exitPositions.length > 0 ? { exitPositions: vs.exitPositions } : {}),
    // Save canvas layout (node positions and direction) if present
    ...(vs.canvasLayout ? { canvasLayout: vs.canvasLayout } : {})
  }
  return JSON.stringify(obj, null, 2)
}

// ── Auto-generate advancement rules ──
// Smart algorithm: connect smallest phase with remaining exits to smallest phase with remaining incoming slots
// Never creates self-referential connections (phase to itself)
export function autoGenerateRules(phases) {
  const rules = []
  
  // Create a sorted view of phases by sortOrder, tracking original indices
  // This ensures we process phases in logical order (1, 2, 3...) not array order
  const sortedPhases = phases
    .map((phase, origIdx) => ({ phase, origIdx, sortOrder: phase.sortOrder || (origIdx + 1) }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
  
  // Track remaining slots for each phase (keyed by original index)
  const exitRemaining = {}
  const incomingRemaining = {}
  
  phases.forEach((phase, idx) => {
    const advCount = parseInt(phase.advancingSlotCount) || 0
    const inCount = parseInt(phase.incomingSlotCount) || 0
    const isPools = phase.phaseType === 'Pools' && (parseInt(phase.poolCount) || 0) > 1
    
    // Initialize exit slots
    exitRemaining[idx] = {}
    if (isPools) {
      const poolCount = parseInt(phase.poolCount)
      const advPerPool = Math.max(1, Math.floor(advCount / poolCount))
      for (let pool = 0; pool < poolCount; pool++) {
        for (let pos = 1; pos <= advPerPool; pos++) {
          exitRemaining[idx][`${pool}-${pos}`] = true
        }
      }
    } else {
      for (let pos = 1; pos <= advCount; pos++) {
        exitRemaining[idx][pos] = true
      }
    }
    
    // Initialize incoming slots
    incomingRemaining[idx] = new Set()
    for (let slot = 1; slot <= inCount; slot++) {
      incomingRemaining[idx].add(slot)
    }
  })
  
  // Helper to count remaining exits for a phase (by original index)
  const countRemainingExits = (idx) => Object.values(exitRemaining[idx]).filter(v => v).length
  
  // Helper to count remaining incoming for a phase (by original index)
  const countRemainingIncoming = (idx) => incomingRemaining[idx].size
  
  // Helper to get first available exit slot
  const getFirstAvailableExit = (idx) => {
    for (const key of Object.keys(exitRemaining[idx]).sort((a, b) => {
      // Sort: pool-position format comes before plain numbers, then numerically
      const aIsPool = String(a).includes('-')
      const bIsPool = String(b).includes('-')
      if (aIsPool && !bIsPool) return -1
      if (!aIsPool && bIsPool) return 1
      return parseInt(String(a).split('-').pop()) - parseInt(String(b).split('-').pop())
    })) {
      if (exitRemaining[idx][key]) return key
    }
    return null
  }
  
  // Helper to get first available incoming slot
  const getFirstAvailableIncoming = (idx) => {
    const slots = Array.from(incomingRemaining[idx]).sort((a, b) => a - b)
    return slots.length > 0 ? slots[0] : null
  }
  
  // Iteratively connect phases until no more connections can be made
  // Key: iterate by SORTORDER, not array index
  let madeConnection = true
  while (madeConnection) {
    madeConnection = false
    
    // Find lowest sortOrder phase with remaining exits (source)
    let srcEntry = null
    for (const entry of sortedPhases) {
      if (countRemainingExits(entry.origIdx) > 0) {
        srcEntry = entry
        break
      }
    }
    if (!srcEntry) break
    
    // Find lowest sortOrder phase (different from source) with remaining incoming slots (target)
    let tgtEntry = null
    for (const entry of sortedPhases) {
      if (entry.origIdx !== srcEntry.origIdx && countRemainingIncoming(entry.origIdx) > 0) {
        tgtEntry = entry
        break
      }
    }
    if (!tgtEntry) break
    
    const srcIdx = srcEntry.origIdx
    const tgtIdx = tgtEntry.origIdx
    const srcPhase = phases[srcIdx]
    const tgtPhase = phases[tgtIdx]
    const isPools = srcPhase.phaseType === 'Pools' && (parseInt(srcPhase.poolCount) || 0) > 1
    
    // Connect available slots - fill target phase completely before moving to next
    // For bracket targets with 'Folded' seeding, use folded pattern (1 vs 8, 4 vs 5, 3 vs 6, 2 vs 7)
    const useFoldedSeeding = BRACKET_TYPES.includes(tgtPhase.phaseType) && 
                             tgtPhase.seedingStrategy === 'Folded'
    const totalIncomingSlots = parseInt(tgtPhase.incomingSlotCount) || 0
    
    while (countRemainingExits(srcIdx) > 0 && countRemainingIncoming(tgtIdx) > 0) {
      const exitKey = getFirstAvailableExit(srcIdx)
      if (!exitKey) break
      
      // Determine target slot - use folded seeding if configured
      let inSlot
      if (useFoldedSeeding && !isPools) {
        // For non-pool sources going to bracket with Folded seeding
        const position = parseInt(exitKey)
        const foldedSlot = getFoldedBracketSlot(position, totalIncomingSlots)
        // Use folded slot if available, otherwise fall back to first available
        inSlot = incomingRemaining[tgtIdx].has(foldedSlot) ? foldedSlot : getFirstAvailableIncoming(tgtIdx)
      } else {
        inSlot = getFirstAvailableIncoming(tgtIdx)
      }
      if (!inSlot) break
      
      // Mark as used
      exitRemaining[srcIdx][exitKey] = false
      incomingRemaining[tgtIdx].delete(inSlot)
      
      // Create rule with BOTH formats:
      // - sourcePhase/targetPhase (names) for serialization to JSON
      // - sourcePhaseOrder/targetPhaseOrder (1-based indices) for ListPhaseEditor dropdowns
      if (isPools && String(exitKey).includes('-')) {
        const [poolIndex, position] = exitKey.split('-').map(Number)
        rules.push({
          sourcePhase: srcPhase.name,
          targetPhase: tgtPhase.name,
          sourcePhaseOrder: srcIdx + 1,
          targetPhaseOrder: tgtIdx + 1,
          finishPosition: position,
          targetSlotNumber: inSlot,
          sourcePoolIndex: poolIndex
        })
      } else {
        rules.push({
          sourcePhase: srcPhase.name,
          targetPhase: tgtPhase.name,
          sourcePhaseOrder: srcIdx + 1,
          targetPhaseOrder: tgtIdx + 1,
          finishPosition: parseInt(exitKey),
          targetSlotNumber: inSlot,
          sourcePoolIndex: null
        })
      }
      madeConnection = true
    }
  }
  
  return rules
}
