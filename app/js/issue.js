// SVC Smart Move - Phase 1: RM Issue View & Controller
// Directly replaces the failing Excel macro form shown in the client's WhatsApp screenshot.

class IssueModule {
  constructor(app) {
    this.app = app;
    this.searchQuery = '';
    this.machineFilter = '';
    this.dateFilter = '';
    this.currentPage = 1;
    this.pageSize = 10;
  }

  init() {
    this.renderForm();
    this.renderRegister();
    this.bindEvents();
  }

  refreshBatchDropdown() {
    const select = document.getElementById('issue-batch-no');
    if (!select) return;
    const currentVal = select.value;
    const batches = db.getActiveBatchesWithStock().filter(b => b.availableStock > 0);
    select.innerHTML = '<option value="">-- Select Active Batch No --</option>' + 
      batches.map(b => `
        <option value="${b.batchNo}">
          ${b.batchNo} | ${b.material} ${b.grade} ${b.wireSize} (Available: ${b.availableStock.toFixed(2)} kg)
        </option>
      `).join('');
    if (currentVal && batches.some(b => b.batchNo === currentVal)) {
      select.value = currentVal;
    }
  }

  renderForm() {
    const container = document.getElementById('issue-form-container');
    if (!container) return;

    const parts = db.getPartsCatalog();
    const batches = db.getActiveBatchesWithStock().filter(b => b.availableStock > 0);
    const today = new Date().toISOString().split('T')[0];

    const machines = [
      '1', '2', '3', '6', '7', '9', '10', '11', '16', '17', '18', '20', 
      '24', '25', '26', '27', '30', '31', 'FG01', 'FG02', 'FG10', 'FG30'
    ];

    container.innerHTML = `
      <form id="rm-issue-form" class="industrial-form">
        <!-- Section 1: Header / Assignment -->
        <div class="form-section-title">
          <span class="step-badge">1</span>
          <h3>Machine Assignment & Part Lookup (Main List Mapping)</h3>
        </div>
        <div class="form-grid cols-3">
          <div class="form-group">
            <label for="issue-date">Issue Date <span class="req">*</span></label>
            <input type="date" id="issue-date" name="issueDate" value="${today}" required class="form-control" />
          </div>

          <div class="form-group">
            <label for="issue-machine-no">Machine No (M/C) <span class="req">*</span></label>
            <input type="text" id="issue-machine-no" name="machineNo" list="machine-datalist" placeholder="e.g. 6, 7, FG01" required class="form-control" />
            <datalist id="machine-datalist">
              ${machines.map(m => `<option value="${m}"></option>`).join('')}
            </datalist>
          </div>

          <div class="form-group">
            <label for="issue-part-number">Part Number (Drawing No) <span class="req">*</span></label>
            <input type="text" id="issue-part-number" name="partNumber" list="parts-datalist" placeholder="Type or select Part Number" required class="form-control" autocomplete="off" />
            <datalist id="parts-datalist">
              ${parts.map(p => `<option value="${p.partNumber}">${p.partNumber} (${p.customer})</option>`).join('')}
            </datalist>
          </div>
        </div>

        <!-- Live Auto-filled Customer Card -->
        <div class="auto-lookup-card mt-3">
          <div class="lookup-item">
            <span class="lookup-label">AUTO-MAPPED CUSTOMER (FROM MAIN LIST):</span>
            <span id="issue-customer-display" class="lookup-value text-gold">Select Part Number above</span>
          </div>
        </div>

        <!-- Section 2: Batch Selection & Automatic Lot Specification -->
        <div class="form-section-title mt-4">
          <span class="step-badge">2</span>
          <h3>Raw Material Batch Selection (Inward Lot Specification)</h3>
        </div>
        <div class="form-grid cols-3">
          <div class="form-group">
            <label for="issue-batch-no">Inward Batch Number <span class="req">*</span></label>
            <select id="issue-batch-no" name="batchNo" required class="form-control">
              <option value="">-- Select Active Batch No --</option>
              ${batches.map(b => `
                <option value="${b.batchNo}">
                  ${b.batchNo} | ${b.material} ${b.grade} ${b.wireSize} (Available: ${b.availableStock.toFixed(2)} kg)
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label for="issue-drawn-size">Drawn Size (mm)</label>
            <input type="number" step="0.01" id="issue-drawn-size" name="drawnSize" placeholder="e.g. 4.62" class="form-control" />
          </div>

          <div class="form-group">
            <label for="issue-die-no">Die No (Tool Reference)</label>
            <input type="text" id="issue-die-no" name="dieNo" placeholder="e.g. WD198, WD167" class="form-control" />
          </div>
        </div>

        <!-- Read-Only Retrieved Inward Batch Details -->
        <div id="batch-details-card" class="batch-details-grid mt-3 hidden">
          <div class="detail-pill">
            <span class="label">Material</span>
            <strong id="disp-batch-material">-</strong>
          </div>
          <div class="detail-pill">
            <span class="label">Grade</span>
            <strong id="disp-batch-grade">-</strong>
          </div>
          <div class="detail-pill">
            <span class="label">Wire Size</span>
            <strong id="disp-batch-wire-size">-</strong>
          </div>
          <div class="detail-pill">
            <span class="label">Supplier</span>
            <strong id="disp-batch-supplier">-</strong>
          </div>
          <div class="detail-pill">
            <span class="label">Invoice No</span>
            <strong id="disp-batch-inv-no">-</strong>
          </div>
          <div class="detail-pill">
            <span class="label">Heat No</span>
            <strong id="disp-batch-heat-no">-</strong>
          </div>
          <div class="detail-pill highlight">
            <span class="label">Current Store Available</span>
            <strong id="disp-batch-avail-kg" class="text-success">0.00 kg</strong>
          </div>
        </div>

        <!-- Section 3: Quantity Entry & Waste Categorization -->
        <div class="form-section-title mt-4">
          <span class="step-badge">3</span>
          <h3>Quantity Issue, Return & Scrap (Weight in kg)</h3>
        </div>
        <div class="form-grid cols-3">
          <div class="form-group">
            <label for="issue-qty">RM Issued Qty (kg) <span class="req">*</span></label>
            <input type="number" step="0.01" min="0.01" id="issue-qty" name="issuedQty" placeholder="e.g. 48.30" required class="form-control" />
            <small id="stock-error-msg" class="field-error hidden"></small>
          </div>

          <div class="form-group">
            <label for="issue-return-qty">RM Return (Unused Wire to Store) (kg)</label>
            <input type="number" step="0.01" min="0" id="issue-return-qty" name="returnQty" placeholder="0.00" value="0.00" class="form-control" />
          </div>

          <div class="form-group">
            <label for="issue-scrap-qty">Scrap (Process Scrap) (kg)</label>
            <input type="number" step="0.01" min="0" id="issue-scrap-qty" name="scrapQty" placeholder="0.00" value="0.00" class="form-control" />
          </div>

          <div class="form-group">
            <label for="issue-bitwire-qty">Bit Wire (Coil Tails) (kg)</label>
            <input type="number" step="0.01" min="0" id="issue-bitwire-qty" name="bitWireQty" placeholder="0.00" value="0.00" class="form-control" />
          </div>

          <div class="form-group">
            <label for="issue-slug-qty">Slug (Piercing / Trim) (kg)</label>
            <input type="number" step="0.01" min="0" id="issue-slug-qty" name="slugQty" placeholder="0.00" value="0.00" class="form-control" />
          </div>

          <div class="form-group">
            <label for="issue-remarks">Shift / Issue Remarks</label>
            <input type="text" id="issue-remarks" name="remarks" placeholder="Optional notes" class="form-control" />
          </div>
        </div>

        <!-- Live Backend Calculated Preview Card -->
        <div class="calculation-summary-card mt-3">
          <div class="calc-row">
            <div>
              <span class="calc-label">NET WIRE CONSUMED (INTO RIVETS):</span>
              <p class="calc-subtext">Formula: Issued - Return - Scrap - BitWire - Slug</p>
            </div>
            <div class="calc-value"><span id="calc-net-consumed">0.00</span> kg</div>
          </div>
          <div class="calc-row border-top">
            <div>
              <span class="calc-label">ESTIMATED BATCH REMAINING BALANCE:</span>
              <p class="calc-subtext">Formula: Initial Available - Issued + Return</p>
            </div>
            <div class="calc-value"><span id="calc-remaining-balance" class="text-success">0.00</span> kg</div>
          </div>
        </div>

        <div class="form-actions mt-4">
          <button type="submit" id="btn-save-issue" class="btn btn-primary">
            <svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
            Save Issue Transaction
          </button>
          <button type="button" id="btn-quick-repeat-issue" class="btn btn-accent">
            Save & Add Another (Quick Repeat)
          </button>
          <button type="reset" id="btn-reset-issue" class="btn btn-secondary">Clear</button>
        </div>
      </form>
    `;
  }

  bindEvents() {
    const partInput = document.getElementById('issue-part-number');
    const batchSelect = document.getElementById('issue-batch-no');
    const form = document.getElementById('rm-issue-form');
    const quickBtn = document.getElementById('btn-quick-repeat-issue');

    // Part Number $\rightarrow$ Customer Lookup
    if (partInput) {
      const handlePartChange = () => {
        const val = partInput.value.trim();
        const cust = db.lookupCustomerByPartNumber(val);
        const disp = document.getElementById('issue-customer-display');
        if (disp) {
          if (cust) {
            disp.textContent = cust;
            disp.classList.remove('text-muted', 'text-danger');
            disp.classList.add('text-gold');
          } else if (val) {
            disp.textContent = 'Custom / Non-catalog Part';
            disp.classList.remove('text-gold');
            disp.classList.add('text-muted');
          } else {
            disp.textContent = 'Select Part Number above';
            disp.classList.remove('text-gold');
            disp.classList.add('text-muted');
          }
        }
      };
      partInput.addEventListener('input', handlePartChange);
      partInput.addEventListener('change', handlePartChange);
    }

    // Batch Number $\rightarrow$ Lot Details Lookup
    if (batchSelect) {
      batchSelect.addEventListener('change', () => {
        const batchNo = batchSelect.value;
        const card = document.getElementById('batch-details-card');
        if (!batchNo) {
          if (card) card.classList.add('hidden');
          this.recalculateLive();
          return;
        }

        const stock = db.getBatchStock(batchNo);
        if (stock) {
          if (card) card.classList.remove('hidden');
          document.getElementById('disp-batch-material').textContent = stock.lot.material;
          document.getElementById('disp-batch-grade').textContent = stock.lot.grade;
          document.getElementById('disp-batch-wire-size').textContent = stock.lot.wireSize;
          document.getElementById('disp-batch-supplier').textContent = stock.lot.supplier;
          document.getElementById('disp-batch-inv-no').textContent = stock.lot.invNo;
          document.getElementById('disp-batch-heat-no').textContent = stock.lot.heatNo || '-';
          document.getElementById('disp-batch-avail-kg').textContent = `${stock.availableStock.toFixed(2)} kg`;
        }
        this.recalculateLive();
      });
    }

    // Live Calculation & Stock Validation on Quantity Inputs
    const qtyInputs = ['issue-qty', 'issue-return-qty', 'issue-scrap-qty', 'issue-bitwire-qty', 'issue-slug-qty'];
    qtyInputs.forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => {
        this.recalculateLive();
      });
    });

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleIssueSubmit(false);
      });
    }

    if (quickBtn) {
      quickBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleIssueSubmit(true);
      });
    }
  }

  recalculateLive() {
    const batchNo = document.getElementById('issue-batch-no')?.value;
    const issuedQty = parseFloat(document.getElementById('issue-qty')?.value || 0);
    const returnQty = parseFloat(document.getElementById('issue-return-qty')?.value || 0);
    const scrapQty = parseFloat(document.getElementById('issue-scrap-qty')?.value || 0);
    const bitWireQty = parseFloat(document.getElementById('issue-bitwire-qty')?.value || 0);
    const slugQty = parseFloat(document.getElementById('issue-slug-qty')?.value || 0);

    const netConsumed = Math.max(0, issuedQty - returnQty - scrapQty - bitWireQty - slugQty);
    const netDisp = document.getElementById('calc-net-consumed');
    if (netDisp) netDisp.textContent = netConsumed.toFixed(2);

    const errorMsg = document.getElementById('stock-error-msg');
    const issueInput = document.getElementById('issue-qty');
    const remDisp = document.getElementById('calc-remaining-balance');

    if (!batchNo) {
      if (remDisp) remDisp.textContent = '0.00';
      if (errorMsg) errorMsg.classList.add('hidden');
      if (issueInput) issueInput.classList.remove('input-invalid');
      return;
    }

    const stock = db.getBatchStock(batchNo);
    if (stock) {
      const remaining = stock.availableStock - issuedQty + returnQty;
      if (remDisp) {
        remDisp.textContent = remaining.toFixed(2);
        if (remaining < 0) {
          remDisp.classList.remove('text-success');
          remDisp.classList.add('text-danger');
        } else {
          remDisp.classList.remove('text-danger');
          remDisp.classList.add('text-success');
        }
      }

      // Negative stock warning
      if (issuedQty > stock.availableStock) {
        const deficit = (issuedQty - stock.availableStock).toFixed(2);
        if (errorMsg) {
          errorMsg.textContent = `OVER-ISSUE: Exceeds available stock by ${deficit} kg (Available: ${stock.availableStock.toFixed(2)} kg)`;
          errorMsg.classList.remove('hidden');
        }
        if (issueInput) issueInput.classList.add('input-invalid');
      } else {
        if (errorMsg) errorMsg.classList.add('hidden');
        if (issueInput) issueInput.classList.remove('input-invalid');
      }
    }
  }

  async handleIssueSubmit(isQuickRepeat = false) {
    const form = document.getElementById('rm-issue-form');
    const submitBtn = document.getElementById('btn-save-issue');
    const quickBtn = document.getElementById('btn-quick-repeat-issue');
    if (!form) return;

    submitBtn.disabled = true;
    if (quickBtn) quickBtn.disabled = true;

    const formData = {
      issueDate: document.getElementById('issue-date').value,
      machineNo: document.getElementById('issue-machine-no').value,
      partNumber: document.getElementById('issue-part-number').value,
      batchNo: document.getElementById('issue-batch-no').value,
      drawnSize: document.getElementById('issue-drawn-size').value,
      dieNo: document.getElementById('issue-die-no').value,
      issuedQty: document.getElementById('issue-qty').value,
      returnQty: document.getElementById('issue-return-qty').value,
      scrapQty: document.getElementById('issue-scrap-qty').value,
      bitWireQty: document.getElementById('issue-bitwire-qty').value,
      slugQty: document.getElementById('issue-slug-qty').value,
      remarks: document.getElementById('issue-remarks').value
    };

    try {
      const user = auth.getUser() ? auth.getUser().username : 'operator';
      const savedTx = await db.saveIssueTransaction(formData, user);

      this.app.showNotification(
        `SUCCESS: Issued ${savedTx.issuedQty.toFixed(2)} kg from Batch ${savedTx.batchNo} to M/C ${savedTx.machineNo}! Net Consumed: ${savedTx.netConsumed.toFixed(2)} kg`,
        'success',
        6000
      );

      if (isQuickRepeat) {
        // Keep Date, Machine, Part Number, Batch Number, Die No; Reset transaction quantities
        document.getElementById('issue-qty').value = '';
        document.getElementById('issue-return-qty').value = '0.00';
        document.getElementById('issue-scrap-qty').value = '0.00';
        document.getElementById('issue-bitwire-qty').value = '0.00';
        document.getElementById('issue-slug-qty').value = '0.00';
        document.getElementById('issue-remarks').value = '';
        this.recalculateLive();
        document.getElementById('issue-qty').focus();
      } else {
        // Full form reset but preserve date
        const curDate = formData.issueDate;
        form.reset();
        document.getElementById('issue-date').value = curDate;
        document.getElementById('issue-return-qty').value = '0.00';
        document.getElementById('issue-scrap-qty').value = '0.00';
        document.getElementById('issue-bitwire-qty').value = '0.00';
        document.getElementById('issue-slug-qty').value = '0.00';
        document.getElementById('issue-customer-display').textContent = 'Select Part Number above';
        document.getElementById('batch-details-card').classList.add('hidden');
        this.recalculateLive();
      }

      // Refresh registers, batch options, & dashboard
      this.refreshBatchDropdown();
      this.renderRegister();
      this.app.refreshAllViews();

    } catch (error) {
      this.app.showNotification(`ERROR: ${error.message}`, 'error', 7000);
    } finally {
      submitBtn.disabled = false;
      if (quickBtn) quickBtn.disabled = false;
    }
  }

  refreshBatchDropdown() {
    const batchSelect = document.getElementById('issue-batch-no');
    if (!batchSelect) return;
    const curVal = batchSelect.value;
    const batches = db.getActiveBatchesWithStock().filter(b => b.availableStock > 0);

    batchSelect.innerHTML = `
      <option value="">-- Select Active Batch No --</option>
      ${batches.map(b => `
        <option value="${b.batchNo}" ${b.batchNo === curVal ? 'selected' : ''}>
          ${b.batchNo} | ${b.material} ${b.grade} ${b.wireSize} (Available: ${b.availableStock.toFixed(2)} kg)
        </option>
      `).join('')}
    `;
  }

  renderRegister() {
    const container = document.getElementById('issue-register-container');
    if (!container) return;

    let issues = [...db.issueTransactions];

    // Filter
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      issues = issues.filter(t => 
        (t.batchNo || '').toLowerCase().includes(q) ||
        (t.customer || '').toLowerCase().includes(q) ||
        (t.partNumber || '').toLowerCase().includes(q) ||
        (t.machineNo || '').toLowerCase().includes(q) ||
        (t.supplier || '').toLowerCase().includes(q)
      );
    }

    if (this.dateFilter) {
      issues = issues.filter(t => t.issueDate === this.dateFilter);
    }

    if (this.machineFilter) {
      issues = issues.filter(t => t.machineNo === this.machineFilter);
    }

    const totalCount = issues.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / this.pageSize));
    if (this.currentPage > totalPages) this.currentPage = totalPages;

    const startIdx = (this.currentPage - 1) * this.pageSize;
    const pageIssues = issues.slice(startIdx, startIdx + this.pageSize);

    container.innerHTML = `
      <div class="table-card">
        <div class="table-toolbar">
          <div class="toolbar-search">
            <input type="text" id="issue-search" placeholder="Search Batch, Customer, Part, M/C..." value="${this.searchQuery}" class="form-control" />
          </div>
          <div class="toolbar-filters">
            <input type="date" id="issue-date-filter" value="${this.dateFilter}" class="form-control" title="Filter by Issue Date" />
            <input type="text" id="issue-mach-filter" placeholder="M/C No" value="${this.machineFilter}" class="form-control" style="max-width:110px;" />
            <button id="issue-clear-filters" class="btn btn-secondary btn-sm">Reset</button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tx ID</th>
                <th>Date</th>
                <th>M/C</th>
                <th>Customer</th>
                <th>Part Number</th>
                <th>Batch Number</th>
                <th>Wire Spec</th>
                <th>Issued (kg)</th>
                <th>Return (kg)</th>
                <th>Scrap (kg)</th>
                <th>Bit (kg)</th>
                <th>Slug (kg)</th>
                <th>Net Consumed (kg)</th>
                <th>Die No</th>
              </tr>
            </thead>
            <tbody>
              ${pageIssues.length === 0 ? `
                <tr><td colspan="14" class="text-center py-4 text-muted">No RM issue transactions recorded yet.</td></tr>
              ` : pageIssues.map(t => {
                const id = t.id || t.txId || t.tx_id || '-';
                const issueDate = t.issueDate || t.issue_date || '-';
                const machineNo = t.machineNo || t.machine_no || '-';
                const customer = t.customer || t.customer_name || '-';
                const partNumber = t.partNumber || t.part_number || '-';
                const batchNo = t.batchNo || t.batch_no || '-';
                const wireSpec = `${t.material || ''} ${t.grade || ''} ${t.wireSize || t.wire_size || ''}`.trim() || '-';
                const issuedQty = Number(t.issuedQty != null ? t.issuedQty : t.issued_qty) || 0;
                const returnQty = Number(t.returnQty != null ? t.returnQty : t.return_qty) || 0;
                const scrapQty = Number(t.scrapQty != null ? t.scrapQty : t.scrap_qty) || 0;
                const bitWireQty = Number(t.bitWireQty != null ? t.bitWireQty : t.bit_wire_qty) || 0;
                const slugQty = Number(t.slugQty != null ? t.slugQty : t.slug_qty) || 0;
                const netConsumed = Number(t.netConsumed != null ? t.netConsumed : t.net_consumed) || 0;
                const dieNo = t.dieNo || t.die_no || '-';
                return `
                <tr>
                  <td><code class="text-muted">${id}</code></td>
                  <td>${issueDate}</td>
                  <td><strong class="badge badge-mach">${machineNo}</strong></td>
                  <td><strong>${customer}</strong></td>
                  <td><code>${partNumber}</code></td>
                  <td><strong class="font-mono text-gold">${batchNo}</strong></td>
                  <td>${wireSpec}</td>
                  <td><strong class="text-warning">${issuedQty.toFixed(2)}</strong></td>
                  <td>${returnQty.toFixed(2)}</td>
                  <td>${scrapQty.toFixed(2)}</td>
                  <td>${bitWireQty.toFixed(2)}</td>
                  <td>${slugQty.toFixed(2)}</td>
                  <td><strong>${netConsumed.toFixed(2)}</strong></td>
                  <td>${dieNo}</td>
                </tr>
              `;}).join('')}
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="table-pagination">
          <span class="text-muted">Showing ${totalCount === 0 ? 0 : startIdx + 1} to ${Math.min(startIdx + this.pageSize, totalCount)} of ${totalCount} transactions</span>
          <div class="pagination-buttons">
            <button id="issue-prev-page" class="btn btn-secondary btn-sm" ${this.currentPage <= 1 ? 'disabled' : ''}>Prev</button>
            <span class="page-indicator">Page ${this.currentPage} / ${totalPages}</span>
            <button id="issue-next-page" class="btn btn-secondary btn-sm" ${this.currentPage >= totalPages ? 'disabled' : ''}>Next</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('issue-search')?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.currentPage = 1;
      this.renderRegister();
    });

    document.getElementById('issue-date-filter')?.addEventListener('change', (e) => {
      this.dateFilter = e.target.value;
      this.currentPage = 1;
      this.renderRegister();
    });

    document.getElementById('issue-mach-filter')?.addEventListener('input', (e) => {
      this.machineFilter = e.target.value;
      this.currentPage = 1;
      this.renderRegister();
    });

    document.getElementById('issue-clear-filters')?.addEventListener('click', () => {
      this.searchQuery = '';
      this.dateFilter = '';
      this.machineFilter = '';
      this.currentPage = 1;
      this.renderRegister();
    });

    document.getElementById('issue-prev-page')?.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderRegister();
      }
    });

    document.getElementById('issue-next-page')?.addEventListener('click', () => {
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.renderRegister();
      }
    });
  }
}

if (typeof window !== 'undefined') {
  window.IssueModule = IssueModule;
}
