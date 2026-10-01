import { redirect } from "next/navigation";
import { Landing } from "@/components/landing";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const account = await getSession();
  if (account?.role === "sender") redirect("/home");
  if (account?.role === "receiver") redirect("/collect");
  return <Landing />;
}
