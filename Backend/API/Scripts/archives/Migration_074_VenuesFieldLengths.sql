-- Migration 074: Increase Venues field lengths
-- Prevents "String or binary data would be truncated" errors

PRINT 'Starting Migration 074: Increase Venues field lengths';

-- Increase Name to 200 characters
IF COL_LENGTH('Venues', 'Name') IS NOT NULL AND COL_LENGTH('Venues', 'Name') < 200
BEGIN
    PRINT 'Increasing Name column length to 200';
    ALTER TABLE Venues ALTER COLUMN [Name] NVARCHAR(200);
END

-- Increase Addr1 to 200 characters
IF COL_LENGTH('Venues', 'Addr1') IS NOT NULL AND COL_LENGTH('Venues', 'Addr1') < 200
BEGIN
    PRINT 'Increasing Addr1 column length to 200';
    ALTER TABLE Venues ALTER COLUMN Addr1 NVARCHAR(200);
END

-- Increase Addr2 to 200 characters
IF COL_LENGTH('Venues', 'Addr2') IS NOT NULL AND COL_LENGTH('Venues', 'Addr2') < 200
BEGIN
    PRINT 'Increasing Addr2 column length to 200';
    ALTER TABLE Venues ALTER COLUMN Addr2 NVARCHAR(200);
END

-- Increase City to 100 characters
IF COL_LENGTH('Venues', 'City') IS NOT NULL AND COL_LENGTH('Venues', 'City') < 100
BEGIN
    PRINT 'Increasing City column length to 100';
    ALTER TABLE Venues ALTER COLUMN City NVARCHAR(100);
END

-- Increase State to 100 characters
IF COL_LENGTH('Venues', 'State') IS NOT NULL AND COL_LENGTH('Venues', 'State') < 100
BEGIN
    PRINT 'Increasing State column length to 100';
    ALTER TABLE Venues ALTER COLUMN [State] NVARCHAR(100);
END

-- Increase County to 100 characters
IF COL_LENGTH('Venues', 'County') IS NOT NULL AND COL_LENGTH('Venues', 'County') < 100
BEGIN
    PRINT 'Increasing County column length to 100';
    ALTER TABLE Venues ALTER COLUMN County NVARCHAR(100);
END

-- Increase Country to 100 characters
IF COL_LENGTH('Venues', 'Country') IS NOT NULL AND COL_LENGTH('Venues', 'Country') < 100
BEGIN
    PRINT 'Increasing Country column length to 100';
    ALTER TABLE Venues ALTER COLUMN Country NVARCHAR(100);
END

-- Increase WWW (Website) to 500 characters
IF COL_LENGTH('Venues', 'WWW') IS NOT NULL AND COL_LENGTH('Venues', 'WWW') < 500
BEGIN
    PRINT 'Increasing WWW column length to 500';
    ALTER TABLE Venues ALTER COLUMN WWW NVARCHAR(500);
END

-- Increase EMail to 200 characters
IF COL_LENGTH('Venues', 'EMail') IS NOT NULL AND COL_LENGTH('Venues', 'EMail') < 200
BEGIN
    PRINT 'Increasing EMail column length to 200';
    ALTER TABLE Venues ALTER COLUMN EMail NVARCHAR(200);
END

-- Increase Phone to 50 characters
IF COL_LENGTH('Venues', 'Phone') IS NOT NULL AND COL_LENGTH('Venues', 'Phone') < 50
BEGIN
    PRINT 'Increasing Phone column length to 50';
    ALTER TABLE Venues ALTER COLUMN Phone NVARCHAR(50);
END

PRINT 'Migration 074 completed: Venues field lengths increased';
GO
