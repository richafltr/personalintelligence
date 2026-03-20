# Personal Intelligence Reasoning Starter

Richa's custom AI reasoning engine, powered by Next.js 15, Vercel AI SDK, and Digital Ocean S3 storage. Built to handle deep chat reasoning and image-integrated multimodal conversations.

---

## 🛠 Project Status & Recent Progress

> [!NOTE]
> **Recent Updates**: We have successfully stabilized the foundational storage and React routing architectures. Chat persistence is now rock-solid in deployment.

### 🟢 Completed Integrations
- [x] **Chat Persistence & Deployment**: Fixed S3 integration issues. Verified stable chat history loading and synchronization in Vercel preview environments ([PR #2](https://github.com/richafltr/personalintelligence/pull/2)).
- [x] **First-Message Disappearance Fix**: Replaced `router.push` with `window.history.replaceState` inside the Next.js App Router tree to prevent component unmounting when a new session UUID is generated. Messages no longer abort midway ([PR #4](https://github.com/richafltr/personalintelligence/pull/4), [Issue #3](https://github.com/richafltr/personalintelligence/issues/3)).
- [x] **Storage Refactoring (Data Integrity)**: Eliminated central `index.json` race conditions, utilizing per-message JSON saving and atomic image hashing.

### 🔴 Immediate Action Items (High Priority)
- [ ] **Dedicated Multimodal Inference Integration**: Digital Ocean's Serverless Inference API is currently restricted to text-only completions. Set up a dedicated Digital Ocean GPU Droplet (via 1-Click Hugging Face deployments) running **Llama 3.2 Vision** or **Qwen2-VL** to enable true multimodal image inputs and processing.
- [ ] **Image Generation Support**: Evaluate connecting an open-source diffusion model (like Stable Diffusion 3 or FLUX.1) to allow the LLM to process conversational requests for image _output_.

### 🟡 Enhancement To-Dos
- [ ] **Database Migration Plan**: Evaluate transitioning the Chat Metadata indexing to a relational DB (Postgres) if history grows beyond ~1000 active chats, leaving only payloads and binaries in S3.
- [ ] **UI Polish**: Refine how `<think>` reasoning tags are displayed during active streaming versus historical viewing in the sidebar.

---

## Features

- **Advanced Reasoning**: Deep integration with Vercel's AI SDK for complex reasoning models (Nemotron, GLM, DeepSeek distillations).
- **Spaces-backed History**: Chat history and images stored robustly in Digital Ocean Spaces.
- **Next.js 15 Power**: Built on the latest React, server-side primitives, and optimized state updates.

---

## Getting Started

1.  **Environment Setup**:
    *   Copy `.env.example` to `.env`.
    *   Fill in Digital Ocean credentials (`SPACES_ACCESS_KEY_ID`, `SPACES_SECRET_ACCESS_KEY`, etc.).
    *   Fill in Model Inference keys (`MODEL_ACCESS_KEY`).

2.  **Install Dependencies**:
    ```bash
    pnpm install
    ```

3.  **Run Dev Server**:
    ```bash
    pnpm dev
    ```

---

## 🚀 One-Click Deployment

Deploy your own version of Richa's Personal Intelligence to Vercel with all environment variables pre-configured:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frichafltr%2Fpersonalintelligence&env=SPACES_ACCESS_KEY_ID,SPACES_SECRET_ACCESS_KEY,SPACES_ENDPOINT,SPACES_BUCKET,SPACES_REGION,MODEL_ACCESS_KEY,NVIDIA_API_KEY,NEXT_PUBLIC_API_URL&envDescription=DigitalOcean%20Spaces%20and%20Model%20Inference%20Keys&envLink=https%3A%2F%2Fcloud.digitalocean.com%2Fsettings%2Fapi%2Ftokens)

---

## Architecture Overview

**Current flow (Reliable & Atomic):**
`Client Request` → `API Trigger` → `Load Metadata` → `Save individual message JSON to DO Space` → `Process Image Hashes` → `Return Stream`.

**Storage Strategy:**
*   `/chats/[chatId]/metadata.json`: Source of truth for history list.
*   `/chats/[chatId]/messages/[paddedIndex]-[msgId].json`: Individual message atomic files.
*   `/chats/[chatId]/images/[hash].png`: Deduplicated binary media.
