import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StatusBar, TouchableOpacity } from 'react-native';
import { CameraView } from 'expo-camera';
import { Skia, AlphaType, ColorType } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { OnboardingStackParamList, CaptureAngle, EnrolledFace, CaptureAngledResult } from '@/types';
import { useCamera, HAS_VISION_CAMERA } from '@/hooks/useCamera';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { useHaptics } from '@/hooks/useHaptics';
import { FaceBoundingBox } from '@/components/camera/FaceBoundingBox';
import { QualityHUD } from '@/components/camera/QualityHUD';
import { generateEmbedding as generateEmbeddingLib } from '@/lib/ml/faceEmbedding';
import { encryptFacePayload } from '@/lib/crypto/faceEncryption';
import { useEnrollmentStore } from '@/store/enrollmentStore';
import { COLORS, BORDER_RADIUS, QUALITY } from '@/lib/constants';

interface Props {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Enrollment'>;
}

const ANGLES: CaptureAngle[] = ['front', 'left_30', 'right_30', 'up_tilt'];

const ANGLE_META: Record<CaptureAngle, { label: string; instruction: string; icon: string }> = {
  front: { label: 'Front', instruction: 'Look directly at the camera', icon: '😐' },
  left_30: { label: 'Left 30°', instruction: 'Turn head slightly to the left', icon: '↖' },
  right_30: { label: 'Right 30°', instruction: 'Turn head slightly to the right', icon: '↗' },
  up_tilt: { label: 'Chin Up', instruction: 'Tilt head slightly upward', icon: '↑' },
};

