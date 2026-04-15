import { ChatPanel } from '@/components/chat/chat-panel';
import { listConversations, loadConversationMessages } from '@/lib/chat/store';

export const dynamic = 'force-dynamic';

function getChatId(value: string | undefined): string {
  if (value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return value;
  }

  return crypto.randomUUID();
}

export default async function PortalChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ chat?: string }>;
}) {
  const { tenantId } = await params;
  const { chat } = await searchParams;
  const chatId = getChatId(chat);

  const [conversations, initialMessages] = await Promise.all([
    listConversations(tenantId),
    loadConversationMessages(tenantId, chatId),
  ]);

  return (
    <ChatPanel
      tenantId={tenantId}
      chatId={chatId}
      initialMessages={initialMessages}
      conversations={conversations}
      newChatHref={`/portals/${tenantId}/chat?chat=${crypto.randomUUID()}`}
    />
  );
}
