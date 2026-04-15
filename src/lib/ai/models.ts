import OpenAI from 'openai';
import { openai } from '@ai-sdk/openai';

export const CHAT_MODEL_ID = process.env.OPENAI_CHAT_MODEL ?? 'gpt-5-mini';
export const EMBEDDING_MODEL_ID = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';

export const chatModel = openai(CHAT_MODEL_ID);
export const openaiClient = new OpenAI();
