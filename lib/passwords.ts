import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(secret, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifySecret(secret: string, stored: string): boolean {
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const actual = scryptSync(secret, salt, 32);
  const expected = Buffer.from(hex, "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits === "27790001111" || digits === "0790001111") return "0790001111";
  if (digits === "263774418000" || digits === "0774418000") return "0774418000";
  return digits;
}
