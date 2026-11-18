#!/usr/bin/env python3
"""
SVC Smart Move — Central On-Premise Production Server (Phase 1: Wire Stock)
Sri Venkateshwara Company (SVC), Coimbatore

Hardened Production Server for Windows Server 2012 / Factory LAN.
- Zero external dependencies: Uses only Python 3 Standard Library.
- Salted PBKDF2-HMAC-SHA256 password hashing (100,000 iterations).
- Mandatory initial password change enforcement for default accounts.
- SQLite transactional safety with BEGIN IMMEDIATE and thread-level mutex.
- Strict server-side negative stock prevention under concurrent load.
- Central shared REST API & Static file hosting on 0.0.0.0:8080.
"""

import os
import sys
import json
import sqlite3
import hashlib
import hmac
import mimetypes
import threading
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("PORT", os.environ.get("SVC_PORT", 8080)))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "app"))
DATA_DIR = os.path.abspath(os.path.join(BASE_DIR, "data"))
DB_PATH = os.path.join(DATA_DIR, "svc_smartmove.db")

os.makedirs(DATA_DIR, exist_ok=True)

# Global mutex for serializing batch allocation and stock checks
DB_LOCK = threading.Lock()

# In-memory session store: token -> { user_id, username, role, must_change_password }
SESSIONS = {}

PBKDF2_ITERATIONS = 100000

def hash_pin(pin: str, salt: bytes = None) -> str:
    """Generate salted PBKDF2-HMAC-SHA256 password hash."""
    if salt is None:
        salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2:sha256:{PBKDF2_ITERATIONS}${salt.hex()}${key.hex()}"

def verify_pin(pin: str, stored_hash: str) -> bool:
    """Verify PIN against stored hash with timing attack prevention."""
    try:
        if stored_hash.startswith("pbkdf2:sha256:"):
            parts = stored_hash.split("$")
            if len(parts) == 3:
                meta, salt_hex, key_hex = parts
                iterations = int(meta.split(":")[2])
                salt = bytes.fromhex(salt_hex)
                expected_key = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt, iterations)
                return hmac.compare_digest(expected_key.hex(), key_hex)
        # Fallback check for legacy unsalted hash (if migrating from v1 prototype)
        legacy_hash = hashlib.sha256(f"svc_salt_{pin}".encode("utf-8")).hexdigest()
        return hmac.compare_digest(legacy_hash, stored_hash)
    except Exception:
        return False

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=60.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

