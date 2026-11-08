import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import {
  CreateFeeChargeDto,
  CreateFeePaymentDto,
  UpdateFeeChargeDto,
  VoidFinanceRecordDto,
  CreateClassFeeBatchDto,
  ReceivablesQueryDto,
  CollectionsQueryDto,
} from './dto/finance.dto';
import { FinanceService } from './finance.service';
import { FinanceReportsService } from './finance-reports.service';
import { FinanceBatchesService } from './finance-batches.service';

@ApiTags('Student Finance')
@ApiBearerAuth()
@Controller({ path: 'finance', version: '1' })
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly reports: FinanceReportsService,
    private readonly batchesService: FinanceBatchesService,
  ) {}

  @Get('insights')
  @RequirePermissions('fee.read', 'payment.read')
  insights(@CurrentUser() user: AuthenticatedUser) {
    return this.reports.insights(user);
  }

  @Get('receivables')
  @RequirePermissions('fee.read', 'payment.read')
  receivables(@CurrentUser() user: AuthenticatedUser, @Query() query: ReceivablesQueryDto) {
    return this.reports.receivables(user, query);
  }

  @Get('receivables.csv')
  @RequirePermissions('fee.read', 'payment.read')
  async receivablesCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReceivablesQueryDto,
    @Res() response: Response,
  ) {
    const content = await this.reports.receivablesCsv(user, query);
    response.type('text/csv; charset=utf-8').attachment('receivables.csv').send(content);
  }

  @Get('collections')
  @RequirePermissions('fee.read', 'payment.read')
  collections(@CurrentUser() user: AuthenticatedUser, @Query() query: CollectionsQueryDto) {
    return this.reports.collections(user, query);
  }

  @Get('collections.csv')
  @RequirePermissions('fee.read', 'payment.read')
  async collectionsCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CollectionsQueryDto,
    @Res() response: Response,
  ) {
    const content = await this.reports.collectionsCsv(user, query);
    response.type('text/csv; charset=utf-8').attachment('collections.csv').send(content);
  }

  @Get('classes')
  @RequirePermissions('fee.create')
  classes(@CurrentUser() user: AuthenticatedUser) {
    return this.batchesService.classes(user);
  }

  @Get('batches')
  @RequirePermissions('fee.read')
  batches(@CurrentUser() user: AuthenticatedUser) {
    return this.batchesService.batches(user);
  }

  @Post('batches')
  @RequirePermissions('fee.create')
  createBatch(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClassFeeBatchDto) {
    return this.batchesService.create(user, dto);
  }

  @Post('batches/:batchId/void')
  @RequirePermissions('fee.update')
  voidBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Body() dto: VoidFinanceRecordDto,
  ) {
    return this.batchesService.void(user, batchId, dto.reason);
  }

  @Get('payments/:paymentId/receipt')
  @RequirePermissions('fee.read', 'payment.read')
  receipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.reports.receipt(user, paymentId);
  }

  @Get('summary')
  @RequirePermissions('fee.read', 'payment.read')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.summary(user);
  }

  @Get('students/:studentId')
  @RequirePermissions('fee.read', 'payment.read')
  studentLedger(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.finance.studentLedger(user, studentId);
  }

  @Post('charges')
  @RequirePermissions('fee.create')
  createCharge(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFeeChargeDto) {
    return this.finance.createCharge(user, dto);
  }

  @Patch('charges/:chargeId')
  @RequirePermissions('fee.update')
  updateCharge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
    @Body() dto: UpdateFeeChargeDto,
  ) {
    return this.finance.updateCharge(user, chargeId, dto);
  }

  @Post('charges/:chargeId/void')
  @RequirePermissions('fee.update')
  voidCharge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
    @Body() dto: VoidFinanceRecordDto,
  ) {
    return this.finance.voidCharge(user, chargeId, dto.reason);
  }

  @Post('charges/:chargeId/payments')
  @RequirePermissions('payment.create')
  recordPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
    @Body() dto: CreateFeePaymentDto,
  ) {
    return this.finance.recordPayment(user, chargeId, dto);
  }

  @Post('payments/:paymentId/void')
  @RequirePermissions('payment.void')
  voidPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: VoidFinanceRecordDto,
  ) {
    return this.finance.voidPayment(user, paymentId, dto.reason);
  }
}
