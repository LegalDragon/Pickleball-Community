-- Migration_055_RenameRoles.sql
-- Rename 'Student' role to 'Player' and 'Coach' role to 'Manager'

PRINT 'Starting Migration_055_RenameRoles...'
GO

-- Step 1: Update existing users with 'Student' role to 'Player'
IF EXISTS (SELECT 1 FROM Users WHERE Role = 'Student')
BEGIN
    PRINT 'Updating Student roles to Player...'
    UPDATE Users SET Role = 'Player' WHERE Role = 'Student'
    PRINT 'Updated ' + CAST(@@ROWCOUNT AS VARCHAR) + ' users from Student to Player'
END
GO

-- Step 2: Update existing users with 'Coach' role to 'Manager'
IF EXISTS (SELECT 1 FROM Users WHERE Role = 'Coach')
BEGIN
    PRINT 'Updating Coach roles to Manager...'
    UPDATE Users SET Role = 'Manager' WHERE Role = 'Coach'
    PRINT 'Updated ' + CAST(@@ROWCOUNT AS VARCHAR) + ' users from Coach to Manager'
END
GO

-- Step 3: Drop the old constraint
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_Role')
BEGIN
    PRINT 'Dropping old CK_Users_Role constraint...'
    ALTER TABLE Users DROP CONSTRAINT CK_Users_Role
END
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_New_Role')
BEGIN
    PRINT 'Dropping old CK_Users_New_Role constraint...'
    ALTER TABLE Users DROP CONSTRAINT CK_Users_New_Role
END
GO

-- Step 4: Add new constraint with updated roles
PRINT 'Adding new role constraint...'
ALTER TABLE Users ADD CONSTRAINT CK_Users_Role CHECK (Role IN ('Manager', 'Player', 'Admin'))
GO

-- Step 5: Update the default value for Role column
PRINT 'Updating default value for Role column...'
-- First drop any existing default constraint
DECLARE @DefaultConstraintName NVARCHAR(256)
SELECT @DefaultConstraintName = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE dc.parent_object_id = OBJECT_ID('Users') AND c.name = 'Role'

IF @DefaultConstraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE Users DROP CONSTRAINT ' + @DefaultConstraintName)
    PRINT 'Dropped default constraint: ' + @DefaultConstraintName
END
GO

-- Add new default
ALTER TABLE Users ADD CONSTRAINT DF_Users_Role DEFAULT 'Player' FOR Role
GO

PRINT 'Migration_055_RenameRoles completed successfully!'
GO
