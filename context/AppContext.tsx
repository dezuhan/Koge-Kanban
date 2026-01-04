import React, { createContext, useContext, useState, useEffect } from 'react';
import { Project, PrioritySettings, Priority, Task, Column } from '../types';
import { db } from '../services/db';

interface AppContextType {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  prioritySettings: PrioritySettings;
  setPrioritySettings: React.Dispatch<React.SetStateAction<PrioritySettings>>;
  appLoading: boolean;
  refreshProjects: () => Promise<void>;
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
        media: 'https://images.unsplash.com/photo-1542626991-cbc4e32524cc?w=400&q=80',
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

  const refreshProjects = async () => {
      const fetchedProjects = await db.getProjects();
      if (fetchedProjects) setProjects(fetchedProjects);
  };

  useEffect(() => {
    const initApp = async () => {
        try {
            const [fetchedProjects, fetchedSettings] = await Promise.all([
                db.getProjects(),
                db.getSettings()
            ]);
            
            if (fetchedSettings) setPrioritySettings(fetchedSettings);
            
            if (fetchedProjects && fetchedProjects.length > 0) {
                setProjects(fetchedProjects);
            } else {
                // SEEDING LOGIC: Database is empty, create Welcome Project
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
    if (!appLoading) db.saveProjects(projects);
  }, [projects, appLoading]);

  useEffect(() => {
    if (!appLoading) db.saveSettings(prioritySettings);
  }, [prioritySettings, appLoading]);

  return (
    <AppContext.Provider value={{ projects, setProjects, prioritySettings, setPrioritySettings, appLoading, refreshProjects }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

