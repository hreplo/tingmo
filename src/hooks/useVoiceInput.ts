import { useState, useEffect, useCallback } from 'react';

export type VoiceState = 'idle' | 'recording' | 'recognizing' | 'refining' | 'success';

interface VoiceInputState {
  state: VoiceState;
  charCount: number | null;
}

export function useVoiceInput() {
  const [voiceState, setVoiceState] = useState<VoiceInputState>({
    state: 'idle',
    charCount: null,
  });
  const [translateMode, setTranslateMode] = useState(false);

  useEffect(() => {
    const api = window.tingmo;
    if (!api) return;

    const unsub1 = api.onVoiceStateChange((data) => {
      setVoiceState((prev) => ({
        ...prev,
        state: data.state as VoiceState,
      }));
      if (data.state === 'idle') setTranslateMode(false);
    });

    const unsub2 = api.onRecognitionDone((data) => {
      setVoiceState({
        state: 'success',
        charCount: data.charCount,
      });
    });

    const unsub4 = api.onTranslateMode?.((data: { enabled: boolean }) => {
      setTranslateMode(data.enabled);
    });

    return () => {
      unsub1();
      unsub2();
      unsub4?.();
    };
  }, []);

  const finish = useCallback(async () => {
    await window.tingmo?.finishRecording();
  }, []);

  const cancel = useCallback(async () => {
    await window.tingmo?.cancelRecording();
  }, []);

  return {
    state: voiceState.state,
    charCount: voiceState.charCount,
    translateMode,
    finish,
    cancel,
  };
}
