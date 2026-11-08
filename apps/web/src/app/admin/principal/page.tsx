'use client';

import { StaffDashboardGuard } from '@/components/dashboard/staff-dashboard-guard';
import { PrincipalDashboard } from '@/components/dashboard/staff-dashboards';

export default function PrincipalPage() {
  return (
    <StaffDashboardGuard role="PRINCIPAL">
      <PrincipalDashboard />
    </StaffDashboardGuard>
  );
}
