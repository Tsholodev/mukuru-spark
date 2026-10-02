import { redirect } from "next/navigation";
import { RecipientTransfers } from "@/components/recipient-transfers";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CollectPage() {
  const account = await getSession();
  if (account?.role !== "receiver") redirect("/");
  return <RecipientTransfers account={account} />;
}
