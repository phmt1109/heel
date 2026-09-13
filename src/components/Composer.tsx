import React, { useRef, useEffect, useState } from 'react';
import { VoiceModal } from './VoiceModal';

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
  const [voiceModalOpen, setVoiceModalOpen] = useState<boolean>(false);

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

  const handleSendTranscript = (text: string) => {
    onChangeInput(text);
    setTimeout(() => {
      onSend();
    }, 50);
  };

  const handleAppendToInput = (text: string) => {
    const newVal = input ? `${input.trim()} ${text}` : text;
    onChangeInput(newVal);
  };

  return (
    <>
      <footer id="composer">
        <button
          type="button"
          id="micBtn"
          className="btn-ghost icon-btn"
          style={{
            height: '44px',
            width: '44px',
            borderRadius: '11px',
            fontSize: '19px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: 'var(--bg3)',
            border: '1px solid var(--line)',
            color: 'var(--fg)',
          }}
          onClick={() => setVoiceModalOpen(true)}
          title="Nói bằng giọng nói qua Microphone"
          disabled={isGenerating}
        >
          🎙️
        </button>

        <textarea
          ref={textareaRef}
          id="input"
          rows={1}
          placeholder="Nhập tin nhắn hoặc bấm mic để nói... (Enter để gửi)"
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

      <VoiceModal
        isOpen={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        onSendTranscript={handleSendTranscript}
        onAppendToInput={handleAppendToInput}
      />
    </>
  );
};

