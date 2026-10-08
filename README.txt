TOFUN LANDING PAGE — DEPLOY NOTES
=================================

What this is
------------
A static one-page site. No build step, no backend, no dependencies to install.

  index.html          the page
  site.webmanifest    PWA manifest (icons, theme colour)
  assets/css/         style.css
  assets/js/          main.js
  assets/img/         logo, favicons, app screenshots, category icons

How to deploy
-------------
1. Upload everything in this folder to the web root of the domain
   (public_html / www / the bucket root), keeping the folder structure as is.
   index.html and site.webmanifest must sit at the root, next to assets/.
2. Serve over HTTPS.
3. Make sure .webmanifest is served as application/manifest+json
   (most hosts do this already).

All asset paths are relative, so the site also works from a subfolder.
The only exception is "start_url": "/" in site.webmanifest — change it if the
site is not at the domain root.

External requests
-----------------
Only Google Fonts (fonts.googleapis.com / fonts.gstatic.com) for Quicksand and
Plus Jakarta Sans. If a Content-Security-Policy is set, allow those two hosts.

To finish once the domain is known
----------------------------------
- index.html, line 12: og:image is a relative path
  (assets/img/tofun-icon-512.png). Social previews need an absolute URL,
  e.g. https://DOMAIN/assets/img/tofun-icon-512.png. Adding og:url and a
  <link rel="canonical"> with the final domain is also recommended.

Still placeholders (waiting on the owner)
-----------------------------------------
- "Tətbiqi endirin" buttons (header, hero, final section) are <span>s with no
  link — App Store / Google Play URLs have not been provided yet.
- App Store / Google Play badges in the client section are disabled and still
  say "Tezliklə".
- Footer links "Məxfilik Siyasəti" and "İstifadə Şərtləri" point to "#" —
  no pages for them yet.

Contacts used on the page
-------------------------
- WhatsApp: +994 50 501 44 84 (set in index.html and assets/js/main.js)
- Email:    info@tofun.app
