#!/usr/bin/env python3
"""Build the Pages site: hub page from main + one folder per creation branch.

Every remote branch `creation/<name>` is exported to `<out>/<name>/` (without
docs and tooling files). If the branch has a creation.json
({"title","description","version","entry"}) it is listed on the hub page.
"""
import argparse, base64, html, json, os, shutil, subprocess, tarfile, io

SKIP = {".git", ".github", "docs", "tools", "CLAUDE.md", "README.md", "creation.json"}

def git(*args):
    return subprocess.run(["git", *args], check=True, capture_output=True).stdout

p = argparse.ArgumentParser()
p.add_argument("--out", default="_site")
p.add_argument("--remote", default="origin")
a = p.parse_args()

shutil.rmtree(a.out, ignore_errors=True)
os.makedirs(a.out)

refs = git("for-each-ref", "--format=%(refname:short)", f"refs/remotes/{a.remote}/creation/").decode().split()
cards = []
for ref in sorted(refs):
    name = ref.split("/creation/", 1)[1]
    dest = os.path.join(a.out, name)
    os.makedirs(dest)
    with tarfile.open(fileobj=io.BytesIO(git("archive", ref)), mode="r:") as tar:
        members = [m for m in tar.getmembers() if m.name.split("/")[0] not in SKIP and not m.name.endswith(".py")]
        tar.extractall(dest, members=members)
    meta = {}
    try:
        meta = json.loads(git("show", f"{ref}:creation.json"))
    except Exception:
        pass
    entry = meta.get("entry", "index.html")
    if not os.path.exists(os.path.join(dest, entry)):
        continue
    # icon.png and qr.png sit next to the entry file (which may be in a subfolder)
    base = os.path.dirname(entry)
    icon = os.path.join(base, "icon.png")
    qr = os.path.join(base, "qr.png")
    cards.append((name, meta.get("title", name), meta.get("description", ""),
                  meta.get("version", ""), entry,
                  icon if os.path.exists(os.path.join(dest, icon)) else None,
                  qr if os.path.exists(os.path.join(dest, qr)) else None,
                  meta.get("lang", "en"), meta.get("also", [])))

# Language versions of one creation sit next to each other: by title, English first.
LANGS = {"en": "English", "de": "Deutsch"}
cards.sort(key=lambda c: (c[1].lower(), c[7] != "en", c[0]))

items = ""
for name, title, desc, ver, entry, icon, qr, lang, also in cards:
    items += '<li class="card">'
    if icon:
        items += f'<img class="icon" src="{name}/{icon}" alt="" width="48" height="48">'
    badge = f' <span class="lang">{html.escape(LANGS.get(lang, lang))}</span>'
    items += f'<div class="txt"><h2>{html.escape(title)}{badge} <small>{html.escape(ver)}</small></h2>'
    items += f'<p>{html.escape(desc)}</p><p><a href="{name}/{entry}">Open</a>'
    items += f' · <a href="{name}/{qr}">Install QR</a>' if qr else ""
    for link in also:  # extra links, e.g. a second language inside the same branch
        items += f' · <a href="{name}/{html.escape(link.get("href", ""))}">{html.escape(link.get("label", "More"))}</a>'
    items += '</p></div>'
    if qr:  # embedded, so the QR shows even if the file path is wrong
        data = base64.b64encode(open(os.path.join(a.out, name, qr), "rb").read()).decode()
        items += f'<img class="qr" src="data:image/png;base64,{data}" alt="Install QR for {html.escape(title)}" width="120" height="120">'
    items += '</li>\n'
if not items:
    items = "<li>No creations yet.</li>"

page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>R1 Creations</title>
<style>
:root {{ --bg:#fff; --fg:#111; --muted:#666; --card:#f4f4f4; --accent:#FE5000; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#000; --fg:#eee; --muted:#999; --card:#161616; }} }}
body {{ margin:0; background:var(--bg); color:var(--fg); font:16px/1.5 system-ui,sans-serif; }}
main {{ max-width:720px; margin:0 auto; padding:24px 16px 48px; }}
h1 {{ color:var(--accent); }} small {{ color:var(--muted); font-weight:400; }}
ul {{ list-style:none; padding:0; display:grid; gap:12px; }}
.card {{ display:flex; gap:12px; align-items:center; background:var(--card); border-radius:12px; padding:12px; }}
.txt {{ flex:1; min-width:0; }} h2 {{ margin:0; font-size:18px; }} p {{ margin:4px 0; color:var(--muted); }}
a {{ color:var(--accent); }} .qr {{ background:#fff; border-radius:6px; }}
.icon {{ border-radius:10px; }}
.lang {{ font-size:12px; font-weight:600; color:var(--accent); border:1px solid var(--accent); border-radius:999px; padding:0 7px; vertical-align:middle; }}
</style></head><body><main>
<h1>R1 Creations</h1>
<p>Small web apps for the Rabbit R1 (240&times;282 px). Each creation lives on its own
<code>creation/&lt;name&gt;</code> branch. To install one: on the R1 open the creations card,
choose &ldquo;add via QR code&rdquo; and scan its code. Every creation comes in English and German;
each language version is a separate install with its own save.</p>
<ul>
{items}</ul>
<p><a href="https://github.com/Luxx1993/r1-creations">Source &amp; docs on GitHub</a></p>
</main></body></html>
"""
open(os.path.join(a.out, "index.html"), "w").write(page)
open(os.path.join(a.out, ".nojekyll"), "w").write("")
print("built", a.out, "with", [c[0] for c in cards])
