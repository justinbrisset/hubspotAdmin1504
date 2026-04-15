'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/status-pill';
import type { ChatCitation, ConversationSummary, StoredChatMessageMetadata } from '@/types';

type ChatMessage = UIMessage<StoredChatMessageMetadata>;

function getMessageText(message: ChatMessage): string {
  return message.parts
    .filter((part): part is Extract<ChatMessage['parts'][number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

function getCitations(message: ChatMessage): ChatCitation[] {
  return Array.isArray(message.metadata?.citations) ? message.metadata.citations : [];
}

export function ChatPanel({
  tenantId,
  chatId,
  initialMessages,
  conversations,
  newChatHref,
}: {
  tenantId: string;
  chatId: string;
  initialMessages: ChatMessage[];
  conversations: ConversationSummary[];
  newChatHref: string;
}) {
  const [input, setInput] = useState('');
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: {
          tenantId,
        },
      }),
    [tenantId]
  );

  const { messages, sendMessage, status, error } = useChat<ChatMessage>({
    id: chatId,
    messages: initialMessages,
    transport,
  });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim()) return;

    sendMessage({ text: input });
    setInput('');
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <Panel className="h-fit p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Conversations</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Saved threads</h2>
          </div>

          <Link
            href={newChatHref}
            className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/12"
          >
            New chat
          </Link>
        </div>

        <div className="mt-4 space-y-2">
          {conversations.length === 0 ? (
            <p className="rounded-2xl border border-white/8 bg-slate-950/25 p-4 text-sm text-white/55">
              No saved conversations yet.
            </p>
          ) : (
            conversations.map((conversation) => {
              const active = conversation.id === chatId;

              return (
                <Link
                  key={conversation.id}
                  href={`/portals/${tenantId}/chat?chat=${conversation.id}`}
                  className={`block rounded-2xl border p-4 transition ${
                    active
                      ? 'border-cyan-400/25 bg-cyan-400/10 text-white'
                      : 'border-white/8 bg-slate-950/25 text-white/70 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <p className="font-medium">
                    {conversation.title ?? 'Untitled conversation'}
                  </p>
                  {conversation.preview ? (
                    <p className="mt-2 line-clamp-2 text-sm text-white/55">{conversation.preview}</p>
                  ) : null}
                </Link>
              );
            })
          )}
        </div>
      </Panel>

      <Panel className="flex min-h-[70vh] flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-6 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Assistant</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Portal chat</h2>
          </div>
          <StatusPill tone={status === 'error' ? 'danger' : status === 'streaming' ? 'warning' : 'success'}>
            {status}
          </StatusPill>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {messages.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/25 p-8 text-center text-white/55">
              Ask about workflows, naming hygiene, sync health, property sprawl, or what changed in the latest snapshot.
            </div>
          ) : (
            messages.map((message) => {
              const citations = getCitations(message);

              return (
                <div
                  key={message.id}
                  className={`max-w-3xl rounded-3xl border px-5 py-4 ${
                    message.role === 'user'
                      ? 'ml-auto border-cyan-400/25 bg-cyan-400/10'
                      : 'border-white/8 bg-slate-950/30'
                  }`}
                >
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">
                    {message.role === 'user' ? 'You' : 'Copilot'}
                  </p>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/80">
                    {getMessageText(message) || '...'}
                  </div>

                  {citations.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {citations.map((citation) => (
                        <StatusPill key={`${message.id}-${citation.id}`} tone="neutral">
                          {citation.sourceLabel}
                        </StatusPill>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={submit} className="border-t border-white/8 px-6 py-5">
          {error ? <p className="mb-3 text-sm text-rose-300">{error.message}</p> : null}
          <div className="flex flex-col gap-3 md:flex-row">
            <textarea
              value={input}
              onChange={(event) => setInput(event.currentTarget.value)}
              placeholder="Ask about workflow risks, duplicate properties, sync health, or how to fix a finding..."
              rows={3}
              className="min-h-[120px] flex-1 rounded-3xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-cyan-300/40"
            />
            <button
              type="submit"
              disabled={status === 'submitted' || status === 'streaming' || !input.trim()}
              className="rounded-3xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/12 disabled:opacity-50"
            >
              {status === 'streaming' ? 'Thinking...' : 'Send'}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
