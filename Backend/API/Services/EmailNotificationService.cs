using System.Data;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;

namespace Pickleball.Community.Services;

/// <summary>
/// Implementation of email notification service using stored procedures
/// </summary>
public class EmailNotificationService : IEmailNotificationService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<EmailNotificationService> _logger;

    public EmailNotificationService(ApplicationDbContext context, ILogger<EmailNotificationService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<int> CreateAsync(int userId, string userEmail, string subject, string htmlBody)
    {
        return await CreateNotificationAsync(userId, "email", false, null, userEmail, subject, htmlBody);
    }

    /// <inheritdoc/>
    public async Task<int> CreateNotificationAsync(int userId, string sendType, bool instantSend, string? userPhone, string? userEmail, string subject, string body)
    {
        // Build the JSON body
        var bodyJson = JsonSerializer.Serialize(new
        {
            SUBJECT = subject,
            BODY = body
        });

        var userIdParam = new SqlParameter("@UserId", SqlDbType.Int) { Value = userId };
        var sendTypeParam = new SqlParameter("@SendType", SqlDbType.VarChar, 50) { Value = sendType };
        var instantSendParam = new SqlParameter("@InstantSend", SqlDbType.Bit) { Value = instantSend };
        var userPhoneParam = new SqlParameter("@UserPhone", SqlDbType.VarChar, 25) { Value = (object?)userPhone ?? DBNull.Value };
        var userEmailParam = new SqlParameter("@UserEmail", SqlDbType.VarChar, 100) { Value = (object?)userEmail ?? DBNull.Value };
        var bodyJsonParam = new SqlParameter("@BodyJSON", SqlDbType.NVarChar, -1) { Value = bodyJson };
        var enidParam = new SqlParameter("@ENID", SqlDbType.Int) { Direction = ParameterDirection.Output };

        await _context.Database.ExecuteSqlRawAsync(
            "EXEC sp_EN_Create @UserId, @SendType, @InstantSend, @UserPhone, @UserEmail, @BodyJSON, @ENID OUTPUT",
            userIdParam, sendTypeParam, instantSendParam, userPhoneParam, userEmailParam, bodyJsonParam, enidParam
        );

        var enid = (int)enidParam.Value;

        if (sendType == "phone")
        {
            _logger.LogInformation("Created SMS notification {ENID} for user {UserId} ({Phone}), instant: {Instant}",
                enid, userId, userPhone, instantSend);
        }
        else
        {
            _logger.LogInformation("Created email notification {ENID} for user {UserId} ({Email}), subject: {Subject}, instant: {Instant}",
                enid, userId, userEmail, subject, instantSend);
        }

        return enid;
    }

    /// <inheritdoc/>
    public async Task<int> SendSmsAsync(int userId, string userPhone, string message)
    {
        // SMS is sent immediately with InstantSend=true
        return await CreateNotificationAsync(userId, "phone", true, userPhone, null, "", message);
    }

    /// <inheritdoc/>
    public async Task AttachAsync(int enid, string documentName, string mimeType, string storageUrl)
    {
        if (string.IsNullOrEmpty(storageUrl))
        {
            _logger.LogWarning("Attempted to attach empty URL to email {ENID}, skipping", enid);
            return;
        }

        var enidParam = new SqlParameter("@ENId", SqlDbType.Int) { Value = enid };
        var docNameParam = new SqlParameter("@DocName", SqlDbType.NVarChar, 200) { Value = documentName };
        var mimeTypeParam = new SqlParameter("@MimeType", SqlDbType.VarChar, 100) { Value = mimeType };
        var storageUrlParam = new SqlParameter("@StorageUrl", SqlDbType.VarChar, 500) { Value = storageUrl };

        await _context.Database.ExecuteSqlRawAsync(
            "EXEC sp_EN_Attach @ENId, @DocName, @MimeType, @StorageUrl",
            enidParam, docNameParam, mimeTypeParam, storageUrlParam
        );

        _logger.LogInformation("Attached document '{DocName}' ({MimeType}) to email {ENID}", documentName, mimeType, enid);
    }

    /// <inheritdoc/>
    public async Task ReleaseAsync(int enid)
    {
        var enidParam = new SqlParameter("@ENId", SqlDbType.Int) { Value = enid };

        await _context.Database.ExecuteSqlRawAsync(
            "EXEC sp_EN_Release @ENId",
            enidParam
        );

        _logger.LogInformation("Released email notification {ENID} for sending", enid);
    }

    /// <inheritdoc/>
    public async Task SendSimpleAsync(int userId, string userEmail, string subject, string htmlBody)
    {
        // Use InstantSend=true to avoid separate Release call
        await CreateNotificationAsync(userId, "email", true, null, userEmail, subject, htmlBody);
    }

    /// <inheritdoc/>
    public IEmailBuilder CreateEmail(int userId, string userEmail, string subject, string htmlBody)
    {
        return new EmailBuilder(this, userId, userEmail, subject, htmlBody);
    }

    /// <summary>
    /// Fluent email builder implementation
    /// </summary>
    private class EmailBuilder : IEmailBuilder
    {
        private readonly EmailNotificationService _service;
        private readonly int _userId;
        private readonly string _userEmail;
        private readonly string _subject;
        private readonly string _htmlBody;
        private readonly List<(string Name, string MimeType, string Url)> _attachments = new();
        private int _enid = 0;

        public EmailBuilder(EmailNotificationService service, int userId, string userEmail, string subject, string htmlBody)
        {
            _service = service;
            _userId = userId;
            _userEmail = userEmail;
            _subject = subject;
            _htmlBody = htmlBody;
        }

        public IEmailBuilder AttachPdf(string documentName, string storageUrl)
        {
            return Attach(documentName, "application/pdf", storageUrl);
        }

        public IEmailBuilder AttachImage(string documentName, string storageUrl, string mimeType = "image/png")
        {
            return Attach(documentName, mimeType, storageUrl);
        }

        public IEmailBuilder Attach(string documentName, string mimeType, string storageUrl)
        {
            if (!string.IsNullOrEmpty(storageUrl))
            {
                _attachments.Add((documentName, mimeType, storageUrl));
            }
            return this;
        }

        public IEmailBuilder AttachIfPresent(string documentName, string mimeType, string? storageUrl)
        {
            if (!string.IsNullOrEmpty(storageUrl))
            {
                _attachments.Add((documentName, mimeType, storageUrl));
            }
            return this;
        }

        public async Task SendAsync()
        {
            // Create the email
            _enid = await _service.CreateAsync(_userId, _userEmail, _subject, _htmlBody);

            // Attach all documents
            foreach (var (name, mimeType, url) in _attachments)
            {
                await _service.AttachAsync(_enid, name, mimeType, url);
            }

            // Release for sending
            await _service.ReleaseAsync(_enid);
        }

        public int GetEnid() => _enid;
    }
}

