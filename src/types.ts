export type ApiFormat = 'openai' | 'anthropic' | 'gemini';

export type ProviderStatus = 'idle' | 'ok' | 'err' | 'loading';

export type PresetGroup = 'popular' | 'other' | 'local' | 'custom';

export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  format: ApiFormat;
  apiKey: string;
  models: string[];
  status: ProviderStatus;
  statusText?: string;
  lastChecked?: number;
}

export interface Preset {
  id: string;
  name: string;
  baseUrl: string;
  format: ApiFormat;
  group: PresetGroup;
  defaultModels?: string[];
  isCustom?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isError?: boolean;
}

export type NetworkTransport = 'auto' | 'proxy' | 'direct';

export interface Settings {
  temperature: number;
  maxTokens: number;
  stream: boolean;
  filterChatModels: boolean;
  nsfw: boolean;
  systemNormal: string;
  systemNSFW: string;
  transport: NetworkTransport;
  contextLimit: number; // 0 = all, 6, 12, 20, 40
}

export interface AppState {
  providers: Provider[];
  activeProviderId: string | null;
  selectedModels: Record<string, string>; // providerId -> modelName
  manualModelMap: Record<string, boolean>; // providerId -> boolean
  manualModelNames: Record<string, string>; // providerId -> custom modelName
  conversations: Record<string, ChatMessage[]>; // providerId -> messages
  myPresets: Preset[];
  settings: Settings;
}
