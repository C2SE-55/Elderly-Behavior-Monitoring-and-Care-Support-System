# API Chatbot Service - Meal plan + Chat Trợ lý ảo
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from chatbot.meal_plan import generate_meal_plan
from chatbot.chat import chat_reply

app = FastAPI(title="Chatbot & Meal Plan Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/meal-plan")
def get_meal_plan(user_id: int = Query(..., description="ID người dùng (user_id) để lấy hồ sơ sức khỏe và tạo thực đơn 7 ngày")):
    """
    Tạo kế hoạch thực đơn 7 ngày cá nhân hóa theo hồ sơ sức khỏe (health_profiles) của user_id.
    Trả về JSON: mealPlan (7 ngày, mỗi ngày breakfast/lunch/dinner), totalDailyCalories, benefits, warnings, recommendations.
    """
    try:
        result = generate_meal_plan(user_id)
        if result.get("error"):
            raise HTTPException(status_code=400, detail=result.get("error"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ChatRequest(BaseModel):
    message: str
    user_id: int | None = None
    history: list[dict] | None = None  # [{"role": "user"|"assistant", "content": "..."}]


@app.post("/chat")
def post_chat(body: ChatRequest):
    """Trợ lý ảo: gửi tin nhắn, nhận câu trả lời (có thể truyền user_id và history để cá nhân hóa)."""
    reply = chat_reply(
        user_message=body.message,
        history=body.history or [],
        user_id=body.user_id,
    )
    return {"reply": reply}


@app.get("/health")
def health():
    return {"status": "ok"}
