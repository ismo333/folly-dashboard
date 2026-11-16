import { passwordResetEmail } from "@/lib/config";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character] || character);
}

export async function sendPasswordResetEmail({
  to,
  displayName,
  resetUrl,
  idempotencyKey
}: {
  to: string;
  displayName: string;
  resetUrl: string;
  idempotencyKey: string;
}) {
  const safeName = escapeHtml(displayName);
  const safeUrl = escapeHtml(resetUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${passwordResetEmail.apiKey}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      "user-agent": "Folly Productions password reset/1.0"
    },
    body: JSON.stringify({
      from: passwordResetEmail.from,
      to: [to],
      subject: "Reset your Folly password",
      text: `Hello ${displayName},\n\nReset your Folly password using this link:\n${resetUrl}\n\nThis link expires in 30 minutes and can only be used once. If you did not request it, you can ignore this email.`,
      html: `<p>Hello ${safeName},</p><p><a href="${safeUrl}">Reset your Folly password</a>.</p><p>This link expires in 30 minutes and can only be used once. If you did not request it, you can ignore this email.</p>`
    })
  });
  if (!response.ok) {
    throw new Error(`Password reset email failed with status ${response.status}.`);
  }
}
