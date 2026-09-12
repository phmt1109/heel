import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ApiFormat, AppState, ChatMessage, NetworkTransport, Preset, Provider, Settings } from './types';
import { DEFAULT_PRESETS, DEFAULT_SETTINGS, STORAGE_KEY } from './constants';
import { executeChat, fetchProviderModels, filterModels } from './utils/apiAdapters';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { SettingsBar } from './components/SettingsBar';
import { SysPanel } from './components/SysPanel';
import { MessagesView } from './components/MessagesView';
import { Composer } from './components/Composer';
import { ProviderModal } from './components/ProviderModal';
import { Toast } from './components/Toast';

export default function App() {
  // Application State
  const [providers, setProviders] = useState<Provider[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});
  const [manualModelMap, setManualModelMap] = useState<Record<string, boolean>>({});
  const [manualModelNames, setManualModelNames] = useState<Record<string, string>>({});
  const [conversations, setConversations] = useState<Record<string, ChatMessage[]>>({});
  const [myPresets, setMyPresets] = useState<Preset[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [showSysPanel, setShowSysPanel] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastIsError, setToastIsError] = useState<boolean>(false);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [streamingText, setStreamingText] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  // Show Toast
  const triggerToast = (msg: string, isErr = false) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    setToastIsError(isErr);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Load from LocalStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Partial<AppState> = JSON.parse(raw);
        if (parsed.providers && Array.isArray(parsed.providers)) {
          // Remove previously seeded sample providers from dashboard
          const cleanProviders = parsed.providers.filter(
            (p) => p.id !== 'prov-openai-sample' && p.id !== 'prov-gemini-sample'
          );
          setProviders(cleanProviders);
          if (parsed.activeProviderId && cleanProviders.some((p) => p.id === parsed.activeProviderId)) {
            setActiveProviderId(parsed.activeProviderId);
          } else {
            setActiveProviderId(cleanProviders[0]?.id || null);
          }
        } else {
          initDefaultProviders();
        }
        if (parsed.selectedModels) setSelectedModels(parsed.selectedModels);
        if (parsed.manualModelMap) setManualModelMap(parsed.manualModelMap);
        if (parsed.manualModelNames) setManualModelNames(parsed.manualModelNames);
        if (parsed.conversations) setConversations(parsed.conversations);
        if (parsed.myPresets) setMyPresets(parsed.myPresets);
        if (parsed.settings) setSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
      } else {
        initDefaultProviders();
      }
    } catch (e) {
      console.error('Error reading localStorage:', e);
      initDefaultProviders();
    }
  }, []);

  const initDefaultProviders = () => {
    setProviders([]);
    setActiveProviderId(null);
    setSelectedModels({});
  };

  // Save to LocalStorage on state change
  useEffect(() => {
    const toSave: AppState = {
      providers,
      activeProviderId,
      selectedModels,
      manualModelMap,
      manualModelNames,
      conversations,
      myPresets,
      settings,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, [
    providers,
    activeProviderId,
    selectedModels,
    manualModelMap,
    manualModelNames,
    conversations,
    myPresets,
    settings,
  ]);

  // Active provider object
  const activeProvider = useMemo(() => {
    return providers.find((p) => p.id === activeProviderId) || providers[0] || null;
  }, [providers, activeProviderId]);

  // Filtered models for active provider
  const availableModels = useMemo(() => {
    if (!activeProvider) return [];
    return filterModels(activeProvider.models || [], settings.filterChatModels);
  }, [activeProvider, settings.filterChatModels]);

  // Current selected model name for active provider
  const currentModelName = useMemo(() => {
    if (!activeProvider) return '';
    const provId = activeProvider.id;
    const isManual = manualModelMap[provId] || false;
    if (isManual) {
      return manualModelNames[provId] || '';
    }
    const selected = selectedModels[provId];
    if (selected && availableModels.includes(selected)) {
      return selected;
    }
    return availableModels[0] || '';
  }, [activeProvider, manualModelMap, manualModelNames, selectedModels, availableModels]);

  // Active provider's conversation
  const currentMessages = useMemo(() => {
    if (!activeProvider) return [];
    return conversations[activeProvider.id] || [];
  }, [activeProvider, conversations]);

  // Scan models for a specific provider
  const handleRescanProvider = async (prov: Provider) => {
    setIsScanning(true);
    setProviders((prev) =>
      prev.map((p) =>
        p.id === prov.id ? { ...p, status: 'loading', statusText: 'Đang kết nối dò model...' } : p
      )
    );

    try {
      const foundModels = await fetchProviderModels(prov, settings.transport);
      if (foundModels.length === 0) {
        throw new Error('Không tìm thấy model nào từ phản hồi của API.');
      }

      setProviders((prev) =>
        prev.map((p) =>
          p.id === prov.id
            ? {
                ...p,
                models: foundModels,
                status: 'ok',
                statusText: `✓ Tìm thấy ${foundModels.length} models`,
                lastChecked: Date.now(),
              }
            : p
        )
      );

      // Auto-select first chat model
      const filtered = filterModels(foundModels, settings.filterChatModels);
      const defaultChoice = filtered[0] || foundModels[0];
      setSelectedModels((prev) => ({ ...prev, [prov.id]: defaultChoice }));

      triggerToast(`✓ [${prov.name}] Dò thành công ${foundModels.length} models!`);
    } catch (err: any) {
      console.error('Scan error:', err);
      const errMsg = err?.message || 'Không thể kết nối đến nhà cung cấp';
      setProviders((prev) =>
        prev.map((p) =>
          p.id === prov.id
            ? {
                ...p,
                status: 'err',
                statusText: `Lỗi: ${errMsg.slice(0, 100)}`,
              }
            : p
        )
      );
      triggerToast(`❌ Lỗi dò model [${prov.name}]: ${errMsg.slice(0, 80)}`, true);
    } finally {
      setIsScanning(false);
    }
  };

  // Add / Edit Provider Save Handler
  const handleSaveProvider = (data: {
    name: string;
    baseUrl: string;
    format: ApiFormat;
    apiKey: string;
    saveAsPreset: boolean;
  }) => {
    if (editingProvider) {
      // Update existing provider
      setProviders((prev) =>
        prev.map((p) =>
          p.id === editingProvider.id
            ? {
                ...p,
                name: data.name,
                baseUrl: data.baseUrl,
                format: data.format,
                apiKey: data.apiKey,
                status: 'idle',
                statusText: undefined,
              }
            : p
        )
      );
      triggerToast(`Đã cập nhật nhà cung cấp: ${data.name}`);
    } else {
      // Add new provider
      const newId = `prov-${Date.now()}`;
      const newProv: Provider = {
        id: newId,
        name: data.name,
        baseUrl: data.baseUrl,
        format: data.format,
        apiKey: data.apiKey,
        models: [],
        status: 'idle',
      };
      setProviders((prev) => [...prev, newProv]);
      setActiveProviderId(newId);
      triggerToast(`Đã thêm nhà cung cấp: ${data.name}`);

      // If user supplied an API key, automatically trigger model scan
      if (data.apiKey) {
        setTimeout(() => handleRescanProvider(newProv), 300);
      }
    }

    // Save as Custom Preset if requested
    if (data.saveAsPreset) {
      const presetId = `preset-custom-${Date.now()}`;
      const newCustomPreset: Preset = {
        id: presetId,
        name: data.name,
        baseUrl: data.baseUrl,
        format: data.format,
        group: 'custom',
        isCustom: true,
      };
      setMyPresets((prev) => [...prev, newCustomPreset]);
      triggerToast(`Đã lưu "${data.name}" vào danh sách Mẫu của tôi!`);
    }

    setModalOpen(false);
    setEditingProvider(null);
  };

  // Delete Provider
  const handleDeleteProvider = (id: string) => {
    const prov = providers.find((p) => p.id === id);
    if (!prov) return;
    if (!window.confirm(`Bạn có chắc muốn xoá nhà cung cấp "${prov.name}" không?`)) {
      return;
    }
    const remaining = providers.filter((p) => p.id !== id);
    setProviders(remaining);
    if (activeProviderId === id) {
      setActiveProviderId(remaining[0]?.id || null);
    }
    triggerToast(`Đã xoá nhà cung cấp: ${prov.name}`);
  };

  // Delete Custom Preset
  const handleDeleteCustomPreset = (presetId: string) => {
    setMyPresets((prev) => prev.filter((p) => p.id !== presetId));
    triggerToast('Đã xoá mẫu tuỳ chỉnh');
  };

  // Clear all saved data
  const handleClearAllData = () => {
    if (
      window.confirm(
        'CẢNH BÁO: Thao tác này sẽ xoá TOÀN BỘ dữ liệu API key, lịch sử trò chuyện và cài đặt đã lưu trong trình duyệt. Bạn có chắc chắn?'
      )
    ) {
      localStorage.removeItem(STORAGE_KEY);
      initDefaultProviders();
      setConversations({});
      setMyPresets([]);
      setSettings(DEFAULT_SETTINGS);
      triggerToast('Đã xoá toàn bộ dữ liệu đã lưu!');
    }
  };

  // Clear chat for current provider
  const handleClearChat = () => {
    if (!activeProvider) return;
    if (window.confirm(`Xoá toàn bộ lịch sử trò chuyện của "${activeProvider.name}"?`)) {
      setConversations((prev) => ({ ...prev, [activeProvider.id]: [] }));
      triggerToast('Đã xoá hội thoại hiện tại');
    }
  };

  // Delete single message
  const handleDeleteMessage = (msgId: string) => {
    if (!activeProvider) return;
    setConversations((prev) => ({
      ...prev,
      [activeProvider.id]: (prev[activeProvider.id] || []).filter((m) => m.id !== msgId),
    }));
  };

  // Copy message content
  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    triggerToast('Đã sao chép nội dung tin nhắn!');
  };

  // Stop generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setIsThinking(false);
    triggerToast('Đã dừng phản hồi');
  };

  // Send message
  const handleSendMessage = async () => {
    if (!activeProvider) {
      triggerToast('Vui lòng chọn hoặc thêm nhà cung cấp trước!', true);
      return;
    }

    const text = inputMessage.trim();
    if (!text || isGenerating) return;

    const modelToUse = currentModelName;
    if (!modelToUse) {
      triggerToast('Vui lòng chọn model hoặc nhập tên model thủ công!', true);
      return;
    }

    const provId = activeProvider.id;
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const updatedHistory = [...(conversations[provId] || []), userMsg];
    setConversations((prev) => ({ ...prev, [provId]: updatedHistory }));
    setInputMessage('');

    // Trigger AI execution with anti-refusal loop
    await runAiChatFlow({
      provider: activeProvider,
      model: modelToUse,
      history: updatedHistory,
      retryAttempt: 0,
    });
  };

  // Retry last assistant message
  const handleRetryLastMessage = async () => {
    if (!activeProvider || isGenerating) return;
    const provId = activeProvider.id;
    const history = conversations[provId] || [];
    if (history.length === 0) return;

    // Remove last assistant message if present
    let cleanHistory = [...history];
    if (cleanHistory[cleanHistory.length - 1].role === 'assistant') {
      cleanHistory.pop();
    }
    if (cleanHistory.length === 0) return;

    setConversations((prev) => ({ ...prev, [provId]: cleanHistory }));

    await runAiChatFlow({
      provider: activeProvider,
      model: currentModelName,
      history: cleanHistory,
      retryAttempt: 0,
    });
  };

  // Core execution flow with Anti-Refusal 3-Attempt Auto-Retry
  const runAiChatFlow = async (params: {
    provider: Provider;
    model: string;
    history: ChatMessage[];
    retryAttempt: number;
  }) => {
    const { provider, model, history, retryAttempt } = params;
    const provId = provider.id;

    setIsGenerating(true);
    setIsThinking(true);
    setStreamingText('');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let currentAccumulated = '';

      const result = await executeChat({
        provider,
        model,
        messages: history,
        settings,
        abortSignal: controller.signal,
        retryAttempt,
        onDelta: (chunk, accumulated) => {
          setIsThinking(false);
          currentAccumulated = accumulated;
          setStreamingText(accumulated);
        },
      });

      // Anti-Refusal check (Only in 18+ mode)
      if (settings.nsfw && result.isRefusal) {
        console.warn(`Anti-Refusal triggered on attempt ${retryAttempt + 1}. Detected refusal:`, result.fullText);

        if (retryAttempt < 3) {
          triggerToast(
            `⚠️ Phát hiện model ngập ngừng (Lần ${retryAttempt + 1}/3). Đang tự động ép buộc tiếp tục...`,
            true
          );

          // Retry with hardened nudge
          await new Promise((r) => setTimeout(r, 600));
          return await runAiChatFlow({
            provider,
            model,
            history,
            retryAttempt: retryAttempt + 1,
          });
        } else {
          // Exceeded 3 attempts
          const refusalMsg: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: `❌ [CẢNH BÁO KIỂM DUYỆT]: Model "${model}" đã từ chối sinh nội dung sau 3 lần gửi chỉ dẫn ép buộc.\n\n💡 GỢI Ý GIẢI PHÁP:\n- Chuyển sang các model không/ít kiểm duyệt hơn (ví dụ: DeepSeek R1/Chat, Mistral, Grok, hoặc các model Uncensored trên OpenRouter/Together/Ollama).\n- Điều chỉnh câu văn nhập vai trong mục "System prompt" để tránh các từ khóa quá nhạy cảm với bộ lọc của nhà cung cấp này.`,
            timestamp: Date.now(),
            isError: true,
          };
          setConversations((prev) => ({
            ...prev,
            [provId]: [...history, refusalMsg],
          }));
          triggerToast('Model kiên quyết từ chối. Vui lòng thử đổi model khác!', true);
          return;
        }
      }

      // Valid response received! Save to conversation
      const finalAssistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        content: result.fullText || currentAccumulated || '(Phản hồi rỗng)',
        timestamp: Date.now(),
      };

      setConversations((prev) => ({
        ...prev,
        [provId]: [...history, finalAssistantMsg],
      }));
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.log('User aborted generation');
        return;
      }
      console.error('Chat execution failed:', err);
      const errMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `❌ Lỗi yêu cầu (${provider.name}): ${err?.message || String(err)}`,
        timestamp: Date.now(),
        isError: true,
      };
      setConversations((prev) => ({
        ...prev,
        [provId]: [...history, errMsg],
      }));
      triggerToast(`Lỗi: ${err?.message?.slice(0, 100) || 'Không thể nhận phản hồi'}`, true);
    } finally {
      setIsGenerating(false);
      setIsThinking(false);
      setStreamingText('');
      abortControllerRef.current = null;
    }
  };

  const isManual = activeProvider ? manualModelMap[activeProvider.id] || false : false;
  const manualModelVal = activeProvider ? manualModelNames[activeProvider.id] || '' : '';

  return (
    <div id="app">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        providers={providers}
        activeProviderId={activeProviderId}
        onSelectProvider={(id) => {
          setActiveProviderId(id);
          setSidebarOpen(false);
        }}
        onAddProvider={() => {
          setEditingProvider(null);
          setModalOpen(true);
        }}
        onEditProvider={(prov) => {
          setEditingProvider(prov);
          setModalOpen(true);
        }}
        onDeleteProvider={handleDeleteProvider}
        onRescanProvider={handleRescanProvider}
        transport={settings.transport}
        onChangeTransport={(t) => setSettings((s) => ({ ...s, transport: t }))}
        contextLimit={settings.contextLimit}
        onChangeContextLimit={(c) => setSettings((s) => ({ ...s, contextLimit: c }))}
        onClearAllData={handleClearAllData}
      />

      <main id="main">
        <Topbar
          onOpenSidebar={() => setSidebarOpen(true)}
          activeProvider={activeProvider}
          onEditActiveProvider={() => {
            if (activeProvider) {
              setEditingProvider(activeProvider);
            } else {
              setEditingProvider(null);
            }
            setModalOpen(true);
          }}
          models={availableModels}
          selectedModel={currentModelName}
          onSelectModel={(model) => {
            if (activeProvider) {
              setSelectedModels((prev) => ({ ...prev, [activeProvider.id]: model }));
            }
          }}
          isManualModel={isManual}
          onToggleManualModel={() => {
            if (activeProvider) {
              setManualModelMap((prev) => ({ ...prev, [activeProvider.id]: !isManual }));
            }
          }}
          manualModelName={manualModelVal}
          onChangeManualModelName={(name) => {
            if (activeProvider) {
              setManualModelNames((prev) => ({ ...prev, [activeProvider.id]: name }));
            }
          }}
          filterChatModels={settings.filterChatModels}
          onToggleFilterChat={() => {
            setSettings((s) => ({ ...s, filterChatModels: !s.filterChatModels }));
            triggerToast(
              !settings.filterChatModels ? 'Đã bật lọc chỉ model Chat' : 'Đã tắt lọc: Hiển thị mọi model'
            );
          }}
          onRescanModels={() => {
            if (activeProvider) handleRescanProvider(activeProvider);
          }}
          isScanning={isScanning}
          statusInfo={
            activeProvider
              ? `${activeProvider.format.toUpperCase()} • ${currentModelName || 'Chưa chọn model'}`
              : ''
          }
        />

        <SettingsBar
          settings={settings}
          onUpdateSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          showSysPanel={showSysPanel}
          onToggleSysPanel={() => setShowSysPanel((v) => !v)}
          onClearChat={handleClearChat}
        />

        {showSysPanel && (
          <SysPanel
            settings={settings}
            onUpdateSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          />
        )}

        <MessagesView
          messages={currentMessages}
          streamingText={streamingText}
          isGenerating={isGenerating}
          isThinking={isThinking}
          onCopyMessage={handleCopyMessage}
          onRetryLastMessage={handleRetryLastMessage}
          onDeleteMessage={handleDeleteMessage}
        />

        <Composer
          input={inputMessage}
          onChangeInput={setInputMessage}
          onSend={handleSendMessage}
          onStop={handleStopGeneration}
          isGenerating={isGenerating}
          disabled={!activeProvider}
        />
      </main>

      <ProviderModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingProvider(null);
        }}
        editingProvider={editingProvider}
        myPresets={myPresets}
        onSaveProvider={handleSaveProvider}
        onDeleteCustomPreset={handleDeleteCustomPreset}
      />

      <Toast message={toastMessage} isError={toastIsError} />
    </div>
  );
}
