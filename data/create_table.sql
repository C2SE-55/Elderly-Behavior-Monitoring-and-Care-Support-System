USE data_ecms;
-- 1 USERS (bảng tài khoảng)
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(100),
    username VARCHAR(100) UNIQUE,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255),
    phone VARCHAR(20),
    date_of_birth DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2 ROLES 
CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name ENUM('admin','caregiver','family') NOT NULL UNIQUE
);
-- Thêm dữ liệu mặc định cho các role
INSERT INTO roles (name) VALUES
  ('admin'),
  ('caregiver'),
  ('family');
 
-- 3 user_roles (chia role)
CREATE TABLE user_roles (
    user_id INT,
    role_id INT,
    PRIMARY KEY(user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- 4 HEALTH PROFILES (thông tin sức khỏe)
CREATE TABLE health_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    elderly_name VARCHAR(100),
    face_image_url VARCHAR(255),
    age INT,
    weight FLOAT,
    height FLOAT,
    blood_type VARCHAR(5),
    blood_pressure VARCHAR(20),
    chronic_diseases TEXT,
    allergies TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 5 CAMERAS (camera)
CREATE TABLE cameras (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    camera_name VARCHAR(100),
    location VARCHAR(100),
    stream_url TEXT,
    status ENUM('active','inactive') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 6 SAFE ZONES (phải tạo trước left_safe_zone_events) (vùng an toàn)
CREATE TABLE safe_zones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    camera_id INT,
    zone_name VARCHAR(100),
    coordinates TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (camera_id) REFERENCES cameras(id)
);

-- 7 FALL EVENTS (té ngã)
CREATE TABLE fall_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    camera_id INT,
    image_url VARCHAR(255),
    video_url VARCHAR(255),
    severity_level ENUM('low','medium','high') DEFAULT 'high',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (camera_id) REFERENCES cameras(id)
);

-- 8 LEFT SAFE ZONE EVENTS (rời khoảng vùng an toàn)
CREATE TABLE left_safe_zone_events ( 
    id INT PRIMARY KEY AUTO_INCREMENT, 
    camera_id INT, 
    zone_id INT, 
    image_url VARCHAR(255), 
    severity_level ENUM('low','medium','high') DEFAULT 'medium', 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
    FOREIGN KEY (camera_id) REFERENCES cameras(id), 
    FOREIGN KEY (zone_id) REFERENCES safe_zones(id) 
);

-- 9 ALERTS (thông báo té ngã + rời khoải vùng an toàn)
CREATE TABLE alerts ( 
    id INT PRIMARY KEY AUTO_INCREMENT, 
    user_id INT, 
    event_type ENUM('fall','left_safe_zone'), 
    event_id INT, 
    message TEXT, 
    is_read BOOLEAN DEFAULT FALSE, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
    FOREIGN KEY (user_id) REFERENCES users(id) 
);

-- 10 MEDICATIONS (tên thuốc)
CREATE TABLE medications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    profile_id INT,
    name VARCHAR(100),
    dosage VARCHAR(100),
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES health_profiles(id)
);

-- 11 medication_schedules (lịch uống thuốc)
CREATE TABLE medication_schedules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    medication_id INT,
    alarm_time TIME,
    repeat_type ENUM('once','daily') DEFAULT 'daily',
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medication_id) REFERENCES medications(id)
);

-- 12 medication_logs (ghi lại lịch sử uống thuốc)
CREATE TABLE medication_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    schedule_id INT,
    taken_time DATETIME,
    status ENUM('taken','missed','skipped') DEFAULT 'taken',
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (schedule_id) REFERENCES medication_schedules(id)
);

-- 13 DAILY SCHEDULE (thời gian biểu)
CREATE TABLE daily_schedules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    profile_id INT NOT NULL,
    day_of_week ENUM('mon','tue','wed','thu','fri','sat','sun') NOT NULL,
    title VARCHAR(100),
    description TEXT,
    start_time TIME,
    end_time TIME,
    type ENUM('exercise','meal','rest','other') DEFAULT 'other',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES health_profiles(id)
);

-- 14 MEAL PLANS (kế hoạch ăn từ chatbot)
CREATE TABLE meal_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    profile_id INT,
    meal_type ENUM('breakfast','lunch','dinner'),
    food_suggestion TEXT,
    suggested_by VARCHAR(100) DEFAULT 'AI',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES health_profiles(id)
);

-- 15 CHAT SESSIONS (phiên chat chatbot)
CREATE TABLE chat_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 16 NOTES (ghi chú)
CREATE TABLE notes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    profile_id INT,
    content TEXT,
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES health_profiles(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 17 FAMILY MESSAGES (chat giữa các thành viên)
CREATE TABLE family_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    profile_id INT NOT NULL,
    sender_id INT NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES health_profiles(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
);