import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EnrolledFace, CaptureAngledResult, CaptureAngle } from '@/types';

interface EnrollmentState {
  // Persisted data
  enrolledFaces: EnrolledFace[];
  isEnrolled: boolean;
  primaryFaceId: string | null;

  // Ephemeral enrollment session state
  currentSession: {
    capturedAngles: CaptureAngledResult[];
    currentAngle: CaptureAngle;
    isCapturing: boolean;
    sessionId: string | null;
  };

  // Actions
  startEnrollmentSession: () => void;
  addCapturedAngle: (result: CaptureAngledResult) => void;
  setCurrentAngle: (angle: CaptureAngle) => void;
  completeEnrollment: (face: EnrolledFace) => void;
  clearEnrollmentSession: () => void;
  deleteEnrolledFace: (id: string) => void;
  clearAllEnrollments: () => void;
}

const ENROLLMENT_ANGLES: CaptureAngle[] = ['front', 'left_30', 'right_30', 'up_tilt'];

export const useEnrollmentStore = create<EnrollmentState>()(
  persist(
    (set, get) => ({
      enrolledFaces: [],
      isEnrolled: false,
      primaryFaceId: null,
      currentSession: {
        capturedAngles: [],
        currentAngle: 'front',
        isCapturing: false,
        sessionId: null,
      },

      startEnrollmentSession: () =>
        set({
          currentSession: {
            capturedAngles: [],
            currentAngle: 'front',
            isCapturing: true,
            sessionId: `session_${Date.now()}`,
          },
        }),

      addCapturedAngle: (result) => {
        const { currentSession } = get();
        const updated = [...currentSession.capturedAngles, result];
        const nextAngleIndex = updated.length;
        const nextAngle = ENROLLMENT_ANGLES[nextAngleIndex] ?? 'front';
        set({
          currentSession: {
            ...currentSession,
            capturedAngles: updated,
            currentAngle: nextAngle,
          },
        });
      },

      setCurrentAngle: (angle) =>
        set((state) => ({
          currentSession: { ...state.currentSession, currentAngle: angle },
        })),

      completeEnrollment: (face) =>
        set((state) => ({
          enrolledFaces: [...state.enrolledFaces, face],
          isEnrolled: true,
          primaryFaceId: state.primaryFaceId ?? face.id,
          currentSession: {
            capturedAngles: [],
            currentAngle: 'front',
            isCapturing: false,
            sessionId: null,
          },
        })),

      clearEnrollmentSession: () =>
        set({
          currentSession: {
            capturedAngles: [],
            currentAngle: 'front',
            isCapturing: false,
            sessionId: null,
          },
        }),

      deleteEnrolledFace: (id) =>
        set((state) => {
          const remaining = state.enrolledFaces.filter((f) => f.id !== id);
          return {
            enrolledFaces: remaining,
            isEnrolled: remaining.length > 0,
            primaryFaceId:
              state.primaryFaceId === id
                ? (remaining[0]?.id ?? null)
                : state.primaryFaceId,
          };
        }),

      clearAllEnrollments: () =>
        set({
          enrolledFaces: [],
          isEnrolled: false,
          primaryFaceId: null,
        }),
    }),
    {
      name: 'aegis-enrollment',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        enrolledFaces: state.enrolledFaces,
        isEnrolled: state.isEnrolled,
        primaryFaceId: state.primaryFaceId,
      }),
    }
  )
);
