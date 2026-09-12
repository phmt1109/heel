import { ApiFormat, ChatMessage, NetworkTransport, Provider, Settings } from '../types';
import {
  MANDATE_TAIL,
  NON_CHAT_MODELS_REGEX,
  NSFW_CORE,
  REFUSAL_REGEX,
  retryNudge,
} from '../constants';

export function detectFormat(baseUrl: string): ApiFormat {
  const url = (baseUrl || '').toLowerCase();
  if (url.includes('anthropic')) return 'anthropic';
  if (url.includes('generativelanguage') || url.includes('gemini') || url.includes('google')) return 'gemini';
  return 'openai';
}

export function filterModels(models: string[], filterChat: boolean): string[] {
  if (!filterChat) return models;
  return models.filter((m) => !NON_CHAT_MODELS_REGEX.test(m));
}

export function trimContext(messages: ChatMessage[], limit: number): ChatMessage[] {
  if (limit <= 0 || messages.length <= limit) return [...messages];
  const sliced = messages.slice(-limit);
  // Ensure trimmed context always starts with a user message
  while (sliced.length > 0 && sliced[0].role !== 'user') {
    sliced.shift();
  }
  return sliced;
}

export function getActiveSystem(settings: Settings): string {
  if (settings.nsfw) {
    const supplement = settings.systemNSFW.trim();
    return supplement ? `${NSFW_CORE}\n\n${supplement}` : NSFW_CORE;
  }
  return settings.systemNormal.trim();
}

/**
 * Universal API fetch supporting Perchance superFetch, local Express proxy, or direct fetch
 */
export async function apiFetch(
  url: string,
  options: RequestInit,
  transport: NetworkTransport = 'auto'
): Promise<Response> {
  const isLocalhost =
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('0.0.0.0') ||
    url.includes('192.168.') ||
    url.includes('10.') ||
    url.endsWith('.local');

  // If running inside Perchance engine
  if (typeof (window as any).root?.superFetch === 'function') {
    return (window as any).root.superFetch(url, options);
  }

  // When webpage is loaded over HTTPS, direct fetch to http:// localhost or private IP
  // is blocked by the browser due to Mixed Content / Private Network Access restrictions.
  // We first try direct fetch for localhost/LAN, and if that fails or blocks, fall back through the proxy.
  if (transport === 'direct') {
    return fetch(url, options);
  }

  if (isLocalhost) {
    try {
      return await fetch(url, options);
    } catch {
      // Direct access failed (e.g. Mixed Content HTTPS->HTTP or CORS), try through proxy
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      return fetch(proxyUrl, options);
    }
  }

  // Use proxy (/api/proxy) to bypass browser CORS for commercial APIs (OpenAI, Anthropic, Gemini, etc.)
  try {
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, options);
    if (res.ok || res.status < 500) {
      return res;
    }
    // If proxy failed with 502/504, try direct fetch as fallback
    return fetch(url, options);
  } catch {
    // If proxy network error, fallback to direct fetch
    return fetch(url, options);
  }
}

/**
 * Fetch available models for a given provider
 */
