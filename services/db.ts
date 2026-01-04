import { Task, Column, PrioritySettings, Project } from '../types';

const PROJECTS_KEY = 'kanban_projects';
const SETTINGS_KEY = 'kanban_settings';
const API_URL = 'http://localhost:3000/api/data';
const GLOBAL_TASKS_URL = 'http://localhost:3000/api/tasks/global';

// Helper for API with timeout
const apiAdapter = {
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
  getProjects: async (): Promise<Project[] | null> => apiAdapter.get<Project[]>(`${API_URL}/${PROJECTS_KEY}`),
  saveProjects: async (projects: Project[]) => apiAdapter.save(PROJECTS_KEY, projects),

  // Scoped by Project ID
  getTasks: async (projectId: string): Promise<Task[] | null> => apiAdapter.get<Task[]>(`${API_URL}/tasks_${projectId}`),
  saveTasks: async (projectId: string, tasks: Task[]) => apiAdapter.save(`tasks_${projectId}`, tasks),

  // Global Access
  getAllGlobalTasks: async (): Promise<Task[] | null> => apiAdapter.get<Task[]>(GLOBAL_TASKS_URL),

  getColumns: async (projectId: string): Promise<Column[] | null> => apiAdapter.get<Column[]>(`${API_URL}/columns_${projectId}`),
  saveColumns: async (projectId: string, columns: Column[]) => apiAdapter.save(`columns_${projectId}`, columns),

  // Global Settings
  getSettings: async (): Promise<PrioritySettings | null> => apiAdapter.get<PrioritySettings>(`${API_URL}/${SETTINGS_KEY}`),
  saveSettings: async (settings: PrioritySettings) => apiAdapter.save(SETTINGS_KEY, settings)
};