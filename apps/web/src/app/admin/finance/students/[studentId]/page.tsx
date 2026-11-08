import { FinanceGuard } from '@/components/finance/finance-guard';
import { StudentFinance } from '@/components/finance/finance-workspace';

export default async function StudentFinancePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  return (
    <FinanceGuard>
      <StudentFinance studentId={studentId} />
    </FinanceGuard>
  );
}
