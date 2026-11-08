'use client';

import { StaffDashboardGuard } from '@/components/dashboard/staff-dashboard-guard';
import { AccountantHome } from '@/components/finance/accountant-workspace';

export default function AccountantPage() {
  return (
    <StaffDashboardGuard role="ACCOUNTANT">
      <AccountantHome />
    </StaffDashboardGuard>
  );
}
