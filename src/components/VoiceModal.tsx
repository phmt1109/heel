import React, { useState, useEffect, useRef } from 'react';
import { isSpeechRecognitionSupported } from '../utils/speech';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendTranscript: (text: string) => void;
  onAppendToInput: (text: string) => void;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  onSendTranscript,
  onAppendToInput,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<string>('vi-VN');

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsRecording(false);
      setTranscript('');
      setInterimTranscript('');
      setErrorMessage(null);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setErrorMessage(
        'Trình duyệt của bạn không hỗ trợ Web Speech API (Hãy dùng Chrome, Edge, hoặc Safari mới nhất trên máy tính hoặc điện thoại).'
      );
      return;
    }

    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectedLang;

    recognition.onstart = () => {
      setIsRecording(true);
      setErrorMessage(null);
    };

    recognition.onresult = (event: any) => {
      let final = '';
      let interim = '';

      for (let i = 0; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          final += item[0].transcript + ' ';
        } else {
          interim += item[0].transcript;
        }
      }

      if (final) {
        setTranscript(final.trim());
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition event error:', event.error);
      if (event.error === 'not-allowed') {
        setErrorMessage('Quyền truy cập Microphone đã bị từ chối. Hãy cho phép quyền micro trên thanh địa chỉ trình duyệt.');
      } else if (event.error === 'no-speech') {
        // No speech detected yet, keep listening
      } else {
        setErrorMessage(`Lỗi micro: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    // Automatically start listening when modal opens
    try {
      recognition.start();
    } catch (e) {
      console.error('Error starting recognition:', e);
    }

    return () => {
      try {
        recognition.stop();
      } catch {}
    };
  }, [isOpen, selectedLang]);

  if (!isOpen) return null;

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsRecording(false);
    } else {
      setErrorMessage(null);
      try {
        recognitionRef.current.lang = selectedLang;
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSendNow = () => {
    const fullText = (transcript + (interimTranscript ? ' ' + interimTranscript : '')).trim();
    if (fullText) {
      onSendTranscript(fullText);
      onClose();
    }
  };

  const handleInsertInput = () => {
    const fullText = (transcript + (interimTranscript ? ' ' + interimTranscript : '')).trim();
    if (fullText) {
      onAppendToInput(fullText);
      onClose();
    }
  };

  const fullText = (transcript + (interimTranscript ? ' ' + interimTranscript : '')).trim();

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 7, 12, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="voice-modal-card"
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--line)',
          borderRadius: '18px',
          width: '100%',
          maxWidth: '480px',
          padding: '24px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '16px' }}>
            <span>🎙️</span>
            <span>Nói để nhập tin nhắn</span>
          </div>
          <button
            type="button"
            className="btn-ghost small"
            onClick={onClose}
            style={{ padding: '4px 8px', borderRadius: '8px' }}
          >
            ✕
          </button>
        </div>

        {/* Pulsing Mic Circle Button */}
        <div style={{ margin: '16px 0 20px' }}>
          <button
            type="button"
            onClick={toggleRecording}
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              background: isRecording
                ? 'linear-gradient(135deg, #ff3366, #ff6b8b)'
                : 'linear-gradient(135deg, var(--accent), #5a3fd6)',
              border: isRecording ? '3px solid #ff99b0' : '3px solid #9f86ff',
              color: '#fff',
              fontSize: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isRecording
                ? '0 0 25px rgba(255, 51, 102, 0.6)'
                : '0 6px 20px rgba(124, 92, 255, 0.35)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              animation: isRecording ? 'pulse-ring 1.5s infinite' : 'none',
            }}
            title={isRecording ? 'Bấm để dừng ghi âm' : 'Bấm để bắt đầu nói'}
          >
            {isRecording ? '⏹' : '🎙️'}
          </button>
        </div>

        <div style={{ fontSize: '13px', color: isRecording ? 'var(--accent2)' : 'var(--muted)', marginBottom: '14px', fontWeight: 500 }}>
          {isRecording ? '● Đang lắng nghe... Hãy nói vào microphone của bạn' : 'Đã tạm dừng. Bấm micro để nói tiếp'}
        </div>

        {/* Live speech preview area */}
        <div
          style={{
            width: '100%',
            minHeight: '90px',
            maxHeight: '160px',
            overflowY: 'auto',
            background: 'var(--bg3)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            padding: '12px 14px',
            textAlign: 'left',
            fontSize: '14px',
            lineHeight: 1.6,
            color: fullText ? 'var(--fg)' : 'var(--muted)',
            marginBottom: '16px',
          }}
        >
          {fullText ? (
            <>
              <span>{transcript}</span>
              {interimTranscript && (
                <span style={{ opacity: 0.6, fontStyle: 'italic' }}> {interimTranscript}</span>
              )}
            </>
          ) : (
            <span>Nội dung bạn nói sẽ hiển thị tự động tại đây...</span>
          )}
        </div>

        {errorMessage && (
          <div
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#3a171d',
              border: '1px solid #7a2b37',
              color: '#ff99a8',
              fontSize: '12px',
              marginBottom: '14px',
              textAlign: 'left',
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Language selector & actions */}
        <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Ngôn ngữ:</span>
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              style={{
                fontSize: '12px',
                padding: '4px 8px',
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                borderRadius: '6px',
                color: 'var(--fg)',
              }}
            >
              <option value="vi-VN">Tiếng Việt (vi-VN)</option>
              <option value="en-US">English (en-US)</option>
              <option value="zh-CN">中文 (zh-CN)</option>
              <option value="ja-JP">日本語 (ja-JP)</option>
              <option value="ko-KR">한국어 (ko-KR)</option>
            </select>
          </label>

          {transcript && (
            <button
              type="button"
              className="btn-ghost small"
              onClick={() => {
                setTranscript('');
                setInterimTranscript('');
              }}
              style={{ fontSize: '11px', padding: '3px 8px' }}
            >
              Xoá chữ
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', width: '100%', gap: '10px' }}>
          <button
            type="button"
            className="btn-ghost"
            style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', fontSize: '13px' }}
            onClick={handleInsertInput}
            disabled={!fullText}
          >
            ✏️ Chèn vào ô nhập
          </button>

          <button
            type="button"
            className="btn-send"
            style={{ flex: 1.4, padding: '10px 16px', borderRadius: '10px', fontSize: '13px', height: '42px' }}
            onClick={handleSendNow}
            disabled={!fullText}
          >
            🚀 Gửi ngay cho AI
          </button>
        </div>
      </div>
    </div>
  );
};
