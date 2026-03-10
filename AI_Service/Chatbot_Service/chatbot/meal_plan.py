# meal_plan.py - Kế hoạch thực đơn 7 ngày theo hồ sơ sức khỏe (chuyên gia dinh dưỡng lâm sàng NCT)
import os
import json
import re
from pathlib import Path

import pandas as pd
import pymysql
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# Đường dẫn dataset (so với thư mục Chatbot_Service)
BASE_DIR = Path(__file__).resolve().parent.parent
DATASET_PATH = BASE_DIR / "dataset" / "vietnamese_food_dataset_3000.xlsx"
FCT_PATH = BASE_DIR / "dataset" / "D3_5a_SMILING_FCT_Vietnam_180713_protected.xlsx"

# Cache dataset đã load
_food_df = None


def get_food_dataset():
    """Load dataset món ăn Việt Nam (id, food_name, meal_type, region, calories, protein_g, carbs_g, fat_g)."""
    global _food_df
    if _food_df is None and DATASET_PATH.exists():
        _food_df = pd.read_excel(DATASET_PATH)
        # Chuẩn hóa tên cột: vietnamese_food_dataset_3000.xlsx có food_name, meal_type, calories, protein_g, carbs_g, fat_g
        _food_df.columns = [
            str(c).strip().lower().replace(" ", "_") if isinstance(c, str) else c for c in _food_df.columns
        ]
    return _food_df


def get_food_context_for_prompt():
    """
    Tạo đoạn văn bản tham khảo cho prompt: gợi ý món theo meal_type với calories, protein, carbs, fat
    từ dataset vietnamese_food_dataset_3000.xlsx để LLM ưu tiên món có sẵn và số liệu chuẩn.
    """
    df = get_food_dataset()
    if df is None or df.empty:
        return "Ưu tiên món ăn phổ biến Việt Nam: phở, bún, cơm, canh, rau luộc, cá kho, thịt nạc, trứng, cháo."
    col_name = "food_name" if "food_name" in df.columns else df.columns[1] if len(df.columns) > 1 else None
    if col_name is None:
        return "Ưu tiên món ăn phổ biến Việt Nam, khẩu phần người cao tuổi."
    df = df.dropna(subset=[col_name])
    parts = []
    meal_col = "meal_type" if "meal_type" in df.columns else None
    for _, r in df.head(120).iterrows():
        name = r.get(col_name, r.get("food_name", ""))
        if pd.isna(name) or not str(name).strip():
            continue
        cal = r.get("calories", 0)
        p = r.get("protein_g", 0)
        c = r.get("carbs_g", 0)
        f = r.get("fat_g", 0)
        cal = int(cal) if not pd.isna(cal) else 0
        p = int(p) if not pd.isna(p) else 0
        c = int(c) if not pd.isna(c) else 0
        f = int(f) if not pd.isna(f) else 0
        parts.append(f"{name} (calories:{cal}, protein:{p}g, carbs:{c}g, fat:{f}g)")
    if not parts:
        return "Ưu tiên món Việt Nam: phở, bún, cơm, canh, cá kho, rau luộc; khẩu phần ít muối, ít dầu."
    return "Gợi ý món (tên, calories, protein_g, carbs_g, fat_g): " + "; ".join(parts[:100])


def get_health_profile_by_user_id(user_id: int):
    """
    Lấy hồ sơ sức khỏe từ bảng health_profiles theo user_id.
    Trả về dict: elderly_name, age, weight, height, blood_type, blood_pressure, chronic_diseases, allergies.
    """
    conn = None
    try:
        conn = pymysql.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "3306")),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "data_ecms"),
            charset="utf8mb4",
        )
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute(
                """SELECT elderly_name, age, weight, height, blood_type, blood_pressure, chronic_diseases, allergies
                   FROM health_profiles WHERE user_id = %s LIMIT 1""",
                (user_id,),
            )
            row = cur.fetchone()
        return row if row else None
    finally:
        if conn:
            conn.close()


