using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Pickleball.Community.Services;

public interface IWaiverPdfService
{
    Task<WaiverSigningResult> ProcessWaiverSignatureAsync(
        WaiverDocumentDto waiver,
        User user,
        string typedSignature,
        string signatureImageBase64,
        DateTime signedAt,
        string? ipAddress,
        string signerRole,
        string? parentGuardianName);
}

public class WaiverSigningResult
{
    public string SignatureAssetUrl { get; set; } = string.Empty;
    public string SignedWaiverPdfUrl { get; set; } = string.Empty;
}

public class WaiverPdfService : IWaiverPdfService
{
    private readonly ISharedAssetService _sharedAssetService;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<WaiverPdfService> _logger;

    public WaiverPdfService(
        ISharedAssetService sharedAssetService,
        ApplicationDbContext context,
        ILogger<WaiverPdfService> logger)
    {
        _sharedAssetService = sharedAssetService;
        _context = context;
        _logger = logger;

        // Set QuestPDF license (Community license for open source)
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public async Task<WaiverSigningResult> ProcessWaiverSignatureAsync(
        WaiverDocumentDto waiver,
        User user,
        string typedSignature,
        string signatureImageBase64,
        DateTime signedAt,
        string? ipAddress,
        string signerRole,
        string? parentGuardianName)
    {
        var result = new WaiverSigningResult();

        // Defensive null checks
        if (waiver == null)
            throw new ArgumentNullException(nameof(waiver));
        if (user == null)
            throw new ArgumentNullException(nameof(user));
        if (string.IsNullOrEmpty(signatureImageBase64))
            throw new ArgumentNullException(nameof(signatureImageBase64));

        // 1. Upload signature image to shared asset service
        var signatureBytes = Convert.FromBase64String(
            signatureImageBase64.Contains(",")
                ? signatureImageBase64.Split(',')[1]  // Remove data:image/png;base64, prefix
                : signatureImageBase64);

        var signatureFileName = $"signature_e{waiver.EventId}_u{user.Id}_{signedAt:yyyyMMddHHmmss}.png";
        var signatureUrl = await _sharedAssetService.UploadFileAsync(
            signatureBytes,
            signatureFileName,
            "image/png",
            "image",
            "waiver-signatures");

        result.SignatureAssetUrl = signatureUrl ?? string.Empty;
        _logger.LogInformation("Uploaded signature image for user {UserId} event {EventId}: {Url}",
            user.Id, waiver.EventId, result.SignatureAssetUrl);

        // 2. Generate PDF of signed waiver
        var pdfBytes = GenerateSignedWaiverPdf(
            waiver,
            user,
            typedSignature,
            signatureBytes,
            signedAt,
            ipAddress,
            signerRole,
            parentGuardianName);

        // 3. Upload PDF to shared asset service
        var pdfFileName = $"waiver_e{waiver.EventId}_u{user.Id}_{signedAt:yyyyMMddHHmmss}.pdf";
        var pdfUrl = await _sharedAssetService.UploadFileAsync(
            pdfBytes,
            pdfFileName,
            "application/pdf",
            "document",
            "signed-waivers");

        result.SignedWaiverPdfUrl = pdfUrl ?? string.Empty;
        _logger.LogInformation("Uploaded signed waiver PDF for user {UserId} event {EventId}: {Url}",
            user.Id, waiver.EventId, result.SignedWaiverPdfUrl);

        // 4. Call stored procedure for email notification
        try
        {
            await _context.Database.ExecuteSqlRawAsync(
                "EXEC sp_SendWaiverSignedNotification @p0, @p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8",
                waiver.EventId,
                user.Id,
                user.Email ?? "",
                $"{user.FirstName} {user.LastName}".Trim() is { Length: > 0 } name ? name : "User",
                waiver.EventName,
                waiver.Title,
                signedAt,
                result.SignatureAssetUrl,
                result.SignedWaiverPdfUrl);
        }
        catch (Exception ex)
        {
            // Don't fail if SP doesn't exist or fails - waiver is still signed
            _logger.LogWarning(ex, "Failed to call sp_SendWaiverSignedNotification - notification skipped");
        }

        return result;
    }

    private byte[] GenerateSignedWaiverPdf(
        WaiverDocumentDto waiver,
        User user,
        string typedSignature,
        byte[] signatureImage,
        DateTime signedAt,
        string? ipAddress,
        string signerRole,
        string? parentGuardianName)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.Letter);
                page.Margin(50);
                page.DefaultTextStyle(x => x.FontSize(11));

