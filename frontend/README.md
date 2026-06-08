# IELTS Platform — Frontend

This is the Next.js frontend application for the IELTS practice web platform.

## Quick Start

Ensure you have Node.js 18+ installed.

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

The app will run at [http://localhost:3000](http://localhost:3000). It makes API requests to the backend server running at `http://localhost:8000`.

---

## Architecture & Codebase Cleanup

We restructured this project to keep the `app` route folder clean:
- **`app/`**: Contains only routing handlers and slim container entry points (e.g. `tests/[test]/practice/listening/page.tsx` and `tests/[test]/practice/reading/page.tsx`).
- **`components/`**: Houses all reuseable presentation logic.
  - `components/practice/`: Contains the actual implementation files for test views (`ListeningPractice.tsx` and `ReadingPractice.tsx`).
  - `components/PDFViewer.tsx`: Custom component rendering page scroll view cards of the Cambridge PDFs.
  - `components/ResultModal.tsx`: Band score estimator and grading results popup.

For detailed setup, databases, and assets generation instructions, please refer to the [Root README](file:///d:/Git/practice_IELTS_web/README.md).
