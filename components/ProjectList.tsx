import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Project, Task, Priority } from '../types';
import { Folder, Plus, ArrowRight, Trash2, Calendar, Layout, Edit2, Github, Linkedin, Instagram, Coffee, AlertCircle, Clock, Zap, Target, List, Grid, User, ChevronDown, ChevronUp, Filter, Wand2, ToggleLeft, ToggleRight, Loader2, Settings, MessageSquare, Sparkles, Search } from 'lucide-react';
import { db } from '../services/db';
import { useNavigate } from 'react-router-dom';
import { SearchableSelect } from './SearchableSelect';

interface ProjectListProps {
    /** List of all available projects */
    projects: Project[] | null;
    /** Handler when a project or a specific task in a project is selected */
    onSelectProject: (project: Project, taskId?: string) => void;
    /** Handler for adding a new project */
    onAddProject: () => void;
    /** Handler for editing a project */
    onEditProject: (project: Project) => void;
    /** Handler for deleting a project */
    onDeleteProject: (id: string) => void;
}

/**
 * ProjectList Component
 * Displays the main dashboard including:
 * 1. "Recent Tasks" section (Global tasks from all projects)
 * 2. "My Boards" section (Grid of projects)
 */
const ProjectList: React.FC<ProjectListProps> = ({ projects, onSelectProject, onAddProject, onEditProject, onDeleteProject }) => {
    const navigate = useNavigate();
    const { isAIEnabled, toggleAI, isChatOpen, setIsChatOpen, setCurrentContext, prioritySettings, setPrioritySettings, alert: globalAlert, setIsSearchOpen, aiModels, isOllamaOnline, apiBaseUrl } = useApp();
    const [globalTasks, setGlobalTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(true);
    const [isTogglingAI, setIsTogglingAI] = useState(false);

    const [dashboardFilter, setDashboardFilter] = useState<'dueDate' | 'priority'>('dueDate');
    const [dashboardView, setDashboardView] = useState<'grid' | 'list'>('grid');
    const [isRecentTasksCollapsed, setIsRecentTasksCollapsed] = useState(false);

    // Clear AI context when on Dashboard
    useEffect(() => {
        setCurrentContext(null);
    }, [setCurrentContext]);

    useEffect(() => {
        /**
         * Fetches all tasks from all projects to display in the "Recent Tasks" section.
         * Hits the backend endpoint /api/tasks/global.
         */
        const fetchGlobalTasks = async () => {
            try {
                const tasks = await db.getAllGlobalTasks();
                setGlobalTasks(prev => {
                    if (JSON.stringify(prev) === JSON.stringify(tasks)) return prev;
                    return tasks || [];
                });
            } catch (err) {
                console.error("Failed to load global tasks", err);
            } finally {
                setLoadingTasks(false);
            }
        };

        fetchGlobalTasks();
        const intervalId = setInterval(fetchGlobalTasks, 5000);
        return () => clearInterval(intervalId);
    }, []);

    const sortedDashboardTasks = useMemo(() => {
        let tasks = globalTasks.filter(t => !t.isCompleted && t.status !== 'Complete');

        if (dashboardFilter === 'dueDate') {
            tasks.sort((a, b) => {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return a.dueDate - b.dueDate;
            });
        } else {
            const pMap = { [Priority.HIGH]: 3, [Priority.MEDIUM]: 2, [Priority.LOW]: 1 };
            tasks.sort((a, b) => pMap[b.priority] - pMap[a.priority]);
        }

        return tasks.slice(0, 8);
    }, [globalTasks, dashboardFilter]);

    const getPriorityColor = (priority: Priority) => {
        switch (priority) {
            case Priority.HIGH: return 'text-red-600 bg-red-50 border-red-100';
            case Priority.MEDIUM: return 'text-amber-600 bg-amber-50 border-amber-100';
            default: return 'text-blue-600 bg-blue-50 border-blue-100';
        }
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const getColorStyles = (color: string = 'blue') => {
        const colors: Record<string, any> = {
            blue: { iconBg: 'bg-blue-50', iconText: 'text-blue-600', borderHover: 'hover:border-blue-300', groupHoverBg: 'group-hover:bg-blue-600' },
            red: { iconBg: 'bg-red-50', iconText: 'text-red-600', borderHover: 'hover:border-red-300', groupHoverBg: 'group-hover:bg-red-600' },
            green: { iconBg: 'bg-green-50', iconText: 'text-green-600', borderHover: 'hover:border-green-300', groupHoverBg: 'group-hover:bg-green-600' },
            amber: { iconBg: 'bg-amber-50', iconText: 'text-amber-600', borderHover: 'hover:border-amber-300', groupHoverBg: 'group-hover:bg-amber-600' },
            purple: { iconBg: 'bg-purple-50', iconText: 'text-purple-600', borderHover: 'hover:border-purple-300', groupHoverBg: 'group-hover:bg-purple-600' },
            pink: { iconBg: 'bg-pink-50', iconText: 'text-pink-600', borderHover: 'hover:border-pink-300', groupHoverBg: 'group-hover:bg-pink-600' },
            indigo: { iconBg: 'bg-indigo-50', iconText: 'text-indigo-600', borderHover: 'hover:border-indigo-300', groupHoverBg: 'group-hover:bg-indigo-600' },
            cyan: { iconBg: 'bg-cyan-50', iconText: 'text-cyan-600', borderHover: 'hover:border-cyan-300', groupHoverBg: 'group-hover:bg-cyan-600' },
            teal: { iconBg: 'bg-teal-50', iconText: 'text-teal-600', borderHover: 'hover:border-teal-300', groupHoverBg: 'group-hover:bg-teal-600' },
            orange: { iconBg: 'bg-orange-50', iconText: 'text-orange-600', borderHover: 'hover:border-orange-300', groupHoverBg: 'group-hover:bg-orange-600' },
            dark: { iconBg: 'bg-slate-100', iconText: 'text-slate-800', borderHover: 'hover:border-slate-400', groupHoverBg: 'group-hover:bg-slate-800' },
        };
        return colors[color] || colors.blue;
    };

    const handleTaskClick = (task: Task) => {
        if (!projects) return;
        let proj = (task as any)._projectId
            ? projects.find(p => p.id === (task as any)._projectId)
            : undefined;

        if (!proj) {
            proj = projects.find(p => p.id === task.project);
        }

        if (!proj) {
            proj = projects.find(p => p.name === task.project);
        }

        if (!proj) {
            const normalize = (s: string) => s.replace(/[^\w\s]/gi, '').trim().toLowerCase();
            const taskProjNorm = normalize(task.project);
            proj = projects.find(p => normalize(p.name) === taskProjNorm) ||
                projects.find(p => p.name.includes(task.project) || task.project.includes(p.name));
        }

        if (proj) {
            onSelectProject(proj, task.id);
        } else {
            globalAlert({
                title: 'Project Not Found',
                message: `Could not find project "${task.project}" for this task.`,
                type: 'danger'
            });
        }
    };

    return (
        <div className="project-list-view max-w-6xl w-full mx-auto p-4 md:p-8 min-h-screen flex flex-col">
            {/* Top Header */}
            <div className="project-list-header flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
                <div className="w-full md:w-auto flex-1 flex items-center justify-between">
                    <div className="flex flex-col">
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-3">
                            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
                                <Layout size={24} className="md:w-7 md:h-7" />
                            </div>
                            My Projects
                        </h1>
                        <p className="text-gray-500 mt-1 text-sm md:text-base">Manage your kanban boards and workspaces.</p>
                    </div>

                    {/* Desktop Search Bar (Memenuhi Halaman) */}
                    <div
                        onClick={() => setIsSearchOpen(true)}
                        className="hidden lg:flex items-center flex-1 mx-12 bg-white border border-gray-200 rounded-xl px-4 h-12 cursor-pointer hover:border-blue-300 transition-all group shadow-sm"
                    >
                        <Search size={20} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                        <span className="ml-3 text-sm text-gray-400 font-medium">Search     ...</span>
                        <div className="ml-auto flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                            <kbd className="bg-gray-50 border border-gray-200 px-2 py-1 rounded text-[10px] font-mono text-gray-500 shadow-sm font-bold">Ctrl</kbd>
                            <kbd className="bg-gray-50 border border-gray-200 px-2 py-1 rounded text-[10px] font-mono text-gray-500 shadow-sm font-bold">K</kbd>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* AI & Settings Row (Matched with BoardPage) */}
                    <button
                        onClick={async () => {
                            setIsTogglingAI(true);
                            await toggleAI();
                            setIsTogglingAI(false);
                        }}
                        className={`flex items-center gap-2 px-4 h-10 rounded-lg transition-all font-bold text-sm shrink-0 border ${isAIEnabled
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                            : !isOllamaOnline
                                ? 'bg-gray-50 text-gray-400 border-gray-200 grayscale opacity-70'
                                : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                            }`}
                        disabled={isTogglingAI}
                        title={!isOllamaOnline ? "Ollama is Offline (ollama serve)" : isAIEnabled ? "Disable AI Engine" : "Enable AI Engine"}
                    >
                        {isTogglingAI ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : !isOllamaOnline ? (
                            <div className="relative">
                                <Sparkles size={16} />
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border border-white" />
                            </div>
                        ) : (
                            <Sparkles size={16} />
                        )}
                        <span>AI</span>
                        {isAIEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    </button>

                    <button
                        onClick={() => navigate('/trash')}
                        className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-rose-600 bg-white border border-gray-200 hover:border-rose-100 hover:bg-rose-50/30 rounded-lg transition-all shrink-0"
                        title="Trash Bin"
                    >
                        <Trash2 size={20} />
                    </button>

                    <button
                        onClick={() => navigate('/settings')}
                        className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-blue-600 bg-white border border-gray-200 hover:border-blue-100 hover:bg-blue-50/30 rounded-lg transition-all shrink-0"
                        title="Application Settings"
                    >
                        <Settings size={20} />
                    </button>

                    <button
                        onClick={() => isAIEnabled && setIsChatOpen(!isChatOpen)}
                        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all border shrink-0 ${!isAIEnabled
                            ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed opacity-50'
                            : isChatOpen
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                                : 'bg-white text-gray-500 hover:text-blue-600 border-gray-200 hover:border-blue-100 hover:bg-blue-50/30'
                            }`}
                        title={isAIEnabled ? "AI Chatbot" : "Enable AI to use Chat"}
                        disabled={!isAIEnabled}
                    >
                        <MessageSquare size={20} />
                    </button>

                    <button
                        onClick={onAddProject}
                        className="btn-new-project bg-blue-600 text-white h-10 px-6 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 shadow-md shadow-blue-500/20 hover:shadow-xl font-bold text-sm md:text-base flex-1 md:flex-none justify-center"
                    >
                        <Plus size={18} className="md:w-5 md:h-5" />
                        <span className="whitespace-nowrap">New Project</span>
                    </button>
                </div>
            </div>

            {/* RECENT TASKS DASHBOARD (Based on Sketch) */}
            <div className="dashboard-container mb-12 bg-white rounded-2xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="dashboard-header p-4 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50">
                    <div className="flex items-center gap-2 overflow-hidden w-full sm:w-auto">
                        <div className="bg-blue-100 text-blue-600 p-1.5 rounded-xl shrink-0">
                            <Clock size={20} />
                        </div>
                        <h2 className="font-bold text-gray-800 text-lg truncate">Recent Tasks</h2>
                    </div>

                    <div className="dashboard-controls flex flex-wrap items-center gap-2 sm:gap-3 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                        {/* Filter Dropdown */}
                        <div className="w-40">
                            <SearchableSelect
                                value={dashboardFilter === 'dueDate' ? 'By Date' : 'By Priority'}
                                onChange={(val) => setDashboardFilter(val === 'By Date' ? 'dueDate' : 'priority')}
                                options={['By Date', 'By Priority']}
                                placeholder="Sort by..."
                                icon={<Filter size={14} className="text-gray-400" />}
                            />
                        </div>

                        {/* View Mode Switcher */}
                        <div className="flex bg-gray-100 p-1 rounded-lg shrink-0 h-10 items-center">
                            <button
                                onClick={() => setDashboardView('grid')}
                                className={`h-full px-2.5 rounded-md transition-all flex items-center justify-center ${dashboardView === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                title="Board View"
                            >
                                <Grid size={16} />
                            </button>
                            <button
                                onClick={() => setDashboardView('list')}
                                className={`h-full px-2.5 rounded-md transition-all flex items-center justify-center ${dashboardView === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                title="List View"
                            >
                                <List size={16} />
                            </button>
                        </div>

                        <div className="w-px h-6 bg-gray-200 hidden sm:block"></div>

                        {/* Collapse Toggle */}
                        <button
                            onClick={() => setIsRecentTasksCollapsed(!isRecentTasksCollapsed)}
                            className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all shrink-0"
                            title={isRecentTasksCollapsed ? "Expand" : "Collapse"}
                        >
                            {isRecentTasksCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                        </button>
                    </div>
                </div>

                {!isRecentTasksCollapsed && (
                    <div className="dashboard-content p-6">
                        {loadingTasks ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        ) : sortedDashboardTasks.length > 0 ? (
                            dashboardView === 'grid' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                                    {sortedDashboardTasks.map(task => (
                                        <div
                                            key={task.id}
                                            onClick={() => handleTaskClick(task)}
                                            className="group bg-white p-5 rounded-lg border border-gray-100 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer flex flex-col h-full"
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1">
                                                    <Folder size={10} /> {task.project}
                                                </span>
                                                <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                                    {task.status}
                                                </div>
                                            </div>

                                            <h3 className="text-sm font-bold text-gray-800 mb-4 flex-1 line-clamp-2 group-hover:text-blue-600 transition-colors">
                                                {task.title}
                                            </h3>

                                            <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    {task.assignee ? (
                                                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold border border-blue-200" title={task.assignee}>
                                                            {getInitials(task.assignee)}
                                                        </div>
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center border border-gray-200">
                                                            <User size={10} />
                                                        </div>
                                                    )}
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getPriorityColor(task.priority)}`}>
                                                        {task.priority}
                                                    </span>
                                                </div>

                                                {task.dueDate && (
                                                    <div className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                                        <Calendar size={10} />
                                                        {new Date(task.dueDate).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {sortedDashboardTasks.map(task => (
                                        <div
                                            key={task.id}
                                            onClick={() => handleTaskClick(task)}
                                            className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg hover:shadow-md hover:border-blue-100 transition-all cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className={`w-2 self-stretch rounded-full ${task.priority === Priority.HIGH ? 'bg-red-400' : task.priority === Priority.MEDIUM ? 'bg-amber-400' : 'bg-blue-400'}`}></div>
                                                <div className="min-w-0 py-1">
                                                    <h3 className="font-bold text-gray-800 text-sm group-hover:text-blue-600 transition-colors">{task.title}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 flex items-center gap-1">
                                                            <Folder size={10} /> {task.project}
                                                        </span>
                                                        <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{task.status}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6 ml-4">
                                                {task.dueDate && (
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                                                        <Calendar size={14} />
                                                        {new Date(task.dueDate).toLocaleDateString()}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 w-24 justify-end">
                                                    {task.assignee && (
                                                        <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold border border-blue-100">
                                                            {getInitials(task.assignee)}
                                                        </div>
                                                    )}
                                                    <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                <Target size={48} className="mb-4 opacity-20" />
                                <p className="font-medium">
                                    {globalTasks.length === 0 ? "No tasks found in database." : "No pending tasks to display."}
                                </p>
                                <p className="text-xs mt-2 text-gray-300">Total Tasks: {globalTasks.length}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* BOARDS / PROJECTS SECTION */}
            <div className="flex-1">
                <div className="section-title flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-gray-800">My Boards</h2>
                        <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full font-bold">{projects?.length || 0}</span>
                    </div>
                </div>

                {(!projects || projects.length === 0) ? (
                    <div className="project-list-empty text-center py-24 bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-200">
                        <Folder size={64} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-xl font-bold text-gray-500">No Projects Found</h3>
                        <p className="text-gray-400 mb-8 max-w-xs mx-auto">Create a new project to start organizing your tasks locally and privately.</p>
                        <button
                            onClick={onAddProject}
                            className="btn-create-now text-blue-600 font-bold hover:text-blue-800 transition-colors"
                        >
                            + Create your first project
                        </button>
                    </div>
                ) : (
                    <div className="project-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects?.map(project => {
                            const styles = getColorStyles(project.color);
                            return (
                                <div
                                    key={project.id}
                                    className={`project-card group bg-white rounded-2xl shadow-sm border border-gray-200 ${styles.borderHover} hover:shadow-xl transition-all cursor-pointer flex flex-col h-[15rem] relative overflow-hidden`}
                                    onClick={() => onSelectProject(project)}
                                >
                                    <div className="project-card-body p-6 flex-1">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className={`p-3 ${styles.iconBg} ${styles.iconText} rounded-lg ${styles.groupHoverBg} group-hover:text-white transition-all duration-300 shadow-sm`}>
                                                <Folder size={24} />
                                            </div>
                                            <div className="project-actions flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onEditProject(project); }}
                                                    className={`btn-edit-project p-2 text-gray-400 hover:${styles.iconText} hover:${styles.iconBg} rounded-lg transition`}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                                                    className="btn-delete-project p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <h3 className="project-name font-bold text-gray-800 text-xl mb-1 truncate">{project.name}</h3>
                                        <p className="project-desc text-sm text-gray-500 line-clamp-2">{project.description || "Manage your local tasks securely."}</p>
                                    </div>

                                    <div className="project-card-footer px-6 py-4 border-t border-gray-50 flex justify-between items-center bg-gray-50/30">
                                        <div className="project-date flex items-center gap-1.5 text-xs text-gray-400 font-bold">
                                            <Calendar size={12} />
                                            <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className={`flex items-center gap-1 text-xs font-bold ${styles.iconText} group-hover:translate-x-1 transition-transform`}>
                                            Open Board <ArrowRight size={14} />
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* FOOTER */}
            <footer className="mt-20 pt-10 border-t border-gray-100">
                <div className="flex flex-col items-center gap-6 text-gray-400">
                    <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 px-4">
                        <div className="flex items-center gap-6">
                            <a href="https://instagram.com/dezuhan" target="_blank" className="hover:text-pink-600 transition-all transform hover:scale-125"><Instagram size={22} /></a>
                            <a href="https://github.com/dezuhan" target="_blank" className="hover:text-gray-900 transition-all transform hover:scale-125"><Github size={22} /></a>
                            <a href="https://linkedin.com/in/dzuhan" target="_blank" className="hover:text-blue-700 transition-all transform hover:scale-125"><Linkedin size={22} /></a>
                            <a href="https://vgen.co/dezuhan" target="_blank" className="opacity-35 hover:opacity-100 transition-all transform hover:scale-125"><img src="https://help.vgen.co/hc/article_attachments/13004249258519" alt="VGen" width={28} height={28} /></a>
                        </div>

                        <div className="hidden sm:block w-px h-6 bg-gray-200 mx-1"></div>

                        <a href="https://buymeacoffee.com/dezuhan" target="_blank" className="flex items-center gap-2 bg-[#FF5E5B] text-white px-5 py-2 rounded-full hover:bg-[#ff4642] transition-all shadow-md hover:shadow-xl font-bold text-sm transform hover:-translate-y-1">
                            <Coffee size={18} fill="currentColor" />
                            <span>Buy Me a Coffee</span>
                        </a>

                        <div className="hidden sm:block w-px h-6 bg-gray-200 mx-1"></div>

                        {/* Status Badges */}
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100 shadow-sm transition-all hover:shadow-md">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-tight">
                                    {(() => {
                                        // 1. If user has set a custom URL in LocalStorage
                                        const customUrl = localStorage.getItem('koge_api_base_url');
                                        if (customUrl) {
                                            try {
                                                const url = new URL(customUrl.startsWith('http') ? customUrl : `http://${customUrl}`);
                                                const host = url.hostname;
                                                if (host === 'localhost' || host === '127.0.0.1') return "DB: LOCAL STORAGE";
                                                return `DB: ${host.toUpperCase()}`;
                                            } catch {
                                                return "Save: LOCAL STORAGE (NOT SYNC)";
                                            }
                                        }

                                        // 2. If running on local machine
                                        const hostname = window.location.hostname;
                                        if (hostname === 'localhost' || hostname === '127.0.0.1') return "Sync: LOCALHOST";

                                        // 3. If running on a public domain
                                        return `Sync: ${hostname.toUpperCase()}`;
                                    })()}
                                </span>
                            </div>

                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${aiModels.length > 0 ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${aiModels.length > 0 ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse' : 'bg-rose-500'}`} />
                                <span className={`text-[10px] font-black uppercase tracking-tight ${aiModels.length > 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                    AI {aiModels.length > 0 ? 'ON' : 'OFF'}
                                </span>
                            </div>
                        </div>
                    </div>


                    <div className="text-center flex gap-3 justify-center pb-5">
                        <p className="text-[10px] m-auto">© {new Date().getFullYear()} Made with Love by <span className="font-bold text-gray-600">Dezuhan</span></p>
                        <div className="flex items-center gap-3">
                            <a href="https://github.com/dezuhan/koge-kanban" target="_blank" className="hover:opacity-80 transition-opacity">
                                <img src="https://img.shields.io/github/stars/dezuhan/koge-kanban?style=social" alt="GitHub stars" />
                            </a>
                            <a href="https://github.com/dezuhan/koge-kanban/fork" target="_blank" className="hover:opacity-80 transition-opacity">
                                <img src="https://img.shields.io/github/forks/dezuhan/koge-kanban?style=social" alt="GitHub forks" />
                            </a>
                            <a href="https://github.com/dezuhan/koge-kanban" target="_blank" className="hover:opacity-80 transition-opacity">
                                <img src="https://img.shields.io/badge/license-MIT-silver?style=social" alt="GitHub stars" />
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default ProjectList;