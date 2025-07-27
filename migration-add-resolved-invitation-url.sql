-- Migration to add resolved invitation URL column to agent_invitations table
-- This will store the actual DIDComm invitation URL instead of just the Minio URL

ALTER TABLE agent_invitations 
ADD COLUMN resolved_invitation_url TEXT;

-- Create index for better query performance
CREATE INDEX idx_agent_invitations_resolved_url 
ON agent_invitations(resolved_invitation_url) 
WHERE resolved_invitation_url IS NOT NULL;

-- Update existing records to resolve their Minio URLs
-- This would need to be done as a data migration script
UPDATE agent_invitations 
SET resolved_invitation_url = NULL 
WHERE connectionInvitation LIKE 'https://minio.confamd.com%';

-- Add comment to document the column
COMMENT ON COLUMN agent_invitations.resolved_invitation_url IS 'Stores the actual DIDComm invitation URL resolved from Minio storage for direct access';