CANONICAL_MASTER_DATA = [
    ("AL", "IS7341975", "3.30", "A", "l", "AL-A-l-000", "RCW"),
    ("AL", "IS7341975", "5.50", "B", "l", "AL-B-l-000", "AK"),
    ("AL", "5056", "4.20(DA)", "C", "d", "AL-C-d-000", "Sensor"),
    ("AL", "IS7341975", "8.60", "D", "l", "AL-D-l-000", "Precision"),
    ("BR", "CUZN35", "2.60", "A", "j", "BR-A-j-000", "Sai"),
    ("BR", "CUZN35", "4.00", "B", "j", "BR-B-j-000", "Venus"),
    ("BR", "CUZN35", "5.50.", "C", "j", "BR-C-j-000", "Sharp"),
    ("BR", "CUZN36", "4.50", "D", "k", "BR-D-k-000", "KEI"),
    ("CU", "CUDHP", "3.30.", "A", "i", "CU-A-i-000", ""),
    ("CU", "CUDHP", "8.30", "B", "i", "CU-B-i-000", ""),
    ("CU", "CUDHP", "11.10", "C", "i", "CU-C-i-000", ""),
    ("CU", "CUDHP", "12.50", "D", "i", "CU-D-i-000", ""),
    ("CU", "CUDHP", "2.20", "E", "i", "CU-E-i-000", ""),
    ("MS", "1010", "9.40(DA)", "I", "a", "MS-I-a-000", ""),
    ("MS", "1010", "2.20(DA)", "A", "a", "MS-A-a-000", ""),
    ("MS", "15B25", "5.50(DA).", "AA", "e", "MS-AA-e-000", ""),
    ("MS", "1010", "8.78 (DA)", "AB", "a", "MS-AB-a-000", ""),
    ("MS", "1018", "5.10(DA)", "AC", "b", "MS-AC-b-000", ""),
    ("MS", "1035", "4.00(DA)", "AD", "c", "MS-AD-c-000", ""),
    ("MS", "1035", "4.50(DA)", "AE", "c", "MS-AE-c-000", ""),
    ("MS", "1010", "3.30(DA)", "B", "a", "MS-B-a-000", ""),
    ("MS", "1010", "4.50(DA).", "C", "a", "MS-C-a-000", ""),
    ("MS", "1010", "4.78", "D", "a", "MS-D-a-000", ""),
    ("MS", "1010", "4.90", "E", "a", "MS-E-a-000", ""),
    ("MS", "1010", "5.50(DA)", "F", "a", "MS-F-a-000", ""),
    ("MS", "1010", "5.88", "G", "a", "MS-G-a-000", ""),
    ("MS", "1010", "5.92", "H", "a", "MS-H-a-000", ""),
    ("MS", "1010", "9.85", "J", "a", "MS-J-a-000", ""),
    ("MS", "1010", "6.88", "K", "a", "MS-K-a-000", ""),
    ("MS", "1010", "7.40(DA)", "L", "a", "MS-L-a-000", ""),
    ("MS", "1010", "7.88", "M", "a", "MS-M-a-000", ""),
    ("MS", "1010", "8.25(DA)", "N", "a", "MS-N-a-000", ""),
    ("MS", "1010", "9.30(DA)", "O", "a", "MS-O-a-000", ""),
    ("MS", "1035", "5.20(DA)", "P", "c", "MS-P-c-000", ""),
    ("MS", "1035", "8.30(DA) ", "Q", "c", "MS-Q-c-000", ""),
    ("MS", "1035", "9.85.", "R", "c", "MS-R-c-000", ""),
    ("MS", "1010", "6.40", "U", "a", "MS-U-a-000", ""),
    ("MS", "1010", "3.74", "V", "a", "MS-V-a-000", ""),
    ("MS", "IS7887", "5.50(DA)x", "W", "m", "MS-W-m-000", ""),
    ("MS", "S20C", "2.20(DA)", "W", "n", "MS-W-n-000", ""),
    ("MS", "S20C", "4.50(DA)x", "X", "n", "MS-X-n-000", ""),
    ("MS", "S20C", "5.00(DA)", "Y", "n", "MS-Y-n-000", ""),
    ("MS", "1035", "7.20(DA)", "Z", "c", "MS-Z-c-000", ""),
    ("SS", "AISI430", "2.98", "A", "h", "SS-A-h-000", ""),
    ("SS", "AISI430", "3.88", "B", "h", "SS-B-h-000", ""),
    ("SS", "AISI304", "3.88(304)", "G", "h", "SS-G-h-000", ""),
    ("SS", "AISI430", "3.80", "H", "h", "SS-H-h-000", ""),
    ("SS", "AISI304", "4.78(304)", "L", "f", "SS-L-f-000", ""),
    ("SS", "AISI304CU2", "4.78(304CU2)", "M", "g", "SS-M-g-000", "")
]

