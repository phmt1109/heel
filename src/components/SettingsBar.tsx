import React from 'react';
import { Settings } from '../types';

interface SettingsBarProps {
  settings: Settings;
  onUpdateSettings: (patch: Partial<Settings>) => void;
  showSysPanel: boolean;
  onToggleSysPanel: () => void;
  onClearChat: () => void;
}

export const SettingsBar: React.FC<SettingsBarProps> = ({
  settings,
  onUpdateSettings,
  showSysPanel,
  onToggleSysPanel,
  onClearChat,
}) => {
  return (
    <section id="settingsBar">
      <label className="ctrl" title="Độ sáng tạo (Temperature)">
        <span>Temp:</span>
        <input
          id="tempRange"
          type="range"
          min="0"
          max="2"
          step="0.05"
          value={settings.temperature}
          onChange={(e) => onUpdateSettings({ temperature: parseFloat(e.target.value) })}
        />
        <span id="tempVal" className="ctrl-val">
          {settings.temperature.toFixed(2)}
        </span>
      </label>

      <label className="ctrl" title="Giới hạn số token tối đa cho câu trả lời">
        <span>Max tokens:</span>
        <input
          id="maxTokensInput"
          type="number"
          className="num"
          value={settings.maxTokens}
          min="1"
          max="131072"
          step="128"
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val > 0) {
              onUpdateSettings({ maxTokens: val });
            }
          }}
        />
      </label>

      <label className="switch ctrl" title="Nhận câu trả lời từng chữ liên tục">
        <input
          id="streamToggle"
          type="checkbox"
          checked={settings.stream}
          onChange={(e) => onUpdateSettings({ stream: e.target.checked })}
        />
        <span>Stream</span>
      </label>

      <label className="switch nsfw ctrl" title="Chế độ 18+ không kiểm duyệt với mệnh lệnh ngầm và chống từ chối tự động">
        <input
          id="nsfwToggle"
          type="checkbox"
          checked={settings.nsfw}
          onChange={(e) => onUpdateSettings({ nsfw: e.target.checked })}
        />
        <span>🔞 18+ KHÔNG GIỚI HẠN</span>
      </label>

      <button
        id="toggleSysBtn"
        className="btn-ghost small"
        style={{
          marginLeft: 'auto',
          borderColor: showSysPanel ? 'var(--accent)' : 'var(--line)',
          color: showSysPanel ? 'var(--fg)' : 'var(--fg2)',
          background: showSysPanel ? 'var(--bg3)' : 'transparent',
        }}
        onClick={onToggleSysPanel}
        title="Bật/tắt khung chỉnh sửa System Prompt"
      >
        ⚙️ System prompt {showSysPanel ? '▲' : '▼'}
      </button>

      <button
        id="clearChatBtn"
        className="btn-ghost small"
        title="Xoá toàn bộ lịch sử trò chuyện của nhà cung cấp này"
        onClick={onClearChat}
      >
        🗑️ Xoá chat
      </button>
    </section>
  );
};
