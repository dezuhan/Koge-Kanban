
import { Task, Column, PrioritySettings, Project } from '../types';

const PROJECTS_KEY = 'kanban_projects';
const SETTINGS_KEY = 'kanban_settings';
const API_URL = 'http://localhost:3000/api/data';

// Helper for LocalStorage
const localStorageAdapter = {
  get: <T>(key: string): T | null => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error(`Failed to load ${key} from localStorage`, e);
      return null;
    }
  },
  save: <T>(key: string, data: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`Failed to save ${key} to localStorage`, e);
    }
  }
};

// Helper for API with timeout
const apiAdapter = {
  get: async <T>(key: string): Promise<T | null> => {
     const controller = new AbortController();
     // Set a short timeout (e.g., 2000ms) to ensure the UI doesn't hang if the server is down
     const id = setTimeout(() => controller.abort(), 2000);
     
     try {
         const response = await fetch(`${API_URL}/${key}`, { signal: controller.signal });
         clearTimeout(id);
         if (!response.ok) {
             throw new Error(`API Error: ${response.statusText}`);
         }
         return await response.json();
     } catch (e) {
         clearTimeout(id);
         throw e;
     }
  },
  save: async <T>(key: string, data: T): Promise<void> => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000);

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
          throw e;
      }
  }
};

// Hybrid Strategy
const dbHandler = {
    get: async <T>(key: string): Promise<T | null> => {
        try {
            // Attempt to fetch from API
            const data = await apiAdapter.get<T>(key);
            
            // If API fetch succeeds, update LocalStorage to keep it as a fresh backup
            // This ensures if the server goes down later, we have the latest server data locally.
            if (data !== null) {
                 localStorageAdapter.save(key, data);
            }
            return data;
        } catch (error) {
            console.warn(`Database fetch failed for ${key} (Server might be down), falling back to LocalStorage.`);
            // Fallback to LocalStorage
            return localStorageAdapter.get<T>(key);
        }
    },
    save: async <T>(key: string, data: T): Promise<void> => {
        // 1. Always save locally immediately (Optimistic UI & Offline capability)
        localStorageAdapter.save(key, data);
        
        // 2. Try to sync with Server
        try {
            await apiAdapter.save(key, data);
        } catch (error) {
             console.warn(`Database save failed for ${key}, data is stored locally only.`);
        }
    }
}

export const db = {
  // Projects
  getProjects: async (): Promise<Project[] | null> => dbHandler.get<Project[]>(PROJECTS_KEY),
  saveProjects: async (projects: Project[]) => dbHandler.save(PROJECTS_KEY, projects),

  // Scoped by Project ID
  getTasks: async (projectId: string): Promise<Task[] | null> => dbHandler.get<Task[]>(`tasks_${projectId}`),
  saveTasks: async (projectId: string, tasks: Task[]) => dbHandler.save(`tasks_${projectId}`, tasks),

  getColumns: async (projectId: string): Promise<Column[] | null> => dbHandler.get<Column[]>(`columns_${projectId}`),
  saveColumns: async (projectId: string, columns: Column[]) => dbHandler.save(`columns_${projectId}`, columns),

  // Global Settings
  getSettings: async (): Promise<PrioritySettings | null> => dbHandler.get<PrioritySettings>(SETTINGS_KEY),
  saveSettings: async (settings: PrioritySettings) => dbHandler.save(SETTINGS_KEY, settings)
};
