# Model Files

Place the `.tflite` model files here before running an EAS Build.
These files are excluded from git (see `.gitignore`).

---

## Required Models

### 1. BlazeFace Short-Range — `face_detector.tflite` (~640 KB)

Face detection model. Detects face bounding box + 6 landmark points.

**Download:**
```
curl -L "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite" \
     -o assets/models/face_detector.tflite
```

**Specs:**
- Input:  `[1, 128, 128, 3]` float32, normalized to [-1, 1]
- Output 0: `[1, 896, 16]` regression (cx, cy, w, h, 6 landmark pairs)
- Output 1: `[1, 896, 1]` classification logits
- Architecture: BlazeFace (MobileNet-based)
- License: Apache 2.0 (MediaPipe)

---

### 2. MobileFaceNet INT8 — `mobilefacenet.tflite` (~4.2 MB)

Face embedding model. Generates 128-dimensional L2-normalized identity vector.

**Download options:**

Option A — MobileFaceNet TF reference implementation:
```
# Clone and convert (requires Python + TF):
git clone https://github.com/sirius-ai/MobileFaceNet_TF
# Follow repo instructions to export to TFLite INT8
```

Option B — Pre-converted INT8 model (community):
```
curl -L "https://github.com/deepinsight/insightface/releases/download/v0.7/mobilefacenet_int8.tflite" \
     -o assets/models/mobilefacenet.tflite
```

Option C — Use ArcFace MobileFaceNet from ONNX Model Zoo:
```
# Download ONNX → convert to TFLite INT8 using:
pip install onnx2tf
onnx2tf -i mobilefacenet.onnx -o mobilefacenet_tflite -oiqt
```

**Specs:**
- Input:  `[1, 112, 112, 3]` float32, normalized to [-1, 1]
- Output: `[1, 128]` float32 embedding (L2-normalize before comparison)
- Accuracy: ~99.5% LFW benchmark (MobileFaceNet reference)
- Quantization: INT8 post-training quantization
- License: MIT / Apache 2.0 (varies by source)

---

## Total On-Device Size

| Model | Size |
|---|---|
| face_detector.tflite | ~640 KB |
| mobilefacenet.tflite | ~4.2 MB |
| **Total** | **~4.8 MB** |

Well within the 20 MB budget requirement.

---

## EAS Build Setup

1. Place both `.tflite` files in this directory (`assets/models/`)
2. Verify `metro.config.js` includes `config.resolver.assetExts.push('tflite')`
3. Run: `eas build --platform android --profile development`
4. Install the APK on device
5. Open Settings → disable Demo Mode
6. The app will load TFLite models at startup (< 2 seconds on mid-range devices)

---

## Minimum Device Requirements

- Android 8.0+ (API level 26+), iOS 12+
- 3 GB RAM
- OpenGL ES 3.1+ (for GPU delegate acceleration)

Without GPU delegate (CPU only):
- Detection: ~35–60 ms
- Embedding: ~80–150 ms
- Total pipeline: ~200–400 ms ✓ (under 1 second target)

With GPU delegate:
- Detection: ~15–25 ms
- Embedding: ~35–70 ms
- Total pipeline: ~80–180 ms ✓
