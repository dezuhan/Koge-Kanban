import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { db } from '../services/db';
import { Trash2, RefreshCcw, ArrowLeft, Loader2, Info, AlertTriangle, Database, Folder, ListChecks, Layout, ChevronDown, ChevronRight, FileText, CheckSquare, Square, CheckCircle2 } from 'lucide-react';

const TrashPage: React.FC = () => {
    const navigate = useNavigate();
    const { confirm: globalConfirm, alert: globalAlert, refreshProjects } = useApp();
    const [trashItems, setTrashItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedBundles, setExpandedBundles] = useState<Record<string, boolean>>({});
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

    const toggleBundle = (key: string) => {
        setExpandedBundles(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const loadTrash = async () => {
        setLoading(true);
        try {
            const items = await db.trash.getItems();
            setTrashItems(items);
            setSelectedKeys(new Set()); // Reset selection on reload
        } catch (err) {
            console.error("Failed to load trash:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTrash();
    }, []);

    // Selection Handlers
    const toggleSelect = (key: string) => {
        setSelectedKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedKeys.size === trashItems.length && trashItems.length > 0) {
            setSelectedKeys(new Set());
        } else {
            setSelectedKeys(new Set(trashItems.map(i => i.key)));
        }
    };

    const handleRestore = async (key: string, options?: { type: 'task' | 'column'; id: string }) => {
        try {
            await db.trash.restore(key, options);

            globalAlert({
                title: 'Restored',
                message: options 
                    ? `${options.type === 'task' ? 'Task' : 'Kanban board'} has been restored successfully.` 
                    : 'Item has been restored successfully.',
                type: 'info'
            });
            await refreshProjects();
            loadTrash();
        } catch (err: any) {
            globalAlert({
                title: 'Error',
                message: err.message || 'Failed to restore item.',
                type: 'danger'
            });
        }
    };

    const handleRestoreBulk = async (keysToRestore?: string[] | 'all') => {
        const targetKeys = keysToRestore === 'all' 
            ? trashItems.map(i => i.key) 
            : (keysToRestore || Array.from(selectedKeys));

        if (targetKeys.length === 0) return;

        globalConfirm({
            title: keysToRestore === 'all' ? 'Restore All Items?' : `Restore ${targetKeys.length} Items?`,
            message: `Are you sure you want to restore these ${targetKeys.length} items to their original locations?`,
            type: 'info',
            confirmText: 'Restore Now',
            onConfirm: async () => {
                try {
                    setLoading(true);
                    const result = await db.trash.restoreBulk(targetKeys) as any;
                    
                    if (result?.success) {
                        const totalFailed = result.results?.errors?.length || 0;
                        const totalSuccess = result.results?.success?.length || 0;

                        if (totalFailed > 0) {
                            globalAlert({
                                title: 'Partial Bulk Restore',
                                message: `${totalSuccess} items restored, but ${totalFailed} failed. Some parents might be missing.`,
                                type: 'amber'
                            });
                            console.warn("Some items failed to restore:", result.results.errors);
                        } else {
                            globalAlert({
                                title: 'Bulk Restore Complete',
                                message: result.message || `${totalSuccess} items have been restored.`,
                                type: 'info'
                            });
                        }
                    }
                    
                    await refreshProjects();
                    loadTrash();
                    setSelectedKeys(new Set());
                } catch (err: any) {
                    console.error("Bulk restore error details:", err);
                    const errorMsg = err.message || (typeof err === 'string' ? err : 'Unknown error');
                    globalAlert({
                        title: 'Bulk Restore Failed',
                        message: `Server reported: ${errorMsg}. Please ensure the server is responding.`,
                        type: 'danger'
                    });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const handleDeletePermanent = (key: string) => {
        globalConfirm({
            title: 'Delete Permanently?',
            message: 'This action cannot be undone. This item will be removed forever.',
            type: 'danger',
            confirmText: 'Delete Permanently',
            onConfirm: async () => {
                try {
                    await db.trash.deletePermanent(key);
                    loadTrash();
                } catch (err) {
                    globalAlert({ title: 'Error', message: 'Failed to delete item.', type: 'danger' });
                }
            }
        });
    };

    const handleEmptyTrash = () => {
        if (trashItems.length === 0) return;
        globalConfirm({
            title: 'Empty Trash?',
            message: 'Are you sure you want to permanently delete ALL items in the trash? This cannot be undone.',
            type: 'danger',
            confirmText: 'Empty All',
            onConfirm: async () => {
                try {
                    await db.trash.emptyTrash();
                    loadTrash();
                } catch (err) {
                    globalAlert({ title: 'Error', message: 'Failed to empty trash.', type: 'danger' });
                }
            }
        });
    };

    const getItemName = (item: any) => {
        const key = item.key;
        if (key === 'kanban_projects') return "Board List Index";
        if (key.startsWith('tasks_')) return `Tasks for Project: ${key.replace('tasks_', '')}`;
        if (key.startsWith('columns_')) return `Columns for Project: ${key.replace('columns_', '')}`;
        if (key.startsWith('task:')) return `Task: ${item.value.title || 'Untitled'}`;
        if (key.startsWith('project_info_')) return `Project Info: ${item.value.name || 'Untitled'}`;
        if (key.startsWith('board_bundle_')) return `Project Board: ${item.value.project?.name || 'Untitled'}`;
        if (key.startsWith('column_bundle_')) return `Kanban Board: ${item.value.column?.title || 'Untitled'}`;
        if (key === 'kanban_settings') return "Global Settings";
        if (key === 'ai_settings') return "AI Configuration";
        return key;
    };

    const getItemIcon = (key: string) => {
        if (key.startsWith('board_bundle_')) return <Layout size={18} className="text-indigo-600" />;
        if (key.startsWith('column_bundle_')) return <Folder size={18} className="text-blue-500" />;
        if (key === 'kanban_projects' || key.startsWith('project_info_')) return <Database size={18} className="text-blue-500" />;
        if (key.startsWith('tasks_') || key.startsWith('task:')) return <ListChecks size={18} className="text-amber-500" />;
        if (key.startsWith('columns_')) return <Folder size={18} className="text-indigo-500" />;
        return <Info size={18} className="text-slate-400" />;
    };

    return (
        <div className="trash-page max-w-5xl w-full mx-auto p-4 md:p-8 min-h-screen flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-all shrink-0"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
                            Trash Bin
                        </h1>
                        <p className="text-slate-500 text-xs md:text-sm mt-1 leading-relaxed">
                            Items here will be automatically deleted based on your settings.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    {trashItems.length > 0 && (
                        <>
                            <button
                                onClick={() => handleRestoreBulk('all')}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-600 hover:text-white transition-all font-bold text-xs md:text-sm whitespace-nowrap"
                            >
                                <CheckCircle2 size={16} />
                                <span className="hidden sm:inline">Restore All</span>
                                <span className="sm:hidden">All</span>
                            </button>
                            {selectedKeys.size > 0 && (
                                <button
                                    onClick={() => handleRestoreBulk()}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white transition-all font-bold text-xs md:text-sm animate-in fade-in slide-in-from-right-2 whitespace-nowrap"
                                >
                                    <RefreshCcw size={16} />
                                    Selected ({selectedKeys.size})
                                </button>
                            )}
                            <button
                                onClick={handleEmptyTrash}
                                className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-600 hover:text-white transition-all font-bold text-xs md:text-sm whitespace-nowrap"
                            >
                                <Trash2 size={16} />
                                <span className="hidden sm:inline">Empty Trash</span>
                                <span className="sm:hidden">Empty</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20">
                        <Loader2 size={48} className="animate-spin text-blue-600 mb-4" />
                        <p className="text-slate-500 font-medium">Scanning trash storage...</p>
                    </div>
                ) : trashItems.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-32 text-slate-400">
                        <div className="bg-slate-50 p-6 rounded-full mb-6">
                            <Trash2 size={64} className="opacity-10" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-600">Your trash is empty</h3>
                        <p className="text-sm mt-2 max-w-xs text-center leading-relaxed">Deletes are safer now! Any tasks or boards you remove will appear here temporarily.</p>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {/* Table Header (Desktop only) */}
                        <div className="hidden md:flex items-center bg-slate-50/80 border-b border-slate-100 py-4 font-black text-[10px] uppercase tracking-widest text-slate-400">
                            <div className="pl-6 w-14 shrink-0">
                                <button 
                                    onClick={toggleSelectAll}
                                    className="text-slate-400 hover:text-blue-500 transition-colors"
                                >
                                    {selectedKeys.size === trashItems.length && trashItems.length > 0 ? (
                                        <CheckSquare size={18} className="text-blue-500" />
                                    ) : (
                                        <Square size={18} />
                                    )}
                                </button>
                            </div>
                            <div className="px-6 flex-1">Resource Name</div>
                            <div className="px-6 w-48 text-left">Deleted Date</div>
                            <div className="px-6 w-32 text-right">Actions</div>
                        </div>

                        <div className="divide-y divide-slate-50">
                            {trashItems.map((item) => {
                                const isBundle = item.key.startsWith('board_bundle_') || item.key.startsWith('column_bundle_');
                                const isExpanded = expandedBundles[item.key];
                                const isSelected = selectedKeys.has(item.key);

                                return (
                                    <React.Fragment key={item.key}>
                                        <div className={`flex flex-col md:flex-row md:items-center hover:bg-slate-50/50 transition-colors group p-4 md:p-0 ${isSelected ? 'bg-blue-50/30' : ''}`}>
                                            {/* Row Body */}
                                            <div className="flex items-center flex-1">
                                                {/* Checkbox */}
                                                <div className="md:pl-6 md:w-14 items-center flex shrink-0">
                                                    <button 
                                                        onClick={() => toggleSelect(item.key)}
                                                        className={`transition-colors p-2 -ml-2 md:ml-0 ${isSelected ? 'text-blue-500' : 'text-slate-300 group-hover:text-slate-400'}`}
                                                    >
                                                        {isSelected ? <CheckSquare size={20} className="md:size-[18px]" /> : <Square size={20} className="md:size-[18px]" />}
                                                    </button>
                                                </div>

                                                {/* Content */}
                                                <div className="flex flex-1 items-center gap-3 overflow-hidden ml-2 md:ml-0 md:px-6 md:py-5">
                                                    {isBundle && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleBundle(item.key); }}
                                                            className="p-1.5 hover:bg-slate-100 rounded text-slate-400 shrink-0"
                                                        >
                                                            {isExpanded ? <ChevronDown size={18} className="md:size-4" /> : <ChevronRight size={18} className="md:size-4" />}
                                                        </button>
                                                    )}
                                                    <div className="p-2 bg-white border border-slate-100 rounded-lg shadow-sm shrink-0">
                                                        {getItemIcon(item.key)}
                                                    </div>
                                                    <div className="flex flex-col min-w-0 pr-4">
                                                        <span className="font-bold text-slate-700 truncate text-sm md:text-base">{getItemName(item)}</span>
                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                                                            <code className="text-[9px] md:text-[10px] text-slate-400 font-mono">
                                                                {item.key}
                                                            </code>
                                                            <span className="md:hidden text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                                                                {new Date(item.deletedAt).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Desktop Date Column */}
                                            <div className="hidden md:block w-48 px-6 py-5 text-sm text-slate-500 font-medium whitespace-nowrap">
                                                {new Date(item.deletedAt).toLocaleString()}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center justify-between md:justify-end gap-3 mt-4 md:mt-0 px-4 md:px-6 md:py-5 md:w-32">
                                                {/* Mobile Date - only if needed or just use the badge above */}
                                                <div className="md:hidden"></div> 

                                                <div className="flex items-center gap-2 w-full md:w-auto">
                                                    <button
                                                        onClick={() => handleRestore(item.key)}
                                                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-3 py-2 md:py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all text-xs font-bold"
                                                    >
                                                        <RefreshCcw size={14} />
                                                        Restore
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeletePermanent(item.key)}
                                                        className="p-2 md:p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all border border-slate-100 md:border-0"
                                                    >
                                                        <Trash2 size={18} className="md:size-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Bundle Content */}
                                        {isBundle && isExpanded && (
                                            <div className="bg-slate-50/30 border-b border-slate-100">
                                                <div className="px-6 md:px-16 py-6">
                                                    <div className="border-l-2 border-slate-200 pl-4 md:pl-6 space-y-6">
                                                            {/* Render Board Bundle Internal Content */}
                                                            {item.key.startsWith('board_bundle_') && (
                                                                <div className="space-y-6">
                                                                    {item.value.columns?.map((col: any) => (
                                                                        <div key={col.id} className="space-y-3">
                                                                            <div className="flex items-center justify-between group/col">
                                                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                                                    <Folder size={14} className="text-blue-400" />
                                                                                    {col.title}
                                                                                </div>
                                                                                <button 
                                                                                    onClick={() => handleRestore(item.key, { type: 'column', id: col.id })}
                                                                                    className="text-[10px] font-bold text-blue-500 hover:text-blue-700 opacity-0 group-hover/col:opacity-100 transition-opacity flex items-center gap-1"
                                                                                >
                                                                                    <RefreshCcw size={10} />
                                                                                    Restore Column
                                                                                </button>
                                                                            </div>
                                                                            <div className="flex flex-col gap-2 pl-4">
                                                                                {item.value.tasks?.filter((t: any) => t.status === col.id).map((task: any) => (
                                                                                    <div key={task.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group/task">
                                                                                        <div className="flex items-start gap-3 min-w-0">
                                                                                            <div className="p-1.5 bg-amber-50 rounded-lg shrink-0">
                                                                                                <FileText size={14} className="text-amber-500" />
                                                                                            </div>
                                                                                            <div className="flex flex-col min-w-0">
                                                                                                <span className="text-[11px] font-bold text-slate-700 truncate">{task.title}</span>
                                                                                                <span className="text-[9px] text-slate-400 font-medium truncate">ID: {task.id}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                        <button 
                                                                                            onClick={() => handleRestore(item.key, { type: 'task', id: task.id })}
                                                                                            className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg opacity-0 group-hover/task:opacity-100 transition-opacity"
                                                                                            title="Restore this task"
                                                                                        >
                                                                                            <RefreshCcw size={14} />
                                                                                        </button>
                                                                                    </div>
                                                                                ))}
                                                                                {item.value.tasks?.filter((t: any) => t.status === col.id).length === 0 && (
                                                                                    <span className="text-[10px] text-slate-400 italic">No tasks in this column</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}

                                                                    {/* Uncategorized Tasks in Board */}
                                                                    {item.value.tasks?.filter((t: any) => !item.value.columns?.some((c: any) => c.id === t.status)).length > 0 && (
                                                                        <div className="space-y-3">
                                                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                                                <AlertTriangle size={14} className="text-amber-400" />
                                                                                Other Tasks
                                                                            </div>
                                                                            <div className="flex flex-col gap-2 pl-4">
                                                                                {item.value.tasks?.filter((t: any) => !item.value.columns?.some((c: any) => c.id === t.status)).map((task: any) => (
                                                                                    <div key={task.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group/task">
                                                                                        <div className="flex items-start gap-3 min-w-0">
                                                                                            <div className="p-1.5 bg-amber-50 rounded-lg shrink-0">
                                                                                                <FileText size={14} className="text-amber-500" />
                                                                                            </div>
                                                                                            <div className="flex flex-col min-w-0">
                                                                                                <span className="text-[11px] font-bold text-slate-700 truncate">{task.title}</span>
                                                                                                <span className="text-[9px] text-slate-400 font-medium truncate">ID: {task.id}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                        <button 
                                                                                            onClick={() => handleRestore(item.key, { type: 'task', id: task.id })}
                                                                                            className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg opacity-0 group-hover/task:opacity-100 transition-opacity"
                                                                                        >
                                                                                            <RefreshCcw size={14} />
                                                                                        </button>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Render Column Bundle */}
                                                            {item.key.startsWith('column_bundle_') && (
                                                                <div className="flex flex-col gap-2">
                                                                    {item.value.tasks?.map((task: any) => (
                                                                        <div key={task.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group/task">
                                                                            <div className="flex items-start gap-3 min-w-0">
                                                                                <div className="p-1.5 bg-amber-50 rounded-lg shrink-0">
                                                                                    <FileText size={14} className="text-amber-500" />
                                                                                </div>
                                                                                <div className="flex flex-col min-w-0">
                                                                                    <span className="text-[11px] font-bold text-slate-700 truncate">{task.title}</span>
                                                                                    <span className="text-[9px] text-slate-400 font-medium truncate">ID: {task.id}</span>
                                                                                </div>
                                                                            </div>
                                                                            <button 
                                                                                onClick={() => handleRestore(item.key, { type: 'task', id: task.id })}
                                                                                className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg opacity-0 group-hover/task:opacity-100 transition-opacity"
                                                                            >
                                                                                <RefreshCcw size={14} />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                    {item.value.tasks?.length === 0 && (
                                                                        <span className="text-[10px] text-slate-400 italic">No tasks in this column</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

            <div className="mt-8 flex items-start gap-4 p-5 bg-amber-50 rounded-2xl border border-amber-100">
                <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                <div>
                    <h4 className="text-sm font-bold text-amber-800">Security Warning</h4>
                    <p className="text-[12px] text-amber-700/80 leading-relaxed mt-1">
                        Restoring a board may require page refresh to see updated lists. Trashed items do not count towards active task statistics but contribute to database file size.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TrashPage;
