import { FeeCurrency, FeePaymentMethod } from '@school/database';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const moneyPattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export class CreateFeeChargeDto {
  @IsUUID() studentId!: string;
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsString() @Matches(moneyPattern) amount!: string;
  @IsEnum(FeeCurrency) currency!: FeeCurrency;
  @IsString() @Matches(datePattern) dueOn!: string;
}

export class UpdateFeeChargeDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @Matches(moneyPattern) amount?: string;
  @IsOptional() @IsString() @Matches(datePattern) dueOn?: string;
}

export class CreateFeePaymentDto {
  @IsString() @Matches(moneyPattern) amount!: string;
  @IsEnum(FeePaymentMethod) method!: FeePaymentMethod;
  @IsUUID() idempotencyKey!: string;
  @IsOptional() @IsString() @MaxLength(100) reference?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsString() @Matches(datePattern) receivedOn?: string;
}

export class VoidFinanceRecordDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class CreateClassFeeBatchDto {
  @IsUUID() batchId!: string;
  @IsUUID() classSectionId!: string;
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsString() @Matches(moneyPattern) amount!: string;
  @IsEnum(FeeCurrency) currency!: FeeCurrency;
  @IsString() @Matches(datePattern) dueOn!: string;
}

export class ReceivablesQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(FeeCurrency) currency?: FeeCurrency;
  @IsOptional()
  @IsIn(['ALL', 'UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'DUE_SOON'])
  status?: 'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'DUE_SOON';
}

export class CollectionsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(FeeCurrency) currency?: FeeCurrency;
  @IsOptional() @IsEnum(FeePaymentMethod) method?: FeePaymentMethod;
  @IsOptional() @IsIn(['ACTIVE', 'VOIDED', 'ALL']) status?: 'ACTIVE' | 'VOIDED' | 'ALL';
  @IsOptional() @IsString() @Matches(datePattern) from?: string;
  @IsOptional() @IsString() @Matches(datePattern) to?: string;
}
