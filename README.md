
<img width="1500" height="900" alt="Koge Kanban Thumbnail" src="https://github.com/user-attachments/assets/5a7e69bc-0358-46d3-bdae-e85461daa030" />

# Koge Kanban

A streamlined Kanban board featuring drag-and-drop management, table views, and project organization. This application requires a local MariaDB server for data persistence and supports optional local AI integration via Ollama.

## Features

*   **Project Management**: Create multiple projects/workspaces.
*   **Kanban Board**: Drag-and-drop tasks between custom columns.
*   **Table View**: A structured list view of all tasks.
*   **Media Support**: Attach image links or upload images (saved to DB).
*   **AI Integration**: Generate task descriptions and subtasks using local LLMs (Ollama).
*   **Customization**: Customize column colors and priority settings.
*   **Database Driven**: Data is stored in a MariaDB database.

## Prerequisites

*   **Node.js**: Version 18.0.0 or higher.
*   **MariaDB**: Required for data storage.
*   **Docker** (Optional): For containerized deployment.
*   **Ollama** (Optional): For AI features.

## Installation Options

### Option 1: Docker (Recommended)

The easiest way to run Koge Kanban is using Docker Compose. This sets up the app and database automatically.

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/dezuhan/koge-kanban.git
    cd koge-kanban
    ```

2.  **Start with Docker Compose**
    ```bash
    docker-compose up -d
    ```

3.  **Access the App**
    Open `http://localhost:5173` in your browser.

### Option 2: Local Manual Setup

Follow these steps to run the application manually on your local machine.

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/dezuhan/koge-kanban.git
    cd koge-kanban
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Setup Database (MariaDB)**
    Ensure MariaDB is installed and running. Create a `.env` file in the root directory (optional but recommended) or rely on defaults.

    Example `.env`:
    ```env
    DB_HOST=localhost
    DB_USER=root
    DB_PASSWORD=your_password
    OLLAMA_HOST=http://127.0.0.1:11434
    ```

4.  **Setup AI (Optional)**
    *   Install [Ollama](https://ollama.com/).
    *   Pull a model (e.g., `ollama pull gemma2:2b`).
    *   Ensure Ollama is running (`ollama serve`).

5.  **Start the Backend Server**
    ```bash
    node server.js
    ```
    The server will automatically create the `koge_kanban` database and necessary tables.

6.  **Run the Frontend**
    In a new terminal window:
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173`.

## Private Hybrid Mode (Local Data Gateway)

You can use the hosted frontend while keeping **100% of your data stored locally**.

1.  **Initialize the Project**
    ```bash
    mkdir koge-local-server
    cd koge-local-server
    npm init -y
    npm pkg set type="module"
    npm install express mariadb cors dotenv express
    ```

2.  **Create Server File**
    Copy the code from **[server.js](https://github.com/dezuhan/Koge-Kanban/blob/main/server.js)** in this repo into a new `server.js` file.

3.  **Run the Server**
    ```bash
    node server.js
    ```

4.  **Connect via Browser**
    *   Navigate to [koge-kanban.vercel.app](https://koge-kanban.vercel.app).
    *   Allow local network access when prompted.
    *   **Note**: AI features will only work if you have Ollama running locally on port 11434.

## Project Structure

```
Koge-kanban/
├── components/       # React UI Components
├── services/         # Database logic (API adapter)
├── index.html        # Entry point
├── index.tsx         # React root
├── App.tsx           # Main application logic
├── types.ts          # TypeScript interfaces
├── vite.config.js    # Vite configuration
└── package.json      # Dependencies and scripts
```
