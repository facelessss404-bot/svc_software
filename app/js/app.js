// SVC Smart Move - Phase 1 Application Controller & Router

class SmartMoveApp {
  constructor() {
    this.inwardModule = null;
    this.issueModule = null;
    this.ledgerModule = null;
    this.currentView = 'view-dashboard';
  }

  async start() {
    await db.init();
    await auth.init();

    this.inwardModule = new InwardModule(this);
    this.issueModule = new IssueModule(this);
    this.ledgerModule = new LedgerModule(this);

    this.bindGlobalEvents();
    this.checkAuthState();
  }

  checkAuthState() {
    const loginModal = document.getElementById('login-modal');
    const userBadge = document.getElementById('user-profile-badge');
    const userNameSpan = document.getElementById('current-user-name');
    const userRoleSpan = document.getElementById('current-user-role');

    if (auth.isAuthenticated()) {
      if (loginModal) loginModal.classList.add('hidden');
      const user = auth.getUser();
      if (userNameSpan) userNameSpan.textContent = user.name || user.username;
      if (userRoleSpan) userRoleSpan.textContent = user.role;
      if (userBadge) userBadge.classList.remove('hidden');

      this.initModules();
      this.switchView(this.currentView);
    } else {
      if (loginModal) loginModal.classList.remove('hidden');
      if (userBadge) userBadge.classList.add('hidden');
    }
  }

  initModules() {
    this.inwardModule.init();
    this.issueModule.init();
    this.ledgerModule.init();
    this.updateDashboardMetrics();
    this.renderMastersView();
  }

  refreshAllViews() {
    this.updateDashboardMetrics();
    this.inwardModule.renderRegister();
    this.issueModule.refreshBatchDropdown();
    this.issueModule.renderRegister();
    this.ledgerModule.renderLedger();
    this.ledgerModule.renderAuditLogs();
  }

  updateDashboardMetrics() {
    const m = db.getDashboardMetrics();
    const elInward = document.getElementById('kpi-total-inward');
    const elIssued = document.getElementById('kpi-total-issued');
    const elReturned = document.getElementById('kpi-total-returned');
    const elBalance = document.getElementById('kpi-current-stock');
    const elConsumed = document.getElementById('kpi-net-consumed');
    const elActiveBatches = document.getElementById('kpi-active-batches');

    if (elInward) elInward.textContent = `${m.totalInwardKg.toFixed(2)} kg`;
    if (elIssued) elIssued.textContent = `${m.totalIssuedKg.toFixed(2)} kg`;
    if (elReturned) elReturned.textContent = `${m.totalReturnedKg.toFixed(2)} kg`;
    if (elBalance) elBalance.textContent = `${m.currentWireStockKg.toFixed(2)} kg`;
    if (elConsumed) elConsumed.textContent = `${m.totalNetConsumedKg.toFixed(2)} kg`;
    if (elActiveBatches) elActiveBatches.textContent = `${m.activeBatches} Lots`;

    this.renderRecentActivity();
  }

  renderRecentActivity() {
    const container = document.getElementById('recent-activity-list');
    if (!container) return;

    const recentInwards = db.inwardLots.slice(0, 5);
    const recentIssues = db.issueTransactions.slice(0, 5);

    let html = '';
    if (recentInwards.length === 0 && recentIssues.length === 0) {
      html = '<p class="text-muted text-center py-3">No recent transactions recorded.</p>';
    } else {
      html = `
        <div class="activity-feed">
          ${recentInwards.map(l => `
            <div class="feed-item inward-item">
              <span class="feed-badge inward-badge">INWARD</span>
              <div class="feed-content">
                <strong>${l.batchNo}</strong> - ${l.weight.toFixed(2)} kg of ${l.material} (${l.grade} ${l.wireSize}) from ${l.supplier}
                <div class="feed-time">${l.inwardDate} | Inv: ${l.invNo}</div>
              </div>
            </div>
          `).join('')}
          ${recentIssues.map(i => `
            <div class="feed-item issue-item">
              <span class="feed-badge issue-badge">ISSUE</span>
              <div class="feed-content">
                <strong>M/C ${i.machineNo}</strong> - Issued ${i.issuedQty.toFixed(2)} kg for Part ${i.partNumber} (${i.customer})
                <div class="feed-time">${i.issueDate} | Batch: ${i.batchNo} | Net Consumed: ${i.netConsumed.toFixed(2)} kg</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
    container.innerHTML = html;
  }

  renderMastersView() {
    const masterContainer = document.getElementById('masters-table-container');
    const partsContainer = document.getElementById('parts-table-container');

    if (masterContainer) {
      const master = db.getMasterData();
      masterContainer.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Wire Size (Exact Spec)</th>
                <th>Wire Code</th>
                <th>Grade</th>
                <th>Grade Code</th>
                <th>Batch Pattern Template</th>
                <th>Default Supplier</th>
              </tr>
            </thead>
            <tbody>
              ${master.map(m => `
                <tr>
                  <td><span class="badge badge-mat">${m.material}</span></td>
                  <td><code>${m.wireSize}</code></td>
                  <td><strong>${m.wireCode}</strong></td>
                  <td>${m.grade}</td>
                  <td><strong>${m.gradeCode}</strong></td>
                  <td><strong class="font-mono text-gold">${m.templateBatch}</strong></td>
                  <td>${m.supplier || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (partsContainer) {
      const parts = db.getPartsCatalog().slice(0, 100);
      partsContainer.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Part Number (Drawing No)</th>
                <th>Customer Name</th>
                <th>Material Spec</th>
                <th>Type</th>
                <th>From Size</th>
              </tr>
            </thead>
            <tbody>
              ${parts.map(p => `
                <tr>
                  <td><strong class="font-mono text-gold">${p.partNumber}</strong></td>
                  <td><strong>${p.customer}</strong></td>
                  <td>${p.material || '-'}</td>
                  <td>${p.type || '-'}</td>
                  <td>${p.fromSize || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.add('hidden');
    });

    const activeSec = document.getElementById(viewId);
    if (activeSec) {
      activeSec.classList.remove('hidden');
      this.currentView = viewId;
    }

    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.dataset.view === viewId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    if (viewId === 'view-ledger') {
      this.ledgerModule.renderLedger();
    } else if (viewId === 'view-inward') {
      this.inwardModule.renderRegister();
    } else if (viewId === 'view-issue') {
      this.issueModule.refreshBatchDropdown();
      this.issueModule.renderRegister();
    } else if (viewId === 'view-dashboard') {
      this.updateDashboardMetrics();
    }
  }

  bindGlobalEvents() {
    // Navigation Links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const viewId = link.dataset.view;
        if (viewId) this.switchView(viewId);
      });
    });

