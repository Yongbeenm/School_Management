'use client';

import { StaffDashboardGuard } from '@/components/dashboard/staff-dashboard-guard';
import { LibrarianDashboard } from '@/components/dashboard/staff-dashboards';

export default function LibrarianPage() {
  return (
    <StaffDashboardGuard role="LIBRARIAN">
      <LibrarianDashboard />
    </StaffDashboardGuard>
  );
}
