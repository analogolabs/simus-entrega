#!/usr/bin/env python3
"""Comprueba que los enlaces relativos de los documentos Markdown del repositorio apuntan a algo que existe.

Uso: python3 scripts/documentos/comprobar-enlaces-docs.py   (desde la raíz). Sale con 1 si hay enlaces rotos.
Ignora enlaces externos, anclas y bloques de código.
"""
import re,os,subprocess,sys
files=subprocess.check_output(['git','ls-files','*.md'],text=True).split('\n')
files=[f for f in files if f and 'node_modules' not in f]
bad=[]
for f in files:
    t=open(f,encoding='utf-8').read()
    t=re.sub(r'```.*?```','',t,flags=re.S)
    for m in re.finditer(r'\[[^\]]*\]\(([^)\s]+)\)',t):
        u=m.group(1)
        if re.match(r'(https?:|mailto:|#)',u): continue
        p=u.split('#')[0]
        if not p: continue
        full=os.path.normpath(os.path.join(os.path.dirname(f),p))
        if not os.path.exists(full): bad.append((f,u))
for b in bad: print('  ROTO', *b)
print(len(files),'documentos;',len(bad),'enlaces rotos')
sys.exit(1 if bad else 0)
