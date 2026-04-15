import { createIdGenerator, convertToModelMessages, streamText, tool, type UIMessage } from 'ai';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/request-session';
import { CHAT_MODEL_ID, chatModel } from '@/lib/ai/models';
import { generateAuditReport } from '@/lib/audit/report';
import { saveConversationMessages } from '@/lib/chat/store';
import { getTenantOrThrow } from '@/lib/portals/queries';
import {
  retrieveContextForChat,
  searchHubSpotDocs,
  searchPortalConfig,
} from '@/lib/rag/retrieve';
import { listSyncStatuses } from '@/lib/sync/queries';
import type { StoredChatMessageMetadata } from '@/types';

export const maxDuration = 60;

type ChatMessage = UIMessage<StoredChatMessageMetadata>;

const requestSchema = z.object({
  chatId: z.string().uuid(),
  tenantId: z.string().min(1),
  messages: z.array(z.any()),
});

function getMessageText(message: ChatMessage | undefined): string {
  if (!message) return '';

  return message.parts
    .filter((part): part is Extract<ChatMessage['parts'][number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

function getLatestUserQuery(messages: ChatMessage[]): string {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  return getMessageText(latestUserMessage);
}

function formatRetrievedContext(
  documents: Awaited<ReturnType<typeof retrieveContextForChat>>['documents']
): string {
  if (documents.length === 0) {
    return 'No indexed portal context matched the current question. Use tools to inspect sync status, audit findings, or search the index again.';
  }

  return documents
    .map(
      (document, index) =>
        `${index + 1}. [${document.docType}] ${document.configName ?? document.configId ?? 'Untitled'}\n${document.chunkText.slice(0, 900)}`
    )
    .join('\n\n');
}

export async function POST(req: NextRequest) {
  const denied = await requireSession(req);
  if (denied) return denied;

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { chatId, tenantId, messages } = parsed.data;
  const typedMessages = messages as ChatMessage[];
  const latestUserQuery = getLatestUserQuery(typedMessages);
  const [tenant, initialContext] = await Promise.all([
    getTenantOrThrow(tenantId),
    retrieveContextForChat({ tenantId, query: latestUserQuery || 'portal summary' }),
  ]);

  const result = streamText({
    model: chatModel,
    providerOptions: {
      openai: {
        store: false,
        reasoningEffort: 'minimal',
      },
    },
    system: [
      `You are HubSpot Copilot for the portal "${tenant.name}" (${tenant.hubspotPortalId}).`,
      'Answer questions using the tenant snapshots, sync status, audit findings, and HubSpot documentation context.',
      'Stay grounded in the indexed data. If the snapshot is incomplete or uncertain, say so explicitly.',
      'Prefer concise, operational answers with clear recommendations.',
      'When you cite information, reference the source label from the provided context or tool output.',
      '',
      'Initial retrieved context:',
      formatRetrievedContext(initialContext.documents),
    ].join('\n'),
    messages: await convertToModelMessages(typedMessages),
    tools: {
      searchPortalConfig: tool({
        description: 'Search the indexed HubSpot portal configuration for relevant workflows, properties, forms, lists, owners, pipelines, or emails.',
        inputSchema: z.object({
          query: z.string().min(2),
          objectTypes: z.array(z.string()).optional(),
        }),
        execute: async ({ query, objectTypes }) => {
          const documents = await searchPortalConfig({
            tenantId,
            query,
            objectTypes,
            matchCount: 6,
          });

          return {
            results: documents.map((document) => ({
              source: document.configName ?? document.configId ?? document.docType,
              docType: document.docType,
              objectType: document.objectType,
              similarity: Number(document.similarity.toFixed(3)),
              excerpt: document.chunkText.slice(0, 400),
            })),
          };
        },
      }),
      searchHubSpotDocs: tool({
        description: 'Search shared HubSpot documentation that was ingested into the vector store.',
        inputSchema: z.object({
          query: z.string().min(2),
        }),
        execute: async ({ query }) => {
          const documents = await searchHubSpotDocs({
            tenantId,
            query,
            matchCount: 4,
          });

          return {
            results: documents.map((document) => ({
              source: document.metadata.section ?? document.configName ?? 'HubSpot docs',
              similarity: Number(document.similarity.toFixed(3)),
              excerpt: document.chunkText.slice(0, 400),
            })),
          };
        },
      }),
      getPortalSyncStatus: tool({
        description: 'Return the latest per-resource sync status for the current portal.',
        inputSchema: z.object({}),
        execute: async () => {
          const syncStatuses = await listSyncStatuses(tenantId);
          return {
            statuses: syncStatuses.map((status) => ({
              resourceType: status.resourceType,
              status: status.status,
              itemsCount: status.itemsCount,
              lastSynced: status.lastSynced?.toISOString() ?? null,
              errorMessage: status.errorMessage,
            })),
          };
        },
      }),
      getLatestAuditFindings: tool({
        description: 'Generate the latest deterministic audit findings for the current portal.',
        inputSchema: z.object({}),
        execute: async () => {
          const report = await generateAuditReport(tenantId);
          return {
            overallScore: report.overallScore,
            findings: report.findings.slice(0, 8).map((finding) => ({
              severity: finding.severity,
              title: finding.title,
              description: finding.description,
              recommendation: finding.recommendation,
            })),
          };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse<ChatMessage>({
    originalMessages: typedMessages,
    generateMessageId: createIdGenerator({
      prefix: 'msg',
      size: 16,
    }),
    messageMetadata: ({ part }) => {
      if (part.type === 'start') {
        return {
          model: CHAT_MODEL_ID,
          createdAt: Date.now(),
          citations: initialContext.citations,
        };
      }

      if (part.type === 'finish') {
        return {
          totalTokens: part.totalUsage.totalTokens,
        };
      }

      return undefined;
    },
    onFinish: async ({ messages: finishedMessages }) => {
      await saveConversationMessages({
        tenantId,
        chatId,
        messages: finishedMessages as ChatMessage[],
      });
    },
    onError: (error) => {
      console.error('Chat route error:', error);
      return 'Unable to generate a chat response.';
    },
  });
}
