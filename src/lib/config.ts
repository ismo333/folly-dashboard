export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

export const isAuthConfigured = isDatabaseConfigured;

export function ownerEmails() {
  return new Set(
    (process.env.OWNER_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export const invitePepper =
  process.env.INVITE_CODE_PEPPER ?? "local-development-only-invite-pepper";
