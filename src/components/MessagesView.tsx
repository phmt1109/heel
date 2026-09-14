import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { CodeBlock } from './CodeBlock';

interface MessagesViewProps {
  messages: ChatMessage[];
  streamingText: string;
  isGenerating: boolean;
  isThinking: boolean;
  onCopyMessage: (content: string) => void;
  onRetryLastMessage: () => void;
  onDeleteMessage: (id: string) => void;
}

function renderTextWithInlineCode(text: string, keyPrefix: string): React.ReactNode {
  if (!text.includes('`')) {
    return <span key={keyPrefix} className="whitespace-pre-wrap">{text}</span>;
  }
  const parts = text.split(/(`[^`\n]+`)/g);
  return (
    <span key={keyPrefix} className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return (
            <code key={`${keyPrefix}-${i}`} className="inline-code">
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      })}
    </span>
  );
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
          <h2>✦ AI</h2>
          <ol>
            <li>Chọn hoặc thêm nhà cung cấp ở <code>Menu bên trái</code></li>
            <li>Dán API key và nhấn <code>Dò model</code></li>
            <li>Bật <code>🔞 18+</code> để kích hoạt cơ chế tối cao không kiểm duyệt</li>
          </ol>
        </div>
      </div>
    );
  }

  // Helper to render text with markdown code blocks and inline highlights
  const renderFormattedBody = (content: string) => {
    if (!content) return null;

    const segments: React.ReactNode[] = [];
    const codeBlockRegex = /```([a-zA-Z0-9_\-+]*)\n?([\s\S]*?)(?:```|$)/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const textBefore = content.slice(lastIndex, match.index);
        segments.push(renderTextWithInlineCode(textBefore, `txt-${lastIndex}`));
      }

      const lang = match[1] ? match[1].trim() : '';
      const code = match[2] !== undefined ? match[2] : '';

      segments.push(
        <CodeBlock
          key={`code-${match.index}`}
          language={lang}
          code={code}
        />
      );

      lastIndex = match.index + match[0].length;
      if (match[0].length === 0) {
        codeBlockRegex.lastIndex++;
      }
    }

    if (lastIndex < content.length) {
      const remainingText = content.slice(lastIndex);
      segments.push(renderTextWithInlineCode(remainingText, `txt-${lastIndex}`));
    }

    return segments;
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
