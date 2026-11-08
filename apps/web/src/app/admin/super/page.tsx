'use client';

import { StaffDashboardGuard } from '@/components/dashboard/staff-dashboard-guard';
import { SuperAdminDashboard } from '@/components/dashboard/staff-dashboards';

export default function SuperAdminPage() {
  return (
    <StaffDashboardGuard role="SUPER_ADMIN">
      <SuperAdminDashboard />
    </StaffDashboardGuard>
  );
}
