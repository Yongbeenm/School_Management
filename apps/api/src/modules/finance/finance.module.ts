import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { FinanceReportsService } from './finance-reports.service';
import { FinanceBatchesService } from './finance-batches.service';

@Module({ controllers: [FinanceController], providers: [FinanceService, FinanceReportsService, FinanceBatchesService] })
export class FinanceModule {}
