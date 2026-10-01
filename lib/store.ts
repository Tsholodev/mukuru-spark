import { promises as fs } from "fs";
import path from "path";
import { freshLedger, type Ledger } from "./engine";

const file = path.join(process.cwd(), "data", "ledger.json");

let queue: Promise<unknown> = Promise.resolve();

async function read(): Promise<Ledger> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as Ledger;
  } catch {
    return freshLedger();
  }
}

async function write(ledger: Ledger) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(ledger));
  await fs.rename(tmp, file);
}

export function updateLedger<T>(fn: (ledger: Ledger) => { ledger: Ledger; result: T }): Promise<T> {
  const run = queue.then(async () => {
    const current = await read();
    const { ledger, result } = fn(current);
    await write(ledger);
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function readLedger(): Promise<Ledger> {
  return updateLedger((ledger) => ({ ledger, result: ledger }));
}

export function resetLedger(): Promise<Ledger> {
  return updateLedger(() => {
    const ledger = freshLedger();
    return { ledger, result: ledger };
  });
}
