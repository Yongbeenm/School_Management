import { ReceiptWorkspace } from '@/components/finance/accountant-workspace';
import { FinanceGuard } from '@/components/finance/finance-guard';

export default async function ReceiptPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  return (
    <FinanceGuard>
      <ReceiptWorkspace paymentId={paymentId} />
    </FinanceGuard>
  );
}
