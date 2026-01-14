/**
 * Organization Selection Page
 */
import {
  OrganizationList,
  CreateOrganization,
  useOrganizationList,
} from '@clerk/clerk-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function OrganizationSelectionPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  const hasOrganizations = (userMemberships?.data?.length || 0) > 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Select Organization</h1>
          <p className="text-muted-foreground mt-2">
            Choose an organization to continue
          </p>
        </div>

        {showCreate ? (
          <div className="space-y-4">
            <CreateOrganization
              afterCreateOrganizationUrl="/dashboard"
              skipInvitationScreen
            />
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowCreate(false)}
            >
              Back to list
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {hasOrganizations && (
              <OrganizationList
                afterSelectOrganizationUrl="/dashboard"
                afterSelectPersonalUrl="/dashboard"
              />
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowCreate(true)}
            >
              Create new organization
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
