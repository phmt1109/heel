import React, { useRef, useEffect } from 'react';

interface ComposerProps {
  input: string;
  onChangeInput: (val: string) => void;
  onSend: () => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled: boolean;
}

export const Composer: React.FC<ComposerProps> = ({
  input,
  onChangeInput,
  onSend,
  onStop,
  isGenerating,
  disabled,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && input.trim() && !disabled) {
        onSend();
      }
    }
  };

  return (
    <footer id="composer">
      <textarea
        ref={textareaRef}
        id="input"
        rows={1}
        placeholder="Nhập tin nhắn... (Enter để gửi, Shift+Enter xuống dòng)"
        value={input}
        onChange={(e) => onChangeInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isGenerating}
      />

      {isGenerating ? (
        <button
          id="stopBtn"
          type="button"
          className="btn-stop"
          onClick={onStop}
          title="Dừng sinh phản hồi"
        >
          ⏹ Dừng
        </button>
      ) : (
        <button
          id="sendBtn"
          type="button"
          className="btn-send"
          onClick={onSend}
          disabled={disabled || !input.trim()}
          title="Gửi tin nhắn"
        >
          Gửi
        </button>
      )}
    </footer>
  );
};
