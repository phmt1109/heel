import React from 'react';
import { NetworkTransport, Provider } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  providers: Provider[];
  activeProviderId: string | null;
  onSelectProvider: (id: string) => void;
  onAddProvider: () => void;
  onEditProvider: (prov: Provider) => void;
  onDeleteProvider: (id: string) => void;
  onRescanProvider: (prov: Provider) => void;
  transport: NetworkTransport;
  onChangeTransport: (transport: NetworkTransport) => void;
  localIpAddress?: string;
  onChangeLocalIpAddress?: (ip: string) => void;
  contextLimit: number;
  onChangeContextLimit: (limit: number) => void;
  onClearAllData: () => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  providers,
  activeProviderId,
  onSelectProvider,
  onAddProvider,
  onEditProvider,
  onDeleteProvider,
  onRescanProvider,
  transport,
  onChangeTransport,
  localIpAddress = '127.0.0.1',
  onChangeLocalIpAddress,
  contextLimit,
  onChangeContextLimit,
  onClearAllData,
  onExportBackup,
  onImportBackup,
}) => {
  return (
    <>
      <aside id="sidebar" className={isOpen ? 'open' : ''}>
        <div className="side-top">
          <div className="brand">
            <div className="logo">⚡</div>
            <span>AI</span>
          </div>
          <button
            id="closeSidebarBtn"
            className="icon-btn mobile-only"
            title="Đóng menu"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <p className="disclaimer">
          🔒 <strong>Bảo mật:</strong> API key chỉ lưu tại localStorage trình duyệt và gửi thẳng tới nhà cung cấp đã chọn.
        </p>

        <div className="providers" id="providersList">
          {providers.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '24px 8px' }}>
              Chưa có nhà cung cấp nào. Hãy nhấn Thêm bên dưới!
            </div>
          ) : (
            providers.map((prov) => {
              const isActive = prov.id === activeProviderId;
              const modelCount = prov.models?.length || 0;

              return (
                <div
                  key={prov.id}
                  className={`prov ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectProvider(prov.id)}
                >
                  <div className="prov-top">
                    <span className={`dot ${prov.status || 'idle'}`} />
                    <span className="prov-name" title={prov.name}>
                      {prov.name}
                    </span>
                    <span className="chip">{prov.format || 'openai'}</span>
                  </div>

                  <div className="prov-sub" title={prov.baseUrl}>
                    {prov.baseUrl} • {modelCount} model{modelCount !== 1 ? 's' : ''}
                  </div>

                  {prov.statusText && (
                    <div
                      className={`prov-status ${prov.status === 'err' ? 'err' : prov.status === 'loading' ? 'loading' : ''}`}
                    >
                      {prov.statusText}
                    </div>
                  )}

                  <div className="prov-actions">
                    <button
                      type="button"
                      title="Dò lại danh sách model"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRescanProvider(prov);
                      }}
                      disabled={prov.status === 'loading'}
                    >
                      🔄 {prov.status === 'loading' ? 'Đang dò...' : 'Dò model'}
                    </button>
                    <button
                      type="button"
                      title="Chỉnh sửa cấu hình"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditProvider(prov);
                      }}
                    >
                      ✏️ Sửa
                    </button>
                    <button
                      type="button"
                      className="danger"
                      title="Xoá nhà cung cấp này"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProvider(prov.id);
                      }}
                    >
                      🗑️ Xoá
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <button id="addProvBtn" className="btn-add" onClick={onAddProvider}>
          + Thêm nhà cung cấp
        </button>

        <div className="side-bottom">
          <div className="row">
            <span>Kết nối mạng</span>
            <select
              id="transportSelect"
              value={transport}
              onChange={(e) => onChangeTransport(e.target.value as NetworkTransport)}
            >
              <option value="direct">🌐 Trực tiếp (Cloudflare / Direct)</option>
              <option value="local_ip">🏠 Kết nối nội bộ (Địa chỉ IP thiết bị)</option>
            </select>
          </div>

          {transport === 'local_ip' && (
            <div className="row" style={{ marginTop: 2 }}>
              <span style={{ fontSize: '12px' }}>IP thiết bị:</span>
              <input
                type="text"
                value={localIpAddress}
                placeholder="127.0.0.1 hoặc 192.168.1.x"
                style={{ fontSize: '12px', padding: '4px 8px', width: '130px' }}
                onChange={(e) => onChangeLocalIpAddress && onChangeLocalIpAddress(e.target.value)}
                title="Nhập địa chỉ IP nội bộ của thiết bị đang chạy AI"
              />
            </div>
          )}

          <div className="row">
            <span>Ngữ cảnh gửi</span>
            <select
              id="contextSelect"
              value={contextLimit}
              onChange={(e) => onChangeContextLimit(Number(e.target.value))}
            >
              <option value="0">Tất cả hội thoại</option>
              <option value="6">6 tin gần nhất</option>
              <option value="12">12 tin gần nhất</option>
              <option value="20">20 tin gần nhất</option>
              <option value="40">40 tin gần nhất</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              id="exportBackupBtn"
              className="btn-ghost small"
              style={{ flex: 1, padding: '5px 4px', textAlign: 'center' }}
              onClick={onExportBackup}
              title="Tải file sao lưu (JSON) chứa API key và cấu hình"
            >
              💾 Sao lưu
            </button>
            <label
              id="importBackupLabel"
              className="btn-ghost small"
              style={{ flex: 1, padding: '5px 4px', textAlign: 'center', cursor: 'pointer', display: 'inline-block' }}
              title="Khôi phục dữ liệu từ file sao lưu JSON"
            >
              📥 Khôi phục
              <input
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onImportBackup(file);
                    e.target.value = '';
                  }
                }}
              />
            </label>
          </div>

          <button
            id="clearAllBtn"
            className="btn-ghost small"
            style={{ color: 'var(--danger)' }}
            onClick={onClearAllData}
            title="Xoá tất cả API key, lịch sử và thiết lập đã lưu"
          >
            🗑️ Xoá toàn bộ dữ liệu
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="overlay"
          onClick={onClose}
          style={{ display: 'block' }}
        />
      )}
    </>
  );
};