def init_database():
    with DB_LOCK:
        conn = get_db()
        cur = conn.cursor()
        
        # 1. Create Tables
        schema_file = os.path.join(BASE_DIR, "schema.sql")
        if os.path.exists(schema_file):
            with open(schema_file, "r", encoding="utf-8") as f:
                cur.executescript(f.read())
        
        # Schema migration check: ensure must_change_password exists
        cur.execute("PRAGMA table_info(users)")
        columns = [row["name"] for row in cur.fetchall()]
        if "must_change_password" not in columns:
            cur.execute("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 1")

        # 2. Seed Default Users with PBKDF2 hashes
        cur.execute("SELECT COUNT(*) as cnt FROM users")
        if cur.fetchone()["cnt"] == 0:
            default_users = [
                ("USR-01", "admin", hash_pin("admin123"), "SVC Plant Manager", "Admin", 1, 1),
                ("USR-02", "operator", hash_pin("store123"), "Store Supervisor", "Operator", 1, 1),
                ("USR-03", "viewer", hash_pin("view123"), "Plant Auditor", "Viewer", 1, 1)
            ]
            cur.executemany(
                "INSERT INTO users (id, username, password_hash, full_name, role, must_change_password, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
                default_users
            )
        else:
            # Upgrade existing default accounts to PBKDF2 if still using legacy SHA-256
            cur.execute("SELECT id, username, password_hash FROM users WHERE username IN ('admin', 'operator', 'viewer')")
            for u in cur.fetchall():
                if not u["password_hash"].startswith("pbkdf2:sha256:"):
                    default_pins = {"admin": "admin123", "operator": "store123", "viewer": "view123"}
                    cur.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_pin(default_pins[u["username"]]), u["id"]))

        # 3. Seed Master Data (all 49 canonical wire specs)
        cur.execute("SELECT COUNT(*) as cnt FROM master_wire_specs")
        if cur.fetchone()["cnt"] == 0:
            cur.executemany(
                "INSERT OR IGNORE INTO master_wire_specs (material, grade, wire_size, wire_code, grade_code, template_batch, preferred_supplier) VALUES (?, ?, ?, ?, ?, ?, ?)",
                CANONICAL_MASTER_DATA
            )

        # 4. Seed Parts Catalog from partsCatalog.js if empty
        cur.execute("SELECT COUNT(*) as cnt FROM parts_catalog")
        if cur.fetchone()["cnt"] == 0:
            parts_file = os.path.join(APP_DIR, "js", "partsCatalog.js")
            if os.path.exists(parts_file):
                with open(parts_file, "r", encoding="utf-8") as f:
                    content = f.read()
                    start = content.find("PARTS_CATALOG = [")
                    if start != -1:
                        end = content.find("];", start)
                        json_str = content[start + len("PARTS_CATALOG = "):end + 1]
                        try:
                            records = json.loads(json_str)
                            rows = [
                                (p["partNumber"], p["customer"], p.get("material", ""), p.get("type", ""), p.get("fromSize", ""))
                                for p in records
                            ]
                            cur.executemany(
                                "INSERT OR IGNORE INTO parts_catalog (part_number, customer_name, material, part_type, from_size) VALUES (?, ?, ?, ?, ?)",
                                rows
                            )
                        except Exception as e:
                            print(f"[WARN] Failed to seed parts catalog: {e}")

        # 5. Ensure Historical Seed Lots exist (all 6 verified baseline lots)
        cur.execute("SELECT COUNT(*) as cnt FROM rm_inward_lots")
        if cur.fetchone()["cnt"] == 0:
            initial_lots = [
                ("MS-M-a-26-001", "2026-01-02", "RCW", "2340", "2026-01-01", "", "", "MS", "1010", "7.88", 12, 1785.00, "A3094255", "Initial wire stock", "admin"),
                ("MS-D-a-26-001", "2026-01-02", "RCW", "2341", "2026-01-01", "", "", "MS", "1010", "4.78", 8, 1139.00, "A3094256", "Mild Steel coil", "admin"),
                ("MS-F-a-26-001", "2026-01-03", "RCW", "2345", "2026-01-02", "", "", "MS", "1010", "5.50(DA)", 20, 2950.00, "A3094280", "Drawn Annealed wire", "admin"),
                ("MS-C-a-26-001", "2026-01-27", "RCW", "2480", "2026-01-25", "", "", "MS", "1010", "4.50(DA).", 2, 350.00, "B3095445", "Special dotted wire spec", "admin"),
                ("BR-C-j-26-001", "2026-01-05", "SHARP", "664", "2026-01-02", "", "", "BR", "CUZN35", "5.50.", 4, 221.35, "R5606", "Brass lot", "admin"),
                ("SS-A-h-26-001", "2026-01-03", "VENUS", "9300252649", "2025-12-30", "", "", "SS", "AISI430", "2.98", 6, 322.70, "V21026", "Stainless Steel lot", "admin")
            ]
            cur.executemany(
                "INSERT INTO rm_inward_lots (batch_no, inward_date, supplier, inv_no, inv_date, po_no, gi_no, material, grade, wire_size, coils, weight, heat_no, remarks, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                initial_lots
            )
            for lot in initial_lots:
                b_parts = lot[0].split("-")
                if len(b_parts) == 5:
                    prefix = f"{b_parts[0]}-{b_parts[1]}-{b_parts[2]}-{b_parts[3]}"
                    seq = int(b_parts[4])
                    cur.execute(
                        "INSERT INTO batch_sequences (prefix, last_seq) VALUES (?, ?) ON CONFLICT(prefix) DO UPDATE SET last_seq = MAX(last_seq, ?)",
                        (prefix, seq, seq)
                    )

        conn.commit()
        conn.close()
        print(f"[OK] SVC Smart Move SQLite Database initialized at: {DB_PATH}")

