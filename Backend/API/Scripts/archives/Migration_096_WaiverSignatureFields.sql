-- Migration_096_WaiverSignatureFields.sql
-- Add digital signature fields to EventUnitMembers for waiver signing

PRINT 'Starting Migration_096_WaiverSignatureFields...'

-- Add signature fields to EventUnitMembers
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'WaiverSignature')
BEGIN
    ALTER TABLE EventUnitMembers ADD WaiverSignature NVARCHAR(200) NULL;
    PRINT 'Added WaiverSignature column to EventUnitMembers'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'WaiverSignerRole')
BEGIN
    -- SignerRole: Participant, Parent, Guardian
    ALTER TABLE EventUnitMembers ADD WaiverSignerRole NVARCHAR(20) NULL;
    PRINT 'Added WaiverSignerRole column to EventUnitMembers'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'ParentGuardianName')
BEGIN
    ALTER TABLE EventUnitMembers ADD ParentGuardianName NVARCHAR(200) NULL;
    PRINT 'Added ParentGuardianName column to EventUnitMembers'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'EmergencyPhone')
BEGIN
    ALTER TABLE EventUnitMembers ADD EmergencyPhone NVARCHAR(30) NULL;
    PRINT 'Added EmergencyPhone column to EventUnitMembers'
END

-- Add ChineseName field to EventUnitMembers for tournaments that require it
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'ChineseName')
BEGIN
    ALTER TABLE EventUnitMembers ADD ChineseName NVARCHAR(100) NULL;
    PRINT 'Added ChineseName column to EventUnitMembers'
END

-- Add RequiresMinorWaiver flag to EventWaivers to indicate if waiver needs parent/guardian signature for minors
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventWaivers') AND name = 'RequiresMinorWaiver')
BEGIN
    ALTER TABLE EventWaivers ADD RequiresMinorWaiver BIT NOT NULL DEFAULT 0;
    PRINT 'Added RequiresMinorWaiver column to EventWaivers'
END

-- Add MinorAgeThreshold to specify age below which parent/guardian signature is needed
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventWaivers') AND name = 'MinorAgeThreshold')
BEGIN
    ALTER TABLE EventWaivers ADD MinorAgeThreshold INT NOT NULL DEFAULT 18;
    PRINT 'Added MinorAgeThreshold column to EventWaivers'
END

PRINT 'Completed Migration_096_WaiverSignatureFields'