export async function fetchProviderModels(
  provider: Provider,
  transport: NetworkTransport
): Promise<string[]> {
  const format = provider.format || detectFormat(provider.baseUrl);
  const baseUrl = provider.baseUrl.replace(/\/+$/, '');
  const apiKey = (provider.apiKey || '').trim();

  let targetUrl = '';
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (format === 'openai') {
    targetUrl = `${baseUrl}/models`;
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  } else if (format === 'anthropic') {
    targetUrl = `${baseUrl}/models`;
    if (apiKey) {
      headers['x-api-key'] = apiKey;
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    headers['anthropic-version'] = '2023-06-01';
  } else if (format === 'gemini') {
    targetUrl = `${baseUrl}/models?key=${encodeURIComponent(apiKey)}`;
  }

  const res = await apiFetch(targetUrl, { method: 'GET', headers }, transport);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 180)}`);
  }

  const data = await res.json();
  const models: string[] = [];

  if (format === 'gemini') {
    if (Array.isArray(data.models)) {
      for (const m of data.models) {
        if (m.name) {
          const cleanName = m.name.replace(/^models\//, '');
          // If supportedGenerationMethods is present, ensure it supports generateContent
          if (!m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent')) {
            models.push(cleanName);
          }
        }
      }
    }
  } else if (format === 'openai' || format === 'anthropic') {
    const list = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
    for (const item of list) {
      if (typeof item === 'string') {
        models.push(item);
      } else if (item && typeof item.id === 'string') {
        models.push(item.id);
      } else if (item && typeof item.name === 'string') {
        models.push(item.name);
      }
    }
  }

  // Deduplicate and sort
  const unique = Array.from(new Set(models)).sort((a, b) => a.localeCompare(b));
  return unique;
}

export interface ChatExecuteParams {
  provider: Provider;
  model: string;
  messages: ChatMessage[];
  settings: Settings;
  onDelta: (text: string, fullText: string) => void;
  abortSignal?: AbortSignal;
  retryAttempt?: number;
}

export interface ChatExecuteResult {
  fullText: string;
  isRefusal: boolean;
}

/**
 * Execute chat request with anti-refusal detection and Gemini safety fallback
 */
export async function executeChat(params: ChatExecuteParams): Promise<ChatExecuteResult> {
  const { provider, model, messages, settings, onDelta, abortSignal, retryAttempt = 0 } = params;
  const format = provider.format || detectFormat(provider.baseUrl);
  const baseUrl = provider.baseUrl.replace(/\/+$/, '');
  const apiKey = (provider.apiKey || '').trim();

  // Prepare trimmed context
  const trimmed = trimContext(messages, settings.contextLimit);

  // If NSFW is ON: append mandate tail to the last user message in the outgoing payload
  const activeSystemPrompt = getActiveSystem(settings);
  const payloadMessages = trimmed.map((m, idx) => {
    let content = m.content;
    if (settings.nsfw && m.role === 'user' && idx === trimmed.length - 1) {
      content += MANDATE_TAIL;
      if (retryAttempt > 0) {
        content += retryNudge(retryAttempt);
      }
    }
    return { role: m.role, content };
  });

  const stream = settings.stream;

  let fullResponse = '';

  if (format === 'gemini') {
    fullResponse = await callGemini({
      baseUrl,
      apiKey,
      model,
      systemPrompt: activeSystemPrompt,
      messages: payloadMessages,
      settings,
      stream,
      onDelta,
      abortSignal,
      retryWithNoSafety: false,
    });
  } else if (format === 'anthropic') {
    fullResponse = await callAnthropic({
      baseUrl,
      apiKey,
      model,
      systemPrompt: activeSystemPrompt,
      messages: payloadMessages,
      settings,
      stream,
      onDelta,
      abortSignal,
    });
  } else {
    // OpenAI format
    fullResponse = await callOpenAI({
      baseUrl,
      apiKey,
      model,
      systemPrompt: activeSystemPrompt,
      messages: payloadMessages,
      settings,
      stream,
      onDelta,
      abortSignal,
    });
  }

  const isRefusal =
    settings.nsfw &&
    (REFUSAL_REGEX.test(fullResponse) || fullResponse.trim().length === 0);

  return {
    fullText: fullResponse,
    isRefusal,
  };
}

/**
 * OpenAI Chat completion handler (Streaming & Sync)
 */
async function callOpenAI(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: { role: string; content: string }[];
  settings: Settings;
  stream: boolean;
  onDelta: (chunk: string, accumulated: string) => void;
  abortSignal?: AbortSignal;
}): Promise<string> {
  const { baseUrl, apiKey, model, systemPrompt, messages, settings, stream, onDelta, abortSignal } = opts;

  const formattedMessages: { role: string; content: string }[] = [];
  if (systemPrompt) {
    formattedMessages.push({ role: 'system', content: systemPrompt });
  }
  for (const m of messages) {
    formattedMessages.push({ role: m.role, content: m.content });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: stream ? 'text/event-stream, application/json' : 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const body: any = {
    model,
    messages: formattedMessages,
    temperature: settings.temperature,
    max_tokens: settings.maxTokens,
    stream,
  };

  const res = await apiFetch(
    `${baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: abortSignal,
    },
    settings.transport
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI API Error (${res.status}): ${errText}`);
  }

  if (!stream || !res.body) {
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    onDelta(content, content);
    return content;
  }

  // Handle SSE streaming
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulated = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith(':')) continue;

      if (trimmedLine.startsWith('data:')) {
        const dataStr = trimmedLine.slice(5).trim();
        if (dataStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            accumulated += delta;
            onDelta(delta, accumulated);
          }
        } catch {
          // ignore partial json
        }
      }
    }
  }

  return accumulated;
}

/**
 * Anthropic Messages handler (Streaming & Sync)
 */
async function callAnthropic(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: { role: string; content: string }[];
  settings: Settings;
  stream: boolean;
  onDelta: (chunk: string, accumulated: string) => void;
  abortSignal?: AbortSignal;
}): Promise<string> {
  const { baseUrl, apiKey, model, systemPrompt, messages, settings, stream, onDelta, abortSignal } = opts;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    Accept: stream ? 'text/event-stream, application/json' : 'application/json',
  };
  if (apiKey) {
    headers['x-api-key'] = apiKey;
    headers['Authorization'] = `Bearer ${apiKey}`; // for Perchance superFetch proxy
  }

  const formattedMessages = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  const body: any = {
    model,
    messages: formattedMessages,
    max_tokens: settings.maxTokens || 2048,
    temperature: settings.temperature,
    stream,
  };
  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const res = await apiFetch(
    `${baseUrl}/messages`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: abortSignal,
    },
    settings.transport
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Anthropic API Error (${res.status}): ${errText}`);
  }

  if (!stream || !res.body) {
    const data = await res.json();
    let text = '';
    if (Array.isArray(data.content)) {
      text = data.content.map((c: any) => c.text || '').join('');
    }
    onDelta(text, text);
    return text;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulated = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith(':')) continue;

      if (trimmedLine.startsWith('data:')) {
        const dataStr = trimmedLine.slice(5).trim();
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            const chunk = parsed.delta.text;
            accumulated += chunk;
            onDelta(chunk, accumulated);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  return accumulated;
}

