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
  contextLimit: number;
  onChangeContextLimit: (limit: number) => void;
  onClearAllData: () => void;
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
  contextLimit,
  onChangeContextLimit,
  onClearAllData,
}) => {
  return (
    <>
      <aside id="sidebar" className={isOpen ? 'open' : ''}>
        <div className="side-top">
          <div className="brand">
            <div className="logo">⚡</div>
            <span>AI Console</span>
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
              <option value="auto">Tự động (Khuyên dùng)</option>
              <option value="proxy">Luôn dùng proxy</option>
              <option value="direct">Trực tiếp (Direct fetch)</option>
            </select>
          </div>

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
