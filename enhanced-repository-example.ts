/**
 * Enhanced repository method to save both Minio URL and resolved invitation URL
 * This provides backward compatibility while adding direct URL access
 */

// In connection.repository.ts - update saveAgentConnectionInvitations method

async saveAgentConnectionInvitations(
  connectionInvitation: string,      // Minio URL
  agentId: string,
  orgId: string,
  invitationDid: string,
  resolvedInvitationUrl?: string     // NEW: Actual DIDComm URL
): Promise<agent_invitations> {
  try {
    const agentDetails = await this.prisma.agent_invitations.create({
      data: {
        orgId: String(orgId),
        agentId,
        connectionInvitation,                    // Minio URL (existing)
        resolved_invitation_url: resolvedInvitationUrl, // NEW: Actual URL
        multiUse: true,
        invitationDid
      }
    });
    return agentDetails;
  } catch (error) {
    this.logger.error(`Error in saveAgentConnectionInvitations: ${error.message}`);
    throw error;
  }
}

/**
 * New method to get invitation by orgId with preference for resolved URL
 */
async getInvitationUrlByOrgId(orgId: string): Promise<string | null> {
  try {
    const invitation = await this.prisma.agent_invitations.findFirst({
      where: { orgId },
      select: {
        resolved_invitation_url: true,
        connectionInvitation: true
      },
      orderBy: { createDateTime: 'desc' }
    });
    
    if (!invitation) {
      return null;
    }
    
    // Prefer resolved URL, fall back to connectionInvitation if needed
    return invitation.resolved_invitation_url || invitation.connectionInvitation;
  } catch (error) {
    this.logger.error(`Error in getInvitationUrlByOrgId: ${error.message}`);
    throw error;
  }
}