                page.Header().Element(c => ComposeHeader(c, waiver));
                page.Content().Element(c => ComposeContent(c, waiver, user, typedSignature, signatureImage, signedAt, ipAddress, signerRole, parentGuardianName));
                page.Footer().Element(ComposeFooter);
            });
        });

        return document.GeneratePdf();
    }

    private void ComposeHeader(IContainer container, WaiverDocumentDto waiver)
    {
        container.Column(column =>
        {
            column.Item().Text(waiver.EventName).Bold().FontSize(16);
            column.Item().Text(waiver.Title).Bold().FontSize(14);
            column.Item().PaddingTop(5).Row(row =>
            {
                row.RelativeItem().Column(c =>
                {
                    c.Item().Text($"Player: {waiver.PlayerName}").FontSize(11);
                    if (!string.IsNullOrEmpty(waiver.ReferenceId))
                    {
                        c.Item().Text($"Reference ID: {waiver.ReferenceId}").FontSize(11);
                    }
                });
            });
            column.Item().PaddingTop(5).PaddingBottom(10).LineHorizontal(1);
        });
    }

    private void ComposeContent(
        IContainer container,
        WaiverDocumentDto waiver,
        User user,
        string typedSignature,
        byte[] signatureImage,
        DateTime signedAt,
        string? ipAddress,
        string signerRole,
        string? parentGuardianName)
    {
        container.Column(column =>
        {
            // Waiver content - render HTML with proper formatting (WYSIWYG)
            column.Item().PaddingBottom(20).Column(contentColumn =>
            {
                HtmlToPdfConverter.RenderHtml(contentColumn, waiver.Content);
            });

            // Signature section
            column.Item().PaddingTop(20).LineHorizontal(1);
            column.Item().PaddingTop(10).Text("SIGNATURE").Bold().FontSize(12);

            // Determine if this is a guardian signing (Parent, Guardian, Legal Custodian)
            var isGuardianSigning = signerRole != "Participant" && signerRole != "Self";
            var signerTypeDisplay = isGuardianSigning
                ? $"Guardian ({signerRole})"
                : "Self (Participant)";

            column.Item().PaddingTop(10).Row(row =>
            {
                row.RelativeItem().Column(c =>
                {
                    c.Item().Text($"Participant Name: {typedSignature}").Bold();
                    c.Item().Text($"Signed By: {signerTypeDisplay}");
                    if (isGuardianSigning && !string.IsNullOrEmpty(parentGuardianName))
                    {
                        c.Item().Text($"Guardian Name: {parentGuardianName}").Bold();
                        c.Item().Text($"Relationship: {signerRole}");
                    }
                    c.Item().Text($"Email: {user.Email}");
                    c.Item().Text($"Date: {signedAt:MMMM dd, yyyy 'at' h:mm tt}");
                    if (!string.IsNullOrEmpty(ipAddress))
                    {
                        c.Item().Text($"IP Address: {ipAddress}");
                    }
                });
            });

            // Drawn signature image
            var signatureLabel = isGuardianSigning && !string.IsNullOrEmpty(parentGuardianName)
                ? $"Guardian's Signature ({parentGuardianName}):"
                : "Participant's Signature:";
            column.Item().PaddingTop(15).Text(signatureLabel);
            column.Item().PaddingTop(5)
                .Border(1)
                .BorderColor(Colors.Grey.Medium)
                .Padding(5)
                .Height(80)
                .Image(signatureImage)
                .FitArea();

            // Legal notice
            column.Item().PaddingTop(20).Text(text =>
            {
                text.Span("This document was electronically signed and is legally binding. ")
                    .FontSize(9).FontColor(Colors.Grey.Darken2);
                text.Span($"Document ID: E{waiver.EventId}-U{user.Id}-{signedAt:yyyyMMddHHmmss}")
                    .FontSize(9).FontColor(Colors.Grey.Darken2);
            });
        });
    }

    private void ComposeFooter(IContainer container)
    {
        container.Row(row =>
        {
            row.RelativeItem().Text(text =>
            {
                text.Span("Page ");
                text.CurrentPageNumber();
                text.Span(" of ");
                text.TotalPages();
            });
            row.RelativeItem().AlignRight().Text($"Generated: {DateTime.Now:yyyy-MM-dd HH:mm:ss}")
                .FontSize(9).FontColor(Colors.Grey.Medium);
        });
    }

}
