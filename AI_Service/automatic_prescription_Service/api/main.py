import json
import os
import re
import base64
import io
import shutil
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from PIL import Image
import pytesseract
from groq import Groq

# Load .env in automatic_prescription_Service root
ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=ENV_PATH)


GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_TEXT_MODEL = os.getenv("GROQ_TEXT_MODEL", "moonshotai/kimi-k2-instruct-0905")
_env_text_models = [x.strip() for x in os.getenv("GROQ_TEXT_MODELS", "").split(",") if x.strip()]
# Always prioritize GROQ_TEXT_MODEL first, then optional GROQ_TEXT_MODELS list.
DEFAULT_TEXT_MODELS = [DEFAULT_TEXT_MODEL] + _env_text_models
GOOGLE_VISION_API_KEY = os.getenv("GOOGLE_VISION_API_KEY", "").strip()
OCR_ENGINE = os.getenv("OCR_ENGINE", "auto").strip().lower()
TESSERACT_CMD = os.getenv("TESSERACT_CMD", "").strip()

app = FastAPI(title="Automatic Prescription Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExtractRequest(BaseModel):
    image_base64: str
    mime_type: str | None = "image/jpeg"


def _clamp_confidence(value) -> float:
    try:
        n = float(value)
    except Exception:
        return 0.0
    if n < 0:
        return 0.0
    if n > 1:
        return 1.0
    return round(n, 2)


def _clean_text(value):
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value).strip())
    text = re.sub(r"^[\-\.,;:]+|[\-\.,;:]+$", "", text).strip()
    return text or None


def _normalize_dosage(value):
    text = _clean_text(value)
    if not text:
        return None
    text = re.sub(r"(\d)(mg|g|mcg|ml|iu|IU|viên|goi|gói|giot|giọt)\b", r"\1 \2", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def _build_fail_response(message: str):
    return {
        "status": "fail",
        "message": message,
        "medicines": [],
        "summary": {
            "total_detected": 0,
            "high_confidence_count": 0,
        },
    }


def _extract_json_from_text(raw: str):
    text = (raw or "").strip()
    if not text:
        return None

    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, flags=re.IGNORECASE)
    candidate = (fenced.group(1).strip() if fenced else text).strip()
    start = candidate.find("{")
    end = candidate.rfind("}")
    json_text = candidate[start : end + 1] if start >= 0 and end > start else candidate
    try:
        return json.loads(json_text)
    except Exception:
        return None


def _content_to_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                txt = item.get("text")
                if isinstance(txt, str) and txt.strip():
                    parts.append(txt)
            elif isinstance(item, str) and item.strip():
                parts.append(item)
        return "\n".join(parts).strip()
    if content is None:
        return ""
    return str(content)


def _normalize_output(items):
    rows = []
    for idx, item in enumerate(items or []):
        ten_thuoc = _clean_text((item or {}).get("ten_thuoc"))
        lieu_luong = _normalize_dosage((item or {}).get("lieu_luong"))
        ghi_chu = _clean_text((item or {}).get("ghi_chu"))
        confidence = _clamp_confidence((item or {}).get("confidence"))
        missing_critical = (ten_thuoc is None) or (lieu_luong is None)
        needs_review = missing_critical or confidence < 0.85
        note_item = _clean_text((item or {}).get("note_item")) or (
            "Thiếu trường bắt buộc hoặc đọc chưa rõ." if missing_critical else "Đọc được từ ảnh."
        )

        rows.append(
            {
                "id": f"med_{idx + 1}",
                "ten_thuoc": ten_thuoc,
                "lieu_luong": lieu_luong,
                "ghi_chu": ghi_chu,
                "confidence": confidence,
                "needs_review": needs_review,
                "note_item": note_item,
            }
        )

    high_conf_count = len([x for x in rows if (not x["needs_review"]) and x["confidence"] >= 0.85])
    if not rows:
        status = "fail"
        message = "Không đọc được tên thuốc trong ảnh hoặc ảnh quá mờ."
    elif any(x["needs_review"] for x in rows):
        status = "partial"
        message = "Đã trích xuất một phần, cần người dùng kiểm tra lại các dòng chưa chắc chắn."
    else:
        status = "ok"
        message = "Đã trích xuất đầy đủ danh sách thuốc."

    return {
        "status": status,
        "message": message,
        "medicines": rows,
        "summary": {
            "total_detected": len(rows),
            "high_confidence_count": high_conf_count,
        },
    }