export function EnrollmentScreen({ navigation }: Props) {
  const cameraState = useCamera();
  const { faceVisible, detectedFace, hasPermission, requestPermission, frameProcessor } = cameraState;
  const vcDevice = HAS_VISION_CAMERA ? (cameraState as { device: unknown }).device : null;
  const startEnrollmentSession = useEnrollmentStore((s) => s.startEnrollmentSession);
  const addCapturedAngle = useEnrollmentStore((s) => s.addCapturedAngle);
  const completeEnrollment = useEnrollmentStore((s) => s.completeEnrollment);
  const currentSession = useEnrollmentStore((s) => s.currentSession);
  const voice = useVoiceGuidance();
  const haptics = useHaptics();

  const [currentAngleIndex, setCurrentAngleIndex] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedCount, setCapturedCount] = useState(0);

  const captureScale = useSharedValue(1);
  const ringProgress = useSharedValue(0);

  const currentAngle = ANGLES[currentAngleIndex] ?? 'front';
  const meta = ANGLE_META[currentAngle];
  const qualityOk = detectedFace && detectedFace.quality.overall >= QUALITY.MIN_ENROLLMENT;

  useEffect(() => {
    startEnrollmentSession();
    voice.speak('enrollStart');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ringProgress !== undefined) {
      ringProgress.value = withTiming(isCapturing ? 1 : 0, { duration: 200 });
    }
  }, [isCapturing, ringProgress]);

  // Camera ref for Vision Camera takePhoto
  const vcCameraRef = React.useRef<{ takePhoto: () => Promise<{ path: string }> } | null>(null);

  const captureFrame = useCallback(async () => {
    if (!detectedFace || !qualityOk || isCapturing) return;

    setIsCapturing(true);
    haptics.heavy();

    captureScale.value = withSequence(
      withSpring(0.92, { damping: 15 }),
      withSpring(1.0, { damping: 18 })
    );

    try {
      // Take a real photo using Vision Camera and decode pixels with Skia
      let realBuffer = new Uint8Array(0);
      let photoW = 0; let photoH = 0;
      try {
        if (vcCameraRef.current) {
          const photo = await vcCameraRef.current.takePhoto();
          const photoPath = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
          const base64 = await FileSystem.readAsStringAsync(photoPath, { encoding: FileSystem.EncodingType.Base64 });
          const skiaData = Skia.Data.fromBase64(base64);
          const skiaImg = Skia.Image.MakeImageFromEncoded(skiaData);
          if (skiaImg) {
            photoW = skiaImg.width(); photoH = skiaImg.height();
            const pixels = skiaImg.readPixels(0, 0, {
              width: photoW, height: photoH,
              colorType: ColorType.RGBA_8888,
              alphaType: AlphaType.Premul,
            });
            if (pixels) {
              // Copy into a plain ArrayBuffer — Skia returns native-backed buffer
              realBuffer = new Uint8Array(pixels.length);
              realBuffer.set(pixels instanceof Uint8Array ? pixels : new Uint8Array(pixels.buffer as ArrayBuffer));
            }
          }
          console.log(`[Enroll] Real capture: ${realBuffer.length} bytes (${photoW}x${photoH})`);
        }
      } catch (e) {
        console.log('[Enroll] Photo capture failed, using fallback:', e);
      }
      // Use direct service for real embeddings (with correct dimensions)
      // Falls back to stub if model not loaded or buffer empty
      const embedSvc = realBuffer.length > 0
        ? (() => { try { return require('@/services/faceRecognition/embeddingService') as { generateEmbedding: (b: Uint8Array, f: import('@/types').DetectedFace, w: number, h: number) => import('@/types').FaceEmbedding }; } catch { return null; } })()
        : null;
      const embedding = embedSvc && photoW > 0
        ? embedSvc.generateEmbedding(realBuffer, detectedFace, photoW, photoH)
        : generateEmbeddingLib(realBuffer, detectedFace);

      const result: CaptureAngledResult = {
        angle: currentAngle,
        embedding,
        quality: detectedFace.quality,
        capturedAt: Date.now(),
      };

      addCapturedAngle(result);
      voice.speak('captureAccepted');

      const nextCount = capturedCount + 1;
      setCapturedCount(nextCount);

      if (nextCount >= ANGLES.length) {
        await finalizeEnrollment([...currentSession.capturedAngles, result]);
      } else {
        setCurrentAngleIndex(nextCount);
      }
    } finally {
      setIsCapturing(false);
    }
  }, [detectedFace, qualityOk, isCapturing, currentAngle, capturedCount, addCapturedAngle, currentSession, haptics, voice, captureScale]);

  const finalizeEnrollment = async (results: CaptureAngledResult[]) => {
    const face: EnrolledFace = {
      id: `face_${Date.now()}`,
      label: 'Primary User',
      embeddings: results.map((r) => r.embedding),
      enrollmentAngles: results.map((r) => r.angle),
      enrolledAt: Date.now(),
    };

    try {
      const encrypted = await encryptFacePayload(face);
      face.encryptedPayload = encrypted;
    } catch {
      // Encryption optional — still enroll
    }

    completeEnrollment(face);
    haptics.success();
    navigation.replace('EnrollmentSuccess', { enrollmentId: face.id });
  };

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: captureScale.value }],
    borderColor: qualityOk
      ? `rgba(0, 229, 255, ${0.4 + ringProgress.value * 0.5})`
      : 'rgba(255,255,255,0.15)',
  }));

  if (!hasPermission) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.navy900, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }}>
        <Text style={{ color: COLORS.white, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
          Camera permission needed
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.50)', fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
          Aegis needs camera access to capture your face for enrollment.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={{ backgroundColor: COLORS.cyanAegis, borderRadius: BORDER_RADIUS.md, paddingHorizontal: 32, paddingVertical: 14 }}
        >
          <Text style={{ color: COLORS.navy900, fontWeight: '800', fontSize: 15 }}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.navy950 }}>
      <StatusBar barStyle="light-content" hidden />

      {/* Full-bleed camera preview — Vision Camera (real ML) or expo-camera (Expo Go) */}
      {HAS_VISION_CAMERA && vcDevice ? (
        (() => {
          const { Camera } = require('react-native-vision-camera') as { Camera: React.ComponentType<Record<string, unknown>> };
          return (
            <Camera
              ref={vcCameraRef as never}
              device={vcDevice as never}
              isActive
              pixelFormat="rgb"
              photo={true}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              frameProcessor={frameProcessor as never}
            />
          );
        })()
      ) : (
        <CameraView
          facing="front"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}

      {/* Dark vignette overlay */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(5, 12, 26, 0.45)',
      }} />

      {/* Face bounding box overlay */}
      <FaceBoundingBox
        boundingBox={detectedFace?.boundingBox ?? null}
        state={faceVisible ? 'detected' : 'searching'}
      />

      {/* Quality HUD */}
      <QualityHUD quality={detectedFace?.quality ?? null} visible={faceVisible} />

      {/* Top instruction bar */}
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <View style={{ alignItems: 'center', paddingTop: 16, gap: 6 }}>
          <Text style={{ color: COLORS.cyanAegis, fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>
            Face Sculpting  {currentAngleIndex + 1}/{ANGLES.length}
          </Text>
          <Text style={{ color: COLORS.white, fontSize: 20, fontWeight: '800', letterSpacing: 0.5 }}>
            {meta.instruction}
          </Text>
        </View>
      </SafeAreaView>

      {/* Angle progress strip */}
      <View style={{
        position: 'absolute', bottom: 160, left: 24, right: 24,
        flexDirection: 'row', gap: 8,
      }}>
        {ANGLES.map((angle, i) => (
          <View
            key={angle}
            style={{
              flex: 1, height: 4, borderRadius: 2,
              backgroundColor: i < capturedCount
                ? COLORS.success
                : i === currentAngleIndex
                ? COLORS.cyanAegis
                : 'rgba(255,255,255,0.15)',
            }}
          />
        ))}
      </View>

      {/* Capture button */}
      <View style={{ position: 'absolute', bottom: 56, alignSelf: 'center' }}>
        <TouchableOpacity onPress={captureFrame} disabled={!qualityOk || isCapturing}>
          <Animated.View style={[{
            width: 88, height: 88, borderRadius: 44,
            borderWidth: 3,
            backgroundColor: qualityOk ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.06)',
            alignItems: 'center', justifyContent: 'center',
          }, ringStyle]}>
            <View style={{
              width: 62, height: 62, borderRadius: 31,
              backgroundColor: qualityOk ? COLORS.cyanAegis : 'rgba(255,255,255,0.15)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 26 }}>{meta.icon}</Text>
            </View>
          </Animated.View>
        </TouchableOpacity>

        <Text style={{
          color: qualityOk ? COLORS.cyanAegis : 'rgba(255,255,255,0.30)',
          fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 10, letterSpacing: 0.5,
        }}>
          {isCapturing ? 'Capturing…' : qualityOk ? 'Tap to Capture' : 'Align your face'}
        </Text>
      </View>
    </View>
  );
}
