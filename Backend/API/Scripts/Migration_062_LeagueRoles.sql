-- Migration 062: League Roles
-- Creates configurable roles for league managers
-- Date: 2026-01-07

PRINT 'Starting Migration 062: League Roles'

-- Create LeagueRoles table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LeagueRoles')
BEGIN
    CREATE TABLE LeagueRoles (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(50) NOT NULL,
        Description NVARCHAR(200) NULL,
        Color NVARCHAR(20) NULL,
        Icon NVARCHAR(50) NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        IsSystemRole BIT NOT NULL DEFAULT 0,
        CanManageLeague BIT NOT NULL DEFAULT 0,
        CanManageMembers BIT NOT NULL DEFAULT 0,
        CanManageClubs BIT NOT NULL DEFAULT 0,
        CanManageDocuments BIT NOT NULL DEFAULT 0,
        CanApproveRequests BIT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    )
    PRINT 'Created LeagueRoles table'
END
ELSE
    PRINT 'LeagueRoles table already exists'

-- Seed default league roles
IF NOT EXISTS (SELECT * FROM LeagueRoles WHERE IsSystemRole = 1)
BEGIN
    INSERT INTO LeagueRoles (Name, Description, Color, Icon, SortOrder, IsSystemRole, CanManageLeague, CanManageMembers, CanManageClubs, CanManageDocuments, CanApproveRequests, IsActive)
    VALUES
        ('President', 'League president with full administrative access', 'purple', 'Crown', 10, 1, 1, 1, 1, 1, 1, 1),
        ('Vice President', 'Second in command with most administrative access', 'indigo', 'Shield', 20, 1, 1, 1, 1, 1, 1, 1),
        ('Director', 'Regional or functional director', 'blue', 'Briefcase', 30, 0, 0, 1, 1, 1, 1, 1),
        ('Secretary', 'Manages documentation and communications', 'teal', 'ClipboardList', 40, 0, 0, 0, 0, 1, 0, 1),
        ('Treasurer', 'Manages financial matters', 'green', 'DollarSign', 50, 0, 0, 0, 0, 0, 0, 1),
        ('Admin', 'General administrative access', 'orange', 'Settings', 60, 1, 0, 1, 1, 1, 1, 1),
        ('Moderator', 'Basic moderation capabilities', 'gray', 'UserCog', 70, 0, 0, 0, 0, 0, 0, 1)
    PRINT 'Seeded default league roles'
END
ELSE
    PRINT 'Default league roles already exist'

-- Create index for performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LeagueRoles_IsActive_SortOrder')
BEGIN
    CREATE INDEX IX_LeagueRoles_IsActive_SortOrder ON LeagueRoles(IsActive, SortOrder)
    PRINT 'Created index IX_LeagueRoles_IsActive_SortOrder'
END

PRINT 'Migration 062 completed'
