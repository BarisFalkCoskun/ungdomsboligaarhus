"use strict";

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "logins.db");
const db = new Database(dbPath);

// chmod 700

class LoginDatabase {
  static async initialize() {
    await this.createTables();
    await this.createIndexes();
  }

  static async createTables() {
    const dbLogin = "CREATE TABLE IF NOT EXISTS login (id TEXT PRIMARY KEY, login_name TEXT NOT NULL, login_pass TEXT NOT NULL, postpone INTEGER DEFAULT 0, move_in_date TEXT DEFAULT NULL, user_agent TEXT NOT NULL, last_login TEXT NULL)";
    db.prepare(dbLogin).run();
  }

  static async createIndexes() {
    const dbLoginIndex = "CREATE INDEX IF NOT EXISTS id_lookup ON login (id)";
    db.prepare(dbLoginIndex).run();
  }

  static async getAll() {
    return db.prepare("SELECT * FROM login").all()
  }

  static async updatePostponeDate(email, postpone) {
    db.prepare("UPDATE login SET move_in_date = ? WHERE id = ?").run(postpone, email)
  }

  static async updateLastLogin(email) {
    db.prepare("UPDATE login SET last_login = ? WHERE id = ?").run(new Date(Date.now()).toISOString(), email);
  }
}

export default LoginDatabase;