import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { tournamentApi } from '../services/api'
import {
  Layers, Plus, Edit2, Trash2, Check, X, RefreshCw, AlertTriangle,
  Copy, ChevronDown, ChevronUp, Eye, EyeOff, Code, FileJson, Save, GitBranch,
  Trophy, Users, Hash, ArrowRight, Clock, Zap, Settings, Award, Move,
  LayoutGrid, List, Shuffle, Repeat, Grid3X3, Swords, Target, GripVertical,
  ArrowLeft, Info, Lightbulb, MousePointer, Link, ChevronRight, ChevronsUpDown
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
  ReactFlowProvider,
  getNodesBounds,
  getViewportForBounds,
  useUpdateNodeInternals
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { toPng } from 'html-to-image'

// Import shared constants and helpers from extracted module
import {
  CATEGORIES, PHASE_TYPES, BRACKET_TYPES, SEEDING_STRATEGIES, AWARD_TYPES,
  DEFAULT_PHASE, DEFAULT_EXIT_POSITION, DEFAULT_ADVANCEMENT_RULE,
  PHASE_TYPE_COLORS, PHASE_TYPE_ICONS,
  parseStructureToVisual, serializeVisualToJson, autoGenerateRules
} from '../components/tournament/structureEditorConstants'

// Import extracted ListPhaseEditor
import ListPhaseEditor from '../components/tournament/ListPhaseEditor'


// ListPhaseEditor is now imported from ../components/tournament/ListPhaseEditor
// PHASE_TYPE_COLORS and PHASE_TYPE_ICONS are imported from structureEditorConstants

// Placeholder to keep line references stable — the ListPhaseEditor was extracted
// ══════════════════════════════════════════
// Canvas Phase Editor — React Flow based
// (ListPhaseEditor extracted to ../components/tournament/ListPhaseEditor.jsx)
// (Constants extracted to ../components/tournament/structureEditorConstants.js)
// ══════════════════════════════════════════

const NODE_WIDTH = 220
const NODE_HEIGHT = 100
const NODE_WIDTH_EXPANDED = 280
const NODE_HEIGHT_EXPANDED = 220 // Taller when expanded to show mini diagram

// ── PhaseInternalDiagram: SVG mini-diagram showing internal flow of a phase ──
const PhaseInternalDiagram = memo(({ phaseType, incomingSlots, advancingSlots, poolCount, bestOf, includeConsolation }) => {
  const incoming = parseInt(incomingSlots) || 4
  const advancing = parseInt(advancingSlots) || 2
  const pools = parseInt(poolCount) || 0
  const bo = parseInt(bestOf) || 1
  const colors = PHASE_TYPE_COLORS[phaseType] || PHASE_TYPE_COLORS.SingleElimination
  const phaseHex = colors.hex

  const GRAY = '#6b7280'
  const GREEN = '#22c55e'
  const PURPLE = '#8b5cf6'
  const LINE_GRAY = '#d1d5db'
  const LINE_GREEN = '#86efac'

  // Render an incoming slot with number inside the dot
  const InSlot = ({ x, y, num }) => (
    <g>
      <circle cx={x} cy={y} r={7} fill={GRAY} />
      <text x={x} y={y + 3} fontSize="7" fill="white" textAnchor="middle" fontWeight="600" fontFamily="system-ui">{num}</text>
    </g>
  )
  // Render an exit slot with number inside the dot
  const ExitSlot = ({ x, y, num }) => (
    <g>
      <circle cx={x} cy={y} r={7} fill={PURPLE} />
      <text x={x} y={y + 3} fontSize="7" fill="white" textAnchor="middle" fontWeight="600" fontFamily="system-ui">{num}</text>
    </g>
  )
  // Render a loser exit slot (red) with number inside the dot
  const LoserExitSlot = ({ x, y, num }) => (
    <g>
      <circle cx={x} cy={y} r={7} fill="#ef4444" />
      <text x={x} y={y + 3} fontSize="7" fill="white" textAnchor="middle" fontWeight="600" fontFamily="system-ui">{num}</text>
    </g>
  )

  if (phaseType === 'Draw') {
    const exitCount = Math.min(advancing, 8)
    const svgW = 260
    const svgH = Math.min(200, Math.max(60, exitCount * 14 + 30))
    const boxW = 80
    const boxH = 28
    const boxX = 40
    const boxY = svgH / 2 - boxH / 2
    return (
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <text x={svgW / 2} y={12} fontSize="9" fill={GRAY} textAnchor="middle" fontWeight="600" fontFamily="system-ui">
          Draw → {advancing} slots
        </text>
        <rect x={boxX} y={boxY} width={boxW} height={boxH} rx={8} fill="#06b6d4" fillOpacity={0.12} stroke="#06b6d4" strokeWidth={1.5} />
        <text x={boxX + boxW / 2} y={boxY + boxH / 2 + 3.5} fontSize="9" fill="#06b6d4" textAnchor="middle" fontWeight="600" fontFamily="system-ui">🎲 Draw</text>
        {Array.from({ length: exitCount }, (_, i) => {
          const ey = svgH / 2 - (exitCount - 1) * 7 + i * 14
          return (
            <g key={`out-${i}`}>
              <line x1={boxX + boxW + 2} y1={svgH / 2} x2={svgW - 30} y2={ey} stroke={LINE_GREEN} strokeWidth={1} />
              <ExitSlot x={svgW - 24} y={ey} num={i + 1} />
            </g>
          )
        })}
        {advancing > 8 && (
          <text x={svgW - 24} y={svgH - 4} fontSize="7" fill={PURPLE} textAnchor="middle" fontFamily="system-ui">+{advancing - 8}</text>
        )}
      </svg>
    )
  }

  if (phaseType === 'Award') {
    const svgW = 260
    const svgH = 60
    return (
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <text x={svgW / 2} y={14} fontSize="9" fill={GRAY} textAnchor="middle" fontWeight="600" fontFamily="system-ui">
          {incoming} in → Placement Award
        </text>
        <InSlot x={60} y={38} num={1} />
        <line x1={67} y1={38} x2={110} y2={38} stroke={LINE_GRAY} strokeWidth={1} />
        <text x={170} y={42} fontSize="20" textAnchor="middle">🏆</text>
      </svg>
    )
  }

  if (phaseType === 'Pools') {
    const pc = Math.max(pools, 1)
    const perPool = Math.max(1, Math.ceil(incoming / pc))
    const advPerPool = Math.max(1, Math.ceil(advancing / pc))
    const poolNames = 'ABCDEFGHIJKLMNOP'
    const svgW = 260
    const rowH = 32
    const svgH = Math.min(200, pc * rowH + 30)
    const poolY0 = 20

    return (
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <text x={svgW / 2} y={12} fontSize="9" fill={GRAY} textAnchor="middle" fontWeight="600" fontFamily="system-ui">
          {incoming} in → {pc} pools → {advancing} advance
          {bo > 1 ? ` (Bo${bo})` : ''}
        </text>
        {Array.from({ length: pc }, (_, pi) => {
          const cy = poolY0 + pi * rowH + rowH / 2
          const poolX = 90
          const poolW = 80
          const poolH = 22
          return (
            <g key={pi}>
              {/* Incoming slots with round-robin numbers (1→A, 2→B, 3→C, 4→D, 5→A...) */}
              {Array.from({ length: Math.min(perPool, 4) }, (_, si) => {
                const slotY = cy - (Math.min(perPool, 4) - 1) * 5 + si * 10
                // Sequential round-robin: slot si in pool pi = si * poolCount + pi + 1
                const slotNum = si * pc + pi + 1
                return (
                  <g key={`in-${si}`}>
                    <InSlot x={22} y={slotY} num={slotNum} />
                    <line x1={29} y1={slotY} x2={poolX - 2} y2={cy} stroke={LINE_GRAY} strokeWidth={1} />
                  </g>
                )
              })}
              {perPool > 4 && (
                <text x={22} y={cy + (4 * 5) + 10} fontSize="7" fill={GRAY} textAnchor="middle" fontFamily="system-ui">+{perPool - 4}</text>
              )}
              {/* Pool box */}
              <rect x={poolX} y={cy - poolH / 2} width={poolW} height={poolH} rx={6} fill={phaseHex} fillOpacity={0.12} stroke={phaseHex} strokeWidth={1.5} />
              <text x={poolX + poolW / 2} y={cy + 3.5} fontSize="9" fill={phaseHex} textAnchor="middle" fontWeight="600" fontFamily="system-ui">
                Pool {poolNames[pi] || pi + 1}
              </text>
              {/* Advancing slots with exit numbers */}
              {Array.from({ length: Math.min(advPerPool, 3) }, (_, ai) => {
                const exitY = cy - (Math.min(advPerPool, 3) - 1) * 5 + ai * 10
                const exitNum = pi * advPerPool + ai + 1
                return (
                  <g key={`out-${ai}`}>
                    <line x1={poolX + poolW + 2} y1={cy} x2={svgW - 30} y2={exitY} stroke={LINE_GREEN} strokeWidth={1} />
                    <ExitSlot x={svgW - 24} y={exitY} num={exitNum} />
                  </g>
                )
              })}
              {advPerPool > 3 && (
                <text x={svgW - 24} y={cy + (3 * 5) + 10} fontSize="7" fill={PURPLE} textAnchor="middle" fontFamily="system-ui">+{advPerPool - 3}</text>
              )}
            </g>
          )
        })}
      </svg>
    )
  }

  if (phaseType === 'RoundRobin') {
    const svgW = 260
    const svgH = Math.min(200, Math.max(80, incoming * 12 + 30))
    const boxW = 90
    const boxH = 30
    const boxX = (svgW - boxW) / 2
    const boxY = svgH / 2 - boxH / 2
    const inCount = Math.min(incoming, 8)
    const outCount = Math.min(advancing, 6)

    return (
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <text x={svgW / 2} y={12} fontSize="9" fill={GRAY} textAnchor="middle" fontWeight="600" fontFamily="system-ui">
          {incoming} in → Round Robin → Top {advancing}
          {bo > 1 ? ` (Bo${bo})` : ''}
        </text>
        {/* Incoming slots with numbers */}
        {Array.from({ length: inCount }, (_, i) => {
          const sy = 24 + i * ((svgH - 30) / Math.max(inCount - 1, 1))
          return (
            <g key={`in-${i}`}>
              <InSlot x={22} y={sy} num={i + 1} />
              <line x1={29} y1={sy} x2={boxX - 2} y2={svgH / 2} stroke={LINE_GRAY} strokeWidth={0.8} />
            </g>
          )
        })}
        {incoming > 8 && (
          <text x={22} y={svgH - 4} fontSize="7" fill={GRAY} textAnchor="middle" fontFamily="system-ui">+{incoming - 8}</text>
        )}
        {/* Round Robin box */}
        <rect x={boxX} y={boxY} width={boxW} height={boxH} rx={8} fill={phaseHex} fillOpacity={0.12} stroke={phaseHex} strokeWidth={1.5} />
        <text x={boxX + boxW / 2} y={boxY + boxH / 2 + 3.5} fontSize="9" fill={phaseHex} textAnchor="middle" fontWeight="600" fontFamily="system-ui">Round Robin</text>
        {/* Exit slots with numbers */}
        {Array.from({ length: outCount }, (_, i) => {
          const ey = svgH / 2 - (outCount - 1) * 7 + i * 14
          return (
            <g key={`out-${i}`}>
              <line x1={boxX + boxW + 2} y1={svgH / 2} x2={svgW - 30} y2={ey} stroke={LINE_GREEN} strokeWidth={1} />
              <ExitSlot x={svgW - 24} y={ey} num={i + 1} />
            </g>
          )
        })}
        {advancing > 6 && (
          <text x={svgW - 24} y={svgH - 4} fontSize="7" fill={PURPLE} textAnchor="middle" fontFamily="system-ui">+{advancing - 6}</text>
        )}
      </svg>
    )
  }

  if (phaseType === 'Swiss') {
    const rounds = Math.max(3, Math.ceil(Math.log2(incoming)))
    const svgW = 260
    const svgH = Math.min(200, Math.max(80, incoming * 12 + 30))
    const boxW = 90
    const boxH = 38
    const boxX = (svgW - boxW) / 2
    const boxY = svgH / 2 - boxH / 2
    const inCount = Math.min(incoming, 8)
    const outCount = Math.min(advancing, 6)

    return (
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <text x={svgW / 2} y={12} fontSize="9" fill={GRAY} textAnchor="middle" fontWeight="600" fontFamily="system-ui">
          {incoming} in → Swiss ({rounds} rounds) → Top {advancing}
          {bo > 1 ? ` (Bo${bo})` : ''}
        </text>
        {/* Incoming slots with numbers */}
        {Array.from({ length: inCount }, (_, i) => {
          const sy = 24 + i * ((svgH - 30) / Math.max(inCount - 1, 1))
          return (
            <g key={`in-${i}`}>
              <InSlot x={22} y={sy} num={i + 1} />
              <line x1={29} y1={sy} x2={boxX - 2} y2={svgH / 2} stroke={LINE_GRAY} strokeWidth={0.8} />
            </g>
          )
        })}
        {incoming > 8 && (
          <text x={22} y={svgH - 4} fontSize="7" fill={GRAY} textAnchor="middle" fontFamily="system-ui">+{incoming - 8}</text>
        )}
        {/* Swiss box */}
        <rect x={boxX} y={boxY} width={boxW} height={boxH} rx={8} fill={phaseHex} fillOpacity={0.12} stroke={phaseHex} strokeWidth={1.5} />
        <text x={boxX + boxW / 2} y={boxY + boxH / 2 - 2} fontSize="9" fill={phaseHex} textAnchor="middle" fontWeight="600" fontFamily="system-ui">Swiss</text>
        <text x={boxX + boxW / 2} y={boxY + boxH / 2 + 9} fontSize="8" fill={phaseHex} textAnchor="middle" fontFamily="system-ui" fillOpacity={0.7}>{rounds} rounds</text>
        {/* Exit slots with numbers */}
        {Array.from({ length: outCount }, (_, i) => {
          const ey = svgH / 2 - (outCount - 1) * 7 + i * 14
          return (
            <g key={`out-${i}`}>
              <line x1={boxX + boxW + 2} y1={svgH / 2} x2={svgW - 30} y2={ey} stroke={LINE_GREEN} strokeWidth={1} />
              <ExitSlot x={svgW - 24} y={ey} num={i + 1} />
            </g>
          )
        })}
        {advancing > 6 && (
          <text x={svgW - 24} y={svgH - 4} fontSize="7" fill={PURPLE} textAnchor="middle" fontFamily="system-ui">+{advancing - 6}</text>
        )}
      </svg>
    )
  }

  if (phaseType === 'DoubleElimination') {
    const matches = Math.floor(incoming / 2)
    const svgW = 260
    const svgH = Math.min(200, Math.max(100, matches * 22 + 40))
    const matchCount = Math.min(matches, 6)
    const wbH = svgH * 0.52
    const lbY = wbH + 8

    return (
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <text x={svgW / 2} y={12} fontSize="9" fill={GRAY} textAnchor="middle" fontWeight="600" fontFamily="system-ui">
          {incoming} in → Double Elim → {advancing} advance
          {bo > 1 ? ` (Bo${bo})` : ''}
        </text>
        {/* Winners Bracket label */}
        <text x={8} y={28} fontSize="8" fill={GREEN} fontWeight="600" fontFamily="system-ui">W Bracket</text>
        {/* Winners bracket matches */}
        {Array.from({ length: Math.min(matchCount, 4) }, (_, i) => {
          const my = 34 + i * 18
          return (
            <g key={`wb-${i}`}>
              <InSlot x={20} y={my - 4} num={i * 2 + 1} />
              <InSlot x={20} y={my + 4} num={i * 2 + 2} />
              <line x1={27} y1={my - 4} x2={50} y2={my - 4} stroke={LINE_GRAY} strokeWidth={0.8} />
              <line x1={27} y1={my + 4} x2={50} y2={my + 4} stroke={LINE_GRAY} strokeWidth={0.8} />
              <line x1={50} y1={my - 4} x2={50} y2={my + 4} stroke={LINE_GRAY} strokeWidth={0.8} />
              <rect x={52} y={my - 7} width={36} height={14} rx={3} fill={phaseHex} fillOpacity={0.12} stroke={phaseHex} strokeWidth={1} />
              <text x={70} y={my + 3} fontSize="7" fill={phaseHex} textAnchor="middle" fontFamily="system-ui">M{i + 1}</text>
              {/* Winner exits right */}
              <line x1={88} y1={my} x2={110} y2={my} stroke={LINE_GREEN} strokeWidth={1} />
              <polygon points={`108,${my - 3} 114,${my} 108,${my + 3}`} fill={GREEN} />
            </g>
          )
        })}
        {/* Losers Bracket label */}
        <text x={8} y={lbY + 4} fontSize="8" fill="#ef4444" fontWeight="600" fontFamily="system-ui">L Bracket</text>
        {/* Losers bracket indication */}
        {Array.from({ length: Math.min(matchCount, 3) }, (_, i) => {
          const my = lbY + 12 + i * 16
          return (
            <g key={`lb-${i}`}>
              <rect x={52} y={my - 6} width={36} height={12} rx={3} fill="#fef2f2" stroke="#fca5a5" strokeWidth={1} />
              <text x={70} y={my + 2.5} fontSize="7" fill="#ef4444" textAnchor="middle" fontFamily="system-ui">L{i + 1}</text>
              <line x1={88} y1={my} x2={110} y2={my} stroke={LINE_GREEN} strokeWidth={0.8} />
              <polygon points={`108,${my - 2.5} 113,${my} 108,${my + 2.5}`} fill={GREEN} fillOpacity={0.6} />
            </g>
          )
        })}
        {/* Exit slots on far right with numbers */}
        {Array.from({ length: Math.min(advancing, 4) }, (_, i) => {
          const ey = 34 + i * 16
          return (
            <g key={`exit-${i}`}>
              <ExitSlot x={svgW - 28} y={ey} num={i + 1} />
            </g>
          )
        })}
        {advancing > 4 && (
          <text x={svgW - 28} y={34 + 4 * 16 + 4} fontSize="7" fill={PURPLE} textAnchor="middle" fontFamily="system-ui">+{advancing - 4}</text>
        )}
      </svg>
    )
  }

  // SingleElimination / BracketRound — bracket tree
  {
    const matches = Math.floor(incoming / 2)
    const isOneRound = phaseType === 'BracketRound' || advancing === matches
    const svgW = 260

    if (isOneRound) {
      const matchCount = Math.min(matches, 6)
      const hasLosers = includeConsolation || advancing >= incoming
      const rowH = 24
      const svgH = Math.min(200, matchCount * rowH + 28)

      return (
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
          <text x={svgW / 2} y={12} fontSize="9" fill={GRAY} textAnchor="middle" fontWeight="600" fontFamily="system-ui">
            {incoming} in → {matches} matches → {hasLosers ? `${matches} advance +consolation` : `${advancing} advance`}
            {bo > 1 ? ` (Bo${bo})` : ''}
          </text>
          {Array.from({ length: matchCount }, (_, i) => {
            const my = 22 + i * rowH + rowH / 2
            return (
              <g key={i}>
                {/* Two incoming slots with numbers */}
                <InSlot x={22} y={my - 5} num={i * 2 + 1} />
                <InSlot x={22} y={my + 5} num={i * 2 + 2} />
                <line x1={29} y1={my - 5} x2={55} y2={my - 5} stroke={LINE_GRAY} strokeWidth={0.8} />
                <line x1={29} y1={my + 5} x2={55} y2={my + 5} stroke={LINE_GRAY} strokeWidth={0.8} />
                <line x1={55} y1={my - 5} x2={55} y2={my + 5} stroke={LINE_GRAY} strokeWidth={0.8} />
                {/* Match box */}
                <rect x={57} y={my - 8} width={40} height={16} rx={4} fill={phaseHex} fillOpacity={0.12} stroke={phaseHex} strokeWidth={1.2} />
                <text x={77} y={my + 3} fontSize="8" fill={phaseHex} textAnchor="middle" fontWeight="500" fontFamily="system-ui">M{i + 1}</text>
                {/* Winner line → green exit slot */}
                <line x1={97} y1={my} x2={svgW - 38} y2={my - (hasLosers ? 5 : 0)} stroke={LINE_GREEN} strokeWidth={1.2} />
                <polygon points={`${svgW - 40},${my - (hasLosers ? 5 : 0) - 3} ${svgW - 34},${my - (hasLosers ? 5 : 0)} ${svgW - 40},${my - (hasLosers ? 5 : 0) + 3}`} fill={GREEN} />
                <ExitSlot x={svgW - 28} y={my - (hasLosers ? 5 : 0)} num={i + 1} />
                {/* Loser line → red exit slot */}
                {hasLosers && (
                  <g>
                    <line x1={97} y1={my} x2={svgW - 38} y2={my + 5} stroke="#fca5a5" strokeWidth={1} strokeDasharray="3,2" />
                    <polygon points={`${svgW - 40},${my + 5 - 3} ${svgW - 34},${my + 5} ${svgW - 40},${my + 5 + 3}`} fill="#ef4444" fillOpacity={0.6} />
                    <LoserExitSlot x={svgW - 28} y={my + 5} num={matches + i + 1} />
                  </g>
                )}
              </g>
            )
          })}
          {matches > 6 && (
            <text x={svgW / 2} y={svgH - 4} fontSize="7" fill={GRAY} textAnchor="middle" fontFamily="system-ui">+{matches - 6} more matches</text>
          )}
        </svg>
      )
    }

    // Multi-round bracket tree (e.g., 8→1 with QF→SF→F)
    const rounds = Math.ceil(Math.log2(incoming))
    const maxVisibleRounds = Math.min(rounds, 4)
    const roundLabels = rounds <= 2 ? ['SF', 'F'] : rounds === 3 ? ['QF', 'SF', 'F'] : ['R1', 'QF', 'SF', 'F']
    const r1Matches = Math.min(Math.floor(incoming / 2), 8)
    const svgH = Math.min(200, r1Matches * 20 + 30)
    const colW = svgW / (maxVisibleRounds + 1.5)

    // Build bracket rounds
    const bracketRounds = []
    let mCount = r1Matches
    for (let r = 0; r < maxVisibleRounds; r++) {
      bracketRounds.push(Math.min(mCount, r === 0 ? 8 : 4))
      mCount = Math.ceil(mCount / 2)
    }

    return (
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <text x={svgW / 2} y={12} fontSize="9" fill={GRAY} textAnchor="middle" fontWeight="600" fontFamily="system-ui">
          {incoming} in → {rounds} rounds → {advancing === 1 ? 'Champion' : `Top ${advancing}`}
          {bo > 1 ? ` (Bo${bo})` : ''}
          {includeConsolation ? ' +consolation' : ''}
        </text>
        {/* Round labels */}
        {bracketRounds.map((_, ri) => {
          const lbl = roundLabels.length >= maxVisibleRounds
            ? roundLabels[roundLabels.length - maxVisibleRounds + ri]
            : `R${ri + 1}`
          return (
            <text key={`lbl-${ri}`} x={30 + ri * colW + colW / 2} y={24} fontSize="8" fill={phaseHex} textAnchor="middle" fontWeight="600" fontFamily="system-ui" fillOpacity={0.6}>
              {lbl}
            </text>
          )
        })}
        {/* Draw bracket rounds */}
        {bracketRounds.map((mc, ri) => {
          const x = 30 + ri * colW
          const availH = svgH - 32
          const spacing = availH / mc
          return Array.from({ length: mc }, (_, mi) => {
            const my = 32 + mi * spacing + spacing / 2
            const bw = Math.min(colW - 10, 36)
            return (
              <g key={`r${ri}-m${mi}`}>
                {ri === 0 && (
                  <g>
                    <circle cx={x - 8} cy={my - 5} r={5} fill={GRAY} />
                    <text x={x - 8} y={my - 2.5} fontSize="6" fill="white" textAnchor="middle" fontWeight="600" fontFamily="system-ui">{mi * 2 + 1}</text>
                    <circle cx={x - 8} cy={my + 5} r={5} fill={GRAY} />
                    <text x={x - 8} y={my + 7.5} fontSize="6" fill="white" textAnchor="middle" fontWeight="600" fontFamily="system-ui">{mi * 2 + 2}</text>
                    <line x1={x - 3} y1={my - 5} x2={x + 2} y2={my - 5} stroke={LINE_GRAY} strokeWidth={0.6} />
                    <line x1={x - 3} y1={my + 5} x2={x + 2} y2={my + 5} stroke={LINE_GRAY} strokeWidth={0.6} />
                    <line x1={x + 2} y1={my - 5} x2={x + 2} y2={my + 5} stroke={LINE_GRAY} strokeWidth={0.6} />
                  </g>
                )}
                <rect x={x + 4} y={my - 6} width={bw} height={12} rx={3} fill={phaseHex} fillOpacity={ri === maxVisibleRounds - 1 ? 0.25 : 0.1} stroke={phaseHex} strokeWidth={1} />
                {/* Connect to next round */}
                {ri < maxVisibleRounds - 1 && (
                  <line x1={x + 4 + bw} y1={my} x2={30 + (ri + 1) * colW + 4} y2={32 + Math.floor(mi / 2) * (availH / bracketRounds[ri + 1]) + (availH / bracketRounds[ri + 1]) / 2} stroke={LINE_GREEN} strokeWidth={0.8} />
                )}
              </g>
            )
          })
        })}
        {/* Champion / exit */}
        {(() => {
          const lastRoundX = 30 + (maxVisibleRounds - 1) * colW
          const bw = Math.min(colW - 10, 36)
          const exitX = lastRoundX + bw + 12
          const exitY = svgH / 2
          return (
            <g>
              <line x1={lastRoundX + 4 + bw} y1={exitY} x2={exitX} y2={exitY} stroke={LINE_GREEN} strokeWidth={1.2} />
              <ExitSlot x={exitX + 6} y={exitY} num={1} />
              {advancing === 1 && (
                <text x={exitX + 20} y={exitY + 3} fontSize="8" fill={GREEN} textAnchor="start" fontWeight="600" fontFamily="system-ui">🏆</text>
              )}
              {advancing > 1 && Array.from({ length: Math.min(advancing - 1, 3) }, (_, i) => (
                <ExitSlot key={i} x={exitX + 6} y={exitY + (i + 1) * 14} num={i + 2} />
              ))}
            </g>
          )
        })()}
        {includeConsolation && (
          <text x={svgW - 10} y={svgH - 6} fontSize="7" fill="#ef4444" textAnchor="end" fontFamily="system-ui">+ consolation bracket</text>
        )}
      </svg>
    )
  }
})

// Dagre auto-layout
function getLayoutedElements(nodes, edges, direction = 'TB', forceExpand = null) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  
  // Use larger spacing when nodes are expanded
  const isExpanded = forceExpand === true
  const nodeWidth = isExpanded ? NODE_WIDTH_EXPANDED : NODE_WIDTH
  const nodeHeight = isExpanded ? NODE_HEIGHT_EXPANDED : NODE_HEIGHT
  const nodeSep = isExpanded ? (direction === 'LR' ? 60 : 80) : (direction === 'LR' ? 40 : 60)
  const rankSep = isExpanded ? (direction === 'LR' ? 140 : 120) : (direction === 'LR' ? 100 : 80)
  
  g.setGraph({ rankdir: direction, nodesep: nodeSep, ranksep: rankSep })

  nodes.forEach((node) => {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight })
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
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}

