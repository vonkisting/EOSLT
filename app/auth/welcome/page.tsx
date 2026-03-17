import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SignInSuccessView } from "./SignInSuccessView";

/**
 * Post-sign-in welcome: shows a 3-second success modal, then redirects to the target page.
 * Reached only after successful sign-in; landing redirects here with ?next=...
 */
export default async function AuthWelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }
  const { next: nextParam } = await searchParams;
  const next =
    typeof nextParam === "string" && nextParam.startsWith("/")
      ? nextParam
      : "/";

  return <SignInSuccessView next={next} />;
}
