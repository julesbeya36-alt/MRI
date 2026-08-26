const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const dbPath = path.join(dataDir, 'site.db');
const uploadDir = path.join(dataDir, 'uploads');
let usePostgres = Boolean(process.env.DATABASE_URL);

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

app.use(express.json({ limit: '1mb' }));
app.use(express.static(rootDir));
app.use('/uploads', express.static(uploadDir));

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    const allowedTypes = file.fieldname === 'imageFile' ? allowedImageTypes : allowedVideoTypes;
    callback(null, allowedTypes.includes(file.mimetype));
  }
});

let db;
let databaseMode = 'sqlite';
let sqlite3;
let run;
let all;
let get;

const configuredDatabaseUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.trim();

const openLocalDatabase = () => {
  sqlite3 = sqlite3 || require('sqlite3').verbose();
  return new sqlite3.Database(dbPath);
};

const connectDatabase = async () => {
  if (!configuredDatabaseUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL est obligatoire en production. Configurez Supabase/PostgreSQL sur Render.');
    }
    db = openLocalDatabase();
    usePostgres = false;
    databaseMode = 'sqlite';
    return;
  }

  const pool = new Pool({
    connectionString: configuredDatabaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await pool.query('SELECT 1');
    db = pool;
    usePostgres = true;
    databaseMode = 'postgres';
    return;
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`DATABASE_URL inaccessible en production: ${error.message}`);
    }
    console.warn('DATABASE_URL invalide ou inaccessible. Bascule vers SQLite local.');
    console.warn(error.message);
    db = openLocalDatabase();
    usePostgres = false;
    databaseMode = 'sqlite';
  }
};

const runSqlite = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });

const allSqlite = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

const getSqlite = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

const runPostgres = async (sql, params = []) => {
  const statement = sql.trim();
  const hasReturning = statement.toUpperCase().includes('RETURNING');

  const queryText = statement.toUpperCase().startsWith('INSERT') && !hasReturning
    ? `${statement} RETURNING id`
    : statement;

  const result = await db.query(queryText, params);

  if (statement.toUpperCase().startsWith('INSERT')) {
    return { id: result.rows[0]?.id ?? null, changes: result.rowCount ?? 0 };
  }

  return { id: null, changes: result.rowCount ?? 0 };
};

const allPostgres = async (sql, params = []) => {
  const result = await db.query(sql, params);
  return result.rows;
};

const getPostgres = async (sql, params = []) => {
  const result = await db.query(sql, params);
  return result.rows[0] ?? null;
};

const initializeQueryHelpers = () => {
  run = usePostgres ? runPostgres : runSqlite;
  all = usePostgres ? allPostgres : allSqlite;
  get = usePostgres ? getPostgres : getSqlite;
};

async function initDatabase() {
  if (usePostgres) {
    await run(`
      CREATE TABLE IF NOT EXISTS news (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        image TEXT,
        video TEXT,
        buttonText TEXT DEFAULT 'En savoir plus',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } else {
    await run(`
      CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        image TEXT,
        video TEXT,
        buttonText TEXT DEFAULT 'En savoir plus',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  const existingCount = await get('SELECT COUNT(*) AS total FROM news');

  if (!existingCount || Number(existingCount.total) === 0) {
    await run(
      `INSERT INTO news (title, category, description, image, video, buttonText) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'Camp de jeunes pour l\'été 2026',
        'Église',
        'Une semaine de louange, enseignement et moments de réflexion pour les adolescents.',
        'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80',
        '',
        'Participer'
      ]
    );

    await run(
      `INSERT INTO news (title, category, description, image, video, buttonText) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'Action solidaire dans le quartier',
        'Mission',
        'Nous distribuons aide alimentaire et soutien aux familles en difficulté.',
        'https://images.unsplash.com/photo-1517486800579-88f2c0fa0f72?auto=format&fit=crop&w=900&q=80',
        '',
        'Soutenir'
      ]
    );
  }
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'API active', database: databaseMode });
});

app.get('/api/news', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM news ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Erreur API news:', error);
    res.status(500).json({ error: 'Impossible de récupérer les actualités.' });
  }
});