def _build_prompt(ocr_text: str) -> str:
    return """
Bạn là AI chuyên trích xuất thông tin thuốc từ văn bản OCR của ảnh toa thuốc/nhãn thuốc.

Đầu vào là OCR text có thể nhiễu ký tự, xuống dòng sai, thiếu dấu.
Nhiệm vụ: chỉ dùng nội dung có trong OCR text để trích xuất thuốc.

Yêu cầu:
1) Nhận diện tất cả thuốc có thể đọc được trong ảnh.
2) Với mỗi thuốc, trích xuất:
   - ten_thuoc
   - lieu_luong
   - ghi_chu (nếu có, ví dụ: "uống sau ăn", "ngày 2 lần")
3) Chuẩn hóa dữ liệu:
   - ten_thuoc: viết rõ ràng, bỏ ký tự thừa, giữ tên đọc được chắc chắn nhất.
   - lieu_luong: chuẩn hóa đơn vị (mg, g, mcg, ml, IU, viên, gói, giọt...).
   - Nếu gặp dạng "500mg" thì đổi thành "500 mg".
4) Nếu trường nào không chắc chắn, đặt null và ghi lý do ngắn trong note_item.
5) Không tự bịa thông tin. Chỉ dùng thông tin nhìn thấy trong ảnh.
6) Chỉ trả về JSON hợp lệ 100%, KHÔNG thêm giải thích ngoài JSON.

OCR TEXT:
-----
""" + ocr_text + """
-----

Schema bắt buộc:
{
  "status": "ok | partial | fail",
  "message": "string",
  "medicines": [
    {
      "id": "string",
      "ten_thuoc": "string | null",
      "lieu_luong": "string | null",
      "ghi_chu": "string | null",
      "confidence": 0.0,
      "needs_review": true,
      "note_item": "string"
    }
  ],
  "summary": {
    "total_detected": 0,
    "high_confidence_count": 0
  }
}
""".strip()


def _dedupe_keep_order(items):
    seen = set()
    out = []
    for x in items:
        if x in seen:
            continue
        seen.add(x)
        out.append(x)
    return out


def _fetch_available_models(api_key: str):
    req = UrlRequest(
        "https://api.groq.com/openai/v1/models",
        headers={"Authorization": f"Bearer {api_key}"},
        method="GET",
    )
    with urlopen(req, timeout=15) as resp:
        body = json.loads((resp.read() or b"{}").decode("utf-8"))
        rows = body.get("data") if isinstance(body, dict) else []
        if not isinstance(rows, list):
            return []
        out = []
        for row in rows:
            if isinstance(row, dict):
                mid = row.get("id")
                if isinstance(mid, str) and mid.strip():
                    out.append(mid.strip())
        return out


def _looks_like_text_chat_model(model_id: str) -> bool:
    m = (model_id or "").lower()
    # Exclude common non-chat / non-text generation models.
    excluded = (
        "whisper",
        "vision",
        "tts",
        "transcribe",
        "speech",
        "audio",
        "embedding",
        "moderation",
    )
    return not any(x in m for x in excluded)


def _resolve_text_model_candidates(api_key: str):
    configured = _dedupe_keep_order(DEFAULT_TEXT_MODELS)
    try:
        available = _fetch_available_models(api_key)
    except Exception:
        available = []
    available_text = [m for m in available if _looks_like_text_chat_model(m)]
    # Keep user-config first for override, then auto-discovered candidates.
    return _dedupe_keep_order(configured + available_text)


def _ocr_with_google_vision(image_base64: str):
    if not GOOGLE_VISION_API_KEY:
        return None, "Thiếu GOOGLE_VISION_API_KEY."
    url = f"https://vision.googleapis.com/v1/images:annotate?key={GOOGLE_VISION_API_KEY}"
    payload = {
        "requests": [
            {
                "image": {"content": image_base64},
                "features": [{"type": "TEXT_DETECTION"}],
            }
        ]
    }
    req = UrlRequest(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=30) as resp:
            body = json.loads((resp.read() or b"{}").decode("utf-8"))
            responses = body.get("responses") if isinstance(body, dict) else []
            if not isinstance(responses, list) or not responses:
                return None, "Google Vision không trả dữ liệu OCR."
            ann = responses[0].get("fullTextAnnotation") or {}
            text = ann.get("text") if isinstance(ann, dict) else None
            text = (text or "").strip()
            if not text:
                return None, "Google Vision không đọc được chữ."
            return text, None
    except Exception as e:
        return None, f"Lỗi Google Vision OCR: {str(e)}"


