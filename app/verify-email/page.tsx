import Link from 'next/link';
import { AuthShell, ErrorBanner, InfoBanner } from '@/components/auth/auth-shell';
import { verifyEmail } from '@/lib/actions/auth';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let status: 'ok' | 'fail' | 'missing' = 'missing';
  let error: string | undefined;
  if (token) {
    const res = await verifyEmail(token);
    status = res.ok ? 'ok' : 'fail';
    if (!res.ok) error = res.error;
  }
  return (
    <AuthShell
      kicker="E-Mail bestätigen"
      title={status === 'ok' ? 'Bestätigt.' : 'Bestätigung'}
      subtitle={
        status === 'ok'
          ? 'Deine E-Mail ist verifiziert.'
          : status === 'fail'
            ? 'Der Link ist ungültig oder abgelaufen.'
            : 'Kein Token im Link.'
      }
    >
      {status === 'ok' && (
        <InfoBanner>
          Du kannst jetzt alle Funktionen nutzen.{' '}
          <Link href="/" className="text-ink-50 underline">
            Zur App
          </Link>
        </InfoBanner>
      )}
      {status === 'fail' && error && <ErrorBanner>{error}</ErrorBanner>}
    </AuthShell>
  );
}
