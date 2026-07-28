import { createHash, randomBytes } from "node:crypto";
import { invitePepper } from "@/lib/config";

export function hashInviteCode(code: string) {
  return createHash("sha256")
    .update(`${invitePepper}:${code.trim()}`)
    .digest("hex");
}

export function generateInviteCode() {
  return randomBytes(6).toString("base64url");
}
