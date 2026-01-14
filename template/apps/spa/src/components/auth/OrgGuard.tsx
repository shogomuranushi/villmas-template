/**
 * Organization Guard Component
 * Redirects users without organization to organization selection page
 */
import { useOrganization, useOrganizationList } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';

interface OrgGuardProps {
  children: ReactNode;
}

export function OrgGuard({ children }: OrgGuardProps) {
  const { organization, isLoaded: isOrgLoaded } = useOrganization();
  const { userMemberships, isLoaded: isMembershipsLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  if (!isOrgLoaded || !isMembershipsLoaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // If user has organizations but none selected, redirect to selection
  const hasOrganizations = (userMemberships?.data?.length || 0) > 0;
  if (hasOrganizations && !organization) {
    return <Navigate to="/select-organization" replace />;
  }

  // Allow personal accounts (no organization required)
  return <>{children}</>;
}
