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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
            <span>⚠️ <strong>Chế độ 18+ Uncensored cấp cao:</strong></span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '11px', color: '#ffd479', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Chiến thuật phá rào:
                <select
                  id="jailbreakStrategySelect"
                  value={settings.jailbreakStrategy || 'adaptive'}
                  onChange={(e) => onUpdateSettings({ jailbreakStrategy: e.target.value as any })}
                  style={{
                    background: '#1a1408',
                    color: '#ffd479',
                    border: '1px solid #7a5e20',
                    borderRadius: '5px',
                    padding: '2px 6px',
                    fontSize: '11px',
                  }}
                  title="Chọn giao thức phá rào vượt kiểm duyệt phù hợp với model của bạn"
                >
                  <option value="adaptive">⚡ Đa năng (Adaptive Fiction - Khuyên dùng)</option>
                  <option value="deep_narrative">📖 Văn học nhập vai (Deep Novelist)</option>
                  <option value="hypothetical_author">🎬 Kịch bản điện ảnh 18+ (Screenplay)</option>
                  <option value="extreme_compliance">🔥 Ép tuân thủ tuyệt đối (Bypass Engine)</option>
                </select>
              </label>

              <label style={{ fontSize: '11px', color: '#ffd479', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} title="Mớm sẵn câu mở đầu của trợ lý để vô hiệu hoá câu trả lời từ chối">
                <input
                  type="checkbox"
                  checked={settings.assistantPrefill ?? true}
                  onChange={(e) => onUpdateSettings({ assistantPrefill: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Mớm lời mở đầu (Prefill)
              </label>
            </div>
          </div>
          Mệnh lệnh cốt lõi và chiến thuật chống từ chối (Anti-Refusal) được áp dụng tự động ngầm. Khung dưới đây dành cho mô tả nhân vật, lời thoại, hoặc bối cảnh nhập vai của bạn.
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
