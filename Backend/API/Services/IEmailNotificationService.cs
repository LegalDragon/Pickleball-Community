namespace Pickleball.Community.Services;

/// <summary>
/// Service for sending notifications (email and SMS) via stored procedures
/// </summary>
public interface IEmailNotificationService
{
    /// <summary>
    /// Create a new email notification
    /// </summary>
    /// <param name="userId">User ID of the recipient</param>
    /// <param name="userEmail">Email address of the recipient</param>
    /// <param name="subject">Email subject</param>
    /// <param name="htmlBody">HTML body content</param>
    /// <returns>Email Notification ID (ENID)</returns>
    Task<int> CreateAsync(int userId, string userEmail, string subject, string htmlBody);

    /// <summary>
    /// Create a new notification with full control over send type and instant release
    /// </summary>
    /// <param name="userId">User ID of the recipient</param>
    /// <param name="sendType">Send type: "email" or "phone"</param>
    /// <param name="instantSend">If true, notification is released immediately (no need to call ReleaseAsync)</param>
    /// <param name="userPhone">Phone number (required if sendType is "phone")</param>
    /// <param name="userEmail">Email address (required if sendType is "email")</param>
    /// <param name="subject">Subject (for email) or ignored (for SMS)</param>
    /// <param name="body">Body content (HTML for email, plain text for SMS)</param>
    /// <returns>Notification ID (ENID)</returns>
    Task<int> CreateNotificationAsync(int userId, string sendType, bool instantSend, string? userPhone, string? userEmail, string subject, string body);

    /// <summary>
    /// Attach a document to an email notification
    /// </summary>
    /// <param name="enid">Email Notification ID</param>
    /// <param name="documentName">Display name for the attachment</param>
    /// <param name="mimeType">MIME type (e.g., "application/pdf", "image/png")</param>
    /// <param name="storageUrl">URL to the document in storage</param>
    Task AttachAsync(int enid, string documentName, string mimeType, string storageUrl);

    /// <summary>
    /// Release an email notification for sending
    /// </summary>
    /// <param name="enid">Email Notification ID</param>
    Task ReleaseAsync(int enid);

    /// <summary>
    /// Create and immediately release a simple email (no attachments)
    /// </summary>
    Task SendSimpleAsync(int userId, string userEmail, string subject, string htmlBody);

    /// <summary>
    /// Send an SMS message immediately (no attachments supported)
    /// </summary>
    /// <param name="userId">User ID of the recipient</param>
    /// <param name="userPhone">Phone number of the recipient</param>
    /// <param name="message">SMS message text</param>
    /// <returns>Notification ID (ENID)</returns>
    Task<int> SendSmsAsync(int userId, string userPhone, string message);

    /// <summary>
    /// Helper to build an email with attachments using fluent pattern
    /// </summary>
    IEmailBuilder CreateEmail(int userId, string userEmail, string subject, string htmlBody);
}

/// <summary>
/// Fluent builder for constructing emails with attachments
/// </summary>
public interface IEmailBuilder
{
    /// <summary>
    /// Attach a PDF document
    /// </summary>
    IEmailBuilder AttachPdf(string documentName, string storageUrl);

    /// <summary>
    /// Attach an image
    /// </summary>
    IEmailBuilder AttachImage(string documentName, string storageUrl, string mimeType = "image/png");

    /// <summary>
    /// Attach a generic document
    /// </summary>
    IEmailBuilder Attach(string documentName, string mimeType, string storageUrl);

    /// <summary>
    /// Attach a document only if the URL is not null or empty
    /// </summary>
    IEmailBuilder AttachIfPresent(string documentName, string mimeType, string? storageUrl);

    /// <summary>
    /// Release the email for sending
    /// </summary>
    Task SendAsync();

    /// <summary>
    /// Get the Email Notification ID (for reference)
    /// </summary>
    int GetEnid();
}
