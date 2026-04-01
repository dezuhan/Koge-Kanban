![](https://koge-kanban.vercel.app/media/koge-kanban.png)

# Koge Kanban

Koge Kanban is a trello alternatives, fast, secure, and AI-powered task manager. It blends personal privacy with smart automation to keep your workflow smooth, whether you're working locally or on a server.

## Core feature

- **Built-in AI Assistant**: Automatically generate task details, split complex tasks, or manage your board via chat.
- **Strict Privacy**: Full multi-user support with isolated workspaces ensures your data stays yours.
- **Kanban & Table Views**: Toggle between visual boards and structured tables in a single click.
- **Fast Global Search**: Find any task instantly with powerful search and filtering across all projects.
- **Hybrid Support**: Run your database locally while using a public frontend for the best of both worlds.
- **Rich Task Content**: Full Markdown support and media attachments for detailed documentation.
- **Easy Portability**: Export and import your data anytime to avoid vendor lock-in.

## Requirements

To run Koge Kanban smoothly, make sure you have:
- **Node.js**: Version 20 or higher.
- **Ollama**: If you want to use the AI features (get it at [ollama.com](https://ollama.com)).
- **Docker**: For those who prefer running everything in a container.

## Getting started

### 1. Clone repo
```bash
git clone https://github.com/dezuhan/Koge-Kanban.git
cd Koge-Kanban
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup your environment
Copy the example file and add your own keys:
```bash
cp .env.example .env
```
*Tip: Make sure to set a strong `JWT_SECRET` in your `.env` file to keep your sessions secure.*

### 4. Let's go!
```bash
npm run dev
```
Open `http://localhost:5173` in your browser and you're ready to roll.

## Docker

### Build your image
```bash
docker build -t dezuhan/koge-kanban:latest .
```

### Push to Registry (Docker Hub)
First, make sure you are logged in:
```bash
docker login
```
Then push the image:
```bash
docker push dezuhan/koge-kanban:latest
```

*Tip: You can also use the helper script: `powershell ./scripts/docker-push.ps1`*

### Run with Docker Compose
```bash
docker compose up -d
```

## Hybrid Setup (Frontend-less)

Use the hosted frontend at [demo-koge-kanban.dezuhan.my.id](https://demo-koge-kanban.dezuhan.my.id) while keeping your data private on your local machine.

### 1. Simple Server Setup
You don't need the whole repo. Just create a folder and get the essential files:
```bash
mkdir koge-server; cd koge-server
npm init -y
npm pkg set type="module"
npm install express@4 better-sqlite3 cors dotenv helmet bcryptjs jsonwebtoken
```

### 2. Download server.js
Download only the latest `server.js` from this repository and place it in your folder.

### 3. Run and Connect
Set up your `.env` (add your `JWT_SECRET`), then run:
```bash
node server.js
```
Open **[demo-koge-kanban.dezuhan.my.id](https://demo-koge-kanban.dezuhan.my.id)**, go to **Settings > Database Configuration**, and enter your local IP (e.g., `http://localhost:3000`).

## Configuration guide

You can tweak how Koge Kanban works by editing the `.env` file:

| Variable | What it does | Default |
| :--- | :--- | :--- |
| `PORT` | The port the backend runs on | `3000` |
| `DB_PATH` | Where your database file is saved | `db/kanban.db` |
| `JWT_SECRET` | Used to secure your login sessions | *Required* |
| `ALLOWED_ORIGINS` | Which websites can talk to your backend | `http://localhost:5173` |
| `OLLAMA_HOST` | Where the AI engine is running | `http://127.0.0.1:11434` |

## Setting up the AI (Ollama)

Koge Kanban works great with the **Qwen 2.5 3B** model. Once you have Ollama installed, just run:
```bash
ollama pull qwen2.5:3b
```
The app will automatically use this model to help you manage your tasks. Keep using low parameter model to make it faster (under 8B parameters). AI Feature only works on local (not working on demo-koge-kanban.dezuhan.my.id)

---
Built with passion by [Dezuhan](https://github.com/dezuhan).
