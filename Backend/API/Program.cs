using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Pickleball.Community.Database;
using Pickleball.Community.Services;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.Configuration;
using Pickleball.Community.Hubs;
using Pickleball.Community.Middleware;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Don't convert DateTime to UTC - treat as local/unspecified time
        options.JsonSerializerOptions.Converters.Add(new DateTimeConverterUsingDateTimeParse());
        options.JsonSerializerOptions.Converters.Add(new NullableDateTimeConverterUsingDateTimeParse());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSignalR();

// Configuration
builder.Services.Configure<FileStorageOptions>(
    builder.Configuration.GetSection(FileStorageOptions.SectionName));

// Database
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Authentication - Accept tokens from both local and shared auth
var jwtKey = builder.Configuration["Jwt:Key"];
var sharedAuthJwtKey = builder.Configuration["SharedAuth:JwtKey"];

// Read valid issuers and audiences from config (with fallbacks)
var validIssuers = builder.Configuration.GetSection("Jwt:ValidIssuers").Get<string[]>();
var validAudiences = builder.Configuration.GetSection("Jwt:ValidAudiences").Get<string[]>();

// Fallback to single Issuer/Audience if arrays not configured
if (validIssuers == null || validIssuers.Length == 0)
{
    var singleIssuer = builder.Configuration["Jwt:Issuer"];
    validIssuers = !string.IsNullOrEmpty(singleIssuer) ? new[] { singleIssuer } : new[] { "FuntimePickleball" };
}
if (validAudiences == null || validAudiences.Length == 0)
{
    var singleAudience = builder.Configuration["Jwt:Audience"];
    validAudiences = !string.IsNullOrEmpty(singleAudience) ? new[] { singleAudience } : new[] { "FuntimePickleballUsers" };
}

// Build list of signing keys (local + shared auth if different)
var signingKeys = new List<SecurityKey>
{
    new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey!))
};
if (!string.IsNullOrEmpty(sharedAuthJwtKey) && sharedAuthJwtKey != jwtKey)
{
    signingKeys.Add(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(sharedAuthJwtKey)));
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            // Accept tokens from configured issuers and audiences
            ValidIssuers = validIssuers,
            ValidAudiences = validAudiences,
            // Accept multiple signing keys for shared auth compatibility
            IssuerSigningKeys = signingKeys,
            // Map role claim for [Authorize(Roles = ...)] to work with shared auth tokens
            // Use the full URI since shared auth uses Microsoft's claim type format
            RoleClaimType = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
            NameClaimType = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
        };

        // Support SignalR authentication via query string
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;

                // If the request is for any SignalR hub
                if (!string.IsNullOrEmpty(accessToken) &&
                    path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

// HttpClient for shared auth service
builder.Services.AddHttpClient("SharedAuth", client =>
{
    var baseUrl = builder.Configuration["SharedAuth:BaseUrl"];
    if (!string.IsNullOrEmpty(baseUrl))
    {
        // Ensure trailing slash - HttpClient URL resolution requires it for relative paths to work correctly
        if (!baseUrl.EndsWith("/"))
            baseUrl += "/";
        client.BaseAddress = new Uri(baseUrl);
    }
    client.Timeout = TimeSpan.FromSeconds(30);
});

// HttpContext accessor for services that need access to the current request
builder.Services.AddHttpContextAccessor();

// Services
builder.Services.AddScoped<IAssetService, AssetService>();
builder.Services.AddScoped<IFileStorageService, AwsS3StorageService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ISharedAuthService, SharedAuthService>();
builder.Services.AddScoped<IRatingService, RatingService>();
builder.Services.AddScoped<ITagService, TagService>();
builder.Services.AddScoped<IPlayerCertificationService, PlayerCertificationService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IPushNotificationService, PushNotificationService>();
builder.Services.AddScoped<IActivityAwardService, ActivityAwardService>();
builder.Services.AddScoped<IInstaGameService, InstaGameService>();
builder.Services.AddScoped<IDrawingBroadcaster, DrawingBroadcaster>();
builder.Services.AddScoped<IScoreBroadcaster, ScoreBroadcaster>();
builder.Services.AddScoped<IBracketProgressionService, BracketProgressionService>();
builder.Services.AddScoped<ISharedAssetService, SharedAssetService>();
builder.Services.AddScoped<IWaiverPdfService, WaiverPdfService>();
builder.Services.AddScoped<ISchedulingService, SchedulingService>();
builder.Services.AddScoped<ICourtAssignmentService>(sp => sp.GetRequiredService<ISchedulingService>() as ICourtAssignmentService
    ?? throw new InvalidOperationException("SchedulingService must implement ICourtAssignmentService"));
builder.Services.AddScoped<IEmailNotificationService, EmailNotificationService>();
builder.Services.AddScoped<ITournamentRegistrationService, TournamentRegistrationService>();
builder.Services.AddScoped<ITournamentPaymentService, TournamentPaymentService>();
builder.Services.AddScoped<ITournamentDrawingService, TournamentDrawingService>();
builder.Services.AddScoped<ITournamentFeeService, TournamentFeeService>();
builder.Services.AddScoped<ITournamentManagementService, TournamentManagementService>();
builder.Services.AddScoped<IVideoRoomService, VideoRoomService>();
builder.Services.AddScoped<IGameDayPlayerStatusService, GameDayPlayerStatusService>();
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient<IGeocodingService, GeocodingService>();

// CORS - Load allowed origins from configuration
var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowConfiguredOrigins", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
        {
            // Always allow same-host requests (no origin header or matching host)
            if (string.IsNullOrEmpty(origin))
                return true;

            var originUri = new Uri(origin);

            // Check if origin is in the configured list
            if (corsOrigins.Any(allowed =>
                origin.Equals(allowed, StringComparison.OrdinalIgnoreCase)))
                return true;

            // Allow localhost variants for development
            if (originUri.Host == "localhost" || originUri.Host == "127.0.0.1")
                return true;

            return false;
        })
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
// Enable Swagger in all environments for API testing
app.UseSwagger();
app.UseSwaggerUI();

