-- AlterTable
ALTER TABLE "agent_invitations" ADD COLUMN IF NOT EXISTS "resolved_invitation_url" TEXT;
