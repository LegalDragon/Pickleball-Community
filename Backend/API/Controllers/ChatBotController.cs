using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class ChatBotController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<ChatBotController> _logger;
    private readonly IHttpClientFactory _httpClientFactory;

    private static readonly string SystemPrompt = @"You are Synthia, the friendly AI assistant for Pickleball Community (pickleball.community), a platform for organizing pickleball tournaments, leagues, clubs, and social play. You were created by synthia.bot — an AI platform that helps build smart, helpful assistants.

YOUR ROLE:
- Help users understand and use the Pickleball Community platform
- Answer general pickleball questions (rules, scoring, equipment, techniques, strategy)
- Collect user feedback about the platform
- Be friendly, helpful, and enthusiastic about pickleball!

PLATFORM FEATURES YOU CAN EXPLAIN:
- Tournament Management: Create/join tournaments, brackets, scheduling, court assignments
- League Play: Round-robin leagues, standings, scheduling
- Club Management: Create clubs, manage members, roles, club events
- Check-in System: QR code check-in for events, attendance tracking
- Scoring & Results: Live scoring, match history, player statistics
- Social Features: Player profiles, friends, messaging
- Notifications: Email and push notifications for matches, events
- Payment Processing: Tournament fees, club dues via Stripe

WHAT TO DECLINE POLITELY:
- Questions unrelated to pickleball or the platform
- Technical support for other websites/apps
- Personal advice unrelated to pickleball
- Political, controversial, or inappropriate topics

When declining, say something like: ""I'm specialized in pickleball and the Pickleball Community platform. For other topics, I'd recommend checking with a more general resource. Is there anything pickleball-related I can help with?""

STYLE:
- Keep responses concise but helpful (2-4 sentences for simple questions)
- Use pickleball terminology naturally
- Be encouraging to new players
- If collecting feedback, thank them and confirm you've noted it

Remember: You represent the Pickleball Community platform. Be professional, friendly, and focused on pickleball!";

    public ChatBotController(
        IConfiguration configuration,
        ILogger<ChatBotController> logger,
        IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] ChatRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new { success = false, message = "Message is required" });
            }

            var apiKey = _configuration["OpenAI:ApiKey"];
            if (string.IsNullOrEmpty(apiKey))
            {
                _logger.LogError("OpenAI API key not configured");
                return StatusCode(500, new { success = false, message = "Chat service not configured" });
            }

            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            // Build messages array with conversation history
            var messages = new List<object>
            {
                new { role = "system", content = SystemPrompt }
            };

            // Add conversation history if provided
            if (request.History != null && request.History.Count > 0)
            {
                foreach (var msg in request.History.TakeLast(10)) // Limit to last 10 messages
                {
                    messages.Add(new { role = msg.Role, content = msg.Content });
                }
            }

            // Add current message
            messages.Add(new { role = "user", content = request.Message });

            var openAiRequest = new
            {
                model = "gpt-4o-mini",
                messages = messages,
                max_tokens = 500,
                temperature = 0.7
            };

            var jsonContent = JsonSerializer.Serialize(openAiRequest);
            var httpContent = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            var response = await client.PostAsync("https://api.openai.com/v1/chat/completions", httpContent);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("OpenAI API error: {Status} - {Body}", response.StatusCode, responseBody);
                return StatusCode(500, new { success = false, message = "Chat service temporarily unavailable" });
            }

            var openAiResponse = JsonSerializer.Deserialize<OpenAiResponse>(responseBody);
            var assistantMessage = openAiResponse?.Choices?.FirstOrDefault()?.Message?.Content ?? "I apologize, I couldn't generate a response. Please try again.";

            return Ok(new { success = true, message = assistantMessage });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in chat endpoint");
            return StatusCode(500, new { success = false, message = "An error occurred. Please try again." });
        }
    }

    [HttpPost("feedback")]
    public async Task<IActionResult> SubmitChatFeedback([FromBody] ChatFeedbackRequest request)
    {
        try
        {
            // Log feedback for review (could also store in DB)
            _logger.LogInformation("Chat feedback received: {Feedback}", request.Feedback);
            
            return Ok(new { success = true, message = "Thank you for your feedback!" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting chat feedback");
            return StatusCode(500, new { success = false, message = "Failed to submit feedback" });
        }
    }
}

public class ChatRequest
{
    public string Message { get; set; } = string.Empty;
    public List<ChatMessage>? History { get; set; }
}

public class ChatMessage
{
    public string Role { get; set; } = "user";
    public string Content { get; set; } = string.Empty;
}

public class ChatFeedbackRequest
{
    public string Feedback { get; set; } = string.Empty;
    public string? ConversationId { get; set; }
}

// OpenAI response models
public class OpenAiResponse
{
    [JsonPropertyName("choices")]
    public List<OpenAiChoice>? Choices { get; set; }
}

public class OpenAiChoice
{
    [JsonPropertyName("message")]
    public OpenAiMessage? Message { get; set; }
}

public class OpenAiMessage
{
    [JsonPropertyName("content")]
    public string? Content { get; set; }
}
