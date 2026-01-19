import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Priority, PrioritySettings } from '../types';
import { RefreshCw, Globe, Cpu, CheckCircle2, Circle, Star, AlertTriangle, Plus, Trash2, ChevronLeft, Layout, Palette, User } from 'lucide-react';
import { useApp } from '../context/AppContext';

type SettingsCategory = 'general' | 'appearance';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    prioritySettings,
    setPrioritySettings,
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
    confirm: globalConfirm,
    alert: globalAlert
  } = useApp();

  const [showToast, setShowToast] = useState(false);
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('general');
  const [apiBaseDomain, setApiBaseDomain] = useState(apiBaseUrl);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [connOk, setConnOk] = useState<boolean | null>(null);
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [newModelName, setNewModelName] = useState('');

  useEffect(() => {
    handleRefreshModels();
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

  const filteredAIModels = aiModels.filter(model => {
    const m = model.toLowerCase();
    if (!m.includes('qwen')) return false;

    // version check: Qwen 2 or newer
    const versionMatch = m.match(/qwen([\d.]+)/);
    const version = versionMatch ? parseFloat(versionMatch[1]) : 0;
    if (version < 2) return false;

    // parameter check: 1b-7b
    const paramMatch = m.match(/(\d+(\.\d+)?)b/);
    if (!paramMatch) return false;
    const params = parseFloat(paramMatch[1]);
    return params >= 1 && params <= 7;
  });

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
    { id: 'appearance', label: 'Appearance', icon: <Palette size={18} />, description: 'Themes & priority colors' },
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

          <div className="p-8 overflow-y-auto max-h-[calc(100vh-250px)] custom-scrollbar">
            {activeCategory === 'general' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-300">
                <section className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-slate-700">API Base Domain / URL</h4>
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
                          className="w-full pl-12 pr-32 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                          {connOk !== null && !isTestingConn && (
                            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${connOk ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                              {connOk ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                              {connOk ? 'Connected' : 'Failed'}
                            </span>
                          )}
                          <button
                            onClick={handleSaveApiBase}
                            disabled={isTestingConn}
                            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all disabled:bg-slate-300 flex items-center gap-2"
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
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ollama Endpoint URL</label>
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

                        {filteredAIModels.length === 0 ? (
                          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
                            <AlertTriangle size={48} className="mx-auto text-amber-400 mb-4 opacity-50" />
                            <p className="text-sm font-bold text-slate-500">No AI Models Detected</p>
                            <p className="text-xs text-slate-400 mt-1">Check your Ollama endpoint and ensure it's running.</p>
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
