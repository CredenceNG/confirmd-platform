import { OnQueueActive, Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { IssuanceService } from './issuance.service';
import { Logger } from '@nestjs/common';
import { IQueuePayload } from '../interfaces/issuance.interfaces';

@Processor('bulk-issuance')
export class BulkIssuanceProcessor {
  private readonly logger = new Logger('IssueCredentialService');
  constructor(private readonly issuanceService: IssuanceService) {}

  @OnQueueActive()
  onActive(job: Job): void {
    this.logger.log(`Emitting job status${job.id} of type ${job.name} ...`);
  }

  @Process()
  async issueCredential(job: Job<IQueuePayload>): Promise<void> {
    this.logger.log(`Processing job ${job.id} of type ${job.name} ...`);

    this.issuanceService.processIssuanceData(job.data);
  }
}
