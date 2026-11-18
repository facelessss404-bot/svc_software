# SVC Smart Move — Phase 1: RM Inward & RM Issue (Wire Stock Only)

**Client:** Sri Venkateswara Company (SVC), Coimbatore  
**Application:** Smart Move Manufacturing System — Phase 1 Intranet Edition  
**Platform:** On-Premise LAN / Windows Server 2012 Ready (100% Offline Compatible)  
**Target Environment:** Local Intranet (No mandatory cloud or external internet required)

---

## 1. Executive Summary

This software application replaces the legacy, macro-failing Excel spreadsheets (`RM Inward-- oct.xlsm` and `RM issue and Production Entry--oct.xlsm`) with a production-grade, local-first web application engineered strictly for **Raw Material Wire Stock Management**.

### Key Deliverables in Phase 1:
1. **RM Inward Module:** Multi-coil receipt, dynamic cascading master lookup (`Material` $\rightarrow$ `Grade` $\rightarrow$ `Wire Size`), physical measurements entry, and automatic, deterministic **Batch Number Generation** (`[MAT]-[WIRE_CODE]-[GRADE_CODE]-[YY]-[SEQ]`).
2. **RM Issue Module:** Cold-forging machine issue entry directly matching the client's shop-floor form. Live automatic lookup of **Customer** from Part Number (443 parts), live automatic specification retrieval from Inward Batch, and live arithmetic for **Net Consumed** ($Issued - Return - Scrap - BitWire - Slug$).
3. **Strict Negative Stock Prevention:** Real-time client & backend guards preventing any issue quantity from exceeding the lot's available balance.
4. **Lot-by-Lot Balance Ledger:** Replaces Excel `Balance check` with a real-time reconciliation engine ($Available = Inward - Issued + Returned$) and complete one-click issue traceability drilldown.
5. **Master Data Integrity:** All 49 wire sizes from `Main_Data` preserved byte-for-byte, including critical trailing dot distinctions (`5.50.` vs `5.50`, `4.50(DA).` vs `4.50(DA)`, `9.85.` vs `9.85`).
6. **Persistence & Security:** Role-based access control (`Admin`, `Operator`, `Viewer`), session preservation, automated audit trail, and zero-dependency offline backup/restore (JSON & CSV).

---

## 2. Quick Start & Production LAN Deployment Guide

### Canonical Production Server (Recommended for Windows Server 2012)
The application uses a zero-dependency **Python 3 Standard Library SQLite Server** (`server/server.py`) as the canonical backend. It serves both the static web frontend and the central REST API with strict ACID transactions on port `8080`.

1. **Launch Server:**
   Double-click `start-server.bat` in the root folder, or run:
   ```cmd
   python server\server.py
   ```
2. **Access Workstations Across Factory LAN:**
   - On Server host: `http://localhost:8080`
   - On Shop-floor PCs / Tablets: `http://<SERVER-IP>:8080`
3. **Windows Firewall Configuration (Run as Administrator on Windows Server):**
   ```cmd
   netsh advfirewall firewall add rule name="SVC Smart Move Port 8080" dir=in action=allow protocol=TCP localport=8080
   ```

### Default Factory Credentials
| Role | Username | Default PIN | Permissions | First Login Action |
| :--- | :--- | :--- | :--- | :--- |
| **Plant Manager** | `admin` | `admin123` | Full Access (Inward, Issue, Reconcile, Backup/Restore) | Mandatory Password Change Enforced |
| **Store Supervisor** | `operator` | `store123` | Shop-floor Inward & Issue entry | Mandatory Password Change Enforced |
| **Plant Auditor** | `viewer` | `view123` | Read-only Stock Ledger & Dashboards | Read-only |

*Note: All passwords are protected using salted `PBKDF2-HMAC-SHA256` with 100,000 iterations and a cryptographically secure 16-byte random salt.*

---

## 3. Production Hardening & Architectural Guarantees

