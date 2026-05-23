import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { detectWorkflowSuggestions } from '@/lib/db/queries/workflow-detection';
import { WorkflowSuggestionList } from './workflow-suggestion-list';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/todos/workflows/suggestions');
  const ws = await requireCurrentWorkspace();

  const suggestions = await detectWorkflowSuggestions(ws.id);

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8 px-4 pb-32 pt-28 md:px-6">
      <div>
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Workflow-Detection
        </span>
        <h1 className="mt-1 text-[28px] font-medium leading-[1.15] tracking-[-0.3px] text-ink-50">
          Wiederholungen, die uns aufgefallen sind.
        </h1>
        <p className="mt-2 text-[14px] leading-[1.55] text-ink-200">
          uRent hat deine Todos der letzten 90 Tage gescannt und Muster gefunden,
          die du als{' '}
          <Link
            href="/todos"
            className="text-ink-50 underline decoration-white/30 underline-offset-2 hover:decoration-white/60"
          >
            Workflow
          </Link>{' '}
          speichern könntest.{' '}
          <span className="text-ink-300">
            Ein Klick → fertige Vorlage, beim nächsten Mal nur Kunde/Fahrzeug ausfüllen.
          </span>
        </p>
      </div>

      {suggestions.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-white/[0.10] bg-white/[0.01] px-6 py-14 text-center text-[13px] text-ink-300">
          Noch keine wiederkehrenden Muster gefunden. Sobald du z.B. mehrfach für
          den gleichen Kunden in kurzer Folge mehrere Todos anlegst, schlägt
          uRent hier einen Workflow vor.
        </div>
      ) : (
        <WorkflowSuggestionList suggestions={suggestions} />
      )}
    </div>
  );
}
