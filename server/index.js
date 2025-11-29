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
const dbPath = path.join(dataDir, 'manid.db');
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
  extras TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// Migration helper: ensure extras column exists for older databases
const ensureColumn = (table, column, type) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const hasColumn = columns.some((col) => col.name === column);
  if (!hasColumn) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  }
};

ensureColumn('attendees', 'extras', 'TEXT');

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
const parseExtras = (value) => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.warn('Unable to parse extras payload', err);
    return {};
  }
};

const buildExtrasPayload = (attendee = {}, existingExtras = {}) => {
  const merged = {
    ...existingExtras,
    eventName: attendee.eventName ?? existingExtras.eventName,
    eventSubtitle: attendee.eventSubtitle ?? existingExtras.eventSubtitle,
    eventStartDate: attendee.eventStartDate ?? existingExtras.eventStartDate,
    eventEndDate: attendee.eventEndDate ?? existingExtras.eventEndDate,
    validFrom: attendee.validFrom ?? existingExtras.validFrom,
    validTo: attendee.validTo ?? existingExtras.validTo,
    sponsor: attendee.sponsor ?? existingExtras.sponsor,
    barcodeValue: attendee.barcodeValue ?? existingExtras.barcodeValue,
    jobTitle: attendee.jobTitle ?? existingExtras.jobTitle,
    schoolId: attendee.schoolId ?? existingExtras.schoolId,
    className: attendee.className ?? existingExtras.className,
    section: attendee.section ?? existingExtras.section,
    fatherName: attendee.fatherName ?? existingExtras.fatherName,
    motherName: attendee.motherName ?? existingExtras.motherName,
    dob: attendee.dob ?? existingExtras.dob,
    contactNumber: attendee.contactNumber ?? existingExtras.contactNumber,
    address: attendee.address ?? existingExtras.address,
    bloodGroup: attendee.bloodGroup ?? existingExtras.bloodGroup,
    extraFields: {
      ...(existingExtras.extraFields || {}),
      ...(attendee.extraFields || {})
    }
  };

  Object.keys(merged).forEach((key) => {
    if (merged[key] === undefined || merged[key] === null || merged[key] === '') {
      delete merged[key];
    }
  });

  if (merged.extraFields && Object.keys(merged.extraFields).length === 0) {
    delete merged.extraFields;
  }

  return merged;
};

const toAttendeeResponse = (row) => {
  if (!row) return null;
  const extras = parseExtras(row.extras);
  const extraFields = extras.extraFields || {};

  return {
    id: row.id,
    registrationId: row.registration_id,
    name: row.name,
    company: row.company,
    passType: row.pass_type,
    role: row.role,
    tracks: row.tracks ? JSON.parse(row.tracks) : [],
    image: row.image,
    eventName: extras.eventName,
    eventSubtitle: extras.eventSubtitle,
    eventStartDate: extras.eventStartDate,
    eventEndDate: extras.eventEndDate,
    validFrom: extras.validFrom,
    validTo: extras.validTo,
    sponsor: extras.sponsor,
    barcodeValue: extras.barcodeValue,
    jobTitle: extras.jobTitle,
    schoolId: extras.schoolId || row.registration_id,
    className: extras.className,
    section: extras.section,
    fatherName: extras.fatherName,
    motherName: extras.motherName,
    dob: extras.dob,
    contactNumber: extras.contactNumber,
    address: extras.address,
    bloodGroup: extras.bloodGroup,
    extraFields
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
  const insert = db.prepare(`INSERT INTO attendees (id, registration_id, name, company, pass_type, role, tracks, image, extras, updated_at)
    VALUES (@id, @registration_id, @name, @company, @pass_type, @role, @tracks, @image, @extras, CURRENT_TIMESTAMP)`);
  const replaceAll = db.transaction((items) => {
    db.prepare('DELETE FROM attendees').run();
    items.forEach((a) => {
      const extrasPayload = buildExtrasPayload(a);
      const payload = {
        id: a.id || `att-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        registration_id: a.registrationId || '',
        name: a.name || '',
        company: a.company || '',
        pass_type: a.passType || '',
        role: a.role || 'Attendee',
        tracks: JSON.stringify(a.tracks || []),
        image: a.image || null,
        extras: Object.keys(extrasPayload).length ? JSON.stringify(extrasPayload) : null
      };
      insert.run(payload);
    });
  });
  replaceAll(attendees);
  res.json({ count: attendees.length });
});

app.patch('/api/attendees/bulk', authMiddleware, (req, res) => {
  const { ids, data } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'ids required' });
  const allowed = [
    'registrationId',
    'name',
    'company',
    'passType',
    'role',
    'tracks',
    'image',
    'eventName',
    'eventSubtitle',
    'eventStartDate',
    'eventEndDate',
    'validFrom',
    'validTo',
    'sponsor',
    'barcodeValue',
    'jobTitle',
    'schoolId',
    'className',
    'section',
    'fatherName',
    'motherName',
    'dob',
    'contactNumber',
    'address',
    'bloodGroup',
    'extraFields'
  ];
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
    extras = COALESCE(@extras, extras),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = @id`);

  const tx = db.transaction((items) => {
    items.forEach((id) => {
      const existing = db.prepare('SELECT * FROM attendees WHERE id = ?').get(id);
      const existingExtras = parseExtras(existing?.extras);
      const nextExtras = buildExtrasPayload(data, existingExtras);
      const extras = Object.keys(nextExtras).length ? JSON.stringify(nextExtras) : existing?.extras;

      updateStmt.run({
        id,
        registrationId: data.registrationId,
        name: data.name,
        company: data.company,
        passType: data.passType,
        role: data.role,
        tracks: data.tracks ? JSON.stringify(data.tracks) : undefined,
        image: data.image,
        extras
      });
    });
  });
  tx(ids);
  res.json({ updated: ids.length });
});

app.patch('/api/attendees/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};
  const existingRow = db.prepare('SELECT * FROM attendees WHERE id = ?').get(id);
  const existingExtras = parseExtras(existingRow?.extras);
  const nextExtras = buildExtrasPayload(payload, existingExtras);
  const extras = Object.keys(nextExtras).length ? JSON.stringify(nextExtras) : existingRow?.extras;

  const update = db.prepare(`UPDATE attendees SET 
    registration_id = COALESCE(@registrationId, registration_id),
    name = COALESCE(@name, name),
    company = COALESCE(@company, company),
    pass_type = COALESCE(@passType, pass_type),
    role = COALESCE(@role, role),
    tracks = COALESCE(@tracks, tracks),
    image = COALESCE(@image, image),
    extras = COALESCE(@extras, extras),
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
    extras
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

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
