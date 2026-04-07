import bcrypt from "bcryptjs";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { requireAuth, signToken } from "./auth.js";
import { db, initializeDb } from "./db.js";

dotenv.config();
initializeDb();

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function callback(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

app.get("/api/health", (_, res) => res.json({ ok: true }));

app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: "Email and password (min 6 chars) are required" });
  }

  try {
    const existing = await get("SELECT id FROM users WHERE email = ?", [email]);
    if (existing) return res.status(409).json({ error: "Email already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run("INSERT INTO users (email, password_hash) VALUES (?, ?)", [email, passwordHash]);
    const user = { id: result.lastID, email };
    const token = signToken(user);

    return res.status(201).json({ token, user });
  } catch {
    return res.status(500).json({ error: "Failed to register" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  try {
    const user = await get("SELECT id, email, password_hash FROM users WHERE email = ?", [email]);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken(user);
    return res.json({ token, user: { id: user.id, email: user.email } });
  } catch {
    return res.status(500).json({ error: "Failed to login" });
  }
});

app.get("/api/tasks", requireAuth, async (req, res) => {
  try {
    const rows = await all(
      "SELECT id, title, description, status, due_date, created_at, updated_at FROM tasks WHERE user_id = ? ORDER BY created_at DESC",
      [req.user.id]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

app.post("/api/tasks", requireAuth, async (req, res) => {
  const { title, description = "", status = "todo", dueDate = null } = req.body || {};
  if (!title) return res.status(400).json({ error: "Title is required" });
  if (!["todo", "in_progress", "done"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const result = await run(
      "INSERT INTO tasks (user_id, title, description, status, due_date) VALUES (?, ?, ?, ?, ?)",
      [req.user.id, title, description, status, dueDate]
    );
    const created = await get(
      "SELECT id, title, description, status, due_date, created_at, updated_at FROM tasks WHERE id = ?",
      [result.lastID]
    );
    return res.status(201).json(created);
  } catch {
    return res.status(500).json({ error: "Failed to create task" });
  }
});

app.put("/api/tasks/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title, description, status, dueDate } = req.body || {};

  if (status && !["todo", "in_progress", "done"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const existing = await get("SELECT id FROM tasks WHERE id = ? AND user_id = ?", [id, req.user.id]);
    if (!existing) return res.status(404).json({ error: "Task not found" });

    await run(
      `UPDATE tasks
       SET title = COALESCE(?, title),
           description = COALESCE(?, description),
           status = COALESCE(?, status),
           due_date = COALESCE(?, due_date),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [title ?? null, description ?? null, status ?? null, dueDate ?? null, id, req.user.id]
    );

    const updated = await get(
      "SELECT id, title, description, status, due_date, created_at, updated_at FROM tasks WHERE id = ?",
      [id]
    );
    return res.json(updated);
  } catch {
    return res.status(500).json({ error: "Failed to update task" });
  }
});

app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await run("DELETE FROM tasks WHERE id = ? AND user_id = ?", [id, req.user.id]);
    if (result.changes === 0) return res.status(404).json({ error: "Task not found" });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "Failed to delete task" });
  }
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});

