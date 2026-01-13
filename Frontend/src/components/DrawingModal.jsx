import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Shuffle, Users, Check, Play, AlertCircle, Loader2, Eye, EyeOff, ArrowRight, RotateCcw, Sparkles, CircleDot, Layers, Mail, Dices } from 'lucide-react';

// Draw style options
const DRAW_STYLES = [
  { id: 'wheel', name: 'Spin Wheel', icon: CircleDot, description: 'Classic spinning wheel' },
  { id: 'cards', name: 'Card Flip', icon: Layers, description: 'Reveal cards one by one' },
  { id: 'slots', name: 'Slot Machine', icon: Dices, description: 'Vegas-style reels' },
  { id: 'lottery', name: 'Ball Drop', icon: CircleDot, description: 'Lottery drum draw' },
];

// Spinning wheel component
function SpinningWheel({
  items,
  isSpinning,
  selectedIndex,
  size = 300,
  onSpinEnd
}) {
  const canvasRef = useRef(null);
  const rotationRef = useRef(0);
  const animationRef = useRef(null);
  const [currentRotation, setCurrentRotation] = useState(0);

  const colors = [
    '#F97316', '#EF4444', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B',
    '#EC4899', '#6366F1', '#14B8A6', '#F472B6', '#84CC16', '#06B6D4'
  ];

  const drawWheel = useCallback((rotation = 0) => {
    const canvas = canvasRef.current;
    if (!canvas || items.length === 0) return;

    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sliceAngle = (2 * Math.PI) / items.length;

    // Draw wheel slices
    items.forEach((item, index) => {
      const startAngle = rotation + index * sliceAngle - Math.PI / 2;
      const endAngle = startAngle + sliceAngle;

      // Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = colors[index % colors.length];
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 2;

      const text = (item.displayName || item.name || `Unit ${index + 1}`).substring(0, 18);
      ctx.fillText(text, radius - 20, 4);
      ctx.restore();
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 25, 0, 2 * Math.PI);
    ctx.fillStyle = '#1F2937';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw pointer
    ctx.beginPath();
    ctx.moveTo(centerX + radius + 5, centerY);
    ctx.lineTo(centerX + radius - 15, centerY - 12);
    ctx.lineTo(centerX + radius - 15, centerY + 12);
    ctx.closePath();
    ctx.fillStyle = '#1F2937';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [items, colors]);

  useEffect(() => {
    drawWheel(currentRotation);
  }, [currentRotation, drawWheel]);

  useEffect(() => {
    if (isSpinning && items.length > 0) {
      const sliceAngle = (2 * Math.PI) / items.length;
      // Calculate target rotation to land on selected index
      const targetSlice = items.length - 1 - selectedIndex; // Reverse because we're going clockwise
      const baseRotation = targetSlice * sliceAngle + sliceAngle / 2;
      const extraSpins = 5 * 2 * Math.PI; // 5 full rotations
      const targetRotation = rotationRef.current + extraSpins + baseRotation;

      const startTime = performance.now();
      const duration = 4000; // 4 seconds
      const startRotation = rotationRef.current;

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease out cubic)
        const eased = 1 - Math.pow(1 - progress, 3);

        const newRotation = startRotation + (targetRotation - startRotation) * eased;
        rotationRef.current = newRotation;
        setCurrentRotation(newRotation);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          rotationRef.current = targetRotation;
          setCurrentRotation(targetRotation);
          onSpinEnd?.();
        }
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [isSpinning, selectedIndex, items.length, onSpinEnd]);

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="drop-shadow-xl"
      />
      {isSpinning && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-orange-400/20 via-transparent to-orange-400/20 rounded-full" />
        </div>
      )}
    </div>
  );
}

// Confetti effect component
function Confetti({ active }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (active) {
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2,
        color: ['#F97316', '#EF4444', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B'][Math.floor(Math.random() * 6)]
      }));
      setParticles(newParticles);

      const timer = setTimeout(() => setParticles([]), 4000);
      return () => clearTimeout(timer);
    }
  }, [active]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute w-3 h-3 rounded-full animate-confetti"
          style={{
            left: `${p.x}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`
          }}
        />
      ))}
    </div>
  );
}

