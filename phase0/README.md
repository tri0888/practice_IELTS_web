# IELTS Platform — Phase 0 Data Pipeline

This directory contains the Python ingestion scripts that parse raw test PDFs and answers keys into standardized, clean JSON outputs.

## Pipeline Actions

1. **`generate_all_contents.py`**:
   - Parses the Cambridge IELTS 11 test PDF (`Cambridge-IELTS-11-Academic.pdf`).
   - Extracts Reading passages, Listening instructions, Writing Tasks (1 & 2), and Speaking prompts.
   - Outputs JSON content files for all 4 tests in the `phase0/output/` directory.

2. **`import_cambridge_11.py`**:
   - Parses the answer keys and Vietnamese explanation sheets.
   - Outputs a unified seed database manifest `cambridge_11_seed.json`.

---

## Running Ingestion

To run the data extraction:

```bash
# Install dependencies
pip install -r phase0/requirements.txt

# Run main content extractor
python phase0/generate_all_contents.py

# Run answers & explanations importer
python phase0/import_cambridge_11.py
```

For more info, check the [Root README](file:///d:/Git/practice_IELTS_web/README.md).