1. **Central Shared Database:** All workstations write to a single ACID SQLite database at `server/data/svc_smartmove.db`.
2. **Immediate Transaction Isolation (`BEGIN IMMEDIATE`):** Prevents concurrent double-spend race conditions. When two operators issue stock simultaneously, the database serializes requests; exactly one succeeds and the second is rejected with `OVER-ISSUE REJECTED` if stock is exhausted.
3. **Zero Silent Local Divergence:** When running in LAN/server mode (`http://`), the application blocks writes if the central server is disconnected, preventing divergent local records.
4. **Cryptographic Backups:** One-click full JSON database backups (`GET /api/backup`) with SHA-256 cryptographic checksums, and transactional restoration (`POST /api/restore`).
5. **Restart Recovery:** All data, batch sequences, and audit logs persist across server shutdown and reboots.

---

## 3. Core Workflow Guide

### A. RM Inward Entry & Batch Allocation
1. Navigate to **RM Inward** (`#inward`).
2. Enter the receipt date, supplier name (with auto-suggest datalist), supplier invoice number, and invoice date.
3. Select **Material** (e.g. `MS`, `SS`, `AL`, `BR`, `CU`).
4. Select **Grade** (dynamically filtered by Material, e.g. `1010`, `1035`, `15B25`).
5. Select **Wire Size** (dynamically filtered by Grade, e.g. `7.88`).
6. Observe the **Automatic Batch Generation Preview**:
   - Displays wire code (e.g. `M`), grade code (e.g. `a`), and next sequential lot counter (`MS-M-a-26-002`).
7. Enter net inward weight in kg, number of coils, and heat/TC number.
8. Click **Save Inward & Generate Batch No**. The lot is permanently recorded and available for machine issue.

### B. RM Issue to Cold-Forging Machines
1. Navigate to **RM Issue** (`#issue`).
2. Enter Issue Date and Machine Number (e.g. `6`, `12`, `FG01`).
3. Select or type **Part Number** (e.g. `2760160`).
   - Customer name (e.g. `RAMBAL`) is immediately retrieved and displayed from `Main List`.
4. Select the **Inward Batch Number** from active stock.
   - Wire specifications (`Material`, `Grade`, `Wire Size`, `Supplier`, `Inv No`, `Heat No`, and `Available Stock`) auto-fill automatically.
5. Enter **RM Issued Qty (kg)**.
   - If the entered quantity exceeds available stock, an instant over-issue warning is displayed and saving is blocked.
6. Enter returned unused wire, scrap, bit wire, and slugs.
   - **Net Wire Consumed** ($Issued - Return - Scrap - BitWire - Slug$) updates dynamically in real-time.
   - **Remaining Batch Balance** ($Available - Issued + Return$) updates dynamically in real-time.
7. Click **Save Issue Transaction** (or **Quick Repeat** to rapidly log consecutive issues for the same shift).

### C. Stock Balance Reconciliation & Traceability
1. Navigate to **Stock Ledger** (`#ledger`).
2. Search by Batch Number, Supplier, Material, or Grade.
3. View the live reconciled balance for every inward lot:
   - Initial Inward Weight
   - Total Issued to Machines
   - Total Returned Unused
   - Total Net Consumed into Rivets
   - Usable Wire Remaining in Store
   - Lot Status (`In Stock`, `Low Stock`, `Exhausted`)
4. Click **Trace** on any lot to drill down into every machine issue transaction recorded against that batch.
5. Click **Export CSV** to download the complete stock reconciliation audit sheet.

---

## 4. Verification & Testing

Automated end-to-end browser testing was executed using Playwright MCP:
- **Authentication & RBAC:** Passed
- **Master Data Mapping & Dot Preservation:** Passed (49 master items, 443 parts)
- **Automatic Batch Sequence Generation:** Passed (`MS-M-a-26-002`, `MS-M-a-26-003`)
- **Part $\rightarrow$ Customer Auto-lookup:** Passed (`2760160` $\rightarrow$ `RAMBAL`)
- **Batch $\rightarrow$ Inward Specs Auto-fill:** Passed
- **Strict Negative Stock Prevention:** Passed (over-issue blocked with error notification)
- **Mathematical Reconciliation:** Passed ($1500 - 400 + 40 = 1140.00\text{ kg}$)
- **Offline Storage Persistence:** Passed across full page reload
- **Visual Capture:** High-resolution screenshots generated in `screenshots/`.

