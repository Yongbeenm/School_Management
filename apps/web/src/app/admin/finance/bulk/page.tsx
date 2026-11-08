import { BulkFeeWorkspace } from '@/components/finance/accountant-workspace';
import { FinanceCreateGuard } from '@/components/finance/finance-guard';

export default function BulkFeePage() {
  return (
    <FinanceCreateGuard>
      <BulkFeeWorkspace />
    </FinanceCreateGuard>
  );
}
