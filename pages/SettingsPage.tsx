import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Priority, PrioritySettings } from '../types';
import { RefreshCw, RotateCcw, Globe, Cpu, CheckCircle2, Circle, Star, AlertTriangle, Plus, Trash2, ChevronLeft, Layout, Palette, User, Database, Lock, ShieldAlert } from 'lucide-react';
import { useApp } from '../context/AppContext';
import FineTuningSettings from '../components/FineTuningSettings';

type SettingsCategory = 'general' | 'fine-tuning' | 'appearance' | 'security' | 'account';

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const {
        prioritySettings,
        setPrioritySettings,
        setProjects,
        ollamaEndpoint,
        setOllamaEndpoint,
        fetchModels,
        aiModels,
        activeModel,
        setActiveAIModel,
        addAIModel,
        removeAIModel,
        apiBaseUrl,
        setApiBaseUrl,
        isOllamaOnline,
        trashRetentionDays,
        setTrashRetentionDays,
        autoBackupInterval,
        setAutoBackupInterval,
        confirm: globalConfirm,
        alert: globalAlert,
        user,
        logout,
        deleteAccount
    } = useApp();

    const [showToast, setShowToast] = useState(false);
    const [activeCategory, setActiveCategory] = useState<SettingsCategory>('general');
    const [apiBaseDomain, setApiBaseDomain] = useState(apiBaseUrl);
    const [isTestingConn, setIsTestingConn] = useState(false);
    const [connOk, setConnOk] = useState<boolean | null>(null);
    const [isRefreshingModels, setIsRefreshingModels] = useState(false);
    const [newModelName, setNewModelName] = useState('');
    const [backups, setBackups] = useState<any[]>([]);
    const [isRefreshingBackups, setIsRefreshingBackups] = useState(false);
    const [isCreatingBackup, setIsCreatingBackup] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isCleaningTemp, setIsCleaningTemp] = useState(false);

    useEffect(() => {
        handleRefreshModels();
        handleRefreshBackups();
    }, []);

    const handleRefreshModels = async () => {
        setIsRefreshingModels(true);
        await fetchModels();
        setIsRefreshingModels(false);
    };

    const handleChangePriority = (priority: Priority, type: 'bg' | 'text', value: string) => {
        setPrioritySettings(prev => {
            const newSettings = {
                ...prev,
                [priority]: {
                    ...prev[priority],
                    [type]: value
                }
            };
            return newSettings;
        });

        // Show feedback
        setShowToast(true);
        const timeout = setTimeout(() => setShowToast(false), 2000);
        return () => clearTimeout(timeout);
    };

    const handleSaveApiBase = async () => {
        const normalizedDomain = apiBaseDomain.trim().replace(/\/+$/, '');

        setIsTestingConn(true);
        setConnOk(null);

        try {
            const { db } = await import('../services/db');
            const isOk = await db.testConnection(normalizedDomain);
            setConnOk(isOk);

            if (isOk) {
                setApiBaseUrl(normalizedDomain);
                // Give user a moment to see success before reload
                setTimeout(() => window.location.reload(), 800);
            }
        } catch (e) {
            setConnOk(false);
        } finally {
            setIsTestingConn(false);
        }
    };

    const handleResetColors = () => {
        globalConfirm({
            title: 'Reset Colors?',
            message: 'This will reset all priority colors to their default values.',
            type: 'warning',
            confirmText: 'Reset',
            onConfirm: () => {
                const defaults: PrioritySettings = {
                    [Priority.LOW]: { bg: '#dbeafe', text: '#1e40af' },
                    [Priority.MEDIUM]: { bg: '#fef3c7', text: '#92400e' },
                    [Priority.HIGH]: { bg: '#fee2e2', text: '#991b1b' },
                };
                setPrioritySettings(defaults);
                setShowToast(true);
                setTimeout(() => setShowToast(false), 2000);
            }
        });
    };

    const handleAddManualModel = (e: React.FormEvent) => {
        e.preventDefault();
        if (newModelName.trim()) {
            addAIModel(newModelName.trim());
            setNewModelName('');
        }
    };

    const isRecommended = (name: string) => {
        const n = name.toLowerCase();
        return n.includes('qwen2.5') || n.includes('qwen3');
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

    const handleSelectModel = async (model: string) => {
        setIsRefreshingModels(true);
        const success = await setActiveAIModel(model);
        setIsRefreshingModels(false);

        if (!success) {
            globalAlert({
                title: 'Connection Failed',
                message: `Failed to connect to model "${model}". Please ensure Ollama is running and the model is downloaded.`,
                type: 'danger'
            });
        }
    };

    const handleRefreshBackups = async () => {
        setIsRefreshingBackups(true);
        try {
            const { db } = await import('../services/db');
            const list = await db.backups.getList();
            setBackups(list || []);
        } catch (e) {
            console.error("Failed to load backups", e);
        } finally {
            setIsRefreshingBackups(false);
        }
    };

    const handleCreateBackup = async () => {
        setIsCreatingBackup(true);
        try {
            const { db } = await import('../services/db');
            await db.backups.create();
            globalAlert({ title: 'Success', message: 'Database backup created successfully.', type: 'info' });
            handleRefreshBackups();
        } catch (e) {
            globalAlert({ title: 'Error', message: 'Failed to create backup.', type: 'danger' });
        } finally {
            setIsCreatingBackup(false);
        }
    };

    const handleRestoreBackup = (filename: string) => {
        globalConfirm({
            title: 'Restore Database?',
            message: `Are you sure you want to restore the database from "${filename}"? This will overwrite ALL current data with the snapshot from that time. The application will reload.`,
            type: 'warning',
            confirmText: 'Yes, Restore Now',
            onConfirm: async () => {
                setIsRestoring(true);
                try {
                    const { db } = await import('../services/db');
                    await db.backups.restore(filename);
                    globalAlert({
                        title: 'Restore Successful',
                        message: 'Database has been restored. Reloading the application...',
                        type: 'info'
                    });
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 2000);
                } catch (e: any) {
                    console.error("Restore failed:", e);
                    globalAlert({
                        title: 'Restore Failed',
                        message: e.message || 'Failed to restore database.',
                        type: 'danger'
                    });
                    setIsRestoring(false);
                }
            }
        });
    };

    const handleDeleteBackup = (filename: string) => {
        globalConfirm({
            title: 'Delete Backup?',
            message: 'Are you sure you want to delete this backup file?',
            type: 'danger',
            onConfirm: async () => {
                try {
                    const { db } = await import('../services/db');
                    await db.backups.delete(filename);
                    handleRefreshBackups();
                } catch (e: any) {
                    globalAlert({ title: 'Error', message: e.message || 'Failed to delete backup.', type: 'danger' });
                }
            }
        });
    };

    const handleCleanupTemp = async () => {
        setIsCleaningTemp(true);
        try {
            const { db } = await import('../services/db');
            const result: any = await db.backups.cleanupTemp();
            globalAlert({
                title: 'Cleanup Successful',
                message: result.message || 'Temporary files cleaned up successfully.',
                type: 'info'
            });
        } catch (e: any) {
            globalAlert({ title: 'Error', message: e.message || 'Failed to cleanup temporary files.', type: 'danger' });
        } finally {
            setIsCleaningTemp(false);
        }
    };

    const handleResetData = () => {
        globalConfirm({
            title: 'Reset All Data?',
            message: 'This will permanently delete all your projects, columns, and tasks. This action cannot be undone. System settings like AI models and theme will be preserved.',
            type: 'danger',
            confirmText: 'Yes, Delete Everything',
            onConfirm: async () => {
                try {
                    const { db } = await import('../services/db');
                    // Important: Stop auto-save by setting projects to null in context
                    // before calling the wipe endpoint
                    setProjects(null);

                    await db.resetData();
                    globalAlert({
                        title: 'Data Reset',
                        message: 'All project data has been wiped successfully.',
                        type: 'info'
                    });
                    // Redirect to dashboard or reload
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 1500);
                } catch (e: any) {
                    globalAlert({
                        title: 'Reset Failed',
                        message: e.message || 'Failed to reset database.',
                        type: 'danger'
                    });
                }
            }
        });
    };

    const handleLogout = () => {
        globalConfirm({
            title: 'Logout?',
            message: 'Are you sure you want to log out of your current session?',
            onConfirm: logout
        });
    };

    const handleDeleteAccount = () => {
        if (!user || user.isGuest) return;

        globalConfirm({
            title: 'ERASE EVERYTHING?',
            message: 'This will delete your account AND wipe ALL project data from this server connection. This action is irreversible. Are you absolutely sure?',
            type: 'danger',
            confirmText: 'Yes, Wipe Everything & Delete Account',
            onConfirm: async () => {
                try {
                    await deleteAccount(user.id);
                    globalAlert({ title: 'Account Deleted', message: 'Your account has been removed.', type: 'info' });
                } catch (e: any) {
                    globalAlert({ title: 'Error', message: e.message || 'Failed to delete account.', type: 'danger' });
                }
            }
        });
    };

    const filteredAIModels = aiModels;

    const groupedModels = filteredAIModels.reduce((acc, model) => {
        const group = getGroupName(model);
        if (!acc[group]) acc[group] = [];
        acc[group].push(model);
        return acc;
    }, {} as Record<string, string[]>);

    const sortedGroups = Object.keys(groupedModels).sort((a, b) => {
        if (a === 'Qwen') return -1;
        if (b === 'Qwen') return 1;
        if (a === 'Others') return 1;
        if (b === 'Others') return -1;
        return a.localeCompare(b);
    });

    const categories = [
        { id: 'general', label: 'General', icon: <Globe size={18} />, description: 'Connectivity & AI setup' },
        { id: 'fine-tuning', label: 'Fine-Tuning', icon: <Cpu size={18} />, description: 'AI Models & Prompts' },
        { id: 'appearance', label: 'Appearance', icon: <Palette size={18} />, description: 'Themes & priority colors' },
        { id: 'security', label: 'Trash & Security', icon: <Trash2 size={18} />, description: 'Data protection & backups' },
        { id: 'account', label: 'Account', icon: <User size={18} />, description: 'Session & profile' },
    ];

    return (
        <div className="settings-page w-full p-4 md:p-10 min-h-screen flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                        title="Go Back"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Application Settings</h1>
                        <p className="text-sm text-gray-500 mt-1">Configure your workspace and AI preferences. Changes are saved automatically.</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 flex-1">
                {/* Sidebar Navigation */}
                <aside className="w-full md:w-64 flex-shrink-0">
                    <nav className="space-y-1">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id as SettingsCategory)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left group ${activeCategory === cat.id
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <div className={`${activeCategory === cat.id ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'}`}>
                                    {cat.icon}
                                </div>
                                <div>
                                    <div className="text-sm font-bold">{cat.label}</div>
                                    <div className={`text-[10px] ${activeCategory === cat.id ? 'text-blue-100' : 'text-gray-400'}`}>
                                        {cat.description}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </nav>
                </aside>

                {/* Content Area */}
                <main className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-gray-100 bg-slate-50/50">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            {categories.find(c => c.id === activeCategory)?.icon}
                            {categories.find(c => c.id === activeCategory)?.label}
                        </h2>
                    </div>

                    <div className="p-4 md:p-8 overflow-y-auto max-h-[calc(100vh-250px)] custom-scrollbar">
                        {activeCategory === 'general' && (
                            <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-300">
                                <section className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h4 className="text-sm font-bold text-slate-700">API Base Domain / URL</h4>
                                                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-tight transition-all ${apiBaseUrl ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${apiBaseUrl ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-rose-500'}`} />
                                                            {apiBaseUrl ? 'Connected' : 'Disconnected'}
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-slate-400">Specify where the database server is located.</p>
                                                </div>
                                            </div>

                                            <div className="relative group max-w-xl">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                                    <Globe size={18} />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={apiBaseDomain}
                                                    onChange={(e) => setApiBaseDomain(e.target.value)}
                                                    placeholder="http://localhost:3000/api"
                                                    disabled={isTestingConn || user?.isGuest}
                                                    className={`w-full pl-12 pr-32 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium ${user?.isGuest ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                />
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {isTestingConn && (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg text-blue-600 bg-blue-50">
                                                            <RefreshCw size={12} className="animate-spin" />
                                                            Testing...
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={handleSaveApiBase}
                                                        disabled={isTestingConn || user?.isGuest}
                                                        className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                                                    >
                                                        {isTestingConn ? <RefreshCw size={14} className="animate-spin" /> : 'Connect'}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100/50 max-w-xl">
                                                <AlertTriangle className="text-blue-500 mt-0.5 shrink-0" size={16} />
                                                <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                                                    * Default: <code className="bg-blue-100 px-1 rounded text-blue-800">http://localhost:3000/api</code>.
                                                    Use a local IP address or public domain if accessing from other devices.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <div className="h-px bg-gray-100 mx-1"></div>

                                <section className="space-y-8">
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">AI Engine (Ollama)</h3>
                                            <p className="text-xs text-gray-500">Configure your local AI backend and model preferences.</p>
                                        </div>

                                        <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 space-y-6">
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ollama Endpoint URL</label>
                                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-tight transition-all ${isOllamaOnline ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${isOllamaOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-rose-500'}`} />
                                                        {isOllamaOnline ? 'Connected' : 'Disconnected'}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={ollamaEndpoint}
                                                        onChange={(e) => setOllamaEndpoint(e.target.value)}
                                                        placeholder="http://localhost:11434"
                                                        className="flex-1 text-sm px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                                                    />
                                                    <button
                                                        onClick={handleRefreshModels}
                                                        disabled={isRefreshingModels}
                                                        className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors shadow-sm disabled:opacity-50"
                                                        title="Refresh Models"
                                                    >
                                                        <RefreshCw size={18} className={isRefreshingModels ? 'animate-spin' : ''} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-slate-200">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h4 className="text-sm font-bold text-gray-700">Available Models</h4>
                                                    <span className="bg-slate-200 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">{filteredAIModels.length} Found</span>
                                                </div>

                                                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3 mb-6">
                                                    <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                                                        <Star size={16} fill="currentColor" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-xs font-bold text-blue-800 mb-1">System Recommendation</h4>
                                                        <p className="text-[11px] text-blue-700 leading-relaxed">
                                                            For the best balance of speed and reasoning, we recommend <strong>Qwen 2.5</strong> or <strong>Qwen 3</strong> models with <strong>1b to 7b</strong> parameters.
                                                        </p>
                                                    </div>
                                                </div>

                                                {!isOllamaOnline ? (
                                                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-rose-200 bg-rose-50/20">
                                                        <AlertTriangle size={48} className="mx-auto text-rose-400 mb-4 opacity-70" />
                                                        <p className="text-sm font-bold text-rose-500">Ollama is Offline</p>
                                                        <p className="text-xs text-rose-400 mt-1">Please ensure <code className="bg-rose-100 px-1 rounded">ollama serve</code> is running on your system.</p>
                                                    </div>
                                                ) : filteredAIModels.length === 0 ? (
                                                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
                                                        <Cpu size={48} className="mx-auto text-slate-300 mb-4 opacity-50" />
                                                        <p className="text-sm font-bold text-slate-500">No Models Found</p>
                                                        <p className="text-xs text-slate-400 mt-1">Ollama is running, but no models were detected.</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                        {sortedGroups.map((group) => (
                                                            <div key={group} className="space-y-3">
                                                                <div className="flex items-center gap-2 px-1">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{group}</span>
                                                                    <div className="h-px bg-slate-100 flex-1"></div>
                                                                </div>
                                                                <div className="grid grid-cols-1 gap-2">
                                                                    {groupedModels[group].map((model) => (
                                                                        <div
                                                                            key={model}
                                                                            onClick={() => handleSelectModel(model)}
                                                                            className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${activeModel === model
                                                                                ? 'bg-blue-50 border-blue-300 shadow-sm ring-4 ring-blue-500/5'
                                                                                : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-md'
                                                                                } ${isRefreshingModels ? 'opacity-50 pointer-events-none' : ''}`}
                                                                        >
                                                                            <div className="flex items-center gap-4 overflow-hidden">
                                                                                <div className={`flex-shrink-0 transition-all ${activeModel === model ? 'text-blue-600 scale-110' : 'text-slate-300'}`}>
                                                                                    {activeModel === model ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                                                                                </div>
                                                                                <div className="flex flex-col min-w-0">
                                                                                    <span className={`text-sm font-bold truncate ${activeModel === model ? 'text-blue-900' : 'text-slate-700'}`}>
                                                                                        {model}
                                                                                    </span>
                                                                                    {isRecommended(model) && (
                                                                                        <span className="text-[10px] text-green-600 font-black flex items-center gap-1 mt-0.5">
                                                                                            <Star size={10} fill="currentColor" /> RECOMMENDED
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    globalConfirm({
                                                                                        title: 'Remove Model?',
                                                                                        message: `Are you sure you want to remove "${model}" from the list?`,
                                                                                        type: 'danger',
                                                                                        confirmText: 'Remove',
                                                                                        onConfirm: () => removeAIModel(model)
                                                                                    });
                                                                                }}
                                                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                            >
                                                                                <Trash2 size={18} />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="pt-6 border-t border-slate-200">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">Manual Model Registration</label>
                                                <form onSubmit={handleAddManualModel} className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={newModelName}
                                                        onChange={(e) => setNewModelName(e.target.value)}
                                                        placeholder="Add model manually (e.g. llama3)"
                                                        className="flex-1 text-sm px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={!newModelName.trim()}
                                                        className="bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-2 font-bold text-sm"
                                                    >
                                                        <Plus size={18} />
                                                        <span>Add</span>
                                                    </button>
                                                </form>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeCategory === 'fine-tuning' && (
                            <FineTuningSettings />
                        )}

                        {activeCategory === 'appearance' && (
                            <section className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Priority Colors</h3>
                                            <p className="text-xs text-gray-500">Customize how different task priorities look on your board.</p>
                                        </div>
                                        <button
                                            onClick={handleResetColors}
                                            className="px-3 py-1.5 text-[10px] font-black text-blue-600 hover:bg-blue-50 rounded-md border border-blue-200 uppercase tracking-widest transition-all"
                                        >
                                            Reset Defaults
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {Object.values(Priority).map((priority) => (
                                            <div key={priority} className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all space-y-6">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2 h-8 rounded-full" style={{ backgroundColor: prioritySettings[priority].bg }} />
                                                        <span className="font-black text-sm text-gray-800 uppercase tracking-widest">{priority}</span>
                                                    </div>
                                                    <div
                                                        className="px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.2em] border-2 shadow-sm"
                                                        style={{ backgroundColor: prioritySettings[priority].bg, color: prioritySettings[priority].text, borderColor: prioritySettings[priority].bg }}
                                                    >
                                                        Preview
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Background Color</label>
                                                        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-gray-100">
                                                            <input
                                                                type="color"
                                                                value={prioritySettings[priority].bg}
                                                                onChange={(e) => handleChangePriority(priority, 'bg', e.target.value)}
                                                                className="w-10 h-10 rounded-lg cursor-pointer border-2 border-white shadow-sm p-0 overflow-hidden"
                                                            />
                                                            <span className="text-xs font-mono font-bold text-gray-600 uppercase">{prioritySettings[priority].bg}</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Text Color</label>
                                                        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-gray-100">
                                                            <input
                                                                type="color"
                                                                value={prioritySettings[priority].text}
                                                                onChange={(e) => handleChangePriority(priority, 'text', e.target.value)}
                                                                className="w-10 h-10 rounded-lg cursor-pointer border-2 border-white shadow-sm p-0 overflow-hidden"
                                                            />
                                                            <span className="text-xs font-mono font-bold text-gray-600 uppercase">{prioritySettings[priority].text}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        )}

                        {activeCategory === 'security' && (
                            <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="relative">
                                    {/* Temporary Disable Overlay */}
                                    <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                                        <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-200/50">
                                            <Lock size={32} />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800 mb-2">System Under Maintenance</h3>
                                        <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
                                            Trash management and backup features are temporarily disabled to ensure data integrity during system updates.
                                        </p>
                                    </div>

                                    <section className="space-y-6">
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Trash Management</h3>
                                            <p className="text-xs text-gray-500">Items you delete are moved to trash for safety.</p>
                                        </div>

                                        <div className={`p-6 bg-slate-50 rounded-xl border border-slate-200 space-y-6 ${user?.isGuest ? 'opacity-60 pointer-events-none' : ''}`}>
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-sm font-bold text-slate-700">Trash Retention</label>
                                                    <p className="text-xs text-slate-400">Automatically permanently delete items after this period.</p>
                                                </div>
                                                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                                                    {[3, 7, 30].map((days) => (
                                                        <button
                                                            key={days}
                                                            onClick={() => setTrashRetentionDays(days)}
                                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${trashRetentionDays === days ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                                                        >
                                                            {days === 3 ? '3 Days' : days === 7 ? '1 Week' : '1 Month'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-6 border-t border-slate-100">
                                                <div className="space-y-1">
                                                    <label className="text-sm font-bold text-slate-700">Auto Backup (Soon)</label>
                                                    <p className="text-xs text-slate-400">Automatically create a database snapshot at regular intervals.</p>
                                                </div>
                                                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                                                    {[0, 7, 30, 90, 365].map((days) => (
                                                        <button
                                                            key={days}
                                                            onClick={() => setAutoBackupInterval(days)}
                                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${autoBackupInterval === days ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                                                        >
                                                            {days === 0 ? 'Off' : days === 7 ? '7 Days' : days === 30 ? '1 Mo' : days === 90 ? '3 Mo' : '1 Yr'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <h4 className="text-sm font-bold text-slate-700">Explore Trash</h4>
                                                    <p className="text-xs text-slate-400">View and restore recently deleted items.</p>
                                                </div>
                                                <button
                                                    onClick={() => navigate('/trash')}
                                                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
                                                >
                                                    <Trash2 size={16} />
                                                    Open Trash Bin
                                                </button>
                                            </div>
                                        </div>
                                    </section>

                                    <div className="h-px bg-gray-100 mx-1"></div>

                                    <section className="space-y-6">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex flex-col gap-1">
                                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Database Backups</h3>
                                                <p className="text-xs text-gray-500">Create snapshots of your entire workspace.</p>
                                            </div>
                                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                                <button
                                                    onClick={handleCleanupTemp}
                                                    disabled={isCleaningTemp}
                                                    className="flex-1 sm:flex-none justify-center px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2 disabled:opacity-50"
                                                    title="Cleanup temporary restore files"
                                                >
                                                    {isCleaningTemp ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                    <span className="truncate">Cleanup Temp</span>
                                                </button>
                                                <button
                                                    onClick={handleCreateBackup}
                                                    disabled={isCreatingBackup || user?.isGuest}
                                                    className="flex-1 sm:flex-none justify-center px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isCreatingBackup ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                                                    <span className="truncate">Create Backup</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                            {isRefreshingBackups ? (
                                                <div className="py-12 flex flex-col items-center gap-2 text-slate-400">
                                                    <RefreshCw size={32} className="animate-spin" />
                                                    <span className="text-xs font-medium">Scanning for backups...</span>
                                                </div>
                                            ) : backups.length === 0 ? (
                                                <div className="py-12 text-center text-slate-400">
                                                    <Database size={48} className="mx-auto mb-3 opacity-20" />
                                                    <p className="text-sm font-bold">No backups available yet</p>
                                                    <p className="text-xs mt-1">Snapshots will be saved in the <code className="bg-slate-100 px-1 rounded">backups/</code> folder.</p>
                                                </div>
                                            ) : (
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-50 border-b border-slate-100">
                                                            <th className="px-4 md:px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Snapshot File</th>
                                                            <th className="hidden sm:table-cell px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Size</th>
                                                            <th className="px-4 md:px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {backups.map((backup) => (
                                                            <tr key={backup.filename} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                                <td className="px-4 md:px-6 py-4">
                                                                    <div className="flex flex-col max-w-[150px] md:max-w-none">
                                                                        <span className="text-sm font-bold text-slate-700 break-all">{backup.filename}</span>
                                                                        <span className="text-[10px] text-slate-400 font-medium">{new Date(backup.createdAt).toLocaleString()}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="hidden sm:table-cell px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                                                                    {(backup.size / 1024 / 1024).toFixed(2)} MB
                                                                </td>
                                                                <td className="px-4 md:px-6 py-4 text-right">
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <button
                                                                            onClick={() => handleRestoreBackup(backup.filename)}
                                                                            className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                            title="Restore database"
                                                                            disabled={isRestoring}
                                                                        >
                                                                            <RotateCcw size={16} className={isRestoring ? 'animate-spin' : ''} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteBackup(backup.filename)}
                                                                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                                            title="Delete snapshot"
                                                                            disabled={isRestoring}
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>

                                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
                                            <AlertTriangle className="text-amber-500 mt-0.5 shrink-0" size={16} />
                                            <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                                                Backups only contain the database file. Any custom media files or environment settings outside the DB are NOT included.
                                            </p>
                                        </div>
                                    </section>
                                </div>

                                <div className="h-px bg-gray-100 mx-1"></div>

                                {/* Danger Zone */}
                                <section className="space-y-6">
                                    <div className="flex flex-col gap-1">
                                        <h3 className="text-sm font-bold text-rose-600 uppercase tracking-wider flex items-center gap-2">
                                            <AlertTriangle size={18} />
                                            Danger Zone
                                        </h3>
                                        <p className="text-xs text-gray-500">Irreversible actions that affect your entire workspace.</p>
                                    </div>

                                    <div className="p-6 bg-rose-50 rounded-xl border border-rose-100 space-y-4">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="space-y-1">
                                                <label className="text-sm font-bold text-rose-900">Delete Entire Data</label>
                                                <p className="text-xs text-rose-700/70">Wipe all projects, columns, and tasks from the database.</p>
                                            </div>
                                            <button
                                                onClick={handleResetData}
                                                disabled={user?.isGuest}
                                                className="px-6 py-2.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-all flex items-center gap-2 shadow-lg shadow-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Trash2 size={16} />
                                                Reset All Data
                                            </button>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeCategory === 'account' && (
                            <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-300">
                                <section className="space-y-6">
                                    <div className="flex flex-col gap-1">
                                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Account Information</h3>
                                        <p className="text-xs text-gray-500">Your current session and profile details.</p>
                                    </div>

                                    <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-8">
                                        {/* User Profile Card */}
                                        <div className="flex flex-col md:flex-row items-center gap-6 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                            <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-blue-200">
                                                {user?.username?.[0].toUpperCase() || (user?.isGuest ? 'G' : '?')}
                                            </div>
                                            <div className="flex-1 text-center md:text-left space-y-1">
                                                <h4 className="text-xl font-black text-slate-800">{user?.username || (user?.isGuest ? 'Guest User' : 'Unknown')}</h4>
                                                <p className="text-sm text-slate-400 font-medium">{user?.email || (user?.isGuest ? 'local@storage' : 'No email provided')}</p>
                                                <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${user?.isGuest ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                                        {user?.isGuest ? 'Guest Mode' : 'Authenticated'}
                                                    </span>
                                                    {user?.id && !user.isGuest && <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest">ID: {user.id}</span>}
                                                    {user?.id === 1 && (
                                                        <button
                                                            onClick={() => navigate('/admin', { replace: true })}
                                                            className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors flex items-center gap-1 shadow-sm"
                                                        >
                                                            <ShieldAlert size={10} />
                                                            Admin Portal
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 bg-white rounded-xl border border-slate-100">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Session Type</label>
                                                <span className="text-sm font-bold text-slate-700">{user?.isGuest ? 'Local Storage Persistence' : 'Direct Database Connection'}</span>
                                            </div>
                                            <div className="p-4 bg-white rounded-xl border border-slate-100">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Security Mode</label>
                                                <span className="text-sm font-bold text-slate-700">{user?.isGuest ? 'Open Access' : 'JWT Encrypted Session'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <div className="h-px bg-gray-100 mx-1"></div>

                                <section className="space-y-6">
                                    <div className="flex flex-col gap-1">
                                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Session Control</h3>
                                        <p className="text-xs text-gray-500">Manage your active presence on this device.</p>
                                    </div>

                                    <div className="flex flex-wrap gap-4">
                                        <button
                                            onClick={handleLogout}
                                            className="px-6 py-3 bg-slate-800 text-white rounded-xl text-sm font-black hover:bg-slate-900 transition-all flex items-center gap-3 shadow-lg shadow-slate-200"
                                        >
                                            <RotateCcw size={18} />
                                            Logout from Session
                                        </button>

                                        {!user?.isGuest && (
                                            <button
                                                onClick={handleDeleteAccount}
                                                className="px-6 py-3 bg-white border-2 border-rose-100 text-rose-600 rounded-xl text-sm font-black hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all flex items-center gap-3"
                                            >
                                                <Trash2 size={18} />
                                                Delete Account Permanently
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 leading-relaxed max-w-xl">
                                        Logging out will clear your session token and redirect you to the welcome screen.
                                        Deleting your account is irreversible and will remove your user credentials from the database server.
                                    </p>
                                </section>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Success Toast */}
            {showToast && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300">
                    <div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700">
                        <div className="bg-green-500 rounded-full p-1">
                            <CheckCircle2 size={16} className="text-white" />
                        </div>
                        <span className="text-sm font-bold tracking-wide">Settings saved successfully!</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;
