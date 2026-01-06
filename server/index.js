import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-please';

app.use(cors());
app.use(express.json({ limit: '15mb' }));

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'agileid.db');
const db = new Database(dbPath);

// --- Schema Setup ---
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendees (
  id TEXT PRIMARY KEY,
  registration_id TEXT,
  name TEXT,
  company TEXT,
  pass_type TEXT,
  role TEXT,
  tracks TEXT,
  image TEXT,
  school_id TEXT,
  school_name TEXT,
  father_name TEXT,
  mother_name TEXT,
  date_of_birth TEXT,
  contact_number TEXT,
  address TEXT,
  class_name TEXT,
  section TEXT,
  emergency_contact TEXT,
  extras TEXT,
  template TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saved_templates (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'default',
  base_template TEXT DEFAULT 'conference',
  layout TEXT NOT NULL,
  theme TEXT,
  custom_labels TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`);

// Lightweight migration for new school ID fields
const existingColumns = new Set(db.prepare('PRAGMA table_info(attendees)').all().map((c) => c.name));
const ensureColumn = (name, definition) => {
  if (!existingColumns.has(name)) {
    db.exec(`ALTER TABLE attendees ADD COLUMN ${name} ${definition}`);
  }
};

ensureColumn('school_id', 'TEXT');
ensureColumn('school_name', 'TEXT');
ensureColumn('father_name', 'TEXT');
ensureColumn('mother_name', 'TEXT');
ensureColumn('date_of_birth', 'TEXT');
ensureColumn('contact_number', 'TEXT');
ensureColumn('address', 'TEXT');
ensureColumn('class_name', 'TEXT');
ensureColumn('section', 'TEXT');
ensureColumn('emergency_contact', 'TEXT');
ensureColumn('extras', 'TEXT');

// Migration for saved_templates visibility column
const templateColumns = new Set(db.prepare('PRAGMA table_info(saved_templates)').all().map((c) => c.name));
if (!templateColumns.has('visibility')) {
  db.exec(`ALTER TABLE saved_templates ADD COLUMN visibility TEXT DEFAULT 'private'`);
}
ensureColumn('template', 'TEXT');
ensureColumn('verification_code', 'TEXT');
ensureColumn('verified', 'INTEGER DEFAULT 1');
ensureColumn('created_by', 'TEXT');

// Generate unique verification code
const generateVerificationCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like O, 0, I, 1
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// --- Admin bootstrap ---
const ensureAdmin = () => {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existing) {
    const hash = bcrypt.hashSync('maniPasswq214$$51sf', 10);
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
    console.log('Seeded admin user with provided credentials. Please change the password in production.');
  }
};
ensureAdmin();

// --- Helpers ---
const toAttendeeResponse = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    registrationId: row.registration_id,
    name: row.name,
    company: row.company,
    passType: row.pass_type,
    role: row.role,
    tracks: row.tracks ? JSON.parse(row.tracks) : [],
    image: row.image,
    schoolId: row.school_id,
    schoolName: row.school_name,
    fatherName: row.father_name,
    motherName: row.mother_name,
    dateOfBirth: row.date_of_birth,
    contactNumber: row.contact_number,
    address: row.address,
    className: row.class_name,
    section: row.section,
    emergencyContact: row.emergency_contact,
    extras: row.extras ? JSON.parse(row.extras) : {},
    template: row.template || 'conference',
    verificationCode: row.verification_code,
    verified: row.verified === 1,
    createdBy: row.created_by
  };
};

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });
  const token = header.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

// --- Auth Routes ---
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) return res.status(401).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

// --- User Management ---
app.post('/api/users', authMiddleware, requireAdmin, (req, res) => {
  const { username, password, role = 'user' } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ message: 'Username already exists' });
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, role);
  res.status(201).json({ id: result.lastInsertRowid, username, role });
});

// --- Attendees ---
app.get('/api/attendees', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM attendees').all();
  res.json(rows.map(toAttendeeResponse));
});

app.post('/api/attendees/import', authMiddleware, (req, res) => {
  const { attendees } = req.body || {};
  if (!Array.isArray(attendees)) return res.status(400).json({ message: 'attendees must be an array' });
  const insert = db.prepare(`INSERT INTO attendees (id, registration_id, name, company, pass_type, role, tracks, image, school_id, school_name, father_name, mother_name, date_of_birth, contact_number, address, class_name, section, emergency_contact, extras, template, verification_code, verified, created_by, updated_at)
    VALUES (@id, @registration_id, @name, @company, @pass_type, @role, @tracks, @image, @school_id, @school_name, @father_name, @mother_name, @date_of_birth, @contact_number, @address, @class_name, @section, @emergency_contact, @extras, @template, @verification_code, @verified, @created_by, CURRENT_TIMESTAMP)`);
  const replaceAll = db.transaction((items, username) => {
    db.prepare('DELETE FROM attendees').run();
    items.forEach((a) => {
      const payload = {
        id: a.id || `att-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        registration_id: a.registrationId || '',
        name: a.name || '',
        company: a.company || '',
        pass_type: a.passType || '',
        role: a.role || 'Attendee',
        tracks: JSON.stringify(a.tracks || []),
        image: a.image || null,
        school_id: a.schoolId || '',
        school_name: a.schoolName || '',
        father_name: a.fatherName || '',
        mother_name: a.motherName || '',
        date_of_birth: a.dateOfBirth || '',
        contact_number: a.contactNumber || '',
        address: a.address || '',
        class_name: a.className || '',
        section: a.section || '',
        emergency_contact: a.emergencyContact || '',
        extras: JSON.stringify(a.extras || {}),
        template: a.template || 'conference',
        verification_code: generateVerificationCode(),
        verified: 1,
        created_by: username
      };
      insert.run(payload);
    });
  });
  replaceAll(attendees, req.user.username);
  res.json({ count: attendees.length });
});

