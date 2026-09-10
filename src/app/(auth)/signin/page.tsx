import Link from "next/link";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await getCurrentUser()) redirect("/home");
  return (
    <main className="container">
      <h1>Welcome back</h1>
      <p className="lede">Sign in to open your ledger.</p>
      <AuthForm mode="signin" />
      <div className="spacer" />
      <p className="muted">
        New here? <Link className="link-quiet" href="/signup">Create an account</Link>
      </p>
    </main>
  );
}
