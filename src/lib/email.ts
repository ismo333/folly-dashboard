import { emailSettings } from "@/lib/config";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character] || character);
}

export async function sendSignInEmail({
  to,
  displayName,
  signInUrl,
  idempotencyKey
}: {
  to: string;
  displayName: string;
  signInUrl: string;
  idempotencyKey: string;
}) {
  const safeName = escapeHtml(displayName);
  const safeUrl = escapeHtml(signInUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${emailSettings.apiKey}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      "user-agent": "Folly Productions sign-in/1.0"
    },
    body: JSON.stringify({
      from: emailSettings.from,
      to: [to],
      subject: "Your Folly sign-in link",
      text: `Hello ${displayName},\n\nSign in to Folly — What’s On using this link:\n${signInUrl}\n\nThis link expires in 15 minutes and can only be used once. If you did not request it, you can ignore this email.`,
      html: `<p>Hello ${safeName},</p><p><a href="${safeUrl}">Sign in to Folly — What’s On</a>.</p><p>This link expires in 15 minutes and can only be used once. If you did not request it, you can ignore this email.</p>`
    })
  });
  if (!response.ok) {
    throw new Error(`Sign-in email failed with status ${response.status}.`);
  }
}
