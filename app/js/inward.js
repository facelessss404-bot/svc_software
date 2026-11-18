// SVC Smart Move - Phase 1: RM Inward View & Controller

class InwardModule {
  constructor(app) {
    this.app = app;
    this.searchQuery = '';
    this.dateFilter = '';
    this.materialFilter = '';
    this.currentPage = 1;
    this.pageSize = 10;
  }

  init() {
    this.renderForm();
    this.renderRegister();
    this.bindEvents();
  }

  renderForm() {
    const container = document.getElementById('inward-form-container');
    if (!container) return;

    const master = db.getMasterData();
    const materials = [...new Set(master.map(m => m.material))].sort();
    const suppliers = db.getSuppliers();
    const today = new Date().toISOString().split('T')[0];

    container.innerHTML = `
      <form id="rm-inward-form" class="industrial-form">
        <div class="form-section-title">
          <span class="step-badge">1</span>
          <h3>Receipt & Supplier Details</h3>
        </div>
        <div class="form-grid cols-3">
          <div class="form-group">
            <label for="inward-date">Inward Date <span class="req">*</span></label>
            <input type="date" id="inward-date" name="inwardDate" value="${today}" required class="form-control" />
          </div>

          <div class="form-group">
            <label for="inward-supplier">Supplier Name <span class="req">*</span></label>
            <input type="text" id="inward-supplier" name="supplier" list="supplier-datalist" placeholder="e.g. RCW, VENUS" required class="form-control" autocomplete="off" />
            <datalist id="supplier-datalist">
              ${suppliers.map(s => `<option value="${s}"></option>`).join('')}
            </datalist>
          </div>

          <div class="form-group">
            <label for="inward-inv-no">Supplier Invoice / DC No <span class="req">*</span></label>
            <input type="text" id="inward-inv-no" name="invNo" placeholder="e.g. 2340" required class="form-control" />
          </div>

          <div class="form-group">
            <label for="inward-inv-date">Invoice Date <span class="req">*</span></label>
            <input type="date" id="inward-inv-date" name="invDate" value="${today}" required class="form-control" />
          </div>

          <div class="form-group">
            <label for="inward-po-no">Purchase Order (PO) No</label>
            <input type="text" id="inward-po-no" name="poNo" placeholder="Optional PO reference" class="form-control" />
          </div>

          <div class="form-group">
            <label for="inward-gi-no">Gate Inward (GI) No</label>
            <input type="text" id="inward-gi-no" name="giNo" placeholder="Optional Gate No" class="form-control" />
          </div>
        </div>

        <div class="form-section-title mt-4">
          <span class="step-badge">2</span>
          <h3>Material Master Specification (Main_Data Cascading Lookup)</h3>
        </div>
        <div class="form-grid cols-3">
          <div class="form-group">
            <label for="inward-material">Material <span class="req">*</span></label>
            <select id="inward-material" name="material" required class="form-control">
              <option value="">-- Select Material --</option>
              ${materials.map(m => `<option value="${m}">${m}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label for="inward-grade">Grade <span class="req">*</span></label>
            <select id="inward-grade" name="grade" required class="form-control" disabled>
              <option value="">-- Select Grade --</option>
            </select>
          </div>

          <div class="form-group">
            <label for="inward-wire-size">Wire Size (Exact Spec) <span class="req">*</span></label>
            <select id="inward-wire-size" name="wireSize" required class="form-control" disabled>
              <option value="">-- Select Wire Size --</option>
            </select>
          </div>
        </div>

        <!-- Live Batch Number Pattern Preview -->
        <div id="batch-preview-box" class="preview-box hidden">
          <div class="preview-header">
            <span class="preview-label">AUTOMATIC BATCH GENERATION PREVIEW</span>
            <span id="preview-batch-tag" class="batch-badge">MS-M-a-26-XXX</span>
          </div>
          <div class="preview-details">
            <div><span class="text-muted">Wire Code:</span> <strong id="preview-wire-code">-</strong></div>
            <div><span class="text-muted">Grade Code:</span> <strong id="preview-grade-code">-</strong></div>
            <div><span class="text-muted">Sequence Counter:</span> <strong id="preview-next-seq">Next Available</strong></div>
          </div>
        </div>

        <div class="form-section-title mt-4">
          <span class="step-badge">3</span>
          <h3>Physical Lot Measurements</h3>
        </div>
        <div class="form-grid cols-3">
          <div class="form-group">
            <label for="inward-weight">Net Inward Weight (kg) <span class="req">*</span></label>
            <input type="number" step="0.01" min="0.01" id="inward-weight" name="weight" placeholder="e.g. 1785.00" required class="form-control" />
          </div>

          <div class="form-group">
            <label for="inward-coils">No. of Coils <span class="req">*</span></label>
            <input type="number" min="1" id="inward-coils" name="coils" placeholder="e.g. 12" required class="form-control" />
          </div>

          <div class="form-group">
            <label for="inward-heat-no">Heat / Mill TC No</label>
            <input type="text" id="inward-heat-no" name="heatNo" placeholder="e.g. A3094255" class="form-control" />
          </div>
        </div>

        <div class="form-group mt-3">
          <label for="inward-remarks">Remarks / Coil Tag Notes</label>
          <input type="text" id="inward-remarks" name="remarks" placeholder="Optional notes (e.g. Bay location, wire condition)" class="form-control" />
        </div>

        <div class="form-actions mt-4">
          <button type="submit" id="btn-save-inward" class="btn btn-primary">
            <svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
            Save Inward & Generate Batch No
          </button>
          <button type="reset" id="btn-reset-inward" class="btn btn-secondary">Clear</button>
        </div>
      </form>
    `;
  }

  bindEvents() {
    const matSelect = document.getElementById('inward-material');
    const gradeSelect = document.getElementById('inward-grade');
    const wireSelect = document.getElementById('inward-wire-size');
    const dateInput = document.getElementById('inward-date');
    const form = document.getElementById('rm-inward-form');

    if (matSelect) {
      matSelect.addEventListener('change', () => {
        const mat = matSelect.value;
        gradeSelect.innerHTML = '<option value="">-- Select Grade --</option>';
        wireSelect.innerHTML = '<option value="">-- Select Wire Size --</option>';
        wireSelect.disabled = true;

        if (!mat) {
          gradeSelect.disabled = true;
          this.updateBatchPreview();
          return;
        }

        const master = db.getMasterData();
        const grades = [...new Set(master.filter(m => m.material === mat).map(m => m.grade))].sort();
        grades.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g;
          opt.textContent = g;
          gradeSelect.appendChild(opt);
        });
        gradeSelect.disabled = false;
        this.updateBatchPreview();
      });
    }

    if (gradeSelect) {
      gradeSelect.addEventListener('change', () => {
        const mat = matSelect.value;
        const grade = gradeSelect.value;
        wireSelect.innerHTML = '<option value="">-- Select Wire Size --</option>';

        if (!mat || !grade) {
          wireSelect.disabled = true;
          this.updateBatchPreview();
          return;
        }

        const master = db.getMasterData();
        const wireSizes = master.filter(m => m.material === mat && m.grade === grade);
        wireSizes.forEach(w => {
          const opt = document.createElement('option');
          opt.value = w.wireSize;
          opt.textContent = `${w.wireSize} (Wire Code: ${w.wireCode})`;
          wireSelect.appendChild(opt);
        });
        wireSelect.disabled = false;
        this.updateBatchPreview();
      });
    }

    if (wireSelect) {
      wireSelect.addEventListener('change', () => {
        this.updateBatchPreview();
      });
    }

    if (dateInput) {
      dateInput.addEventListener('change', () => {
        this.updateBatchPreview();
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleInwardSubmit();
      });
    }
  }

  updateBatchPreview() {
    const mat = document.getElementById('inward-material')?.value;
    const grade = document.getElementById('inward-grade')?.value;
    const wireSize = document.getElementById('inward-wire-size')?.value;
    const inwardDate = document.getElementById('inward-date')?.value;
    const box = document.getElementById('batch-preview-box');

    if (!mat || !grade || !wireSize) {
      if (box) box.classList.add('hidden');
      return;
    }

    try {
      const batchInfo = db.generateBatchNumber(mat, grade, wireSize, inwardDate);
      if (box) {
        box.classList.remove('hidden');
        document.getElementById('preview-batch-tag').textContent = batchInfo.batchNo;
        document.getElementById('preview-wire-code').textContent = batchInfo.wireCode;
        document.getElementById('preview-grade-code').textContent = batchInfo.gradeCode;
        document.getElementById('preview-next-seq').textContent = `#${String(batchInfo.seq).padStart(3, '0')}`;
      }
    } catch (err) {
      if (box) box.classList.add('hidden');
    }
  }

  async handleInwardSubmit() {
    const form = document.getElementById('rm-inward-form');
    const submitBtn = document.getElementById('btn-save-inward');
    if (!form) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving & Allocating Batch...';

    const formData = {
      inwardDate: document.getElementById('inward-date').value,
      supplier: document.getElementById('inward-supplier').value,
      invNo: document.getElementById('inward-inv-no').value,
      invDate: document.getElementById('inward-inv-date').value,
      poNo: document.getElementById('inward-po-no').value,
      giNo: document.getElementById('inward-gi-no').value,
      material: document.getElementById('inward-material').value,
      grade: document.getElementById('inward-grade').value,
      wireSize: document.getElementById('inward-wire-size').value,
      weight: document.getElementById('inward-weight').value,
      coils: document.getElementById('inward-coils').value,
      heatNo: document.getElementById('inward-heat-no').value,
      remarks: document.getElementById('inward-remarks').value
    };

    try {
      const user = auth.getUser() ? auth.getUser().username : 'operator';
      const savedLot = await db.saveInwardLot(formData, user);

      this.app.showNotification(
        `SUCCESS: Batch Number "${savedLot.batchNo}" generated and saved with ${savedLot.weight.toFixed(2)} kg!`,
        'success',
        6000
      );

      // Reset form but keep date
      const curDate = formData.inwardDate;
      form.reset();
      document.getElementById('inward-date').value = curDate;
      document.getElementById('inward-inv-date').value = curDate;
      document.getElementById('inward-grade').disabled = true;
      document.getElementById('inward-wire-size').disabled = true;
      document.getElementById('batch-preview-box').classList.add('hidden');

      // Refresh registers & dashboard
      this.renderRegister();
      this.app.refreshAllViews();
      return savedLot;

    } catch (error) {
      this.app.showNotification(`ERROR: ${error.message}`, 'error', 7000);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
        Save Inward & Generate Batch No
      `;
    }
  }

  renderRegister() {
    const container = document.getElementById('inward-register-container');
    if (!container) return;

    let lots = [...db.inwardLots];

    // Filter
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      lots = lots.filter(l => 
        (l.batchNo || '').toLowerCase().includes(q) ||
        (l.supplier || '').toLowerCase().includes(q) ||
        (l.invNo || '').toLowerCase().includes(q) ||
        (l.heatNo || '').toLowerCase().includes(q) ||
        (l.material || '').toLowerCase().includes(q)
      );
    }

    if (this.dateFilter) {
      lots = lots.filter(l => l.inwardDate === this.dateFilter);
    }

    if (this.materialFilter) {
      lots = lots.filter(l => l.material === this.materialFilter);
    }

    const totalCount = lots.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / this.pageSize));
    if (this.currentPage > totalPages) this.currentPage = totalPages;

    const startIdx = (this.currentPage - 1) * this.pageSize;
    const pageLots = lots.slice(startIdx, startIdx + this.pageSize);

    container.innerHTML = `
      <div class="table-card">
        <div class="table-toolbar">
          <div class="toolbar-search">
            <input type="text" id="inward-search" placeholder="Search Batch No, Supplier, Inv, Heat..." value="${this.searchQuery}" class="form-control" />
          </div>
          <div class="toolbar-filters">
            <input type="date" id="inward-date-filter" value="${this.dateFilter}" class="form-control" title="Filter by Inward Date" />
            <select id="inward-mat-filter" class="form-control">
              <option value="">All Materials</option>
              <option value="MS" ${this.materialFilter === 'MS' ? 'selected' : ''}>MS</option>
              <option value="AL" ${this.materialFilter === 'AL' ? 'selected' : ''}>AL</option>
              <option value="BR" ${this.materialFilter === 'BR' ? 'selected' : ''}>BR</option>
              <option value="CU" ${this.materialFilter === 'CU' ? 'selected' : ''}>CU</option>
              <option value="SS" ${this.materialFilter === 'SS' ? 'selected' : ''}>SS</option>
            </select>
            <button id="inward-clear-filters" class="btn btn-secondary btn-sm">Reset</button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Batch Number</th>
                <th>Inward Date</th>
                <th>Supplier</th>
                <th>Invoice No</th>
                <th>Material</th>
                <th>Grade</th>
                <th>Wire Size</th>
                <th>Coils</th>
                <th>Inward Wt (kg)</th>
                <th>Available (kg)</th>
                <th>Heat No</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${pageLots.length === 0 ? `
                <tr><td colspan="12" class="text-center py-4 text-muted">No inward lot records found matching criteria.</td></tr>
              ` : pageLots.map(l => {
                const batchNo = l.batchNo || l.batch_no || '';
                const inwardDate = l.inwardDate || l.inward_date || '-';
                const invNo = l.invNo || l.inv_no || '-';
                const wireSize = l.wireSize || l.wire_size || '-';
                const heatNo = l.heatNo || l.heat_no || '-';
                const weight = Number(l.weight) || 0;
                const coils = Number(l.coils) || 0;
                const stock = db.getBatchStock(batchNo) || { availableStock: weight, status: 'In Stock' };
                const statusClass = stock.status === 'In Stock' ? 'status-ok' : stock.status === 'Low Stock' ? 'status-warn' : 'status-danger';
                return `
                  <tr data-batch="${batchNo}" class="clickable-row">
                    <td><strong class="font-mono text-gold">${batchNo}</strong></td>
                    <td>${inwardDate}</td>
                    <td>${l.supplier || '-'}</td>
                    <td>${invNo}</td>
                    <td><span class="badge badge-mat">${l.material}</span></td>
                    <td>${l.grade}</td>
                    <td><code>${wireSize}</code></td>
                    <td>${coils}</td>
                    <td><strong>${weight.toFixed(2)}</strong></td>
                    <td class="text-success"><strong>${stock.availableStock.toFixed(2)}</strong></td>
                    <td>${heatNo}</td>
                    <td><span class="badge ${statusClass}">${stock.status}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="table-pagination">
          <span class="text-muted">Showing ${totalCount === 0 ? 0 : startIdx + 1} to ${Math.min(startIdx + this.pageSize, totalCount)} of ${totalCount} lots</span>
          <div class="pagination-buttons">
            <button id="inward-prev-page" class="btn btn-secondary btn-sm" ${this.currentPage <= 1 ? 'disabled' : ''}>Prev</button>
            <span class="page-indicator">Page ${this.currentPage} / ${totalPages}</span>
            <button id="inward-next-page" class="btn btn-secondary btn-sm" ${this.currentPage >= totalPages ? 'disabled' : ''}>Next</button>
          </div>
        </div>
      </div>
    `;

    // Bind register search & pagination
    document.getElementById('inward-search')?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.currentPage = 1;
      this.renderRegister();
    });

    document.getElementById('inward-date-filter')?.addEventListener('change', (e) => {
      this.dateFilter = e.target.value;
      this.currentPage = 1;
      this.renderRegister();
    });

    document.getElementById('inward-mat-filter')?.addEventListener('change', (e) => {
      this.materialFilter = e.target.value;
      this.currentPage = 1;
      this.renderRegister();
    });

    document.getElementById('inward-clear-filters')?.addEventListener('click', () => {
      this.searchQuery = '';
      this.dateFilter = '';
      this.materialFilter = '';
      this.currentPage = 1;
      this.renderRegister();
    });

    document.getElementById('inward-prev-page')?.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderRegister();
      }
    });

    document.getElementById('inward-next-page')?.addEventListener('click', () => {
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.renderRegister();
      }
    });
  }
}

if (typeof window !== 'undefined') {
  window.InwardModule = InwardModule;
}
