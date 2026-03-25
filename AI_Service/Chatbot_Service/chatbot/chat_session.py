import os
from typing import Any

import pymysql


def _get_conn():
    return pymysql.connect(
        host=os.getenv("sDB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "data_ecms"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
    )


def init_chat_tables():
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS chat_sessions (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    user_id INT,
                    title VARCHAR(255) NULL,
                    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
                """
            )
            # Backward-compatible migration cho DB cũ chưa có title
            cur.execute("ALTER TABLE chat_sessions ADD COLUMN title VARCHAR(255) NULL")
    except Exception:
        # Cột đã tồn tại thì bỏ qua
        pass
    finally:
        conn.close()

    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    session_id INT NOT NULL,
                    role VARCHAR(30) NOT NULL,
                    content TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
                )
                """
            )
            # Nếu DB cũ từng tạo ENUM, chuyển sang VARCHAR để linh hoạt phân quyền sau này.
            cur.execute("ALTER TABLE chat_messages MODIFY COLUMN role VARCHAR(30) NOT NULL")
    finally:
        conn.close()


def create_chat_session(user_id: int | None = None) -> int:
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO chat_sessions (user_id) VALUES (%s)", (user_id,))
            return int(cur.lastrowid)
    finally:
        conn.close()


def get_chat_sessions(user_id: int | None, limit: int = 20) -> list[dict[str, Any]]:
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            if user_id is None:
                return []
            cur.execute(
                """
                SELECT
                    s.id,
                    s.user_id,
                    COALESCE(NULLIF(TRIM(s.title), ''), CONCAT('Phiên #', s.id)) AS title,
                    s.started_at,
                    (
                        SELECT COUNT(*)
                        FROM chat_messages m
                        WHERE m.session_id = s.id
                    ) AS message_count
                FROM chat_sessions s
                WHERE s.user_id = %s
                  AND EXISTS (
                      SELECT 1
                      FROM chat_messages m2
                      WHERE m2.session_id = s.id
                  )
                ORDER BY s.started_at DESC
                LIMIT %s
                """,
                (user_id, limit),
            )
            return list(cur.fetchall() or [])
    finally:
        conn.close()


def set_session_title_if_empty(session_id: int, title: str):
    normalized = (title or "").strip()
    if not normalized:
        return
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE chat_sessions
                SET title = %s
                WHERE id = %s AND (title IS NULL OR TRIM(title) = '')
                """,
                (normalized[:255], session_id),
            )
    finally:
        conn.close()


def get_session_messages(session_id: int, user_id: int | None = None, limit: int = 200) -> list[dict[str, Any]]:
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            if user_id is not None:
                cur.execute(
                    "SELECT id FROM chat_sessions WHERE id = %s AND (user_id = %s OR user_id IS NULL)",
                    (session_id, user_id),
                )
            else:
                cur.execute("SELECT id FROM chat_sessions WHERE id = %s", (session_id,))
            owner = cur.fetchone()
            if not owner:
                return []

            cur.execute(
                """
                SELECT id, role, content, created_at
                FROM chat_messages
                WHERE session_id = %s
                ORDER BY created_at ASC, id ASC
                LIMIT %s
                """,
                (session_id, limit),
            )
            return list(cur.fetchall() or [])
    finally:
        conn.close()


def save_chat_message(session_id: int, role: str, content: str):
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO chat_messages (session_id, role, content) VALUES (%s, %s, %s)",
                (session_id, role, content),
            )
    finally:
        conn.close()


def delete_chat_session(session_id: int, user_id: int | None = None) -> bool:
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            if user_id is not None:
                cur.execute(
                    "SELECT id FROM chat_sessions WHERE id = %s AND (user_id = %s OR user_id IS NULL)",
                    (session_id, user_id),
                )
            else:
                cur.execute("SELECT id FROM chat_sessions WHERE id = %s", (session_id,))
            row = cur.fetchone()
            if not row:
                return False

            # Xóa message trước để tương thích cả DB chưa bật ON DELETE CASCADE.
            cur.execute("DELETE FROM chat_messages WHERE session_id = %s", (session_id,))
            cur.execute("DELETE FROM chat_sessions WHERE id = %s", (session_id,))
            return cur.rowcount > 0
    finally:
        conn.close()