app.patch('/api/attendees/bulk', authMiddleware, (req, res) => {
  const { ids, data } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'ids required' });
  const allowed = ['registrationId', 'name', 'company', 'passType', 'role', 'tracks', 'image', 'schoolId', 'schoolName', 'fatherName', 'motherName', 'dateOfBirth', 'contactNumber', 'address', 'className', 'section', 'emergencyContact', 'extras', 'template'];
  const updates = Object.keys(data || {}).filter((k) => allowed.includes(k));
  if (updates.length === 0) return res.status(400).json({ message: 'No valid fields to update' });
  const updateStmt = db.prepare(`UPDATE attendees SET 
    registration_id = COALESCE(@registrationId, registration_id),
    name = COALESCE(@name, name),
    company = COALESCE(@company, company),
    pass_type = COALESCE(@passType, pass_type),
    role = COALESCE(@role, role),
    tracks = COALESCE(@tracks, tracks),
    image = COALESCE(@image, image),
    school_id = COALESCE(@schoolId, school_id),
    school_name = COALESCE(@schoolName, school_name),
    father_name = COALESCE(@fatherName, father_name),
    mother_name = COALESCE(@motherName, mother_name),
    date_of_birth = COALESCE(@dateOfBirth, date_of_birth),
    contact_number = COALESCE(@contactNumber, contact_number),
    address = COALESCE(@address, address),
    class_name = COALESCE(@className, class_name),
    section = COALESCE(@section, section),
    emergency_contact = COALESCE(@emergencyContact, emergency_contact),
    extras = COALESCE(@extras, extras),
    template = COALESCE(@template, template),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = @id`);
  const tx = db.transaction((items) => {
    items.forEach((id) => {
      updateStmt.run({
        id,
        registrationId: data.registrationId,
        name: data.name,
        company: data.company,
        passType: data.passType,
        role: data.role,
        tracks: data.tracks ? JSON.stringify(data.tracks) : undefined,
        image: data.image,
        schoolId: data.schoolId,
        schoolName: data.schoolName,
        fatherName: data.fatherName,
        motherName: data.motherName,
        dateOfBirth: data.dateOfBirth,
        contactNumber: data.contactNumber,
        address: data.address,
        className: data.className,
        section: data.section,
        emergencyContact: data.emergencyContact,
        extras: data.extras ? JSON.stringify(data.extras) : undefined,
        template: data.template
      });
    });
  });
  tx(ids);
  res.json({ updated: ids.length });
});

