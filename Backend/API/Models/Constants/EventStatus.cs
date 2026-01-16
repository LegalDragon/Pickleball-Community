namespace Pickleball.Community.Models.Constants;

/// <summary>
/// Tournament status values for Event.TournamentStatus
/// </summary>
public static class TournamentStatus
{
    public const string Draft = "Draft";
    public const string RegistrationOpen = "RegistrationOpen";
    public const string RegistrationClosed = "RegistrationClosed";
    public const string ScheduleReady = "ScheduleReady";
    public const string Drawing = "Drawing";
    public const string Running = "Running";
    public const string Completed = "Completed";
    public const string Cancelled = "Cancelled";

    public static readonly string[] All = new[]
    {
        Draft,
        RegistrationOpen,
        RegistrationClosed,
        ScheduleReady,
        Drawing,
        Running,
        Completed,
        Cancelled
    };
}

/// <summary>
/// Schedule status values for EventDivision.ScheduleStatus
/// </summary>
public static class ScheduleStatus
{
    public const string NotGenerated = "NotGenerated";
    public const string TemplateReady = "TemplateReady";
    public const string UnitsAssigned = "UnitsAssigned";
    public const string Finalized = "Finalized";

    public static readonly string[] All = new[]
    {
        NotGenerated,
        TemplateReady,
        UnitsAssigned,
        Finalized
    };
}

/// <summary>
/// Status values for EventUnit.Status
/// </summary>
public static class UnitStatus
{
    public const string Registered = "Registered";
    public const string CheckedIn = "CheckedIn";
    public const string Withdrawn = "Withdrawn";
    public const string Cancelled = "Cancelled";
    public const string Waitlisted = "Waitlisted";

    public static readonly string[] All = new[]
    {
        Registered,
        CheckedIn,
        Withdrawn,
        Cancelled,
        Waitlisted
    };

    public static readonly string[] Active = new[] { Registered, CheckedIn };
    public static readonly string[] Inactive = new[] { Withdrawn, Cancelled, Waitlisted };
}

/// <summary>
/// Status values for EventMatch.Status
/// </summary>
public static class MatchStatus
{
    public const string Pending = "Pending";
    public const string Ready = "Ready";
    public const string Queued = "Queued";
    public const string InProgress = "InProgress";
    public const string Completed = "Completed";
    public const string Cancelled = "Cancelled";
    public const string Bye = "Bye";

    public static readonly string[] All = new[]
    {
        Pending,
        Ready,
        Queued,
        InProgress,
        Completed,
        Cancelled,
        Bye
    };

    public static readonly string[] Active = new[] { Pending, Ready, Queued, InProgress };
    public static readonly string[] Finished = new[] { Completed, Cancelled, Bye };
}

/// <summary>
/// Status values for EventGame.Status
/// </summary>
public static class GameStatus
{
    public const string New = "New";
    public const string Ready = "Ready";
    public const string Queued = "Queued";
    public const string Started = "Started";
    public const string Playing = "Playing";
    public const string Finished = "Finished";

    public static readonly string[] All = new[]
    {
        New,
        Ready,
        Queued,
        Started,
        Playing,
        Finished
    };

    public static readonly string[] Active = new[] { New, Ready, Queued, Started, Playing };
}

/// <summary>
/// Invite status values for EventUnitMember.InviteStatus
/// </summary>
public static class InviteStatus
{
    public const string Pending = "Pending";
    public const string Accepted = "Accepted";
    public const string Declined = "Declined";
    public const string Cancelled = "Cancelled";

    public static readonly string[] All = new[]
    {
        Pending,
        Accepted,
        Declined,
        Cancelled
    };
}

/// <summary>
/// Payment status values for EventRegistration.PaymentStatus
/// </summary>
public static class PaymentStatus
{
    public const string Pending = "Pending";
    public const string Paid = "Paid";
    public const string Refunded = "Refunded";
    public const string Waived = "Waived";

    public static readonly string[] All = new[]
    {
        Pending,
        Paid,
        Refunded,
        Waived
    };
}

/// <summary>
/// Round type values for EventMatch.RoundType
/// </summary>
public static class RoundType
{
    public const string Pool = "Pool";
    public const string Bracket = "Bracket";
    public const string Final = "Final";
    public const string Consolation = "Consolation";
    public const string ThirdPlace = "ThirdPlace";

    public static readonly string[] All = new[]
    {
        Pool,
        Bracket,
        Final,
        Consolation,
        ThirdPlace
    };
}

/// <summary>
/// Schedule type values for EventDivision.ScheduleType
/// </summary>
public static class ScheduleType
{
    public const string RoundRobin = "RoundRobin";
    public const string RoundRobinPlayoff = "RoundRobinPlayoff";
    public const string SingleElimination = "SingleElimination";
    public const string DoubleElimination = "DoubleElimination";
    public const string Hybrid = "Hybrid";
    public const string RandomPairing = "RandomPairing";

    public static readonly string[] All = new[]
    {
        RoundRobin,
        RoundRobinPlayoff,
        SingleElimination,
        DoubleElimination,
        Hybrid,
        RandomPairing
    };
}

/// <summary>
/// Court status values for TournamentCourt.Status
/// </summary>
public static class CourtStatus
{
    public const string Available = "Available";
    public const string InUse = "InUse";
    public const string Maintenance = "Maintenance";
    public const string Closed = "Closed";

    public static readonly string[] All = new[]
    {
        Available,
        InUse,
        Maintenance,
        Closed
    };
}
