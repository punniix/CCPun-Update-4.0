import json
import os
import sys
from pathlib import Path
from PIL import Image
from paddleocr import PaddleOCR

MODEL_ROOT = Path.home() / ".paddlex" / "official_models"

def side_for_box(box, width):
    if not box or len(box) < 4 or width <= 0:
        return "unknown"
    try:
        x1, _, x2, _ = [float(v) for v in box[:4]]
    except Exception:
        return "unknown"
    center = (x1 + x2) / 2.0
    ratio = center / float(width)
    if ratio < 0.45:
        return "left"
    if ratio > 0.55:
        return "right"
    return "center"

def main():
    if len(sys.argv) != 2:
        raise RuntimeError("image path required")

    image_path = sys.argv[1]
    min_score = float(os.environ.get("OCR_MIN_SCORE", "0.35"))

    with Image.open(image_path) as image:
        width, _ = image.size

    ocr = PaddleOCR(
        lang="th",
        ocr_version="PP-OCRv5",
        text_detection_model_name="PP-OCRv5_mobile_det",
        text_recognition_model_name="th_PP-OCRv5_mobile_rec",
        text_detection_model_dir=str(MODEL_ROOT / "PP-OCRv5_mobile_det"),
        text_recognition_model_dir=str(MODEL_ROOT / "th_PP-OCRv5_mobile_rec"),
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        device="cpu",
    )

    output = []
    for result in ocr.predict(image_path):
        payload = result.json
        data = payload.get("res", payload)
        texts = list(data.get("rec_texts") or [])
        scores = list(data.get("rec_scores") or [])
        boxes = data.get("rec_boxes")
        boxes = boxes.tolist() if hasattr(boxes, "tolist") else list(boxes or [])

        for index, text in enumerate(texts):
            value = str(text or "").strip()
            score = float(scores[index]) if index < len(scores) else 0.0
            if not value or score < min_score:
                continue
            box = boxes[index] if index < len(boxes) else None
            output.append({
                "index": len(output),
                "text": value[:2000],
                "confidence": round(score, 6),
                "side": side_for_box(box, width),
                "box": [int(v) for v in box[:4]] if box is not None and len(box) >= 4 else None,
            })

    mean_confidence = (
        sum(item["confidence"] for item in output) / len(output)
        if output else 0.0
    )

    print(json.dumps({
        "model": "PP-OCRv5/th-mobile",
        "lines": output[:1000],
        "text": "\n".join(item["text"] for item in output[:1000])[:50000],
        "meanConfidence": round(mean_confidence, 6),
        "lowConfidenceLineCount": sum(1 for item in output if item["confidence"] < 0.65),
        "reviewRequired": True,
    }, ensure_ascii=False))

if __name__ == "__main__":
    main()
