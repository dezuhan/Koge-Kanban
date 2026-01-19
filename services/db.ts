import { Task, Column, PrioritySettings, Project } from '../types';

const PROJECTS_KEY = 'kanban_projects';
const SETTINGS_KEY = 'kanban_settings';
const API_BASE_STORAGE_KEY = 'koge_api_base_url';

const normalizeBase = (value: string) => value.replace(/\/+$/, '');

const withApiPath = (base: string) => {
    const normalized = normalizeBase(base);
    return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
};

// Dynamic API URL determination (hybrid local + remote)
const getApiBaseUrl = () => {
    // 1) Build-time override (Vite)
    const envBase = typeof import.meta !== 'undefined'
        ? normalizeBase((import.meta as any).env?.VITE_API_BASE_URL || '')
        : '';
    if (envBase) {
        return withApiPath(envBase);
    }

    // 2) Runtime override (query param > localStorage)
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const queryBase = params.get('apiBase');
        if (queryBase) {
            const normalized = normalizeBase(queryBase);
            window.localStorage.setItem(API_BASE_STORAGE_KEY, normalized);
            return withApiPath(normalized);
        }

        const storedBase = window.localStorage.getItem(API_BASE_STORAGE_KEY);
        if (storedBase) {
            return withApiPath(storedBase);
        }

        const hostname = window.location.hostname;

        // If localhost or 127.0.0.1, assume standard local dev port 3000
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3000/api';
        }

        // If accessing via local network IP (e.g., 192.168.x.x), try to hit port 3000 on that same IP
        if (hostname.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
            return `http://${hostname}:3000/api`;
        }

        // For any other hostname (e.g. ngrok/custom domain), use same-origin /api
        return `${window.location.origin}/api`;
    }

    // Fallback (e.g. for Vercel deployment where backend might not be available)
    return 'http://localhost:3000/api';
};

const getApiUrl = () => `${getApiBaseUrl()}/data`;
const getGlobalTasksUrl = () => `${getApiBaseUrl()}/tasks/global`;

/**
 * Helper utility for making API requests with built-in timeout and error handling.
 */
