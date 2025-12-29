
using System.Configuration; // For .NET Framework
using System.Data;
using System.Data.Common;
using System.Linq;
using System.Net;
using System.Net.Http.Headers;
using System.Runtime.InteropServices.Marshalling;
using Microsoft.Extensions.Configuration; // For .NET Core+
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Twilio.Rest.Trunking.V1;
using static System.Net.WebRequestMethods;


public static class Utility
{
    public static byte[] Sha256(byte[] bytes) { using var sha = System.Security.Cryptography.SHA256.Create(); return sha.ComputeHash(bytes); }
    public static byte[] Rnd(int n) { var b = new byte[n]; System.Security.Cryptography.RandomNumberGenerator.Fill(b); return b; }



    private static IConfiguration? _config;

    public static void Initialize(IConfiguration config)
    {
        _config = config;
    }
    public static string? GetSetting(string key)
    {
        return _config?[key];
    }
    public static string GetAppSetting(string key)
    {
        return _config[key];
    }
    // Example: Read a single value


    public static string UploadRootPath => _config.GetSection("FileUpload:UploadPath").Value;

    public static string DefaultAssetRoot => _config["PIESettings:DocVaultAssetsRoot"];

    // Example: Read a nested section
    public static string ErrorLogFile => _config.GetSection("PIESettings:ErrorLogFile").Value;
    public static string DefaultConnectionString => _config.GetConnectionString("Default");

    public static string GetConnectionString(string ConCode) => _config.GetConnectionString(ConCode);

    // Example: Get an entire section as an object (requires matching class)
    public static T GetSection<T>(string sectionName) where T : new()
    {
        var section = new T();
        _config.GetSection(sectionName).Bind(section);
        return section;
    }
    //public static string DefaultConnectionString2 { get; set; } =
    //    new ConfigurationBuilder()
    //.AddJsonFile("appsettings.json")
    //.Build()
    //.GetConnectionString("FunTime");
     
    public static string DefaultErrorLogFile { get; set; }
    public static string GetSharedData()
    {
        return "This is shared data";
    }
    public static void LogError(Exception ex)
    {
        WritetoLog("Error", string.Format(" Source: {0}\r\n Message: {1} \r\n Trace: {2}\r\n",
              ex.Source, ex.Message, ex.StackTrace));
    }
    public static void LogInfo(string msg)
    {
        WritetoLog("Info", msg);
    }
    public static void WritetoLog(string msgtype, string msg)
    {
        // string ErrorFile = Utility.DefaultErrorLogFile; 
        // Example: Log error to a text file
        System.IO.File.AppendAllText(DefaultErrorLogFile,
            string.Format("\r\n__{0}___________________\r\n__{1}\r\n{2}\r\n",
            msgtype, DateTime.Now, msg));

    }
    public static string GetClientIpAddress(HttpContext httpContext)
    {

        if (httpContext.Request.Headers.TryGetValue("CF-Connecting-IP", out var cloudflareIp))
        {
            return cloudflareIp.ToString();
        }


        if (httpContext.Request.Headers.ContainsKey("X-Forwarded-For"))
        {
            return httpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        }

        return httpContext.Connection.RemoteIpAddress?.ToString();

    }

    public static RequestHeaderInfo ParseRequestHeader(HttpContext httpContext)
    {

        //'Authorization': authToken != null ? 'Bearer $authToken' : null,
        // 'X-User-ID': currentUserId,
        // 'X-Device-ID': deviceId,
        // 'X-Platform': platform,
        RequestHeaderInfo RH = new RequestHeaderInfo();
        RH.ipAddress = GetClientIpAddress(httpContext);

        if (httpContext.Request.Headers.ContainsKey("X-Device-ID"))
        {
            RH.deviceId = httpContext.Request.Headers["X-Device-ID"].FirstOrDefault();
        }


        if (httpContext.Request.Headers.ContainsKey("X-User-ID"))
        {
            RH.currentUserId = httpContext.Request.Headers["X-User-ID"].FirstOrDefault();
        }


        if (httpContext.Request.Headers.ContainsKey("X-Platform"))
        {
            RH.platform = httpContext.Request.Headers["X-Platform"].FirstOrDefault();
        }


        if (httpContext.Request.Headers.ContainsKey("Authorization"))
        {
            RH.authToken = httpContext.Request.Headers["Authorization"].FirstOrDefault();
            if (RH.authToken.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                RH.authToken = RH.authToken.Substring("Bearer ".Length).Trim();
            }
        }


        return RH;
    }

    public static string ConvertDSToJson(DataSet DS, string Cols = "")
    {
        if (DS.Tables.Count == 0)
        {
            return "";
        }
        DataTable dt = DS.Tables[0];
        return ConvertDataTableToJson(dt, Cols);
    }


    public static string ConvertDataTableToJson(DataTable dataTable, string Cols = "")
    {
        if (!string.IsNullOrEmpty(Cols))
        {
            var columns = Cols.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);


            var jsonData = new List<JObject>();

            // Iterate through each row in the DataTable
            foreach (DataRow row in dataTable.Rows)
            {
                // Create a JSON object for the current row
                var rowObject = new JObject();

                // Add only the selected columns to the JSON object
                foreach (var column in columns)
                {
                    if (dataTable.Columns.Contains(column.Trim()))
                    {
                        string columnName = column.Trim();
                        rowObject[columnName] = JToken.FromObject(row[columnName]);
                    }

                }

                // Add the row object to the list
                jsonData.Add(rowObject);
            }


            return JsonConvert.SerializeObject(jsonData);
        }