app.patch('/api/attendees/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};
  const update = db.prepare(`UPDATE attendees SET 
    registration_id = COALESCE(@registrationId, registration_id),
    name = COALESCE(@name, name),
    company = COALESCE(@company, company),
    pass_type = COALESCE(@passType, pass_type),
    role = COALESCE(@role, role),
    tracks = COALESCE(@tracks, tracks),
    image = COALESCE(@image, image),
    school_id = COALESCE(@schoolId, school_id),
    school_name = COALESCE(@schoolName, school_name),
    father_name = COALESCE(@fatherName, father_name),
    mother_name = COALESCE(@motherName, mother_name),
    date_of_birth = COALESCE(@dateOfBirth, date_of_birth),
    contact_number = COALESCE(@contactNumber, contact_number),
    address = COALESCE(@address, address),
    class_name = COALESCE(@className, class_name),
    section = COALESCE(@section, section),
    emergency_contact = COALESCE(@emergencyContact, emergency_contact),
    extras = COALESCE(@extras, extras),
    template = COALESCE(@template, template),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = @id`);
  update.run({
    id,
    registrationId: payload.registrationId,
    name: payload.name,
    company: payload.company,
    passType: payload.passType,
    role: payload.role,
    tracks: payload.tracks ? JSON.stringify(payload.tracks) : undefined,
    image: payload.image,
    schoolId: payload.schoolId,
    schoolName: payload.schoolName,
    fatherName: payload.fatherName,
    motherName: payload.motherName,
    dateOfBirth: payload.dateOfBirth,
    contactNumber: payload.contactNumber,
    address: payload.address,
    className: payload.className,
    section: payload.section,
    emergencyContact: payload.emergencyContact,
    extras: payload.extras ? JSON.stringify(payload.extras) : undefined,
    template: payload.template
  });
  const updated = db.prepare('SELECT * FROM attendees WHERE id = ?').get(id);
  res.json(toAttendeeResponse(updated));
});

app.delete('/api/attendees/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM attendees WHERE id = ?').run(id);
  res.status(204).end();
});

app.delete('/api/attendees', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM attendees').run();
  res.status(204).end();
});

// --- Saved Templates ---
app.get('/api/templates', authMiddleware, (req, res) => {
  // Get user's private templates + all public templates
  const rows = db.prepare(`
    SELECT st.*, u.username as owner_name 
    FROM saved_templates st 
    LEFT JOIN users u ON st.user_id = u.id
    WHERE st.user_id = ? OR st.visibility = 'public' 
    ORDER BY st.updated_at DESC
  `).all(req.user.id);
  res.json(rows.map(row => ({
    id: row.id,
    name: row.name,
    icon: row.icon || 'default',
    baseTemplate: row.base_template,
    layout: JSON.parse(row.layout || '{}'),
    theme: row.theme ? JSON.parse(row.theme) : null,
    customLabels: row.custom_labels ? JSON.parse(row.custom_labels) : {},
    visibility: row.visibility || 'private',
    isOwner: row.user_id === req.user.id,
    ownerName: row.owner_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })));
});

app.post('/api/templates', authMiddleware, (req, res) => {
  const { name, icon, baseTemplate, layout, theme, customLabels, visibility } = req.body || {};
  if (!name || !layout) {
    return res.status(400).json({ message: 'Name and layout are required' });
  }

  const id = `tpl-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const templateVisibility = visibility === 'public' ? 'public' : 'private';

  db.prepare(`INSERT INTO saved_templates (id, user_id, name, icon, base_template, layout, theme, custom_labels, visibility) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id,
    req.user.id,
    name,
    icon || 'default',
    baseTemplate || 'conference',
    JSON.stringify(layout),
    theme ? JSON.stringify(theme) : null,
    customLabels ? JSON.stringify(customLabels) : null,
    templateVisibility
  );

  res.status(201).json({
    id,
    name,
    icon: icon || 'default',
    baseTemplate: baseTemplate || 'conference',
    visibility: templateVisibility,
    message: 'Template saved successfully'
  });
});

app.patch('/api/templates/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { name, icon, layout, theme, customLabels } = req.body || {};

  // Check ownership
  const existing = db.prepare('SELECT * FROM saved_templates WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!existing) {
    return res.status(404).json({ message: 'Template not found' });
  }

  db.prepare(`UPDATE saved_templates SET 
    name = COALESCE(?, name),
    icon = COALESCE(?, icon),
    layout = COALESCE(?, layout),
    theme = COALESCE(?, theme),
    custom_labels = COALESCE(?, custom_labels),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?`).run(
    name,
    icon,
    layout ? JSON.stringify(layout) : null,
    theme ? JSON.stringify(theme) : null,
    customLabels ? JSON.stringify(customLabels) : null,
    id,
    req.user.id
  );

  res.json({ message: 'Template updated successfully' });
});

