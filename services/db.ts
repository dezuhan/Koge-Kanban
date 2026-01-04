import { Task, Column, PrioritySettings, Project } from '../types';

const PROJECTS_KEY = 'kanban_projects';
const SETTINGS_KEY = 'kanban_settings';
const API_URL = 'http://localhost:3000/api/data';
const GLOBAL_TASKS_URL = 'http://localhost:3000/api/tasks/global';

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
         const response = await fetch(url, { signal: controller.signal });
         clearTimeout(id);
         if (!response.ok) {
             throw new Error(`API Error: ${response.statusText}`);
         }
         return await response.json();
     } catch (e) {
         clearTimeout(id);
         console.error(`Database fetch failed for ${url}:`, e);
         throw e;
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
  saveSettings: async (settings: PrioritySettings) => apiAdapter.save(SETTINGS_KEY, settings)
};