import sqlite3
import hashlib
import os

db_path = os.path.join(os.path.dirname(__file__), "data", "svc_smartmove.db")
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# 1. Clean transactions from test runs
cur.execute("DELETE FROM rm_issue_transactions;")
cur.execute("DELETE FROM rm_inward_lots WHERE batch_no NOT IN ('MS-M-a-26-001', 'MS-D-a-26-001', 'MS-F-a-26-001', 'MS-C-a-26-001', 'BR-C-j-26-001', 'SS-A-h-26-001');")
cur.execute("UPDATE batch_sequences SET last_seq = 1;")

# 2. Reset users to factory default credentials with PBKDF2 hashes & must_change_password = 1
def make_pbkdf2(pin):
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt, 100000)
    return f"pbkdf2:sha256:100000${salt.hex()}${key.hex()}"

cur.execute("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE username = 'admin'", (make_pbkdf2("admin123"),))
cur.execute("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE username = 'operator'", (make_pbkdf2("store123"),))
cur.execute("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE username = 'viewer'", (make_pbkdf2("view123"),))

conn.commit()

cur.execute("SELECT count(*), sum(weight) FROM rm_inward_lots")
lots_res = cur.fetchone()
cur.execute("SELECT count(*) FROM rm_issue_transactions")
issue_cnt = cur.fetchone()[0]
conn.close()

print(f"CLEAN_STATE: lots={lots_res[0]}, weight={lots_res[1]}, issues={issue_cnt}")

