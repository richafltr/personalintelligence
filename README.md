# Personal Intelligence Reasoning Starter

Richa's custom AI reasoning engine, powered by Next.js 15, Vercel AI SDK, and Digital Ocean S3 storage. This project is built to handle deep chat reasoning and image-integrated multimodal conversations.

---

## 🛠 Project Status & Critical To-Dos

> [!CAUTION]
> **Data Integrity Warning**: The current storage architecture is at high risk of data loss due to race conditions in the JSON indexing system. Fixing this is Top Priority.

### 🔴 Immediate Actions (High Priority)
- [x] **Verify S3 Bucket**: Successfully verified `personal-intelligence` bucket via DO PAT.
- [x] **Abolish `index.json`**: Removed central index; implemented dynamic S3 listing.
- [x] **Fix Image Deduplication**: Implemented pure content hashing.
- [x] **Atomic Message Appends**: Implemented individual per-message JSON storage.

### 🟡 Enhancement To-Dos
- [x] **Delete Functionality**: Added sidebar delete button for chats.
- [x] **Expanded Model Support**: Added GPT-OSS 120B Managed Inference.
- [ ] **Database Migration Plan**: Evaluate transitioning the Chat Metadata to a relational DB (Postgres) if history grows beyond ~1000 chats.
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
