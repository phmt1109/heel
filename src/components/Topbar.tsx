import React from 'react';
import { Provider } from '../types';

interface TopbarProps {
  onOpenSidebar: () => void;
  activeProvider: Provider | null;
  onEditActiveProvider: () => void;
  models: string[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
  isManualModel: boolean;
  onToggleManualModel: () => void;
  manualModelName: string;
  onChangeManualModelName: (name: string) => void;
  filterChatModels: boolean;
  onToggleFilterChat: () => void;
  onRescanModels: () => void;
  isScanning: boolean;
  statusInfo: string;
}

export const Topbar: React.FC<TopbarProps> = ({
  onOpenSidebar,
  activeProvider,
  onEditActiveProvider,
  models,
  selectedModel,
  onSelectModel,
  isManualModel,
  onToggleManualModel,
  manualModelName,
  onChangeManualModelName,
  filterChatModels,
  onToggleFilterChat,
  onRescanModels,
  isScanning,
  statusInfo,
}) => {
  return (
    <header id="topbar">
      <button
        id="openSidebarBtn"
        className="icon-btn mobile-only"
        title="Mở menu nhà cung cấp"
        onClick={onOpenSidebar}
      >
        ☰
      </button>

      <button
        id="activeProvBtn"
        title={activeProvider ? 'Nhấn để cấu hình nhà cung cấp này' : 'Nhấn để thêm nhà cung cấp'}
        onClick={onEditActiveProvider}
      >
        {activeProvider ? `⚡ ${activeProvider.name}` : '+ Thêm nhà cung cấp'}
      </button>

      <div className="grow" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {isManualModel ? (
          <input
            id="modelInput"
            type="text"
            placeholder="Nhập tên model thủ công (VD: gpt-4o, claude-3-7-sonnet...)"
            value={manualModelName}
            onChange={(e) => onChangeManualModelName(e.target.value)}
          />
        ) : (
          <select
            id="modelSelect"
            className="model-select"
            value={selectedModel}
            onChange={(e) => onSelectModel(e.target.value)}
            disabled={!activeProvider}
          >
            {models.length === 0 ? (
              <option value="">(Chưa có model - Nhấn Dò hoặc nhập tay)</option>
            ) : (
              models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))
            )}
          </select>
        )}
      </div>

      <button
        id="toggleManualModelBtn"
        className="icon-btn"
        title={isManualModel ? 'Chuyển sang danh sách chọn' : 'Nhập model thủ công'}
        style={{ color: isManualModel ? 'var(--accent)' : 'inherit' }}
        onClick={onToggleManualModel}
      >
        ✏️
      </button>

      <button
        id="toggleFilterChatBtn"
        className="icon-btn"
        title={filterChatModels ? 'Đang bật: Lọc chỉ model Chat (nhấn để hiện tất cả)' : 'Đang tắt: Hiển thị tất cả model (nhấn để lọc chat)'}
        style={{ color: filterChatModels ? 'var(--accent2)' : 'var(--muted)' }}
        onClick={onToggleFilterChat}
      >
        💬
      </button>

      <button
        id="rescanModelsBtn"
        className="icon-btn"
        title="Dò lại danh sách model cho nhà cung cấp hiện tại"
        onClick={onRescanModels}
        disabled={!activeProvider || isScanning}
      >
        {isScanning ? '⏳' : '🔄'}
      </button>

      <div id="reqInfoEl" className="req-info" title={statusInfo}>
        {statusInfo}
      </div>
    </header>
  );
};
