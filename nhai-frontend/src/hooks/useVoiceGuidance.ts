import * as Speech from 'expo-speech';
import { useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

const GUIDANCE: Record<string, { en: string; hi: string }> = {
  enrollStart: {
    en: 'Welcome to Aegis enrollment. Look directly at the camera.',
    hi: 'एजिस नामांकन में आपका स्वागत है। सीधे कैमरे की तरफ देखें।',
  },
  enrollFront: {
    en: 'Face forward. Keep your face in the frame.',
    hi: 'सीधे देखें। अपना चेहरा फ्रेम में रखें।',
  },
  enrollLeft: {
    en: 'Turn your head slightly to the left.',
    hi: 'अपना सिर थोड़ा बाईं ओर मोड़ें।',
  },
  enrollRight: {
    en: 'Turn your head slightly to the right.',
    hi: 'अपना सिर थोड़ा दाईं ओर मोड़ें।',
  },
  enrollUp: {
    en: 'Tilt your head slightly upward.',
    hi: 'अपना सिर थोड़ा ऊपर की ओर झुकाएं।',
  },
  enrollSuccess: {
    en: 'Enrollment complete. Aegis has learned your face.',
    hi: 'नामांकन पूर्ण। एजिस ने आपका चेहरा पहचान लिया है।',
  },
  captureAccepted: {
    en: 'Captured.',
    hi: 'कैप्चर किया।',
  },
  verifyStart: {
    en: 'Aegis is verifying your identity. Look at the camera.',
    hi: 'एजिस आपकी पहचान सत्यापित कर रहा है। कैमरे की तरफ देखें।',
  },
  verifySuccess: {
    en: 'Identity verified. Welcome.',
    hi: 'पहचान सत्यापित। स्वागत है।',
  },
  verifyFailed: {
    en: 'Verification failed. Please try again.',
    hi: 'सत्यापन विफल। कृपया पुनः प्रयास करें।',
  },
  challengeBlink: {
    en: 'Please blink naturally.',
    hi: 'कृपया स्वाभाविक रूप से पलक झपकाएं।',
  },
  challengeSmile: {
    en: 'Please show a natural smile.',
    hi: 'कृपया स्वाभाविक मुस्कान दिखाएं।',
  },
  challengeLeft: {
    en: 'Turn your head slowly to the left.',
    hi: 'अपना सिर धीरे-धीरे बाईं ओर घुमाएं।',
  },
  challengeRight: {
    en: 'Turn your head slowly to the right.',
    hi: 'अपना सिर धीरे-धीरे दाईं ओर घुमाएं।',
  },
  challengePassed: {
    en: 'Good.',
    hi: 'अच्छा।',
  },
};

export function useVoiceGuidance() {
  const voiceGuidance = useSettingsStore((s) => s.voiceGuidance);
  const language = useSettingsStore((s) => s.language);

  const speak = useCallback(
    (key: string) => {
      if (!voiceGuidance) return;
      const entry = GUIDANCE[key];
      if (!entry) return;

      const text = language === 'hi' ? entry.hi : entry.en;
      const langCode = language === 'hi' ? 'hi-IN' : 'en-IN';

      // Speech.stop() is async — Speech.speak() is void (fire-and-forget)
      Speech.stop().catch(() => null);
      Speech.speak(text, {
        language: langCode,
        pitch: 1.0,
        rate: language === 'hi' ? 0.85 : 0.9,
      });
    },
    [voiceGuidance, language]
  );

  const speakCustom = useCallback(
    (text: string) => {
      if (!voiceGuidance) return;
      const langCode = language === 'hi' ? 'hi-IN' : 'en-IN';
      Speech.stop().catch(() => null);
      Speech.speak(text, { language: langCode, pitch: 1.0, rate: 0.9 });
    },
    [voiceGuidance, language]
  );

  const stop = useCallback(() => {
    Speech.stop().catch(() => null);
  }, []);

  return { speak, speakCustom, stop };
}
