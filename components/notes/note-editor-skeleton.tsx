/**
 * Editor-shaped placeholder shown while an existing note's body streams in
 * (Suspense fallback). Matches the real layout so the swap is seamless.
 */
export function NoteEditorSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      {/* Toolbar placeholder — matches NoteToolbar (h-10, border-b) so the
          real toolbar doesn't pop in above the skeleton and shift layout. */}
      <div className="flex h-10 items-center justify-between border-b border-[#1F1F23]">
        <div className="h-3.5 w-40 rounded bg-white/[0.05]" />
        <div className="h-3.5 w-24 rounded bg-white/[0.03]" />
      </div>
      <div className="mt-10 flex flex-col gap-4">
        <div className="h-9 w-2/3 rounded-md bg-white/[0.05]" />
        <div className="h-4 w-32 rounded bg-white/[0.03]" />
        <div className="mt-3 flex flex-col gap-3">
          <div className="h-4 w-full rounded bg-white/[0.03]" />
          <div className="h-4 w-11/12 rounded bg-white/[0.03]" />
          <div className="h-4 w-4/5 rounded bg-white/[0.03]" />
          <div className="h-4 w-5/6 rounded bg-white/[0.03]" />
        </div>
      </div>
    </div>
  );
}
