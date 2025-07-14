import { Injectable, Logger } from "@nestjs/common";
import { promises as fs } from "fs";
import * as path from "path";

@Injectable()
export class LocalFileService {
  private readonly logger = new Logger(LocalFileService.name);
  private readonly uploadDir =
    process.env.LOCAL_UPLOAD_DIR || "./uploads/org-logos";

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
    filename: string = "orgLogo"
  ): Promise<string> {
    try {
      // Extract base64 data from the logo string
      const [, base64Data] = orgLogo.split(",");
      if (!base64Data) {
        throw new Error("Invalid base64 image data");
      }

      const imageBuffer = Buffer.from(base64Data, "base64");
      const timestamp = Date.now();
      const fileName = `${filename}-${timestamp}.png`;
      const filePath = path.join(this.uploadDir, fileName);

      // Write the file to local directory
      await fs.writeFile(filePath, imageBuffer);

      // Return the local file URL that can be served by the application
      const localUrl = `/uploads/org-logos/${fileName}`;

      this.logger.log(`✅ Organization logo saved locally: ${localUrl}`);
      return localUrl;
    } catch (error) {
      this.logger.error(
        `❌ Failed to save organization logo locally: ${error.message}`
      );
      throw error;
    }
  }

  async deleteOrgLogo(logoUrl: string): Promise<void> {
    try {
      if (!logoUrl || !logoUrl.startsWith("/uploads/org-logos/")) {
        return; // Not a local file, skip deletion
      }

      const fileName = path.basename(logoUrl);
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
      if (!logoUrl || !logoUrl.startsWith("/uploads/org-logos/")) {
        return false;
      }

      const fileName = path.basename(logoUrl);
      const filePath = path.join(this.uploadDir, fileName);

      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
