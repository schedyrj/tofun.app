/* ============================================================
   TOFUN — landing interactions
   Vanilla JS, no dependencies. Every motion path checks
   prefers-reduced-motion and degrades to a static layout.
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var raf = window.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };

  document.addEventListener('DOMContentLoaded', function () {

    /* -------- 1. Mobile navigation -------- */
    (function () {
      var toggle = document.getElementById('menuToggle');
      var nav = document.getElementById('mainNav');
      var scrim = document.getElementById('navScrim');
      if (!toggle || !nav) return;

      function setOpen(open) {
        nav.classList.toggle('open', open);
        if (scrim) scrim.classList.toggle('show', open);
        toggle.setAttribute('aria-expanded', String(open));
        document.body.style.overflow = open ? 'hidden' : '';
      }
      toggle.addEventListener('click', function () {
        setOpen(!nav.classList.contains('open'));
      });
      if (scrim) scrim.addEventListener('click', function () { setOpen(false); });
      nav.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () { setOpen(false); });
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setOpen(false);
      });
    })();

    /* -------- 2. Header state + scroll progress -------- */
    (function () {
      var header = document.querySelector('.site-header');
      var bar = document.querySelector('.scroll-progress');
      var ticking = false;

      function update() {
        var y = window.pageYOffset;
        if (header) header.classList.toggle('is-scrolled', y > 8);
        if (bar) {
          var h = document.documentElement.scrollHeight - window.innerHeight;
          bar.style.setProperty('--p', h > 0 ? Math.min(y / h, 1) : 0);
        }
        ticking = false;
      }
      window.addEventListener('scroll', function () {
        if (!ticking) { raf(update); ticking = true; }
      }, { passive: true });
      update();
    })();

    /* -------- 3. Scroll-reveal -------- */
    (function () {
      var els = document.querySelectorAll('[data-reveal]');
      if (!els.length) return;
      if (reduceMotion || !('IntersectionObserver' in window)) {
        els.forEach(function (el) { el.classList.add('is-in'); });
        return;
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
      els.forEach(function (el) { io.observe(el); });
    })();

    /* -------- 4. Active nav link -------- */
    (function () {
      var links = Array.prototype.slice.call(document.querySelectorAll('.main-nav a'));
      if (!links.length || !('IntersectionObserver' in window)) return;
      var map = {};
      links.forEach(function (a) {
        var id = a.getAttribute('href');
        if (id && id.charAt(0) === '#') {
          var sec = document.querySelector(id);
          if (sec) map[id.slice(1)] = a;
        }
      });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            links.forEach(function (l) { l.classList.remove('is-current'); });
            var active = map[entry.target.id];
            if (active) active.classList.add('is-current');
          }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      Object.keys(map).forEach(function (id) {
        var sec = document.getElementById(id);
        if (sec) io.observe(sec);
      });
    })();

    /* -------- 5. Count-up numbers -------- */
    (function () {
      var els = document.querySelectorAll('[data-count]');
      if (!els.length) return;

      function run(el) {
        var target = parseFloat(el.getAttribute('data-count')) || 0;
        var suffix = el.getAttribute('data-suffix') || '';
        var prefix = el.getAttribute('data-prefix') || '';
        var dur = reduceMotion ? 0 : 1200;
        var startTime = null;
        function frame(ts) {
          if (startTime === null) startTime = ts;
          var t = dur ? Math.min((ts - startTime) / dur, 1) : 1;
          var eased = 1 - Math.pow(1 - t, 3);
          var val = Math.round(target * eased);
          el.textContent = prefix + val.toLocaleString('az-AZ') + suffix;
          if (t < 1) raf(frame);
        }
        raf(frame);
      }

      if (!('IntersectionObserver' in window)) {
        els.forEach(run);
        return;
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { run(entry.target); io.unobserve(entry.target); }
        });
      }, { threshold: 0.5 });
      els.forEach(function (el) { io.observe(el); });
    })();

    /* -------- 6. Hero parallax + pointer tilt -------- */
    (function () {
      if (reduceMotion) return;
      var stage = document.querySelector('.hero-stage');
      if (!stage) return;
      var layers = Array.prototype.slice.call(stage.querySelectorAll('.layer'));
      var pointerX = 0, pointerY = 0, scrollShift = 0, ticking = false;

      function apply() {
        layers.forEach(function (layer) {
          var depth = parseFloat(layer.getAttribute('data-depth')) || 10;
          var f = depth / 100;
          var tx = pointerX * depth * 0.5;
          var ty = pointerY * depth * 0.5 + scrollShift * f;
          layer.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0)';
        });
        ticking = false;
      }
      function schedule() { if (!ticking) { raf(apply); ticking = true; } }

      if (finePointer) {
        stage.addEventListener('pointermove', function (e) {
          var r = stage.getBoundingClientRect();
          pointerX = (e.clientX - r.left) / r.width - 0.5;
          pointerY = (e.clientY - r.top) / r.height - 0.5;
          schedule();
        });
        stage.addEventListener('pointerleave', function () {
          pointerX = 0; pointerY = 0; schedule();
        });
      }
      window.addEventListener('scroll', function () {
        var r = stage.getBoundingClientRect();
        scrollShift = (r.top + r.height / 2 - window.innerHeight / 2) * -0.06;
        schedule();
      }, { passive: true });
    })();

    /* -------- 7. Walkthrough (scroll-linked panel swap) --------
       Scoped per .walk-layout so multiple walkthroughs on one page
       (e.g. business #axin and customer #musterilar) run independently —
       a global querySelectorAll would let their same-numbered steps/panels
       cross-activate each other. */
    (function () {
      if (!('IntersectionObserver' in window)) return;
      var layouts = Array.prototype.slice.call(document.querySelectorAll('.walk-layout'));
      layouts.forEach(function (layout) {
        var steps = Array.prototype.slice.call(layout.querySelectorAll('.walk-step'));
        var panels = Array.prototype.slice.call(layout.querySelectorAll('.walk-panel'));
        if (!steps.length || !panels.length) return;

        function activate(idx) {
          steps.forEach(function (s, i) { s.classList.toggle('is-active', i === idx); });
          panels.forEach(function (p, i) { p.classList.toggle('is-active', i === idx); });
        }
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var idx = parseInt(entry.target.getAttribute('data-step'), 10) || 0;
              activate(idx);
            }
          });
        }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
        steps.forEach(function (s) { io.observe(s); });
      });
    })();

    /* -------- 8. "How it works" line draw -------- */
    (function () {
      var track = document.querySelector('.how-track');
      if (!track || !('IntersectionObserver' in window)) return;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { track.classList.add('is-in'); io.disconnect(); }
        });
      }, { threshold: 0.4 });
      io.observe(track);
    })();

    /* -------- 9. FAQ accordion (animated height) -------- */
    (function () {
      var items = Array.prototype.slice.call(document.querySelectorAll('.acc-item'));
      if (!items.length) return;

      function setHeight(item, open) {
        var panel = item.querySelector('.acc-panel');
        var inner = item.querySelector('.acc-panel-inner');
        if (!panel || !inner) return;
        panel.style.height = open ? inner.offsetHeight + 'px' : '0px';
      }

      items.forEach(function (item) {
        var trigger = item.querySelector('.acc-trigger');
        setHeight(item, item.classList.contains('open'));
        trigger.addEventListener('click', function () {
          var isOpen = item.classList.contains('open');
          items.forEach(function (other) {
            if (other !== item) {
              other.classList.remove('open');
              other.querySelector('.acc-trigger').setAttribute('aria-expanded', 'false');
              setHeight(other, false);
            }
          });
          item.classList.toggle('open', !isOpen);
          trigger.setAttribute('aria-expanded', String(!isOpen));
          setHeight(item, !isOpen);
        });
      });

      function recalc() {
        items.forEach(function (item) { setHeight(item, item.classList.contains('open')); });
      }
      window.addEventListener('resize', recalc);
      window.addEventListener('load', recalc);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(recalc);
    })();

    /* -------- 10. Magnetic buttons -------- */
    (function () {
      if (reduceMotion || !finePointer) return;
      var btns = document.querySelectorAll('.btn.magnetic');
      btns.forEach(function (btn) {
        var strength = 0.28;
        btn.addEventListener('pointermove', function (e) {
          var r = btn.getBoundingClientRect();
          var x = (e.clientX - r.left - r.width / 2) * strength;
          var y = (e.clientY - r.top - r.height / 2) * strength;
          btn.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        });
        btn.addEventListener('pointerleave', function () {
          btn.style.transform = '';
        });
      });
    })();

    /* -------- 11. Smooth anchor scroll (with header offset) -------- */
    (function () {
      document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          var id = a.getAttribute('href');
          if (id === '#' || id === '#top') return;
          var target = document.querySelector(id);
          if (!target) return;
          e.preventDefault();
          var top = target.getBoundingClientRect().top + window.pageYOffset - 84;
          window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
          try { history.replaceState(null, '', id); } catch (err) { /* file:// */ }
        });
      });
    })();

    /* -------- 12. WhatsApp CTA link -------- */
    (function () {
      var cta = document.getElementById('whatsappCta');
      if (!cta) return;
      var phone = '994505014484';
      var text = encodeURIComponent('Salam! Tofun ilə maraqlanıram və başlamaq üçün pulsuz dəstək almaq istəyirəm.');
      cta.setAttribute('href', 'https://wa.me/' + phone + '?text=' + text);
      cta.setAttribute('target', '_blank');
      cta.setAttribute('rel', 'noopener');
    })();

    /* -------- 13. Card spotlight (cursor-follow glow) --------
       Feature/trust/industry cards read --mx/--my as a CSS radial-gradient
       position (see style.css). Mouse-only — touch has no hover to show it. */
    (function () {
      if (!finePointer) return;
      var cards = document.querySelectorAll('.f-card, .trust-card, .ind-card');
      cards.forEach(function (card) {
        card.addEventListener('pointermove', function (e) {
          var r = card.getBoundingClientRect();
          card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
          card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
        });
      });
    })();

  });
})();
