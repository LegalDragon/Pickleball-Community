using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Pickleball.College.Services;
using Pickleball.College.Models.DTOs;
using Pickleball.College.Models.Entities;

namespace Pickleball.College.API.Controllers;

[ApiController]
[Route("[controller]")]
public class SessionsController : ControllerBase
{
    private readonly ISessionService _sessionService;

    public SessionsController(ISessionService sessionService)
    {
        _sessionService = sessionService;
    }

    /// <summary>
    /// Student requests a session with a coach (pending confirmation)
    /// </summary>
    [HttpPost("request")]
    [Authorize]
    public async Task<ActionResult> RequestSession([FromBody] CreateSessionRequest request)
    {
        var studentId = GetUserId();
        if (studentId == null) return Unauthorized();

        try
        {
            var session = await _sessionService.RequestSessionAsync(request, studentId.Value);
            return Ok(MapToDto(session));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Coach confirms a pending session request
    /// </summary>
    [HttpPost("{sessionId}/confirm")]
    [Authorize]
    public async Task<ActionResult> ConfirmSession(int sessionId, [FromBody] ConfirmSessionRequest request)
    {
        var coachId = GetUserId();
        if (coachId == null) return Unauthorized();

        request.SessionId = sessionId;

        try
        {
            var session = await _sessionService.ConfirmSessionAsync(request, coachId.Value);
            return Ok(MapToDto(session));
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Get pending session requests for a coach
    /// </summary>
    [HttpGet("pending")]
    [Authorize]
    public async Task<ActionResult> GetPendingSessions()
    {
        var coachId = GetUserId();
        if (coachId == null) return Unauthorized();

        var sessions = await _sessionService.GetPendingSessionsAsync(coachId.Value);
        return Ok(sessions.Select(MapToDto).ToList());
    }

    [HttpPost]
    [Authorize]
    public async Task<ActionResult> ScheduleSession(SessionRequest request)
    {
        var studentId = GetUserId();
        if (studentId == null) return Unauthorized();

        try
        {
            var session = await _sessionService.ScheduleSessionAsync(request, studentId.Value);
            return Ok(MapToDto(session));
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to schedule session: {ex.Message}");
        }
    }

    [HttpGet("coach/{coachId}")]
    [Authorize]
    public async Task<ActionResult> GetCoachSessions(int coachId)
    {
        var sessions = await _sessionService.GetCoachSessionsAsync(coachId);
        return Ok(sessions.Select(MapToDto).ToList());
    }

    [HttpGet("student")]
    [Authorize]
    public async Task<ActionResult> GetStudentSessions()
    {
        var studentId = GetUserId();
        if (studentId == null) return Unauthorized();

        var sessions = await _sessionService.GetStudentSessionsAsync(studentId.Value);
        return Ok(sessions.Select(MapToDto).ToList());
    }

    [HttpDelete("{sessionId}")]
    [Authorize]
    public async Task<ActionResult> CancelSession(int sessionId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var result = await _sessionService.CancelSessionAsync(sessionId, userId.Value);
        if (!result)
        {
            return NotFound("Session not found or you don't have permission to cancel it");
        }

        return Ok(new { Message = "Session cancelled successfully" });
    }

    /// <summary>
    /// Coach proposes changes to a pending session request
    /// </summary>
    [HttpPost("{sessionId}/propose")]
    [Authorize]
    public async Task<ActionResult> ProposeSessionChanges(int sessionId, [FromBody] SessionProposalRequest proposal)
    {
        var coachId = GetUserId();
        if (coachId == null) return Unauthorized();

        try
        {
            var session = await _sessionService.ProposeSessionChangesAsync(sessionId, coachId.Value, proposal);
            return Ok(MapToDto(session));
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Student accepts a coach's session proposal
    /// </summary>
    [HttpPost("{sessionId}/accept-proposal")]
    [Authorize]
    public async Task<ActionResult> AcceptSessionProposal(int sessionId)
    {
        var studentId = GetUserId();
        if (studentId == null) return Unauthorized();

        try
        {
            var session = await _sessionService.AcceptSessionProposalAsync(sessionId, studentId.Value);
            return Ok(MapToDto(session));
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Student declines a coach's session proposal
    /// </summary>
    [HttpPost("{sessionId}/decline-proposal")]
    [Authorize]
    public async Task<ActionResult> DeclineSessionProposal(int sessionId)
    {
        var studentId = GetUserId();
        if (studentId == null) return Unauthorized();

        try
        {
            var session = await _sessionService.DeclineSessionProposalAsync(sessionId, studentId.Value);
            return Ok(MapToDto(session));
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Get sessions with pending proposals for the student
    /// </summary>
    [HttpGet("proposals")]
    [Authorize]
    public async Task<ActionResult> GetSessionsWithProposals()
    {
        var studentId = GetUserId();
        if (studentId == null) return Unauthorized();

        var sessions = await _sessionService.GetSessionsWithProposalsAsync(studentId.Value);
        return Ok(sessions.Select(MapToDto).ToList());
    }

    private static SessionRequestDto MapToDto(TrainingSession session)
    {
        return new SessionRequestDto
        {
            Id = session.Id,
            CoachId = session.CoachId,
            CoachName = session.Coach != null ? $"{session.Coach.FirstName} {session.Coach.LastName}" : "Unknown",
            CoachAvatar = session.Coach?.ProfileImageUrl,
            StudentId = session.StudentId,
            StudentName = session.Student != null ? $"{session.Student.FirstName} {session.Student.LastName}" : "Unknown",
            SessionType = session.SessionType ?? "Online",
            RequestedAt = session.RequestedAt ?? session.ScheduledAt,
            DurationMinutes = session.DurationMinutes,
            Price = session.Price,
            Status = session.Status,
            MeetingLink = session.MeetingLink,
            Location = session.Location,
            Notes = session.Notes,
            CreatedAt = session.CreatedAt,
            // Proposal fields
            ProposedScheduledAt = session.ProposedScheduledAt,
            ProposedDurationMinutes = session.ProposedDurationMinutes,
            ProposedPrice = session.ProposedPrice,
            ProposedLocation = session.ProposedLocation,
            ProposalNote = session.ProposalNote,
            ProposedAt = session.ProposedAt
        };
    }

    private int? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                       ?? User.FindFirst("sub")?.Value
                       ?? User.FindFirst("userId")?.Value;

        if (int.TryParse(userIdClaim, out var userId))
            return userId;

        return null;
    }
}
