import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';

interface MessagesViewProps {
  messages: ChatMessage[];
  streamingText: string;
  isGenerating: boolean;
  isThinking: boolean;
  onCopyMessage: (content: string) => void;
  onRetryLastMessage: () => void;
  onDeleteMessage: (id: string) => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  messages,
  streamingText,
  isGenerating,
  isThinking,
  onCopyMessage,
  onRetryLastMessage,
  onDeleteMessage,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming text
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, streamingText, isGenerating, isThinking]);

  if (messages.length === 0 && !isGenerating) {
    return (
      <div id="messages" ref={containerRef}>
        <div className="empty" id="emptyState">
          <h2>Chào mừng đến với AI Console</h2>
          <p>
            Hệ thống trò chuyện AI BYOK trực tiếp hỗ trợ đa nhà cung cấp và chế độ 18+ không kiểm duyệt.
          </p>
          <ol>
            <li>Chọn hoặc thêm nhà cung cấp ở <code>Sidebar trái</code></li>
            <li>Dán API key và nhấn <code>Dò model</code></li>
            <li>Chọn model và bắt đầu trò chuyện mượt mà</li>
          </ol>
        </div>
      </div>
    );
  }

  // Helper to render text with markdown-like code block highlights
  const renderFormattedBody = (content: string) => {
    // If contains code blocks ```...```
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const firstLine = lines[0].trim();
        const codeContent =
          firstLine && !firstLine.includes(' ') && lines.length > 1
            ? lines.slice(1).join('\n')
            : lines.join('\n');

        return (
          <pre key={index}>
            <code>{codeContent}</code>
          </pre>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div id="messages" ref={containerRef}>
      {messages.map((m, idx) => {
        const isUser = m.role === 'user';
        const isError = m.isError;
        const isLastAssistant = !isUser && idx === messages.length - 1;

        return (
          <div
            key={m.id}
            className={`msg ${isError ? 'error' : isUser ? 'user' : 'assistant'}`}
          >
            <div className="msg-inner">
              <div className="msg-head">
                <span>{isError ? '⚠️ THÔNG BÁO LỖI' : isUser ? '👤 BẠN' : '⚡ TRỢ LÝ AI'}</span>
                <span style={{ opacity: 0.6, fontSize: 10, marginLeft: 'auto' }}>
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="msg-body">
                {renderFormattedBody(m.content)}
              </div>

              <div className="msg-actions">
                <button
                  type="button"
                  title="Sao chép nội dung tin nhắn"
                  onClick={() => onCopyMessage(m.content)}
                >
                  📋 Sao chép
                </button>
                {isLastAssistant && !isGenerating && (
                  <button
                    type="button"
                    title="Gửi lại yêu cầu để nhận câu trả lời khác"
                    onClick={onRetryLastMessage}
                  >
                    🔄 Thử lại
                  </button>
                )}
                <button
                  type="button"
                  title="Xoá tin nhắn này"
                  onClick={() => onDeleteMessage(m.id)}
                >
                  ✕ Xoá
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Ongoing streaming response or thinking indicator */}
      {isGenerating && (
        <div className="msg assistant">
          <div className="msg-inner">
            <div className="msg-head">
              <span>⚡ TRỢ LÝ AI</span>
              <span style={{ color: 'var(--accent2)', fontSize: 11, marginLeft: 8 }}>
                ● Đang tạo phản hồi...
              </span>
            </div>

            <div className="msg-body">
              {isThinking && !streamingText ? (
                <div className="thinking">
                  <i />
                  <i />
                  <i />
                </div>
              ) : (
                <>
                  {renderFormattedBody(streamingText)}
                  <span className="cursor" />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
