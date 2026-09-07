# NHAI Hackathon 7.0 — Build Guide

Offline facial recognition + liveness detection, embedded in a React Native app for field personnel attendance in zero-network zones.

---

## 1. What to Build

A React Native app that, **fully offline**, can:

1. **Enroll** a person — capture face, generate a numeric "faceprint" (embedding), store it encrypted on-device.
2. **Verify** a person — capture face, compare against stored faceprint, mark attendance if match > 95%.
3. **Liveness check** — confirm it's a real human (not a photo/screen) by asking them to **blink / smile / turn head**.
4. **Sync & purge** — when internet returns, upload attendance records to AWS, then delete local copies.

### App Flow
```
Open app → Detect face → Liveness challenge (blink/smile/turn)
   → Generate embedding → Match against local DB
   → ✅ Attendance marked (stored locally, encrypted)
   → [Later, when online] → Sync to AWS → Purge local data
```

---

## 2. Best Tech Stack

| Layer | Recommended Tool | Why |
|-------|------------------|-----|
| **App framework** | React Native (0.74+) | Required by problem statement; Android + iOS from one codebase |
| **Face detection** | **MediaPipe BlazeFace** (or `react-native-vision-camera` + frame processor) | Tiny (~1 MB), runs on CPU, real-time |
| **Face landmarks (liveness)** | **MediaPipe Face Mesh** | 468 landmarks → detect blink (eye aspect ratio), smile, head pose. No internet. |
| **Face recognition model** | **MobileFaceNet** (ArcFace-trained), quantized | ~4–5 MB int8, >99% on LFW, <1 s on mid-range CPU. Fits the 20 MB budget easily. |
| **On-device inference** | **TensorFlow Lite** via `react-native-fast-tflite` (or ONNX Runtime Mobile) | Open-source, GPU/NNAPI optional, no network |
| **Camera** | `react-native-vision-camera` | High-perf frame processors for real-time inference |
| **Local storage** | **SQLite** (`op-sqlite`) + **MMKV** | Store embeddings (not raw images) + metadata |
| **Encryption** | `react-native-keychain` (key) + AES on the SQLite blob | Protects biometric data at rest |
| **Sync** | AWS S3 + DynamoDB via AWS SDK (only when online) | Matches the AWS sync requirement |

### Why MobileFaceNet
- Quantized int8 → **~4 MB** (well under 20 MB target).
- Outputs a **128/512-d embedding**; matching = cosine similarity, threshold ≈ 0.6–0.7 for >95% accuracy.
- Train/fine-tune on an **Indian-demographic dataset** (e.g. add Indian faces) for the accuracy requirement.

---

## 3. Liveness Detection (offline, no extra model needed)

Use Face Mesh landmarks + simple math — cheap and spoof-resistant:

- **Blink** → Eye Aspect Ratio (EAR) drops then recovers.
- **Smile** → mouth-corner distance increases.
- **Head turn** → yaw angle from nose/eye landmarks crosses a threshold.

Randomize the challenge order each session so a recorded video can't replay it.

---

## 4. How to Use It (field personnel)

1. **One-time enrollment** (online or by admin): stand in good light, capture face → faceprint saved.
2. **Daily attendance** (offline): open app → follow the on-screen prompt ("Blink", "Smile", "Turn left") → green check = marked.
3. Data stays encrypted on the phone until back in coverage, then auto-syncs and clears.

---

## 5. Hitting the Scoring Criteria

| Criterion (Marks) | How we win it |
|---|---|
| Innovation (30) | int8-quantized MobileFaceNet ~4 MB + landmark-based liveness (zero extra model size) |
| Feasibility (30) | Drop-in RN module + TFLite; <1 s on 3 GB RAM devices via CPU/NNAPI |
| Scalability (20) | Embeddings-only storage + reliable online→AWS sync→local purge |
| Documentation (20) | This guide + architecture diagram + benchmark table (size, latency, accuracy) |

---

## 6. Minimal Build Steps

```bash
npx react-native init DatalakeFace --template react-native-template-typescript
npm i react-native-vision-camera react-native-fast-tflite \
      op-sqlite react-native-mmkv react-native-keychain
# drop mobilefacenet_int8.tflite (~4MB) into android/ios assets
```

Then: camera → detect face → run liveness → run TFLite embedding → cosine-match → store/sync.

> **Keep it small, fast, offline.** Everything above is open-source with no paid licenses.
