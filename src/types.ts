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

export type NetworkTransport = 'direct' | 'local_ip';
export type JailbreakStrategy = 'adaptive' | 'deep_narrative' | 'hypothetical_author' | 'extreme_compliance';

export interface Settings {
  temperature: number;
  maxTokens: number;
  stream: boolean;
  filterChatModels: boolean;
  nsfw: boolean;
  systemNormal: string;
  systemNSFW: string;
  transport: NetworkTransport;
  localIpAddress?: string; // Custom LAN/Local IP (e.g. 192.168.1.5, 127.0.0.1, localhost)
  contextLimit: number; // 0 = all, 6, 12, 20, 40
  jailbreakStrategy: JailbreakStrategy;
  assistantPrefill: boolean;
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
