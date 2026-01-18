import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Priority, PrioritySettings } from '../types';
import { RefreshCw, Globe, Cpu, CheckCircle2, Circle, Star, AlertTriangle, Plus, Trash2, ChevronLeft, Layout } from 'lucide-react';
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
    confirm: globalConfirm,
    alert: globalAlert
  } = useApp();

  const [showToast, setShowToast] = useState(false);
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('general');
  const [apiBaseDomain, setApiBaseDomain] = useState(() => {
    return localStorage.getItem('koge_api_base_url') || '';
  });
  const [dbPassword, setDbPassword] = useState('');
  const [dbPasswordStatus, setDbPasswordStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
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

  // Helper to convert Hue to Hex (simplified for UI purposes)
  const handleHueChange = (priority: Priority, type: 'bg' | 'text', hue: number) => {
    // We convert HSL to Hex. Saturation 70%, Lightness 90% for bg, 40% for text
    const s = 70;
    const l = type === 'bg' ? 90 : 40;
    
    const h = hue / 360;
    const q = l < 50 ? l * (1 + s / 100) : l + s - l * (s / 100);
    const p = 2 * l - q;
    
    const f = (t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const r = Math.round(f(h + 1/3) * 2.55);
    const g = Math.round(f(h) * 2.55);
    const b = Math.round(f(h - 1/3) * 2.55);
    
    const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    handleChangePriority(priority, type, hex);
  };

  const handleSaveApiBase = () => {
    const normalizedDomain = apiBaseDomain.trim().replace(/\/+$/, '');
    const currentStored = localStorage.getItem('koge_api_base_url') || '';
    
    if (normalizedDomain === currentStored) return;

    if (normalizedDomain) {
      localStorage.setItem('koge_api_base_url', normalizedDomain);
    } else {
      localStorage.removeItem('koge_api_base_url');
    }

    // Reload if API base changed
    window.location.reload();
  };

  const handleSaveDbPassword = () => {
    const trimmed = dbPassword.trim();
    if (!trimmed) {
      setDbPasswordStatus('fail');
      return;
    }

    setDbPasswordStatus('checking');
    // Use configured API base (same as data endpoints) so it works in custom domains/tunnels
    const storedApiBase = (localStorage.getItem('koge_api_base_url') || '').replace(/\/+$/, '');
    const authUrl = storedApiBase ? `${storedApiBase}/auth/check-password` : '/api/auth/check-password';

    fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: trimmed })
    })
    .then(res => res.json())
    .then(data => {
      if (data?.ok) {
        // Store token in sessionStorage (prefer not to persist long-term)
        if (data.token) {
          sessionStorage.setItem('koge_db_token', data.token);
          localStorage.setItem('koge_db_token', data.token); // fallback if session is lost; remove if you want shorter life
        }
        setDbPasswordStatus('ok');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 1200);
      } else {
        sessionStorage.removeItem('koge_db_token');
        localStorage.removeItem('koge_db_token');
        setDbPasswordStatus('fail');
        globalAlert({
          title: 'Password Mismatch',
          message: 'Password tidak cocok dengan konfigurasi server. Harap masukkan password yang benar.',
          type: 'danger'
        });
      }
    })
    .catch(() => {
      setDbPasswordStatus('fail');
      sessionStorage.removeItem('koge_db_token');
      localStorage.removeItem('koge_db_token');
      globalAlert({
        title: 'Validation Failed',
        message: 'Gagal memvalidasi password. Pastikan server berjalan dan coba lagi.',
        type: 'danger'
      });
    });
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
    return n.includes('qwen') || n.includes('qwen2.5') || n.includes('qwen3');
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

  const groupedModels = aiModels.reduce((acc, model) => {
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
            {[
              { id: 'general', label: 'General', icon: <Globe size={18} />, description: 'Connectivity & AI setup' },
              { id: 'appearance', label: 'Appearance', icon: <Layout size={18} />, description: 'Themes & priority colors' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as SettingsCategory)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left group ${
                  activeCategory === cat.id 
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
              {activeCategory === 'general' ? <Globe size={18} /> : <Layout size={18} />}
              {activeCategory === 'general' ? 'General' : 'Appearance'}
            </h2>
          </div>

          <div className="p-8 overflow-y-auto max-h-[calc(100vh-250px)] custom-scrollbar">
            {activeCategory === 'general' && (
              <section className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Database Connectivity</h3>
                    <p className="text-xs text-gray-500">Manage where your data is stored and synced.</p>
                  </div>
                  
                  <div className="p-6 bg-blue-50/50 rounded-xl border border-blue-100 space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">API Base Domain</label>
                      <input 
                        type="text"
                        value={apiBaseDomain}
                        onChange={(e) => setApiBaseDomain(e.target.value)}
                        onBlur={handleSaveApiBase}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveApiBase()}
                        placeholder="https://your-database-domain.com"
                        className="w-full text-sm px-4 py-2.5 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                      />
                      <div className="flex items-start gap-2 text-[10px] text-blue-700 italic mt-2 bg-blue-100/50 p-2 rounded-md">
                        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                        <span>* Default: http://localhost:5173/api. Use this if accessing your database via Ngrok/Tunnel from other devices. Changing this will reload the application.</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Database Password (for session token)</label>
                      <input
                        type="password"
                        value={dbPassword}
                        onChange={(e) => setDbPassword(e.target.value)}
                        onBlur={handleSaveDbPassword}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveDbPassword()}
                        placeholder="Enter DB password (validated server-side)"
                        className="w-full text-sm px-4 py-2.5 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                        autoComplete="new-password"
                      />
                      <div className="flex items-start gap-2 text-[10px] text-blue-700 italic mt-2 bg-blue-100/50 p-2 rounded-md">
                        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                        <span>Password is not stored; the server issues a session token if it matches configuration. Token is kept temporarily in your browser.</span>
                      </div>
                      {dbPasswordStatus === 'checking' && (
                        <div className="text-[10px] text-blue-600 font-semibold">Memeriksa password...</div>
                      )}
                      {dbPasswordStatus === 'ok' && (
                        <div className="text-[10px] text-green-600 font-semibold">Password cocok.</div>
                      )}
                      {dbPasswordStatus === 'fail' && (
                        <div className="text-[10px] text-red-600 font-semibold">Password salah atau belum diisi.</div>
                      )}
                    </div>
                  </div>
                </div>

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
                        <span className="bg-slate-200 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">{aiModels.length} Found</span>
                      </div>
                      
                      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3 mb-6">
                        <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                          <Star size={16} fill="currentColor" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-blue-800 mb-1">System Recommendation</h4>
                          <p className="text-[11px] text-blue-700 leading-relaxed">
                            For best performance and reasoning, we recommend using <strong>Qwen 3</strong> (or Qwen 2.5) models under <strong>7B</strong> for speed and instruction accuracy. Non-regular (VL/embedding) models are excluded.
                          </p>
                        </div>
                      </div>

                      {aiModels.length === 0 ? (
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
                                    className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                                      activeModel === model 
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
            )}

            {activeCategory === 'appearance' && (
              <section className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layout size={18} className="text-gray-600" />
                      <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Priority Colors</h3>
                        <p className="text-xs text-gray-500">Customize how different task priorities look on your board.</p>
                      </div>
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
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Background Color</label>
                            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-gray-100">
                              <div className="flex items-center gap-4">
                                <input 
                                    type="color" 
                                    value={prioritySettings[priority].bg}
                                    onChange={(e) => handleChangePriority(priority, 'bg', e.target.value)}
                                    className="cursor-pointer"
                                />
                                <div className="flex-1">
                                  <input 
                                    type="range" 
                                    min="0" 
                                    max="360" 
                                    className="color-hue-slider"
                                    onChange={(e) => handleHueChange(priority, 'bg', parseInt(e.target.value))}
                                  />
                                </div>
                              </div>
                              <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tone Selection</span>
                                <span className="text-xs font-mono font-bold text-blue-600 bg-white px-2 py-1 rounded-lg shadow-sm border border-blue-50 uppercase">{prioritySettings[priority].bg}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Text Color</label>
                            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-gray-100">
                              <div className="flex items-center gap-4">
                                <input 
                                    type="color" 
                                    value={prioritySettings[priority].text}
                                    onChange={(e) => handleChangePriority(priority, 'text', e.target.value)}
                                    className="cursor-pointer"
                                />
                                <div className="flex-1">
                                  <input 
                                    type="range" 
                                    min="0" 
                                    max="360" 
                                    className="color-hue-slider"
                                    onChange={(e) => handleHueChange(priority, 'text', parseInt(e.target.value))}
                                  />
                                </div>
                              </div>
                              <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tone Selection</span>
                                <span className="text-xs font-mono font-bold text-blue-600 bg-white px-2 py-1 rounded-lg shadow-sm border border-blue-50 uppercase">{prioritySettings[priority].text}</span>
                              </div>
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
