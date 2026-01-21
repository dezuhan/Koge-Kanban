<img width="1500" height="900" alt="Koge Kanban Thumbnail" src="https://github.com/user-attachments/assets/5a7e69bc-0358-46d3-bdae-e85461daa030" />

# Koge Kanban

A powerful, secure, and streamlined Kanban board featuring multi-user support, user data isolation, and integrated AI assistant via Ollama. Built with React and Node.js, using SQLite for local-first efficiency.

## Key Features

*   👥 **Multi-User System**: Full authentication (Login/Register) with secure JWT tokens.
*   🔒 **Data Isolation**: Each user gets their own private workspace, boards, and tasks.
*   🛡️ **Modern Security**: Isolated user data, protected AI endpoints, and secure JWT-based sessions.
*   🤖 **Integrated AI Assistant**: 
    *   **Auto-Fill**: AI can generate task descriptions, categories, and subtasks.
    *   **Chat Ops**: Create, update, and manage tasks via natural language chat.
    *   **Auto-Split**: Automatically split complex tasks into detailed subtasks.
*   💾 **Secure Backup & Restore**: Export/Import your data as encrypted-friendly JSON files, isolated per user.
*   ✨ **Rich Aesthetics**: Modern UI with glassmorphism, smooth animations, and responsive design.
*   🚀 **Self-Updating Backend**: The `server.js` can automatically sync with the latest version from GitHub.

## Prerequisites

*   **Node.js**: Version 20.x or higher.
*   **Ollama**: Required for AI features ([ollama.com](https://ollama.com/)).
*   **SQLite**: Handled automatically via `better-sqlite3` (no setup required).

## Quick Start

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/dezuhan/Koge-Kanban.git
    cd Koge-Kanban
    npm install
    ```

2.  **Environment Setup**:
    Copy `.env.example` to `.env` and configure your keys:
    ```bash
    cp .env.example .env
    ```
    *Note: Make sure to generate a secure `JWT_SECRET`.*

3.  **Run Development**:
    ```bash
    npm run dev
    ```
    Access at `http://localhost:5173`.

## Deployment Options

### 1. Fully Local
Run everything on your machine. All data stays in the `db/kanban.db` file.

### 2. Hybrid Mode (Remote Frontend + Local Gateway)
Use the hosted frontend (e.g., [koge-kanban.vercel.app](https://koge-kanban.vercel.app)) while keeping your data securely on your own local machine.

---

## ⚡ Quick Server Setup (No Clone Needed)
If you only want to host your data locally and use a public frontend, follow these steps:

1.  **Prepare Folder**:
    ```powershell
    mkdir koge-server; cd koge-server
    ```
2.  **Initialize & Install**:
    ```powershell
    npm init -y
    npm pkg set type="module"
    npm install express better-sqlite3 cors dotenv helmet bcryptjs jsonwebtoken
    ```
3.  **Get Server File**:
    Download `server.js` from the [official repo](https://raw.githubusercontent.com/dezuhan/Koge-Kanban/main/server.js).
4.  **Configure**:
    Create a `.env` file with your `JWT_SECRET` and `ALLOWED_ORIGINS`.
5.  **Run**:
    ```bash
    node server.js
    ```
6.  **Connect**: Open the public frontend and enter `http://localhost:3000` in the **Database Configuration** settings.

---

## Security & Privacy (v3.0+)

The latest version implements strict security protocols:
-   **User Scoping**: Every database query is filtered by `user_id`.
-   **JWT Protection**: All sensitive API routes (AI, Backups, Data) require a valid token.
-   **No Plain-Text Passwords**: Passwords are hashed using `bcryptjs`.
-   **Auto-Cleanup**: Expired trash and old logs are automatically cleared per user settings.

## Configuration (.env)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DB_PATH` | Path to SQLite database file | `db/kanban.db` |
| `JWT_SECRET` | Secret key for signing tokens | *Required* |
| `ALLOWED_ORIGINS` | CORS whitelist (comma separated) | `http://localhost:5173` |
| `OLLAMA_HOST` | URL for the Ollama API | `http://127.0.0.1:11434` |
| `PORT` | Backend server port | `3000` |

## AI Assistant Usage

The ChatBot (bottom right) understands commands like:
-   `create a task to fix the navbar in the Web Project`
-   `list all urgent tasks`
-   `elaborate on task "Database Setup"`
-   `@split`: Triggers the AI to break down the current task into subtasks.

---
Built with ❤️ by [Dezuhan](https://github.com/dezuhan)
