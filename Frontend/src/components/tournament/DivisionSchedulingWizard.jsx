import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Settings, Clock, ChevronRight, ChevronLeft,
  Check, Lock, Loader2, AlertCircle, ListOrdered, Grid3X3, Timer
} from 'lucide-react';
import { tournamentApi, encounterApi } from '../../services/api';
import PhaseManager from './PhaseManager';
import SchedulePreview from './SchedulePreview';
import GameFormatConfig from './GameFormatConfig';
import PhaseCourtScheduler from './PhaseCourtScheduler';

const STEPS = [
  {
    id: 'phases',
    title: 'Phase Schedule',
    shortTitle: 'Phases',
    icon: ListOrdered,
    description: 'Create phases and generate encounters'
  },
  {
    id: 'formats',
    title: 'Game Formats',
    shortTitle: 'Games',
    icon: Grid3X3,
    description: 'Configure games per phase/match'
  },
  {
    id: 'courts',
    title: 'Court & Time',
    shortTitle: 'Courts',
    icon: Timer,
    description: 'Assign courts and schedule times'
  }
];

/**
 * DivisionSchedulingWizard - Three-step wizard for complete division scheduling
 * 
 * Step 1: Phase Schedule - Create phases, generate encounters with sequence numbers
 * Step 2: Game Formats - Configure games per phase/match combination
 * Step 3: Court/Time Scheduling - Assign courts and times to encounters
 * 
 * Each step unlocks the next when completed.
 */