def _ocr_with_tesseract(image_bytes: bytes):
    try:
        # Prefer explicit command from env; fallback to common Windows install path.
        if TESSERACT_CMD:
            pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
        elif not shutil.which("tesseract"):
            win_default = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
            if os.path.exists(win_default):
                pytesseract.pytesseract.tesseract_cmd = win_default
        image = Image.open(io.BytesIO(image_bytes))
        text = pytesseract.image_to_string(image, lang=os.getenv("TESSERACT_LANG", "eng+vie"))
        text = (text or "").strip()
        if not text:
            return None, "Tesseract không đọc được chữ."
        return text, None
    except Exception as e:
        return None, f"Lỗi Tesseract OCR: {str(e)}"


def _run_ocr(image_base64: str, image_bytes: bytes):
    engine = OCR_ENGINE
    errors = []

    if engine in ("auto", "google"):
        txt, err = _ocr_with_google_vision(image_base64)
        if txt:
            return txt, "google", None
        if err:
            errors.append(err)
        if engine == "google":
            return None, "google", "; ".join(errors)

    if engine in ("auto", "tesseract"):
        txt, err = _ocr_with_tesseract(image_bytes)
        if txt:
            return txt, "tesseract", None
        if err:
            errors.append(err)

    return None, "none", "; ".join(errors) if errors else "OCR không khả dụng."


def _call_groq_text(ocr_text: str):
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return _build_fail_response("Thiếu GROQ_API_KEY trong automatic_prescription_Service.")

    attempted = []
    model_candidates = _resolve_text_model_candidates(api_key)
    model_candidates = _dedupe_keep_order(
        model_candidates
        + [
            "moonshotai/kimi-k2-instruct-0905",
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
        ]
    )
    if not model_candidates:
        return _build_fail_response(
            "Chưa cấu hình GROQ_TEXT_MODEL/GROQ_TEXT_MODELS cho bước chuẩn hóa OCR."
        )

    client = Groq(api_key=api_key)
    for model_name in model_candidates:
        try:
            completion = client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": _build_prompt(ocr_text)}],
                temperature=0.1,
                max_tokens=1400,
            )
            raw_content = (completion.choices[0].message.content or "").strip()
            content = _content_to_text(raw_content)
            parsed = _extract_json_from_text(content)
            if not isinstance(parsed, dict):
                preview = (content or "").strip().replace("\n", " ")
                if len(preview) > 220:
                    preview = preview[:220] + "..."
                return _build_fail_response(
                    f"Không phân tích được JSON từ kết quả AI (model {model_name}). Raw: {preview or '(trống)'}"
                )
            return _normalize_output(parsed.get("medicines"))
        except Exception as e:
            err_text = str(e).strip()
            attempted.append(f"{model_name}: {err_text}")
            lower = err_text.lower()
            if "403" in lower or "404" in lower or "429" in lower or "model" in lower:
                continue
            if "401" in lower or "api key" in lower:
                return _build_fail_response(f"GROQ_API_KEY không hợp lệ hoặc đã hết hạn. {err_text}")
            return _build_fail_response(f"Lỗi khi gọi Groq: {err_text}")

    attempted_text = " | ".join(attempted) if attempted else "Không có model nào được thử."
    return _build_fail_response(
        "Groq từ chối model text hoặc hết quota/rate limit. "
        "Kiểm tra GROQ_API_KEY và quyền dùng text model. "
        f"Chi tiết: {attempted_text}"
    )


@app.post("/extract-medicines")
def extract_medicines(body: ExtractRequest):
    image_base64 = (body.image_base64 or "").strip()
    if not image_base64:
        raise HTTPException(status_code=400, detail="image_base64 là bắt buộc.")

    try:
        image_bytes = base64.b64decode(image_base64, validate=False)
    except Exception:
        return _build_fail_response("image_base64 không hợp lệ.")

    ocr_text, used_engine, ocr_err = _run_ocr(image_base64=image_base64, image_bytes=image_bytes)
    if not ocr_text:
        return _build_fail_response(
            f"Không OCR được nội dung chữ từ ảnh. engine={used_engine}. {ocr_err or ''}".strip()
        )

    result = _call_groq_text(ocr_text=ocr_text)
    if isinstance(result, dict) and result.get("status") in ("ok", "partial"):
        result["message"] = f"{result.get('message', '')} (OCR: {used_engine})".strip()
    # Always return schema JSON so upstream backend can relay exact reason to UI.
    return result


@app.get("/health")
def health():
    return {"status": "ok"}
