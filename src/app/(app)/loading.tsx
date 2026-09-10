export default function Loading() {
  return (
    <main className="container" aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 28, width: "70%", marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 18, width: "50%", marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 52, width: "100%", marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 120, width: "100%" }} />
    </main>
  );
}
