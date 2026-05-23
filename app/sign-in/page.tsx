import { Suspense } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { SignInForm } from '@/components/auth/sign-in-form';

export default function Page() {
  return (
    <AuthShell kicker="Anmelden" title="Willkommen zurück" subtitle="Melde dich in deinem uRent-Konto an.">
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
