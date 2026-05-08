export default function Home() {
  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border bg-white p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Mining Simulation- PolyU AF5644</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-700">
          A classroom simulation of Ardinals-style mining: each epoch you <b>commit</b> a hash of
          your answers, then <b>reveal</b> the answers + salt, and the system uses <b>drand</b>{" "}
          public randomness to draw winners and mint rewards.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            href="/login"
          >
            Login
          </a>
          <a
            className="inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            href="/mine"
          >
            Go to Mine
          </a>
          <a
            className="inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            href="/verify"
          >
            Verify a draw
          </a>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="font-semibold">How it works</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
            <li>Login with your student ID (used as the “public key” identifier).</li>
            <li>During commit phase, submit a commit hash.</li>
            <li>During reveal phase, submit answers + salt.</li>
            <li>After reveal ends, the system settles using drand randomness.</li>
          </ol>
        </div>
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="font-semibold">Links</h2>
          <ul className="mt-2 space-y-1 text-sm text-zinc-700">
            <li>
              <a className="underline" href="/leaderboard">
                Leaderboard
              </a>
            </li>
            <li>
              <a className="underline" href="/wallet">
                Wallet / balance
              </a>
            </li>
            <li>
              Rules: <code className="rounded bg-zinc-100 px-1">docs/rules.md</code>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
