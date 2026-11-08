import { FinanceGuard } from '@/components/finance/finance-guard';
import { FinanceOverview } from '@/components/finance/finance-workspace';

export default function FinancePage() {
  return (
    <FinanceGuard>
      <FinanceOverview />
    </FinanceGuard>
  );
}