def build_meal_plan_prompt(profile: dict) -> str:
    """Xây dựng prompt cho chuyên gia dinh dưỡng lâm sàng NCT."""
    elderly_name = (profile.get("elderly_name") or "Người cao tuổi").strip() or "Người cao tuổi"
    age = profile.get("age") or ""
    weight = profile.get("weight") or ""
    height = profile.get("height") or ""
    blood_type = (profile.get("blood_type") or "").strip()
    blood_pressure = (profile.get("blood_pressure") or "").strip()
    chronic_diseases = (profile.get("chronic_diseases") or "").strip()
    allergies = (profile.get("allergies") or "").strip()

    food_context = get_food_context_for_prompt()

    allergy_block = (
        "Không ghi nhận dị ứng thực phẩm cụ thể. Tuy nhiên vẫn cần tránh món khó tiêu, nhiều dầu mỡ."
        if not allergies
        else (
            "ĐÂY LÀ YÊU CẦU AN TOÀN BẮT BUỘC:\n"
            f"- Người dùng bị dị ứng với: {allergies}.\n"
            "- KHÔNG ĐƯỢC đề xuất bất kỳ món ăn, nguyên liệu, nước chấm, nước dùng, hay sản phẩm chế biến nào "
            "có chứa các dị nguyên trên (kể cả dưới dạng khô, bột, nước mắm, nước dùng, chả, giò...).\n"
            "- Nếu không chắc một món có chứa dị nguyên hay không thì BỎ MÓN ĐÓ và chọn món khác an toàn hơn.\n"
            "- Trong trường 'warnings' phải ghi rõ rằng thực đơn đã loại trừ hoàn toàn các dị nguyên đã nêu."
        )
    )

    return f"""BẠN LÀ CHUYÊN GIA DINH DƯỠNG LÂM SÀNG CHO NGƯỜI CAO TUỔI.

NHIỆM VỤ: Tạo kế hoạch thực đơn 7 ngày cho người dùng dựa trên hồ sơ sức khỏe dưới đây.

THÔNG TIN HỒ SƠ SỨC KHỎE:
- Tên: {elderly_name}
- Tuổi: {age}
- Cân nặng: {weight}
- Chiều cao: {height}
- Nhóm máu: {blood_type}
- Huyết áp: {blood_pressure}
- Bệnh mãn tính: {chronic_diseases}
- Dị ứng: {allergies}

XỬ LÝ DỊ ỨNG (RẤT QUAN TRỌNG):
{allergy_block}

THAM KHẢO MÓN (ưu tiên dùng và lấy số liệu tương tự): {food_context}

YÊU CẦU NGHIÊM NGẶT:
1. Tạo thực đơn cho 7 ngày liên tiếp.
2. Mỗi ngày đủ 3 bữa: breakfast, lunch, dinner.
3. Món ăn phù hợp với tuổi, bệnh mãn tính, huyết áp, VÀ TUYỆT ĐỐI KHÔNG CHỨA bất kỳ dị nguyên nào đã liệt kê ở trên.
4. Ưu tiên món ăn phổ biến tại Việt Nam.
5. Không lặp lại món quá 2 lần trong tuần.
6. Khẩu phần phù hợp người cao tuổi: dễ tiêu hóa, ít muối, ít dầu mỡ.
7. Tính toán dinh dưỡng ước tính (calories, protein, carbs, fat) theo chuẩn USDA/bảng dinh dưỡng.
8. Điền benefits, warnings, recommendations ngắn gọn. Trong 'warnings' phải xác nhận đã tránh hoàn toàn các dị ứng đã nêu (nếu có).

ĐỊNH DẠNG ĐẦU RA: CHỈ TRẢ VỀ MỘT KHỐI JSON DUY NHẤT, KHÔNG KÈM TEXT NÀO KHÁC.

{{
  "mealPlan": [
    {{
      "day": 1,
      "meals": {{
        "breakfast": {{ "food": "", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }},
        "lunch": {{ "food": "", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }},
        "dinner": {{ "food": "", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }}
      }}
    }}
  ],
  "totalDailyCalories": 0,
  "benefits": "",
  "warnings": "",
  "recommendations": ""
}}

Trả lời chỉ bằng JSON (đủ 7 ngày), không markdown, không giải thích."""


def extract_json_from_text(text: str) -> dict | None:
    """Tách khối JSON đầu tiên từ nội dung trả lời (có thể bị markdown hoặc text thừa)."""
    if not text or not text.strip():
        return None
    text = text.strip()
    # Bỏ markdown code block nếu có
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        text = m.group(1).strip()
    # Tìm {...} ngoài cùng
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    end = -1
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    if end == -1:
        return None
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None


def generate_meal_plan(user_id: int) -> dict:
    """
    Sinh kế hoạch thực đơn 7 ngày theo user_id.
    - Lấy health_profiles từ DB
    - Gọi Groq với prompt chuẩn
    - Trả về dict đúng format (mealPlan, totalDailyCalories, benefits, warnings, recommendations).
    """
    profile = get_health_profile_by_user_id(user_id)
    if not profile:
        return {
            "error": "Không tìm thấy hồ sơ sức khỏe",
            "mealPlan": [],
            "totalDailyCalories": 0,
            "benefits": "",
            "warnings": "Cần cập nhật hồ sơ sức khỏe theo user_id.",
            "recommendations": "",
        }

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return {
            "error": "Thiếu cấu hình GROQ_API_KEY",
            "mealPlan": [],
            "totalDailyCalories": 0,
            "benefits": "",
            "warnings": "",
            "recommendations": "",
        }

    prompt = build_meal_plan_prompt(profile)
    client = Groq(api_key=api_key)

    try:
        completion = client.chat.completions.create(
            model="moonshotai/kimi-k2-instruct-0905",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
            max_tokens=4096,
            top_p=1,
        )
        content = (completion.choices[0].message.content or "").strip()
    except Exception as e:
        return {
            "error": str(e),
            "mealPlan": [],
            "totalDailyCalories": 0,
            "benefits": "",
            "warnings": "",
            "recommendations": "",
        }

    result = extract_json_from_text(content)
    if not result:
        return {
            "error": "Không phân tích được JSON từ mô hình",
            "raw_preview": content[:500] if content else "",
            "mealPlan": [],
            "totalDailyCalories": 0,
            "benefits": "",
            "warnings": "",
            "recommendations": "",
        }

    # Đảm bảo đủ key chuẩn
    out = {
        "mealPlan": result.get("mealPlan", []),
        "totalDailyCalories": result.get("totalDailyCalories", 0),
        "benefits": result.get("benefits", ""),
        "warnings": result.get("warnings", ""),
        "recommendations": result.get("recommendations", ""),
    }
    if "error" in result:
        out["error"] = result["error"]
    return out
