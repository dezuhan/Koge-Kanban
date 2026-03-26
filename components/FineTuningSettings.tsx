import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { db } from '../services/db';
import { Settings, Plus, RefreshCw, Trash2, Save, Tags } from 'lucide-react';

const FineTuningSettings: React.FC = () => {
    const { fineTuningPrompts, fetchFineTuningPrompts, confirm, alert } = useApp();
    const [editingPrompt, setEditingPrompt] = useState<any | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // New Prompt State
    const [isCreating, setIsCreating] = useState(false);
    const [newId, setNewId] = useState('');
    const [newTitle, setNewTitle] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newTemp, setNewTemp] = useState(0.7);

    useEffect(() => {
        if (!fineTuningPrompts || fineTuningPrompts.length === 0) {
            fetchFineTuningPrompts();
        }
    }, [fineTuningPrompts, fetchFineTuningPrompts]);

    const handleSave = async (promptId: string) => {
        if (!editingPrompt) return;
        setIsSaving(true);
        try {
            await db.fineTuning.updatePrompt(promptId, {
                content: editingPrompt.content,
                temperature: editingPrompt.temperature,
                title: editingPrompt.title,
                category: editingPrompt.category
            });
            await fetchFineTuningPrompts();
            setEditingPrompt(null);
            alert({ title: "Saved", message: "Fine-tuning prompt updated successfully.", type: "info" });
        } catch (e: any) {
            alert({ title: "Error", message: Math.floor(e.message) || "Failed to save prompt.", type: "danger" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = (id: string) => {
        confirm({
            title: "Reset to Default?",
            message: "Are you sure you want to reset this system prompt to its original factory state?",
            type: "warning",
            confirmText: "Yes, Reset",
            onConfirm: async () => {
                try {
                    await db.fineTuning.resetPrompt(id);
                    await fetchFineTuningPrompts();
                    setEditingPrompt(null);
                } catch (e: any) {
                    alert({ title: "Error", message: e.message || "Failed to reset.", type: "danger" });
                }
            }
        });
    };

    const handleDelete = (id: string, isSystem: number) => {
        if (isSystem) return;
        confirm({
            title: "Delete Custom Prompt?",
            message: "Are you sure you want to permanently delete this custom fine-tuning prompt?",
            type: "danger",
            confirmText: "Yes, Delete",
            onConfirm: async () => {
                try {
                    await db.fineTuning.deletePrompt(id);
                    await fetchFineTuningPrompts();
                    if (editingPrompt?.id === id) setEditingPrompt(null);
                } catch (e: any) {
                    alert({ title: "Error", message: e.message || "Failed to delete.", type: "danger" });
                }
            }
        });
    };

    const handleCreate = async () => {
        if (!newId || !newTitle || !newCategory || !newContent) {
            alert({ title: "Missing Fields", message: "ID, Title, Category, and Content are required.", type: "warning" });
            return;
        }
        setIsSaving(true);
        try {
            await db.fineTuning.createPrompt({
                id: newId.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                title: newTitle,
                category: newCategory,
                content: newContent,
                temperature: newTemp
            });
            await fetchFineTuningPrompts();
            setIsCreating(false);
            setNewId(''); setNewTitle(''); setNewCategory(''); setNewContent(''); setNewTemp(0.7);
            alert({ title: "Created", message: "Custom prompt added successfully.", type: "info" });
        } catch (e: any) {
            alert({ title: "Error", message: e.message || "Failed to create prompt.", type: "danger" });
        } finally {
            setIsSaving(false);
        }
    };

    // Group prompts by category
    const groupedPrompts: Record<string, any[]> = {};
    if (fineTuningPrompts) {
        fineTuningPrompts.forEach(p => {
            const cat = p.category || 'Uncategorized';
            if (!groupedPrompts[cat]) groupedPrompts[cat] = [];
            groupedPrompts[cat].push(p);
        });
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300 pb-10">
            <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div>
                    <h3 className="text-xl font-bold text-gray-800">AI Fine-Tuning</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Customize system behaviors and add your own context categories.
                    </p>
                </div>
                {!isCreating && (
                    <button 
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus size={16} /> Add Custom Prompt
                    </button>
                )}
            </div>

            {isCreating && (
                <div className="bg-white border-2 border-blue-200 rounded-xl p-6 shadow-sm mb-6">
                    <h4 className="font-bold text-lg mb-4 text-gray-800">Create Custom Prompt</h4>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Unique ID (e.g. company_profile)</label>
                                <input 
                                    value={newId} 
                                    onChange={e => setNewId(e.target.value)} 
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    placeholder="Enter unique slug..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Display Title</label>
                                <input 
                                    value={newTitle} 
                                    onChange={e => setNewTitle(e.target.value)} 
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    placeholder="e.g. Acme Corp Profile"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Category</label>
                                <input 
                                    value={newCategory} 
                                    onChange={e => setNewCategory(e.target.value)} 
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    list="category_suggestions"
                                    placeholder="e.g. Company Profile"
                                />
                                <datalist id="category_suggestions">
                                    <option value="Company Profile" />
                                    <option value="Product Knowledge" />
                                    <option value="User Profile" />
                                    <option value="Formatting Rules" />
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
                                    AI Creativity / Temperature: <span className="text-blue-600 font-bold">{newTemp}</span>
                                </label>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-xs text-gray-400 font-medium">0.0 (Strict)</span>
                                    <input 
                                        type="range" 
                                        min="0" max="1" step="0.1" 
                                        value={newTemp}
                                        onChange={e => setNewTemp(parseFloat(e.target.value))}
                                        className="flex-1 accent-blue-600"
                                    />
                                    <span className="text-xs text-gray-400 font-medium">1.0 (Creative)</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Template Content</label>
                            <div className="text-[11px] text-gray-400 mb-2">Use <code className="bg-gray-100 text-pink-600 px-1 py-0.5 rounded">{"{{variable_name}}"}</code> to inject dynamic parameters.</div>
                            <textarea
                                value={newContent}
                                onChange={e => setNewContent(e.target.value)}
                                rows={8}
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y"
                                placeholder="Write your prompt template..."
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button 
                                onClick={() => setIsCreating(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleCreate}
                                disabled={isSaving}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                <Save size={16} /> Save New Prompt
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {Object.entries(groupedPrompts).map(([category, prompts]) => (
                <div key={category} className="space-y-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-2">
                        <Tags size={14} className="text-blue-500" />
                        {category}
                    </h4>
                    
                    <div className="grid gap-4">
                        {prompts.map((prompt: any) => {
                            const isEditingThis = editingPrompt && editingPrompt.id === prompt.id;
                            const isSystem = prompt.is_system === 1;

                            return (
                                <div key={prompt.id} className={`bg-white border ${isEditingThis ? 'border-blue-400 shadow-md ring-4 ring-blue-50' : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'} rounded-xl overflow-hidden transition-all duration-200`}>
                                    
                                    {/* Header (Always Visible) */}
                                    <div 
                                        className="flex items-center justify-between p-4 cursor-pointer select-none"
                                        onClick={() => {
                                            if (isEditingThis) setEditingPrompt(null);
                                            else setEditingPrompt(JSON.parse(JSON.stringify(prompt)));
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-1.5 h-6 rounded-full ${isSystem ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
                                            <div>
                                                <div className="font-bold text-gray-800 flex items-center gap-2">
                                                    {prompt.title}
                                                    {isSystem && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] uppercase font-bold tracking-wider">System Default</span>}
                                                </div>
                                                <div className="text-xs text-gray-400 font-mono mt-0.5">{prompt.id}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className="flex items-center gap-1.5 text-gray-500 bg-gray-50 px-2.5 py-1 rounded-md">
                                                <Settings size={14} /> temp: <span className="font-bold text-gray-700">{prompt.temperature}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Editor (Expanded) */}
                                    {isEditingThis && (
                                        <div className="border-t border-blue-100 bg-slate-50/50 p-5 space-y-5 animate-in slide-in-from-top-2 duration-200">
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Title</label>
                                                    <input 
                                                        value={editingPrompt.title} 
                                                        onChange={e => setEditingPrompt({...editingPrompt, title: e.target.value})} 
                                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Category</label>
                                                    <input 
                                                        value={editingPrompt.category} 
                                                        onChange={e => setEditingPrompt({...editingPrompt, category: e.target.value})} 
                                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                        list="category_suggestions_edit"
                                                    />
                                                    <datalist id="category_suggestions_edit">
                                                        <option value="Company Profile" />
                                                        <option value="Product Knowledge" />
                                                        <option value="User Profile" />
                                                    </datalist>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
                                                    AI Creativity / Temperature: <span className="text-blue-600 font-bold">{editingPrompt.temperature}</span>
                                                </label>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <span className="text-xs text-gray-400 font-medium">0.0 (Strict)</span>
                                                    <input 
                                                        type="range" 
                                                        min="0" max="1" step="0.1" 
                                                        value={editingPrompt.temperature}
                                                        onChange={e => setEditingPrompt({...editingPrompt, temperature: parseFloat(e.target.value)})}
                                                        className="flex-1 accent-blue-600"
                                                    />
                                                    <span className="text-xs text-gray-400 font-medium">1.0 (Creative)</span>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider flex justify-between">
                                                    <span>Template Content</span>
                                                </label>
                                                <textarea
                                                    value={editingPrompt.content}
                                                    onChange={e => setEditingPrompt({...editingPrompt, content: e.target.value})}
                                                    rows={10}
                                                    className="w-full p-4 bg-white border border-gray-200 rounded-lg text-sm font-mono text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-inner transition-all resize-y"
                                                />
                                            </div>

                                            {/* Action Bar */}
                                            <div className="flex items-center justify-between pt-2 border-t border-gray-200/60 mt-4">
                                                <div className="flex items-center gap-2">
                                                    {isSystem ? (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleReset(prompt.id); }}
                                                            className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-50 px-3 py-1.5 rounded-md transition-colors"
                                                            title="Revert to factory default settings"
                                                        >
                                                            <RefreshCw size={14} /> Reset Default
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(prompt.id, prompt.is_system); }}
                                                            className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md transition-colors"
                                                        >
                                                            <Trash2 size={14} /> Delete
                                                        </button>
                                                    )}
                                                </div>
                                                
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => setEditingPrompt(null)}
                                                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleSave(prompt.id); }}
                                                        disabled={isSaving}
                                                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                                                    >
                                                        <Save size={16} /> Save Changes
                                                    </button>
                                                </div>
                                            </div>

                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default FineTuningSettings;
