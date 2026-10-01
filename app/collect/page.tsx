import { redirect } from "next/navigation";
import { AmaiAccount } from "@/components/amai-account";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CollectPage() {
  const account = await getSession();
  if (account?.role !== "receiver") redirect("/");
  return <AmaiAccount />;
}
