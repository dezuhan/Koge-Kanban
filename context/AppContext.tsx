import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Project, PrioritySettings, Priority, Task, Column } from '../types';
import { db } from '../services/db';

interface AppContextType {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  prioritySettings: PrioritySettings;
  setPrioritySettings: React.Dispatch<React.SetStateAction<PrioritySettings>>;
  appLoading: boolean;
  refreshProjects: () => Promise<void>;
  isAIEnabled: boolean;
  toggleAI: () => Promise<boolean>;
  disableAI: () => void;
  aiModels: string[];
  activeModel: string;
  fetchModels: () => Promise<string[]>;
  addAIModel: (model: string) => void;
  removeAIModel: (model: string) => void;
  setActiveAIModel: (model: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_PRIORITY_SETTINGS: PrioritySettings = {
  [Priority.LOW]: { bg: '#dbeafe', text: '#1e40af' },    
  [Priority.MEDIUM]: { bg: '#fef3c7', text: '#92400e' }, 
  [Priority.HIGH]: { bg: '#fee2e2', text: '#991b1b' },   
};

const SEED_PROJECT: Project = {
    id: 'intro-project-welcome',
    name: 'Welcome',
    description: 'A quick introduction to your new Kanban board.',
    createdAt: Date.now()
};

const SEED_TASKS: Task[] = [
    {
        id: 'intro-task-1',
        title: '👋 Welcome! Read Me First',
        description: `## Welcome to Koge Kanban!\n\nThis is your new workspace. Here is a quick overview:\n\n*   **Projects**: Manage multiple workspaces.\n*   **Columns**: Categorize work (Draft, To-Do, etc.).\n*   **Privacy**: Your data is stored locally in your browser (or your own DB).\n\n**Tip**: Try clicking the **Table Icon** in the top right to see a list view.`,
        status: 'Draft',
        priority: Priority.LOW,
        category: 'Onboarding',
        project: 'Welcome',
        isCompleted: false,
        createdAt: Date.now(),
        dueDate: null,
        subTasks: []
    },
    {
        id: 'intro-task-2',
        title: '👈 Try Dragging This Card',
        description: `**Drag and Drop** is the core of Kanban.\n\n1. Click and hold this card.\n2. Drag it to the **ON GOING** column.\n3. Release it to update its status.`,
        status: 'To Do',
        priority: Priority.HIGH,
        category: 'Interaction',
        project: 'Welcome',
        isCompleted: false,
        createdAt: Date.now(),
        dueDate: Date.now() + 86400000, 
        subTasks: []
    },
    {
        id: 'intro-task-3',
        title: '✏️ Edit Task Details',
        description: `Click this card to open the **Edit Modal**.\n\nYou can add:\n*   Rich Text Descriptions (Markdown)\n*   Due Dates\n*   Assignees\n*   Subtasks`,
        status: 'To Do',
        priority: Priority.MEDIUM,
        category: 'Features',
        project: 'Welcome',
        isCompleted: false,
        createdAt: Date.now(),
        dueDate: null,
        subTasks: [
            { id: 'st-1', title: 'Open this task', isCompleted: true },
            { id: 'st-2', title: 'Add a subtask', isCompleted: false }
        ]
    },
    {
        id: 'intro-task-4',
        title: '👤 Assignees & Media',
        description: `You can assign tasks to people and attach images.\n\n*   **Assignee**: See the initials on the card?\n*   **Media**: You can paste image URLs or upload files.\n\nThis task is assigned to a new user.`,
        status: 'On Going',
        priority: Priority.MEDIUM,
        category: 'Features',
        project: 'Welcome',
        isCompleted: false,
        createdAt: Date.now(),
        dueDate: null,
        assignee: 'New User',
        media: ['https://images.unsplash.com/photo-1542626991-cbc4e32524cc?w=400&q=80'],
        subTasks: []
    },
    {
        id: 'intro-task-5',
        title: '✅ Completed Task',
        description: `This task is marked as complete. You can toggle completion by clicking the checkbox on the card or in the modal.`,
        status: 'Complete',
        priority: Priority.LOW,
        category: 'General',
        project: 'Welcome',
        isCompleted: true,
        createdAt: Date.now(),
        dueDate: null,
        subTasks: []
    }
];

const TEMPLATE_COLUMNS_SEED: Column[] = [
  { id: 'Draft', title: 'DRAFT', color: '#94a3b8' },
  { id: 'To Do', title: 'TO-DO', color: '#f59e0b' },
  { id: 'On Going', title: 'ON GOING', color: '#3b82f6' },
  { id: 'Complete', title: 'COMPLETE', color: '#22c55e' }
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [prioritySettings, setPrioritySettings] = useState<PrioritySettings>(DEFAULT_PRIORITY_SETTINGS);
  const [appLoading, setAppLoading] = useState(true);
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [aiModels, setAiModels] = useState<string[]>([]);
  const [activeModel, setActiveModel] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);

  const disableAI = () => {
      setIsAIEnabled(false);
  };

  const refreshProjects = async () => {
      const fetchedProjects = await db.getProjects();
      if (fetchedProjects) setProjects(fetchedProjects);
  };

  const fetchModels = useCallback(async (): Promise<string[]> => {
      try {
          const response = await fetch('http://localhost:3000/api/ai/models');
          if (!response.ok) {
            setAiModels([]);
            return [];
          }
          const data = await response.json();
          // Ollama returns { models: [{ name: '...', ... }] }
          if (data && data.models && Array.isArray(data.models)) {
              const modelNames = data.models.map((m: any) => m.name);
              
              setAiModels(prev => {
                // Avoid unnecessary updates to prevent re-renders
                if (JSON.stringify(prev) === JSON.stringify(modelNames)) return prev;
                return modelNames;
              });

              // If current active model is not in the list (and list is not empty), select the first one
              // Use functional update or ref to avoid dependency loop, but for now just check against current state.
              // Note: activeModel is in dependency array, so this function is recreated when it changes, 
              // which re-runs effect in modal. This is okay as long as we don't change activeModel unnecessarily.
              setActiveModel(currentActive => {
                  if (modelNames.length > 0 && (!currentActive || !modelNames.includes(currentActive))) {
                      return modelNames[0];
                  } else if (modelNames.length === 0) {
                      return '';
                  }
                  return currentActive;
              });
              
              return modelNames;
          }
          setAiModels([]);
          return [];
      } catch (e) {
          console.error("Failed to fetch models:", e);
          setAiModels([]);
          return [];
      }
  }, []);

  const toggleAI = async (): Promise<boolean> => {
      if (isAIEnabled) {
          // Turn off immediately
          setIsAIEnabled(false);
          return false;
      } else {
          // Note: We don't check for activeModel here anymore because ProjectList will handle the flow:
          // Click -> Scan -> Popup -> Select -> Enable.
          // This function now strictly just checks connectivity for the *currently selected* activeModel if any.
          
          if (!activeModel) {
              // If no model selected, we can't really "enable" fully, but we assume the caller handled the selection UI.
              return false;
          }

          // Check if Ollama is running before enabling
          try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 2000);
              
              const response = await fetch('http://localhost:3000/api/ai/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ prompt: "ping", model: activeModel })
              });
              
              clearTimeout(timeoutId);
              
              if (response.ok) {
                  setIsAIEnabled(true);
                  return true;
              } else {
                  throw new Error("Ollama check failed");
              }
          } catch (e) {
              console.error("AI Enable Failed:", e);
              return false;
          }
      }
  };

  const addAIModel = (model: string) => {
      if (!aiModels.includes(model)) {
          setAiModels(prev => {
              const newModels = [...prev, model];
              if (!activeModel) setActiveModel(model); // Auto-select if first model
              return newModels;
          });
          if (!activeModel) setActiveModel(model);
      }
  };

  const removeAIModel = (model: string) => {
      const newModels = aiModels.filter(m => m !== model);
      setAiModels(newModels);
      
      if (activeModel === model) {
          setActiveModel(newModels.length > 0 ? newModels[0] : '');
      }
  };

  const setActiveAIModel = (model: string) => {
      setActiveModel(model);
  };

  useEffect(() => {
    const initApp = async () => {
        try {
            const [fetchedProjects, fetchedSettings, fetchedAISettings] = await Promise.all([
                db.getProjects(),
                db.getSettings(),
                db.getAISettings()
            ]);
            
            if (fetchedSettings) setPrioritySettings(fetchedSettings);
            if (fetchedAISettings) {
                setAiModels(fetchedAISettings.models);
                setActiveModel(fetchedAISettings.active);
            }
            
            console.log("[AppContext] Initial projects:", fetchedProjects);
            
            if (fetchedProjects && fetchedProjects.length > 0) {
                setProjects(fetchedProjects);
            } else {
                // SEEDING LOGIC: Database is empty OR fetch failed (null)
                // BUT, if fetch failed, we shouldn't necessarily overwrite with seed data if DB actually has data.
                // db.getProjects() now returns null on error.
                
                if (fetchedProjects === null) {
                    console.error("[AppContext] Failed to fetch projects. NOT seeding to avoid overwrite.");
                    // We can try to rely on local state or show error?
                    // For now, let's just initialize empty so app doesn't crash, but warn user.
                } else {
                console.log("Database empty. Seeding Welcome Project...");
                const seedProjects = [SEED_PROJECT];
                
                // 1. Set State
                setProjects(seedProjects);
                
                // 2. Persist Project List
                await db.saveProjects(seedProjects);
                
                // 3. Persist Columns for this project
                await db.saveColumns(SEED_PROJECT.id, TEMPLATE_COLUMNS_SEED);
                
                // 4. Persist Tasks for this project
                await db.saveTasks(SEED_PROJECT.id, SEED_TASKS);
                
                console.log("Seeding complete.");
            }
            }
            
            setIsInitialized(true);
        } catch (error) {
            console.error("App init failed", error);
        } finally {
            setAppLoading(false);
        }
    };
    initApp();
  }, []);

  // Persistence
  useEffect(() => {
    // Only save projects if application is initialized and not loading
    if (!appLoading && isInitialized) {
        // Debounce or ensure we are not saving empty array over existing data if not intended.
        // But logic above handles seeding.
        db.saveProjects(projects);
    }
  }, [projects, appLoading, isInitialized]);

  useEffect(() => {
    if (!appLoading && isInitialized) db.saveSettings(prioritySettings);
  }, [prioritySettings, appLoading, isInitialized]);

  useEffect(() => {
    if (!appLoading && isInitialized) {
        db.saveAISettings({ models: aiModels, active: activeModel });
    }
  }, [aiModels, activeModel, appLoading, isInitialized]);

  return (
    <AppContext.Provider value={{ projects, setProjects, prioritySettings, setPrioritySettings, appLoading, refreshProjects, isAIEnabled, toggleAI, disableAI, aiModels, activeModel, fetchModels, addAIModel, removeAIModel, setActiveAIModel }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

