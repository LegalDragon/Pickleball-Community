-- Migration 028: Club Member Roles
-- Allows admins to define custom member roles for clubs

PRINT 'Starting Migration 028: Club Member Roles...'

-- Create ClubMemberRoles table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ClubMemberRoles]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[ClubMemberRoles] (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [Name] NVARCHAR(50) NOT NULL,
        [Description] NVARCHAR(200) NULL,
        [Color] NVARCHAR(20) NULL,
        [SortOrder] INT NOT NULL DEFAULT 0,
        [IsSystemRole] BIT NOT NULL DEFAULT 0,  -- System roles cannot be deleted (Admin, Member)
        [CanManageMembers] BIT NOT NULL DEFAULT 0,  -- Can approve/remove members
        [CanManageClub] BIT NOT NULL DEFAULT 0,  -- Can edit club settings
        [CanPostAnnouncements] BIT NOT NULL DEFAULT 0,  -- Can post announcements
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );

    PRINT 'Created ClubMemberRoles table'

    -- Insert default system roles
    INSERT INTO [dbo].[ClubMemberRoles] ([Name], [Description], [Color], [SortOrder], [IsSystemRole], [CanManageMembers], [CanManageClub], [CanPostAnnouncements], [IsActive])
    VALUES
        ('Admin', 'Club administrator with full permissions', 'red', 0, 1, 1, 1, 1, 1),
        ('Moderator', 'Can manage members and post announcements', 'orange', 1, 0, 1, 0, 1, 1),
        ('Member', 'Regular club member', 'green', 100, 1, 0, 0, 0, 1);

    PRINT 'Inserted default club member roles'
END
ELSE
BEGIN
    PRINT 'ClubMemberRoles table already exists'
END

-- Create index on Name for faster lookups
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ClubMemberRoles_Name' AND object_id = OBJECT_ID('dbo.ClubMemberRoles'))
BEGIN
    CREATE UNIQUE INDEX [IX_ClubMemberRoles_Name] ON [dbo].[ClubMemberRoles]([Name]);
    PRINT 'Created unique index on ClubMemberRoles.Name'
END

-- Create index on SortOrder for ordering
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ClubMemberRoles_SortOrder' AND object_id = OBJECT_ID('dbo.ClubMemberRoles'))
BEGIN
    CREATE INDEX [IX_ClubMemberRoles_SortOrder] ON [dbo].[ClubMemberRoles]([SortOrder]);
    PRINT 'Created index on ClubMemberRoles.SortOrder'
END

PRINT 'Migration 028 completed successfully!'
