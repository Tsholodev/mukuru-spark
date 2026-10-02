import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

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

export function normalizePhone(input: string, country?: string): string | null {
  if (country !== undefined && !isSupportedCountry(country)) return null;
  const parsed = parsePhoneNumberFromString(input, country as CountryCode | undefined);
  return parsed?.isValid() ? parsed.number : null;
}

export function maskPhone(phoneNumber: string): string {
  const visibleDigits = 4;
  const digits = phoneNumber.replace(/\D/g, "");
  return `${"•".repeat(Math.max(0, digits.length - visibleDigits))}${digits.slice(-visibleDigits)}`;
}
