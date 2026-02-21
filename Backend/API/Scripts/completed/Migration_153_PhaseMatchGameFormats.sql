-- Migration Script: Add PhaseMatchGameFormats table
-- Date: 2026-02-06
-- Description: Per-game score format settings for best-of-N matches
--              Allows different formats per game (e.g., Games 1-2 to 11, Game 3 to 15)

USE PickleballCommunity;
GO

-- Create PhaseMatchGameFormats table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('PhaseMatchGameFormats') AND type = 'U')
BEGIN
    CREATE TABLE PhaseMatchGameFormats (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        PhaseMatchSettingsId INT NOT NULL,
        GameNumber INT NOT NULL CHECK (GameNumber >= 1 AND GameNumber <= 5),
        ScoreFormatId INT NULL,
        EstimatedMinutes INT NULL,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
        
        CONSTRAINT FK_PhaseMatchGameFormats_PhaseMatchSettings 
            FOREIGN KEY (PhaseMatchSettingsId) REFERENCES PhaseMatchSettings(Id) ON DELETE CASCADE,
        CONSTRAINT FK_PhaseMatchGameFormats_ScoreFormat 
            FOREIGN KEY (ScoreFormatId) REFERENCES ScoreFormats(Id),
        CONSTRAINT UQ_PhaseMatchGameFormats_SettingsGame 
            UNIQUE (PhaseMatchSettingsId, GameNumber)
    );
    
    CREATE INDEX IX_PhaseMatchGameFormats_PhaseMatchSettingsId 
        ON PhaseMatchGameFormats(PhaseMatchSettingsId);
    
    PRINT 'Created PhaseMatchGameFormats table';
END
GO

PRINT 'Migration 153 (PhaseMatchGameFormats) completed!';
GO
