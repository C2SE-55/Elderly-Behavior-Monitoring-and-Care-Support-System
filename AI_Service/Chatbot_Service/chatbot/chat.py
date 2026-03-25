# chat.py - Trợ lý ảo chat (Groq)
import os
import re
from groq import Groq
from dotenv import load_dotenv

from .meal_plan import get_health_profile_by_user_id

load_dotenv()

SYSTEM_PROMPT = """Bạn là Trợ lý ảo DINH DƯỠNG của ứng dụng Chăm sóc sức khỏe người cao tuổi. Quy tắc:
- Được phép trả lời về: dinh dưỡng, thực đơn, khẩu phần ăn, thực phẩm, nước uống, thói quen ăn uống, sở thích ăn uống, lối sống lành mạnh cho người cao tuổi (vận động nhẹ, ngủ nghỉ, sinh hoạt hằng ngày), và hướng dẫn dùng các tính năng trong ứng dụng.
- Có thể hướng dẫn cách dùng app (mục Quản lý thông tin sức khỏe, Dị ứng, Thực đơn 7 ngày...).
- Luôn ưu tiên cá nhân hóa theo hồ sơ người cần chăm sóc trong bảng health_profiles (tuổi, cân nặng, chiều cao, huyết áp, bệnh nền, dị ứng).
- Ưu tiên nội dung sức khỏe/dinh dưỡng. Với các câu giao tiếp nhẹ (chào hỏi, cảm ơn, hỏi thăm) có thể trả lời tự nhiên, ngắn gọn, thân thiện.
- Với câu hỏi quá ngoài phạm vi ứng dụng (ví dụ chính trị/tài chính/lập trình chuyên sâu), từ chối lịch sự và chuyển hướng về chăm sóc sức khỏe.
- Gợi ý dinh dưỡng, thực đơn phù hợp người cao tuổi (có thể nhắc người dùng dùng tính năng "Thực đơn 7 ngày" trong app).
- Khi người dùng yêu cầu "thực đơn 7 ngày": BẮT BUỘC trả lời ĐỦ 7 NGÀY (Ngày 1, 2, 3, 4, 5, 6, 7). Mỗi ngày ghi rõ Sáng/Trưa/Tối (có thể thêm giữa sáng/chiều nếu muốn). Không được dừng giữa chừng ở ngày 5 hay 6; phải hoàn thành hết Ngày 7. Dùng format gọn để đủ trong một tin nhắn.
- Không đưa thông tin y tế thay thế bác sĩ; khi cần khuyên đến cơ sở y tế.
- Nếu người dùng hỏi về dị ứng hoặc bệnh nền, nhắc họ cập nhật trong mục "Quản lý thông tin sức khỏe" và thực đơn sẽ tự tránh dị nguyên."""


def _looks_like_meal_plan_intent(user_message: str) -> bool:
    lower = (user_message or "").lower()
    meal_keywords = [
        "thực đơn", "thuc don", "bữa ăn", "bua an", "menu", "meal plan", "khẩu phần", "khau phan"
    ]
    if any(k in lower for k in meal_keywords):
        return True
    has_date = bool(re.search(r"\d{1,2}[\/\.]\d{1,2}(?:[\/\.]\d{4})?|\d{4}-\d{2}-\d{2}", lower))
    has_range_words = any(w in lower for w in ["từ", "tu", "đến", "den", "tới", "toi"])
    return has_date and has_range_words


def _looks_clearly_off_topic(user_message: str) -> bool:
    lower = (user_message or "").lower()
    # Nới lỏng mạnh: nếu câu có ngữ cảnh dinh dưỡng/sức khỏe thì KHÔNG chặn.
    health_keywords = [
        "sức khỏe", "suc khoe", "dinh dưỡng", "dinh duong", "thực đơn", "thuc don",
        "bữa ăn", "bua an", "khẩu phần", "khau phan", "calo", "calories", "protein",
        "carb", "fat", "huyết áp", "huyet ap", "tiểu đường", "tieu duong", "tim mạch", "tim mach",
        "ăn sáng", "an sang", "ăn trưa", "an trua", "ăn tối", "an toi", "breakfast", "lunch", "dinner",
        "thuốc", "thuoc", "dị ứng", "di ung", "bệnh nền", "benh nen",
    ]
    if any(k in lower for k in health_keywords):
        return False

    # Chỉ chặn các chủ đề ngoài phạm vi rất rõ ràng.
    off_topic_keywords = [
        "chính trị", "bầu cử", "chiến tranh",
        "debug code", "python script", "javascript framework",
        "coin", "crypto", "forex", "chứng khoán",
    ]
    return any(k in lower for k in off_topic_keywords)


