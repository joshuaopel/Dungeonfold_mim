#!/usr/bin/env python3
"""Sync the shared engine into both Dungeonfolk HTML files.
Edit engine.js (the single source of truth), then run:  python3 build_engine.py
It replaces the region between the ENGINE markers in each HTML file.
Both the game and the forge inline the SAME engine, so the sim/render code
never diverges again. The files stay single-file (Steam/Electron safe)."""
import sys,os
MARK_OPEN='/* ===== SHARED ENGINE (generated from engine.js — do not edit here; run build_engine.py) ===== */'
MARK_CLOSE='/* ===== END SHARED ENGINE ===== */'
import sys as _s
TARGETS=_s.argv[1:] or ['dungeonfolk-mims-adventure.html','dungeonfolk-forge.html']

def sync(engine_body, html_fn):
    s=open(html_fn,encoding='utf-8').read()
    a=s.find(MARK_OPEN); b=s.find(MARK_CLOSE)
    if a<0 or b<0:
        print('  !! markers not found in',html_fn); return False
    new=s[:a]+MARK_OPEN+'\n'+engine_body+s[b:]
    if new==s:
        print('  =',html_fn,'(already in sync)'); return True
    open(html_fn+'.tmp','w',encoding='utf-8').write(new); os.replace(html_fn+'.tmp',html_fn)
    print('  ->',html_fn,'updated'); return True

def main():
    engine=open('engine.js',encoding='utf-8').read()
    if not engine.endswith('\n'): engine+='\n'
    print('Syncing engine.js (%d lines) into %d files:'%(engine.count('\n'),len(TARGETS)))
    ok=all(sync(engine,t) for t in TARGETS)
    sys.exit(0 if ok else 1)

if __name__=='__main__': main()