export default function DivisionSchedulingWizard({ 
  divisionId, 
  eventId, 
  onClose,
  initialStep = 0 
}) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [division, setDivision] = useState(null);
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Step completion status
  const [stepStatus, setStepStatus] = useState({
    phases: { complete: false, encounterCount: 0 },
    formats: { complete: false, configuredCount: 0 },
    courts: { complete: false, assignedCount: 0 }
  });

  // Load division and phases
  useEffect(() => {
    if (divisionId) {
      loadDivisionData();
    }
  }, [divisionId]);

  const loadDivisionData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load division details and phases in parallel
      const [configRes, phasesRes] = await Promise.all([
        encounterApi.getDivisionConfig(divisionId),
        tournamentApi.getDivisionPhases(divisionId)
      ]);

      if (configRes.success) {
        setDivision(configRes.data);
      }

      if (phasesRes.success) {
        setPhases(phasesRes.data || []);
        updateStepStatus(phasesRes.data || []);
      }
    } catch (err) {
      console.error('Error loading division data:', err);
      setError('Failed to load division data');
    } finally {
      setLoading(false);
    }
  }, [divisionId]);

  const updateStepStatus = useCallback(async (phasesData) => {
    // Check phase schedule completion
    const totalEncounters = phasesData.reduce((sum, p) => sum + (p.encounterCount || 0), 0);
    const phasesComplete = phasesData.length > 0 && totalEncounters > 0;

    // Check game formats completion (if phases are complete)
    let formatsComplete = false;
    let configuredCount = 0;
    if (phasesComplete) {
      try {
        const settingsRes = await encounterApi.getDivisionGameSettings(divisionId);
        if (settingsRes.success && settingsRes.data) {
          const { phases: phaseSettings } = settingsRes.data;
          configuredCount = phaseSettings?.reduce((sum, p) => sum + (p.matchSettings?.length || 0), 0) || 0;
          // Consider formats complete if at least one phase has settings OR division has no match formats
          formatsComplete = configuredCount > 0 || (division?.matchesPerEncounter || 1) <= 1;
        }
      } catch (err) {
        console.error('Error checking game format status:', err);
      }
    }

    // Check court assignment completion
    let courtsComplete = false;
    let assignedCount = 0;
    if (formatsComplete) {
      try {
        // Check how many encounters have court/time assignments
        for (const phase of phasesData) {
          const scheduleRes = await tournamentApi.getPhaseSchedule(phase.id);
          if (scheduleRes.success && scheduleRes.data?.encounters) {
            const assigned = scheduleRes.data.encounters.filter(e => e.courtId || e.scheduledTime).length;
            assignedCount += assigned;
          }
        }
        courtsComplete = assignedCount > 0 && assignedCount >= totalEncounters * 0.5; // At least 50% assigned
      } catch (err) {
        console.error('Error checking court assignment status:', err);
      }
    }

    setStepStatus({
      phases: { complete: phasesComplete, encounterCount: totalEncounters },
      formats: { complete: formatsComplete, configuredCount },
      courts: { complete: courtsComplete, assignedCount }
    });
  }, [divisionId, division]);

  const handlePhasesUpdated = useCallback(() => {
    loadDivisionData();
  }, [loadDivisionData]);

  const handleFormatsUpdated = useCallback(() => {
    loadDivisionData();
  }, [loadDivisionData]);

  const handleCourtsUpdated = useCallback(() => {
    loadDivisionData();
  }, [loadDivisionData]);

  const canAccessStep = (stepIndex) => {
    if (stepIndex === 0) return true;
    if (stepIndex === 1) return stepStatus.phases.complete;
    if (stepIndex === 2) return stepStatus.phases.complete && stepStatus.formats.complete;
    return false;
  };

  const goToStep = (stepIndex) => {
    if (canAccessStep(stepIndex)) {
      setCurrentStep(stepIndex);
    }
  };

  const goNext = () => {
    if (currentStep < STEPS.length - 1 && canAccessStep(currentStep + 1)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto mb-3" />
          <p className="text-gray-500">Loading division...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 font-medium mb-2">Error</p>
          <p className="text-gray-500">{error}</p>
          <button
            onClick={loadDivisionData}
            className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[600px] flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Schedule: {division?.divisionName || division?.name}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Division Scheduling Wizard
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          )}
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center mt-6 mb-2">
          {STEPS.map((step, idx) => {
            const StepIcon = step.icon;
            const isActive = currentStep === idx;
            const isComplete = idx === 0 ? stepStatus.phases.complete :
                               idx === 1 ? stepStatus.formats.complete :
                               stepStatus.courts.complete;
            const isAccessible = canAccessStep(idx);

            return (
              <div key={step.id} className="flex items-center">
                {/* Step Circle */}
                <button
                  onClick={() => goToStep(idx)}
                  disabled={!isAccessible}
                  className={`
                    relative flex items-center justify-center w-12 h-12 rounded-full
                    transition-all duration-200
                    ${isActive 
                      ? 'bg-orange-600 text-white shadow-lg ring-4 ring-orange-100' 
                      : isComplete 
                        ? 'bg-green-500 text-white' 
                        : isAccessible
                          ? 'bg-gray-200 text-gray-600 hover:bg-gray-300 cursor-pointer'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }
                  `}
                  title={step.title}
                >
                  {isComplete && !isActive ? (
                    <Check className="w-5 h-5" />
                  ) : !isAccessible && idx > 0 ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <StepIcon className="w-5 h-5" />
                  )}
                </button>

                {/* Step Label */}
                <div className={`ml-3 ${idx < STEPS.length - 1 ? 'mr-8' : ''}`}>
                  <p className={`text-sm font-medium ${isActive ? 'text-orange-600' : 'text-gray-700'}`}>
                    {step.shortTitle}
                  </p>
                  {isActive && (
                    <p className="text-xs text-gray-500 hidden sm:block">
                      {step.description}
                    </p>
                  )}
                </div>

                {/* Connector Line */}
                {idx < STEPS.length - 1 && (
                  <div className={`hidden sm:block w-16 h-0.5 ${
                    isComplete ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-auto">
        {currentStep === 0 && (
          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Step 1: Phase Schedule
              </h3>
              <p className="text-gray-600">
                Create tournament phases (Pool Play, Semifinals, Finals) and generate the encounter schedule.
                Each encounter will get a sequence number for easy reference.
              </p>
            </div>

            {/* Status Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <ListOrdered className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">
                    {stepStatus.phases.encounterCount > 0 
                      ? `${stepStatus.phases.encounterCount} encounters generated`
                      : 'No encounters yet'
                    }
                  </p>
                  <p className="text-sm text-blue-700">
                    {phases.length} phase{phases.length !== 1 ? 's' : ''} configured
                  </p>
                </div>
                {stepStatus.phases.complete && (
                  <Check className="w-5 h-5 text-green-600 ml-auto" />
                )}
              </div>
            </div>

            {/* Phase Manager */}
            <div className="border border-gray-200 rounded-lg">
              <PhaseManager
                divisionId={divisionId}
                eventId={eventId}
                unitCount={division?.registeredUnitCount || 8}
                onPhasesUpdated={handlePhasesUpdated}
              />
            </div>

            {/* Schedule Preview */}
            {stepStatus.phases.encounterCount > 0 && (
              <div className="mt-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">Schedule Preview</h4>
                <div className="border border-gray-200 rounded-lg">
                  <SchedulePreview divisionId={divisionId} showFilters={true} />
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 1 && (
          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Step 2: Game Formats
              </h3>
              <p className="text-gray-600">
                Configure how many games are played per match and what scoring format to use.
                {division?.matchesPerEncounter > 1 && (
                  <span className="block mt-1">
                    This division has <strong>{division.matchesPerEncounter} matches per encounter</strong> (e.g., MD, WD, XD).
                  </span>
                )}
              </p>
            </div>

            <GameFormatConfig
              divisionId={divisionId}
              phases={phases}
              matchesPerEncounter={division?.matchesPerEncounter || 1}
              onUpdated={handleFormatsUpdated}
            />
          </div>
        )}

        {currentStep === 2 && (
          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Step 3: Court & Time Scheduling
              </h3>
              <p className="text-gray-600">
                Assign encounters to courts and time slots. Drag and drop to arrange the schedule.
              </p>
            </div>

            <PhaseCourtScheduler
              eventId={eventId}
              divisionId={divisionId}
              phases={phases}
              onUpdated={handleCourtsUpdated}
            />
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={currentStep === 0}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
            ${currentStep === 0
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-700 hover:bg-gray-200'
            }
          `}
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          Step {currentStep + 1} of {STEPS.length}
        </div>

        {currentStep < STEPS.length - 1 ? (
          <button
            onClick={goNext}
            disabled={!canAccessStep(currentStep + 1)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
              ${canAccessStep(currentStep + 1)
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            <Check className="w-4 h-4" />
            Complete
          </button>
        )}
      </div>
    </div>
  );
}
