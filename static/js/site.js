// Site-wide behaviour: dark-mode toggle, mobile menu and navbar elevation.
// Loaded with `defer` from base.html.
// (The initial dark-mode class is set by a tiny inline script in <head> so
// the page never flashes the wrong theme.)
(function () {
    const root = document.documentElement;

    // Dark mode toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const sync = () => themeToggle.setAttribute('aria-pressed', root.classList.contains('dark-mode'));
        sync();
        themeToggle.addEventListener('click', () => {
            root.classList.toggle('dark-mode');
            try { localStorage.setItem('darkMode', root.classList.contains('dark-mode')); } catch (e) { /* storage blocked */ }
            sync();
        });
    }

    // Mobile menu
    const menuButton = document.getElementById('mobile-menu');
    const navMenu = document.getElementById('nav-menu');
    const setMenu = (open) => {
        menuButton.classList.toggle('is-active', open);
        navMenu.classList.toggle('active', open);
        menuButton.setAttribute('aria-expanded', open);
    };
    if (menuButton && navMenu) {
        menuButton.addEventListener('click', () => setMenu(!navMenu.classList.contains('active')));
        document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', () => setMenu(false)));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navMenu.classList.contains('active')) {
                setMenu(false);
                menuButton.focus();
            }
        });
    }

    // Sticky navbar elevation on scroll
    const navbar = document.getElementById('navbar');
    if (navbar) {
        const setNavElevation = () => navbar.classList.toggle('is-scrolled', window.scrollY > 8);
        setNavElevation();
        window.addEventListener('scroll', setNavElevation, { passive: true });
    }
})();