const apiAdapter = {
    /**
     * Generic GET request with timeout and error handling.
     * @param url - The API endpoint to fetch from.
     * @returns The parsed JSON response or null on failure.
     */
    get: async <T>(url: string): Promise<T | null> => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'ngrok-skip-browser-warning': 'true'
                }
            });
            clearTimeout(id);
            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }
            const data = await response.json();
            console.log(`[DB] Fetched ${url}:`, data ? (Array.isArray(data) ? `Array(${data.length})` : 'Object') : 'null');
            return data;
        } catch (e) {
            clearTimeout(id);
            console.error(`Database fetch failed for ${url}:`, e);
            // Return null instead of throwing to prevent app crash, let caller handle null
            return null;
        }
    },
    /**
     * Generic POST request to save data to the key-value store.
     * @param key - The key identifier for the data.
     * @param data - The payload to be saved (will be JSON stringified).
     */
    save: async <T>(key: string, data: T): Promise<void> => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch(`${getApiUrl()}/${key}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify(data),
                signal: controller.signal
            });
            clearTimeout(id);
            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }
        } catch (e) {
            clearTimeout(id);
            console.error(`Database save failed for ${key}:`, e);
            throw e;
        }
    },
    /**
     * Generic DELETE request to remove data from the key-value store.
     * @param key - The key identifier for the data to delete.
     */
    delete: async (key: string): Promise<void> => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch(`${getApiUrl()}/${key}`, {
                method: 'DELETE',
                headers: {
                    'ngrok-skip-browser-warning': 'true'
                },
                signal: controller.signal
            });
            clearTimeout(id);
            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }
        } catch (e) {
            clearTimeout(id);
            console.error(`Database delete failed for ${key}:`, e);
            throw e;
        }
    }
};

/**
 * Service object for database interactions.
 * Provides methods to get and save projects, tasks, columns, and settings.
 */
export const db = {
    // Projects
    /**
     * Fetches the list of all projects.
     * @returns Promise resolving to an array of Project objects or null.
     */
    getProjects: async (): Promise<Project[] | null> => apiAdapter.get<Project[]>(`${getApiUrl()}/${PROJECTS_KEY}`),
    /**
     * Saves the entire list of projects.
     * @param projects - Array of Project objects.
     */
    saveProjects: async (projects: Project[]) => apiAdapter.save(PROJECTS_KEY, projects),

    // Scoped by Project ID
    /**
     * Fetches all tasks associated with a specific project ID.
     * @param projectId - The unique identifier of the project.
     * @returns Promise resolving to an array of Task objects or null.
     */
    getTasks: async (projectId: string): Promise<Task[] | null> => apiAdapter.get<Task[]>(`${getApiUrl()}/tasks_${projectId}`),
    /**
     * Saves tasks for a specific project.
     * @param projectId - The unique identifier of the project.
     * @param tasks - Array of Task objects to save.
     */
    saveTasks: async (projectId: string, tasks: Task[]) => apiAdapter.save(`tasks_${projectId}`, tasks),

    // Global Access
    /**
     * Fetches all tasks from ALL projects across the database.
     * Used for the "Recent Tasks" dashboard to display tasks from all projects sorted by creation date.
     * @returns Promise resolving to a flat array of all Task objects.
     */
    getAllGlobalTasks: async (): Promise<Task[] | null> => apiAdapter.get<Task[]>(getGlobalTasksUrl()),

    /**
     * Fetches columns configuration for a specific project.
     * @param projectId - The unique identifier of the project.
     * @returns Promise resolving to an array of Column objects or null.
     */
    getColumns: async (projectId: string): Promise<Column[] | null> => apiAdapter.get<Column[]>(`${getApiUrl()}/columns_${projectId}`),
    /**
     * Saves columns configuration for a specific project.
     * @param projectId - The unique identifier of the project.
     * @param columns - Array of Column objects to save.
     */
    saveColumns: async (projectId: string, columns: Column[]) => apiAdapter.save(`columns_${projectId}`, columns),

    // Global Settings
    /**
     * Fetches application-wide settings (e.g., priority colors).
     * @returns Promise resolving to PrioritySettings object or null.
     */
    getSettings: async (): Promise<PrioritySettings | null> => apiAdapter.get<PrioritySettings>(`${getApiUrl()}/${SETTINGS_KEY}`),
    /**
     * Saves application-wide settings.
     * @param settings - The PrioritySettings object.
     */
    saveSettings: async (settings: PrioritySettings) => apiAdapter.save(SETTINGS_KEY, settings),

    // AI Settings
    getAISettings: async (): Promise<{ models: string[], active: string, enabled: boolean, endpoint?: string } | null> => apiAdapter.get(`${getApiUrl()}/ai_settings`),
    saveAISettings: async (settings: { models: string[], active: string, enabled: boolean, endpoint?: string }) => apiAdapter.save('ai_settings', settings),

    // Chat History
    /**
     * Fetches chat history for a specific project or global context.
     * @param contextId - The project ID or 'global'.
     * @returns Promise resolving to an array of ChatMessage objects or null.
     */
    getChatHistory: async (contextId: string): Promise<any[] | null> => apiAdapter.get<any[]>(`${getApiUrl()}/chat_history_${contextId}`),
    /**
     * Saves chat history for a specific project or global context.
     * @param contextId - The project ID or 'global'.
     * @param messages - Array of ChatMessage objects.
     */
    saveChatHistory: async (contextId: string, messages: any[]) => apiAdapter.save(`chat_history_${contextId}`, messages),

    /**
     * Permanently deletes a specific key from the database.
     * @param key - The key to delete.
     */
    deleteKey: async (key: string) => apiAdapter.delete(key),

    /**
     * Tests connection to a specific API URL.
     * @param url - The API base URL to test.
     */
    testConnection: async (url: string): Promise<boolean> => {
        const testUrl = url.endsWith('/api') ? `${url}/data/${PROJECTS_KEY}` : `${url.replace(/\/+$/, '')}/api/data/${PROJECTS_KEY}`;
        const result = await apiAdapter.get(testUrl);
        return result !== null;
    }
};
