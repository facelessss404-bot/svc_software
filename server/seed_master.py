import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "data", "svc_smartmove.db")
conn = sqlite3.connect(db_path)
cur = conn.cursor()

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

cur.executemany(
    "INSERT OR IGNORE INTO master_wire_specs (material, grade, wire_size, wire_code, grade_code, template_batch, preferred_supplier) VALUES (?, ?, ?, ?, ?, ?, ?)",
    CANONICAL_MASTER_DATA
)
conn.commit()

cur.execute("SELECT count(*) FROM master_wire_specs")
cnt = cur.fetchone()[0]
conn.close()
print(f"MASTER_WIRE_SPECS_COUNT={cnt}")

