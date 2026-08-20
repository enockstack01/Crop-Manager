// ============================================================
// UTILITY FUNCTIONS — Toasts, Modals, Loading, Empty States, Pagination
// ============================================================

const Utils = {

    // ---- TOAST NOTIFICATIONS ----
    toast(message, type = 'success', duration = 4000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        const colors = {
            success: '#2E7D32',
            error: '#D32F2F',
            warning: '#F9A825',
            info: '#1976D2'
        };

        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.innerHTML = `
            <i class="fas ${icons[type] || icons.info}" style="color:${colors[type] || colors.info}"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(toast);

        // Trigger enter animation
        requestAnimationFrame(() => toast.classList.add('toast-show'));

        setTimeout(() => {
            toast.classList.remove('toast-show');
            toast.classList.add('toast-hide');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // ---- MODAL SYSTEM ----
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.add('modal-active');
        document.body.style.overflow = 'hidden';
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove('modal-active');
        document.body.style.overflow = '';
        // Reset form inside modal if any
        const form = modal.querySelector('form');
        if (form) form.reset();
        // Clear validation errors
        modal.querySelectorAll('.form-error').forEach(el => el.textContent = '');
    },

    closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(m => {
            m.classList.remove('modal-active');
        });
        document.body.style.overflow = '';
    },

    // ---- CONFIRM DIALOG ----
    confirm(message, onConfirm) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay modal-active';
        overlay.innerHTML = `
            <div class="modal modal-sm">
                <div class="modal-header">
                    <h3>Confirm Action</h3>
                    <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove(); document.body.style.overflow='';">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <p style="color:var(--text-light);line-height:1.6;">${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove(); document.body.style.overflow='';">Cancel</button>
                    <button class="btn btn-danger" id="confirm-action-btn">Delete</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        overlay.querySelector('#confirm-action-btn').addEventListener('click', () => {
            overlay.remove();
            document.body.style.overflow = '';
            if (onConfirm) onConfirm();
        });
    },

    // ---- LOADING STATES ----
    showLoading(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading data...</p>
            </div>
        `;
    },

    showSkeleton(containerId, rows = 5) {
        const container = document.getElementById(containerId);
        if (!container) return;
        let html = '';
        for (let i = 0; i < rows; i++) {
            html += `<div class="skeleton-row" style="animation-delay:${i * 0.1}s">
                <div class="skeleton skeleton-text" style="width:${60 + Math.random() * 30}%"></div>
                <div class="skeleton skeleton-text short" style="width:${30 + Math.random() * 20}%"></div>
            </div>`;
        }
        container.innerHTML = html;
    },

    hideLoading(containerId, content) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (typeof content === 'string') {
            container.innerHTML = content;
        }
    },

    // ---- EMPTY STATES ----
    emptyState(icon, title, description, buttonText, buttonAction) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <h3 class="empty-state-title">${title}</h3>
                <p class="empty-state-desc">${description}</p>
                ${buttonText ? `<button class="btn btn-primary" onclick="${buttonAction}">
                    <i class="fas fa-plus"></i> ${buttonText}
                </button>` : ''}
            </div>
        `;
    },

    // ---- PAGINATION ----
    renderPagination(containerId, currentPage, totalPages, onPageChange) {
        const container = document.getElementById(containerId);
        if (!container || totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }

        let html = '<div class="pagination">';
        html += `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} data-page="${currentPage - 1}">
            <i class="fas fa-chevron-left"></i>
        </button>`;

        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (startPage > 1) {
            html += `<button class="page-btn" data-page="1">1</button>`;
            if (startPage > 2) html += '<span class="page-dots">...</span>';
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += '<span class="page-dots">...</span>';
            html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
        }

        html += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">
            <i class="fas fa-chevron-right"></i>
        </button>`;
        html += '</div>';

        container.innerHTML = html;

        container.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                if (page >= 1 && page <= totalPages && page !== currentPage) {
                    onPageChange(page);
                }
            });
        });
    },

    // ---- FORM VALIDATION ----
    validateForm(formEl) {
        let isValid = true;
        const requiredFields = formEl.querySelectorAll('[required]');
        requiredFields.forEach(field => {
            const errorEl = field.parentElement.querySelector('.form-error');
            if (!field.value.trim()) {
                isValid = false;
                field.classList.add('input-error');
                if (errorEl) errorEl.textContent = 'This field is required';
            } else {
                field.classList.remove('input-error');
                if (errorEl) errorEl.textContent = '';
            }
        });

        // Email validation
        const emailField = formEl.querySelector('input[type="email"]');
        if (emailField && emailField.value.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailField.value.trim())) {
                isValid = false;
                emailField.classList.add('input-error');
                const errorEl = emailField.parentElement.querySelector('.form-error');
                if (errorEl) errorEl.textContent = 'Please enter a valid email address';
            }
        }

        return isValid;
    },

    // ---- FORMAT HELPERS ----
    formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    },

    formatDateTime(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) +
            ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    },

    formatNumber(num) {
        if (num === null || num === undefined) return '0';
        return Number(num).toLocaleString('en-US');
    },

    formatCurrency(amount, currency = 'ZMW') {
        if (amount === null || amount === undefined) return currency + ' 0.00';
        return currency + ' ' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    // ---- DEBOUNCE ----
    debounce(func, wait = 300) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    // ---- STATUS BADGE ----
    statusBadge(status) {
        const map = {
            'Active': 'badge-success',
            'Fallow': 'badge-neutral',
            'Preparing': 'badge-warning',
            'Maintenance': 'badge-info',
            'Planned': 'badge-info',
            'Planted': 'badge-primary',
            'Growing': 'badge-success',
            'Ready for Harvest': 'badge-warning',
            'Harvested': 'badge-primary',
            'Completed': 'badge-success',
            'Cancelled': 'badge-danger',
            'Available': 'badge-success',
            'In Use': 'badge-info',
            'Damaged': 'badge-danger',
            'Retired': 'badge-neutral',
            'Pending': 'badge-warning',
            'Partially Paid': 'badge-info',
            'Paid': 'badge-success',
            'Low': 'badge-warning',
            'Moderate': 'badge-info',
            'High': 'badge-danger',
            'Critical': 'badge-danger'
        };
        const cls = map[status] || 'badge-neutral';
        return `<span class="badge ${cls}">${status}</span>`;
    },

    // ---- ESCAPE HTML ----
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // ---- SET BUTTON LOADING ----
    setBtnLoading(btnEl, loading = true) {
        if (!btnEl) return;
        if (loading) {
            btnEl.dataset.originalText = btnEl.innerHTML;
            btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            btnEl.disabled = true;
        } else {
            btnEl.innerHTML = btnEl.dataset.originalText || btnEl.innerHTML;
            btnEl.disabled = false;
        }
    },

    // ---- GET GREETING ----
    getGreeting() {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    }
};

// Close modals on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('modal-active')) {
        e.target.classList.remove('modal-active');
        document.body.style.overflow = '';
    }
});

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        Utils.closeAllModals();
    }
});