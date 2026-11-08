import { Global, Module } from '@nestjs/common';
import { SchoolAccessService } from './school-access.service';

@Global()
@Module({
  providers: [SchoolAccessService],
  exports: [SchoolAccessService],
})
export class SchoolAccessModule {}
