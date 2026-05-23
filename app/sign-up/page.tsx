import { AuthShell } from '@/components/auth/auth-shell';
import { SignUpForm } from '@/components/auth/sign-up-form';

export default function Page() {
  return (
    <AuthShell kicker="Registrieren" title="Konto erstellen" subtitle="Dein Workspace. Dein Team. Dein Tempo.">
      <SignUpForm />
    </AuthShell>
  );
}
