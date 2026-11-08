import { CollectionsWorkspace } from '@/components/finance/accountant-workspace';
import { FinanceGuard } from '@/components/finance/finance-guard';

export default function CollectionsPage() {
  return (
    <FinanceGuard>
      <CollectionsWorkspace />
    </FinanceGuard>
  );
}
