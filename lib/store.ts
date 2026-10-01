import { promises as fs } from "fs";
import path from "path";
import { freshLedger, type Ledger } from "./engine";

const file = path.join(process.cwd(), "data", "ledger.json");

let queue: Promise<unknown> = Promise.resolve();
let memory: Ledger | null = null;

async function read(): Promise<Ledger> {
  try {
    const raw = await fs.readFile(file, "utf8");
    memory = JSON.parse(raw) as Ledger;
    return structuredClone(memory);
  } catch {
    if (memory) return structuredClone(memory);
    memory = freshLedger();
    return structuredClone(memory);
  }
}

async function write(ledger: Ledger) {
  memory = structuredClone(ledger);
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(ledger));
    await fs.rename(tmp, file);
  } catch {
    // The demo still runs from memory when the disk is read-only.
  }
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
  const run = queue.then(() => read());
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function resetLedger(): Promise<Ledger> {
  return updateLedger(() => {
    const ledger = freshLedger();
    return { ledger, result: ledger };
  });
}
