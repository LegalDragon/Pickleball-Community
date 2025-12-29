using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Pickleball.College.Services;
using Pickleball.College.Models.DTOs;

namespace Pickleball.College.API.Controllers;

[ApiController]
[Route("[controller]")]
public class CoursesController : ControllerBase
{
    private readonly ICourseService _courseService;
    private readonly IFileStorageService _fileStorageService;

    public CoursesController(ICourseService courseService, IFileStorageService fileStorageService)
    {
        _courseService = courseService;
        _fileStorageService = fileStorageService;
    }

    [HttpPost]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult<CourseDto>> CreateCourse([FromForm] CreateCourseRequest request)
    {
        var coachIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(coachIdStr) || !int.TryParse(coachIdStr, out var coachId))
        {
            return Unauthorized();
        }

        try
        {
            string? thumbnailUrl = null;
            if (request.ThumbnailFile != null)
            {
                thumbnailUrl = await _fileStorageService.UploadFileAsync(request.ThumbnailFile, "thumbnails");
            }

            var course = await _courseService.CreateCourseAsync(coachId, request, thumbnailUrl);
            return Ok(course);
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to create course: {ex.Message}");
        }
    }

    [HttpPut("{courseId}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult<CourseDto>> UpdateCourse(int courseId, [FromForm] UpdateCourseRequest request)
    {
        var coachIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(coachIdStr) || !int.TryParse(coachIdStr, out var coachId))
        {
            return Unauthorized();
        }

        try
        {
            string? thumbnailUrl = null;
            if (request.ThumbnailFile != null)
            {
                thumbnailUrl = await _fileStorageService.UploadFileAsync(request.ThumbnailFile, "thumbnails");
            }

            var course = await _courseService.UpdateCourseAsync(courseId, coachId, request, thumbnailUrl);
            return Ok(course);
        }
        catch (ArgumentException ex)
        {
            return NotFound(ex.Message);
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to update course: {ex.Message}");
        }
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<List<CourseDto>>> GetPublishedCourses()
    {
        // Get userId if authenticated (to check purchased status)
        int? userId = null;
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userIdStr) && int.TryParse(userIdStr, out var parsedUserId))
        {
            userId = parsedUserId;
        }

        var courses = await _courseService.GetPublishedCoursesAsync(userId);
        return Ok(courses);
    }

    [HttpGet("coach/{coachId}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult<List<CourseDto>>> GetCoachCourses(int coachId)
    {
        var courses = await _courseService.GetCoachCoursesAsync(coachId);
        return Ok(courses);
    }

    [HttpGet("{courseId}")]
    [AllowAnonymous]
    public async Task<ActionResult<CourseDto>> GetCourse(int courseId)
    {
        try
        {
            int? userId = null;
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userIdStr) && int.TryParse(userIdStr, out var parsedId))
            {
                userId = parsedId;
            }

            var course = await _courseService.GetCourseWithMaterialsAsync(courseId, userId);
            return Ok(course);
        }
        catch (ArgumentException ex)
        {
            return NotFound(ex.Message);
        }
    }

    [HttpPost("{courseId}/toggle-publish")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult<CourseDto>> TogglePublish(int courseId)
    {
        var coachIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(coachIdStr) || !int.TryParse(coachIdStr, out var coachId))
        {
            return Unauthorized();
        }

        try
        {
            var course = await _courseService.TogglePublishAsync(courseId, coachId);
            return Ok(course);
        }
        catch (ArgumentException ex)
        {
            return NotFound(ex.Message);
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to toggle publish status: {ex.Message}");
        }
    }

    [HttpDelete("{courseId}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> DeleteCourse(int courseId)
    {
        var coachIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(coachIdStr) || !int.TryParse(coachIdStr, out var coachId))
        {
            return Unauthorized();
        }

        try
        {
            await _courseService.DeleteCourseAsync(courseId, coachId);
            return NoContent();
        }
        catch (ArgumentException ex)
        {
            return NotFound(ex.Message);
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to delete course: {ex.Message}");
        }
    }

    // Course Materials endpoints
    [HttpPost("{courseId}/materials")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult<CourseMaterialDto>> AddMaterial(int courseId, [FromBody] AddCourseMaterialRequest request)
    {
        var coachIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(coachIdStr) || !int.TryParse(coachIdStr, out var coachId))
        {
            return Unauthorized();
        }

        try
        {
            var material = await _courseService.AddMaterialToCourseAsync(courseId, coachId, request);
            return Ok(material);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to add material: {ex.Message}");
        }
    }

    [HttpPut("{courseId}/materials/{courseMaterialId}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult<CourseMaterialDto>> UpdateCourseMaterial(int courseId, int courseMaterialId, [FromBody] UpdateCourseMaterialRequest request)
    {
        var coachIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(coachIdStr) || !int.TryParse(coachIdStr, out var coachId))
        {
            return Unauthorized();
        }

        try
        {
            var material = await _courseService.UpdateCourseMaterialAsync(courseId, courseMaterialId, coachId, request);
            return Ok(material);
        }
        catch (ArgumentException ex)
        {
            return NotFound(ex.Message);
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to update material: {ex.Message}");
        }
    }

    [HttpDelete("{courseId}/materials/{courseMaterialId}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> RemoveMaterial(int courseId, int courseMaterialId)
    {
        var coachIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(coachIdStr) || !int.TryParse(coachIdStr, out var coachId))
        {
            return Unauthorized();
        }

        try
        {
            await _courseService.RemoveMaterialFromCourseAsync(courseId, courseMaterialId, coachId);
            return NoContent();
        }
        catch (ArgumentException ex)
        {
            return NotFound(ex.Message);
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to remove material: {ex.Message}");
        }
    }

    [HttpPost("{courseId}/materials/reorder")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> ReorderMaterials(int courseId, [FromBody] ReorderCourseMaterialsRequest request)
    {
        var coachIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(coachIdStr) || !int.TryParse(coachIdStr, out var coachId))
        {
            return Unauthorized();
        }

        try
        {
            await _courseService.ReorderCourseMaterialsAsync(courseId, coachId, request);
            return Ok();
        }
        catch (ArgumentException ex)
        {
            return NotFound(ex.Message);
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to reorder materials: {ex.Message}");
        }
    }

    // Purchase endpoints
    [HttpPost("{courseId}/purchase")]
    [Authorize]
    public async Task<ActionResult<PurchaseResult>> PurchaseCourse(int courseId)
    {
        var studentIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(studentIdStr) || !int.TryParse(studentIdStr, out var studentId))
        {
            return Unauthorized();
        }

        try
        {
            var result = await _courseService.PurchaseCourseAsync(courseId, studentId);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            return BadRequest($"Purchase failed: {ex.Message}");
        }
    }

    [HttpGet("{courseId}/purchased")]
    [Authorize]
    public async Task<ActionResult<bool>> HasPurchased(int courseId)
    {
        var studentIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(studentIdStr) || !int.TryParse(studentIdStr, out var studentId))
        {
            return Unauthorized();
        }

        var hasPurchased = await _courseService.HasPurchasedCourseAsync(courseId, studentId);
        return Ok(hasPurchased);
    }
}
