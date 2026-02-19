import { Resend } from "resend";

/* ── Lazy-init Resend client (matches stripe.ts pattern) ─────────── */

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY!);
  }
  return _resend;
}

const FROM = "Neutralis.ai <notifications@neutralis.ai>";

/* ── Shared HTML email layout ────────────────────────────────────── */

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#111111;border-radius:8px;border:1px solid #222;">
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #222;">
              <h1 style="margin:0;font-size:20px;font-weight:600;color:#ffffff;letter-spacing:0.04em;">Neutralis.ai</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 32px;border-top:1px solid #222;">
              <p style="margin:0;font-size:12px;color:#666;">&copy; ${new Date().getFullYear()} Neutralis.ai &mdash; Prediction market arbitrage intelligence.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ── Fire-and-forget send helpers ────────────────────────────────── */

export function sendWelcomeEmail(email: string, firstName: string): void {
  void (async () => {
    try {
      await getResend().emails.send({
        from: FROM,
        to: email,
        subject: "Welcome to Neutralis.ai",
        html: layout(
          "Welcome to Neutralis.ai",
          `<h2 style="margin:0 0 16px;font-size:24px;color:#ffffff;">Welcome, ${firstName}!</h2>
          <p style="margin:0 0 16px;font-size:16px;color:#cccccc;line-height:1.6;">
            Your account is ready. Neutralis scans prediction markets in real-time
            to find arbitrage opportunities across Kalshi, Polymarket, and more.
          </p>
          <p style="margin:0 0 24px;font-size:16px;color:#cccccc;line-height:1.6;">
            Head to your dashboard to get started.
          </p>
          <a href="https://neutralis.ai/dashboard"
             style="display:inline-block;padding:12px 24px;background-color:#e8e9ea;color:#050608;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
            Open Dashboard
          </a>`,
        ),
      });
    } catch (err) {
      console.error("[email] Failed to send welcome email:", err);
    }
  })();
}

export function sendSubscriptionConfirmedEmail(
  email: string,
  firstName: string,
  tier: string,
): void {
  void (async () => {
    try {
      const label = tier.charAt(0).toUpperCase() + tier.slice(1);
      await getResend().emails.send({
        from: FROM,
        to: email,
        subject: `You're on the ${label} plan`,
        html: layout(
          "Subscription Confirmed",
          `<h2 style="margin:0 0 16px;font-size:24px;color:#ffffff;">Subscription Confirmed</h2>
          <p style="margin:0 0 16px;font-size:16px;color:#cccccc;line-height:1.6;">
            Hi ${firstName}, your <strong style="color:#ffffff;">${label}</strong> plan is now active.
          </p>
          <p style="margin:0 0 24px;font-size:16px;color:#cccccc;line-height:1.6;">
            You now have full access to ${label}-tier features. Manage your subscription
            anytime from the billing portal.
          </p>
          <a href="https://neutralis.ai/pricing"
             style="display:inline-block;padding:12px 24px;background-color:#e8e9ea;color:#050608;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
            View Your Plan
          </a>`,
        ),
      });
    } catch (err) {
      console.error("[email] Failed to send subscription confirmed email:", err);
    }
  })();
}

export function sendSubscriptionChangedEmail(
  email: string,
  firstName: string,
  newTier: string,
): void {
  void (async () => {
    try {
      const label = newTier.charAt(0).toUpperCase() + newTier.slice(1);
      await getResend().emails.send({
        from: FROM,
        to: email,
        subject: `Your plan has been updated to ${label}`,
        html: layout(
          "Plan Updated",
          `<h2 style="margin:0 0 16px;font-size:24px;color:#ffffff;">Plan Updated</h2>
          <p style="margin:0 0 16px;font-size:16px;color:#cccccc;line-height:1.6;">
            Hi ${firstName}, your subscription has been changed to the
            <strong style="color:#ffffff;">${label}</strong> plan.
          </p>
          <p style="margin:0 0 24px;font-size:16px;color:#cccccc;line-height:1.6;">
            The change is effective immediately. You can review your updated plan details
            in the billing portal.
          </p>
          <a href="https://neutralis.ai/pricing"
             style="display:inline-block;padding:12px 24px;background-color:#e8e9ea;color:#050608;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
            Manage Subscription
          </a>`,
        ),
      });
    } catch (err) {
      console.error("[email] Failed to send subscription changed email:", err);
    }
  })();
}

export function sendSubscriptionCancelledEmail(
  email: string,
  firstName: string,
): void {
  void (async () => {
    try {
      await getResend().emails.send({
        from: FROM,
        to: email,
        subject: "Your Neutralis.ai subscription has been cancelled",
        html: layout(
          "Subscription Cancelled",
          `<h2 style="margin:0 0 16px;font-size:24px;color:#ffffff;">Subscription Cancelled</h2>
          <p style="margin:0 0 16px;font-size:16px;color:#cccccc;line-height:1.6;">
            Hi ${firstName}, your paid subscription has been cancelled and your account
            has been moved to the Free tier.
          </p>
          <p style="margin:0 0 24px;font-size:16px;color:#cccccc;line-height:1.6;">
            You can resubscribe anytime to regain access to premium features.
          </p>
          <a href="https://neutralis.ai/pricing"
             style="display:inline-block;padding:12px 24px;background-color:#e8e9ea;color:#050608;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
            View Plans
          </a>`,
        ),
      });
    } catch (err) {
      console.error("[email] Failed to send cancellation email:", err);
    }
  })();
}

export function sendPaymentFailedEmail(
  email: string,
  firstName: string,
): void {
  void (async () => {
    try {
      await getResend().emails.send({
        from: FROM,
        to: email,
        subject: "Payment failed for your Neutralis.ai subscription",
        html: layout(
          "Payment Failed",
          `<h2 style="margin:0 0 16px;font-size:24px;color:#ffffff;">Payment Failed</h2>
          <p style="margin:0 0 16px;font-size:16px;color:#cccccc;line-height:1.6;">
            Hi ${firstName}, we were unable to process your latest subscription payment.
          </p>
          <p style="margin:0 0 24px;font-size:16px;color:#cccccc;line-height:1.6;">
            Please update your payment method to keep your subscription active.
            If the issue persists, your plan may be downgraded.
          </p>
          <a href="https://neutralis.ai/pricing"
             style="display:inline-block;padding:12px 24px;background-color:#dc2626;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
            Update Payment Method
          </a>`,
        ),
      });
    } catch (err) {
      console.error("[email] Failed to send payment failed email:", err);
    }
  })();
}
