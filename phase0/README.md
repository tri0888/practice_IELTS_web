# Phase 0 - Cambridge IELTS 11 seed import

This folder contains a small import pipeline for the Cambridge IELTS 11 sample that ships with the workspace.

## What it does

- Locates the Cambridge IELTS 11 source PDF and audio files.
- Extracts the reading answer key from the PDF.
- Collects the 16 listening audio assets (`4 tests x 4 sections`).
- Writes a JSON seed manifest at `phase0/output/cambridge_11_seed.json`.

## Run

```bash
C:/Users/trand/AppData/Local/Programs/Python/Python310/python.exe phase0/import_cambridge_11.py
```

You can override the output path with `--output`.