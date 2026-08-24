# -*- coding: utf-8 -*-
# extract_i18n_catalog.py — extrait le catalogue COMPLET des chaînes UI de la démo (longue traîne)
# Usage : python3 extract_i18n_catalog.py demo/olive-demo.html data/i18n-catalog.json data/i18n-core.json
# Claude Code : compléter en/de/ar (passe de traduction + relecture), réinjecter dans I18N_CORE du runtime.
import re, json, sys, collections
src = open(sys.argv[1], encoding='utf-8').read()
core = json.load(open(sys.argv[3], encoding='utf-8')) if len(sys.argv) > 3 else {}
# Positions UI : 3e+ argument de createElement, placeholder/title/label, chaînes des options
ui = []
ui += re.findall(r'React\.createElement\([^)]{0,200}?\},\s*"((?:[^"\\]|\\.){2,400}?)"', src)
ui += re.findall(r'(?:placeholder|title)\s*:\s*"((?:[^"\\]|\\.){2,400}?)"', src)
ui += re.findall(r'\[\s*"[A-Z_]{2,}"\s*,\s*"((?:[^"\\]|\\.){2,120}?)"\s*\]', src)  # paires [valeur, libellé]
ui += re.findall(r'(?:nom|label|desc|descH|given|when|then|txt|calc)\s*:\s*"((?:[^"\\]|\\.){4,600}?)"', src)
def keep(s):
    s2 = s.encode().decode('unicode_escape', errors='ignore') if '\\u' in s else s
    if not re.search(r'[A-Za-zÀ-ÿ\u0600-\u06FF]{3}', s2): return False
    if re.search(r'(px|solid|rgba?\(|#[0-9a-fA-F]{3,8}|linear-gradient|translate|inset|monospace|sans-serif)', s2): return False
    if re.match(r'^[A-Z0-9_\-./:%€$ ]+$', s2): return False
    return True
cnt = collections.Counter(s for s in ui if keep(s))
cat = []
for s, n in cnt.most_common():
    key = s
    pre = core.get(key)
    cat.append(dict(fr=key, occurrences=n,
                    en=(pre[0] if pre else ""), de=(pre[1] if pre else ""), ar=(pre[2] if pre else "")))
done = sum(1 for c in cat if c["en"])
out = dict(catalog="i18n-olive-demo", note="fr = clé source. Compléter en/de/ar ; chaînes avec segments dynamiques : traduire la partie statique, conserver la structure.",
           stats=dict(unique=len(cat), translated_core=done, coverage_pct=round(100*done/max(1,len(cat)),1)), entries=cat)
json.dump(out, open(sys.argv[2],'w',encoding='utf-8'), ensure_ascii=False, indent=1)
print("catalogue:", len(cat), "chaînes uniques | pré-traduites (cœur):", done, "| couverture:", out["stats"]["coverage_pct"], "%")
