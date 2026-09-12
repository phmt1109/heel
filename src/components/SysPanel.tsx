import React from 'react';
import { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

interface SysPanelProps {
  settings: Settings;
  onUpdateSettings: (patch: Partial<Settings>) => void;
}

export const SysPanel: React.FC<SysPanelProps> = ({ settings, onUpdateSettings }) => {
  const isNsfw = settings.nsfw;
  const currentValue = isNsfw ? settings.systemNSFW : settings.systemNormal;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isNsfw) {
      onUpdateSettings({ systemNSFW: e.target.value });
    } else {
      onUpdateSettings({ systemNormal: e.target.value });
    }
  };

  const handleReset = () => {
    if (isNsfw) {
      onUpdateSettings({ systemNSFW: DEFAULT_SETTINGS.systemNSFW });
    } else {
      onUpdateSettings({ systemNormal: DEFAULT_SETTINGS.systemNormal });
    }
  };

  return (
    <div id="sysPanel">
      {isNsfw && (
        <div id="coreNoteEl" className="core-note">
          ⚠️ <strong>Chế độ 18+ đang bật:</strong> Mệnh lệnh cốt lõi <code>NSFW_CORE</code> và <code>MANDATE_TAIL</code> được tự động áp dụng ngầm. Khung dưới đây CHỈ dành cho phần bổ sung tuỳ chọn của bạn (nhập vai, tính cách, bối cảnh câu chuyện).
        </div>
      )}

      <textarea
        id="sysText"
        placeholder={
          isNsfw
            ? 'Nhập chỉ dẫn câu chuyện 18+, mô tả nhân vật, lời thoại, bối cảnh nhập vai...'
            : 'Nhập chỉ dẫn hệ thống thông thường (VD: Bạn là một trợ lý lập trình chuyên sâu...)'
        }
        value={currentValue}
        onChange={handleChange}
      />

      <div className="sys-actions">
        <span className="hint">
          {isNsfw
            ? '✓ Mệnh lệnh ngầm luôn bảo đảm không từ chối, không giảng đạo lý'
            : '✓ Tự động gửi kèm trong các lượt trò chuyện'}
        </span>
        <button
          id="resetSysBtn"
          className="btn-ghost small"
          style={{ marginLeft: 'auto' }}
          onClick={handleReset}
          title="Khôi phục prompt mặc định"
        >
          Khôi phục mặc định
        </button>
      </div>
    </div>
  );
};
