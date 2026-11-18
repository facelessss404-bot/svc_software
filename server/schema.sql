-- SVC Smart Move: Phase 1 Database Schema (SQLite / PostgreSQL / MySQL)
-- Sri Venkateswara Company (SVC), Coimbatore
-- Raw Material (Wire Stock) Management

PRAGMA foreign_keys = ON;

-- 1. Users & Authentication
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('Admin', 'Operator', 'Viewer')),
    must_change_password INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Wire Specification Master (49 canonical wire/grade codes from Main_Data)
CREATE TABLE IF NOT EXISTS master_wire_specs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material TEXT NOT NULL,
    grade TEXT NOT NULL,
    wire_size TEXT NOT NULL,       -- Trailing dot preserved (e.g. '5.50.', '4.50(DA).', '9.85.')
    wire_code TEXT NOT NULL,       -- Single/double letter code (e.g. 'M', 'AA')
    grade_code TEXT NOT NULL,      -- Single letter code (e.g. 'a', 'e')
    template_batch TEXT NOT NULL,  -- Template (e.g. 'MS-M-a-000')
    preferred_supplier TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(material, grade, wire_size)
);

-- 3. Parts Catalog Master (443 active part-to-customer mappings from Main List)
CREATE TABLE IF NOT EXISTS parts_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    material TEXT,
    part_type TEXT,
    from_size TEXT,
    is_active INTEGER NOT NULL DEFAULT 1
);

-- 4. Inward Lots Table (Raw Material Wire Received into Store)
CREATE TABLE IF NOT EXISTS rm_inward_lots (
    batch_no TEXT PRIMARY KEY,     -- Generated: [MAT]-[WIRE]-[GRADE]-[YY]-[SEQ]
    inward_date DATE NOT NULL,
    supplier TEXT NOT NULL,
    inv_no TEXT NOT NULL,
    inv_date DATE NOT NULL,
    po_no TEXT,
    gi_no TEXT,
    material TEXT NOT NULL,
    grade TEXT NOT NULL,
    wire_size TEXT NOT NULL,
    coils INTEGER NOT NULL CHECK(coils >= 0),
    weight REAL NOT NULL CHECK(weight > 0),
    heat_no TEXT,
    remarks TEXT,
    created_by TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(username)
);

-- 5. Batch Sequence Tracking (Guarantees atomic, gapless sequence allocation)
CREATE TABLE IF NOT EXISTS batch_sequences (
    prefix TEXT PRIMARY KEY,       -- e.g. 'MS-M-a-26'
    last_seq INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Machine Issue Transactions (Raw Material Issued to Cold-Forging Machines)
CREATE TABLE IF NOT EXISTS rm_issue_transactions (
    id TEXT PRIMARY KEY,           -- e.g. 'ISS-00001'
    issue_date DATE NOT NULL,
    machine_no TEXT NOT NULL,
    part_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    batch_no TEXT NOT NULL,
    material TEXT NOT NULL,
    grade TEXT NOT NULL,
    wire_size TEXT NOT NULL,
    drawn_size REAL,
    supplier TEXT,
    inv_no TEXT,
    heat_no TEXT,
    die_no TEXT,
    issued_qty REAL NOT NULL CHECK(issued_qty > 0),
    return_qty REAL NOT NULL DEFAULT 0.0 CHECK(return_qty >= 0),
    scrap_qty REAL NOT NULL DEFAULT 0.0 CHECK(scrap_qty >= 0),
    bit_wire_qty REAL NOT NULL DEFAULT 0.0 CHECK(bit_wire_qty >= 0),
    slug_qty REAL NOT NULL DEFAULT 0.0 CHECK(slug_qty >= 0),
    net_consumed REAL NOT NULL,    -- Backend formula: issued - return - scrap - bit_wire - slug
    remarks TEXT,
    is_void INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(batch_no) REFERENCES rm_inward_lots(batch_no),
    FOREIGN KEY(created_by) REFERENCES users(username)
);

-- 7. System Audit Log (Immutable factory audit trail)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    user_id TEXT NOT NULL,
    details TEXT,
    ip_address TEXT
);

-- Indices for rapid querying and stock calculation
CREATE INDEX IF NOT EXISTS idx_inward_date ON rm_inward_lots(inward_date);
CREATE INDEX IF NOT EXISTS idx_issue_batch ON rm_issue_transactions(batch_no);
CREATE INDEX IF NOT EXISTS idx_issue_date ON rm_issue_transactions(issue_date);
CREATE INDEX IF NOT EXISTS idx_issue_machine ON rm_issue_transactions(machine_no);
CREATE INDEX IF NOT EXISTS idx_parts_no ON parts_catalog(part_number);

