/**
 * Organization Profile Page
 */
import { OrganizationProfile, useOrganization } from '@clerk/clerk-react';

export function OrganizationProfilePage() {
  const { organization } = useOrganization();

  if (!organization) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Organization Settings</h1>
          <p className="text-muted-foreground">
            You are using a personal account. Create or join an organization to access these settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Organization Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization settings and members
        </p>
      </div>
      <OrganizationProfile
        routing="path"
        path="/dashboard/organization-profile"
        appearance={{
          elements: {
            rootBox: 'w-full',
            card: 'shadow-none border',
          },
        }}
      />
    </div>
  );
}