app.post('/api/news', upload.fields([
  { name: 'imageFile', maxCount: 12 },
  { name: 'videoFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, category, description, image = '', video = '', buttonText = 'En savoir plus' } = req.body || {};
    const imageFiles = req.files?.imageFile || [];
    const videoFile = req.files?.videoFile?.[0];
    const imagePaths = imageFiles.map((file) => `/uploads/${file.filename}`);
    const imageValue = imagePaths.length > 1
      ? JSON.stringify(imagePaths)
      : imagePaths[0] || String(image).trim();
    const videoValue = videoFile ? `/uploads/${videoFile.filename}` : String(video).trim();

    if (!title || !category || !description) {
      return res.status(400).json({ error: 'Titre, catégorie et description sont requis.' });
    }

    const query = usePostgres
      ? `INSERT INTO news (title, category, description, image, video, buttonText) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`
      : `INSERT INTO news (title, category, description, image, video, buttonText) VALUES (?, ?, ?, ?, ?, ?)`;

    const result = await run(query, usePostgres
      ? [title.trim(), category.trim(), description.trim(), imageValue, videoValue, buttonText.trim() || 'En savoir plus']
      : [title.trim(), category.trim(), description.trim(), imageValue, videoValue, buttonText.trim() || 'En savoir plus']);

    res.status(201).json({ ok: true, id: result.id });
  } catch (error) {
    console.error('Erreur création news:', error);
    res.status(500).json({ error: 'Impossible de publier l\'actualité.' });
  }
});

app.delete('/api/news/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identifiant invalide.' });
    }

    const existingItem = await get(
      usePostgres ? 'SELECT image, video FROM news WHERE id = $1' : 'SELECT image, video FROM news WHERE id = ?',
      [id]
    );
    const query = usePostgres
      ? 'DELETE FROM news WHERE id = $1'
      : 'DELETE FROM news WHERE id = ?';

    await run(query, [id]);
    const imagePathsToDelete = (() => {
      if (!existingItem?.image) return [];
      try {
        const parsed = JSON.parse(existingItem.image);
        return Array.isArray(parsed) ? parsed : [existingItem.image];
      } catch (error) {
        return [existingItem.image];
      }
    })();

    [...imagePathsToDelete, existingItem?.video].forEach((mediaPath) => {
      if (!mediaPath || !mediaPath.startsWith('/uploads/')) return;
      const filePath = path.join(uploadDir, path.basename(mediaPath));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
    res.json({ ok: true });
  } catch (error) {
    console.error('Erreur suppression news:', error);
    res.status(500).json({ error: 'Impossible de supprimer l\'actualité.' });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Nom, email et message sont requis.' });
    }

    const query = usePostgres
      ? 'INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3)'
      : 'INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)';

    await run(query, [name.trim(), email.trim(), message.trim()]);
    res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Erreur enregistrement contact:', error);
    res.status(500).json({ error: 'Impossible d\'envoyer votre message.' });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM contact_messages ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Erreur récupération messages:', error);
    res.status(500).json({ error: 'Impossible de lire les messages.' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  if (req.path.endsWith('.html') || req.path === '/about' || req.path === '/services' || req.path === '/actualites' || req.path === '/contact' || req.path === '/admin') {
    const fileName = req.path === '/' ? 'index.html' : `${req.path.replace('/', '').replace(/\/$/, '')}.html`;
    const target = path.join(rootDir, fileName);
    if (fs.existsSync(target)) {
      return res.sendFile(target);
    }
  }

  const fallback = path.join(rootDir, 'index.html');
  if (fs.existsSync(fallback)) {
    return res.sendFile(fallback);
  }

  next();
});

connectDatabase()
  .then(() => {
    initializeQueryHelpers();
    return initDatabase();
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Serveur démarré sur http://localhost:${PORT}`);
      console.log(`Base de données: ${databaseMode === 'postgres' ? 'PostgreSQL/Supabase' : 'SQLite local'}`);
      if (!usePostgres) {
        console.log(`Base SQLite: ${dbPath}`);
      }
    });
  })
  .catch((error) => {
    console.error('Erreur d\'initialisation de la base:', error);
    process.exit(1);
  });
