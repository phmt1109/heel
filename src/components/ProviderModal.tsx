import React, { useState, useEffect } from 'react';
import { ApiFormat, Preset, Provider } from '../types';
import { DEFAULT_PRESETS } from '../constants';
import { detectFormat } from '../utils/apiAdapters';

interface ProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProvider: Provider | null;
  myPresets: Preset[];
  onSaveProvider: (data: {
    name: string;
    baseUrl: string;
    format: ApiFormat;
    apiKey: string;
    saveAsPreset: boolean;
  }) => void;
  onDeleteCustomPreset: (presetId: string) => void;
}

export const ProviderModal: React.FC<ProviderModalProps> = ({
  isOpen,
  onClose,
  editingProvider,
  myPresets,
  onSaveProvider,
  onDeleteCustomPreset,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('custom');
  const [name, setName] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [format, setFormat] = useState<ApiFormat>('openai');
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [saveAsPreset, setSaveAsPreset] = useState<boolean>(false);

  // Sync state when editingProvider changes or modal opens
  useEffect(() => {
    if (editingProvider) {
      setName(editingProvider.name);
      setBaseUrl(editingProvider.baseUrl);
      setFormat(editingProvider.format || detectFormat(editingProvider.baseUrl));
      setApiKey(editingProvider.apiKey || '');
      setSelectedPresetId('custom');
      setSaveAsPreset(false);
    } else {
      // Default to OpenAI preset for convenient quickstart
      const openAiPreset = DEFAULT_PRESETS[0];
      setSelectedPresetId(openAiPreset.id);
      setName(openAiPreset.name);
      setBaseUrl(openAiPreset.baseUrl);
      setFormat(openAiPreset.format);
      setApiKey('');
      setSaveAsPreset(false);
    }
  }, [editingProvider, isOpen]);

  if (!isOpen) return null;

  const detected = detectFormat(baseUrl);

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (presetId === 'custom') {
      return;
    }
    const found = [...myPresets, ...DEFAULT_PRESETS].find((p) => p.id === presetId);
    if (found) {
      setName(found.name);
      setBaseUrl(found.baseUrl);
      setFormat(found.format);
    }
  };

  const handleUrlChange = (val: string) => {
    setBaseUrl(val);
    const autoFmt = detectFormat(val);
    setFormat(autoFmt);
  };

  const isSelectedCustomPreset = myPresets.some((p) => p.id === selectedPresetId);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Vui lòng nhập tên nhà cung cấp.');
      return;
    }
    if (!baseUrl.trim()) {
      alert('Vui lòng nhập Base URL.');
      return;
    }
    onSaveProvider({
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      format,
      apiKey: apiKey.trim(),
      saveAsPreset,
    });
  };

  return (
    <div id="provModal" className="modal">
      <div className="modal-card">
        <div className="modal-head">
          <h3 id="modalTitle">
            {editingProvider ? 'Chỉnh sửa nhà cung cấp' : 'Thêm nhà cung cấp mới'}
          </h3>
          <button id="closeModalBtn" className="icon-btn" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="field">
            <label>Mẫu có sẵn (Preset)</label>
            <div className="preset-row">
              <select
                id="presetSelect"
                value={selectedPresetId}
                onChange={(e) => handleSelectPreset(e.target.value)}
              >
                <option value="custom">✏️ Tự nhập nhà cung cấp (Custom)</option>

                {myPresets.length > 0 && (
                  <optgroup label="Của tôi (đã lưu)">
                    {myPresets.map((p) => (
                      <option key={p.id} value={p.id}>
                        ⭐ {p.name}
                      </option>
                    ))}
                  </optgroup>
                )}

                <optgroup label="Phổ biến">
                  {DEFAULT_PRESETS.filter((p) => p.group === 'popular').map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="Khác">
                  {DEFAULT_PRESETS.filter((p) => p.group === 'other').map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="Máy local">
                  {DEFAULT_PRESETS.filter((p) => p.group === 'local').map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              </select>

              {isSelectedCustomPreset && (
                <button
                  id="delPresetBtn"
                  type="button"
                  className="btn-ghost small"
                  style={{ color: 'var(--danger)' }}
                  onClick={() => onDeleteCustomPreset(selectedPresetId)}
                  title="Xoá mẫu đã lưu này"
                >
                  Xoá mẫu
                </button>
              )}
            </div>
          </div>

          <div className="field">
            <label>Tên hiển thị</label>
            <input
              id="provNameInput"
              type="text"
              placeholder="VD: OpenAI, DeepSeek, Ollama..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>Base URL</label>
            <input
              id="provUrlInput"
              type="text"
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              required
            />
            <div id="formatHint" className="hint" style={{ marginTop: 4 }}>
              Gợi ý định dạng: <strong>{detected}</strong>
              {baseUrl && (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) && (
                <div style={{ marginTop: 5, color: 'var(--warn)' }}>
                  💡 <strong>Lưu ý chạy Local (Ollama/LM Studio):</strong> Hãy bật CORS trên công cụ (ví dụ với Ollama đặt <code>OLLAMA_ORIGINS="*"</code>).
                </div>
              )}
            </div>
          </div>

          <div className="field">
            <label>Định dạng API</label>
            <select
              id="provFormatSelect"
              value={format}
              onChange={(e) => setFormat(e.target.value as ApiFormat)}
            >
              <option value="openai">OpenAI tương thích (/v1/chat/completions)</option>
              <option value="anthropic">Anthropic Claude (/v1/messages)</option>
              <option value="gemini">Google Gemini (/v1beta/models)</option>
            </select>
          </div>

          <div className="field">
            <label>API Key</label>
            <div className="key-row">
              <input
                id="provKeyInput"
                type={showKey ? 'text' : 'password'}
                placeholder="sk-... (để trống nếu dùng Ollama/Localhost không cần key)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button
                id="toggleKeyVisBtn"
                className="icon-btn"
                type="button"
                title={showKey ? 'Ẩn key' : 'Hiện key'}
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>
            <div className="fnote">
              Chỉ lưu an toàn trên máy bạn (localStorage), không lưu trên bất kỳ máy chủ nào.
            </div>
          </div>

          <div className="chk-line" style={{ marginTop: 14 }}>
            <input
              id="saveAsPresetChk"
              type="checkbox"
              checked={saveAsPreset}
              onChange={(e) => setSaveAsPreset(e.target.checked)}
            />
            <label htmlFor="saveAsPresetChk">Lưu nhà cung cấp này làm Mẫu (Preset) của tôi</label>
          </div>

          <div className="modal-actions">
            <button
              id="cancelModalBtn"
              type="button"
              className="btn-ghost"
              onClick={onClose}
            >
              Huỷ
            </button>
            <button id="saveProvBtn" type="submit" className="btn-primary">
              Lưu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
