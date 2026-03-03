// Kiểm tra định dạng email
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Kiểm tra email có phải đang được Google mail (Gmail/Workspace) host hay không
// Cách kiểm tra: tra MX records của domain và tìm MX của Google
const dns = require("dns").promises;
const googleMxHosts = ["aspmx.l.google.com", "alt1.aspmx.l.google.com", "alt2.aspmx.l.google.com", "alt3.aspmx.l.google.com", "alt4.aspmx.l.google.com"];

const isGmail = async (email) => {
  if (!isValidEmail(email)) return false;
  const domain = email.split("@")[1].toLowerCase();
  try {
    const records = await dns.resolveMx(domain);
    if (!records || records.length === 0) return false;
    // Chuẩn hóa host và kiểm tra xem có host google nào trong MX không
    return records.some((r) => {
      const host = r.exchange.toLowerCase();
      return googleMxHosts.some((g) => host.endsWith(g) || host.includes("google"));
    });
  } catch (err) {
    return false;
  }
};

// Chuyển chuỗi ngày sang định dạng SQL 'YYYY-MM-DD'
// Hỗ trợ các định dạng: 'YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY'
const parseDateToSQL = (dateStr) => {
  if (!dateStr) return null;
  // chuẩn hoá
  const s = String(dateStr).trim();
  // Nếu đã là YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // tách theo / hoặc -
  const parts = s.split(/[\/\-]/).map(p => p.trim());
  if (parts.length !== 3) return null;

  let d, m, y;
  // nếu phần cuối có 4 chữ số -> coi là năm
  if (/^\d{4}$/.test(parts[2])) {
    // có thể định dạng là DD/MM/YYYY hoặc MM/DD/YYYY
    const a = parseInt(parts[0], 10);
    const b = parseInt(parts[1], 10);
    const c = parseInt(parts[2], 10);
    // heuristics: nếu a > 12 => a là ngày
    if (a > 12) {
      d = a; m = b; y = c;
    } else if (b > 12) {
      d = b; m = a; y = c;
    } else {
      // mặc định sử dụng DD/MM/YYYY (phù hợp VN)
      d = a; m = b; y = c;
    }
  } else if (/^\d{4}$/.test(parts[0])) {
    // có thể là YYYY/MM/DD
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
    d = parseInt(parts[2], 10);
  } else {
    // phần năm có 2 chữ số hoặc khác -> không hỗ trợ
    return null;
  }

  // validate
  if (!y || !m || !d) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;

  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
};

// Kiểm tra định dạng số điện thoại
const isValidPhone = (phone) => {
  const phoneRegex = /^[0-9]{10,11}$/;
  return phoneRegex.test(phone);
};

// Kiểm tra mật khẩu (tối thiểu 6 ký tự)
const isValidPassword = (password) => {
  return password && password.length >= 6;
};

// Kiểm tra trường rỗng
const isEmptyField = (field) => {
  return !field || field.trim() === "";
};

module.exports = {
  isValidEmail,
  isGmail,
  parseDateToSQL,
  isValidPhone,
  isValidPassword,
  isEmptyField,
};
