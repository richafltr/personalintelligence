# Personal Intelligence Reasoning Starter

Richa's custom AI reasoning engine, powered by Next.js 15, Vercel AI SDK, and Digital Ocean S3 storage. This project is built to handle deep chat reasoning and image-integrated multimodal conversations.

---

## 🛠 Project Status & Critical To-Dos

> [!CAUTION]
> **Data Integrity Warning**: The current storage architecture is at high risk of data loss due to race conditions in the JSON indexing system. Fixing this is Top Priority.

### 🔴 Immediate Actions (High Priority)
- [ ] **Verify S3 Bucket**: Currently, `lib/storage/s3.ts` fails with `NoSuchBucket`. Confirm the Space `personal-intelligence` exists and is accessible in Digital Ocean `nyc3`.
- [ ] **Abolish `index.json`**: Remove the central `chats/index.json` file. Replace it with a dynamic indexer using `ListObjectsV2Command` to avoid massive data loss from simultaneous writes.
- [ ] **Fix Image Deduplication**: Currently, hashing logic appends `Date.now()`, which breaks deduplication. Modify to use pure file hashes to save space and reduce redundant uploads.
- [ ] **Atomic Message Appends**: Move from "Overwriting entire messages JSON" to "Appending individual message files". This prevents entire conversation truncation during network blips.

### 🟡 Enhancement To-Dos
- [ ] **Database Migration Plan**: Evaluate transitioning the Chat Metadata and Content storage to a relational DB (Postgres) while keeping S3 only for heavy media (Images/Audio).
- [ ] **UI Polish**: Ensure chat history sidebar syncs accurately with the dynamic S3 state.
- [ ] **Reasoning Visibility**: Refine how thinking/reasoning parts are displayed in history.

---

## Features

- **Advanced Reasoning**: Deep integration with Vercel's AI SDK for complex reasoning models.
- **Spaces-backed History**: Chat history and images stored in Digital Ocean Spaces.
- **Multimodal Support**: Drag-and-drop/paste support for images integrated with the AI workflow.
- **Next.js 15 Power**: Built on the latest React and server-side primitives.

---

## Getting Started

1.  **Environment Setup**:
    *   Copy `.env.example` to `.env`.
    *   Fill in Digital Ocean credentials (`SPACES_ACCESS_KEY_ID`, `SPACES_SECRET_ACCESS_KEY`, etc.).
    *   Add your `DO_PAT` if you plan on automating infrastructure checks.

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Run Dev Server**:
    ```bash
    npm run dev
    ```

---

## Architecture Overview

Current (Vulnerable) flow:
`Client Request` → `API Trigger` → `Load Index` → `Update Array` → `Save Full Array to S3`. 

Target (Reliable) flow:
`Client Request` → `API Trigger` → `Insert Message Row to DB` + `Upload Media to S3`.