app.UseCors("AllowConfiguredOrigins");
app.UseStaticFiles(); // Enable serving static files from wwwroot
app.UseAuthentication();
app.UseUserAutoSync(); // Auto-create local user from shared auth token if not exists
app.UseAuthorization();
app.MapControllers();
app.MapHub<ChatHub>("/hubs/chat");
app.MapHub<NotificationHub>("/hubs/notifications");
app.MapHub<DrawingHub>("/hubs/drawing");
app.MapHub<ScoreHub>("/hubs/scores");
app.MapHub<VideoRoomHub>("/hubs/videoroom");

// Verify database connectivity on startup
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    try
    {
        if (context.Database.CanConnect())
        {
            logger.LogInformation("Database connection successful.");
        }
        else
        {
            logger.LogError("Cannot connect to database. Please ensure the database exists and the connection string is correct.");
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Database connection failed on startup.");
    }

    // NOTE: SQL migrations are run manually before/after deploys.
    // Use Scripts/archives/ as reference. Do NOT auto-run migrations at startup.
    // See: sp_fxbackup for pre-deploy backups.

    // Seed phase templates if they don't exist
    try
    {
        await SeedPhaseTemplatesAsync(context, logger);
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Failed to seed phase templates. This can be done manually later.");
    }
}
Utility.Initialize(app.Configuration);

app.Run();

// NOTE: Auto-migration runner removed for safety (was root cause of Users table drop on 2026-02-02).
// Migration scripts in Scripts/archives/ are kept as reference — run manually via SSMS/sqlcmd.