// Slot machine style number display
function SlotNumber({ number, isAnimating, isFinal }) {
  const [displayNumber, setDisplayNumber] = useState(number || '?');

  useEffect(() => {
    if (isAnimating) {
      const interval = setInterval(() => {
        setDisplayNumber(Math.floor(Math.random() * 32) + 1);
      }, 50);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        setDisplayNumber(number);
      }, 1000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    } else if (isFinal) {
      setDisplayNumber(number);
    }
  }, [isAnimating, number, isFinal]);

  return (
    <div className={`
      w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold
      transition-all duration-300 transform
      ${isAnimating ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white scale-110 animate-pulse' :
        isFinal ? 'bg-gradient-to-br from-green-400 to-green-600 text-white' :
        'bg-gray-200 text-gray-600'}
    `}>
      {displayNumber}
    </div>
  );
}

// Card Flip animation component
function CardFlipDraw({ items, currentIndex, revealedIndices, assignedNumbers, onAnimationEnd }) {
  const colors = [
    'from-orange-400 to-red-500', 'from-blue-400 to-indigo-500', 'from-green-400 to-emerald-500',
    'from-purple-400 to-pink-500', 'from-yellow-400 to-orange-500', 'from-cyan-400 to-blue-500',
    'from-pink-400 to-rose-500', 'from-indigo-400 to-purple-500'
  ];

  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 max-w-xl mx-auto">
      {items.map((item, idx) => {
        const isRevealed = revealedIndices.includes(idx);
        const isFlipping = currentIndex === idx;
        const assignedNum = assignedNumbers[idx];
        const colorClass = colors[idx % colors.length];

        return (
          <div
            key={item.id || idx}
            className="perspective-1000"
            style={{ perspective: '1000px' }}
          >
            <div
              className={`relative w-14 h-20 sm:w-16 sm:h-24 transition-all duration-700 transform-style-preserve-3d ${
                isRevealed || isFlipping ? 'rotate-y-180' : ''
              }`}
              style={{
                transformStyle: 'preserve-3d',
                transform: isRevealed || isFlipping ? 'rotateY(180deg)' : 'rotateY(0deg)'
              }}
            >
              {/* Card Back */}
              <div
                className={`absolute inset-0 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center shadow-lg backface-hidden`}
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div className="text-white/30 text-2xl font-bold">?</div>
                <div className="absolute inset-1 border-2 border-white/20 rounded-lg" />
              </div>
              {/* Card Front */}
              <div
                className="absolute inset-0 rounded-xl bg-white flex flex-col items-center justify-center shadow-lg backface-hidden"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <div className={`text-2xl font-bold bg-gradient-to-br ${colorClass} bg-clip-text text-transparent`}>
                  {assignedNum || '?'}
                </div>
                <div className="text-xs text-gray-500 mt-1 px-1 text-center truncate max-w-full">
                  {(item.displayName || item.name || '').substring(0, 8)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Slot Machine animation component
function SlotMachineDraw({ currentUnit, assignedNumber, isSpinning, onSpinEnd }) {
  const [displayName, setDisplayName] = useState('???');
  const names = ['Player A', 'Team X', 'Squad 1', 'Unit Z', 'Group B', 'Team Y'];

  useEffect(() => {
    if (isSpinning) {
      // Spin names only - slot number is fixed (sequential)
      const nameInterval = setInterval(() => {
        setDisplayName(names[Math.floor(Math.random() * names.length)]);
      }, 80);

      // Stop after delay
      const timeout = setTimeout(() => {
        clearInterval(nameInterval);
        setDisplayName(currentUnit?.displayName || currentUnit?.name || 'Team');
        setTimeout(() => onSpinEnd?.(), 300);
      }, 2000);

      return () => {
        clearInterval(nameInterval);
        clearTimeout(timeout);
      };
    }
  }, [isSpinning, currentUnit, onSpinEnd]);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Slot number being drawn */}
      <div className="text-center">
        <div className="text-sm text-gray-400 mb-1">Drawing for</div>
        <div className="text-3xl font-bold text-orange-400">Slot #{assignedNumber}</div>
      </div>
      {/* Slot Machine Frame */}
      <div className="bg-gradient-to-b from-yellow-600 to-yellow-800 p-2 rounded-2xl shadow-2xl">
        <div className="bg-gray-900 p-4 rounded-xl">
          <div className="flex gap-4 items-center">
            {/* Slot Number (fixed) */}
            <div className="bg-gradient-to-br from-orange-400 to-red-500 rounded-lg p-3 min-w-[50px] shadow-lg">
              <div className="text-center font-bold text-2xl text-white">
                {assignedNumber}
              </div>
            </div>
            {/* Arrow */}
            <div className="flex items-center text-yellow-400">
              <ArrowRight className="w-6 h-6" />
            </div>
            {/* Name Reel (spinning) */}
            <div className="bg-white rounded-lg p-3 min-w-[160px] overflow-hidden shadow-inner">
              <div className={`text-center font-bold text-lg ${isSpinning ? 'animate-pulse' : ''}`}>
                <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {displayName}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Decorative lights */}
      <div className="flex gap-2">
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full ${isSpinning ? 'animate-pulse' : ''}`}
            style={{
              backgroundColor: ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'][i],
              animationDelay: `${i * 0.1}s`
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Ball Drop / Lottery animation component
function LotteryDraw({ items, currentIndex, revealedItems, assignedNumbers, onBallDrop }) {
  const canvasRef = useRef(null);
  const ballsRef = useRef([]);
  const animationRef = useRef(null);
  const [droppedBall, setDroppedBall] = useState(null);

  const colors = ['#F97316', '#EF4444', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#6366F1'];

  // Initialize balls
  useEffect(() => {
    if (items.length > 0 && ballsRef.current.length === 0) {
      ballsRef.current = items.map((item, idx) => ({
        id: item.id || idx,
        x: 80 + Math.random() * 140,
        y: 60 + Math.random() * 80,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        radius: 18,
        color: colors[idx % colors.length],
        name: (item.displayName || item.name || `#${idx + 1}`).substring(0, 6),
        revealed: false
      }));
    }
  }, [items]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const drumWidth = 300;
    const drumHeight = 180;
    const drumX = 0;
    const drumY = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw drum background
      ctx.fillStyle = 'rgba(31, 41, 55, 0.8)';
      ctx.strokeStyle = '#6B7280';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(drumX, drumY, drumWidth, drumHeight, 20);
      ctx.fill();
      ctx.stroke();

      // Draw drum grid pattern
      ctx.strokeStyle = 'rgba(107, 114, 128, 0.3)';
      ctx.lineWidth = 1;
      for (let i = 0; i < drumWidth; i += 20) {
        ctx.beginPath();
        ctx.moveTo(drumX + i, drumY);
        ctx.lineTo(drumX + i, drumY + drumHeight);
        ctx.stroke();
      }

      // Update and draw balls
      ballsRef.current.forEach((ball, idx) => {
        if (ball.revealed) return;

        // Update position
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Bounce off walls
        if (ball.x - ball.radius < drumX + 10 || ball.x + ball.radius > drumX + drumWidth - 10) {
          ball.vx *= -0.9;
          ball.x = Math.max(drumX + ball.radius + 10, Math.min(drumX + drumWidth - ball.radius - 10, ball.x));
        }
        if (ball.y - ball.radius < drumY + 10 || ball.y + ball.radius > drumY + drumHeight - 10) {
          ball.vy *= -0.9;
          ball.y = Math.max(drumY + ball.radius + 10, Math.min(drumY + drumHeight - ball.radius - 10, ball.y));
        }

        // Add slight randomness
        ball.vx += (Math.random() - 0.5) * 0.5;
        ball.vy += (Math.random() - 0.5) * 0.5;

        // Limit speed
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (speed > 5) {
          ball.vx = (ball.vx / speed) * 5;
          ball.vy = (ball.vy / speed) * 5;
        }

        // Draw ball
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ball.name, ball.x, ball.y);
      });

      // Draw chute
      ctx.fillStyle = '#374151';
      ctx.beginPath();
      ctx.moveTo(drumWidth - 30, drumHeight);
      ctx.lineTo(drumWidth + 20, drumHeight + 50);
      ctx.lineTo(drumWidth + 60, drumHeight + 50);
      ctx.lineTo(drumWidth - 10, drumHeight);
      ctx.fill();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [items]);

  // Handle ball drop
  useEffect(() => {
    if (currentIndex >= 0 && currentIndex < items.length) {
      const ball = ballsRef.current[currentIndex];
      if (ball && !ball.revealed) {
        ball.revealed = true;
        setDroppedBall({
          ...ball,
          number: assignedNumbers[currentIndex]
        });
        setTimeout(() => {
          setDroppedBall(null);
        }, 2000);
      }
    }
  }, [currentIndex, items, assignedNumbers]);

  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={canvasRef}
        width={360}
        height={230}
        className="rounded-xl"
      />
      {/* Dropped ball display */}
      {droppedBall && (
        <div className="mt-4 flex items-center gap-4 bg-gray-800 rounded-xl p-4 animate-bounce-in">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-lg"
            style={{ backgroundColor: droppedBall.color }}
          >
            {droppedBall.name}
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400" />
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-xl font-bold">
            {droppedBall.number}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to get display name for a unit
function getUnitDisplayName(unit, unitSize) {
  // For doubles (unit size 2), use player names
  if (unitSize === 2 && unit.members && unit.members.length > 0) {
    const playerNames = unit.members.map(m => {
      if (m.firstName && m.lastName) {
        return `${m.firstName} ${m.lastName.charAt(0)}.`;
      }
      return m.firstName || m.lastName || 'Player';
    });
    if (playerNames.length >= 2) {
      return `${playerNames[0]} / ${playerNames[1]}`;
    }
    return playerNames[0] || unit.name || `Unit ${unit.id}`;
  }
  // For singles or teams, use unit name
  return unit.name || `Unit ${unit.id}`;
}

export default function DrawingModal({
  isOpen,
  onClose,
  division,
  units = [],
  schedule = null,
  onDraw,
  isDrawing = false
}) {
  const [phase, setPhase] = useState('ready'); // ready, spinning, revealing, complete
  const [drawnAssignments, setDrawnAssignments] = useState([]);
  const [currentDrawIndex, setCurrentDrawIndex] = useState(-1);
  const [showPreview, setShowPreview] = useState(false);
  const [wheelUnits, setWheelUnits] = useState([]);
  const [selectedWheelIndex, setSelectedWheelIndex] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [drawStyle, setDrawStyle] = useState('wheel');
  const [revealedCardIndices, setRevealedCardIndices] = useState([]);
  const [cardAssignments, setCardAssignments] = useState({});
  const [slotSpinning, setSlotSpinning] = useState(false);
  const [currentSlotUnit, setCurrentSlotUnit] = useState(null);
  const [currentSlotNumber, setCurrentSlotNumber] = useState(null);

  // Get unit size from division
  const unitSize = division?.unitSize || 1;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhase('ready');
      setDrawnAssignments([]);
      setCurrentDrawIndex(-1);
      setShowPreview(false);
      setShowConfetti(false);
      setRevealedCardIndices([]);
      setCardAssignments({});
      setSlotSpinning(false);
      setCurrentSlotUnit(null);
      setCurrentSlotNumber(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Get registered units that need to be assigned
  const registeredUnits = units.filter(u => u.status !== 'Cancelled' && u.status !== 'Waitlisted');

  // Get total slots from schedule (target units)
  const totalSlots = schedule?.rounds?.reduce((max, round) => {
    const matchNumbers = round.matches?.flatMap(m => [m.unit1Number, m.unit2Number]).filter(Boolean) || [];
    return Math.max(max, ...matchNumbers, 0);
  }, 0) || 0;

  const emptySlots = totalSlots - registeredUnits.length;
  const alreadyAssigned = registeredUnits.some(u => u.unitNumber != null);

  const handleStartDraw = async () => {
    // Shuffle units to determine random order of selection
    // Slots are assigned sequentially (1, 2, 3...) - the randomness is WHICH unit gets each slot
    const shuffledUnits = [...registeredUnits].sort(() => Math.random() - 0.5);

    // Create assignments: slot 1 goes to first shuffled unit, slot 2 to second, etc.
    const assignments = shuffledUnits.map((unit, idx) => ({
      unit,
      assignedNumber: idx + 1  // Sequential slots: 1, 2, 3, ...
    }));

    // Set up units with display names for animation
    const unitsWithDisplayNames = shuffledUnits.map(u => ({
      ...u,
      displayName: getUnitDisplayName(u, unitSize)
    }));
    setWheelUnits(unitsWithDisplayNames);
    setPhase('spinning');
    setCurrentDrawIndex(0);

    // Different animation timing based on style
    if (drawStyle === 'wheel') {
      // Wheel animation - draw slot 1, then slot 2, etc.
      // Each spin determines which unit gets the current slot
      let remainingForWheel = [...unitsWithDisplayNames];

      for (let i = 0; i < assignments.length; i++) {
        setCurrentDrawIndex(i);
        setWheelUnits(remainingForWheel);

        // Find the unit that was assigned to this slot
        const currentAssignment = assignments[i];
        const wheelIndex = remainingForWheel.findIndex(u => u.id === currentAssignment.unit.id);
        setSelectedWheelIndex(wheelIndex);

        await new Promise(resolve => setTimeout(resolve, i === 0 ? 4500 : 2500));

        // Remove the selected unit from remaining
        remainingForWheel = remainingForWheel.filter(u => u.id !== currentAssignment.unit.id);
        setDrawnAssignments(prev => [...prev, currentAssignment]);
      }
    } else if (drawStyle === 'cards') {
      // Card flip animation - cards represent units, reveal shows their slot number
      const assignmentMap = {};
      // Map by unit index in the shuffled array
      shuffledUnits.forEach((unit, idx) => {
        const originalIdx = unitsWithDisplayNames.findIndex(u => u.id === unit.id);
        assignmentMap[originalIdx] = idx + 1; // Slot number
      });
      setCardAssignments(assignmentMap);

      for (let i = 0; i < assignments.length; i++) {
        setCurrentDrawIndex(i);
        await new Promise(resolve => setTimeout(resolve, 800));
        setRevealedCardIndices(prev => [...prev, i]);
        setDrawnAssignments(prev => [...prev, assignments[i]]);
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    } else if (drawStyle === 'slots') {
      // Slot machine animation - shows "Drawing Slot X" then reveals which unit
      for (let i = 0; i < assignments.length; i++) {
        setCurrentDrawIndex(i);
        const currentAssignment = assignments[i];
        const currentUnit = {
          ...currentAssignment.unit,
          displayName: getUnitDisplayName(currentAssignment.unit, unitSize)
        };
        setCurrentSlotUnit(currentUnit);
        setCurrentSlotNumber(currentAssignment.assignedNumber);
        setSlotSpinning(true);

        await new Promise(resolve => setTimeout(resolve, 2500));
        setSlotSpinning(false);
        setDrawnAssignments(prev => [...prev, currentAssignment]);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } else if (drawStyle === 'lottery') {
      // Lottery ball drop animation
      const assignmentMap = {};
      shuffledUnits.forEach((unit, idx) => {
        const originalIdx = unitsWithDisplayNames.findIndex(u => u.id === unit.id);
        assignmentMap[originalIdx] = idx + 1;
      });
      setCardAssignments(assignmentMap);

      for (let i = 0; i < assignments.length; i++) {
        setCurrentDrawIndex(i);
        await new Promise(resolve => setTimeout(resolve, 2000));
        setDrawnAssignments(prev => [...prev, assignments[i]]);
      }
    }

    // Final assignments are already in slot order (1, 2, 3...)
    setDrawnAssignments(assignments);
    setPhase('complete');
    setShowConfetti(true);
  };

  const handleConfirmDraw = async () => {
    const assignments = drawnAssignments.map(a => ({
      unitId: a.unit.id,
      unitNumber: a.assignedNumber
    }));

    await onDraw(assignments);
  };

  const handleReDraw = () => {
    setPhase('ready');
    setDrawnAssignments([]);
    setCurrentDrawIndex(-1);
    setShowConfetti(false);
    setRevealedCardIndices([]);
    setCardAssignments({});
    setSlotSpinning(false);
    setCurrentSlotUnit(null);
    setCurrentSlotNumber(null);
  };

  // Get matches that would be byes
  const getByeMatches = () => {
    if (!schedule?.rounds) return [];
    const assignedSlots = new Set(drawnAssignments.map(a => a.assignedNumber));
    const byes = [];

    schedule.rounds.forEach(round => {
      round.matches?.forEach(match => {
        const slot1Assigned = assignedSlots.has(match.unit1Number);
        const slot2Assigned = assignedSlots.has(match.unit2Number);

        if (slot1Assigned && !slot2Assigned) {
          const unit = drawnAssignments.find(a => a.assignedNumber === match.unit1Number)?.unit;
          if (unit) byes.push({ unit, round: round.roundName || `Round ${round.roundNumber}` });
        } else if (!slot1Assigned && slot2Assigned) {
          const unit = drawnAssignments.find(a => a.assignedNumber === match.unit2Number)?.unit;
          if (unit) byes.push({ unit, round: round.roundName || `Round ${round.roundNumber}` });
        }
      });
    });

    return byes;
  };

  const byeMatches = phase === 'complete' ? getByeMatches() : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <style>{`
        @keyframes confetti {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti {
          animation: confetti linear forwards;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 2s ease-in-out infinite;
        }
      `}</style>

      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <Confetti active={showConfetti} />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
              <Shuffle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Unit Drawing</h2>
              <p className="text-sm text-gray-400">{division?.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Stats bar */}
          <div className="flex justify-center gap-6 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{registeredUnits.length}</div>
              <div className="text-xs text-gray-400">Teams</div>
            </div>
            <div className="w-px bg-gray-700" />
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{totalSlots}</div>
              <div className="text-xs text-gray-400">Slots</div>
            </div>
            {emptySlots > 0 && (
              <>
                <div className="w-px bg-gray-700" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">{emptySlots}</div>
                  <div className="text-xs text-gray-400">Byes</div>
                </div>
              </>
            )}
          </div>

          {/* Ready state */}
          {phase === 'ready' && (
            <div className="text-center py-8">
              <div className="w-32 h-32 mx-auto mb-6 relative animate-float">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-red-500 rounded-full opacity-20 animate-ping" />
                <div className="relative w-full h-full bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center">
                  <Sparkles className="w-12 h-12 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Ready to Draw!</h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                Randomly assign {registeredUnits.length} {unitSize === 2 ? 'doubles teams' : unitSize === 1 ? 'players' : 'teams'} to their bracket positions.
                {emptySlots > 0 && ` ${emptySlots} slot${emptySlots !== 1 ? 's' : ''} will be byes.`}
              </p>

              {/* Draw Style Selector */}
              <div className="mb-6 max-w-lg mx-auto">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Choose Draw Style</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DRAW_STYLES.map((style) => {
                    const Icon = style.icon;
                    const isSelected = drawStyle === style.id;
                    return (
                      <button
                        key={style.id}
                        onClick={() => setDrawStyle(style.id)}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          isSelected
                            ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                            : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                        }`}
                      >
                        <Icon className={`w-6 h-6 mx-auto mb-1 ${isSelected ? 'text-orange-400' : ''}`} />
                        <div className="text-xs font-medium">{style.name}</div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {DRAW_STYLES.find(s => s.id === drawStyle)?.description}
                </p>
              </div>

              {/* Instructions */}
              <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-4 mb-6 max-w-lg mx-auto text-left">
                <h4 className="text-sm font-semibold text-orange-400 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  How It Works
                </h4>
                <ol className="text-sm text-gray-300 space-y-2">
                  <li className="flex gap-2">
                    <span className="text-orange-400 font-bold">1.</span>
                    <span>Click "Start Drawing" to begin the random draw process.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-orange-400 font-bold">2.</span>
                    <span>Watch as each {unitSize === 2 ? 'team' : unitSize === 1 ? 'player' : 'unit'}'s bracket position is revealed.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-orange-400 font-bold">3.</span>
                    <span>Once complete, review the assignments and click "Confirm & Save" to finalize.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-orange-400 font-bold">4.</span>
                    <span>Not happy? Click "Re-Draw" to start over with a fresh random draw.</span>
                  </li>
                </ol>
              </div>

              {alreadyAssigned && (
                <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6 max-w-md mx-auto">
                  <div className="flex items-center gap-2 text-yellow-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Some units already have positions. This will reassign all.
                  </div>
                </div>
              )}

              <button
                onClick={handleStartDraw}
                disabled={isDrawing || registeredUnits.length === 0}
                className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold text-lg hover:from-orange-600 hover:to-red-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95 inline-flex items-center gap-3 shadow-lg shadow-orange-500/30"
              >
                <Play className="w-6 h-6" />
                Start Drawing
              </button>
            </div>
          )}

          {/* Spinning state */}
          {phase === 'spinning' && (
            <div className="text-center py-4">
              {/* Wheel Animation */}
              {drawStyle === 'wheel' && wheelUnits.length > 0 && (
                <div className="flex justify-center mb-4">
                  <SpinningWheel
                    items={wheelUnits}
                    isSpinning={true}
                    selectedIndex={selectedWheelIndex}
                    size={280}
                  />
                </div>
              )}

              {/* Card Flip Animation */}
              {drawStyle === 'cards' && (
                <div className="mb-4">
                  <CardFlipDraw
                    items={wheelUnits}
                    currentIndex={currentDrawIndex}
                    revealedIndices={revealedCardIndices}
                    assignedNumbers={cardAssignments}
                  />
                </div>
              )}

              {/* Slot Machine Animation */}
              {drawStyle === 'slots' && (
                <div className="flex justify-center mb-4">
                  <SlotMachineDraw
                    currentUnit={currentSlotUnit}
                    assignedNumber={currentSlotNumber}
                    isSpinning={slotSpinning}
                  />
                </div>
              )}

              {/* Lottery Ball Drop Animation */}
              {drawStyle === 'lottery' && (
                <div className="flex justify-center mb-4">
                  <LotteryDraw
                    items={wheelUnits}
                    currentIndex={currentDrawIndex}
                    revealedItems={drawnAssignments}
                    assignedNumbers={cardAssignments}
                  />
                </div>
              )}

              <div className="bg-gray-800 rounded-xl p-4 max-w-sm mx-auto">
                <div className="text-sm text-gray-400 mb-2">Drawing for Slot {currentDrawIndex + 1} of {registeredUnits.length}</div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentDrawIndex + 1) / registeredUnits.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Live assignments */}
              {drawnAssignments.length > 0 && (
                <div className="mt-4 max-h-32 overflow-y-auto">
                  <div className="flex flex-wrap justify-center gap-2">
                    {drawnAssignments.map((a, idx) => (
                      <div
                        key={idx}
                        className="bg-gray-800 rounded-lg px-3 py-2 flex items-center gap-2 animate-fade-in"
                      >
                        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-sm font-bold">
                          {a.assignedNumber}
                        </span>
                        <span className="text-white text-sm">{getUnitDisplayName(a.unit, unitSize).substring(0, 15)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Complete state */}
          {phase === 'complete' && (
            <div>
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-full text-green-400">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">Drawing Complete!</span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white">Final Assignments</h3>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1"
                >
                  {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showPreview ? 'Hide' : 'Show'} Preview
                </button>
              </div>

              <div className="bg-gray-800/50 rounded-xl border border-gray-700 divide-y divide-gray-700 max-h-64 overflow-y-auto mb-4">
                {Array.from({ length: totalSlots }, (_, i) => i + 1).map(slotNum => {
                  const assignment = drawnAssignments.find(a => a.assignedNumber === slotNum);

                  return (
                    <div
                      key={slotNum}
                      className={`flex items-center justify-between p-3 ${
                        assignment ? 'hover:bg-gray-700/50' : 'bg-gray-800/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${
                          assignment
                            ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white'
                            : 'bg-gray-700 text-gray-500'
                        }`}>
                          {slotNum}
                        </div>
                        {assignment ? (
                          <div>
                            <div className="font-medium text-white">
                              {getUnitDisplayName(assignment.unit, unitSize)}
                            </div>
                            {unitSize !== 2 && assignment.unit.members && assignment.unit.members.length > 0 && (
                              <div className="text-sm text-gray-400">
                                {assignment.unit.members.map(m =>
                                  m.lastName && m.firstName ? `${m.lastName}, ${m.firstName}` : (m.lastName || m.firstName || 'Player')
                                ).join(' & ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-500 italic">Empty slot (bye)</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Byes info */}
              {byeMatches.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-yellow-400 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    First Round Byes ({byeMatches.length})
                  </h4>
                  <div className="space-y-1 text-sm text-yellow-300/80">
                    {byeMatches.slice(0, 3).map((bye, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="font-medium">{getUnitDisplayName(bye.unit, unitSize)}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span>advances in {bye.round}</span>
                      </div>
                    ))}
                    {byeMatches.length > 3 && (
                      <div className="text-yellow-500">... and {byeMatches.length - 3} more</div>
                    )}
                  </div>
                </div>
              )}

              {/* Schedule preview */}
              {showPreview && schedule?.rounds && (
                <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden mb-4">
                  <div className="bg-gray-700/50 px-4 py-2 font-medium text-gray-300 border-b border-gray-700">
                    Schedule Preview
                  </div>
                  <div className="divide-y divide-gray-700 max-h-48 overflow-y-auto">
                    {schedule.rounds.slice(0, 2).map((round, roundIdx) => (
                      <div key={roundIdx} className="p-3">
                        <div className="text-sm font-medium text-gray-400 mb-2">
                          {round.roundName || `Round ${round.roundNumber}`}
                        </div>
                        <div className="space-y-2">
                          {round.matches?.slice(0, 4).map((match, matchIdx) => {
                            const unit1 = drawnAssignments.find(a => a.assignedNumber === match.unit1Number)?.unit;
                            const unit2 = drawnAssignments.find(a => a.assignedNumber === match.unit2Number)?.unit;

                            return (
                              <div key={matchIdx} className="flex items-center justify-between text-sm bg-gray-700/50 rounded px-3 py-2">
                                <span className={unit1 ? 'text-white' : 'text-gray-500 italic'}>
                                  {unit1 ? getUnitDisplayName(unit1, unitSize) : 'BYE'}
                                </span>
                                <span className="text-gray-500 text-xs">vs</span>
                                <span className={unit2 ? 'text-white' : 'text-gray-500 italic'}>
                                  {unit2 ? getUnitDisplayName(unit2, unitSize) : 'BYE'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-gray-700 bg-gray-800/50">
          {phase === 'complete' ? (
            <>
              <button
                onClick={handleConfirmDraw}
                disabled={isDrawing}
                className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold hover:from-green-600 hover:to-emerald-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/30"
              >
                {isDrawing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Confirm & Save
                  </>
                )}
              </button>
              <button
                onClick={handleReDraw}
                disabled={isDrawing}
                className="px-5 py-3 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Re-Draw
              </button>
            </>
          ) : phase === 'ready' ? (
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          ) : (
            <div className="flex-1 py-3 text-center text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
              Drawing in progress...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
