using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Pickleball.Community.Services;
using Pickleball.Community.API.Models.DTOs;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class PlayerCertificationController : ControllerBase
{
    private readonly IPlayerCertificationService _certificationService;
    private readonly IConfiguration _configuration;

    public PlayerCertificationController(
        IPlayerCertificationService certificationService,
        IConfiguration configuration)
    {
        _certificationService = certificationService;
        _configuration = configuration;
    }

    private string GetBaseUrl()
    {
        var baseUrl = _configuration["App:BaseUrl"];
        if (string.IsNullOrEmpty(baseUrl))
        {
            baseUrl = $"{Request.Scheme}://{Request.Host}";
        }
        return baseUrl;
    }

    #region Knowledge Levels (Admin)

    [HttpGet("knowledge-levels")]
    [AllowAnonymous]
    public async Task<ActionResult<List<KnowledgeLevelDto>>> GetKnowledgeLevels([FromQuery] bool activeOnly = true)
    {
        var levels = await _certificationService.GetKnowledgeLevelsAsync(activeOnly);
        return Ok(levels);
    }

    [HttpGet("knowledge-levels/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<KnowledgeLevelDto>> GetKnowledgeLevel(int id)
    {
        var level = await _certificationService.GetKnowledgeLevelAsync(id);
        if (level == null) return NotFound();
        return Ok(level);
    }

    [HttpPost("knowledge-levels")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<KnowledgeLevelDto>> CreateKnowledgeLevel([FromBody] CreateKnowledgeLevelDto dto)
    {
        var level = await _certificationService.CreateKnowledgeLevelAsync(dto);
        return CreatedAtAction(nameof(GetKnowledgeLevel), new { id = level.Id }, level);
    }

    [HttpPut("knowledge-levels/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<KnowledgeLevelDto>> UpdateKnowledgeLevel(int id, [FromBody] UpdateKnowledgeLevelDto dto)
    {
        var level = await _certificationService.UpdateKnowledgeLevelAsync(id, dto);
        if (level == null) return NotFound();
        return Ok(level);
    }

    [HttpDelete("knowledge-levels/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> DeleteKnowledgeLevel(int id)
    {
        var result = await _certificationService.DeleteKnowledgeLevelAsync(id);
        if (!result) return NotFound();
        return NoContent();
    }

    #endregion

    #region Skill Groups (Admin)

    [HttpGet("skill-groups")]
    [AllowAnonymous]
    public async Task<ActionResult<List<SkillGroupDto>>> GetSkillGroups([FromQuery] bool activeOnly = true)
    {
        var groups = await _certificationService.GetSkillGroupsAsync(activeOnly);
        return Ok(groups);
    }

    [HttpGet("skill-groups/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<SkillGroupDto>> GetSkillGroup(int id)
    {
        var group = await _certificationService.GetSkillGroupAsync(id);
        if (group == null) return NotFound();
        return Ok(group);
    }

    [HttpPost("skill-groups")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<SkillGroupDto>> CreateSkillGroup([FromBody] CreateSkillGroupDto dto)
    {
        var group = await _certificationService.CreateSkillGroupAsync(dto);
        return CreatedAtAction(nameof(GetSkillGroup), new { id = group.Id }, group);
    }

    [HttpPut("skill-groups/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<SkillGroupDto>> UpdateSkillGroup(int id, [FromBody] UpdateSkillGroupDto dto)
    {
        var group = await _certificationService.UpdateSkillGroupAsync(id, dto);
        if (group == null) return NotFound();
        return Ok(group);
    }

    [HttpDelete("skill-groups/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> DeleteSkillGroup(int id)
    {
        var result = await _certificationService.DeleteSkillGroupAsync(id);
        if (!result) return NotFound();
        return NoContent();
    }

    #endregion

    #region Skill Areas (Admin)

    [HttpGet("skill-areas")]
    [AllowAnonymous]
    public async Task<ActionResult<List<SkillAreaDto>>> GetSkillAreas([FromQuery] bool activeOnly = true)
    {
        var areas = await _certificationService.GetSkillAreasAsync(activeOnly);
        return Ok(areas);
    }

    [HttpGet("skill-areas/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<SkillAreaDto>> GetSkillArea(int id)
    {
        var area = await _certificationService.GetSkillAreaAsync(id);
        if (area == null) return NotFound();
        return Ok(area);
    }

    [HttpPost("skill-areas")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<SkillAreaDto>> CreateSkillArea([FromBody] CreateSkillAreaDto dto)
    {
        var area = await _certificationService.CreateSkillAreaAsync(dto);
        return CreatedAtAction(nameof(GetSkillArea), new { id = area.Id }, area);
    }

    [HttpPut("skill-areas/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<SkillAreaDto>> UpdateSkillArea(int id, [FromBody] UpdateSkillAreaDto dto)
    {
        var area = await _certificationService.UpdateSkillAreaAsync(id, dto);
        if (area == null) return NotFound();
        return Ok(area);
    }

    [HttpDelete("skill-areas/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> DeleteSkillArea(int id)
    {
        var result = await _certificationService.DeleteSkillAreaAsync(id);
        if (!result) return NotFound();
        return NoContent();
    }

    #endregion

    #region Certification Requests (Student)

    [HttpPost("requests")]
    [Authorize]
    public async Task<ActionResult<CertificationRequestDto>> CreateRequest([FromBody] CreateCertificationRequestDto dto)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var request = await _certificationService.CreateRequestAsync(userId, dto, GetBaseUrl());
        return Ok(request);
    }

    [HttpGet("requests")]
    [Authorize]
    public async Task<ActionResult<List<CertificationRequestDto>>> GetMyRequests()
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var requests = await _certificationService.GetStudentRequestsAsync(userId, GetBaseUrl());
        return Ok(requests);
    }

    [HttpGet("requests/{id}")]
    [Authorize]
    public async Task<ActionResult<CertificationRequestDto>> GetRequest(int id)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var request = await _certificationService.GetRequestAsync(id, userId, GetBaseUrl());
        if (request == null) return NotFound();
        return Ok(request);
    }

    [HttpPost("requests/{id}/deactivate")]
    [Authorize]
    public async Task<ActionResult> DeactivateRequest(int id)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var result = await _certificationService.DeactivateRequestAsync(id, userId);
        if (!result) return NotFound();
        return Ok(new { message = "Request deactivated successfully" });
    }

    [HttpGet("requests/active")]
    [Authorize]
    public async Task<ActionResult<CertificationRequestDto>> GetOrCreateActiveRequest()
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var request = await _certificationService.GetOrCreateActiveRequestAsync(userId, GetBaseUrl());
        return Ok(request);
    }

    [HttpPut("requests/{id}")]
    [Authorize]
    public async Task<ActionResult<CertificationRequestDto>> UpdateRequest(int id, [FromBody] UpdateCertificationRequestDto dto)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var request = await _certificationService.UpdateRequestAsync(id, userId, dto, GetBaseUrl());
        if (request == null) return NotFound();
        return Ok(request);
    }

    #endregion

    #region Invitations (Student)

    [HttpGet("requests/{id}/invitable-peers")]
    [Authorize]
    public async Task<ActionResult<InvitablePeersDto>> GetInvitablePeers(int id)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var peers = await _certificationService.GetInvitablePeersAsync(userId);
        return Ok(peers);
    }

    [HttpGet("requests/{id}/invitations")]
    [Authorize]
    public async Task<ActionResult<List<CertificationInvitationDto>>> GetInvitations(int id)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var invitations = await _certificationService.GetInvitationsAsync(id, userId);
        return Ok(invitations);
    }

    [HttpPost("requests/{id}/invitations")]
    [Authorize]
    public async Task<ActionResult> InvitePeers(int id, [FromBody] InvitePeersDto dto)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var count = await _certificationService.InvitePeersAsync(id, userId, dto);
        return Ok(new { message = $"Successfully invited {count} peer(s)", count });
    }

    #endregion

    #region Pending Reviews (Invited User)

    /// <summary>
    /// Get all pending review requests where the current user has been invited to review another player
    /// </summary>
    [HttpGet("my-pending-reviews")]
    [Authorize]
    public async Task<ActionResult<List<PendingReviewInvitationDto>>> GetMyPendingReviews()
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var pendingReviews = await _certificationService.GetMyPendingReviewsAsync(userId, GetBaseUrl());
        return Ok(pendingReviews);
    }

    #endregion

    #region Review Page (Public)

    [HttpGet("review/{token}")]
    [AllowAnonymous]
    public async Task<ActionResult<ReviewPageInfoDto>> GetReviewPage(string token)
    {
        // Get current user ID if authenticated
        int? currentUserId = null;
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userIdStr) && int.TryParse(userIdStr, out var userId))
            currentUserId = userId;

        var info = await _certificationService.GetReviewPageInfoAsync(token, currentUserId);
        return Ok(info);
    }

    [HttpPost("review/{token}")]
    [AllowAnonymous]
    public async Task<ActionResult> SubmitReview(string token, [FromBody] SubmitReviewDto dto)
    {
        // Get current user ID if authenticated
        int? currentUserId = null;
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userIdStr) && int.TryParse(userIdStr, out var userId))
            currentUserId = userId;

        var result = await _certificationService.SubmitReviewAsync(token, dto, currentUserId);
        if (!result)
            return BadRequest(new { message = "Unable to submit review. The link may be invalid, expired, or you don't have permission to review." });

        return Ok(new { message = "Review submitted successfully. Thank you!" });
    }

    #endregion

    #region Certificate View (Student)

    [HttpGet("certificate")]
    [Authorize]
    public async Task<ActionResult<CertificateSummaryDto>> GetMyCertificate()
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var summary = await _certificationService.GetCertificateSummaryAsync(userId);
        if (summary == null) return NotFound();
        return Ok(summary);
    }

    #endregion
}
