-- Migration 009: Add 'Pending' status to TrainingSessions CHECK constraint
-- This enables the session request/confirmation workflow

-- Drop the existing constraint
ALTER TABLE TrainingSessions DROP CONSTRAINT CK_TrainingSessions_Status;

-- Add the updated constraint with 'Pending' status
ALTER TABLE TrainingSessions ADD CONSTRAINT CK_TrainingSessions_Status
    CHECK (Status IN ('Pending', 'Scheduled', 'Completed', 'Cancelled'));

-- Update any existing sessions without explicit status to 'Scheduled'
UPDATE TrainingSessions SET Status = 'Scheduled' WHERE Status IS NULL;
