/**
 * Event-related status constants
 * Keep in sync with Backend/API/Models/Constants/EventStatus.cs
 */

/**
 * Tournament status values for Event.TournamentStatus
 */
export const TournamentStatus = {
  DRAFT: 'Draft',
  REGISTRATION_OPEN: 'RegistrationOpen',
  REGISTRATION_CLOSED: 'RegistrationClosed',
  SCHEDULE_READY: 'ScheduleReady',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const TournamentStatusAll = Object.values(TournamentStatus);

/**
 * Schedule status values for EventDivision.ScheduleStatus
 */
export const ScheduleStatus = {
  NOT_GENERATED: 'NotGenerated',
  TEMPLATE_READY: 'TemplateReady',
  UNITS_ASSIGNED: 'UnitsAssigned',
  FINALIZED: 'Finalized',
};

export const ScheduleStatusAll = Object.values(ScheduleStatus);

/**
 * Status values for EventUnit.Status
 */
export const UnitStatus = {
  REGISTERED: 'Registered',
  CHECKED_IN: 'CheckedIn',
  WITHDRAWN: 'Withdrawn',
  CANCELLED: 'Cancelled',
  WAITLISTED: 'Waitlisted',
};

export const UnitStatusAll = Object.values(UnitStatus);
export const UnitStatusActive = [UnitStatus.REGISTERED, UnitStatus.CHECKED_IN];
export const UnitStatusInactive = [UnitStatus.WITHDRAWN, UnitStatus.CANCELLED, UnitStatus.WAITLISTED];

/**
 * Status values for EventMatch.Status
 */
export const MatchStatus = {
  PENDING: 'Pending',
  READY: 'Ready',
  QUEUED: 'Queued',
  IN_PROGRESS: 'InProgress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  BYE: 'Bye',
};

export const MatchStatusAll = Object.values(MatchStatus);
export const MatchStatusActive = [MatchStatus.PENDING, MatchStatus.READY, MatchStatus.QUEUED, MatchStatus.IN_PROGRESS];
export const MatchStatusFinished = [MatchStatus.COMPLETED, MatchStatus.CANCELLED, MatchStatus.BYE];

/**
 * Status values for EventGame.Status
 */
export const GameStatus = {
  NEW: 'New',
  READY: 'Ready',
  QUEUED: 'Queued',
  STARTED: 'Started',
  PLAYING: 'Playing',
  FINISHED: 'Finished',
};

export const GameStatusAll = Object.values(GameStatus);
export const GameStatusActive = [GameStatus.NEW, GameStatus.READY, GameStatus.QUEUED, GameStatus.STARTED, GameStatus.PLAYING];

/**
 * Invite status values for EventUnitMember.InviteStatus
 */
export const InviteStatus = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
};

export const InviteStatusAll = Object.values(InviteStatus);

/**
 * Payment status values for EventRegistration.PaymentStatus
 */
export const PaymentStatus = {
  PENDING: 'Pending',
  PAID: 'Paid',
  REFUNDED: 'Refunded',
  WAIVED: 'Waived',
};

export const PaymentStatusAll = Object.values(PaymentStatus);

/**
 * Round type values for EventMatch.RoundType
 */
export const RoundType = {
  POOL: 'Pool',
  BRACKET: 'Bracket',
  FINAL: 'Final',
  CONSOLATION: 'Consolation',
  THIRD_PLACE: 'ThirdPlace',
};

export const RoundTypeAll = Object.values(RoundType);

/**
 * Schedule type values for EventDivision.ScheduleType
 */
export const ScheduleType = {
  ROUND_ROBIN: 'RoundRobin',
  ROUND_ROBIN_PLAYOFF: 'RoundRobinPlayoff',
  SINGLE_ELIMINATION: 'SingleElimination',
  DOUBLE_ELIMINATION: 'DoubleElimination',
  HYBRID: 'Hybrid',
  RANDOM_PAIRING: 'RandomPairing',
};

export const ScheduleTypeAll = Object.values(ScheduleType);

/**
 * Court status values for TournamentCourt.Status
 */
