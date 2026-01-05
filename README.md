# MD to PDF

A powerful, browser-based Markdown to PDF converter with a premium editing experience.

## Features

- **Split View Editor**: Real-time Markdown editing with a synchronized preview pane.
- **Scroll Sync**: Keep your place in both the editor and preview with intelligent bidirectional scrolling.
- **Visual Table Editor**: Edit Markdown tables with a GUI - change alignments, add rows/cols, and more without wrestling with pipes and dashes.
- **Premium UI**: Clean, accessible interface inspired by Shadcn UI with light/dark mode support.
- **Professional PDF Export**: Generate clean, professional PDFs with customizable margins and styles (e.g., McKinsey/PwC themes).
- **Offline Capable**: Built with SvelteKit and runs entirely in the browser (PWA ready).
- **Internationalization**: Full support for LTR (English) and RTL (Arabic) layouts.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/tabaqatdev/md-to-pdf.git
   cd md-to-pdf
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start the development server:

   ```bash
   pnpm dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) in your browser.

## Deployment

This project is configured to deploy automatically to GitHub Pages via GitHub Actions.

## Architecture

Refers to `ARCHITECTURE.md` for a detailed breakdown of the technical design.