// Custom Phase Node — compact by default, expand on button click
const PhaseNode = memo(({ data, selected }) => {
  const [localExpanded, setLocalExpanded] = useState(false)
  // Sync from forceExpand when it changes (e.g., Expand All / Collapse All)
  // After sync, user can still toggle individually via localExpanded
  useEffect(() => {
    if (data.forceExpand !== null) {
      setLocalExpanded(data.forceExpand)
    }
  }, [data.forceExpand])
  const expanded = localExpanded
  const colors = PHASE_TYPE_COLORS[data.phaseType] || PHASE_TYPE_COLORS.SingleElimination
  const Icon = PHASE_TYPE_ICONS[data.phaseType] || GitBranch

  return (
    <div
      className={`rounded-lg shadow-md border-2 overflow-hidden transition-all ${
        selected ? 'ring-2 ring-purple-400 ring-offset-2' : ''
      } ${colors.border}`}
      style={{ width: expanded ? 280 : NODE_WIDTH }}
    >
      {data.phaseType !== 'Draw' && (
        <Handle type="target" position={data.layoutDirection === 'LR' ? Position.Left : Position.Top} className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white" />
      )}
      <div className={`${colors.bg} px-3 py-1.5 flex items-center gap-2`}>
        <Icon className="w-3.5 h-3.5 text-white" />
        <span className="text-white text-xs font-semibold truncate flex-1">{data.label}</span>
        <span className="text-white/70 text-[10px] mr-1">#{data.sortOrder}</span>
        <button
          onClick={(e) => { e.stopPropagation(); setLocalExpanded(v => !v) }}
          className="text-white/60 hover:text-white transition-colors p-0.5 rounded"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
      </div>
      <div className={`${colors.light} px-3 py-2`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-medium ${colors.text}`}>{data.phaseType}</span>
          <span className="text-xs text-gray-500">
            {data.phaseType === 'Award' ? `${data.incomingSlotCount} in → 🏆` : data.phaseType === 'Draw' ? `🎲 → ${data.advancingSlotCount} out` : `${data.incomingSlotCount} in → ${data.advancingSlotCount} out`}
            {(data.phaseType === 'BracketRound' && (data.includeConsolation || data.advancingSlotCount >= data.incomingSlotCount)) && (
              <span className="text-[9px] ml-1 text-gray-400">
                ({Math.floor(data.incomingSlotCount / 2)}W+{Math.floor(data.incomingSlotCount / 2)}L)
              </span>
            )}
          </span>
        </div>
        {data.phaseType === 'Pools' && data.poolCount > 0 && (
          <div className="text-[10px] text-gray-400 mt-0.5">{data.poolCount} pools</div>
        )}
      </div>
      {/* Mini phase diagram — only when explicitly expanded */}
      {expanded && (
        <div className="bg-white border-t px-2 py-2">
          <PhaseInternalDiagram
            phaseType={data.phaseType}
            incomingSlots={data.incomingSlotCount}
            advancingSlots={data.advancingSlotCount}
            poolCount={data.poolCount}
            bestOf={data.bestOf}
            includeConsolation={data.includeConsolation}
          />
        </div>
      )}
      {data.phaseType !== 'Award' && (
        <Handle type="source" position={data.layoutDirection === 'LR' ? Position.Right : Position.Bottom} className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white" />
      )}
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

// Edge Config Panel — visual advancement rule editor
const EdgeConfigPanel = ({ sourcePhase, targetPhase, sourceIdx, targetIdx, rules, onRulesChange, onClose }) => {
  const [pendingSource, setPendingSource] = useState(null) // source slot being connected

  // Use phase names for rule matching (new format)
  const srcName = sourcePhase?.name
  const tgtName = targetPhase?.name
  // Also keep sortOrder for backward compat with old templates
  const srcOrder = sourcePhase?.sortOrder || (sourceIdx + 1)
  const tgtOrder = targetPhase?.sortOrder || (targetIdx + 1)
  const connectionRules = useMemo(() => 
    rules.filter(r => 
      // Match by name (new format) or sortOrder (old format)
      (r.sourcePhase === srcName && r.targetPhase === tgtName) ||
      (r.sourcePhaseOrder === srcOrder && r.targetPhaseOrder === tgtOrder)
    ),
    [rules, srcName, tgtName, srcOrder, tgtOrder]
  )
  const isPools = sourcePhase?.phaseType === 'Pools' && (parseInt(sourcePhase?.poolCount) || 0) > 1
  const poolCount = parseInt(sourcePhase?.poolCount) || 1

  // Build source exit slots
  const exitSlots = useMemo(() => {
    if (!sourcePhase) return []
    const advancing = parseInt(sourcePhase.advancingSlotCount) || 0
    if (isPools) {
      const advPerPool = Math.max(1, Math.floor(advancing / poolCount))
      const slots = []
      for (let p = 0; p < poolCount; p++) {
        for (let r = 1; r <= advPerPool; r++) {
          slots.push({ id: `${p}-${r}`, label: `${String.fromCharCode(65 + p)}${r}`, poolIndex: p, position: r })
        }
      }
      return slots
    }
    const isBracketWithLosers = sourcePhase.phaseType === 'BracketRound' && 
      (sourcePhase.includeConsolation || advancing >= parseInt(sourcePhase.incomingSlotCount))
    const numMatches = Math.floor(parseInt(sourcePhase.incomingSlotCount) / 2)
    return Array.from({ length: advancing }, (_, i) => {
      const isLoser = isBracketWithLosers && i >= numMatches
      return {
        id: `${i + 1}`,
        label: isBracketWithLosers ? (isLoser ? `L${i - numMatches + 1}` : `W${i + 1}`) : `#${i + 1}`,
        poolIndex: null,
        position: i + 1,
        isLoser
      }
    })
  }, [sourcePhase, isPools, poolCount])

  // Build target incoming slots
  const inSlots = useMemo(() => {
    if (!targetPhase) return []
    const count = parseInt(targetPhase.incomingSlotCount) || 0
    return Array.from({ length: count }, (_, i) => ({ id: `${i + 1}`, label: `${i + 1}`, slotNumber: i + 1 }))
  }, [targetPhase])

  // Map: source slot id → target slot number (from rules)
  const mappings = useMemo(() => {
    const m = new Map()
    connectionRules.forEach(r => {
      const srcId = r.sourcePoolIndex != null ? `${r.sourcePoolIndex}-${r.finishPosition}` : `${r.finishPosition}`
      m.set(srcId, r.targetSlotNumber)
    })
    return m
  }, [connectionRules])

  // Reverse map: target slot number → source slot id
  const reverseMappings = useMemo(() => {
    const m = new Map()
    mappings.forEach((tgt, src) => m.set(tgt, src))
    return m
  }, [mappings])

  // Slots taken by OTHER edges (not this connection)
  const takenExitSlots = useMemo(() => {
    const taken = new Set()
    rules.forEach(r => {
      if (r.sourcePhaseOrder === srcOrder && r.targetPhaseOrder !== tgtOrder) {
        const srcId = r.sourcePoolIndex != null ? `${r.sourcePoolIndex}-${r.finishPosition}` : `${r.finishPosition}`
        taken.add(srcId)
      }
    })
    return taken
  }, [rules, srcOrder, tgtOrder])

  const takenInSlots = useMemo(() => {
    const taken = new Set()
    rules.forEach(r => {
      if (r.targetPhaseOrder === tgtOrder && r.sourcePhaseOrder !== srcOrder) {
        taken.add(r.targetSlotNumber)
      }
    })
    return taken
  }, [rules, srcOrder, tgtOrder])

  // Early return AFTER all hooks
  if (!sourcePhase || !targetPhase) return null

  const updateRules = (newMappings) => {
    // Filter out rules for this connection (match by name or sortOrder for backward compat)
    const otherRules = rules.filter(r => !(
      (r.sourcePhase === srcName && r.targetPhase === tgtName) ||
      (r.sourcePhaseOrder === srcOrder && r.targetPhaseOrder === tgtOrder)
    ))
    const newConnectionRules = []
    newMappings.forEach((targetSlot, srcId) => {
      const slot = exitSlots.find(s => s.id === srcId)
      if (!slot) return
      newConnectionRules.push({
        // Use phase names (new format)
        sourcePhase: srcName,
        targetPhase: tgtName,
        finishPosition: slot.position,
        targetSlotNumber: targetSlot,
        sourcePoolIndex: slot.poolIndex,
      })
    })
    onRulesChange([...otherRules, ...newConnectionRules])
  }

  const handleResetDefault = () => {
    const newMap = new Map()
    exitSlots.forEach((slot, i) => {
      if (i < inSlots.length) newMap.set(slot.id, inSlots[i].slotNumber)
    })
    updateRules(newMap)
    setPendingSource(null)
  }

  const handleCrossPool = () => {
    if (!isPools || poolCount < 2) return
    // Cross-pool: A1→1, B2→2, B1→3, A2→4 (for 2 pools)
    // General: interleave rank 1s from each pool, then rank 2s reversed, etc.
    const advPerPool = Math.max(1, Math.floor(exitSlots.length / poolCount))
    const newMap = new Map()
    let slot = 1
    for (let rank = 1; rank <= advPerPool; rank++) {
      const forward = rank % 2 === 1
      for (let p = 0; p < poolCount; p++) {
        const poolIdx = forward ? p : poolCount - 1 - p
        const srcSlot = exitSlots.find(s => s.poolIndex === poolIdx && s.position === rank)
        if (srcSlot && slot <= inSlots.length) {
          newMap.set(srcSlot.id, slot++)
        }
      }
    }
    updateRules(newMap)
    setPendingSource(null)
  }

  // Click source slot: select it for connecting
  const handleSourceClick = (slotId) => {
    if (takenExitSlots.has(slotId)) return
    if (pendingSource === slotId) {
      setPendingSource(null) // deselect
    } else {
      setPendingSource(slotId)
    }
  }

  // Click target slot: connect pending source to it
  const handleTargetClick = (slotNumber) => {
    if (!pendingSource) return
    if (takenInSlots.has(slotNumber)) return
    const newMap = new Map(mappings)
    // Remove any existing connection TO this target
    for (const [src, tgt] of newMap) {
      if (tgt === slotNumber) newMap.delete(src)
    }
    newMap.set(pendingSource, slotNumber)
    updateRules(newMap)
    setPendingSource(null)
  }

  // Click a connection line to remove it
  const handleRemoveMapping = (srcId) => {
    const newMap = new Map(mappings)
    newMap.delete(srcId)
    updateRules(newMap)
  }

  // SVG dimensions
  const dotR = 8
  const dotSpacing = 28
  const padding = 14
  const leftX = 40
  const rightX = 210
  const maxSlots = Math.max(exitSlots.length, inSlots.length, 1)
  const svgH = maxSlots * dotSpacing + padding * 2

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-purple-600" />
          Slot Mapping
        </h4>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
          <X className="w-3.5 h-3.5 text-gray-500" />
        </button>
      </div>

      <div className="bg-purple-50 rounded-lg px-2 py-1.5 text-[11px] text-purple-700">
        <span className="font-medium">{sourcePhase.name}</span> → <span className="font-medium">{targetPhase.name}</span>
      </div>

      {/* Preset buttons */}
      <div className="flex gap-1.5">
        <button onClick={handleResetDefault}
          className="flex-1 px-2 py-1.5 text-[10px] font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
          🔄 Default (1:1)
        </button>
        {isPools && poolCount >= 2 && (
          <button onClick={handleCrossPool}
            className="flex-1 px-2 py-1.5 text-[10px] font-medium bg-white border border-purple-200 rounded-lg hover:bg-purple-50 text-purple-600 transition-colors">
            🔀 Cross-Pool
          </button>
        )}
      </div>

      {/* Visual slot mapper */}
      <div className="bg-white border rounded-lg p-2 relative">
        {/* Headers */}
        <div className="flex justify-between px-2 mb-1">
          <span className="text-[9px] font-semibold text-blue-600 uppercase tracking-wider">Exit Slots</span>
          <span className="text-[9px] font-semibold text-green-600 uppercase tracking-wider">Incoming Slots</span>
        </div>

        <svg width="100%" height={svgH} viewBox={`0 0 250 ${svgH}`} className="block">
          {/* Connection lines */}
          {exitSlots.map((slot) => {
            const tgt = mappings.get(slot.id)
            if (tgt == null) return null
            const tgtIdx = inSlots.findIndex(s => s.slotNumber === tgt)
            if (tgtIdx === -1) return null
            const srcIdx = exitSlots.indexOf(slot)
            const y1 = padding + srcIdx * dotSpacing + dotR
            const y2 = padding + tgtIdx * dotSpacing + dotR
            const isHighlighted = pendingSource === slot.id
            return (
              <g key={`line-${slot.id}`} onClick={() => handleRemoveMapping(slot.id)} className="cursor-pointer group">
                <line x1={leftX + dotR + 4} y1={y1} x2={rightX - dotR - 4} y2={y2}
                  stroke="transparent" strokeWidth={12} />
                <line x1={leftX + dotR + 4} y1={y1} x2={rightX - dotR - 4} y2={y2}
                  stroke={isHighlighted ? '#7c3aed' : '#a78bfa'}
                  strokeWidth={isHighlighted ? 2.5 : 2}
                  strokeDasharray={isHighlighted ? '4 2' : 'none'}
                  className="group-hover:stroke-red-400 transition-colors" />
                {/* Arrow head */}
                <polygon
                  points={(() => {
                    const ax = rightX - dotR - 4
                    const ay = y2
                    return `${ax},${ay} ${ax - 6},${ay - 3} ${ax - 6},${ay + 3}`
                  })()}
                  fill="#a78bfa"
                  className="group-hover:fill-red-400 transition-colors" />
              </g>
            )
          })}

          {/* Exit slot dots (left) */}
          {exitSlots.map((slot, i) => {
            const y = padding + i * dotSpacing + dotR
            const isConnected = mappings.has(slot.id)
            const isSelected = pendingSource === slot.id
            const isTaken = takenExitSlots.has(slot.id)
            return (
              <g key={`src-${slot.id}`} onClick={() => handleSourceClick(slot.id)} className={isTaken ? 'cursor-not-allowed' : 'cursor-pointer'}>
                <circle cx={leftX} cy={y} r={dotR + 2} fill="transparent" />
                <circle cx={leftX} cy={y} r={dotR}
                  fill={isTaken ? '#f3f4f6' : isSelected ? '#7c3aed' : slot.isLoser ? (isConnected ? '#f87171' : '#fee2e2') : (isConnected ? '#818cf8' : '#e5e7eb')}
                  stroke={isTaken ? '#d1d5db' : isSelected ? '#5b21b6' : slot.isLoser ? (isConnected ? '#dc2626' : '#f87171') : (isConnected ? '#6366f1' : '#9ca3af')}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  className={`transition-all ${isTaken ? 'cursor-not-allowed' : 'cursor-pointer'}`} />
                <text x={leftX} y={y + 1} textAnchor="middle" fontSize="8" fontWeight="700" fontFamily="ui-monospace,monospace"
                  fill={isTaken ? '#d1d5db' : isSelected || isConnected ? 'white' : '#6b7280'}>{slot.label.length > 3 ? slot.label.slice(0,3) : slot.label}</text>
                {isTaken && (
                  <line x1={leftX - dotR + 2} y1={y} x2={leftX + dotR - 2} y2={y} stroke="#9ca3af" strokeWidth={1.5} />
                )}
              </g>
            )
          })}

          {/* Incoming slot dots (right) */}
          {inSlots.map((slot, i) => {
            const y = padding + i * dotSpacing + dotR
            const isConnected = reverseMappings.has(slot.slotNumber)
            const isTarget = pendingSource != null
            const isTaken = takenInSlots.has(slot.slotNumber)
            return (
              <g key={`tgt-${slot.id}`} onClick={() => handleTargetClick(slot.slotNumber)}
                className={isTaken ? 'cursor-not-allowed' : isTarget ? 'cursor-pointer' : ''}>
                <circle cx={rightX} cy={y} r={dotR + 2} fill="transparent" />
                <circle cx={rightX} cy={y} r={dotR}
                  fill={isTaken ? '#f3f4f6' : isConnected ? '#4ade80' : isTarget ? '#fef3c7' : '#e5e7eb'}
                  stroke={isTaken ? '#d1d5db' : isConnected ? '#16a34a' : isTarget ? '#f59e0b' : '#9ca3af'}
                  strokeWidth={isTarget && !isConnected ? 2 : 1.5}
                  className={`transition-all ${isTaken ? 'cursor-not-allowed' : ''}`} />
                <text x={rightX} y={y + 1} textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="ui-monospace,monospace"
                  fill={isTaken ? '#d1d5db' : isConnected ? 'white' : '#6b7280'}>{slot.label}</text>
                {isTaken && (
                  <line x1={rightX - dotR + 2} y1={y} x2={rightX + dotR - 2} y2={y} stroke="#9ca3af" strokeWidth={1.5} />
                )}
              </g>
            )
          })}
        </svg>

        {/* Instruction */}
        <div className="text-[9px] text-gray-400 text-center mt-1">
          {pendingSource
            ? '👆 Click a green slot to connect — or click elsewhere to cancel'
            : connectionRules.length > 0
              ? '✏️ Click an exit slot to rewire — click a line to remove it'
              : '👆 Click an exit slot, then an incoming slot to connect'
          }
        </div>
      </div>

      {/* Unconnected warnings */}
      {exitSlots.some(s => !mappings.has(s.id)) && (
        <div className="text-[10px] text-amber-600 bg-amber-50 rounded px-2 py-1.5 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>{exitSlots.filter(s => !mappings.has(s.id)).length} exit slot(s) not connected</span>
        </div>
      )}

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
        {phase.phaseType === 'Award' ? (
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Award Type</label>
            <select value={phase.awardType || 'Gold'} onChange={e => update('awardType', e.target.value)}
              className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500">
              {AWARD_TYPES.map(t => <option key={t} value={t}>{t === 'none' ? 'None' : t}</option>)}
            </select>
          </div>
        ) : phase.phaseType === 'Draw' ? (
          <div className="space-y-2">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Slot Count</label>
              <input type="number" min={1} value={phase.advancingSlotCount}
                onChange={e => update('advancingSlotCount', parseInt(e.target.value) || 0)}
                className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Draw Method</label>
              <select value={phase.drawMethod || 'Random'} onChange={e => update('drawMethod', e.target.value)}
                className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500">
                <option value="Random">Random</option>
                <option value="Manual">Manual (TD assigns)</option>
                <option value="Seeded">Seeded (by ranking)</option>
              </select>
            </div>
          </div>
        ) : (
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
        )}
        {phase.phaseType !== 'Award' && phase.phaseType !== 'Draw' && isPools && (
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Pool Count</label>
            <input type="number" min={1} value={phase.poolCount}
              onChange={e => update('poolCount', parseInt(e.target.value) || 0)}
              className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500" />
          </div>
        )}
        {/* Phase Order - controls scheduling sequence (lower = scheduled first) */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Phase Order</label>
          <input type="number" min={1} value={phase.sortOrder || 1}
            onChange={e => update('sortOrder', parseInt(e.target.value) || 1)}
            className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500" />
        </div>
        {phase.phaseType !== 'Award' && phase.phaseType !== 'Draw' && (
          <>
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
          </>
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
const CanvasPhaseEditorInner = ({ visualState, onChange, readOnly = false }) => {
  const vs = visualState
  const reactFlowWrapper = useRef(null)
  const { screenToFlowPosition, flowToScreenPosition } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [selectedEdgeKey, setSelectedEdgeKey] = useState(null) // "srcIdx-tgtIdx"
  // Initialize layout direction from saved canvasLayout or default to 'TB'
  const [layoutDirection, setLayoutDirection] = useState(vs.canvasLayout?.direction || 'TB')
  const [expandAll, setExpandAll] = useState(false) // Toggle all nodes expanded/collapsed

  // Convert visualState phases to React Flow nodes
  const buildNodes = useCallback((phases, dir = 'TB', forceExpand = null) => {
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
        bestOf: phase.bestOf,
        includeConsolation: phase.includeConsolation,
        awardType: phase.awardType,
        drawMethod: phase.drawMethod,
        layoutDirection: dir,
        forceExpand, // null = use local state, true = force expanded, false = force collapsed
      },
    }))
  }, [])

  // Convert advancement rules to React Flow edges
  const buildEdges = useCallback((rules, phases, selEdgeKey) => {
    // Build name -> array index lookup (for new format)
    const nameToIdx = {}
    phases.forEach((p, idx) => { nameToIdx[p.name] = idx })
    // Build sortOrder -> array index lookup (for old format backward compat)
    const sortOrderToIdx = {}
    phases.forEach((p, idx) => {
      const so = p.sortOrder || (idx + 1)
      sortOrderToIdx[so] = idx
    })
    
    const edgeMap = new Map()
    rules.forEach((rule) => {
      // Support both name-based (new) and sortOrder-based (old) rule formats
      let srcIdx, tgtIdx
      if (rule.sourcePhase && rule.targetPhase) {
        // New format: use phase names
        srcIdx = nameToIdx[rule.sourcePhase]
        tgtIdx = nameToIdx[rule.targetPhase]
      } else {
        // Old format: use sortOrder
        srcIdx = sortOrderToIdx[rule.sourcePhaseOrder] ?? (rule.sourcePhaseOrder - 1)
        tgtIdx = sortOrderToIdx[rule.targetPhaseOrder] ?? (rule.targetPhaseOrder - 1)
      }
      if (srcIdx === undefined || tgtIdx === undefined) return // Skip invalid rules
      
      const key = `${srcIdx}-${tgtIdx}`
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { srcIdx, tgtIdx, count: 0, rules: [] })
      }
      const entry = edgeMap.get(key)
      entry.count++
      entry.rules.push(rule)
    })

    return Array.from(edgeMap.values()).map(({ srcIdx, tgtIdx, count, rules: connRules }) => {
      const srcPhase = phases[srcIdx]
      const edgeKey = `${srcIdx}-${tgtIdx}`
      const isSelected = selEdgeKey === edgeKey

      // Check if mapping is custom (not default sequential 1→1, 2→2...)
      // Default: sequential slot assignment where slot N maps to position N
      // For pool phases, default is pool-sequential (A1→1, A2→2, B1→3, B2→4...)
      const isCustom = connRules.some((r, i) => {
        // Sort rules by their natural order to compare
        const sorted = [...connRules].sort((a, b) => {
          if (a.sourcePoolIndex !== b.sourcePoolIndex) return (a.sourcePoolIndex ?? 0) - (b.sourcePoolIndex ?? 0)
          return a.finishPosition - b.finishPosition
        })
        const s = sorted[i]
        return s.targetSlotNumber !== i + 1
      })

      // Show exit position numbers sorted by target (incoming) slot number
      // So if slot 3 → Gold(1), slot 2 → Silver(2), slot 1 → Bronze(3), label shows "3, 2, 1"
      let label
      const sortedByTarget = [...connRules].sort((a, b) => a.targetSlotNumber - b.targetSlotNumber)
      const positions = sortedByTarget.map(r => r.finishPosition)
      if (count === 1) {
        // Single slot: just show the position number
        label = `${positions[0]}`
      } else {
        // Multiple slots: show comma-separated in target slot order
        label = positions.join(', ')
      }
      const customLabel = isCustom ? '🔀 ' : ''
      const displayLabel = isSelected ? `✏️ ${label}` : `${customLabel}${label}`

      // Custom mappings get orange tint, default gets purple
      const baseColor = isCustom ? (isSelected ? '#c2410c' : '#f97316') : (isSelected ? '#7c3aed' : '#a78bfa')
      const bgFill = isCustom ? (isSelected ? '#fff7ed' : '#fffbeb') : (isSelected ? '#ede9fe' : '#f5f3ff')
      const bgStroke = isCustom ? (isSelected ? '#fb923c' : '#fdba74') : (isSelected ? '#8b5cf6' : '#c4b5fd')
      const textFill = isCustom ? (isSelected ? '#9a3412' : '#ea580c') : (isSelected ? '#5b21b6' : '#6d28d9')

      return {
        id: `e-${srcIdx}-${tgtIdx}`,
        source: `phase-${srcIdx}`,
        target: `phase-${tgtIdx}`,
        animated: true,
        label: displayLabel,
        style: { stroke: baseColor, strokeWidth: isSelected ? 3 : 2 },
        labelStyle: { fontSize: 11, fontWeight: 600, fill: textFill },
        labelBgStyle: { fill: bgFill, stroke: bgStroke },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 4,
        markerEnd: { type: MarkerType.ArrowClosed, color: baseColor },
      }
    })
  }, [])

  // Initialize nodes/edges from visual state
  const initialNodes = useMemo(() => {
    const savedLayout = vs.canvasLayout
    const dir = savedLayout?.direction || 'TB'
    const nodes = buildNodes(vs.phases, dir)
    const edges = buildEdges(vs.advancementRules, vs.phases)
    
    // If we have saved positions, use them; otherwise auto-layout
    let positionedNodes
    if (savedLayout?.nodePositions && Object.keys(savedLayout.nodePositions).length > 0) {
      // Apply saved positions
      positionedNodes = nodes.map(node => {
        const savedPos = savedLayout.nodePositions[node.id]
        return savedPos ? { ...node, position: savedPos } : node
      })
    } else {
      // Auto-layout with dagre
      const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges, dir)
      positionedNodes = layoutedNodes
    }
    
    const phaseNames = {}
    vs.phases.forEach((p, i) => { phaseNames[i + 1] = p.name })
    return positionedNodes.map((node, idx) => {
      const order = idx + 1
      return {
        ...node,
        data: {
          ...node.data,
          incomingRules: vs.advancementRules.filter(r => r.targetPhaseOrder === order),
          outgoingRules: vs.advancementRules.filter(r => r.sourcePhaseOrder === order),
          phaseNames,
        }
      }
    })
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

    // Build phase name lookup for rules display
    const phaseNames = {}
    vs.phases.forEach((p, i) => { phaseNames[i + 1] = p.name })

    // Always update node data to reflect current phase state
    setNodes(prev => {
      if (prev.length !== newLen) {
        // Structural change — full rebuild with layout
        const newNodes = buildNodes(vs.phases, layoutDirection)
        const newEdges = buildEdges(vs.advancementRules, vs.phases)
        const { nodes: layoutedNodes } = getLayoutedElements(newNodes, newEdges, layoutDirection)
        setEdges(newEdges)
        return layoutedNodes.map((node, idx) => {
          const order = idx + 1
          return {
            ...node,
            data: {
              ...node.data,
              layoutDirection,
              incomingRules: vs.advancementRules.filter(r => r.targetPhaseOrder === order),
              outgoingRules: vs.advancementRules.filter(r => r.sourcePhaseOrder === order),
              phaseNames,
            }
          }
        })
      }
      // Just update data on existing nodes
      return prev.map((node, idx) => {
        const phase = vs.phases[idx]
        if (!phase) return node
        const order = idx + 1
        return {
          ...node,
          data: {
            label: phase.name,
            phaseType: phase.phaseType,
            sortOrder: order,
            incomingSlotCount: phase.incomingSlotCount,
            advancingSlotCount: phase.advancingSlotCount,
            poolCount: phase.poolCount,
            bestOf: phase.bestOf,
            includeConsolation: phase.includeConsolation,
            awardType: phase.awardType,
            drawMethod: phase.drawMethod,
            layoutDirection,
            incomingRules: vs.advancementRules.filter(r => r.targetPhaseOrder === order),
            outgoingRules: vs.advancementRules.filter(r => r.sourcePhaseOrder === order),
            phaseNames,
          }
        }
      })
    })
  }, [vs, buildNodes, buildEdges, setNodes, setEdges, layoutDirection])

  // Update edge styles when selection changes
  useEffect(() => {
    // Rebuild edges fully to pick up custom/default detection + selection styles
    const newEdges = buildEdges(vs.advancementRules, vs.phases, selectedEdgeKey)
    setEdges(newEdges)
  }, [selectedEdgeKey, vs.advancementRules, vs.phases, setEdges, buildEdges])

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
    // Use phase names for rules (new format)
    const srcName = srcPhase?.name
    const tgtName = tgtPhase?.name
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
          newRules.push({ sourcePhase: srcName, targetPhase: tgtName, finishPosition: pos, targetSlotNumber: slot++, sourcePoolIndex: pool })
        }
      }
    } else {
      // For BracketRound with losers, check which slots are already mapped to other targets
      const isBracketWithLosers = srcPhase?.phaseType === 'BracketRound' && 
        (srcPhase.includeConsolation || (parseInt(srcPhase.advancingSlotCount) || 0) >= (parseInt(srcPhase.incomingSlotCount) || 0))
      const numMatches = Math.floor((parseInt(srcPhase?.incomingSlotCount) || 0) / 2)
      
      if (isBracketWithLosers && numMatches > 0) {
        // Check which finish positions are already mapped to OTHER targets
        const existingMapped = new Set()
        vs.advancementRules.forEach(r => {
          if (r.sourcePhase === srcName && r.targetPhase !== tgtName) {
            existingMapped.add(r.finishPosition)
          }
        })
        
        // If winners (1..numMatches) are already mapped, offer losers
        const winnersAlreadyMapped = Array.from({length: numMatches}, (_, i) => i + 1).every(p => existingMapped.has(p))
        const losersAlreadyMapped = Array.from({length: numMatches}, (_, i) => numMatches + i + 1).every(p => existingMapped.has(p))
        
        let startPos, endPos
        if (winnersAlreadyMapped && !losersAlreadyMapped) {
          // Map losers
          startPos = numMatches + 1
          endPos = numMatches * 2
        } else if (!winnersAlreadyMapped) {
          // Map winners first
          startPos = 1
          endPos = numMatches
        } else {
          // Both mapped already, map all
          startPos = 1
          endPos = slotsToAdvance
        }
        
        let targetSlot = 1
        for (let pos = startPos; pos <= endPos; pos++) {
          newRules.push({ sourcePhase: srcName, targetPhase: tgtName, finishPosition: pos, targetSlotNumber: targetSlot++, sourcePoolIndex: null })
        }
      } else {
        for (let pos = 1; pos <= slotsToAdvance; pos++) {
          newRules.push({ sourcePhase: srcName, targetPhase: tgtName, finishPosition: pos, targetSlotNumber: pos, sourcePoolIndex: null })
        }
      }
    }

    // Remove existing rules for this connection, then add new ones
    // Match by name (new format) or check legacy sortOrder format
    const filteredRules = vs.advancementRules.filter(
      r => !(r.sourcePhase === srcName && r.targetPhase === tgtName)
    )
    onChange({ ...vs, advancementRules: [...filteredRules, ...newRules] })
  }, [vs, onChange, setEdges])

  // When edges are deleted, remove corresponding advancement rules
  const onEdgesDelete = useCallback((deletedEdges) => {
    const pairsToRemove = deletedEdges.map(e => {
      const srcIdx = parseInt(e.source.replace('phase-', ''))
      const tgtIdx = parseInt(e.target.replace('phase-', ''))
      // Use phase names (new format)
      return { srcName: vs.phases[srcIdx]?.name, tgtName: vs.phases[tgtIdx]?.name }
    })
    const filteredRules = vs.advancementRules.filter(r =>
      !pairsToRemove.some(p => r.sourcePhase === p.srcName && r.targetPhase === p.tgtName)
    )
    onChange({ ...vs, advancementRules: filteredRules })
  }, [vs, onChange])

  // Node selection
  const onNodeClick = useCallback((_, node) => {
    setSelectedNodeId(node.id)
    setSelectedEdgeKey(null)
  }, [])

  // Edge selection — click edge to edit advancement rules
  const onEdgeClick = useCallback((_, edge) => {
    const srcIdx = parseInt(edge.source.replace('phase-', ''))
    const tgtIdx = parseInt(edge.target.replace('phase-', ''))
    setSelectedEdgeKey(`${srcIdx}-${tgtIdx}`)
    setSelectedNodeId(null)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
    setSelectedEdgeKey(null)
  }, [])

  // Update phase config from panel
  const handlePhaseUpdate = useCallback((phaseIdx, field, value) => {
    const phases = [...vs.phases]
    const oldPhase = phases[phaseIdx]
    
    // If changing name, update rules that reference this phase
    if (field === 'name' && oldPhase.name !== value) {
      // Check for duplicate names
      const isDuplicate = phases.some((p, i) => i !== phaseIdx && p.name === value)
      if (isDuplicate) {
        alert(`Phase name "${value}" already exists. Please use a unique name.`)
        return
      }
      
      // Update rules to use new name
      const oldName = oldPhase.name
      const updatedRules = vs.advancementRules.map(r => ({
        ...r,
        sourcePhase: r.sourcePhase === oldName ? value : r.sourcePhase,
        targetPhase: r.targetPhase === oldName ? value : r.targetPhase,
      }))
      phases[phaseIdx] = { ...oldPhase, [field]: value }
      onChange({ ...vs, phases, advancementRules: updatedRules })
      return
    }
    
    phases[phaseIdx] = { ...oldPhase, [field]: value }
    onChange({ ...vs, phases })
  }, [vs, onChange])

  // Delete selected phase
  const handleDeletePhase = useCallback(() => {
    if (!selectedNodeId) return
    const idx = parseInt(selectedNodeId.replace('phase-', ''))
    if (vs.phases.length <= 1) return

    // Get the name of the phase being deleted (for rule filtering)
    const deletedName = vs.phases[idx]?.name
    
    const phases = vs.phases.filter((_, i) => i !== idx).map((p, i) => ({ ...p, sortOrder: i + 1 }))
    // Remove rules that reference the deleted phase by name
    const rules = vs.advancementRules.filter(r =>
      r.sourcePhase !== deletedName && r.targetPhase !== deletedName
    )

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

    const isAward = phaseType === 'Award'
    const isDraw = phaseType === 'Draw'
    const newPhase = {
      ...DEFAULT_PHASE,
      name: isAward ? 'Award' : isDraw ? 'Draw' : `${phaseType} Phase`,
      phaseType,
      sortOrder: order,
      incomingSlotCount: isAward ? 1 : isDraw ? 0 : incoming,
      advancingSlotCount: isAward ? 0 : isDraw ? 8 : Math.max(1, Math.floor(incoming / 2)),
      poolCount: phaseType === 'Pools' ? 4 : 0,
      ...(isAward ? { awardType: 'Gold' } : {}),
      ...(isDraw ? { drawMethod: 'Random' } : {}),
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
        awardType: newPhase.awardType,
        drawMethod: newPhase.drawMethod,
        layoutDirection,
      }
    }])

    // Auto-connect to previous phase if one exists
    const newPhases = [...vs.phases, newPhase]
    let newRules = [...vs.advancementRules]
    if (vs.phases.length > 0 && !isDraw) {
      const prevIdx = vs.phases.length - 1
      const prevPhase = vs.phases[prevIdx]
      const prevNodeId = `phase-${prevIdx}`
      const srcOrder = prevIdx + 1
      const tgtOrder = order

      // Add visual edge
      setEdges(eds => addEdge({
        source: prevNodeId,
        target: newNodeId,
        animated: true,
        label: `Top ${parseInt(prevPhase.advancingSlotCount) || 1}`,
        style: { stroke: '#a78bfa' },
        labelStyle: { fontSize: 11, fontWeight: 600, fill: '#6d28d9' },
        labelBgStyle: { fill: '#f5f3ff', stroke: '#c4b5fd' },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 4,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#a78bfa' },
      }, eds))

      // Generate default advancement rules (slot-matched)
      const slotsToAdvance = Math.min(
        parseInt(prevPhase.advancingSlotCount) || 1,
        parseInt(newPhase.incomingSlotCount) || 1
      )
      if (prevPhase.phaseType === 'Pools' && (parseInt(prevPhase.poolCount) || 0) > 1) {
        const poolCount = parseInt(prevPhase.poolCount)
        const advPerPool = Math.max(1, Math.floor(slotsToAdvance / poolCount))
        let slot = 1
        for (let pool = 0; pool < poolCount; pool++) {
          for (let pos = 1; pos <= advPerPool; pos++) {
            newRules.push({ sourcePhaseOrder: srcOrder, targetPhaseOrder: tgtOrder, finishPosition: pos, targetSlotNumber: slot++, sourcePoolIndex: pool })
          }
        }
      } else {
        // For BracketRound with losers, check which slots are already mapped to other targets
        const isBracketWithLosers = prevPhase?.phaseType === 'BracketRound' && 
          (prevPhase.includeConsolation || (parseInt(prevPhase.advancingSlotCount) || 0) >= (parseInt(prevPhase.incomingSlotCount) || 0))
        const numMatches = Math.floor((parseInt(prevPhase?.incomingSlotCount) || 0) / 2)
        
        if (isBracketWithLosers && numMatches > 0) {
          // Check which finish positions are already mapped to OTHER targets
          const existingMapped = new Set()
          newRules.forEach(r => {
            if (r.sourcePhaseOrder === srcOrder && r.targetPhaseOrder !== tgtOrder) {
              existingMapped.add(r.finishPosition)
            }
          })
          
          const winnersAlreadyMapped = Array.from({length: numMatches}, (_, i) => i + 1).every(p => existingMapped.has(p))
          const losersAlreadyMapped = Array.from({length: numMatches}, (_, i) => numMatches + i + 1).every(p => existingMapped.has(p))
          
          let startPos, endPos
          if (winnersAlreadyMapped && !losersAlreadyMapped) {
            startPos = numMatches + 1
            endPos = numMatches * 2
          } else if (!winnersAlreadyMapped) {
            startPos = 1
            endPos = numMatches
          } else {
            startPos = 1
            endPos = slotsToAdvance
          }
          
          let targetSlot = 1
          for (let pos = startPos; pos <= endPos; pos++) {
            newRules.push({ sourcePhaseOrder: srcOrder, targetPhaseOrder: tgtOrder, finishPosition: pos, targetSlotNumber: targetSlot++, sourcePoolIndex: null })
          }
        } else {
          for (let pos = 1; pos <= slotsToAdvance; pos++) {
            newRules.push({ sourcePhaseOrder: srcOrder, targetPhaseOrder: tgtOrder, finishPosition: pos, targetSlotNumber: pos, sourcePoolIndex: null })
          }
        }
      }
    }

    onChange({ ...vs, phases: newPhases, advancementRules: newRules })
  }, [vs, onChange, screenToFlowPosition, setNodes])

  // Auto-layout button
  const handleAutoLayout = useCallback(() => {
    const currentEdges = edges
    const { nodes: layoutedNodes } = getLayoutedElements(nodes, currentEdges, layoutDirection, expandAll)
    setNodes(layoutedNodes)
    // Save new positions to canvasLayout
    const nodePositions = {}
    layoutedNodes.forEach(n => { nodePositions[n.id] = n.position })
    onChange({
      ...vs,
      canvasLayout: {
        direction: layoutDirection,
        nodePositions
      }
    })
  }, [nodes, edges, setNodes, layoutDirection, expandAll, vs, onChange])

  // Change direction WITHOUT re-layout (just update handle positions)
  const handleDirectionChange = useCallback((dir) => {
    setLayoutDirection(dir)
    // Update node data with new direction but keep current positions
    setNodes(prev => {
      const updated = prev.map(node => ({
        ...node,
        data: { ...node.data, layoutDirection: dir }
      }))
      // Force React Flow to recalculate handle positions after render
      setTimeout(() => {
        updateNodeInternals(updated.map(n => n.id))
      }, 0)
      // Save direction change (keep existing positions)
      const nodePositions = {}
      updated.forEach(n => { nodePositions[n.id] = n.position })
      onChange({
        ...vs,
        canvasLayout: {
          direction: dir,
          nodePositions
        }
      })
      return updated
    })
    // Force edge rebuild so React Flow recalculates paths for new handle positions
    setEdges(prev => prev.map(e => ({ ...e })))
  }, [setNodes, setEdges, updateNodeInternals, vs, onChange])

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

    // With name-based rules, we don't need to remap - names stay the same
    // Just update the phases array order
    onChange({ ...vs, phases: reordered })
  }, [nodes, edges, vs, onChange])

  // Export canvas as PNG image
  const handleExportImage = useCallback(() => {
    const nodesBounds = getNodesBounds(nodes)
    const padding = 50
    const imageWidth = nodesBounds.width + padding * 2
    const imageHeight = nodesBounds.height + padding * 2

    const viewport = getViewportForBounds(
      nodesBounds,
      imageWidth,
      imageHeight,
      0.5,
      2,
      padding
    )

    const viewportEl = document.querySelector('.react-flow__viewport')
    if (!viewportEl) return

    toPng(viewportEl, {
      backgroundColor: '#f9fafb',
      width: imageWidth,
      height: imageHeight,
      pixelRatio: 3,
      style: {
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    }).then((dataUrl) => {
      const a = document.createElement('a')
      a.setAttribute('download', 'tournament-structure.png')
      a.setAttribute('href', dataUrl)
      a.click()
    }).catch((err) => {
      console.error('Failed to export image:', err)
    })
  }, [nodes])

  // Validation warnings/errors
  const { warnings, errors } = useMemo(() => {
    const w = []
    const e = []
    
    // Check required phases
    const hasDrawPhase = vs.phases.some(p => p.phaseType === 'Draw')
    const hasAwardPhase = vs.phases.some(p => p.phaseType === 'Award')
    if (!hasDrawPhase && vs.phases.length > 0) {
      e.push('Template must have a Draw phase')
    }
    if (!hasAwardPhase && vs.phases.length > 0) {
      e.push('Template must have at least one Award phase')
    }
    
    // Check for duplicate phase names
    const nameCount = {}
    vs.phases.forEach(p => { nameCount[p.name] = (nameCount[p.name] || 0) + 1 })
    Object.entries(nameCount).forEach(([name, count]) => {
      if (count > 1) e.push(`Duplicate phase name: "${name}" (${count} phases)`)
    })
    
    // Check connectivity
    nodes.forEach((node, idx) => {
      const phase = vs.phases[idx]
      if (!phase) return
      
      // Draw phase should have no incoming, others should
      if (phase.phaseType === 'Draw') {
        const hasIncoming = edges.some(e => e.target === node.id)
        if (hasIncoming) w.push(`"${phase.name}" (Draw) should not have incoming connections`)
      } else {
        const hasIncoming = edges.some(e => e.target === node.id)
        if (!hasIncoming && nodes.length > 1) {
          e.push(`"${phase.name}" has no incoming connection (orphaned)`)
        }
      }
      
      // Award phase should have no outgoing, others should (except last phase)
      if (phase.phaseType === 'Award') {
        const hasOutgoing = edges.some(e => e.source === node.id)
        if (hasOutgoing) w.push(`"${phase.name}" (Award) should not have outgoing connections`)
      } else if (phase.phaseType !== 'Draw' || vs.phases.length > 1) {
        const hasOutgoing = edges.some(e => e.source === node.id)
        if (!hasOutgoing && nodes.length > 1) {
          w.push(`"${phase.name}" has no outgoing connection`)
        }
      }
    })
    
    return { warnings: w, errors: e }
  }, [nodes, edges, vs.phases])

  const selectedPhaseIdx = selectedNodeId ? parseInt(selectedNodeId.replace('phase-', '')) : null
  const selectedPhase = selectedPhaseIdx !== null ? vs.phases[selectedPhaseIdx] : null

  return (
    <div className="flex border rounded-lg overflow-hidden bg-white h-full">
      {/* Left Palette - hidden in readOnly mode */}
      {!readOnly && (
        <div className="w-48 border-r bg-gray-50 p-3 flex flex-col gap-2 flex-shrink-0 overflow-y-auto">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Phase Types</h4>
          <p className="text-[10px] text-gray-400 mb-2">Drag onto canvas</p>
          <PaletteItem phaseType="RoundRobin" label="Round Robin" />
          <PaletteItem phaseType="SingleElimination" label="Single Elim" />
          <PaletteItem phaseType="DoubleElimination" label="Double Elim" />
          <PaletteItem phaseType="Pools" label="Pools" />
          <PaletteItem phaseType="Swiss" label="Swiss" />
          <PaletteItem phaseType="BracketRound" label="Bracket Round" />
          <div className="border-t my-2" />
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Entry</h4>
          <PaletteItem phaseType="Draw" label="Draw" />
          <div className="border-t my-2" />
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Awards</h4>
          <PaletteItem phaseType="Award" label="Award" />
        </div>
      )}

      {/* Center Canvas */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={readOnly ? undefined : onNodesChange}
          onEdgesChange={readOnly ? undefined : onEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onEdgesDelete={readOnly ? undefined : onEdgesDelete}
          onNodeClick={readOnly ? undefined : onNodeClick}
          onEdgeClick={readOnly ? undefined : onEdgeClick}
          onPaneClick={readOnly ? undefined : onPaneClick}
          onDragOver={readOnly ? undefined : onDragOver}
          onDrop={readOnly ? undefined : onDrop}
          onNodeDragStop={readOnly ? undefined : (event, node) => {
            // Save all node positions when any node is dragged
            const nodePositions = {}
            nodes.forEach(n => {
              // Use the updated position for the dragged node, current position for others
              nodePositions[n.id] = n.id === node.id ? node.position : n.position
            })
            onChange({
              ...vs,
              canvasLayout: {
                direction: layoutDirection,
                nodePositions
              }
            })
          }}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
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
          {!readOnly && (
            <Panel position="top-left" className="flex gap-1.5">
              <button onClick={handleAutoLayout}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white border rounded-lg shadow-sm text-xs font-medium text-gray-600 hover:bg-gray-50">
                <LayoutGrid className="w-3.5 h-3.5" /> Auto Layout
              </button>
              <button onClick={handleSyncSortOrder}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white border rounded-lg shadow-sm text-xs font-medium text-gray-600 hover:bg-gray-50">
                <ArrowRight className="w-3.5 h-3.5" /> Sync Order
              </button>
              <button onClick={handleExportImage}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white border rounded-lg shadow-sm text-xs font-medium text-gray-600 hover:bg-gray-50">
                <Eye className="w-3.5 h-3.5" /> Export PNG
              </button>
              <button onClick={() => {
                const newExpand = !expandAll
                setExpandAll(newExpand)
                // Rebuild nodes with forceExpand to trigger re-render and re-layout with proper dimensions
                const newNodes = buildNodes(vs.phases, layoutDirection, newExpand)
                const edges = buildEdges(vs.advancementRules, vs.phases, selectedEdgeKey)
                const { nodes: layoutedNodes } = getLayoutedElements(newNodes, edges, layoutDirection, newExpand)
                setNodes(layoutedNodes)
              }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white border rounded-lg shadow-sm text-xs font-medium text-gray-600 hover:bg-gray-50">
                {expandAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronsUpDown className="w-3.5 h-3.5" />}
                {expandAll ? 'Collapse All' : 'Expand All'}
              </button>
              <div className="flex items-center bg-white border rounded-lg shadow-sm overflow-hidden">
                <button onClick={() => handleDirectionChange('TB')}
                  className={`px-2.5 py-1.5 text-xs font-medium ${layoutDirection === 'TB' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                  ↓ Top-Down
                </button>
                <button onClick={() => handleDirectionChange('LR')}
                  className={`px-2.5 py-1.5 text-xs font-medium border-l ${layoutDirection === 'LR' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                  → Left-Right
                </button>
              </div>
            </Panel>
          )}
          {!readOnly && (errors.length > 0 || warnings.length > 0) && (
            <Panel position="bottom-left">
              <div className="max-w-xs space-y-2">
                {errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    {errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-red-700">
                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                )}
                {warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                    {warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-700">
                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Panel>
          )}
        </ReactFlow>
        {/* Inline edge slot mapper — positioned near edge (hidden in readOnly mode) */}
        {!readOnly && selectedEdgeKey && (() => {
          const [srcIdx, tgtIdx] = selectedEdgeKey.split('-').map(Number)
          const srcPhase = vs.phases[srcIdx]
          const tgtPhase = vs.phases[tgtIdx]
          if (!srcPhase || !tgtPhase) return null

          // Position near the edge midpoint
          const srcNode = nodes.find(n => n.id === `phase-${srcIdx}`)
          const tgtNode = nodes.find(n => n.id === `phase-${tgtIdx}`)
          let popoverStyle = { position: 'absolute', top: '8px', right: '8px', zIndex: 50 }
          if (srcNode && tgtNode && reactFlowWrapper.current) {
            const midFlowX = (srcNode.position.x + tgtNode.position.x) / 2 + 240
            const midFlowY = (srcNode.position.y + tgtNode.position.y) / 2
            const screenPos = flowToScreenPosition({ x: midFlowX, y: midFlowY })
            const wrapperRect = reactFlowWrapper.current.getBoundingClientRect()
            const relX = screenPos.x - wrapperRect.left
            const relY = screenPos.y - wrapperRect.top
            // Clamp to stay within wrapper bounds
            const clampedX = Math.max(8, Math.min(relX, wrapperRect.width - 296))
            const clampedY = Math.max(8, Math.min(relY - 100, wrapperRect.height - 400))
            popoverStyle = {
              position: 'absolute',
              left: `${clampedX}px`,
              top: `${clampedY}px`,
              zIndex: 50,
            }
          }

          return (
            <div style={popoverStyle}>
              <div className="w-72 bg-white rounded-xl shadow-xl border border-gray-200 max-h-[70vh] overflow-y-auto">
                <EdgeConfigPanel
                  sourcePhase={srcPhase}
                  targetPhase={tgtPhase}
                  sourceIdx={srcIdx}
                  targetIdx={tgtIdx}
                  rules={vs.advancementRules}
                  onRulesChange={(newRules) => onChange({ ...vs, advancementRules: newRules })}
                  onClose={() => setSelectedEdgeKey(null)}
                />
              </div>
            </div>
          )
        })()}
      </div>

      {/* Right Config Panel — phase config only (hidden in readOnly mode) */}
      {!readOnly && selectedPhase && (
        <div className="w-72 border-l bg-gray-50 overflow-y-auto flex-shrink-0">
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
const CanvasPhaseEditor = ({ visualState, onChange, readOnly = false }) => {
  return (
    <ReactFlowProvider>
      <CanvasPhaseEditorInner visualState={visualState} onChange={onChange} readOnly={readOnly} />
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

  // Community Templates tab state
  const [viewTab, setViewTab] = useState('system') // 'system' | 'community'
  const [communityTemplates, setCommunityTemplates] = useState([])
  const [communityLoading, setCommunityLoading] = useState(false)
  const [communityError, setCommunityError] = useState(null)
  const [expandedCommunity, setExpandedCommunity] = useState({})
  const [copyingId, setCopyingId] = useState(null)
  const [copySuccess, setCopySuccess] = useState(null)

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

  // Load community (user-created) templates
  const loadCommunityTemplates = async () => {
    setCommunityLoading(true)
    setCommunityError(null)
    try {
      const response = await tournamentApi.getUserPhaseTemplates()
      const list = Array.isArray(response) ? response : (response?.data || [])
      setCommunityTemplates(list)
    } catch (err) {
      setCommunityError(err.message || 'Failed to load community templates')
    } finally {
      setCommunityLoading(false)
    }
  }

  useEffect(() => {
    if (viewTab === 'community' && communityTemplates.length === 0 && !communityLoading) {
      loadCommunityTemplates()
    }
  }, [viewTab])

  // Copy a user template to system templates
  const handleCopyToSystem = async (template) => {
    setCopyingId(template.id)
    setCopySuccess(null)
    try {
      await tournamentApi.copyToSystemTemplate(template.id)
      setCopySuccess(template.id)
      // Refresh both lists
      loadTemplates()
      loadCommunityTemplates()
      // Auto-clear success after 4s
      setTimeout(() => setCopySuccess(null), 4000)
    } catch (err) {
      alert(err.message || 'Failed to copy template to system')
    } finally {
      setCopyingId(null)
    }
  }

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

  // Validate template structure
  const validateTemplate = (jsonStr) => {
    const errors = []
    try {
      const data = JSON.parse(jsonStr)
      if (!data.phases || !Array.isArray(data.phases)) {
        errors.push('Template must have phases array')
        return errors
      }
      
      // Check required phase types
      const hasDrawPhase = data.phases.some(p => p.phaseType === 'Draw')
      const hasAwardPhase = data.phases.some(p => p.phaseType === 'Award')
      if (!hasDrawPhase && data.phases.length > 0) {
        errors.push('Template must have a Draw phase')
      }
      if (!hasAwardPhase && data.phases.length > 0) {
        errors.push('Template must have at least one Award phase')
      }
      
      // Check for duplicate phase names
      const names = data.phases.map(p => p.name)
      const duplicates = names.filter((name, i) => names.indexOf(name) !== i)
      if (duplicates.length > 0) {
        errors.push(`Duplicate phase names: ${[...new Set(duplicates)].join(', ')}`)
      }
      
      // Check rules reference valid phase names
      if (data.advancementRules && Array.isArray(data.advancementRules)) {
        const validNames = new Set(names)
        data.advancementRules.forEach((r, i) => {
          if (r.sourcePhase && !validNames.has(r.sourcePhase)) {
            errors.push(`Rule ${i + 1}: sourcePhase "${r.sourcePhase}" not found`)
          }
          if (r.targetPhase && !validNames.has(r.targetPhase)) {
            errors.push(`Rule ${i + 1}: targetPhase "${r.targetPhase}" not found`)
          }
        })
      }
    } catch (e) {
      errors.push('Invalid JSON syntax')
    }
    return errors
  }

  // Save (create or update)
  const handleSave = async () => {
    // Validate JSON syntax
    try {
      JSON.parse(formData.structureJson)
    } catch (e) {
      alert('Invalid JSON in structure. Please fix the JSON syntax.')
      return
    }

    // Validate template structure
    const validationErrors = validateTemplate(formData.structureJson)
    if (validationErrors.length > 0) {
      alert('Template validation failed:\n\n' + validationErrors.join('\n'))
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

  // Toggle active status
  const handleToggleActive = async (template) => {
    const newActive = template.isActive === false ? true : false
    const action = newActive ? 'enable' : 'disable'
    
    if (!confirm(`Are you sure you want to ${action} "${template.name}"?`)) {
      return
    }

    try {
      await tournamentApi.updatePhaseTemplate(template.id, { isActive: newActive })
      loadTemplates()
    } catch (err) {
      alert(err.message || `Failed to ${action} template`)
    }
  }

  // Delete template
  const handleDelete = async (template) => {
    const confirmMsg = template.isSystemTemplate
      ? `⚠️ WARNING: You are about to permanently delete the SYSTEM template "${template.name}".\n\nThis will affect all users. Type DELETE to confirm:`
      : `Are you sure you want to delete "${template.name}"?`

    if (template.isSystemTemplate) {
      const input = prompt(confirmMsg)
      if (input !== 'DELETE') {
        if (input !== null) alert('Deletion cancelled. You must type DELETE to confirm.')
        return
      }
    } else {
      if (!confirm(confirmMsg)) return
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
                  {phaseType === 'Award' 
                    ? `${incomingSlots} in → 🏆` 
                    : phaseType === 'Draw' 
                      ? `🎲 → ${exitingSlots} out`
                      : `${incomingSlots} in → ${exitingSlots} out`}
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

        {/* View Tabs */}
        <div className="mb-4 flex items-center gap-1 border-b">
          <button
            onClick={() => setViewTab('system')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              viewTab === 'system'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            System Templates
          </button>
          <button
            onClick={() => setViewTab('community')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              viewTab === 'community'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Community Templates
          </button>
        </div>

        {error && viewTab === 'system' && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            {error}
          </div>
        )}

        {viewTab === 'system' ? (<>
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
                        {template.isSystemTemplate && (
                          <button
                            onClick={() => handleToggleActive(template)}
                            className={`p-2 rounded-lg ${template.isActive !== false ? 'text-green-500 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                            title={template.isActive !== false ? 'Disable template' : 'Enable template'}
                          >
                            {template.isActive !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                        )}
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
        </>) : (
        /* ══ Community Templates Tab ══ */
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              Templates created by Tournament Directors. Review and promote to system templates.
            </p>
            <button
              onClick={loadCommunityTemplates}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${communityLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {communityError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              {communityError}
              <button onClick={loadCommunityTemplates} className="ml-auto text-sm underline">Retry</button>
            </div>
          )}

          {communityLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mr-2" />
              <span className="text-gray-500">Loading community templates...</span>
            </div>
          ) : communityTemplates.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-700 mb-1">No community templates yet</h3>
              <p className="text-sm text-gray-500">When Tournament Directors create their own templates, they'll appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {communityTemplates.map(template => {
                const CategoryIcon = getCategoryIcon(template.category)
                const isExpanded = expandedCommunity[template.id]
                const isCopying = copyingId === template.id
                const justCopied = copySuccess === template.id

                return (
                  <div key={template.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-green-100">
                            <CategoryIcon className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-gray-900">{template.name}</h3>
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                User Template
                              </span>
                              {template.copiedToSystemId && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                  Already in System
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {template.description || 'No description'}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
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
                              <span className="text-xs text-gray-400">
                                by {template.creatorName || template.createdByUserId || 'Unknown'}
                              </span>
                              {template.createdAt && (
                                <span className="text-xs text-gray-400">
                                  {new Date(template.createdAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Copy to System */}
                          <button
                            onClick={() => handleCopyToSystem(template)}
                            disabled={isCopying}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                              justCopied
                                ? 'bg-green-100 text-green-700'
                                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                            } disabled:opacity-50`}
                            title="Copy to system templates"
                          >
                            {isCopying ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : justCopied ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            {justCopied ? 'Copied!' : 'Copy to System'}
                          </button>
                          {/* Preview toggle */}
                          <button
                            onClick={() => setExpandedCommunity(prev => ({ ...prev, [template.id]: !prev[template.id] }))}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="Preview structure"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Preview */}
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
              })}
            </div>
          )}
        </div>
        )}
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

// Export canvas components for reuse in MyTemplates
export { CanvasPhaseEditor }
