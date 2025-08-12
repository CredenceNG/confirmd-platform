import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

@Injectable()
export class LocalFileService {
  private readonly logger = new Logger(LocalFileService.name);
  private readonly uploadDir =
    process.env.LOCAL_UPLOAD_DIR || './uploads/org-logos';

  constructor() {
    this.ensureUploadDirectory();
  }

  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      this.logger.log(`📁 Upload directory ensured: ${this.uploadDir}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to create upload directory: ${error.message}`
      );
      throw error;
    }
  }

  async saveOrgLogo(
    orgLogo: string,
    filename: string = 'orgLogo'
  ): Promise<string> {
    try {
      // Extract base64 data from the logo string
      const [, base64Data] = orgLogo.split(',');
      if (!base64Data) {
        throw new Error('Invalid base64 image data');
      }

      const imageBuffer = Buffer.from(base64Data, 'base64');
      const timestamp = Date.now();
      const fileName = `${filename}-${timestamp}.png`;
      const filePath = path.join(this.uploadDir, fileName);

      // Write the file to local directory
      await fs.writeFile(filePath, imageBuffer);

      // Return the absolute URL for the file that can be accessed by mobile clients
      const baseUrl = `${process.env.API_GATEWAY_PROTOCOL}://${process.env.API_ENDPOINT}`;
      const absoluteUrl = `${baseUrl}/uploads/org-logos/${fileName}`;

      this.logger.log(`✅ Organization logo saved locally: ${absoluteUrl}`);
      return absoluteUrl;
    } catch (error) {
      this.logger.error(
        `❌ Failed to save organization logo locally: ${error.message}`
      );
      throw error;
    }
  }

  async deleteOrgLogo(logoUrl: string): Promise<void> {
    try {
      if (!logoUrl) {
        return; // No URL provided, skip deletion
      }

      let fileName: string;

      // Handle both absolute URLs and relative paths
      if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
        // Extract filename from absolute URL
        const urlPath = new URL(logoUrl).pathname;
        if (!urlPath.includes('/uploads/org-logos/')) {
          return; // Not a local org logo file, skip deletion
        }
        fileName = path.basename(urlPath);
      } else if (logoUrl.startsWith('/uploads/org-logos/')) {
        // Handle relative path
        fileName = path.basename(logoUrl);
      } else {
        return; // Not a recognizable logo URL, skip deletion
      }

      const filePath = path.join(this.uploadDir, fileName);

      await fs.unlink(filePath);
      this.logger.log(`🗑️ Organization logo deleted: ${logoUrl}`);
    } catch (error) {
      this.logger.warn(
        `⚠️ Failed to delete organization logo: ${error.message}`
      );
      // Don't throw error for deletion failures as it's not critical
    }
  }

  async fileExists(logoUrl: string): Promise<boolean> {
    try {
      if (!logoUrl) {
        return false;
      }

      let fileName: string;

      // Handle both absolute URLs and relative paths
      if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
        // Extract filename from absolute URL
        const urlPath = new URL(logoUrl).pathname;
        if (!urlPath.includes('/uploads/org-logos/')) {
          return false; // Not a local org logo file
        }
        fileName = path.basename(urlPath);
      } else if (logoUrl.startsWith('/uploads/org-logos/')) {
        // Handle relative path
        fileName = path.basename(logoUrl);
      } else {
        return false; // Not a recognizable logo URL
      }

      const filePath = path.join(this.uploadDir, fileName);

      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