        var rows = dataTable.AsEnumerable()
                            .Select(row => dataTable.Columns.Cast<DataColumn>()
                                .ToDictionary(column => column.ColumnName, column => row[column]));

        return JsonConvert.SerializeObject(rows);
    }


    public static string ConvertFirstRowToJson(DataSet DS, string Cols = "")
    {

        if (DS.Tables.Count == 0)
        {
            return "";
        }
        DataTable dt = DS.Tables[0];
        return ConvertFirstRowToJson(dt, Cols);
    }
    public static string ConvertFirstRowToJson(DataTable dataTable, string Cols = "")
    {


        // Iterate through each row in the DataTable
        DataRow row = dataTable.Rows[0];
        if (!string.IsNullOrEmpty(Cols))
        {
            var columns = Cols.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);



            // Create a JSON object for the current row
            var rowObject = new JObject();

            // Add only the selected columns to the JSON object
            foreach (var column in columns)
            {
                if (dataTable.Columns.Contains(column.Trim()))
                {
                    string columnName = column.Trim();
                    rowObject[columnName] = JToken.FromObject(row[columnName]);
                }
            }



            return JsonConvert.SerializeObject(rowObject);
        }

        var rowDictionary = new Dictionary<string, object>();

        foreach (DataColumn column in dataTable.Columns)
        {
            rowDictionary[column.ColumnName] = row[column];
        }

        return JsonConvert.SerializeObject(rowDictionary);

    }
 
    public static string GetContentType(string fileName)
    {
        // Extract the file extension (e.g., ".pdf", ".jpg", ".txt")
        var extension = Path.GetExtension(fileName).ToLowerInvariant();

        // Map file extensions to MIME types
        return extension switch
        {
            // Documents
            ".pdf" => "application/pdf",           // PDF files
            ".txt" => "text/plain",               // Plain text
            ".csv" => "text/csv",                 // CSV files
            ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // Excel
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // Word

            // Images
            ".jpg" or ".jpeg" => "image/jpeg",    // JPEG images
            ".png" => "image/png",                // PNG images
            ".gif" => "image/gif",                // GIF images
            ".svg" => "image/svg+xml",            // SVG images

            // Audio/Video
            ".mp4" => "video/mp4",                // MP4 videos
            ".mp3" => "audio/mpeg",               // MP3 audio
            ".wav" => "audio/wav",                // WAV audio

            // Archives
            ".zip" => "application/zip",          // ZIP files
            ".rar" => "application/x-rar-compressed", // RAR files

            // Web files
            ".html" => "text/html",               // HTML files
            ".css" => "text/css",                 // CSS files
            ".js" => "application/javascript",    // JavaScript files
            ".json" => "application/json",        // JSON files

            // Default for unknown types
            _ => "application/octet-stream"       // Generic binary file
        };
    }
}
public class RequestHeaderInfo
{
    //'Authorization': authToken != null ? 'Bearer $authToken' : null,
    // 'X-User-ID': currentUserId,
    // 'X-Device-ID': deviceId,
    // 'X-Platform': platform,

    public string authToken { get; set; }
    public string currentUserId { get; set; }
    public string deviceId { get; set; }
    public string platform { get; set; }

    public string ipAddress { get; set; }
    public RequestHeaderInfo()
    {
        this.authToken = "";
        this.currentUserId = "";
        this.deviceId = "";
        this.platform = "";
        this.ipAddress = "";

    }
    public RequestHeaderInfo(string authToken, string currentUserId, string deviceId, string platform, string ipAddress)
    {
        this.authToken = authToken;
        this.currentUserId = currentUserId;
        this.deviceId = deviceId;
        this.platform = platform;
        this.ipAddress = ipAddress;

    }
}




public static class HttpUtils
{
    private static readonly HttpClient _httpClient = new HttpClient();

    static HttpUtils()
    {
        // Configure default settings
        _httpClient.DefaultRequestHeaders.Accept.Clear();
        _httpClient.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/json"));
        _httpClient.Timeout = TimeSpan.FromSeconds(30);
    }

    public static async Task<string> HttpGetAsync(
        string url,
        string authToken = null,
        Dictionary<string, string> headers = null,
        string mediaType = "application/json")
    {
        try
        {
            using (var request = new HttpRequestMessage(HttpMethod.Get, url))
            {
                if (!string.IsNullOrEmpty(authToken))
                {
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", authToken);
                }

                if (headers != null)
                {
                    foreach (var header in headers)
                    {
                        request.Headers.Add(header.Key, header.Value);
                    }
                }

                request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue(mediaType));

                var response = await _httpClient.SendAsync(request);

                if (response.StatusCode == HttpStatusCode.Unauthorized)
                {
                    throw new UnauthorizedAccessException("Access to the resource is unauthorized");
                }

                response.EnsureSuccessStatusCode();
                return await response.Content.ReadAsStringAsync();
            }
        }
        catch (HttpRequestException ex)
        {
            throw new ApplicationException($"HTTP request to {url} failed: {ex.Message}", ex);
        }
    }
}
