"use client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="container">
      <div className="card empty">
        <h1>That didn&apos;t load</h1>
        <p className="lede">Check your connection and try again.</p>
        <button className="btn btn-primary" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </main>
  );
}