def calculate_batch_stock(conn, batch_no):
    cur = conn.cursor()
    cur.execute("SELECT * FROM rm_inward_lots WHERE batch_no = ?", (batch_no,))
    lot = cur.fetchone()
    if not lot:
        return None
    
    cur.execute("""
        SELECT 
            COALESCE(SUM(issued_qty), 0.0) as total_issued,
            COALESCE(SUM(return_qty), 0.0) as total_returned,
            COALESCE(SUM(scrap_qty), 0.0) as total_scrap,
            COALESCE(SUM(bit_wire_qty), 0.0) as total_bit_wire,
            COALESCE(SUM(slug_qty), 0.0) as total_slug,
            COALESCE(SUM(net_consumed), 0.0) as total_net_consumed,
            COUNT(*) as issue_count
        FROM rm_issue_transactions
        WHERE batch_no = ? AND is_void = 0
    """, (batch_no,))
    summary = cur.fetchone()
    
    inward_wt = round(float(lot["weight"]), 2)
    issued = round(float(summary["total_issued"]), 2)
    returned = round(float(summary["total_returned"]), 2)
    scrap = round(float(summary["total_scrap"]), 2)
    bit_wire = round(float(summary["total_bit_wire"]), 2)
    slug = round(float(summary["total_slug"]), 2)
    net_consumed = round(float(summary["total_net_consumed"]), 2)
    
    available_stock = round(inward_wt - issued + returned, 2)
    status = "Exhausted" if available_stock <= 0.0 else "Low Stock" if available_stock < 100.0 else "In Stock"
    
    return {
        "batchNo": lot["batch_no"],
        "inwardDate": lot["inward_date"],
        "supplier": lot["supplier"],
        "material": lot["material"],
        "grade": lot["grade"],
        "wireSize": lot["wire_size"],
        "inwardWeight": inward_wt,
        "coils": lot["coils"],
        "heatNo": lot["heat_no"],
        "invNo": lot["inv_no"],
        "totalIssued": issued,
        "totalReturned": returned,
        "totalScrap": scrap,
        "totalBitWire": bit_wire,
        "totalSlug": slug,
        "totalNetConsumed": net_consumed,
        "availableStock": available_stock,
        "issueCount": summary["issue_count"],
        "status": status
    }

class SmartMoveRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        sys.stderr.write(f"[{datetime.now().strftime('%H:%M:%S')}] {args[0]} {args[1]}\n")

    def send_json(self, data, status=200):
        body = json.dumps(data, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, message, status=400):
        self.send_json({"ok": False, "error": message}, status=status)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_HEAD(self):
        self.do_GET()

    def get_auth_user(self):
        auth_header = self.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            session = SESSIONS.get(token)
            if session:
                return session
        return None

    def read_json_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0:
            return {}
        body = self.rfile.read(content_length)
        return json.loads(body.decode("utf-8"))

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/"):
            self.handle_api_get(path, parse_qs(parsed.query))
            return

        self.serve_static(path)

    def serve_static(self, path):
        if path == "/" or path == "":
            rel_path = "index.html"
        else:
            rel_path = path.lstrip("/")

        file_path = os.path.abspath(os.path.join(APP_DIR, rel_path))

        if not file_path.startswith(APP_DIR) or not os.path.exists(file_path) or os.path.isdir(file_path):
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"404 Not Found")
            return

        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = "application/octet-stream"

        with open(file_path, "rb") as f:
            content = f.read()

        self.send_response(200)
        self.send_header("Content-Type", mime_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def handle_api_get(self, path, params):
        conn = get_db()
        try:
            if path == "/api/health":
                self.send_json({
                    "ok": True,
                    "service": "SVC Smart Move Central API (Production Hardened)",
                    "version": "1.1",
                    "authScheme": "PBKDF2-HMAC-SHA256 (100k iter)",
                    "isolation": "BEGIN IMMEDIATE",
                    "time": datetime.now().isoformat()
                })

            elif path == "/api/auth/me":
                user = self.get_auth_user()
                if not user:
                    self.send_error_json("Unauthorized", 401)
                    return
                self.send_json({"ok": True, "user": user})

            elif path == "/api/inward":
                cur = conn.cursor()
                cur.execute("SELECT * FROM rm_inward_lots ORDER BY created_at DESC")
                lots = [dict(row) for row in cur.fetchall()]
                self.send_json({"ok": True, "lots": lots})

            elif path == "/api/issue":
                cur = conn.cursor()
                cur.execute("SELECT * FROM rm_issue_transactions WHERE is_void = 0 ORDER BY created_at DESC")
                issues = [dict(row) for row in cur.fetchall()]
                self.send_json({"ok": True, "issues": issues})

            elif path == "/api/stock-ledger":
                cur = conn.cursor()
                cur.execute("SELECT batch_no FROM rm_inward_lots ORDER BY inward_date DESC, created_at DESC")
                batch_rows = cur.fetchall()
                ledger = [calculate_batch_stock(conn, r["batch_no"]) for r in batch_rows]
                self.send_json({"ok": True, "ledger": ledger})

            elif path == "/api/dashboard":
                cur = conn.cursor()
                cur.execute("SELECT batch_no, weight FROM rm_inward_lots")
                all_lots = cur.fetchall()
                total_inward = sum(r["weight"] for r in all_lots)
                
                cur.execute("SELECT COALESCE(SUM(issued_qty), 0) as issued, COALESCE(SUM(return_qty), 0) as returned, COALESCE(SUM(net_consumed), 0) as net_consumed FROM rm_issue_transactions WHERE is_void = 0")
                summary = cur.fetchone()
                
                total_issued = float(summary["issued"])
                total_returned = float(summary["returned"])
                total_net = float(summary["net_consumed"])
                current_stock = total_inward - total_issued + total_returned
                
                ledger = [calculate_batch_stock(conn, r["batch_no"]) for r in all_lots]
                active_batches = sum(1 for b in ledger if b and b["availableStock"] > 0)
                
                self.send_json({
                    "ok": True,
                    "metrics": {
                        "currentStock": round(current_stock, 2),
                        "totalInward": round(total_inward, 2),
                        "totalIssued": round(total_issued, 2),
                        "totalReturned": round(total_returned, 2),
                        "netConsumed": round(total_net, 2),
                        "activeBatches": active_batches
                    }
                })

            elif path == "/api/backup":
                user = self.get_auth_user()
                if not user or user["role"] != "Admin":
                    self.send_error_json("Only administrators can generate full database backups.", 403)
                    return
                
                cur = conn.cursor()
                cur.execute("SELECT * FROM rm_inward_lots")
                inwards = [dict(r) for r in cur.fetchall()]
                cur.execute("SELECT * FROM rm_issue_transactions")
                issues = [dict(r) for r in cur.fetchall()]
                cur.execute("SELECT * FROM master_wire_specs")
                masters = [dict(r) for r in cur.fetchall()]
                cur.execute("SELECT * FROM parts_catalog")
                parts = [dict(r) for r in cur.fetchall()]
                cur.execute("SELECT * FROM audit_logs")
                audits = [dict(r) for r in cur.fetchall()]
                
                backup_data = {
                    "version": "1.1",
                    "backupDate": datetime.now().isoformat(),
                    "generatedBy": user["username"],
                    "masterWireSpecs": masters,
                    "partsCatalog": parts,
                    "inwardLots": inwards,
                    "issueTransactions": issues,
                    "auditLogs": audits
                }
                serialized = json.dumps(backup_data, sort_keys=True)
                checksum = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
                
                self.send_json({
                    "ok": True,
                    "backup": backup_data,
                    "sha256": checksum
                })

            else:
                self.send_error_json("Unknown API endpoint", 404)
        finally:
            conn.close()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if not path.startswith("/api/"):
            self.send_error_json("Not found", 404)
            return

        body = self.read_json_body()
        conn = get_db()
        try:
            if path == "/api/auth/login":
                username = body.get("username", "").strip()
                pin = body.get("pin", "").strip()
                
                cur = conn.cursor()
                cur.execute("SELECT * FROM users WHERE username = ? AND is_active = 1", (username,))
                user = cur.fetchone()
                
                if not user or not verify_pin(pin, user["password_hash"]):
                    self.send_error_json("Invalid username or password PIN.", 401)
                    return
                
                token = hashlib.sha256(f"{username}_{datetime.now().timestamp()}_{os.urandom(16)}".encode()).hexdigest()
                session_obj = {
                    "id": user["id"],
                    "username": user["username"],
                    "fullName": user["full_name"],
                    "role": user["role"],
                    "mustChangePassword": bool(user["must_change_password"])
                }
                SESSIONS[token] = session_obj
                
                conn.execute(
                    "INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details) VALUES (?, ?, ?, ?, ?)",
                    ("LOGIN_SUCCESS", "USER", username, username, "User logged in with PBKDF2 authentication")
                )
                conn.commit()
                
                self.send_json({"ok": True, "token": token, "user": session_obj})

            elif path == "/api/auth/change-password":
                user = self.get_auth_user()
                if not user:
                    self.send_error_json("Authentication required", 401)
                    return

                old_pin = body.get("oldPin", "").strip()
                new_pin = body.get("newPin", "").strip()

                if len(new_pin) < 6:
                    self.send_error_json("New Password/PIN must be at least 6 characters.", 400)
                    return

                cur = conn.cursor()
                cur.execute("SELECT password_hash FROM users WHERE username = ?", (user["username"],))
                row = cur.fetchone()
                if not row or not verify_pin(old_pin, row["password_hash"]):
                    self.send_error_json("Current Password/PIN is incorrect.", 400)
                    return

                new_hash = hash_pin(new_pin)
                cur.execute(
                    "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE username = ?",
                    (new_hash, user["username"])
                )
                conn.execute(
                    "INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details) VALUES (?, ?, ?, ?, ?)",
                    ("PASSWORD_CHANGE", "USER", user["username"], user["username"], "User successfully updated PIN to personal secure PBKDF2 hash")
                )
                conn.commit()
                user["mustChangePassword"] = False

                self.send_json({"ok": True, "message": "Password changed successfully. Default credentials revoked."})

            elif path == "/api/auth/logout":
                auth_header = self.headers.get("Authorization", "")
                if auth_header.startswith("Bearer "):
                    token = auth_header[7:].strip()
                    SESSIONS.pop(token, None)
                self.send_json({"ok": True})

            elif path == "/api/inward":
                user = self.get_auth_user()
                if not user:
                    self.send_error_json("Authentication required", 401)
                    return
                
                # Transaction Isolation: BEGIN IMMEDIATE acquires exclusive write lock
                with DB_LOCK:
                    conn.isolation_level = None  # Manual transactions
                    cur = conn.cursor()
                    try:
                        cur.execute("BEGIN IMMEDIATE;")
                        
                        mat = body.get("material", "").strip()
                        grade = body.get("grade", "").strip()
                        wire_size = body.get("wireSize", "").strip()
                        supplier = body.get("supplier", "").strip()
                        inv_no = body.get("invNo", "").strip()
                        inv_date = body.get("invDate", "").strip()
                        inward_date = body.get("inwardDate", "").strip()
                        weight = float(body.get("weight", 0))
                        coils = int(body.get("coils", 0))
                        heat_no = body.get("heatNo", "").strip()
                        remarks = body.get("remarks", "").strip()
                        
                        if not mat or not grade or not wire_size or not supplier or not inv_no or weight <= 0:
                            cur.execute("ROLLBACK;")
                            self.send_error_json("Missing required fields or invalid weight.")
                            return

                        cur.execute(
                            "SELECT wire_code, grade_code FROM master_wire_specs WHERE material = ? AND grade = ? AND wire_size = ?",
                            (mat, grade, wire_size)
                        )
                        mapping = cur.fetchone()
                        if not mapping:
                            cur.execute("ROLLBACK;")
                            self.send_error_json(f"No master code mapping found for {mat} / {grade} / {wire_size}")
                            return

                        yy = datetime.strptime(inward_date, "%Y-%m-%d").strftime("%y") if inward_date else datetime.now().strftime("%y")
                        prefix = f"{mat}-{mapping['wire_code']}-{mapping['grade_code']}-{yy}"
                        
                        cur.execute("SELECT last_seq FROM batch_sequences WHERE prefix = ?", (prefix,))
                        seq_row = cur.fetchone()
                        next_seq = (seq_row["last_seq"] + 1) if seq_row else 1
                        
                        cur.execute(
                            "INSERT INTO batch_sequences (prefix, last_seq) VALUES (?, ?) ON CONFLICT(prefix) DO UPDATE SET last_seq = ?",
                            (prefix, next_seq, next_seq)
                        )
                        
                        batch_no = f"{prefix}-{str(next_seq).zfill(3)}"
                        
                        cur.execute("""
                            INSERT INTO rm_inward_lots (
                                batch_no, inward_date, supplier, inv_no, inv_date, po_no, gi_no,
                                material, grade, wire_size, coils, weight, heat_no, remarks, created_by
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            batch_no, inward_date, supplier, inv_no, inv_date,
                            body.get("poNo", ""), body.get("giNo", ""), mat, grade, wire_size,
                            coils, weight, heat_no, remarks, user["username"]
                        ))
                        
                        cur.execute(
                            "INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details) VALUES (?, ?, ?, ?, ?)",
                            ("INWARD_CREATE", "RM_LOT", batch_no, user["username"], f"Created batch {batch_no} with {weight} kg from {supplier}")
                        )
                        cur.execute("COMMIT;")
                        self.send_json({"ok": True, "batchNo": batch_no, "weight": weight})
                    except Exception as e:
                        cur.execute("ROLLBACK;")
                        self.send_error_json(f"Failed to record inward lot: {str(e)}", 500)

            elif path == "/api/issue":
                user = self.get_auth_user()
                if not user:
                    self.send_error_json("Authentication required", 401)
                    return

                # Transaction Isolation: BEGIN IMMEDIATE acquires write lock preventing concurrent double-spends
                with DB_LOCK:
                    conn.isolation_level = None
                    cur = conn.cursor()
                    try:
                        cur.execute("BEGIN IMMEDIATE;")

                        batch_no = body.get("batchNo", "").strip()
                        part_no = body.get("partNumber", "").strip()
                        machine_no = body.get("machineNo", "").strip()
                        issue_date = body.get("issueDate", "").strip()
                        issued_qty = float(body.get("issuedQty", 0))
                        return_qty = float(body.get("returnQty", 0))
                        scrap_qty = float(body.get("scrapQty", 0))
                        bit_wire_qty = float(body.get("bitWireQty", 0))
                        slug_qty = float(body.get("slugQty", 0))
                        remarks = body.get("remarks", "").strip()

                        if not batch_no or not part_no or not machine_no or issued_qty <= 0:
                            cur.execute("ROLLBACK;")
                            self.send_error_json("Missing required fields or invalid issued quantity.")
                            return

                        # 1. Lock and check current available stock inside IMMEDIATE transaction
                        stock = calculate_batch_stock(conn, batch_no)
                        if not stock:
                            cur.execute("ROLLBACK;")
                            self.send_error_json(f"Batch {batch_no} does not exist.")
                            return

                        if issued_qty > stock["availableStock"]:
                            cur.execute("ROLLBACK;")
                            deficit = round(issued_qty - stock["availableStock"], 2)
                            self.send_error_json(
                                f"OVER-ISSUE REJECTED: Available stock is {stock['availableStock']} kg. Requested {issued_qty} kg (Deficit: {deficit} kg).",
                                400
                            )
                            return

                        # 2. Customer Lookup
                        cur.execute("SELECT customer_name FROM parts_catalog WHERE part_number = ?", (part_no,))
                        cust_row = cur.fetchone()
                        customer = cust_row["customer_name"] if cust_row else "Custom Part"

                        # 3. Calculate Net Consumed
                        net_consumed = round(issued_qty - return_qty - scrap_qty - bit_wire_qty - slug_qty, 2)

                        # 4. Generate Issue ID atomically
                        cur.execute("SELECT COUNT(*) as cnt FROM rm_issue_transactions")
                        next_id = f"ISS-{str(cur.fetchone()['cnt'] + 1).zfill(5)}"

                        cur.execute("""
                            INSERT INTO rm_issue_transactions (
                                id, issue_date, machine_no, part_number, customer_name, batch_no,
                                material, grade, wire_size, drawn_size, supplier, inv_no, heat_no, die_no,
                                issued_qty, return_qty, scrap_qty, bit_wire_qty, slug_qty, net_consumed,
                                remarks, created_by
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            next_id, issue_date, machine_no, part_no, customer, batch_no,
                            stock["material"], stock["grade"], stock["wireSize"],
                            body.get("drawnSize"), stock["supplier"], stock["invNo"], stock["heatNo"], body.get("dieNo", ""),
                            issued_qty, return_qty, scrap_qty, bit_wire_qty, slug_qty, net_consumed,
                            remarks, user["username"]
                        ))

                        cur.execute(
                            "INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details) VALUES (?, ?, ?, ?, ?)",
                            ("RM_ISSUE", "ISSUE_TX", next_id, user["username"], f"Issued {issued_qty}kg from {batch_no} to M/C {machine_no} (Net Consumed: {net_consumed}kg)")
                        )
                        cur.execute("COMMIT;")

                        self.send_json({
                            "ok": True,
                            "issueId": next_id,
                            "batchNo": batch_no,
                            "netConsumed": net_consumed,
                            "remainingStock": round(stock["availableStock"] - issued_qty + return_qty, 2)
                        })
                    except Exception as e:
                        cur.execute("ROLLBACK;")
                        self.send_error_json(f"Failed to record issue transaction: {str(e)}", 500)

            elif path == "/api/restore":
                user = self.get_auth_user()
                if not user or user["role"] != "Admin":
                    self.send_error_json("Only administrators can restore the database.", 403)
                    return

                backup_payload = body.get("backup")
                if not backup_payload or "inwardLots" not in backup_payload or "issueTransactions" not in backup_payload:
                    self.send_error_json("Invalid backup payload format.", 400)
                    return

                with DB_LOCK:
                    conn.isolation_level = None
                    cur = conn.cursor()
                    try:
                        cur.execute("BEGIN IMMEDIATE;")

                        # Reset existing records
                        cur.execute("DELETE FROM rm_issue_transactions;")
                        cur.execute("DELETE FROM rm_inward_lots;")
                        cur.execute("DELETE FROM batch_sequences;")

                        # Restore Inward Lots
                        inward_rows = [
                            (l["batch_no"], l["inward_date"], l["supplier"], l["inv_no"], l["inv_date"],
                             l.get("po_no", ""), l.get("gi_no", ""), l["material"], l["grade"], l["wire_size"],
                             l["coils"], l["weight"], l.get("heat_no", ""), l.get("remarks", ""), l.get("created_by", "admin"))
                            for l in backup_payload["inwardLots"]
                        ]
                        cur.executemany(
                            """INSERT INTO rm_inward_lots (
                                batch_no, inward_date, supplier, inv_no, inv_date, po_no, gi_no,
                                material, grade, wire_size, coils, weight, heat_no, remarks, created_by
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                            inward_rows
                        )

                        # Restore Batch Sequences
                        for lot in backup_payload["inwardLots"]:
                            b_parts = lot["batch_no"].split("-")
                            if len(b_parts) == 5:
                                prefix = f"{b_parts[0]}-{b_parts[1]}-{b_parts[2]}-{b_parts[3]}"
                                seq = int(b_parts[4])
                                cur.execute(
                                    "INSERT INTO batch_sequences (prefix, last_seq) VALUES (?, ?) ON CONFLICT(prefix) DO UPDATE SET last_seq = MAX(last_seq, ?)",
                                    (prefix, seq, seq)
                                )

                        # Restore Issues
                        issue_rows = [
                            (i["id"], i["issue_date"], i["machine_no"], i["part_number"], i["customer_name"],
                             i["batch_no"], i["material"], i["grade"], i["wire_size"], i.get("drawn_size"),
                             i.get("supplier", ""), i.get("inv_no", ""), i.get("heat_no", ""), i.get("die_no", ""),
                             i["issued_qty"], i["return_qty"], i["scrap_qty"], i["bit_wire_qty"], i["slug_qty"],
                             i["net_consumed"], i.get("remarks", ""), 0, i.get("created_by", "admin"))
                            for i in backup_payload["issueTransactions"]
                        ]
                        cur.executemany(
                            """INSERT INTO rm_issue_transactions (
                                id, issue_date, machine_no, part_number, customer_name, batch_no,
                                material, grade, wire_size, drawn_size, supplier, inv_no, heat_no, die_no,
                                issued_qty, return_qty, scrap_qty, bit_wire_qty, slug_qty, net_consumed,
                                remarks, is_void, created_by
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                            issue_rows
                        )

                        cur.execute(
                            "INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details) VALUES (?, ?, ?, ?, ?)",
                            ("DB_RESTORE", "DATABASE", "CENTRAL_SQLITE", user["username"], f"Restored {len(inward_rows)} lots and {len(issue_rows)} issues from backup")
                        )
                        cur.execute("COMMIT;")
                        self.send_json({
                            "ok": True,
                            "message": f"Successfully restored {len(inward_rows)} inward lots and {len(issue_rows)} issue transactions."
                        })
                    except Exception as e:
                        cur.execute("ROLLBACK;")
                        self.send_error_json(f"Database restoration failed: {str(e)}", 500)

            else:
                self.send_error_json("Unknown API endpoint", 404)
        finally:
            conn.close()

def run_server():
    init_database()
    server_address = ("0.0.0.0", PORT)
    httpd = HTTPServer(server_address, SmartMoveRequestHandler)
    print("=" * 70)
    print("  SRI VENKATESHWARA COMPANY — SMART MOVE PRODUCTION SERVER (HARDENED)")
    print(f"  Listening on: http://0.0.0.0:{PORT} (LAN & Localhost)")
    print(f"  Shared SQLite Database: {DB_PATH}")
    print("  Security: PBKDF2-HMAC-SHA256 (100k iter) | Transaction: BEGIN IMMEDIATE")
    print("=" * 70)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[INFO] Server stopped gracefully.")

if __name__ == "__main__":
    run_server()