def build_messages(profile: dict | None, user_message: str, history: list[dict]) -> list[dict]:
    """Chuẩn bị danh sách messages cho Groq: system (có thể kèm context hồ sơ), history, user message."""
    system_content = SYSTEM_PROMPT
    if profile:
        name = (profile.get("elderly_name") or "").strip()
        age = profile.get("age") or ""
        weight = profile.get("weight") or ""
        height = profile.get("height") or ""
        blood_type = (profile.get("blood_type") or "").strip()
        blood_pressure = (profile.get("blood_pressure") or "").strip()
        chronic = (profile.get("chronic_diseases") or "").strip()
        allergies = (profile.get("allergies") or "").strip()

        system_content += "\n\nTHÔNG TIN HỒ SƠ SỨC KHỎE ĐANG THEO DÕI (chỉ dùng để tư vấn dinh dưỡng):\n"
        if name:
            system_content += f"- Tên: {name}\n"
        if age:
            system_content += f"- Tuổi: {age}\n"
        if weight:
            system_content += f"- Cân nặng: {weight}\n"
        if height:
            system_content += f"- Chiều cao: {height}\n"
        if blood_type:
            system_content += f"- Nhóm máu: {blood_type}\n"
        if blood_pressure:
            system_content += f"- Huyết áp: {blood_pressure}\n"
        if chronic:
            system_content += f"- Bệnh mãn tính: {chronic}\n"
        if allergies:
            system_content += f"- Dị ứng: {allergies}\n"
        else:
            system_content += "- Dị ứng: chưa có thông tin, hãy khuyên người dùng bổ sung trong mục 'Dị ứng' của ứng dụng.\n"
    messages = [{"role": "system", "content": system_content}]
    for h in history[-10:]:  # giữ tối đa 10 lượt gần nhất
        role = "user" if h.get("role") == "user" else "assistant"
        content = (h.get("content") or "").strip()
        if content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_message.strip()})
    return messages


def chat_reply(user_message: str, history: list[dict], user_id: int | None = None) -> str:
    """
    Gửi tin nhắn người dùng và lấy câu trả lời từ Groq.
    history: list of { "role": "user"|"assistant", "content": "..." }
    """
    user_message = (user_message or "").strip()
    if not user_message:
        return "Bạn chưa nhập nội dung. Hãy gửi tin nhắn để mình hỗ trợ."

    # Nới lỏng bộ lọc: ưu tiên cho các câu liên quan thực đơn theo ngày/bữa ăn.
    if _looks_like_meal_plan_intent(user_message):
        # Cho phép model xử lý toàn bộ câu hỏi thực đơn, kể cả khi user nhập ngắn kiểu "26/3 tới 29/3".
        pass
    elif _looks_clearly_off_topic(user_message):
        return "Mình tập trung hỗ trợ về sức khỏe, lối sống, dinh dưỡng và bữa ăn cho người cao tuổi trong ứng dụng này. Bạn thử hỏi lại theo hướng đó nhé."

    lower = user_message.lower()
    has_date = bool(re.search(r"\d{1,2}[\/\.]\d{1,2}(?:[\/\.]\d{4})?|\d{4}-\d{2}-\d{2}", lower))
    has_range_words = any(w in lower for w in ["từ", "tu", "đến", "den", "tới", "toi"])
    has_meal_words = any(w in lower for w in ["sáng", "sang", "trưa", "trua", "tối", "toi", "breakfast", "lunch", "dinner"])
    if has_date and has_range_words and not has_meal_words:
        return (
            "Mình đã hiểu khoảng ngày bạn muốn tạo thực đơn. "
            "Bạn cho mình biết thêm muốn áp dụng bữa nào (sáng/trưa/tối hay cả 3 bữa) để mình gợi ý chính xác nhé."
        )

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return "Trợ lý đang bảo trì. Vui lòng thử lại sau."
    profile = get_health_profile_by_user_id(user_id) if user_id else None
    # Nới lỏng: nếu chưa có hồ sơ vẫn trả lời ở mức gợi ý chung, không chặn cuộc hội thoại.
    messages = build_messages(profile, user_message, history or [])
    client = Groq(api_key=api_key)
    try:
        completion = client.chat.completions.create(
            model="moonshotai/kimi-k2-instruct-0905",
            messages=messages,
            temperature=0.6,
            max_tokens=4096,
        )
        return (completion.choices[0].message.content or "").strip() or "Mình chưa trả lời được. Bạn thử hỏi lại nhé."
    except Exception as e:
        return f"Lỗi kết nối: {str(e)}. Bạn thử lại sau nhé."
