import { Module } from "@nestjs/common";
import { LocalFileService } from "./local-file.service";

@Module({
  providers: [LocalFileService],
  exports: [LocalFileService],
})
export class LocalFileModule {}
