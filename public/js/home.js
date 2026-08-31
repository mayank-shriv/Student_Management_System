const menuButton = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('.site-nav');

menuButton?.addEventListener('click', () => {
    const isOpen = siteNav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
});

document.querySelectorAll('.site-nav a').forEach((link) => {
    link.addEventListener('click', () => {
        siteNav.classList.remove('open');
        menuButton?.setAttribute('aria-expanded', 'false');
    });
});

document.querySelector('#contact-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    event.currentTarget.reset();
    const success = event.currentTarget.querySelector('.form-success');
    success.hidden = false;
});
