import React, { useState } from 'react';
import { Database, Globe, Save, AlertCircle, Loader2 } from 'lucide-react';

interface DatabaseConfigModalProps {
    isOpen: boolean;
    onSave: (url: string) => Promise<void>;
    initialUrl: string;
}

const DatabaseConfigModal: React.FC<DatabaseConfigModalProps> = ({
    isOpen,
    onSave,
    initialUrl
}) => {
    const [url, setUrl] = useState(initialUrl);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSaving(true);
        try {
            await onSave(url);
        } catch (err: any) {
            setError(err.message || 'Failed to connect to the database.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-500">
                {/* Header with blue gradient */}
                <div className="bg-blue-600 h-40 flex items-center justify-center relative overflow-hidden">
                    {/* Subtle pattern overlay */}
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>

                    <div className="relative z-10 bg-white/10 backdrop-blur-xl p-5 rounded-2xl border border-white/20 shadow-2xl ring-1 ring-white/30">
                        <Database className="w-12 h-12 text-white" />
                    </div>
                </div>

                <div className="p-8 pt-6">
                    <div className="flex justify-center mb-4">
                        <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-500 text-[10px] font-bold uppercase tracking-widest border border-rose-100 flex items-center gap-1.5">
                            <AlertCircle size={12} />
                            Connection Failed
                        </span>
                    </div>

                    <h2 className="text-2xl font-extrabold text-slate-800 text-center mb-2">Database Configuration</h2>
                    <p className="text-sm text-slate-500 text-center leading-relaxed px-4 mb-8">
                        We couldn't reach the default database. If you have a custom database server, please enter the domain and port below.
                    </p>

                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                                API Base Domain / URL
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors">
                                    <Globe size={18} />
                                </div>
                                <input
                                    type="text"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://your-database-domain.com"
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-300 font-medium text-slate-700"
                                    required
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 italic ml-1">
                                Example: http://192.168.1.5:3000 or https://api.yourdomain.com
                            </p>
                        </div>

                        {error && (
                            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-medium text-center animate-shake">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full py-4 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white rounded-2xl font-bold text-sm shadow-xl shadow-slate-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        >
                            {isSaving ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <>
                                    <Database size={18} />
                                    Save & Connect
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="bg-slate-50 py-4 px-6 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 text-center tracking-widest uppercase">
                        KOGE KANBAN V2.0 • DATA IS STORED SECURELY
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DatabaseConfigModal;
