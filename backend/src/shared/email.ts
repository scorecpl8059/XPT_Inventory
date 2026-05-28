import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

const ses = new SESClient({ region: process.env.AWS_REGION ?? 'us-east-1' })

const FROM_ADDRESS = 'noreply@xpt-tech.com'

export interface InvitationEmailParams {
  to: string
  orgName: string
  joinCode: string
  joinUrl: string
}

export async function sendInvitationEmail(params: InvitationEmailParams): Promise<void> {
  const { to, orgName, joinCode, joinUrl } = params

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="color: #1a1a1a; margin-bottom: 16px;">You're invited to join ${orgName}</h2>
      <p style="color: #4a4a4a; line-height: 1.6;">
        You've been invited to join <strong>${orgName}</strong> on XPT-Inventory.
      </p>
      <p style="color: #4a4a4a; line-height: 1.6;">Your join code:</p>
      <div style="background: #f0f4ff; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
        <span style="font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #2563eb;">${joinCode}</span>
      </div>
      <p style="color: #4a4a4a; line-height: 1.6;">
        Click the button below to get started:
      </p>
      <a href="${joinUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 8px 0 24px;">
        Get Started
      </a>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 13px;">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
  `.trim()

  const textBody = [
    `You're invited to join ${orgName} on XPT-Inventory.`,
    '',
    `Your join code: ${joinCode}`,
    '',
    `Get started: ${joinUrl}`,
    '',
    "If you didn't expect this invitation, you can safely ignore this email.",
  ].join('\n')

  await ses.send(new SendEmailCommand({
    Source: FROM_ADDRESS,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: `You're invited to join ${orgName} on XPT-Inventory` },
      Body: {
        Html: { Data: htmlBody },
        Text: { Data: textBody },
      },
    },
  }))
}
