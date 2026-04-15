interface OpsNotification {
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  details?: Record<string, unknown>;
}

async function postJson(url: string, payload: unknown): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Notification webhook failed with status ${response.status}`);
  }
}

export async function sendOpsNotification(
  notification: OpsNotification
): Promise<void> {
  const genericWebhook = process.env.NOTIFY_WEBHOOK_URL;
  const slackWebhook = process.env.SLACK_WEBHOOK_URL;

  if (!genericWebhook && !slackWebhook) return;

  try {
    if (genericWebhook) {
      await postJson(genericWebhook, {
        ...notification,
        sentAt: new Date().toISOString(),
      });
    }

    if (slackWebhook) {
      await postJson(slackWebhook, {
        text: `[${notification.severity.toUpperCase()}] ${notification.title}\n${notification.body}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${notification.title}*\n${notification.body}`,
            },
          },
          ...(notification.details
            ? [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `\`\`\`${JSON.stringify(notification.details, null, 2)}\`\`\``,
                  },
                },
              ]
            : []),
        ],
      });
    }
  } catch (error) {
    console.error('Failed to send ops notification:', error);
  }
}
