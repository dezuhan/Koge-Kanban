import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Project, PrioritySettings, Priority, Task, Column, ProjectContext } from '../types';
import { db } from '../services/db';
import ConfirmModal from '../components/ConfirmModal';

interface AppContextType {
  projects: Project[] | null;
  setProjects: React.Dispatch<React.SetStateAction<Project[] | null>>;
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
  setActiveAIModel: (model: string) => Promise<boolean>;
  ollamaEndpoint: string;
  setOllamaEndpoint: (endpoint: string) => void;
  isChatOpen: boolean;
  setIsChatOpen: (isOpen: boolean) => void;
  isAILoading: boolean;
  setIsAILoading: (isLoading: boolean) => void;
  currentContext: ProjectContext | null;
  setCurrentContext: (context: ProjectContext | null) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (isOpen: boolean) => void;
  boardRefreshTrigger: number;
  notifyBoardRefresh: () => void;
  confirm: (options: { title: string; message: string; type?: 'danger' | 'warning' | 'info'; confirmText?: string; cancelText?: string; onConfirm: () => void }) => void;
  alert: (options: { title: string; message: string; type?: 'danger' | 'warning' | 'info'; onConfirm?: () => void }) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_PRIORITY_SETTINGS: PrioritySettings = {
  [Priority.LOW]: { bg: '#dbeafe', text: '#1e40af' },    
  [Priority.MEDIUM]: { bg: '#fef3c7', text: '#92400e' }, 
  [Priority.HIGH]: { bg: '#fee2e2', text: '#991b1b' },   
};

// AI model allowlist: only Qwen regular >=1B and <=7B, exclude VL/embedding variants
const isAllowedModel = (name: string) => {
  const n = name.toLowerCase();
  if (!n.includes('qwen')) return false;
  if (n.includes('vl') || n.includes('vision') || n.includes('embed') || n.includes('embedding')) return false;
  // extract size before 'b' e.g. 7b, 4b, 14b
  const sizeMatch = n.match(/(\d+(?:\.\d+)?)\s*b/);
  if (!sizeMatch) return false;
  const size = parseFloat(sizeMatch[1]);
  return size >= 1 && size <= 7;
};

const parseSize = (name: string) => {
  const m = name.toLowerCase().match(/(\d+(?:\.\d+)?)\s*b/);
  return m ? parseFloat(m[1]) : Infinity;
};

const getGroupName = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('qwen')) return 'Qwen';
  if (n.includes('gemma')) return 'Gemma';
  if (n.includes('llama')) return 'Llama';
  if (n.includes('deepseek')) return 'DeepSeek';
  if (n.includes('mistral') || n.includes('mixtral')) return 'Mistral';
  if (n.includes('phi')) return 'Phi';
  return 'Others';
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
  const [projects, setProjects] = useState<Project[] | null>([]);
  const [prioritySettings, setPrioritySettings] = useState<PrioritySettings>(DEFAULT_PRIORITY_SETTINGS);
  const [appLoading, setAppLoading] = useState(true);
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [aiModels, setAiModels] = useState<string[]>([]);
  const [activeModel, setActiveModel] = useState<string>('');
  const [ollamaEndpoint, setOllamaEndpoint] = useState<string>('http://localhost:11434');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [currentContext, setCurrentContext] = useState<ProjectContext | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [boardRefreshTrigger, setBoardRefreshTrigger] = useState(0);

  // Global Modal State
  const [modalConfig, setModalConfig] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      type: 'danger' | 'warning' | 'info';
      confirmText?: string;
      cancelText?: string;
      onConfirm: () => void;
      isAlert: boolean;
  }>({
      isOpen: false,
      title: '',
      message: '',
      type: 'info',
      onConfirm: () => {},
      isAlert: false
  });

  const confirm = useCallback((options: { title: string; message: string; type?: 'danger' | 'warning' | 'info'; confirmText?: string; cancelText?: string; onConfirm: () => void }) => {
      setModalConfig({
          isOpen: true,
          title: options.title,
          message: options.message,
          type: options.type || 'danger',
          confirmText: options.confirmText,
          cancelText: options.cancelText,
          onConfirm: options.onConfirm,
          isAlert: false
      });
  }, []);

  const alert = useCallback((options: { title: string; message: string; type?: 'danger' | 'warning' | 'info'; onConfirm?: () => void }) => {
      setModalConfig({
          isOpen: true,
          title: options.title,
          message: options.message,
          type: options.type || 'info',
          onConfirm: options.onConfirm || (() => {}),
          isAlert: true
      });
  }, []);

  const notifyBoardRefresh = useCallback(() => {
      setBoardRefreshTrigger(prev => prev + 1);
  }, []);

  const disableAI = () => {
      setIsAIEnabled(false);
  };

  const refreshProjects = async () => {
      const fetchedProjects = await db.getProjects();
      if (fetchedProjects) setProjects(fetchedProjects);
  };

  const fetchModels = useCallback(async (): Promise<string[]> => {
      try {
          const response = await fetch('/api/ai/models', {
              headers: { 
                  'Content-Type': 'application/json',
                  'x-ollama-endpoint': ollamaEndpoint 
              }
          });
          if (!response.ok) {
            setAiModels([]);
            return [];
          }
          const data = await response.json();
          if (data && data.models && Array.isArray(data.models)) {
              const modelNames = data.models
                .map((m: any) => m.name)
                .filter(isAllowedModel);
              
              setAiModels(prev => {
                if (JSON.stringify(prev) === JSON.stringify(modelNames)) return prev;
                return modelNames;
              });

              // DO NOT auto-select the first model if we already have an active one
              // This prevents overwriting the saved model from DB
              setActiveModel(currentActive => {
                  if (modelNames.length > 0 && !currentActive) {
                      return modelNames[0];
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
  }, [ollamaEndpoint]);

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
              const timeoutId = setTimeout(() => controller.abort(), 30000);
              
            const response = await fetch('/api/ai/generate', {
                  method: 'POST',
                  headers: { 
                      'Content-Type': 'application/json',
                      'x-ollama-endpoint': ollamaEndpoint
                  },
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
      if (!isAllowedModel(model)) return;
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

  const parseSize = (name: string) => {
      const m = name.toLowerCase().match(/(\d+(?:\.\d+)?)\s*b/);
      return m ? parseFloat(m[1]) : Infinity;
  };

  const setActiveAIModel = async (model: string): Promise<boolean> => {
      setActiveModel(model);
      
      // When a user selects a model, we should:
      // 1. Re-fetch available models to ensure list is fresh
      await fetchModels();
      
      // 2. Test connectivity with this specific model
      setIsAILoading(true);
      try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          
          const response = await fetch('/api/ai/generate', {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'x-ollama-endpoint': ollamaEndpoint
              },
              body: JSON.stringify({ prompt: "ping", model: model })
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
              setIsAIEnabled(true);
              return true;
          } else {
              // If model doesn't exist anymore or Ollama is down
              setIsAIEnabled(false);
              return false;
          }
      } catch (e) {
          console.error("AI Model Selection Check Failed:", e);
          setIsAIEnabled(false);
          return false;
      } finally {
          setIsAILoading(false);
      }
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
            
            let loadedActiveModel = '';
            if (fetchedAISettings) {
                setAiModels(fetchedAISettings.models || []);
                loadedActiveModel = fetchedAISettings.active || '';
                setActiveModel(loadedActiveModel);
                setIsAIEnabled(!!fetchedAISettings.enabled);
                if (fetchedAISettings.endpoint) setOllamaEndpoint(fetchedAISettings.endpoint);
            }

            // AUTO-ACTIVATION LOGIC:
            // 1. Fetch available models from Ollama
            const availableModels = await fetchModels();
            
            // 2. If Ollama is active and has models
            if (availableModels.length > 0) {
                const modelToUse = loadedActiveModel && isAllowedModel(loadedActiveModel)
                  ? loadedActiveModel
                  : availableModels.find(isAllowedModel) || availableModels[0];
                
                // 3. Verify if the saved model (or first available) is actually present
                if (availableModels.includes(modelToUse)) {
                    console.log(`[AppContext] Ollama detected with model "${modelToUse}". Auto-activating AI.`);
                    setActiveModel(modelToUse);
                    setIsAIEnabled(true); // Automatically turn on if Ollama is ready
                }
            }

            // Sort models by size ascending for UI
            const grouped = availableModels.reduce((acc, model) => {
              const group = getGroupName(model);
              if (!acc[group]) acc[group] = [];
              acc[group].push(model);
              return acc;
            }, {} as Record<string, string[]>);

            Object.keys(grouped).forEach(group => {
              grouped[group] = grouped[group].slice().sort((m1, m2) => parseSize(m1) - parseSize(m2));
            });
            // Flatten back to aiModels ordering by group (keep current grouping sort)
            const sortedGroups = Object.keys(grouped).sort((a, b) => {
              if (a === 'Qwen') return -1;
              if (b === 'Qwen') return 1;
              if (a === 'Others') return 1;
              if (b === 'Others') return -1;
              return a.localeCompare(b);
            });
            const sortedModels = sortedGroups.flatMap(g => grouped[g] || []);
            setAiModels(sortedModels);
            
            console.log("[AppContext] Initial projects:", fetchedProjects);
            
            if (fetchedProjects && fetchedProjects.length > 0) {
                setProjects(fetchedProjects);
            } else if (fetchedProjects === null) {
                console.error("[AppContext] Failed to fetch projects. Setting to null for connection error UI.");
                setProjects(null);
            } else {
                // SEEDING LOGIC: Database is empty (fetchedProjects is [])
                console.log("Database empty. Seeding Welcome Project...");
                const seedProjects = [SEED_PROJECT];
                
                setProjects(seedProjects);
                await db.saveProjects(seedProjects);
                await db.saveColumns(SEED_PROJECT.id, TEMPLATE_COLUMNS_SEED);
                await db.saveTasks(SEED_PROJECT.id, SEED_TASKS);
                console.log("Seeding complete.");
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
    // Only save projects if application is initialized and not loading, and we have projects
    if (!appLoading && isInitialized && projects !== null) {
        db.saveProjects(projects);
    }
  }, [projects, appLoading, isInitialized]);

  useEffect(() => {
    if (!appLoading && isInitialized) db.saveSettings(prioritySettings);
  }, [prioritySettings, appLoading, isInitialized]);

  useEffect(() => {
    if (!appLoading && isInitialized) {
        db.saveAISettings({ 
            models: aiModels, 
            active: activeModel,
            enabled: isAIEnabled,
            endpoint: ollamaEndpoint
        });
    }
  }, [aiModels, activeModel, isAIEnabled, ollamaEndpoint, appLoading, isInitialized]);

  return (
    <AppContext.Provider value={{ projects, setProjects, prioritySettings, setPrioritySettings, appLoading, refreshProjects, isAIEnabled, toggleAI, disableAI, aiModels, activeModel, fetchModels, addAIModel, removeAIModel, setActiveAIModel, ollamaEndpoint, setOllamaEndpoint, isChatOpen, setIsChatOpen, isAILoading, setIsAILoading, currentContext, setCurrentContext, isSearchOpen, setIsSearchOpen, boardRefreshTrigger, notifyBoardRefresh, confirm, alert }}>
      {children}
      <ConfirmModal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
        isAlert={modalConfig.isAlert}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modalConfig.onConfirm}
      />
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

