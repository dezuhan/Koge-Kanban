import { Task, Column, PrioritySettings, Project } from '../types';

const PROJECTS_KEY = 'kanban_projects';
const SETTINGS_KEY = 'kanban_settings';

// Dynamic API URL determination
const getApiBaseUrl = () => {
    // Check if running in browser environment
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        
        // If localhost or 127.0.0.1, assume standard local dev port 3000
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3000/api';
        }
        
        // If accessing via local network IP (e.g., 192.168.x.x), try to hit port 3000 on that same IP
        // This allows testing on mobile devices on the same network
        if (hostname.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
            return `http://${hostname}:3000/api`;
        }
    }
    
    // Fallback (e.g. for Vercel deployment where backend might not be available)
    // You should replace this with your production backend URL if you have one
    return 'http://localhost:3000/api';
};

const BASE_URL = getApiBaseUrl();
const API_URL = `${BASE_URL}/data`;
const GLOBAL_TASKS_URL = `${BASE_URL}/tasks/global`;

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
                 'Expires': '0'
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
        const response = await fetch(`${API_URL}/${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        const response = await fetch(`${API_URL}/${key}`, {
            method: 'DELETE',
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
  getProjects: async (): Promise<Project[] | null> => apiAdapter.get<Project[]>(`${API_URL}/${PROJECTS_KEY}`),
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
  getTasks: async (projectId: string): Promise<Task[] | null> => apiAdapter.get<Task[]>(`${API_URL}/tasks_${projectId}`),
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
  getAllGlobalTasks: async (): Promise<Task[] | null> => apiAdapter.get<Task[]>(GLOBAL_TASKS_URL),

  /**
   * Fetches columns configuration for a specific project.
   * @param projectId - The unique identifier of the project.
   * @returns Promise resolving to an array of Column objects or null.
   */
  getColumns: async (projectId: string): Promise<Column[] | null> => apiAdapter.get<Column[]>(`${API_URL}/columns_${projectId}`),
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
  getSettings: async (): Promise<PrioritySettings | null> => apiAdapter.get<PrioritySettings>(`${API_URL}/${SETTINGS_KEY}`),
  /**
   * Saves application-wide settings.
   * @param settings - The PrioritySettings object.
   */
  saveSettings: async (settings: PrioritySettings) => apiAdapter.save(SETTINGS_KEY, settings),

  // AI Settings
  getAISettings: async (): Promise<{ models: string[], active: string, enabled: boolean, endpoint?: string } | null> => apiAdapter.get(`${API_URL}/ai_settings`),
  saveAISettings: async (settings: { models: string[], active: string, enabled: boolean, endpoint?: string }) => apiAdapter.save('ai_settings', settings),
  
  // Chat History
  /**
   * Fetches chat history for a specific project or global context.
   * @param contextId - The project ID or 'global'.
   * @returns Promise resolving to an array of ChatMessage objects or null.
   */
  getChatHistory: async (contextId: string): Promise<any[] | null> => apiAdapter.get<any[]>(`${API_URL}/chat_history_${contextId}`),
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
};