using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Tracks each waiver signed by an event unit member.
/// Supports multiple waivers per event with individual signatures.
/// </summary>
public class EventUnitMemberWaiver
{
    public int Id { get; set; }

    public int EventUnitMemberId { get; set; }

    /// <summary>
    /// Reference to the ObjectAsset (waiver document)
    /// </summary>
    public int WaiverId { get; set; }

    public DateTime SignedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// URL to the signature image (base64 encoded PNG stored as asset)
    /// </summary>
    [MaxLength(500)]
    public string? SignatureAssetUrl { get; set; }

    /// <summary>
    /// URL to the generated signed waiver PDF
    /// </summary>
    [MaxLength(500)]
    public string? SignedPdfUrl { get; set; }

    /// <summary>
    /// Typed signature (full legal name)
    /// </summary>
    [MaxLength(200)]
    public string? WaiverSignature { get; set; }

    /// <summary>
    /// Who signed: Participant, Parent, Guardian
    /// </summary>
    [MaxLength(20)]
    public string SignerRole { get; set; } = "Participant";

    /// <summary>
    /// Parent/Guardian name if signing on behalf of minor
    /// </summary>
    [MaxLength(200)]
    public string? ParentGuardianName { get; set; }

    /// <summary>
    /// Emergency contact phone
    /// </summary>
    [MaxLength(30)]
    public string? EmergencyPhone { get; set; }

    /// <summary>
    /// Email address at time of signing (for legal record)
    /// </summary>
    [MaxLength(255)]
    public string? SignerEmail { get; set; }

    /// <summary>
    /// IP address at time of signing (for legal record)
    /// </summary>
    [MaxLength(50)]
    public string? SignerIpAddress { get; set; }

    /// <summary>
    /// Waiver title at time of signing (in case it changes later)
    /// </summary>
    [MaxLength(200)]
    public string? WaiverTitle { get; set; }

    /// <summary>
    /// Waiver version at time of signing
    /// </summary>
    public int? WaiverVersion { get; set; }

    // Navigation
    [ForeignKey("EventUnitMemberId")]
    public EventUnitMember? EventUnitMember { get; set; }
}
