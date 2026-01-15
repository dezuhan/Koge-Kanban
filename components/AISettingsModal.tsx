import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, CheckCircle2, Circle, Loader2, Power, AlertTriangle, Star } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AISettingsModal: React.FC<AISettingsModalProps> = ({ isOpen, onClose }) => {
  const { aiModels, activeModel, addAIModel, removeAIModel, setActiveAIModel, toggleAI, isAIEnabled, fetchModels } = useApp();
  const [newModelName, setNewModelName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchModels();
    }
  }, [isOpen, fetchModels]);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newModelName.trim()) {
      addAIModel(newModelName.trim());
      setNewModelName('');
    }
  };

  const handleEnableAI = async () => {
      if (!activeModel) return;
      setIsConnecting(true);
      const success = await toggleAI();
      setIsConnecting(false);
      if (success) {
          onClose();
      } else {
          alert("Failed to connect to Ollama with selected model. Ensure 'ollama serve' is running and model is installed.");
      }
  };

  // Helper to check if model is recommended (Qwen3 or Qwen related)
  const isRecommended = (name: string) => {
      const n = name.toLowerCase();
      return n.includes('qwen') || n.includes('qwen2.5') || n.includes('qwen3');
  };

  // Grouping logic
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0">
          <h2 className="text-lg font-bold text-gray-800">Select AI Model</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Available Models (Device)</h3>
            
            {/* System Recommendation Banner */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
                <div className="bg-blue-100 p-1.5 rounded-full text-blue-600 mt-0.5">
                    <Star size={16} fill="currentColor" />
                </div>
                <div>
                    <h4 className="text-xs font-bold text-blue-800 mb-1">System Recommendation</h4>
                    <p className="text-xs text-blue-700 leading-relaxed">
                        For best performance and reasoning, we recommend using <strong>Qwen 3</strong> (or Qwen 2.5) models.
                    </p>
                </div>
            </div>

            {aiModels.length === 0 ? (
                <div className="text-center py-6 bg-yellow-50 rounded-lg border border-yellow-200 animate-in fade-in">
                    <div className="flex justify-center mb-2 text-yellow-600">
                        <AlertTriangle size={32} />
                    </div>
                    <p className="text-sm font-semibold text-yellow-800">No AI Models Detected</p>
                    <div className="text-xs text-yellow-700 mt-2 px-4 space-y-1">
                        <p>Please ensure <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-yellow-900">Ollama</a> is running.</p>
                        <code className="bg-yellow-100 px-2 py-0.5 rounded text-yellow-900 border border-yellow-300 block w-fit mx-auto mt-2">ollama serve</code>
                        <p className="mt-2 pt-2 border-t border-yellow-200">Recommended install:</p>
                        <code className="bg-yellow-100 px-2 py-0.5 rounded text-yellow-900 border border-yellow-300 block w-fit mx-auto">ollama run qwen2.5</code>
                    </div>
                </div>
            ) : (
                <p className="text-xs text-gray-500 mb-4">Select a model to use.</p>
            )}
            
            <div className="space-y-6">
              {sortedGroups.map((group) => (
                <div key={group} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{group} Models</span>
                    <div className="h-px bg-gray-100 flex-1"></div>
                  </div>
                  <div className="space-y-2">
                    {groupedModels[group].map((model) => (
                      <div 
                        key={model}
                        onClick={() => setActiveAIModel(model)}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                          activeModel === model 
                            ? 'bg-blue-50 border-blue-200 shadow-sm' 
                            : 'bg-white border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`text-blue-600 flex-shrink-0 ${activeModel === model ? 'opacity-100' : 'opacity-30'}`}>
                              {activeModel === model ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                          </div>
                          <div className="flex flex-col min-w-0">
                              <span className={`text-sm font-medium truncate ${activeModel === model ? 'text-blue-900' : 'text-gray-700'}`}>
                              {model}
                              </span>
                              {isRecommended(model) && (
                                  <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                      <Star size={10} fill="currentColor" /> Recommended
                                  </span>
                              )}
                          </div>
                        </div>
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Remove "${model}" from list?`)) {
                              removeAIModel(model);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          title="Remove from list"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Add Manual Model</h3>
            <form onSubmit={handleAdd} className="flex gap-2">
              <input
                type="text"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                placeholder="e.g. custom-model:latest"
                className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button 
                type="submit"
                disabled={!newModelName.trim()}
                className="bg-gray-900 text-white p-2 rounded-lg hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={20} />
              </button>
            </form>
          </div>
        </div>

        {/* Footer with Activate Button */}
        {!isAIEnabled && (
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button
                    onClick={handleEnableAI}
                    disabled={!activeModel || isConnecting}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isConnecting ? <Loader2 size={18} className="animate-spin" /> : <Power size={18} />}
                    {isConnecting ? 'Connecting...' : 'Activate AI'}
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default AISettingsModal;

