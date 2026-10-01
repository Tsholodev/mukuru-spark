import { redirect } from "next/navigation";
import { Desk } from "@/components/desk";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ThandiHome() {
  const account = await getSession();
  if (account?.role !== "sender") redirect("/");
  return <Desk />;
}