    // Quick Action Buttons on Dashboard
    document.getElementById('dash-btn-new-inward')?.addEventListener('click', () => {
      this.switchView('view-inward');
      document.getElementById('inward-supplier')?.focus();
    });

    document.getElementById('dash-btn-new-issue')?.addEventListener('click', () => {
      this.switchView('view-issue');
      document.getElementById('issue-part-number')?.focus();
    });

    // Logout Button
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      auth.logout();
      this.checkAuthState();
      this.showNotification('You have logged out successfully.', 'info');
    });

    // Login Form Submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const pin = document.getElementById('login-pin').value;
        try {
          await auth.login(username, pin);
          this.checkAuthState();
          this.showNotification(`Welcome, ${auth.getUser().name}!`, 'success');
        } catch (err) {
          const errBox = document.getElementById('login-error-msg');
          if (errBox) {
            errBox.textContent = err.message;
            errBox.classList.remove('hidden');
          }
        }
      });
    }

    // Modal Close Buttons
    document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.modal').forEach(m => {
          if (!m.classList.contains('locked')) m.classList.add('hidden');
        });
      });
    });

    // Backend URL Configuration in Settings
    const backendInput = document.getElementById('config-backend-url');
    const saveBackendBtn = document.getElementById('btn-save-backend-url');
    const backendStatus = document.getElementById('config-backend-status');

    if (backendInput && window.SVC_CONFIG) {
      backendInput.value = window.SVC_CONFIG.getBackendUrl();
    }

    saveBackendBtn?.addEventListener('click', async () => {
      const url = backendInput ? backendInput.value.trim() : '';
      if (window.SVC_CONFIG) {
        window.SVC_CONFIG.setBackendUrl(url);
      }
      if (backendStatus) {
        backendStatus.textContent = 'Testing connection...';
        backendStatus.className = 'text-muted text-xs mt-1 block';
      }
      const isOk = await db.checkServerConnection();
      if (isOk) {
        if (backendStatus) {
          backendStatus.textContent = '✓ Connected successfully to: ' + (url || 'Local server');
          backendStatus.className = 'text-success text-xs mt-1 block';
        }
        this.showNotification('Central Server Connected!', 'success');
        db.syncWithServer();
      } else {
        if (backendStatus) {
          backendStatus.textContent = '✗ Could not connect. Check the URL and ensure the server is live.';
          backendStatus.className = 'field-error text-xs mt-1 block';
        }
        this.showNotification('Failed to connect to backend server.', 'error');
      }
    });

    // Mobile Sidebar Toggle
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      document.getElementById('app-sidebar')?.classList.toggle('open');
    });

    // Keyboard Shortcuts (Alt+1, Alt+2, Alt+3, Alt+4)
    window.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === '1') this.switchView('view-dashboard');
      if (e.altKey && e.key === '2') this.switchView('view-inward');
      if (e.altKey && e.key === '3') this.switchView('view-issue');
      if (e.altKey && e.key === '4') this.switchView('view-ledger');
    });
  }

  showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span>${message}</span>
      </div>
      <button class="toast-close">&times;</button>
    `;

    container.appendChild(toast);

    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.remove();
    });

    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, duration);
  }
}

window.app = new SmartMoveApp();
window.addEventListener('DOMContentLoaded', () => {
  window.app.start();
});
