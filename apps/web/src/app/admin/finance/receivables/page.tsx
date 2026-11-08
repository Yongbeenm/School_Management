import { ReceivablesWorkspace } from '@/components/finance/accountant-workspace';
import { FinanceGuard } from '@/components/finance/finance-guard';

export default function ReceivablesPage() {
  return (
    <FinanceGuard>
      <ReceivablesWorkspace />
    </FinanceGuard>
  );
}
