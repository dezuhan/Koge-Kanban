import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Trash2, RefreshCcw, ArrowLeft, Archive, Search, Filter, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

/**
 * TrashPage Component
 * Provides a UI for managing recently deleted items (projects, columns, and tasks).
 * Users can restore items or permanently delete them.
 */
const TrashPage: React.FC = () => {
    const navigate = useNavigate();
    const { alert: globalAlert, confirm: globalConfirm } = useApp();
    const [trashItems, setTrashItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    /**
     * Fetches all items currently in the trash bin from the backend.
     */
    const loadTrash = async () => {
        setLoading(true);
        try {
            const items = await db.trash.getItems();
            setTrashItems(items || []);
        } catch (err) {
            console.error("Failed to load trash", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTrash();
    }, []);

    /**
     * Restoration handler for trash items.
     * @param key - The unique identifier of the trash item.
     * @param item - The full trash item object.
     */
    const handleRestore = async (key: string, item: any) => {
        try {
            await db.trash.restore(key);
            globalAlert({
                title: 'Restored',
                message: 'Item has been successfully restored.',
                type: 'info'
            });
            loadTrash();
        } catch (err) {
            console.error("Restore failed", err);
            globalAlert({
                title: 'Error',
                message: 'Failed to restore item.',
                type: 'danger'
            });
        }
    };

    /**
     * Permanent deletion handler for individual trash items.
     * @param key - The unique identifier of the trash item.
     */
    const handleDeletePermanent = (key: string) => {
        globalConfirm({
            title: 'Delete Permanently?',
            message: 'This action cannot be undone. The item will be lost forever.',
            type: 'danger',
            confirmText: 'Delete Permanently',
            onConfirm: async () => {
                try {
                    await db.trash.deletePermanent(key);
                    loadTrash();
                } catch (err) {
                    console.error("Delete failed", err);
                }
            }
        });
    };

    /**
     * Handler for wiping all items from the trash bin.
     */
    const handleEmptyTrash = () => {
        if (trashItems.length === 0) return;
        globalConfirm({
            title: 'Empty Trash Bin?',
            message: 'Are you sure you want to permanently delete ALL items in the trash? This cannot be undone.',
            type: 'danger',
            confirmText: 'Empty Trash',
            onConfirm: async () => {
                try {
                    await db.trash.emptyTrash();
                    loadTrash();
                } catch (err) {
                    console.error("Empty trash failed", err);
                }
            }
        });
    };

    const filteredItems = trashItems.filter(item => {
        const title = item.value?.title || item.value?.project?.name || item.value?.column?.title || item.key;
        return title.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const getItemIcon = (key: string) => {
        if (key.startsWith('board_bundle_')) return <Archive className="text-indigo-500" size={20} />;
        if (key.startsWith('column_bundle_')) return <Filter className="text-blue-500" size={20} />;
        return <Trash2 className="text-rose-500" size={20} />;
    };

    const getItemType = (key: string) => {
        if (key.startsWith('board_bundle_')) return 'Project Bundle';
        if (key.startsWith('column_bundle_')) return 'Column Bundle';
        if (key.startsWith('task:')) return 'Task';
        return 'Item';
    };

    const getItemName = (item: any) => {
        if (item.value?.project?.name) return item.value.project.name;
        if (item.value?.column?.title) return item.value.column.title;
        if (item.value?.title) return item.value.title;
        return item.key;
    };

    return (
        <div className="flex-1 p-6 md:p-10 bg-slate-50 overflow-y-auto min-h-screen">
            <div className="max-w-6xl mx-auto">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 transition shadow-sm"
                                title="Back"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-3">
                                <div className="bg-rose-600 p-2 rounded-xl text-white shadow-lg shadow-rose-200">
                                    <Trash2 size={24} className="md:w-7 md:h-7" />
                                </div>
                                Trash Bin
                            </h1>
                        </div>
                        <p className="text-gray-500 mt-2 text-sm md:text-base ml-12 font-medium opacity-80">
                            Recently deleted items are saved here. You can restore them or wipe them forever.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={handleEmptyTrash}
                            disabled={trashItems.length === 0}
                            className="flex-1 md:flex-none h-11 px-6 bg-white border-2 border-rose-200 text-rose-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-50 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Trash2 size={16} />
                            Empty Trash
                        </button>
                    </div>
                </div>

                {/* Filter & Stats Control Bar */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6 flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search trash items..."
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all text-sm font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 px-5 py-3 bg-rose-50 rounded-2xl border border-rose-100 shrink-0">
                        <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Wiped Records:</span>
                        <span className="text-lg font-black text-rose-600 tabular-nums">{trashItems.length}</span>
                    </div>
                </div>

                {/* Main Items Listing */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center flex-1 gap-4 py-20">
                            <div className="relative">
                                <Loader2 size={48} className="animate-spin text-rose-500" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                                </div>
                            </div>
                            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Scanning Waste Store...</p>
                        </div>
                    ) : filteredItems.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {filteredItems.map((item) => (
                                <div key={item.key} className="p-5 hover:bg-slate-50 transition-all flex items-center justify-between group cursor-default">
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 bg-white border border-gray-100 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                            {getItemIcon(item.key)}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-bold text-gray-800 text-base group-hover:text-rose-600 transition-colors line-clamp-1">{getItemName(item)}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700 shadow-sm">
                                                    {getItemType(item.key)}
                                                </span>
                                                <div className="flex items-center gap-1.5 text-gray-400 text-xs font-medium">
                                                    <div className="w-1 h-1 bg-gray-300 rounded-full" />
                                                    <span>Deleted: {item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown date'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 md:opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                        <button
                                            onClick={() => handleRestore(item.key, item)}
                                            className="w-10 h-10 flex items-center justify-center text-blue-600 bg-white border border-gray-100 hover:border-blue-200 hover:bg-blue-50 rounded-xl transition-all shadow-sm hover:shadow active:scale-90"
                                            title="Restore Item"
                                        >
                                            <RefreshCcw size={20} />
                                        </button>
                                        <button
                                            onClick={() => handleDeletePermanent(item.key)}
                                            className="w-10 h-10 flex items-center justify-center text-rose-600 bg-white border border-gray-100 hover:border-rose-200 hover:bg-rose-50 rounded-xl transition-all shadow-sm hover:shadow active:scale-90"
                                            title="Delete Permanently"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center flex-1 gap-6 text-center px-10 py-20 grayscale opacity-40">
                            <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-300 border-2 border-dashed border-gray-200">
                                <Archive size={48} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter italic">Trash Bin is Crystal Clear</h3>
                                <p className="text-sm text-gray-500 max-w-sm mx-auto font-medium">No waste found in the store. Deleted objects will automatically accumulate here for recovery.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Info Footer */}
                <div className="mt-8 flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100/50">
                    <AlertCircle className="text-blue-500 shrink-0" size={20} />
                    <p className="text-[11px] md:text-xs text-blue-800 font-medium leading-relaxed">
                        <strong>Security Tip:</strong> Projects deleted on this page are moved to the server's trash collection. Only the account owner or authorized members can see and restore items from the trash bin.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TrashPage;