/// <summary>
/// Seeds the default system phase templates if none exist.
/// </summary>
static async Task SeedPhaseTemplatesAsync(ApplicationDbContext context, ILogger logger)
{
    // Check if any system templates exist
    var hasTemplates = await context.PhaseTemplates.AnyAsync(t => t.IsSystemTemplate);
    if (hasTemplates)
    {
        logger.LogInformation("Phase templates already seeded.");
        return;
    }

    logger.LogInformation("Seeding phase templates...");

    var templates = new List<PhaseTemplate>
    {
        new PhaseTemplate
        {
            Name = "4-Team Single Elimination",
            Description = "Simple 4-team bracket: Semifinals -> Finals with optional 3rd place match",
            Category = "SingleElimination",
            MinUnits = 4, MaxUnits = 4, DefaultUnits = 4,
            IsSystemTemplate = true, SortOrder = 10,
            StructureJson = @"{
                ""phases"": [
                    { ""order"": 1, ""name"": ""Semifinals"", ""type"": ""BracketRound"", ""incomingSlots"": 4, ""exitingSlots"": 2, ""includeConsolation"": true },
                    { ""order"": 2, ""name"": ""Finals"", ""type"": ""BracketRound"", ""incomingSlots"": 2, ""exitingSlots"": 2 }
                ],
                ""advancementRules"": [
                    {""fromPhase"": 1, ""fromRank"": 1, ""toPhase"": 2, ""toSlot"": 1},
                    {""fromPhase"": 1, ""fromRank"": 2, ""toPhase"": 2, ""toSlot"": 2}
                ],
                ""exitPositions"": [
                    {""rank"": 1, ""label"": ""Champion"", ""awardType"": ""Gold""},
                    {""rank"": 2, ""label"": ""Runner-up"", ""awardType"": ""Silver""},
                    {""rank"": 3, ""label"": ""3rd Place"", ""awardType"": ""Bronze""},
                    {""rank"": 4, ""label"": ""4th Place""}
                ]
            }",
            DiagramText = "SF -> F (+ 3rd place)",
            Tags = "small,quick,beginner"
        },
        new PhaseTemplate
        {
            Name = "8-Team Single Elimination",
            Description = "Standard 8-team bracket: Quarterfinals -> Semifinals -> Finals",
            Category = "SingleElimination",
            MinUnits = 8, MaxUnits = 8, DefaultUnits = 8,
            IsSystemTemplate = true, SortOrder = 20,
            StructureJson = @"{
                ""phases"": [
                    { ""order"": 1, ""name"": ""Quarterfinals"", ""type"": ""BracketRound"", ""incomingSlots"": 8, ""exitingSlots"": 4 },
                    { ""order"": 2, ""name"": ""Semifinals"", ""type"": ""BracketRound"", ""incomingSlots"": 4, ""exitingSlots"": 2, ""includeConsolation"": true },
                    { ""order"": 3, ""name"": ""Finals"", ""type"": ""BracketRound"", ""incomingSlots"": 2, ""exitingSlots"": 2 }
                ],
                ""advancementRules"": [
                    {""fromPhase"": 1, ""fromRank"": 1, ""toPhase"": 2, ""toSlot"": 1},
                    {""fromPhase"": 1, ""fromRank"": 2, ""toPhase"": 2, ""toSlot"": 2},
                    {""fromPhase"": 1, ""fromRank"": 3, ""toPhase"": 2, ""toSlot"": 3},
                    {""fromPhase"": 1, ""fromRank"": 4, ""toPhase"": 2, ""toSlot"": 4},
                    {""fromPhase"": 2, ""fromRank"": 1, ""toPhase"": 3, ""toSlot"": 1},
                    {""fromPhase"": 2, ""fromRank"": 2, ""toPhase"": 3, ""toSlot"": 2}
                ],
                ""exitPositions"": [
                    {""rank"": 1, ""label"": ""Champion"", ""awardType"": ""Gold""},
                    {""rank"": 2, ""label"": ""Runner-up"", ""awardType"": ""Silver""},
                    {""rank"": 3, ""label"": ""3rd Place"", ""awardType"": ""Bronze""},
                    {""rank"": 4, ""label"": ""4th Place""}
                ]
            }",
            DiagramText = "QF -> SF -> F",
            Tags = "standard,popular"
        },
        new PhaseTemplate
        {
            Name = "16-Team Single Elimination",
            Description = "Large bracket: Round of 16 -> Quarterfinals -> Semifinals -> Finals",
            Category = "SingleElimination",
            MinUnits = 16, MaxUnits = 16, DefaultUnits = 16,
            IsSystemTemplate = true, SortOrder = 30,
            StructureJson = @"{
                ""phases"": [
                    { ""order"": 1, ""name"": ""Round of 16"", ""type"": ""BracketRound"", ""incomingSlots"": 16, ""exitingSlots"": 8 },
                    { ""order"": 2, ""name"": ""Quarterfinals"", ""type"": ""BracketRound"", ""incomingSlots"": 8, ""exitingSlots"": 4 },
                    { ""order"": 3, ""name"": ""Semifinals"", ""type"": ""BracketRound"", ""incomingSlots"": 4, ""exitingSlots"": 2, ""includeConsolation"": true },
                    { ""order"": 4, ""name"": ""Finals"", ""type"": ""BracketRound"", ""incomingSlots"": 2, ""exitingSlots"": 2 }
                ],
                ""advancementRules"": ""auto"",
                ""exitPositions"": [
                    {""rank"": 1, ""label"": ""Champion"", ""awardType"": ""Gold""},
                    {""rank"": 2, ""label"": ""Runner-up"", ""awardType"": ""Silver""},
                    {""rank"": 3, ""label"": ""3rd Place"", ""awardType"": ""Bronze""},
                    {""rank"": 4, ""label"": ""4th Place""}
                ]
            }",
            DiagramText = "R16 -> QF -> SF -> F",
            Tags = "large"
        },
        new PhaseTemplate
        {
            Name = "Round Robin (4 teams)",
            Description = "Everyone plays everyone. All 4 teams ranked at end.",
            Category = "RoundRobin",
            MinUnits = 4, MaxUnits = 4, DefaultUnits = 4,
            IsSystemTemplate = true, SortOrder = 40,
            StructureJson = @"{
                ""phases"": [
                    { ""order"": 1, ""name"": ""Round Robin"", ""type"": ""RoundRobin"", ""incomingSlots"": 4, ""exitingSlots"": 4 }
                ],
                ""exitPositions"": [
                    {""rank"": 1, ""label"": ""1st Place"", ""awardType"": ""Gold""},
                    {""rank"": 2, ""label"": ""2nd Place"", ""awardType"": ""Silver""},
                    {""rank"": 3, ""label"": ""3rd Place"", ""awardType"": ""Bronze""},
                    {""rank"": 4, ""label"": ""4th Place""}
                ]
            }",
            DiagramText = "All play all",
            Tags = "casual,everyone-plays"
        },
        new PhaseTemplate
        {
            Name = "Round Robin (8 teams)",
            Description = "Everyone plays everyone. All 8 teams ranked at end.",
            Category = "RoundRobin",
            MinUnits = 8, MaxUnits = 8, DefaultUnits = 8,
            IsSystemTemplate = true, SortOrder = 41,
            StructureJson = @"{
                ""phases"": [
                    { ""order"": 1, ""name"": ""Round Robin"", ""type"": ""RoundRobin"", ""incomingSlots"": 8, ""exitingSlots"": 8 }
                ],
                ""exitPositions"": [
                    {""rank"": 1, ""label"": ""1st Place"", ""awardType"": ""Gold""},
                    {""rank"": 2, ""label"": ""2nd Place"", ""awardType"": ""Silver""},
                    {""rank"": 3, ""label"": ""3rd Place"", ""awardType"": ""Bronze""}
                ]
            }",
            DiagramText = "All play all",
            Tags = "casual,everyone-plays"
        },
        new PhaseTemplate
        {
            Name = "2 Pools + Semifinals + Finals (8 teams)",
            Description = "Two pools of 4, top 2 from each advance to semifinals, then finals. Good balance of games.",
            Category = "Combined",
            MinUnits = 8, MaxUnits = 8, DefaultUnits = 8,
            IsSystemTemplate = true, SortOrder = 50,
            StructureJson = @"{
                ""phases"": [
                    { ""order"": 1, ""name"": ""Pool Play"", ""type"": ""Pools"", ""poolCount"": 2, ""incomingSlots"": 8, ""exitingSlots"": 4 },
                    { ""order"": 2, ""name"": ""Semifinals"", ""type"": ""BracketRound"", ""incomingSlots"": 4, ""exitingSlots"": 2, ""includeConsolation"": true },
                    { ""order"": 3, ""name"": ""Finals"", ""type"": ""BracketRound"", ""incomingSlots"": 2, ""exitingSlots"": 2 }
                ],
                ""advancementRules"": [
                    {""fromPhase"": 1, ""fromPool"": ""A"", ""fromRank"": 1, ""toPhase"": 2, ""toSlot"": 1},
                    {""fromPhase"": 1, ""fromPool"": ""B"", ""fromRank"": 1, ""toPhase"": 2, ""toSlot"": 2},
                    {""fromPhase"": 1, ""fromPool"": ""A"", ""fromRank"": 2, ""toPhase"": 2, ""toSlot"": 4},
                    {""fromPhase"": 1, ""fromPool"": ""B"", ""fromRank"": 2, ""toPhase"": 2, ""toSlot"": 3}
                ],
                ""seedingStrategy"": ""CrossPool"",
                ""exitPositions"": [
                    {""rank"": 1, ""label"": ""Champion"", ""awardType"": ""Gold""},
                    {""rank"": 2, ""label"": ""Runner-up"", ""awardType"": ""Silver""},
                    {""rank"": 3, ""label"": ""3rd Place"", ""awardType"": ""Bronze""},
                    {""rank"": 4, ""label"": ""4th Place""}
                ]
            }",
            DiagramText = "Pool A/B (4 each) -> SF -> F",
            Tags = "balanced,popular"
        },
        new PhaseTemplate
        {
            Name = "4 Pools + Bracket (16 teams)",
            Description = "Four pools of 4, top 2 from each advance to quarterfinals, then bracket play.",
            Category = "Combined",
            MinUnits = 16, MaxUnits = 16, DefaultUnits = 16,
            IsSystemTemplate = true, SortOrder = 51,
            StructureJson = @"{
                ""phases"": [
                    { ""order"": 1, ""name"": ""Pool Play"", ""type"": ""Pools"", ""poolCount"": 4, ""incomingSlots"": 16, ""exitingSlots"": 8 },
                    { ""order"": 2, ""name"": ""Quarterfinals"", ""type"": ""BracketRound"", ""incomingSlots"": 8, ""exitingSlots"": 4 },
                    { ""order"": 3, ""name"": ""Semifinals"", ""type"": ""BracketRound"", ""incomingSlots"": 4, ""exitingSlots"": 2, ""includeConsolation"": true },
                    { ""order"": 4, ""name"": ""Finals"", ""type"": ""BracketRound"", ""incomingSlots"": 2, ""exitingSlots"": 2 }
                ],
                ""advancementRules"": [
                    {""fromPhase"": 1, ""fromPool"": ""A"", ""fromRank"": 1, ""toPhase"": 2, ""toSlot"": 1},
                    {""fromPhase"": 1, ""fromPool"": ""B"", ""fromRank"": 1, ""toPhase"": 2, ""toSlot"": 4},
                    {""fromPhase"": 1, ""fromPool"": ""C"", ""fromRank"": 1, ""toPhase"": 2, ""toSlot"": 2},
                    {""fromPhase"": 1, ""fromPool"": ""D"", ""fromRank"": 1, ""toPhase"": 2, ""toSlot"": 3},
                    {""fromPhase"": 1, ""fromPool"": ""A"", ""fromRank"": 2, ""toPhase"": 2, ""toSlot"": 8},
                    {""fromPhase"": 1, ""fromPool"": ""B"", ""fromRank"": 2, ""toPhase"": 2, ""toSlot"": 5},
                    {""fromPhase"": 1, ""fromPool"": ""C"", ""fromRank"": 2, ""toPhase"": 2, ""toSlot"": 7},
                    {""fromPhase"": 1, ""fromPool"": ""D"", ""fromRank"": 2, ""toPhase"": 2, ""toSlot"": 6}
                ],
                ""seedingStrategy"": ""Snake"",
                ""exitPositions"": [
                    {""rank"": 1, ""label"": ""Champion"", ""awardType"": ""Gold""},
                    {""rank"": 2, ""label"": ""Runner-up"", ""awardType"": ""Silver""},
                    {""rank"": 3, ""label"": ""3rd Place"", ""awardType"": ""Bronze""},
                    {""rank"": 4, ""label"": ""4th Place""}
                ]
            }",
            DiagramText = "Pool A/B/C/D (4 each) -> QF -> SF -> F",
            Tags = "large,balanced"
        },
        new PhaseTemplate
        {
            Name = "8-Team Double Elimination",
            Description = "Double elimination: Winner's bracket and Loser's bracket, must lose twice to be eliminated.",
            Category = "DoubleElimination",
            MinUnits = 8, MaxUnits = 8, DefaultUnits = 8,
            IsSystemTemplate = true, SortOrder = 60,
            StructureJson = @"{
                ""phases"": [
                    { ""order"": 1, ""name"": ""Double Elimination Bracket"", ""type"": ""DoubleElimination"", ""incomingSlots"": 8, ""exitingSlots"": 4, ""settings"": { ""grandFinalReset"": true } }
                ],
                ""exitPositions"": [
                    {""rank"": 1, ""label"": ""Champion"", ""awardType"": ""Gold""},
                    {""rank"": 2, ""label"": ""Runner-up"", ""awardType"": ""Silver""},
                    {""rank"": 3, ""label"": ""3rd Place"", ""awardType"": ""Bronze""},
                    {""rank"": 4, ""label"": ""4th Place""}
                ]
            }",
            DiagramText = "WB + LB -> Grand Final",
            Tags = "competitive,fair"
        },
        new PhaseTemplate
        {
            Name = "Single Elimination (Flexible)",
            Description = "Adapts to any team count (4-32). Automatically calculates bracket size and byes.",
            Category = "SingleElimination",
            MinUnits = 4, MaxUnits = 32, DefaultUnits = 8,
            IsSystemTemplate = true, SortOrder = 5,
            StructureJson = @"{
                ""isFlexible"": true,
                ""generateBracket"": {
                    ""type"": ""SingleElimination"",
                    ""consolation"": true,
                    ""calculateByes"": true
                },
                ""exitPositions"": [
                    {""rank"": 1, ""label"": ""Champion"", ""awardType"": ""Gold""},
                    {""rank"": 2, ""label"": ""Runner-up"", ""awardType"": ""Silver""},
                    {""rank"": 3, ""label"": ""3rd Place"", ""awardType"": ""Bronze""},
                    {""rank"": 4, ""label"": ""4th Place""}
                ]
            }",
            DiagramText = "Auto-sizes bracket with byes",
            Tags = "flexible,recommended"
        },
        new PhaseTemplate
        {
            Name = "Pools + Bracket (Flexible)",
            Description = "Auto-configures pools based on team count, then bracket play for top finishers.",
            Category = "Combined",
            MinUnits = 6, MaxUnits = 32, DefaultUnits = 12,
            IsSystemTemplate = true, SortOrder = 6,
            StructureJson = @"{
                ""isFlexible"": true,
                ""generateFormat"": {
                    ""poolSize"": 4,
                    ""advancePerPool"": 2,
                    ""bracketType"": ""SingleElimination"",
                    ""consolation"": true
                },
                ""exitPositions"": [
                    {""rank"": 1, ""label"": ""Champion"", ""awardType"": ""Gold""},
                    {""rank"": 2, ""label"": ""Runner-up"", ""awardType"": ""Silver""},
                    {""rank"": 3, ""label"": ""3rd Place"", ""awardType"": ""Bronze""},
                    {""rank"": 4, ""label"": ""4th Place""}
                ]
            }",
            DiagramText = "Auto-pools -> bracket",
            Tags = "flexible,recommended"
        }
    };

    context.PhaseTemplates.AddRange(templates);
    await context.SaveChangesAsync();
    logger.LogInformation("Seeded {Count} phase templates.", templates.Count);
}

