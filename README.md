<img width="1500" height="900" alt="Koge Kanban Thumbnail" src="https://github.com/user-attachments/assets/5a7e69bc-0358-46d3-bdae-e85461daa030" />

# Koge Kanban

A streamlined Kanban board featuring drag-and-drop management, table views, and project organization. This application requires a MariaDB server for data persistence and supports optional AI integration via Ollama.

## Features

*   **Project Management**: Create multiple projects/workspaces.
*   **Kanban Board**: Drag-and-drop tasks between custom columns.
*   **Hybrid API Mode**: Use any backend endpoint (Localhost, Ngrok, or Custom Domain) directly from the UI.
*   **Integrated AI Assistant (Optional)**: 
    *   **Admin AI**: AI can perform CRUD operations (create, update, delete) directly on your board.
    *   **Global Context**: Tag boards with `@[board name]` to let AI read data from other projects.
    *   **Secure Integration**: Server-side configured AI endpoints preventing SSRF.
*   **Local Privacy**: Uses local LLMs so your data stays private.
*   **Database Driven**: Data is stored in a MariaDB database.

## Prerequisites

*   **Node.js**: Version 18.0.0 or higher.
*   **MariaDB**: Required for data storage.
*   **Ollama**: Required for AI features ([ollama.com](https://ollama.com/)).
*   **Ngrok** (Optional): Required if you are using the public Vercel version with local AI.

## Security Note (New)

The codebase has been updated with enhanced security:
- **Rate Limiting**: API requests are limited to prevent abuse.
- **Strict CORS**: Origins are restricted by default.
- **SSRF Protection**: AI endpoints are locked to server configuration.
- **Helmet Headers**: Enhanced HTTP security headers.

## Private Hybrid Mode (Local Data Gateway)

You can use the hosted frontend while keeping 100% of your data stored locally.

### 1. Initialize the Project
```bash
mkdir koge-local-server
cd koge-local-server
npm init -y
npm pkg set type="module"
npm install express mariadb cors dotenv helmet express-rate-limit
```

### 2. Create Server File
Copy the code from **[server.js](https://github.com/dezuhan/koge-kanban/blob/main/server.js)** in this repo into a new `server.js` file.

### 3. Configure Environment
Create a `.env` file (copy from `.env.example` if available) with your database and security settings:
```env
DB_HOST=localhost
DB_USER=your_secure_user
DB_PASSWORD=your_secure_password
DB_NAME=koge_kanban
PORT=3000
ALLOWED_ORIGINS=http://localhost:5173,https://koge-kanban.vercel.app
OLLAMA_HOST=http://127.0.0.1:11434
```
**Important:** Do not use `root` user for the database in production.

### 4. Run the Server
```bash
node server.js
```

### 5. Configure Ollama CORS (Optional - PowerShell)
To allow the public interface to communicate with your local Ollama instance, you must enable CORS:

1.  **Stop any running Ollama process**.
2.  **Run with CORS enabled** in PowerShell:
    ```powershell
    $env:OLLAMA_ORIGINS="*"; ollama serve
    ```
    *Note: Keep this terminal window open while using the AI features.*

### 6. Setup AI Tunnel (Optional - Ngrok)
Since browsers block access from HTTPS (Vercel) to HTTP (Localhost), you need a tunnel for **Ollama**:

1.  **Install Ngrok**: Download from [ngrok.com](https://ngrok.com/download) or install via terminal:
    ```bash
    # Windows (Chocolatey)
    choco install ngrok
    
    # Mac (Homebrew)
    brew install ngrok/ngrok/ngrok
    ```
2.  **Start the Tunnel**:
    ```bash
    ngrok http 11434
    ```
3.  **Copy the Forwarding URL**: It will look like `https://abcd-123.ngrok-free.app`.

### 7. Connect via Browser
*   Navigate to [koge-kanban.vercel.app](https://koge-kanban.vercel.app).
*   **API Connection**: 
    *   Click the **Gear Icon (⚙️)** on the Dashboard or Board page.
    *   Paste your API Domain (e.g., `https://database-abcd.ngrok-free.app` or `http://localhost:3000`) into the **API Base Domain** field.
    *   Click **Save & Reload**.
*   **AI Connection**: 
    *   Ensure your server's `.env` has the correct `OLLAMA_HOST`. The frontend now communicates securely through your server.
*   Allow local network access when prompted.
*   **Note**: Your data is saved locally to MariaDB via the backend tunnel.

## Hybrid Mode & Remote Access

Koge Kanban supports a flexible "Hybrid Mode" where you can point the frontend to any backend:
*   **Localhost**: Default for local development (`http://localhost:3000`).
*   **Local IP**: Automatic detection for mobile testing on the same network (`http://192.168.x.x:3000`).
*   **Remote Tunnel**: Use Ngrok or Cloudflare Tunnels for access from anywhere.
*   **URL Override**: Quickly switch endpoints by adding `?apiBase=https://your-link.com` to the URL.

## Installation Options

### Option 1: Docker (Recommended for Local)
Sets up the app and database automatically.

1.  **Clone & Start**:
    ```bash
    git clone https://github.com/dezuhan/koge-kanban.git
    cd koge-kanban
    docker-compose up -d
    ```
2.  **Access**: `http://localhost:5173`

### Option 3: Manual Local Setup

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/dezuhan/koge-kanban.git
    cd koge-kanban
    npm install
    ```
2.  **Setup Environment**: Create a `.env` file:
    ```env
    DB_HOST=localhost
    DB_USER=koge_user
    DB_PASSWORD=secure_password
    OLLAMA_HOST=http://127.0.0.1:11434
    ALLOWED_ORIGINS=http://localhost:5173
    ```
3.  **Run**:
    ```bash
    npm run dev
    ```

## AI Chat Commands
Use specific commands to instruct the AI to perform database actions:
*   `@create`: Create a new card.
*   `@update`: Modify an existing card.
*   `@delete`: Permanently delete a card.
*   `@[board name]`: Provide context from another board.
*   `@all`: Select all cards in the board for bulk operations.

## Project Structure
```
Koge-kanban/
├── api/              # Vercel Serverless Functions
├── components/       # React UI Components
├── context/          # Global State Management
├── fine-tunning/     # AI System Prompts & Logic
├── pages/            # Page Views (Dashboard, Board)
├── server.js         # Express Backend
└── vercel.json       # Vercel Deployment Config
```
