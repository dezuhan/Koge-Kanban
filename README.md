# Koge Kanban

A streamlined, AI-enhanced Kanban board featuring drag-and-drop management, table views, and smart task assistance. This application is designed to run entirely in your browser using LocalStorage for data persistence, making it perfect for self-hosted, local device usage without complex server setups.

## Features

*   **Project Management**: Create multiple projects/workspaces.
*   **Kanban Board**: Drag-and-drop tasks between custom columns.
*   **Table View**: A structured list view of all tasks.
*   **AI Assistance**: Google Gemini integration to help write task descriptions and subtasks (requires API Key).
*   **Media Support**: Attach image links or upload images (saved locally).
*   **Customization**: Customize column colors (backgrounds reflect the column color) and priority settings.
*   **Offline First**: Data is stored in your browser's LocalStorage.
*   **Optional Database**: Can connect to a MariaDB database via a local Node.js server. If the server is unreachable, it automatically falls back to LocalStorage.

## Prerequisites

*   **Node.js**: Version 18.0.0 or higher.
*   **NPM**: Included with Node.js.
*   **(Optional) Google Gemini API Key**: If you want to use the AI features. Get one here: [https://aistudio.google.com/](https://aistudio.google.com/)
*   **(Optional) MariaDB**: If you want to use database persistence.

## Installation & Setup (Self-Hosted Local Device)

Follow these steps to run the application on your local machine.

### 1. Clone the Repository

```bash
git clone https://github.com/dezuhan/koge-kanban.git
cd koge-kanban
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment (Optional)

If you plan to use the AI features, you need to set up your API key.

1.  Create a file named `.env` in the root directory.
2.  Add your API key:

```env
API_KEY=your_google_gemini_api_key_here
```

*Note: Since this is a client-side app using Vite, the key will be exposed in the browser bundle if you deploy it publicly. For local use, this is fine.*

### 4. Run the Application

```bash
npm run dev
```

This will start the development server (usually at `http://localhost:5173`). Open this URL in your browser.

### 5. (Optional) Run the Database Server

If you want to use MariaDB for storage instead of just LocalStorage:

1.  Ensure MariaDB is installed and running on your machine.
2.  Update the database credentials in `server.js` if necessary.
3.  Start the backend server:

```bash
node server.js
```

The application will now try to fetch data from `http://localhost:3000`. If the server is not running, it will automatically fall back to LocalStorage.

### 6. Building for Production (Static Files)

If you want to run this as a static site (e.g., serve it with Nginx, Apache, or a simple HTTP server) without needing `npm run dev` constantly:

```bash
npm run build
```

This generates a `dist/` folder. You can serve this folder using any static file server.

Example using `serve`:

```bash
npm install -g serve
serve -s dist
```

## Usage Guide

1.  **Creating a Project**: Click "New Project" on the dashboard.
2.  **Adding Columns**: Click the `+` button on the far right of the board. You can select a color for the column; the board background for that column will adopt a light tint of that color.
3.  **Adding Tasks**: Click "New Task" or the `+` icon on a specific column.
4.  **Media**: In the task modal, you can paste an image URL or upload an image from your device. *Note: Uploaded images are stored in LocalStorage. Keep them small (under 2MB) to avoid hitting browser storage limits.*
5.  **AI Magic**: When creating a task, type a title and click "AI Magic" to auto-generate a description and subtasks.

## Data Persistence

*   **Priority**: The app tries to connect to the backend server (MariaDB) first.
*   **Fallback**: If the server is unreachable, data is loaded from and saved to your browser's **LocalStorage**.
*   **Hybrid Save**: When saving data, it is always written to LocalStorage immediately for responsiveness, and then sent to the server.

## Project Structure

```
simplo-kanban/
├── components/       # React UI Components (Board, Modal, Card, etc.)
├── services/         # Database logic (LocalStorage adapter) & AI Service
├── index.html        # Entry point
├── index.tsx         # React root
├── App.tsx           # Main application logic
├── types.ts          # TypeScript interfaces
├── vite.config.js    # Vite configuration
└── package.json      # Dependencies and scripts
```
