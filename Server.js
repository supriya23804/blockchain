// ─────────────────────────────────────────────────────────────
//  CertChain Backend — server.js
//  Node.js + Express + SQLite3
// ─────────────────────────────────────────────────────────────

const express = require('express');
const cors    = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const app  = express();
const PORT = 5000;

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Database Setup ───────────────────────────────────────────
const db = new sqlite3.Database('certchain.db', (err) => {
  if (err) {
    console.error('Database error:', err.message);
  } else {
    console.log('✅ Database ready — certchain.db');
  }
});

// Create tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS certificates (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      hash          TEXT    NOT NULL UNIQUE,
      owner_name    TEXT    NOT NULL,
      document_type TEXT    NOT NULL,
      issued_by     TEXT    NOT NULL,
      issue_date    TEXT    NOT NULL,
      registered_at TEXT    NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS verify_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      hash       TEXT NOT NULL,
      status     TEXT NOT NULL,
      checked_at TEXT NOT NULL
    )
  `);

  // Seed demo data
  db.get('SELECT COUNT(*) as c FROM certificates', (err, row) => {
    if (row && row.c === 0) {
      const demos = [
        {
          hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
          owner_name: 'Ravi Kumar',
          document_type: 'Degree Certificate',
          issued_by: 'Anna University',
          issue_date: '2023-05-15'
        },
        {
          hash: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
          owner_name: 'Priya Sharma',
          document_type: '12th Mark Sheet',
          issued_by: 'CBSE Board',
          issue_date: '2021-07-10'
        },
        {
          hash: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
          owner_name: 'Arjun Singh',
          document_type: 'PG Certificate',
          issued_by: 'IIT Madras',
          issue_date: '2024-01-20'
        }
      ];

      const stmt = db.prepare(`
        INSERT INTO certificates (hash, owner_name, document_type, issued_by, issue_date, registered_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      demos.forEach(d => {
        stmt.run(d.hash, d.owner_name, d.document_type, d.issued_by, d.issue_date, new Date().toISOString());
      });

      stmt.finalize();
      console.log('🌱 Demo certificates seeded');
    }
  });
});

// ─────────────────────────────────────────────────────────────
//  ROUTES
// ─────────────────────────────────────────────────────────────

// GET / — Health check
app.get('/', (req, res) => {
  res.json({
    message: '🔗 CertChain Backend is running',
    version: '1.0.0',
    endpoints: {
      verify:   'POST /verify',
      register: 'POST /register',
      list:     'GET  /certificates',
      delete:   'DELETE /certificates/:id',
      logs:     'GET  /logs',
      stats:    'GET  /stats'
    }
  });
});

// POST /verify — Check if certificate hash exists
app.post('/verify', (req, res) => {
  const { hash } = req.body;

  if (!hash || typeof hash !== 'string' || hash.length !== 64) {
    return res.status(400).json({
      status:  'error',
      message: 'Invalid hash. Must be a 64-character SHA-256 string.'
    });
  }

  db.get('SELECT * FROM certificates WHERE hash = ?', [hash], (err, cert) => {
    if (err) {
      return res.status(500).json({ status: 'error', message: err.message });
    }

    // Log the verification attempt
    db.run(
      'INSERT INTO verify_log (hash, status, checked_at) VALUES (?, ?, ?)',
      [hash, cert ? 'valid' : 'not_found', new Date().toISOString()]
    );

    if (cert) {
      return res.json({
        status:  'valid',
        message: 'Certificate is authentic and recorded on the blockchain.',
        certificate: {
          id:            cert.id,
          owner_name:    cert.owner_name,
          document_type: cert.document_type,
          issued_by:     cert.issued_by,
          issue_date:    cert.issue_date,
          registered_at: cert.registered_at
        }
      });
    } else {
      return res.json({
        status:  'not_found',
        message: 'Certificate not found in the blockchain registry.'
      });
    }
  });
});

// POST /register — Add new certificate
app.post('/register', (req, res) => {
  const { hash, owner_name, document_type, issued_by, issue_date } = req.body;

  if (!hash || !owner_name || !document_type || !issued_by || !issue_date) {
    return res.status(400).json({
      status:  'error',
      message: 'All fields required: hash, owner_name, document_type, issued_by, issue_date'
    });
  }

  if (hash.length !== 64) {
    return res.status(400).json({
      status:  'error',
      message: 'Invalid hash. Must be 64-character SHA-256 string.'
    });
  }

  db.get('SELECT id FROM certificates WHERE hash = ?', [hash], (err, existing) => {
    if (existing) {
      return res.status(409).json({
        status:  'duplicate',
        message: 'This certificate is already registered.'
      });
    }

    db.run(
      'INSERT INTO certificates (hash, owner_name, document_type, issued_by, issue_date, registered_at) VALUES (?, ?, ?, ?, ?, ?)',
      [hash, owner_name, document_type, issued_by, issue_date, new Date().toISOString()],
      function(err) {
        if (err) {
          return res.status(500).json({ status: 'error', message: err.message });
        }
        return res.status(201).json({
          status:  'success',
          message: 'Certificate registered successfully on the blockchain.',
          id:      this.lastID
        });
      }
    );
  });
});

// GET /certificates — List all certificates
app.get('/certificates', (req, res) => {
  db.all(`
    SELECT id, owner_name, document_type, issued_by, issue_date, registered_at,
           SUBSTR(hash, 1, 16) || '...' AS hash_preview
    FROM certificates ORDER BY registered_at DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ status: 'error', message: err.message });
    res.json({ status: 'success', total: rows.length, data: rows });
  });
});

// DELETE /certificates/:id — Delete a certificate
app.delete('/certificates/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT id FROM certificates WHERE id = ?', [id], (err, row) => {
    if (!row) return res.status(404).json({ status: 'error', message: 'Certificate not found.' });
    db.run('DELETE FROM certificates WHERE id = ?', [id], () => {
      res.json({ status: 'success', message: `Certificate #${id} deleted.` });
    });
  });
});

// GET /logs — Verification logs
app.get('/logs', (req, res) => {
  db.all(`
    SELECT id, SUBSTR(hash, 1, 16) || '...' AS hash_preview, status, checked_at
    FROM verify_log ORDER BY checked_at DESC LIMIT 100
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ status: 'error', message: err.message });
    res.json({ status: 'success', total: rows.length, data: rows });
  });
});

// GET /stats — Summary statistics
app.get('/stats', (req, res) => {
  db.get('SELECT COUNT(*) as c FROM certificates', [], (err, total) => {
    db.get('SELECT COUNT(*) as c FROM verify_log', [], (err, checks) => {
      db.get("SELECT COUNT(*) as c FROM verify_log WHERE status='valid'", [], (err, valid) => {
        db.get("SELECT COUNT(*) as c FROM verify_log WHERE status='not_found'", [], (err, failed) => {
          res.json({
            status: 'success',
            data: {
              total_certificates:   total.c,
              total_verifications:  checks.c,
              valid_verifications:  valid.c,
              failed_verifications: failed.c
            }
          });
        });
      });
    });
  });
});

// ── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('🔗 CertChain Backend Started!');
  console.log(`🌐 Running at:  http://localhost:${PORT}`);
  console.log(`📋 All certs:   http://localhost:${PORT}/certificates`);
  console.log(`📊 Stats:       http://localhost:${PORT}/stats`);
  console.log(`📜 Logs:        http://localhost:${PORT}/logs`);
  console.log('');
});
