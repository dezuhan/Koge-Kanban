import { Task, Column, PrioritySettings, Project } from '../types';

const PROJECTS_KEY = 'kanban_projects';
const SETTINGS_KEY = 'kanban_settings';
const API_URL = 'http://localhost:3000/api/data';

// Helper for API with timeout
const apiAdapter = {
  get: async <T>(key: string): Promise<T | null> => {
     const controller = new AbortController();
     // Timeout set to 5000ms to allow for database latency
     const id = setTimeout(() => controller.abort(), 5000);
     
     try {
         const response = await fetch(`${API_URL}/${key}`, { signal: controller.signal });
         clearTimeout(id);
         if (!response.ok) {
             throw new Error(`API Error: ${response.statusText}`);
         }
         return await response.json();
     } catch (e) {
         clearTimeout(id);
         console.error(`Database fetch failed for ${key}:`, e);
         throw e;
     }
  },
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

export const db = {
  // Projects
  getProjects: async (): Promise<Project[] | null> => apiAdapter.get<Project[]>(PROJECTS_KEY),
  saveProjects: async (projects: Project[]) => apiAdapter.save(PROJECTS_KEY, projects),

  // Scoped by Project ID
  getTasks: async (projectId: string): Promise<Task[] | null> => apiAdapter.get<Task[]>(`tasks_${projectId}`),
  saveTasks: async (projectId: string, tasks: Task[]) => apiAdapter.save(`tasks_${projectId}`, tasks),

  getColumns: async (projectId: string): Promise<Column[] | null> => apiAdapter.get<Column[]>(`columns_${projectId}`),
  saveColumns: async (projectId: string, columns: Column[]) => apiAdapter.save(`columns_${projectId}`, columns),

  // Global Settings
  getSettings: async (): Promise<PrioritySettings | null> => apiAdapter.get<PrioritySettings>(SETTINGS_KEY),
  saveSettings: async (settings: PrioritySettings) => apiAdapter.save(SETTINGS_KEY, settings)
};
