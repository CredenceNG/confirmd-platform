import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { URL } from 'url';

export interface QRCodeOptions {
  size?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

export interface InvitationQRData {
  invitationUrl: string;
  qrCodeDataUrl: string;
  deepLinkUrl: string;
  qrCodeSize: number;
  expiresAt?: string;
}

@Injectable()
export class QRCodeService {
  private readonly logger = new Logger(QRCodeService.name);
  private readonly defaultOptions: QRCodeOptions = {
    size: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    errorCorrectionLevel: 'M'
  };

  /**
   * Generate QR code for connection invitation URL
   */
  async generateInvitationQR(
    invitationUrl: string,
    options: QRCodeOptions = {}
  ): Promise<InvitationQRData> {
    try {
      this.logger.log('Generating QR code for invitation URL', {
        urlLength: invitationUrl.length,
        hasOptions: 0 < Object.keys(options).length
      });

      // Validate invitation URL
      if (!this.isValidInvitationUrl(invitationUrl)) {
        throw new Error('Invalid invitation URL format');
      }

      // Merge options with defaults
      const qrOptions = { ...this.defaultOptions, ...options };

      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(invitationUrl, {
        width: qrOptions.size,
        margin: qrOptions.margin,
        color: qrOptions.color,
        errorCorrectionLevel: qrOptions.errorCorrectionLevel
      });

      // Create deep link URL for mobile apps
      const deepLinkUrl = this.createDeepLinkUrl(invitationUrl);

      const result: InvitationQRData = {
        invitationUrl,
        qrCodeDataUrl,
        deepLinkUrl,
        qrCodeSize: qrOptions.size || 300
      };

      this.logger.log('QR code generated successfully', {
        dataUrlLength: qrCodeDataUrl.length,
        deepLinkUrl
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to generate QR code', error);
      throw new Error(`QR code generation failed: ${error.message}`);
    }
  }

  /**
   * Generate QR code with deep link for mobile app
   */
  async generateDeepLinkQR(
    invitationUrl: string,
    walletScheme: string = 'confirmdwallet',
    options: QRCodeOptions = {}
  ): Promise<InvitationQRData> {
    try {
      this.logger.log('Generating deep link QR code', {
        walletScheme,
        urlLength: invitationUrl.length
      });

      // Create deep link URL
      const deepLinkUrl = this.createDeepLinkUrl(invitationUrl, walletScheme);

      // Generate QR code for deep link
      const qrOptions = { ...this.defaultOptions, ...options };
      const qrCodeDataUrl = await QRCode.toDataURL(deepLinkUrl, {
        width: qrOptions.size,
        margin: qrOptions.margin,
        color: qrOptions.color,
        errorCorrectionLevel: qrOptions.errorCorrectionLevel
      });

      const result: InvitationQRData = {
        invitationUrl,
        qrCodeDataUrl,
        deepLinkUrl,
        qrCodeSize: qrOptions.size || 300
      };

      this.logger.log('Deep link QR code generated successfully', {
        deepLinkUrl
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to generate deep link QR code', error);
      throw new Error(`Deep link QR code generation failed: ${error.message}`);
    }
  }

  /**
   * Generate multiple QR code formats for maximum compatibility
   */
  async generateMultiFormatQR(
    invitationUrl: string,
    walletScheme: string = 'confirmdwallet',
    options: QRCodeOptions = {}
  ): Promise<{
    standard: InvitationQRData;
    deepLink: InvitationQRData;
    universal: InvitationQRData;
  }> {
    try {
      this.logger.log('Generating multi-format QR codes', {
        walletScheme,
        urlLength: invitationUrl.length
      });

      // Generate standard QR code (direct invitation URL)
      const standard = await this.generateInvitationQR(invitationUrl, options);

      // Generate deep link QR code (mobile app specific)
      const deepLink = await this.generateDeepLinkQR(
        invitationUrl,
        walletScheme,
        options
      );

      // Generate universal QR code (works with both web and mobile)
      const universalUrl = this.createUniversalUrl(invitationUrl, walletScheme);
      const universal = await this.generateInvitationQR(universalUrl, options);

      this.logger.log('Multi-format QR codes generated successfully');

      return {
        standard,
        deepLink,
        universal
      };
    } catch (error) {
      this.logger.error('Failed to generate multi-format QR codes', error);
      throw new Error(
        `Multi-format QR code generation failed: ${error.message}`
      );
    }
  }

  /**
   * Generate QR code for credential offer
   */
  async generateCredentialOfferQR(
    credentialOffer: any,
    options: QRCodeOptions = {}
  ): Promise<InvitationQRData> {
    try {
      this.logger.log('Generating QR code for credential offer', {
        offerId: credentialOffer.id || 'unknown'
      });

      // Create credential offer URL
      const offerUrl = this.createCredentialOfferUrl(credentialOffer);

      return await this.generateInvitationQR(offerUrl, options);
    } catch (error) {
      this.logger.error('Failed to generate credential offer QR code', error);
      throw new Error(
        `Credential offer QR code generation failed: ${error.message}`
      );
    }
  }

  /**
   * Generate QR code for proof request
   */
  async generateProofRequestQR(
    proofRequest: any,
    options: QRCodeOptions = {}
  ): Promise<InvitationQRData> {
    try {
      this.logger.log('Generating QR code for proof request', {
        requestId: proofRequest.id || 'unknown'
      });

      // Create proof request URL
      const requestUrl = this.createProofRequestUrl(proofRequest);

      return await this.generateInvitationQR(requestUrl, options);
    } catch (error) {
      this.logger.error('Failed to generate proof request QR code', error);
      throw new Error(
        `Proof request QR code generation failed: ${error.message}`
      );
    }
  }

  /**
   * Validate if URL is a valid DIDComm invitation
   */
  private isValidInvitationUrl(url: string): boolean {
    try {
      // Check if it's a valid URL
      const parsedUrl = new URL(url);

      // Check for DIDComm invitation parameters
      const hasOobParam = parsedUrl.searchParams.has('oob');
      const hasInvitationParam = parsedUrl.searchParams.has('c_i');

      // Check for valid domain (platform domain)
      const validDomains = [
        'platform.confamd.com',
        'platform-admin.confamd.com',
        'localhost',
        '127.0.0.1'
      ];

      const isValidDomain = validDomains.some((domain) => parsedUrl.hostname.includes(domain)
      );

      return isValidDomain && (hasOobParam || hasInvitationParam);
    } catch {
      return false;
    }
  }

  /**
   * Create deep link URL for mobile apps
   */
  private createDeepLinkUrl(
    invitationUrl: string,
    scheme: string = 'confirmdwallet'
  ): string {
    try {
      const parsedUrl = new URL(invitationUrl);
      const oobParam = parsedUrl.searchParams.get('oob');
      const invitationParam = parsedUrl.searchParams.get('c_i');

      if (oobParam) {
        return `${scheme}://connect?oob=${encodeURIComponent(oobParam)}`;
      } else if (invitationParam) {
        return `${scheme}://connect?c_i=${encodeURIComponent(invitationParam)}`;
      } else {
        // Fallback: encode entire URL
        return `${scheme}://connect?url=${encodeURIComponent(invitationUrl)}`;
      }
    } catch {
      // Fallback: encode entire URL
      return `${scheme}://connect?url=${encodeURIComponent(invitationUrl)}`;
    }
  }

  /**
   * Create universal URL that works with both web and mobile
   */
  private createUniversalUrl(
    invitationUrl: string,
    mobileScheme: string = 'confirmdwallet'
  ): string {
    try {
      const parsedUrl = new URL(invitationUrl);

      // Add mobile deep link as fallback parameter
      parsedUrl.searchParams.set(
        'mobile_fallback',
        this.createDeepLinkUrl(invitationUrl, mobileScheme)
      );

      return parsedUrl.toString();
    } catch {
      return invitationUrl;
    }
  }

  /**
   * Create credential offer URL
   */
  private createCredentialOfferUrl(credentialOffer: any): string {
    const baseUrl = process.env.PLATFORM_URL || 'https://platform.confamd.com';
    const offerData = Buffer.from(JSON.stringify(credentialOffer)).toString(
      'base64'
    );
    return `${baseUrl}/credentials/offer?data=${offerData}`;
  }

  /**
   * Create proof request URL
   */
  private createProofRequestUrl(proofRequest: any): string {
    const baseUrl = process.env.PLATFORM_URL || 'https://platform.confamd.com';
    const requestData = Buffer.from(JSON.stringify(proofRequest)).toString(
      'base64'
    );
    return `${baseUrl}/proofs/request?data=${requestData}`;
  }

  /**
   * Get QR code as buffer for image generation
   */
  async generateQRBuffer(
    data: string,
    options: QRCodeOptions = {}
  ): Promise<Buffer> {
    try {
      const qrOptions = { ...this.defaultOptions, ...options };

      return await QRCode.toBuffer(data, {
        width: qrOptions.size,
        margin: qrOptions.margin,
        color: qrOptions.color,
        errorCorrectionLevel: qrOptions.errorCorrectionLevel
      });
    } catch (error) {
      this.logger.error('Failed to generate QR code buffer', error);
      throw new Error(`QR code buffer generation failed: ${error.message}`);
    }
  }

  /**
   * Get QR code as SVG string
   */
  async generateQRSVG(
    data: string,
    options: QRCodeOptions = {}
  ): Promise<string> {
    try {
      const qrOptions = { ...this.defaultOptions, ...options };

      return await QRCode.toString(data, {
        type: 'svg',
        width: qrOptions.size,
        margin: qrOptions.margin,
        color: qrOptions.color,
        errorCorrectionLevel: qrOptions.errorCorrectionLevel
      });
    } catch (error) {
      this.logger.error('Failed to generate QR code SVG', error);
      throw new Error(`QR code SVG generation failed: ${error.message}`);
    }
  }
}
