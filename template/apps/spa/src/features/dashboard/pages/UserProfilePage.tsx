/**
 * User Profile Page
 */
import { UserProfile } from '@clerk/clerk-react';

export function UserProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>
      <UserProfile
        routing="path"
        path="/dashboard/user-profile"
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
