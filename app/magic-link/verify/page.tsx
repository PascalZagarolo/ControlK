import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell, ErrorBanner, InfoBanner } from '@/components/auth/auth-shell';
import { consumeMagicLink } from '@/lib/actions/auth';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <AuthShell kicker="Magic Link" title="Kein Token">
        <ErrorBanner>Der Link ist unvollständig.</ErrorBanner>
      </AuthShell>
    );
  }
  const res = await consumeMagicLink(token);
  if (res.ok) redirect('/');
  return (
    <AuthShell kicker="Magic Link" title="Link ungültig">
      <ErrorBanner>{res.error}</ErrorBanner>
      <p className="mt-4 text-center text-[12.5px] text-ink-300">
        <Link href="/magic-link" className="text-ink-50 hover:underline">
          Neuen Link anfordern
        </Link>
      </p>
    </AuthShell>
  );
}
