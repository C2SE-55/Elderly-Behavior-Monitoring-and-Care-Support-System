create database data_ecms;
USE data_ecms;

-- 1 USERS
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
    name ENUM('admin','user','caregiver','family') NOT NULL UNIQUE
);

INSERT INTO roles (name) VALUES
  ('admin'),
  ('user'),
  ('caregiver'),
  ('family');

-- 3 user_roles
CREATE TABLE user_roles (
    user_id INT,
    role_id INT,
    PRIMARY KEY(user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- 4 HEALTH PROFILES
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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5 CAMERAS (thiết bị/stream)
CREATE TABLE cameras (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    camera_name VARCHAR(100),
    location VARCHAR(100),
    stream_url TEXT,
    status ENUM('active','inactive') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 6 ROOMS (1 room = 1 camera)
CREATE TABLE rooms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_id VARCHAR(40) NOT NULL UNIQUE,
    admin_user_id INT NOT NULL,
    host_user_id INT NULL,
    camera_id INT NULL UNIQUE,
    admin_join_token VARCHAR(128) NULL UNIQUE,
    host_join_token VARCHAR(128) NULL UNIQUE,
    max_members INT NOT NULL DEFAULT 5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE SET NULL
);

-- 7 ROOM MEMBERS (phân quyền giám sát nằm ở đây)
CREATE TABLE room_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_id INT NOT NULL,
    user_id INT NOT NULL,
    member_role ENUM('host','caretaker') NOT NULL,

    -- quyền hiện có
    can_manage_medication BOOLEAN NOT NULL DEFAULT FALSE,
    can_receive_schedule_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    can_receive_medication_notifications BOOLEAN NOT NULL DEFAULT TRUE,

    -- quyền giám sát/camera (mới)
    can_view_live BOOLEAN NOT NULL DEFAULT TRUE,
    can_view_events BOOLEAN NOT NULL DEFAULT TRUE,
    can_manage_safe_zones BOOLEAN NOT NULL DEFAULT FALSE,
    can_receive_fall_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    can_receive_left_zone_alerts BOOLEAN NOT NULL DEFAULT TRUE,

    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_room_user (room_id, user_id),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 8 SAFE ZONES
CREATE TABLE safe_zones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    camera_id INT,
    zone_name VARCHAR(100),
    coordinates TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE CASCADE
);

-- 9 FALL EVENTS
CREATE TABLE fall_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    camera_id INT NOT NULL,
    image_url VARCHAR(255),
    video_url VARCHAR(255),
    severity_level ENUM('low', 'medium', 'high') DEFAULT 'high',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE CASCADE
);

-- 10 LEFT SAFE ZONE EVENTS
CREATE TABLE left_safe_zone_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    camera_id INT,
    zone_id INT,
    image_url VARCHAR(255),
    severity_level ENUM('low','medium','high') DEFAULT 'medium',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE CASCADE,
    FOREIGN KEY (zone_id) REFERENCES safe_zones(id) ON DELETE CASCADE
);

-- 11 ALERTS
CREATE TABLE alerts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    event_type ENUM('fall','left_safe_zone'),
    event_id INT,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 12 MEDICATIONS
CREATE TABLE medications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    profile_id INT,
    name VARCHAR(100),
    dosage VARCHAR(100),
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE CASCADE
);

-- 13 medication_schedules
CREATE TABLE medication_schedules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    medication_id INT,
    alarm_time TIME,
    repeat_type ENUM('once','daily') DEFAULT 'daily',
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
);

-- 14 medication_logs
CREATE TABLE medication_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    schedule_id INT,
    taken_time DATETIME,
    status ENUM('taken','missed','skipped') DEFAULT 'taken',
    note TEXT,
    acted_by_user_id INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (schedule_id) REFERENCES medication_schedules(id) ON DELETE CASCADE,
    FOREIGN KEY (acted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_medication_logs_acted_by_time ON medication_logs (acted_by_user_id, taken_time);

-- 15 DAILY SCHEDULE
CREATE TABLE daily_schedules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    profile_id INT NOT NULL,
    day_of_week ENUM('mon','tue','wed','thu','fri','sat','sun') NOT NULL,
    title VARCHAR(255),
    description TEXT,
    start_time TIME,
    end_time TIME,
    type ENUM('exercise','meal','rest','other') DEFAULT 'other',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE CASCADE
);

-- 16 MEAL PLANS
CREATE TABLE meal_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    profile_id INT,
    meal_type ENUM('breakfast','lunch','dinner'),
    food_suggestion TEXT,
    suggested_by VARCHAR(100) DEFAULT 'AI',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE CASCADE
);

-- 17 CHAT SESSIONS
CREATE TABLE chat_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    title VARCHAR(255),
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 18 CHAT MESSAGES
CREATE TABLE chat_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    session_id INT NOT NULL,
    role VARCHAR(30) NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- 19 NOTES
CREATE TABLE notes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    profile_id INT,
    content TEXT,
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 20 FAMILY MESSAGES
CREATE TABLE family_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    profile_id INT NOT NULL,
    sender_id INT NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);