/// <summary>
/// Email template helpers for common email scenarios
/// </summary>
public static class EmailTemplates
{
    /// <summary>
    /// Generate event registration confirmation email HTML
    /// </summary>
    public static string EventRegistrationConfirmation(
        string playerName,
        string eventName,
        string divisionName,
        DateTime eventDate,
        string? venueName,
        string? teamName,
        decimal? feeAmount,
        bool waiverSigned,
        bool paymentComplete)
    {
        var statusItems = new List<string>();
        if (waiverSigned) statusItems.Add("<li style='color: #16a34a;'>✓ Waiver signed</li>");
        else statusItems.Add("<li style='color: #dc2626;'>✗ Waiver pending</li>");

        if (feeAmount.HasValue && feeAmount > 0)
        {
            if (paymentComplete) statusItems.Add("<li style='color: #16a34a;'>✓ Payment complete</li>");
            else statusItems.Add($"<li style='color: #dc2626;'>✗ Payment pending (${feeAmount:F2})</li>");
        }

        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
</head>
<body style='font-family: -apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, ""Helvetica Neue"", Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;'>
    <div style='background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;'>
        <h1 style='color: white; margin: 0; font-size: 24px;'>Registration Confirmed! 🎉</h1>
    </div>

    <div style='background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;'>
        <p style='font-size: 16px;'>Hi {playerName},</p>

        <p>You have successfully registered for:</p>

        <div style='background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;'>
            <h2 style='margin: 0 0 10px 0; color: #f97316;'>{eventName}</h2>
            <p style='margin: 5px 0;'><strong>Division:</strong> {divisionName}</p>
            <p style='margin: 5px 0;'><strong>Date:</strong> {eventDate:dddd, MMMM d, yyyy}</p>
            {(string.IsNullOrEmpty(venueName) ? "" : $"<p style='margin: 5px 0;'><strong>Venue:</strong> {venueName}</p>")}
            {(string.IsNullOrEmpty(teamName) ? "" : $"<p style='margin: 5px 0;'><strong>Team:</strong> {teamName}</p>")}
        </div>

        <h3 style='margin-bottom: 10px;'>Registration Status:</h3>
        <ul style='list-style: none; padding: 0; margin: 0;'>
            {string.Join("\n            ", statusItems)}
        </ul>

        <div style='margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;'>
            <a href='https://pickleball.community/my-events' style='display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;'>View My Events</a>
        </div>

        <p style='margin-top: 30px; font-size: 14px; color: #6b7280;'>
            See you on the courts!<br>
            <strong>Pickleball Community</strong>
        </p>
    </div>
</body>
</html>";
    }