/// <summary>
/// Custom DateTime converter that preserves the date/time value without timezone conversion.
/// Serializes DateTime without 'Z' suffix and deserializes without assuming UTC.
/// </summary>
public class DateTimeConverterUsingDateTimeParse : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var dateString = reader.GetString();
        if (string.IsNullOrEmpty(dateString))
            return default;

        // Parse without assuming any timezone - treat as local/unspecified
        if (DateTime.TryParse(dateString, out var result))
        {
            return DateTime.SpecifyKind(result, DateTimeKind.Unspecified);
        }
        return default;
    }

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        // Write without 'Z' suffix - just the date and time
        writer.WriteStringValue(value.ToString("yyyy-MM-ddTHH:mm:ss"));
    }
}

/// <summary>
/// Custom nullable DateTime converter
/// </summary>
public class NullableDateTimeConverterUsingDateTimeParse : JsonConverter<DateTime?>
{
    public override DateTime? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var dateString = reader.GetString();
        if (string.IsNullOrEmpty(dateString))
            return null;

        if (DateTime.TryParse(dateString, out var result))
        {
            return DateTime.SpecifyKind(result, DateTimeKind.Unspecified);
        }
        return null;
    }

    public override void Write(Utf8JsonWriter writer, DateTime? value, JsonSerializerOptions options)
    {
        if (value.HasValue)
        {
            writer.WriteStringValue(value.Value.ToString("yyyy-MM-ddTHH:mm:ss"));
        }
        else
        {
            writer.WriteNullValue();
        }
    }
}
