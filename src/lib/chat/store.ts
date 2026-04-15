import type { UIMessage } from 'ai';
import { requireSupabaseData, requireSupabaseOk, supabaseAdmin } from '@/lib/supabase-admin';
import type { ConversationSummary, StoredChatMessageMetadata } from '@/types';

type StoredUIMessage = UIMessage<StoredChatMessageMetadata>;

interface ConversationRow {
  id: string;
  tenant_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  tenant_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  tool_invocations: Record<string, unknown> | null;
  created_at: string;
}

function getMessageText(message: StoredUIMessage): string {
  return message.parts
    .filter((part): part is Extract<StoredUIMessage['parts'][number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

function toFallbackUIMessage(row: MessageRow): StoredUIMessage {
  return {
    id: row.id,
    role: row.role,
    parts: row.content ? [{ type: 'text', text: row.content }] : [],
    ...(row.tool_invocations?.metadata ? { metadata: row.tool_invocations.metadata as StoredChatMessageMetadata } : {}),
  };
}

function parseStoredMessage(row: MessageRow): StoredUIMessage {
  const uiMessage = row.tool_invocations?.uiMessage;
  if (uiMessage && typeof uiMessage === 'object') {
    return uiMessage as StoredUIMessage;
  }

  return toFallbackUIMessage(row);
}

function summarizeTitle(messages: StoredUIMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  const text = firstUserMessage ? getMessageText(firstUserMessage) : 'Untitled conversation';
  return text.length > 72 ? `${text.slice(0, 69)}...` : text;
}

function mapConversation(row: ConversationRow, preview: string | null): ConversationSummary {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    preview,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function listConversations(tenantId: string): Promise<ConversationSummary[]> {
  const [conversationRows, messageRows] = await Promise.all([
    requireSupabaseData(
      await supabaseAdmin
        .from('conversations')
        .select('id, tenant_id, title, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })
        .limit(30),
      `Failed to load conversations for tenant "${tenantId}"`
    ) ?? [],
    requireSupabaseData(
      await supabaseAdmin
        .from('messages')
        .select('conversation_id, content, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(120),
      `Failed to load message previews for tenant "${tenantId}"`
    ) ?? [],
  ]);

  const previews = new Map<string, string>();
  for (const row of messageRows) {
    if (!previews.has(row.conversation_id)) {
      previews.set(row.conversation_id, row.content);
    }
  }

  return (conversationRows as ConversationRow[]).map((row) =>
    mapConversation(row, previews.get(row.id) ?? null)
  );
}

export async function loadConversationMessages(
  tenantId: string,
  conversationId: string
): Promise<StoredUIMessage[]> {
  const rows = requireSupabaseData(
    await supabaseAdmin
      .from('messages')
      .select('id, conversation_id, tenant_id, role, content, tool_invocations, created_at')
      .eq('tenant_id', tenantId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
    `Failed to load messages for conversation "${conversationId}"`
  ) ?? [];

  return (rows as MessageRow[]).map(parseStoredMessage);
}

export async function saveConversationMessages({
  tenantId,
  chatId,
  messages,
}: {
  tenantId: string;
  chatId: string;
  messages: StoredUIMessage[];
}): Promise<void> {
  const now = new Date();
  const title = summarizeTitle(messages);

  const conversationResult = await supabaseAdmin.from('conversations').upsert(
    {
      id: chatId,
      tenant_id: tenantId,
      title,
      updated_at: now.toISOString(),
    },
    { onConflict: 'id' }
  );

  requireSupabaseOk(conversationResult, `Failed to upsert conversation "${chatId}"`);

  const deleteResult = await supabaseAdmin
    .from('messages')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('conversation_id', chatId);

  requireSupabaseOk(deleteResult, `Failed to clear conversation "${chatId}" messages`);

  if (messages.length === 0) return;

  const rows = messages.map((message, index) => ({
    tenant_id: tenantId,
    conversation_id: chatId,
    role: message.role,
    content: getMessageText(message),
    tool_invocations: {
      uiMessage: message,
      metadata: message.metadata ?? null,
    },
    created_at: new Date(now.getTime() + index).toISOString(),
  }));

  const insertResult = await supabaseAdmin.from('messages').insert(rows);
  requireSupabaseOk(insertResult, `Failed to store conversation "${chatId}" messages`);
}
