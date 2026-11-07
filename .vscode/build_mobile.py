#!/usr/bin/env python3
"""Build script for Capacitor mobile packaging.
Copies web shell, pages, and assets to `www/` while omitting node_modules,
git tracking, build artifacts, and heavy video binaries.
"""

import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, "www")

INCLUDE_DIRS = [
    "admin",
    "clips",
    "discipline",
    "disciplines",
    "explore",
    "forgot-password",
    "home",
    "library",
    "login",
    "profile",
    "reset-password",
    "search",
    "signup",
    "assets",
]

INCLUDE_FILES = [
    "index.html",
    "manifest.webmanifest",
    "sw.js",
]

def build():
    if os.path.exists(TARGET):
        shutil.rmtree(TARGET)
    os.makedirs(TARGET, exist_ok=True)

    for fname in INCLUDE_FILES:
        src = os.path.join(ROOT, fname)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(TARGET, fname))

    def ignore_patterns(path, names):
        # Exclude large videos from being bundled into the native APK/IPA
        ignored = set()
        for name in names:
            if name.endswith(".mp4") or name == ".DS_Store":
                ignored.add(name)
        return ignored

    for dname in INCLUDE_DIRS:
        src = os.path.join(ROOT, dname)
        if os.path.exists(src):
            dst = os.path.join(TARGET, dname)
            shutil.copytree(src, dst, ignore=ignore_patterns)

    print(f"Mobile build bundle ready at: {TARGET}")

if __name__ == "__main__":
    build()