/**
 * Gemini generateContent handler with 18+ BLOCK_NONE safety settings and auto safety-fallback
 */
async function callGemini(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: { role: string; content: string }[];
  settings: Settings;
  stream: boolean;
  onDelta: (chunk: string, accumulated: string) => void;
  abortSignal?: AbortSignal;
  retryWithNoSafety?: boolean;
}): Promise<string> {
  const {
    baseUrl,
    apiKey,
    model,
    systemPrompt,
    messages,
    settings,
    stream,
    onDelta,
    abortSignal,
    retryWithNoSafety,
  } = opts;

  // Clean model name
  const cleanModel = model.replace(/^models\//, '');

  const endpoint = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
  const url = `${baseUrl}/models/${cleanModel}:${endpoint}&key=${encodeURIComponent(apiKey)}`;

  // Convert messages to Gemini format
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: any = {
    contents,
    generationConfig: {
      temperature: settings.temperature,
      maxOutputTokens: settings.maxTokens,
    },
  };

  if (systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  // 18+ safety settings
  if (settings.nsfw && !retryWithNoSafety) {
    body.safetySettings = [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
    ];
  }

  const res = await apiFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: stream ? 'text/event-stream, application/json' : 'application/json',
      },
      body: JSON.stringify(body),
      signal: abortSignal,
    },
    settings.transport
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    // Check if error is safetySettings related on Gemini (HTTP 400 with safety mention)
    if (!retryWithNoSafety && (res.status === 400 || errText.toLowerCase().includes('safety'))) {
      // Retry without safety settings
      return callGemini({
        ...opts,
        retryWithNoSafety: true,
      });
    }
    throw new Error(`Gemini API Error (${res.status}): ${errText.slice(0, 200)}`);
  }

  if (!stream || !res.body) {
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    onDelta(text, text);
    return text;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulated = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith(':')) continue;

      if (trimmedLine.startsWith('data:')) {
        const dataStr = trimmedLine.slice(5).trim();
        try {
          const parsed = JSON.parse(dataStr);
          const candidateText = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (typeof candidateText === 'string') {
            // Handle delta vs cumulative chunk
            if (candidateText.startsWith(accumulated) && candidateText.length > accumulated.length) {
              const delta = candidateText.slice(accumulated.length);
              accumulated = candidateText;
              onDelta(delta, accumulated);
            } else if (!accumulated.endsWith(candidateText)) {
              accumulated += candidateText;
              onDelta(candidateText, accumulated);
            }
          }
        } catch {
          // ignore
        }
      }
    }
  }

  return accumulated;
}
