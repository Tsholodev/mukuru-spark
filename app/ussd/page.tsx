import Link from "next/link";
import { UssdLive } from "@/components/ussd-live";
import { publicDemoConfig } from "@/lib/public-config";

export const dynamic = "force-dynamic";

export default function UssdPage() {
  return (
    <main className="glass-page flex min-h-dvh flex-col px-4 py-6">
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-[#FFD7C2]">{publicDemoConfig.appName.toUpperCase()} · {publicDemoConfig.ussdDemoCode}</p>
          <h1 className="text-2xl font-semibold text-white">Same account. Smaller screen.</h1>
        </div>
        <Link href="/" className="rounded-full bg-white/10 px-4 py-2 font-semibold text-white">
          Back
        </Link>
      </div>
      <div className="mx-auto mt-4 flex h-[640px] w-full max-w-md flex-col overflow-hidden rounded-[1.5rem]">
        <UssdLive />
      </div>
    </main>
  );
}
