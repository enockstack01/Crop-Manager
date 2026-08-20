// ============================================================
// APP SHELL — Sidebar, Topbar, Dark Mode, Global Init
// ============================================================

const App = {

    currentUser: null,
    currentProfile: null,

    async init() {
        // Check auth
        const session = await Auth.requireAuth();
        if (!session) return;

        this.currentUser = session.user;
        this.currentProfile = await Auth.getProfile();

        // Initialize components
        this.initSidebar();
        this.initTopbar();
        this.initDarkMode();
        this.initMobileMenu();
        this.highlightCurrentNav();
        this.updateUserDisplay();

        // Listen for auth changes
        Auth.onAuthChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                window.location.href = 'index.html';
            }
        });
    },

    initSidebar() {
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('sidebar-toggle');
        if (!sidebar || !toggleBtn) return;

        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('sidebar-collapsed');
            document.querySelector('.main-content').classList.toggle('main-content-expanded');
        });
    },

    initTopbar() {
        // Mobile menu toggle
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebar-overlay');

        if (mobileMenuBtn && sidebar) {
            mobileMenuBtn.addEventListener('click', () => {
                sidebar.classList.add('sidebar-mobile-open');
                if (sidebarOverlay) sidebarOverlay.classList.add('active');
            });
        }

        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                sidebar.classList.remove('sidebar-mobile-open');
                sidebarOverlay.classList.remove('active');
            });
        }

        // Notification dropdown
        const notifBtn = document.getElementById('notif-btn');
        const notifDropdown = document.getElementById('notif-dropdown');
        if (notifBtn && notifDropdown) {
            notifBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                notifDropdown.classList.toggle('dropdown-active');
            });
        }

        // User dropdown
        const userBtn = document.getElementById('user-btn');
        const userDropdown = document.getElementById('user-dropdown');
        if (userBtn && userDropdown) {
            userBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('dropdown-active');
            });
        }

        // Close dropdowns on outside click
        document.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-active').forEach(d => d.classList.remove('dropdown-active'));
        });

        // Global search
        const searchInput = document.getElementById('global-search');
        if (searchInput) {
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.handleGlobalSearch(searchInput.value.trim());
                }
            });
        }
    },

    initDarkMode() {
        const saved = localStorage.getItem('darkMode');
        if (saved === 'true') {
            document.documentElement.classList.add('dark-mode');
        }

        const toggle = document.getElementById('dark-mode-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                document.documentElement.classList.toggle('dark-mode');
                const isDark = document.documentElement.classList.contains('dark-mode');
                localStorage.setItem('darkMode', isDark);
            });
        }
    },

    initMobileMenu() {
        // Close sidebar nav links on mobile
        document.querySelectorAll('.sidebar-nav a').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    const sidebar = document.getElementById('sidebar');
                    const overlay = document.getElementById('sidebar-overlay');
                    if (sidebar) sidebar.classList.remove('sidebar-mobile-open');
                    if (overlay) overlay.classList.remove('active');
                }
            });
        });
    },

    highlightCurrentNav() {
        const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
        document.querySelectorAll('.sidebar-nav a').forEach(link => {
            const href = link.getAttribute('href');
            if (href === currentPage) {
                link.classList.add('nav-active');
            }
        });
    },

    updateUserDisplay() {
        const nameEl = document.getElementById('user-display-name');
        const avatarEl = document.getElementById('user-avatar');
        const roleEl = document.getElementById('user-display-role');

        if (nameEl) nameEl.textContent = this.currentProfile?.full_name || this.currentUser?.email || 'User';
        if (roleEl) roleEl.textContent = this.currentProfile?.role || 'Farmer';
        if (avatarEl && this.currentProfile?.avatar_url) {
            avatarEl.src = this.currentProfile.avatar_url;
        }
    },

    async handleGlobalSearch(query) {
        if (!query || query.length < 2) return;
        // Global search will be fully implemented — for now show toast
        Utils.toast('Search coming in a future phase', 'info');
    },

    logout() {
        Auth.logout();
    }
};