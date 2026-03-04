/** Full-page skeleton for route loading and lazy chunks. Reduces perceived wait. */
export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col animate-pulse">
      <header className="border-b border-zinc-800 px-4 md:px-6 py-4 flex items-center justify-between">
        <div className="h-7 w-32 rounded bg-zinc-800" />
        <div className="h-9 w-9 rounded-lg bg-zinc-800" />
      </header>
      <main className="max-w-4xl mx-auto w-full px-4 md:px-6 lg:px-8 py-8 md:py-12 flex-1">
        <div className="h-8 w-64 rounded bg-zinc-800 mb-6" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 flex items-center gap-4"
            >
              <div className="h-12 w-12 rounded-lg bg-zinc-800 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 rounded bg-zinc-800" />
                <div className="h-3 w-24 rounded bg-zinc-800/80" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