app.delete('/api/templates/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM saved_templates WHERE id = ? AND user_id = ?').run(id, req.user.id);
  if (result.changes === 0) {
    return res.status(404).json({ message: 'Template not found' });
  }
  res.status(204).end();
});


// --- PUBLIC Card Verification Endpoint (No Auth Required) ---
app.get('/api/verify/:code', (req, res) => {
  const { code } = req.params;
  if (!code || code.length < 6) {
    return res.status(400).json({
      verified: false,
      message: 'Invalid verification code'
    });
  }

  // Look up the card by verification code
  const card = db.prepare('SELECT * FROM attendees WHERE verification_code = ?').get(code.toUpperCase());

  if (!card) {
    return res.json({
      verified: false,
      message: 'Card not found. This ID card is not registered in our system.',
      code: code.toUpperCase()
    });
  }

  if (card.verified !== 1) {
    return res.json({
      verified: false,
      message: 'This card has been invalidated.',
      code: code.toUpperCase()
    });
  }

  // Card is valid - return basic info (not sensitive data)
  res.json({
    verified: true,
    message: 'Card verified successfully!',
    code: code.toUpperCase(),
    card: {
      name: card.name,
      company: card.company || card.school_name,
      role: card.role,
      registrationId: card.registration_id,
      template: card.template,
      createdBy: card.created_by
    }
  });
});

// Verification page (serves HTML for QR code scan landing)
app.get('/verify/:code', (req, res) => {
  const { code } = req.params;
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Card Verification - AgileID Pro</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 24px;
      padding: 40px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .loader {
      width: 60px;
      height: 60px;
      border: 4px solid #e2e8f0;
      border-top-color: #4f46e5;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .status { font-size: 18px; color: #64748b; margin-bottom: 10px; }
    .code { font-family: monospace; font-size: 24px; font-weight: bold; color: #1e293b; letter-spacing: 4px; }
    .verified { color: #10b981; }
    .not-verified { color: #ef4444; }
    .icon { font-size: 64px; margin-bottom: 16px; }
    .name { font-size: 24px; font-weight: 600; color: #1e293b; margin: 16px 0 8px; }
    .company { font-size: 16px; color: #64748b; margin-bottom: 4px; }
    .role { font-size: 14px; color: #94a3b8; }
    .badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 16px; }
    .badge.verified { background: #d1fae5; color: #059669; }
    .badge.not-verified { background: #fee2e2; color: #dc2626; }
    .footer { margin-top: 24px; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card" id="result">
    <div class="loader"></div>
    <p class="status">Verifying card...</p>
    <p class="code">${code.toUpperCase()}</p>
  </div>
  <script>
    fetch('/api/verify/${code}')
      .then(r => r.json())
      .then(data => {
        const el = document.getElementById('result');
        if (data.verified) {
          el.innerHTML = \`
            <div class="icon">✅</div>
            <span class="badge verified">VERIFIED</span>
            <p class="name">\${data.card.name}</p>
            <p class="company">\${data.card.company || ''}</p>
            <p class="role">\${data.card.role || ''}</p>
            <p style="margin-top:16px;font-size:12px;color:#94a3b8;">ID: \${data.card.registrationId || 'N/A'}</p>
            <p class="code" style="margin-top:20px;font-size:16px;">\${data.code}</p>
            <p class="footer">Verified by AgileID Pro</p>
          \`;
        } else {
          el.innerHTML = \`
            <div class="icon">❌</div>
            <span class="badge not-verified">NOT VERIFIED</span>
            <p style="margin-top:16px;color:#64748b;">\${data.message}</p>
            <p class="code" style="margin-top:20px;">\${data.code}</p>
            <p class="footer">This card could not be verified</p>
          \`;
        }
      })
      .catch(err => {
        document.getElementById('result').innerHTML = \`
          <div class="icon">⚠️</div>
          <p style="color:#64748b;">Error verifying card</p>
        \`;
      });
  </script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
