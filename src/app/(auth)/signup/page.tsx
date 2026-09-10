import Link from "next/link";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/home");
  return (
    <main className="container">
      <h1>Log a flare in seconds</h1>
      <p className="lede">Build a record your doctor can read. No daily check-ins.</p>
      <AuthForm mode="signup" />
      <div className="spacer" />
      <p className="muted">
        Already have an account?{" "}
        <Link className="link-quiet" href="/signin">Sign in</Link>
      </p>
    </main>
  );
}