export const CourtStatus = {
  AVAILABLE: 'Available',
  IN_USE: 'InUse',
  MAINTENANCE: 'Maintenance',
  CLOSED: 'Closed',
};

export const CourtStatusAll = Object.values(CourtStatus);

/**
 * Score change types for audit trail
 */
export const ScoreChangeType = {
  SCORE_SUBMITTED: 'ScoreSubmitted',
  SCORE_CONFIRMED: 'ScoreConfirmed',
  SCORE_DISPUTED: 'ScoreDisputed',
  SCORE_EDITED: 'ScoreEdited',
  SCORE_RESET: 'ScoreReset',
  ADMIN_OVERRIDE: 'AdminOverride',
};

export const ScoreChangeTypeAll = Object.values(ScoreChangeType);

/**
 * Helper functions for status display
 */
export const getStatusColor = (status) => {
  const colors = {
    // Tournament status
    [TournamentStatus.DRAFT]: 'gray',
    [TournamentStatus.REGISTRATION_OPEN]: 'green',
    [TournamentStatus.REGISTRATION_CLOSED]: 'yellow',
    [TournamentStatus.SCHEDULE_READY]: 'blue',
    [TournamentStatus.RUNNING]: 'indigo',
    [TournamentStatus.COMPLETED]: 'gray',
    [TournamentStatus.CANCELLED]: 'red',

    // Unit status
    [UnitStatus.REGISTERED]: 'blue',
    [UnitStatus.CHECKED_IN]: 'green',
    [UnitStatus.WITHDRAWN]: 'gray',
    [UnitStatus.CANCELLED]: 'red',
    [UnitStatus.WAITLISTED]: 'yellow',

    // Match status
    [MatchStatus.PENDING]: 'gray',
    [MatchStatus.READY]: 'yellow',
    [MatchStatus.QUEUED]: 'blue',
    [MatchStatus.IN_PROGRESS]: 'green',
    [MatchStatus.COMPLETED]: 'gray',
    [MatchStatus.CANCELLED]: 'red',
    [MatchStatus.BYE]: 'gray',

    // Game status
    [GameStatus.NEW]: 'gray',
    [GameStatus.READY]: 'yellow',
    [GameStatus.QUEUED]: 'blue',
    [GameStatus.STARTED]: 'indigo',
    [GameStatus.PLAYING]: 'green',
    [GameStatus.FINISHED]: 'gray',
  };
  return colors[status] || 'gray';
};

export const getStatusLabel = (status) => {
  const labels = {
    // Tournament status
    [TournamentStatus.DRAFT]: 'Draft',
    [TournamentStatus.REGISTRATION_OPEN]: 'Registration Open',
    [TournamentStatus.REGISTRATION_CLOSED]: 'Registration Closed',
    [TournamentStatus.SCHEDULE_READY]: 'Schedule Ready',
    [TournamentStatus.RUNNING]: 'Running',
    [TournamentStatus.COMPLETED]: 'Completed',
    [TournamentStatus.CANCELLED]: 'Cancelled',

    // Unit status
    [UnitStatus.REGISTERED]: 'Registered',
    [UnitStatus.CHECKED_IN]: 'Checked In',
    [UnitStatus.WITHDRAWN]: 'Withdrawn',
    [UnitStatus.CANCELLED]: 'Cancelled',
    [UnitStatus.WAITLISTED]: 'Waitlisted',

    // Match status
    [MatchStatus.PENDING]: 'Pending',
    [MatchStatus.READY]: 'Ready',
    [MatchStatus.QUEUED]: 'Queued',
    [MatchStatus.IN_PROGRESS]: 'In Progress',
    [MatchStatus.COMPLETED]: 'Completed',
    [MatchStatus.CANCELLED]: 'Cancelled',
    [MatchStatus.BYE]: 'Bye',

    // Game status
    [GameStatus.NEW]: 'New',
    [GameStatus.READY]: 'Ready',
    [GameStatus.QUEUED]: 'Queued',
    [GameStatus.STARTED]: 'Started',
    [GameStatus.PLAYING]: 'Playing',
    [GameStatus.FINISHED]: 'Finished',
  };
  return labels[status] || status;
};
