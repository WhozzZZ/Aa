// === server.js ===
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

const db = new sqlite3.Database('./data.db');

git init
git remote add origin https://github.com/ton-utilisateur/ton-projet.git
git add .
git commit -m "Premier commit"
git push -u origin master

// --- DB INIT ---
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS objets (
    numero INTEGER PRIMARY KEY,
    code TEXT UNIQUE,
    trouve INTEGER DEFAULT 0,
    pris INTEGER DEFAULT 0,
    vues INTEGER DEFAULT 0,
    date_trouvee TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    objet_code TEXT,
    texte TEXT,
    date_heure TEXT
  )`);

  db.all("SELECT COUNT(*) as count FROM objets", (err, rows) => {
    if (rows[0].count < 100) {
      db.serialize(() => {
        db.run("DELETE FROM objets");
        const stmt = db.prepare("INSERT INTO objets (numero, code) VALUES (?, ?)");
        for (let i = 1; i <= 100; i++) {
          stmt.run(i, uuidv4());
        }
        stmt.finalize();
      });
    }
  });
});

// --- ROUTES ---

app.get('/etat-objets', (req, res) => {
  db.all("SELECT numero, trouve, pris, vues FROM objets", (err, rows) => {
    res.json(rows);
  });
});

app.get('/index', (req, res) => {
  db.all("SELECT numero, trouve, pris, vues FROM objets ORDER BY numero ASC", (err, rows) => {
    if (err) return res.status(500).send("Erreur serveur");

    let html = `
      <html>
      <head>
        <title>État des objets</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f7f7f7; padding: 20px; }
          h1 { text-align: center; margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          th, td { padding: 10px; border-bottom: 1px solid #ddd; text-align: left; }
          th { background: #333; color: white; }
          tr:hover { background: #f1f1f1; }
          .photo { width: 50px; height: 50px; object-fit: cover; border-radius: 5px; margin-right: 10px; }
          .row { display: flex; align-items: center; }
        </style>
      </head>
      <body>
        <h1>Liste des morceaux</h1>
        <table>
          <tr><th>Photo</th><th>Numéro</th><th>État</th><th>Vues</th></tr>
    `;

    for (const row of rows) {
      let etat = "Non trouvé";
      if (row.trouve && !row.pris) etat = "Trouvé";
      else if (row.pris) etat = "Pris";

      html += `
        <tr>
          <td><img src="/photos/${row.numero}.jpg" class="photo" onerror="this.style.display='none'" /></td>
          <td>${row.numero}</td>
          <td>${etat}</td>
          <td>${row.vues}</td>
        </tr>
      `;
    }

    html += `
        </table>
      </body>
      </html>
    `;

    res.send(html);
  });
});

app.get('/objet/:code', (req, res) => {
  const code = req.params.code;
  db.get("SELECT * FROM objets WHERE code = ?", [code], (err, objet) => {
    if (!objet) return res.status(404).send("Objet inconnu.");

    if (!objet.pris) {
      db.run("UPDATE objets SET vues = vues + 1 WHERE code = ?", [code]);
      objet.vues += 1;
    }

    db.all("SELECT texte, date_heure FROM messages WHERE objet_code = ?", [code], (err2, messages) => {
      let boutons = ["je prends ce morceau", "j'ai trouvé ce morceau"];
      if (objet.pris) boutons.push("le morceau a été reposé au même endroit");

      let vueText = "";
      if (objet.trouve && objet.pris) {
        vueText = `L'objet a été vu ${objet.vues} fois avant d'être ramassé.`;
      } else if (objet.trouve) {
        vueText = `Le morceau a été vu ${objet.vues} fois.`;
      }

      res.json({
        message: "Tu peux emporter cet objet ! (précises le via les boutons suivants)",
        vueText,
        objet,
        boutons,
        messages,
        lienIndex: "/index"
      });
    });
  });
});

app.post('/objet/:code', (req, res) => {
  const code = req.params.code;
  const { message, action } = req.body;
  const now = new Date().toISOString();

  db.get("SELECT * FROM objets WHERE code = ?", [code], (err, objet) => {
    if (!objet) return res.status(404).send("Objet inconnu.");

    if (!objet.trouve) {
      db.run("UPDATE objets SET trouve = 1, date_trouvee = ? WHERE code = ?", [now, code]);
    }

    if (action === "prendre") {
      db.run("UPDATE objets SET pris = 1 WHERE code = ?", [code]);
    } else if (action === "reposer") {
      db.run("UPDATE objets SET pris = 0 WHERE code = ?", [code]);
    }

    if (message) {
      db.run("INSERT INTO messages (objet_code, texte, date_heure) VALUES (?, ?, ?)", [code, message, now]);
    }

    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
