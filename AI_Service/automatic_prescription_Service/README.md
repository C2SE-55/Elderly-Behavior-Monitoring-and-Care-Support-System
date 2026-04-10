# Automatic Prescription Service

Service AI trich xuat thong tin thuoc tu anh toa/nhan/vi thuoc, tra ve JSON de UI render va cho phep sua tung dong.

## Run local

1. Tao virtual env va cai dependencies:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

2. Kiem tra `.env`:
- `GROQ_API_KEY`: bat buoc (dung cho buoc chuan hoa OCR bang LLM text)
- `OCR_ENGINE`: `auto` (mac dinh) | `google` | `tesseract`
- Neu dung Google Vision OCR: set `GOOGLE_VISION_API_KEY`
- Neu dung Tesseract OCR: cai Tesseract OCR tren may va dam bao `tesseract` co trong PATH
- Co the set truc tiep duong dan exe neu PATH chua nhan:
  - `TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe`
- Ngon ngu OCR Tesseract:
  - `TESSERACT_LANG=eng+vie`
- Model text (khong can vision model): `GROQ_TEXT_MODEL=llama-3.1-8b-instant`

3. Chay service:

```bash
uvicorn api.main:app --host 0.0.0.0 --port 6000 --reload
```

Health check:

```bash
GET http://localhost:6000/health
```

Main endpoint:

```bash
POST http://localhost:6000/extract-medicines
Content-Type: application/json

{
  "image_base64": "<base64-no-prefix>",
  "mime_type": "image/jpeg"
}
```

Response schema:
- status: ok | partial | fail
- message: string
- medicines: [{ id, ten_thuoc, lieu_luong, ghi_chu, confidence, needs_review, note_item }]
- summary: { total_detected, high_confidence_count }

Pipeline hien tai:
- Anh -> OCR (Google Vision hoac Tesseract) -> Groq text model -> JSON chuan hoa
