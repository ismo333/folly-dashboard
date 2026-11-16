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

export const passwordResetEmail = {
  apiKey: process.env.RESEND_API_KEY ?? "",
  from: process.env.PASSWORD_RESET_FROM_EMAIL ?? "",
  appUrl: process.env.APP_URL?.replace(/\/$/, "") ?? ""
};

export const isPasswordResetEmailConfigured = Boolean(
  passwordResetEmail.apiKey && passwordResetEmail.from
);
