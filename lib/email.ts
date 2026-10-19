// Polyfill WebSocket in Node runtime if absent
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class MockWebSocket {};
}

import { createClient } from '@supabase/supabase-js';

export interface SendInviteEmailParams {
  email: string;
  name?: string;
  role: string;
  cohort?: string;
  inviteLink: string;
}

export interface EmailDeliveryResult {
  sent: boolean;
  provider: 'resend' | 'supabase' | null;
  reason?: string;
  error?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Builds a clean, tactile neobrutalist HTML email for user invitations.
 */
export function buildNeobrutalistInviteEmailHtml({
  displayName,
  role,
  cohort,
  inviteLink,
}: {
  displayName: string;
  role: string;
  cohort?: string;
  inviteLink: string;
}): string {
  const roleCapitalized = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Student';
  const cohortBadge = cohort
    ? `<span style="display: inline-block; background-color: #E2E8F0; color: #1E293B; padding: 2px 8px; border: 2px solid #000000; border-radius: 4px; font-weight: 700; margin-left: 4px;">${escapeHtml(cohort)}</span>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Revizz Invitation</title>
</head>
<body style="margin: 0; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F9FA; color: #18181B;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; margin: 0 auto; background-color: #FFFFFF; border: 3px solid #000000; box-shadow: 6px 6px 0px #000000; border-radius: 8px; overflow: hidden;">
    <!-- Header Banner -->
    <tr>
      <td style="padding: 24px; background-color: #FFE600; border-bottom: 3px solid #000000;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.5px; color: #000000; text-transform: uppercase;">
          Revizz Invitation
        </h1>
        <p style="margin: 6px 0 0 0; font-size: 14px; font-weight: 700; color: #000000; letter-spacing: 0.5px;">
          Cambridge Exam Mastery &amp; Interactive Practice
        </p>
      </td>
    </tr>
    <!-- Main Content -->
    <tr>
      <td style="padding: 32px 24px;">
        <p style="font-size: 17px; font-weight: 700; margin: 0 0 16px 0; color: #09090B;">
          Hi ${escapeHtml(displayName)},
        </p>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; color: #27272A;">
          You have been invited to join <strong>Revizz</strong> as a <span style="display: inline-block; background-color: #FEF08A; padding: 2px 8px; border: 2px solid #000000; border-radius: 4px; font-weight: 800;">${escapeHtml(roleCapitalized)}</span>${cohort ? ` (Cohort: ${cohortBadge})` : ''}.
        </p>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 28px 0; color: #27272A;">
          Revizz helps students master Cambridge IGCSE and A-Level past paper questions with instant grading, smart feedback, and interactive drills.
        </p>
        <!-- CTA Button -->
        <div style="margin: 28px 0; text-align: left;">
          <a href="${inviteLink}" target="_blank" style="display: inline-block; background-color: #FF5722; color: #FFFFFF; font-size: 16px; font-weight: 800; text-decoration: none; padding: 14px 28px; border: 3px solid #000000; box-shadow: 4px 4px 0px #000000; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
            Accept Invitation &rarr;
          </a>
        </div>
        <div style="margin-top: 32px; padding-top: 20px; border-top: 2px dashed #E4E4E7;">
          <p style="font-size: 13px; font-weight: 600; color: #71717A; margin: 0 0 8px 0;">
            Can't click the button? Copy and paste this URL into your browser:
          </p>
          <p style="font-size: 12px; word-break: break-all; margin: 0; padding: 12px; background-color: #F4F4F5; border: 2px solid #000000; border-radius: 4px; font-family: monospace;">
            <a href="${inviteLink}" style="color: #2563EB; text-decoration: underline;">${escapeHtml(inviteLink)}</a>
          </p>
        </div>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="padding: 16px 24px; background-color: #FAFAFA; border-top: 2px solid #000000; font-size: 12px; color: #71717A;">
        &copy; ${new Date().getFullYear()} Revizz. Built for Cambridge IGCSE &amp; A-Level Students.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Builds the canonical invite acceptance link for a user.
 */
export function buildInviteLink({
  origin,
  inviteId,
  email,
}: {
  origin: string;
  inviteId: string;
  email: string;
}): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}/?invite=${encodeURIComponent(inviteId)}&email=${encodeURIComponent(email)}`;
}

/**
 * Builds a pre-encoded mailto link for direct sending via desktop/mobile email client.
 */
export function buildInviteMailto({
  email,
  name,
  role,
  cohort,
  inviteLink,
}: {
  email: string;
  name?: string;
  role: string;
  cohort?: string;
  inviteLink: string;
}): string {
  const recipient = (email || '').trim();
  const displayName = name?.trim() || recipient.split('@')[0] || 'there';
  const roleDisplay = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Student';
  const cohortText = cohort && cohort !== 'General' ? ` (Cohort: ${cohort})` : '';

  const subject = "You've been invited to Revizz!";
  const body = `Hi ${displayName},

You have been invited to join Revizz as a ${roleDisplay}${cohortText}.

Click the link below to accept your invitation and activate your account:
${inviteLink}

Best regards,
The Revizz Team`;

  return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Dispatches an invitation email using Resend API (primary) or Supabase Auth Admin (fallback).
 * If neither is configured, returns a descriptive reason.
 */
export async function sendInviteEmail({
  email,
  name,
  role,
  cohort,
  inviteLink,
}: SendInviteEmailParams): Promise<EmailDeliveryResult> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const displayName = name?.trim() || cleanEmail.split('@')[0] || 'Student';
  const resendApiKey = process.env.RESEND_API_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (resendApiKey) {
    try {
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'Revizz <onboarding@resend.dev>';
      const html = buildNeobrutalistInviteEmailHtml({
        displayName,
        role,
        cohort,
        inviteLink,
      });

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [cleanEmail],
          subject: "You've been invited to Revizz!",
          html,
        }),
      });

      if (res.ok) {
        return { sent: true, provider: 'resend' };
      }

      const errJson = await res.json().catch(() => ({}));
      const errorMsg = errJson?.message || `Resend API returned HTTP ${res.status}`;
      console.warn('Resend email failed:', errorMsg);

      // Attempt Supabase fallback if service role key is present
      if (serviceRoleKey) {
        return await sendSupabaseInvite(cleanEmail, {
          role,
          cohort,
          name: displayName,
          inviteLink,
        });
      }

      return {
        sent: false,
        provider: 'resend',
        error: errorMsg,
      };
    } catch (err: any) {
      console.warn('Error sending email via Resend:', err);
      if (serviceRoleKey) {
        return await sendSupabaseInvite(cleanEmail, {
          role,
          cohort,
          name: displayName,
          inviteLink,
        });
      }
      return {
        sent: false,
        provider: 'resend',
        error: err?.message || 'Failed to dispatch email via Resend',
      };
    }
  }

  if (serviceRoleKey) {
    return await sendSupabaseInvite(cleanEmail, {
      role,
      cohort,
      name: displayName,
      inviteLink,
    });
  }

  return {
    sent: false,
    provider: null,
    reason: 'No email service credentials (RESEND_API_KEY or SUPABASE_SERVICE_ROLE_KEY) configured in environment',
  };
}

async function sendSupabaseInvite(
  email: string,
  params: { role: string; cohort?: string; name: string; inviteLink: string }
): Promise<EmailDeliveryResult> {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dmvahcaxixvhgxidmkqs.supabase.co';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return {
        sent: false,
        provider: 'supabase',
        error: 'Missing SUPABASE_SERVICE_ROLE_KEY in environment',
      };
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        role: params.role,
        cohort: params.cohort,
        display_name: params.name,
      },
      redirectTo: params.inviteLink,
    });

    if (error) {
      console.warn('Supabase inviteUserByEmail error:', error);
      return {
        sent: false,
        provider: 'supabase',
        error: error.message,
      };
    }

    return {
      sent: true,
      provider: 'supabase',
    };
  } catch (err: any) {
    console.warn('Unexpected error in sendSupabaseInvite:', err);
    return {
      sent: false,
      provider: 'supabase',
      error: err?.message || 'Failed to send invite via Supabase Auth Admin',
    };
  }
}