    /// <summary>
    /// Generate waiver signed confirmation email HTML
    /// </summary>
    public static string WaiverSignedConfirmation(
        string playerName,
        string eventName,
        string waiverTitle,
        DateTime signedAt)
    {
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
</head>
<body style='font-family: -apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, ""Helvetica Neue"", Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;'>
    <div style='background: #16a34a; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;'>
        <h1 style='color: white; margin: 0; font-size: 24px;'>Waiver Signed ✓</h1>
    </div>

    <div style='background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;'>
        <p style='font-size: 16px;'>Hi {playerName},</p>

        <p>This confirms that you have signed the following waiver:</p>

        <div style='background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;'>
            <h3 style='margin: 0 0 10px 0;'>{waiverTitle}</h3>
            <p style='margin: 5px 0;'><strong>Event:</strong> {eventName}</p>
            <p style='margin: 5px 0;'><strong>Signed:</strong> {signedAt:MMMM d, yyyy 'at' h:mm tt}</p>
        </div>

        <p style='font-size: 14px; color: #6b7280;'>
            A copy of your signed waiver is attached to this email for your records.
        </p>

        <p style='margin-top: 30px; font-size: 14px; color: #6b7280;'>
            <strong>Pickleball Community</strong>
        </p>
    </div>
</body>
</html>";
    }

    /// <summary>
    /// Generate payment confirmation email HTML
    /// </summary>
    public static string PaymentConfirmation(
        string playerName,
        string eventName,
        string divisionName,
        decimal amountPaid,
        string paymentMethod,
        string referenceId,
        List<string> paidForMembers)
    {
        var membersList = paidForMembers.Count > 1
            ? $"<p><strong>Paid for:</strong></p><ul>{string.Join("", paidForMembers.Select(m => $"<li>{m}</li>"))}</ul>"
            : "";

        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
</head>
<body style='font-family: -apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, ""Helvetica Neue"", Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;'>
    <div style='background: #2563eb; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;'>
        <h1 style='color: white; margin: 0; font-size: 24px;'>Payment Received 💳</h1>
    </div>

    <div style='background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;'>
        <p style='font-size: 16px;'>Hi {playerName},</p>

        <p>We have received your payment for:</p>

        <div style='background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;'>
            <h3 style='margin: 0 0 10px 0;'>{eventName}</h3>
            <p style='margin: 5px 0;'><strong>Division:</strong> {divisionName}</p>
            <p style='margin: 5px 0;'><strong>Amount:</strong> <span style='color: #16a34a; font-weight: bold;'>${amountPaid:F2}</span></p>
            <p style='margin: 5px 0;'><strong>Method:</strong> {paymentMethod}</p>
            <p style='margin: 5px 0;'><strong>Reference:</strong> {referenceId}</p>
            {membersList}
        </div>

        <p style='font-size: 14px; color: #6b7280;'>
            A copy of your payment proof is attached to this email for your records.
        </p>

        <p style='margin-top: 30px; font-size: 14px; color: #6b7280;'>
            See you on the courts!<br>
            <strong>Pickleball Community</strong>
        </p>
    </div>
</body>
</html>";
    }
}
