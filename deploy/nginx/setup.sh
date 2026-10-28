#!/usr/bin/env bash
# tofun.app — nginx ayarını bir əmrlə qurur.
#
# Sunucuda, saytın klasöründə (git pull-dan sonra):
#
#     sudo bash deploy/nginx/setup.sh
#
# Nə edir:
#   1. tofun.app-in nginx server blokunu tapır (`server_name tofun.app`, `root`-u olan blok);
#   2. `root` sətrinin altına bir sətir yazır:
#          include <root>/deploy/nginx/tofun.app.locations.conf;
#   3. `nginx -t` keçməsə faylı olduğu kimi geri qaytarır; keçərsə nginx-i reload edir;
#   4. linkləri sunucunun özündən yoxlayır (Cloudflare-dən keçmədən).
#
# Təkrar işə salmaq zərərsizdir: sətir artıq varsa yenidən yazılmır.
# Köhnə fayllar /root/tofun-nginx-backup/ altına saxlanılır — sites-enabled-ə
# yox, çünki nginx oradakı HƏR faylı oxuyur.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "sudo ile çalıştır:  sudo bash $0"
    exit 1
fi
command -v nginx >/dev/null || { echo "nginx bulunamadı"; exit 1; }
command -v python3 >/dev/null || { echo "python3 bulunamadı"; exit 1; }

python3 - <<'PY'
import glob, os, re, shutil, subprocess, sys, time

SNIPPET = 'deploy/nginx/tofun.app.locations.conf'


def config_files():
    seen, out = set(), []
    for pattern in ('/etc/nginx/sites-enabled/*', '/etc/nginx/conf.d/*.conf', '/etc/nginx/nginx.conf'):
        for path in sorted(glob.glob(pattern)):
            real = os.path.realpath(path)
            if os.path.isfile(real) and real not in seen:
                seen.add(real)
                out.append(real)
    return out


def blank_comments(text):
    # Şərhlər boşluqla əvəz olunur — mövqelər dəyişmir.
    return re.sub(r'#[^\n]*', lambda m: ' ' * len(m.group(0)), text)


def server_blocks(clean):
    for m in re.finditer(r'\bserver\s*\{', clean):
        body_start, depth, i = m.end(), 1, m.end()
        while i < len(clean) and depth:
            if clean[i] == '{':
                depth += 1
            elif clean[i] == '}':
                depth -= 1
            i += 1
        yield body_start, i - 1


def top_level(body):
    # İç blokları (location, if…) boşluqla örtür — yalnız server səviyyəsi qalır.
    out, depth = list(body), 0
    for k, ch in enumerate(body):
        if ch == '{':
            depth += 1
            out[k] = ' '
        elif ch == '}':
            depth -= 1
            out[k] = ' '
        elif depth > 0:
            out[k] = ' '
    return ''.join(out)


plans, already, missing = [], [], []

for path in config_files():
    text = open(path, encoding='utf-8', errors='replace').read()
    clean = blank_comments(text)
    inserts = []
    for start, end in server_blocks(clean):
        body = clean[start:end]
        top = top_level(body)
        names = re.search(r'\bserver_name\s+([^;]+);', top)
        if not names or 'tofun.app' not in names.group(1).split():
            continue
        root = re.search(r'\broot\s+([^;]+);', top)
        if not root:
            continue  # yalnız yönləndirən blok
        root_dir = root.group(1).strip().strip('"\'').rstrip('/')
        if 'tofun.app.locations.conf' in text[start:end]:
            already.append((path, root_dir))
            continue
        snippet = os.path.join(root_dir, SNIPPET)
        if not os.path.isfile(snippet):
            missing.append((path, root_dir))
            continue
        line_end = text.find('\n', start + root.end())
        line_end = len(text) if line_end == -1 else line_end
        indent = re.match(r'[ \t]*', text[text.rfind('\n', 0, start + root.start()) + 1:]).group(0) or '    '
        inserts.append((line_end, f'\n{indent}# tofun.app — paylaşım linkləri və tətbiq təsdiqi (deploy/nginx/setup.sh)\n'
                                  f'{indent}include {snippet};'))
    if inserts:
        plans.append((path, text, inserts))

for path, root_dir in already:
    print(f'✔ Zaten ekli: {path} (site: {root_dir})')

if missing:
    for path, root_dir in missing:
        print(f'✘ {root_dir}/{SNIPPET} yok. Önce sitenin klasöründe git pull yap:  cd {root_dir} && git pull')
    sys.exit(1)

if not plans and not already:
    print('✘ tofun.app için "root" satırı olan bir nginx server bloku bulunamadı.')
    print('  Şu çıktıyı gönder:  sudo nginx -T 2>/dev/null | grep -nE "server_name|root|listen"')
    sys.exit(1)

if plans:
    backup = f'/root/tofun-nginx-backup/{time.strftime("%Y%m%d-%H%M%S")}'
    os.makedirs(backup, exist_ok=True)
    for path, text, inserts in plans:
        shutil.copy2(path, os.path.join(backup, os.path.basename(path)))
        new = text
        for pos, line in sorted(inserts, reverse=True):
            new = new[:pos] + line + new[pos:]
        open(path, 'w', encoding='utf-8').write(new)
        print(f'✔ Eklendi: {path}')

    test = subprocess.run(['nginx', '-t'], capture_output=True, text=True)
    if test.returncode != 0:
        for path, text, _ in plans:
            open(path, 'w', encoding='utf-8').write(text)
        print('✘ nginx -t hata verdi, dosyalar eski haline döndürüldü. Hiçbir şey değişmedi:')
        print(test.stderr.strip())
        sys.exit(1)

    reload = subprocess.run(['systemctl', 'reload', 'nginx'], capture_output=True, text=True)
    if reload.returncode != 0:
        subprocess.run(['nginx', '-s', 'reload'], check=True)
    print(f'✔ nginx yeniden yüklendi (eski dosyalar: {backup})')
    # Reload anidir deyil: köhnə işçilər bir an da cavab verir.
    time.sleep(2)


def probe(path):
    if not shutil.which('curl'):
        return 'curl yok, kontrol atlandı'
    for scheme, port in (('https', 443), ('http', 80)):
        r = subprocess.run(['curl', '--noproxy', '*', '-sk', '-o', '/dev/null', '-w', '%{http_code} %{content_type} %{redirect_url}',
                            '--max-time', '6', '--resolve', f'tofun.app:{port}:127.0.0.1', f'{scheme}://tofun.app{path}'],
                           capture_output=True, text=True)
        out = r.stdout.strip()
        if out and not out.startswith('000'):
            return f'{scheme} → {out}'
    return 'sunucuya bağlanılamadı'


print('\nSunucunun kendisinden kontrol (Cloudflare olmadan):')
for path, want in (('/s/1', '200'), ('/.well-known/apple-app-site-association', '200 application/json'),
                   ('/.well-known/assetlinks.json', '200 application/json')):
    print(f'  {path:44} {probe(path)}   (beklenen: {want})')
print('\nTelefonda hâlâ eski sayfa / 404 görünüyorsa: Cloudflare → Caching → Purge Everything.')
PY
