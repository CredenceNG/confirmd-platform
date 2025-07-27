/**
 * Enhanced connection service methods to handle both Minio URLs and resolved invitation URLs
 * This approach maintains backward compatibility while adding the resolved URL capability
 */

// In connection.service.ts - modify the saveAgentConnectionInvitations method

async createConnectionInvitation(payload: ICreateOutOfbandConnectionInvitation): Promise<ICreateConnectionUrl> {
  try {
    // ... existing code ...

    const createConnectionInvitation = await this._createOutOfBandConnectionInvitation(connectionPayload, url, orgId);
    const connectionInvitationUrl = createConnectionInvitation?.response?.invitationUrl;
    
    // Store the original invitation URL in Minio (for backward compatibility)
    const shortenedUrl = await this.storeConnectionObjectAndReturnUrl(
      connectionInvitationUrl,
      connectionPayload.multiUseInvitation
    );

    // Convert internal URLs to external Cloudflare URLs for wallet accessibility
    const resolvedInvitationUrl = connectionInvitationUrl
      .replace(
        /http:\/\/f856e3a4-b09c-4356-82de-b105594eec43_Platform-admin:8002/g,
        "https://platform-admin.confamd.com"
      )
      .replace(
        /http:\/\/.*_Platform-admin:8002/g,
        "https://platform-admin.confamd.com"
      )
      .replace(
        /http:\/\/host\.docker\.internal:8002/g,
        "https://platform-admin.confamd.com"
      )
      .replace(
        /http:\/\/localhost:8002/g,
        "https://platform-admin.confamd.com"
      );

    const invitationsDid = createConnectionInvitation?.response?.invitationDid || invitationDid;
    
    // Save both the Minio URL and the resolved URL
    const saveConnectionDetails = await this.connectionRepository.saveAgentConnectionInvitations(
      shortenedUrl,              // Minio URL (for backward compatibility)
      agentId,
      orgId,
      invitationsDid,
      resolvedInvitationUrl      // NEW: Actual DIDComm URL
    );

    // ... rest of existing code ...
    return connectionStorePayload;
  } catch (error) {
    this.logger.error(`[createConnectionInvitation] - error in connection oob invitation: ${error}`);
    this.handleError(error);
  }
}
