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

                // If the request is for the SignalR hub
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/chat"))
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
        client.BaseAddress = new Uri(baseUrl);
    }
    client.Timeout = TimeSpan.FromSeconds(30);
});

// Services
builder.Services.AddScoped<IAssetService, AssetService>();
builder.Services.AddScoped<IFileStorageService, AwsS3StorageService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ISharedAuthService, SharedAuthService>();
builder.Services.AddScoped<IRatingService, RatingService>();
builder.Services.AddScoped<ITagService, TagService>();
builder.Services.AddScoped<IPlayerCertificationService, PlayerCertificationService>();

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

// Initialize database
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    try
    {
        // Check if database can be connected to
        if (context.Database.CanConnect())
        {
            logger.LogInformation("Database connection successful. Database already exists.");
        }
        else
        {
            logger.LogInformation("Database does not exist. Attempting to create...");
            context.Database.EnsureCreated();
            logger.LogInformation("Database created successfully.");
        }
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Database initialization warning. This may be normal if the database already exists or was created manually.");

        // Try to ensure tables exist even if database creation failed
        try
        {
            if (context.Database.CanConnect())
            {
                logger.LogInformation("Database is accessible. Ensuring schema is up to date...");
                // Tables should already exist if database was created manually
            }
        }
        catch (Exception innerEx)
        {
            logger.LogError(innerEx, "Failed to connect to database. Please ensure the database exists and the connection string is correct.");
            throw;
        }
    }
}
Utility.Initialize(app.Configuration);

app.Run();

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
