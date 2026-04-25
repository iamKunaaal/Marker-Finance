// Banks marquee: clone tiles for seamless infinite scroll
document.querySelectorAll('.banks-row').forEach((row) => {
  const tiles = Array.from(row.children);
  tiles.forEach((tile) => {
    const clone = tile.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    row.appendChild(clone);
  });
});

// Process rail animation
const processRail = document.querySelector('.process-rail');
if (processRail && 'IntersectionObserver' in window) {
  const rio = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        processRail.classList.add('in-view');
        rio.unobserve(processRail);
      }
    });
  }, { threshold: 0.5 });
  rio.observe(processRail);
}

// Compare list staggered reveal
const compareItems = document.querySelectorAll('.compare-list li');
if (compareItems.length && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const li = entry.target;
        const idx = Array.from(li.parentElement.children).indexOf(li);
        li.style.transitionDelay = `${idx * 80}ms`;
        li.classList.add('in-view');
        io.unobserve(li);
      }
    });
  }, { threshold: 0.2 });
  compareItems.forEach((li) => io.observe(li));
}

// Count-up stats
const counters = document.querySelectorAll('.stat-value[data-target]');
if (counters.length && 'IntersectionObserver' in window) {
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  const animate = (el) => {
    const target = parseFloat(el.dataset.target);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const duration = 1800;
    const start = performance.now();

    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const val = target * ease(progress);
      el.textContent = prefix + val.toFixed(decimals) + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = prefix + target.toFixed(decimals) + suffix;
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animate(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });

  counters.forEach((c) => io.observe(c));
}

// Hero typing effect
const heroH1 = document.querySelector('.hero-card h1');
if (heroH1) {
  const original = heroH1.innerHTML;
  heroH1.innerHTML = '<span class="type-cursor"></span>';
  heroH1.classList.add('is-typing');

  let i = 0;
  let built = '';
  const total = original.length;

  const step = () => {
    if (i >= total) {
      heroH1.innerHTML = built;
      heroH1.classList.remove('is-typing');
      return;
    }
    if (original[i] === '<') {
      const close = original.indexOf('>', i);
      built += original.substring(i, close + 1);
      i = close + 1;
      heroH1.innerHTML = built + '<span class="type-cursor"></span>';
      setTimeout(step, 0);
    } else {
      built += original[i];
      i++;
      heroH1.innerHTML = built + '<span class="type-cursor"></span>';
      const ch = original[i - 1];
      const delay = ch === ' ' ? 35 : ch === ',' || ch === '.' || ch === '—' ? 180 : 45;
      setTimeout(step, delay);
    }
  };

  setTimeout(step, 400);
}

// Shrink/darken navbar on scroll
const navbar = document.querySelector('.navbar');
if (navbar) {
  const onScroll = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// Mobile nav toggle
const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.nav-links');
if (toggle && links) {
  toggle.addEventListener('click', () => {
    toggle.classList.toggle('open');
    links.classList.toggle('open');
  });
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      toggle.classList.remove('open');
      links.classList.remove('open');
    });
  });
}

// Reviews marquee: duplicate cards for seamless infinite loop
document.querySelectorAll('.reviews-row').forEach((row) => {
  const cards = Array.from(row.children);
  cards.forEach((card) => {
    const clone = card.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    row.appendChild(clone);
  });
});
