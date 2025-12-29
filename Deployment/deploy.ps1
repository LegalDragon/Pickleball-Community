# Deployment script for Pickleball.College
param(
    [string]$Environment = ""Development"",
    [string]$ConnectionString = ""Server=localhost;Database=PickleballCollege;Trusted_Connection=true;TrustServerCertificate=true""
)

Write-Host ""Deploying Pickleball.College in $Environment mode..."" -ForegroundColor Green

# Build the solution
Write-Host ""Building solution..."" -ForegroundColor Yellow
dotnet build

# Run database migrations
Write-Host ""Running database migrations..."" -ForegroundColor Yellow
dotnet ef database update --project Pickleball.College.API

Write-Host ""Deployment completed successfully!"" -ForegroundColor Green
