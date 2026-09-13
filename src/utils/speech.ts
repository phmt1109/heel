/**
 * Web Speech Recognition & Speech Synthesis Utility
 * Provides microphone-based voice input and high-quality text-to-speech reading
 */

// Speech Recognition Type Declarations
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      [index: number]: {
        transcript: string;
        confidence: number;
      };
      isFinal: boolean;
    };
  };
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean('speechSynthesis' in window && window.SpeechSynthesisUtterance);
}

/**
 * Clean up text for natural speech (remove markdown symbols, URLs, and code blocks)
 */
export function cleanTextForSpeech(text: string): string {
  if (!text) return '';
  return text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, ' Đoạn mã code đã được ẩn khi đọc. ')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove images & links
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    // Remove bold/italics
    .replace(/[*_~]{1,3}/g, '')
    // Remove markdown headers
    .replace(/^#+\s+/gm, '')
    // Remove multiple newlines and spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Text-to-Speech manager
 */
let currentSpeakingUtterance: SpeechSynthesisUtterance | null = null;
let currentSpeakingId: string | null = null;
let activeUtteranceListeners: { onStart?: () => void; onEnd?: () => void } = {};

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
    currentSpeakingUtterance = null;
    currentSpeakingId = null;
    if (activeUtteranceListeners.onEnd) {
      activeUtteranceListeners.onEnd();
    }
  }
}

export function getCurrentlySpeakingId(): string | null {
  return currentSpeakingId;
}

export function speakText(
  text: string,
  messageId: string,
  options: {
    rate?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  } = {}
): boolean {
  if (!isSpeechSynthesisSupported()) {
    console.warn('Speech synthesis is not supported on this browser.');
    return false;
  }

  // If already reading this exact message, toggle stop
  if (currentSpeakingId === messageId) {
    stopSpeaking();
    return false;
  }

  // Cancel any ongoing speech
  stopSpeaking();

  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return false;

  try {
    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.rate = options.rate || 1.0;
    utterance.pitch = 1.0;

    // Detect language: if mostly Vietnamese characters, set vi-VN; else default
    const isVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(cleaned);
    utterance.lang = isVietnamese ? 'vi-VN' : 'en-US';

    // Pick a good matching voice if available
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const matchVoice = voices.find((v) =>
        isVietnamese ? v.lang.startsWith('vi') : v.lang.startsWith('en')
      );
      if (matchVoice) {
        utterance.voice = matchVoice;
      }
    }

    currentSpeakingUtterance = utterance;
    currentSpeakingId = messageId;
    activeUtteranceListeners = { onStart: options.onStart, onEnd: options.onEnd };

    utterance.onstart = () => {
      if (options.onStart) options.onStart();
    };

    utterance.onend = () => {
      currentSpeakingUtterance = null;
      currentSpeakingId = null;
      if (options.onEnd) options.onEnd();
    };

    utterance.onerror = (e) => {
      currentSpeakingUtterance = null;
      currentSpeakingId = null;
      if (options.onError) options.onError(e);
      if (options.onEnd) options.onEnd();
    };

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.error('TTS error:', err);
    stopSpeaking();
    return false;
  }
}
