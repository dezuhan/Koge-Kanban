import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Project, PrioritySettings, Priority, Task, Column, ProjectContext, User } from '../types';
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
    apiBaseUrl: string;
    setApiBaseUrl: (url: string) => void;
    isChatOpen: boolean;
    setIsChatOpen: (isOpen: boolean) => void;
    isAILoading: boolean;
    setIsAILoading: (isLoading: boolean) => void;
    isOllamaOnline: boolean;
    currentContext: ProjectContext | null;
    setCurrentContext: React.Dispatch<React.SetStateAction<ProjectContext | null>>;
    isSearchOpen: boolean;
    setIsSearchOpen: (isOpen: boolean) => void;
    boardRefreshTrigger: number;
    notifyBoardRefresh: () => void;
    showConnModal: boolean;
    setShowConnModal: (show: boolean) => void;
    trashRetentionDays: number;
    setTrashRetentionDays: (days: number) => void;
    autoBackupInterval: number;
    setAutoBackupInterval: (days: number) => void;
    confirm: (options: { title: string; message: string; type?: 'danger' | 'warning' | 'info'; confirmText?: string; cancelText?: string; onConfirm: () => void }) => void;
    alert: (options: { title: string; message: string; type?: 'danger' | 'warning' | 'info'; onConfirm?: () => void }) => void;
    user: User | null;
    isAuthenticated: boolean;
    login: (u: string, p: string) => Promise<void>;
    register: (u: string, e: string, p: string) => Promise<void>;
    guestLogin: () => void;
    logout: () => void;
    deleteAccount: (userId: string | number) => Promise<void>;
    notifications: any[];
    unreadCount: number;
    newNotification: any | null;
    setNewNotification: (n: any | null) => void;
    setNotifications: React.Dispatch<React.SetStateAction<any[]>>;
    refreshNotifications: () => Promise<void>;
    markNotificationRead: (id: number | string) => Promise<void>;
    removeNotification: (id: number | string) => Promise<void>;
    isWebSocketEnabled: boolean;
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
    const [projects, setProjects] = useState<Project[] | null>([]);
    const [isWebSocketEnabled, setIsWebSocketEnabled] = useState(true);
    const [prioritySettings, setPrioritySettings] = useState<PrioritySettings>(DEFAULT_PRIORITY_SETTINGS);
    const [appLoading, setAppLoading] = useState(true);
    const [isAIEnabled, setIsAIEnabled] = useState(false);
    const [aiModels, setAiModels] = useState<string[]>([]);
    const [activeModel, setActiveModel] = useState<string>('');
    const [ollamaEndpoint, setOllamaEndpoint] = useState<string>('http://localhost:11434');
    const [apiBaseUrl, setApiBaseUrlState] = useState<string>(() => {
        return localStorage.getItem('koge_api_base_url') || '';
    });
    const [isInitialized, setIsInitialized] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isAILoading, setIsAILoading] = useState(false);
    const [isOllamaOnline, setIsOllamaOnline] = useState(false);
    const [currentContext, setCurrentContext] = useState<ProjectContext | null>(null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [boardRefreshTrigger, setBoardRefreshTrigger] = useState(0);
    const [showConnModal, setShowConnModal] = useState(false);
    const [trashRetentionDays, setTrashRetentionDaysState] = useState(3);
    const [autoBackupInterval, setAutoBackupIntervalState] = useState(0);

    // Auth State
    const [user, setUser] = useState<User | null>(null);
    const isAuthenticated = !!user;

    const login = async (username, password) => {
        const result = await db.auth.login(username, password) as any;
        if (result && result.success) {
            setUser({ ...result.user, token: result.token });
            localStorage.setItem('koge_auth_token', result.token);
            localStorage.setItem('koge_user_info', JSON.stringify(result.user));
            localStorage.removeItem('koge_is_guest');
            window.location.reload();
        } else {
            throw new Error(result?.error || 'Login failed');
        }
    };

    const register = async (username, email, password) => {
        const result = await db.auth.register(username, email, password) as any;
        if (result && result.success) {
            setUser({ ...result.user, token: result.token });
            localStorage.setItem('koge_auth_token', result.token);
            localStorage.setItem('koge_user_info', JSON.stringify(result.user));
            localStorage.removeItem('koge_is_guest');
            window.location.reload();
        } else {
            throw new Error(result?.error || 'Registration failed');
        }
    };

    const guestLogin = () => {
        const guestUser = { id: 'guest', username: 'Guest', isGuest: true };
        setUser(guestUser);
        localStorage.removeItem('koge_auth_token');
        localStorage.removeItem('koge_user_info');
        localStorage.setItem('koge_is_guest', 'true');
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('koge_auth_token');
        localStorage.removeItem('koge_user_info');
        localStorage.removeItem('koge_is_guest');
        db.disconnectSocket();
        window.location.href = '/';
    };

    // Notifications State
    const [notifications, setNotifications] = useState<any[]>([]);
    const [newNotification, setNewNotification] = useState<any | null>(null);
    const [lastNotifId, setLastNotifId] = useState<number>(0);
    const unreadCount = notifications.filter(n => !n.isRead).length;

    const refreshNotifications = useCallback(async () => {
        if (!isAuthenticated || user?.id === 'guest') return;
        try {
            const data = await db.notifications.getAll();
            if (data && data.length > 0) {
                // Check for new notifications to show toast
                const latest = data[0]; // Assuming sorted by date DESC
                if (lastNotifId !== 0 && latest.id > lastNotifId && !latest.isRead) {
                    setNewNotification(latest);
                }
                setLastNotifId(latest.id);
                setNotifications(data);
            } else if (data) {
                setNotifications(data);
            }
        } catch (e) {
            console.error("Failed to refresh notifications", e);
        }
    }, [isAuthenticated, user?.id, lastNotifId]);

    const markNotificationRead = async (id: number | string) => {
        try {
            await db.notifications.markAsRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (e) {
            console.error("Failed to mark notification as read", e);
        }
    };

    const removeNotification = async (id: number | string) => {
        try {
            await db.notifications.delete(id);
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (e) {
            console.error("Failed to delete notification", e);
        }
    };

    // Polling for notifications
    useEffect(() => {
        if (isAuthenticated && user?.id !== 'guest') {
            refreshNotifications();
            const interval = setInterval(refreshNotifications, 10000); // Poll every 10s for "real-time" feel
            return () => clearInterval(interval);
        }
    }, [isAuthenticated, user?.id, refreshNotifications]);

    const deleteAccount = async (userId: string | number) => {
        try {
            const result = await db.auth.deleteUser(userId) as any;
            if (result && result.success) {
                logout(); // Clear session if deleted
            }
        } catch (error: any) {
            if (error.message?.includes('User not found') || error.message?.includes('404')) {
                logout();
            } else {
                throw error;
            }
        }
    };

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('koge_auth_token');
            const userInfoStr = localStorage.getItem('koge_user_info');
            const isGuest = localStorage.getItem('koge_is_guest');

            if (token && userInfoStr) {
                try {
                    const userInfo = JSON.parse(userInfoStr);
                    setUser({ ...userInfo, token });
                } catch (e) {
                    localStorage.removeItem('koge_auth_token');
                }
            } else if (isGuest) {
                setUser({ id: 'guest', username: 'Guest', isGuest: true });
            }
        };
        checkAuth();
    }, []);

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
        onConfirm: () => { },
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
            onConfirm: options.onConfirm || (() => { }),
            isAlert: true
        });
    }, []);

    const notifyBoardRefresh = useCallback(() => {
        setBoardRefreshTrigger(prev => prev + 1);
    }, []);

    const disableAI = () => {
        setIsAIEnabled(false);
    };

    const setApiBaseUrl = (url: string) => {
        setApiBaseUrlState(url);
        localStorage.setItem('koge_api_base_url', url);
    };

    const setTrashRetentionDays = (days: number) => {
        setTrashRetentionDaysState(days);
        db.save('trash_retention_days', days);
    };

    const setAutoBackupInterval = (days: number) => {
        setAutoBackupIntervalState(days);
        // We save this into kanban_settings so the server can see it easily
        db.save('kanban_settings', { ...prioritySettings, autoBackupInterval: days });
    };

    const refreshProjects = async () => {
        const fetchedProjects = await db.getProjects();
        if (fetchedProjects) setProjects(fetchedProjects);
    };

    const fetchModels = useCallback(async (): Promise<string[]> => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for stability

            const response = await fetch('/api/ai/models', {
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'x-ollama-endpoint': ollamaEndpoint,
                    'Authorization': `Bearer ${localStorage.getItem('koge_auth_token')}`
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                setAiModels([]);
                setIsOllamaOnline(false);
                return [];
            }
            const data = await response.json();
            if (data && data.models && Array.isArray(data.models)) {
                const modelNames = data.models.map((m: any) => m.name);

                setIsOllamaOnline(true);
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
            setIsOllamaOnline(false);
            setAiModels([]);
            return [];
        } catch (e) {
            console.error("Failed to fetch models:", e);
            setIsOllamaOnline(false);
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
            // Check if Ollama is running before enabling
            try {
                const availableModels = await fetchModels();
                if (availableModels.length === 0) {
                    alert({
                        title: 'Ollama Offline',
                        message: 'Could not connect to Ollama. Please ensure Ollama is running (ollama serve) and you have at least one model downloaded.',
                        type: 'warning'
                    });
                    return false;
                }

                if (!activeModel) {
                    // Try to pick first available
                    setActiveModel(availableModels[0]);
                }

                setIsAIEnabled(true);
                return true;
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

    const setActiveAIModel = async (model: string): Promise<boolean> => {
        setActiveModel(model);

        // When a user selects a model, we should:
        // 1. Re-fetch available models to ensure list is fresh
        await fetchModels();

        // 2. Test connectivity with this specific model
        setIsAILoading(true);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased to 10s for public servers

            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-ollama-endpoint': ollamaEndpoint,
                    'Authorization': `Bearer ${localStorage.getItem('koge_auth_token')}`
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
                const [fetchedProjects, fetchedSettings, fetchedAISettings, fetchedRetention, fetchedHealth] = await Promise.all([
                    db.getProjects(),
                    db.getSettings() as Promise<any>,
                    db.getAISettings(),
                    db.get('trash_retention_days') as Promise<number | null>,
                    db.getHealth()
                ]);

                if (fetchedHealth && typeof fetchedHealth.websocket === 'boolean') {
                    setIsWebSocketEnabled(fetchedHealth.websocket);
                }

                if (fetchedSettings) {
                    setPrioritySettings(fetchedSettings);
                    if (fetchedSettings.autoBackupInterval !== undefined) {
                        setAutoBackupIntervalState(fetchedSettings.autoBackupInterval);
                    }
                }
                if (fetchedRetention !== null) setTrashRetentionDaysState(fetchedRetention);

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
                const isOnline = availableModels.length > 0;

                // 2. Synchronization
                if (isOnline) {
                    const modelToUse = loadedActiveModel || availableModels[0];
                    if (availableModels.includes(modelToUse)) {
                        setActiveModel(modelToUse);
                        // Only enable if it was previously enabled OR if it's the very first time (fetchedAISettings is null)
                        if (fetchedAISettings === null || fetchedAISettings.enabled) {
                            setIsAIEnabled(true);
                        }
                    }
                } else {
                    // Ollama is offline or has no models, force AI off visually
                    setIsAIEnabled(false);
                }


                if (fetchedProjects && fetchedProjects.length > 0) {
                    setProjects(fetchedProjects);
                    setShowConnModal(false);
                } else if (fetchedProjects === null) {
                    console.error("[AppContext] Failed to fetch projects. Modal disabled.");
                    setProjects([]);
                    setShowConnModal(false);
                } else {
                    // SEEDING LOGIC: Database is empty (fetchedProjects is [])
                    const seedProjects = [SEED_PROJECT];

                    setProjects(seedProjects);
                    await db.saveProjects(seedProjects);
                    await db.saveColumns(SEED_PROJECT.id, TEMPLATE_COLUMNS_SEED);
                    await db.saveTasks(SEED_PROJECT.id, SEED_TASKS);
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

    // Helper for browser push notifications
    const showPushNotification = useCallback((title: string, body: string) => {
        if (!("Notification" in window)) return;

        if (Notification.permission === "granted") {
            try {
                new Notification(title, {
                    body,
                    icon: '/favicon.ico',
                    badge: '/favicon.ico',
                    silent: false
                });
            } catch (e) {
                console.warn("Native notification failed", e);
            }
        }
    }, []);

    const requestNotificationPermission = useCallback(async () => {
        if (!("Notification" in window)) return;
        if (Notification.permission === "default") {
            try {
                await Notification.requestPermission();
            } catch (e) {
                console.error("Permission request failed", e);
            }
        }
    }, []);

    // Real-time synchronization
    useEffect(() => {
        if (isInitialized && isAuthenticated && user && isWebSocketEnabled) {
            db.initSocket();
            db.joinUser(user.id);

            const offData = db.onDataUpdate((data) => {
                if (data.senderId === user.id) return; // Ignore own changes

                if (data.key === 'kanban_projects') {
                    refreshProjects();
                } else if (data.key.startsWith('tasks_') || data.key.startsWith('columns_')) {
                    const projectId = data.key.split('_')[1];
                    if (currentContext?.projectId === projectId) {
                        notifyBoardRefresh();
                    }
                }
            });

            const offNotif = db.onNotification((notif) => {
                refreshNotifications();
                setNewNotification(notif);

                // Trigger Browser Push Notification
                showPushNotification("Koge Kanban", notif.message);
            });

            // Request permission upon auth
            requestNotificationPermission();

            return () => {
                offData();
                offNotif();
            };
        }
    }, [isInitialized, isAuthenticated, user, currentContext?.projectId, refreshProjects, notifyBoardRefresh, refreshNotifications, isWebSocketEnabled]);

    // Persistence
    useEffect(() => {
        // Only save projects if application is initialized and not loading, and we have projects
        if (!appLoading && isInitialized && projects !== null) {
            db.saveProjects(projects);
        }
    }, [projects, appLoading, isInitialized]);

    useEffect(() => {
        if (!appLoading && isInitialized) {
            db.save('kanban_settings', { ...prioritySettings, autoBackupInterval });
        }
    }, [prioritySettings, autoBackupInterval, appLoading, isInitialized]);

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
        <AppContext.Provider value={{
            projects, setProjects, prioritySettings, setPrioritySettings, appLoading,
            refreshProjects, isAIEnabled, toggleAI, disableAI, aiModels, activeModel,
            fetchModels, addAIModel, removeAIModel, setActiveAIModel, ollamaEndpoint,
            setOllamaEndpoint, apiBaseUrl, setApiBaseUrl, isChatOpen, setIsChatOpen,
            isAILoading, setIsAILoading, isOllamaOnline, currentContext, setCurrentContext,
            isSearchOpen, setIsSearchOpen, boardRefreshTrigger, notifyBoardRefresh,
            showConnModal, setShowConnModal, trashRetentionDays, setTrashRetentionDays,
            autoBackupInterval, setAutoBackupInterval, confirm, alert,
            user, isAuthenticated, login, register, guestLogin, logout, deleteAccount,
            notifications, unreadCount, newNotification, setNewNotification, setNotifications,
            refreshNotifications, markNotificationRead, removeNotification, isWebSocketEnabled
        }}>
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

