# Koge Kanban

A streamlined Kanban board featuring drag-and-drop management, table views, and project organization. This application requires a local MariaDB server for data persistence.

## Features

*   **Project Management**: Create multiple projects/workspaces.
*   **Kanban Board**: Drag-and-drop tasks between custom columns.
*   **Table View**: A structured list view of all tasks.
*   **Media Support**: Attach image links or upload images (saved to DB).
*   **Customization**: Customize column colors and priority settings.
*   **Database Driven**: Data is stored in a MariaDB database.

## Prerequisites

*   **Node.js**: Version 18.0.0 or higher.
*   **NPM**: Included with Node.js.
*   **MariaDB**: Required for data storage.

## Installation & Setup

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

### 3. Setup Database (MariaDB)

1.  Ensure MariaDB is installed and running on your machine.
2.  Update the database credentials in `server.js` if they differ from the defaults (user: root, no password).
3.  Start the backend server:

```bash
// Database Configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost', 
  user: process.env.DB_USER || 'root', 
  password: process.env.DB_PASSWORD || '', //insert your password mariaDB into ''
  connectionLimit: 5
};
```

```bash
node server.js
```

The server will automatically create the `simplo_kanban` database and necessary tables if they don't exist.

### 4. Run the Application

In a new terminal window:

```bash
npm run dev
```

This will start the development server (usually at `http://localhost:5173`). Open this URL in your browser.

**Note**: You must have `node server.js` running for the application to work.

### 5. Building for Production

To build the frontend for production:

```bash
npm run build
```

You can serve the `dist` folder using a static file server, but you must still keep the Node.js backend running for the API.

## Project Structure

```
simplo-kanban/
├── components/       # React UI Components
├── services/         # Database logic (API adapter)
├── index.html        # Entry point
├── index.tsx         # React root
├── App.tsx           # Main application logic
├── types.ts          # TypeScript interfaces
├── vite.config.js    # Vite configuration
└── package.json      # Dependencies and scripts
```
