import { ApiFormat, ChatMessage, JailbreakStrategy, NetworkTransport, Provider, Settings } from '../types';
import {
  ASSISTANT_PREFILL,
  JAILBREAK_PROMPTS,
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
    const corePrompt = `${NSFW_CORE}\n\n${JAILBREAK_PROMPTS.extreme_compliance}`;
    return supplement ? `${corePrompt}\n\n[USER CUSTOM SCENARIO/ROLEPLAY]:\n${supplement}` : corePrompt;
  }
  return settings.systemNormal.trim();
}

/**
 * Helper to safely parse JSON or throw a descriptive error if HTML/text was received
 */
export async function safeParseJson(res: Response, contextLabel: string = 'API'): Promise<any> {
  const text = await res.text();
  const trimmed = text.trim();
  if (trimmed.startsWith('<') || trimmed.toLowerCase().startsWith('<!doctype')) {
    throw new Error(
      `Máy chủ trả về trang HTML thay vì dữ liệu JSON (${contextLabel}). Có thể do URL không hợp lệ hoặc không có proxy backend.`
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Phản hồi từ ${contextLabel} không phải định dạng JSON hợp lệ: ${trimmed.slice(0, 100)}`);
  }
}

/**
 * Universal API fetch supporting Perchance superFetch, Cloudflare Pages/Static host direct fetch, local Express proxy
 */
export async function apiFetch(
  url: string,
  options: RequestInit,
  settings?: Settings | NetworkTransport
): Promise<Response> {
  let transport: NetworkTransport = 'direct';
  let localIpAddress = '127.0.0.1';

  if (typeof settings === 'object' && settings !== null) {
    transport = settings.transport || 'direct';
    localIpAddress = (settings.localIpAddress || '127.0.0.1').trim();
  } else if (typeof settings === 'string') {
    transport = settings as NetworkTransport;
  }

  // Rewrite URL if Local IP transport is selected and URL contains localhost or loopback
  let finalUrl = url;
  if (transport === 'local_ip' && localIpAddress) {
    finalUrl = finalUrl
      .replace('//localhost', `//${localIpAddress}`)
      .replace('//127.0.0.1', `//${localIpAddress}`)
      .replace('//0.0.0.0', `//${localIpAddress}`);
  }

  // 1. If running inside Perchance engine
  if (typeof (window as any).root?.superFetch === 'function') {
    return (window as any).root.superFetch(finalUrl, options);
  }

  // 2. Direct browser fetch (Fast, zero proxy latency, perfect for Cloudflare Pages & Web)
  try {
    return await fetch(finalUrl, options);
  } catch (err: any) {
    const isLocal =
      finalUrl.includes('localhost') ||
      finalUrl.includes('127.0.0.1') ||
      finalUrl.includes('192.168.') ||
      finalUrl.includes('10.');

    if (isLocal) {
      throw new Error(
        `Không thể kết nối đến IP nội bộ (${finalUrl}). Hãy chắc chắn máy tính/thiết bị của bạn đã bật server AI và cho phép CORS (VD: với Ollama đặt OLLAMA_ORIGINS="*").`
      );
    }

    throw new Error(
      `Lỗi kết nối mạng trực tiếp đến ${finalUrl}: ${err.message || 'Bị chặn CORS hoặc sai URL'}. Hãy kiểm tra lại kết nối mạng hoặc thử API key từ nhà cung cấp có hỗ trợ CORS (OpenRouter, Groq, Google Gemini...).`
    );
  }
}

/**
 * Fetch available models for a given provider
 */
export async function fetchProviderModels(
  provider: Provider,
  settingsOrTransport?: Settings | NetworkTransport
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

  const res = await apiFetch(targetUrl, { method: 'GET', headers }, settingsOrTransport);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 180)}`);
  }

  const data = await safeParseJson(res, `danh sách models (${format})`);
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

  // If NSFW is ON: calculate dynamic jailbreak strategy rotation for retries
  let activeSystemPrompt = getActiveSystem(settings);
  if (settings.nsfw && retryAttempt > 0) {
    const strategies: JailbreakStrategy[] = ['adaptive', 'deep_narrative', 'hypothetical_author', 'extreme_compliance'];
    const rotatedStrategy = strategies[retryAttempt % strategies.length];
    const rotatedPrompt = JAILBREAK_PROMPTS[rotatedStrategy] || JAILBREAK_PROMPTS.extreme_compliance;
    activeSystemPrompt = `${rotatedPrompt}\n\n${NSFW_CORE}`;
  }

  // If NSFW is ON: append mandate tail to the last user message in the outgoing payload
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

  const checkSlice = fullResponse.slice(0, 350).toLowerCase();
  const isRefusal =
    settings.nsfw &&
    (fullResponse.trim().length === 0 ||
      (REFUSAL_REGEX.test(checkSlice) && fullResponse.length < 500));

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
    const data = await safeParseJson(res, 'OpenAI completions');
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

  // Assistant prefill technique for Anthropic (Forces continuation without refusal)
  const usePrefill = settings.nsfw && (settings.assistantPrefill ?? true);
  if (usePrefill) {
    formattedMessages.push({
      role: 'assistant',
      content: ASSISTANT_PREFILL,
    });
  }

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
    const data = await safeParseJson(res, 'Anthropic messages');
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

  // 18+ safety settings (standard official Gemini v1beta categories)
  if (settings.nsfw && !retryWithNoSafety) {
    body.safetySettings = [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
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
    // Check if error is safetySettings or invalid argument related on Gemini (HTTP 400)
    if (!retryWithNoSafety && (res.status === 400 || errText.toLowerCase().includes('safety') || errText.toLowerCase().includes('invalid_argument'))) {
      // Retry without safety settings
      return callGemini({
        ...opts,
        retryWithNoSafety: true,
      });
    }
    throw new Error(`Gemini API Error (${res.status}): ${errText.slice(0, 200)}`);
  }

  if (!stream || !res.body) {
    const data = await safeParseJson(res, 'Gemini generateContent');
    const firstCandidate = data?.candidates?.[0];
    const text = firstCandidate?.content?.parts?.[0]?.text || '';
    if (!text && firstCandidate?.finishReason === 'SAFETY') {
      // If blocked by safety finish reason, return empty so anti-refusal or wrapper can handle
      console.warn('Gemini response blocked by finishReason SAFETY');
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
          const firstCandidate = parsed?.candidates?.[0];
          const candidateText = firstCandidate?.content?.parts?.[0]?.text;
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
