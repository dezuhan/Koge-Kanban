import React, { useState } from 'react';
import { SubTask } from '../../types';
import { Plus, CheckSquare, Square, Trash2, Wand2, Loader2, Edit2, Check, X } from 'lucide-react';
import { OllamaIcon } from '../OllamaIcon';
import { useApp } from '../../context/AppContext';
import { getSubtasksChecklistPrompt } from '../../fine-tunning/subtasks/checklist-prompt';

interface SubTaskListProps {
  subTasks: SubTask[];
  onChange: (newSubTasks: SubTask[]) => void;
  parentTaskTitle?: string; // Optional context for AI
  parentTaskDescription?: string; // Additional context for AI
  isAIEnabled?: boolean;
  onDisableAI?: () => void;
}

export const SubTaskList: React.FC<SubTaskListProps> = ({ subTasks, onChange, parentTaskTitle, parentTaskDescription, isAIEnabled = false, onDisableAI }) => {
  const { activeModel, ollamaEndpoint, confirm: globalConfirm, alert: globalAlert } = useApp(); // Access active model from context
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [showAIContext, setShowAIContext] = useState(false);
  const [userInstructions, setUserInstructions] = useState('');
  
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const addSubTask = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newSubTaskTitle.trim()) return;
    const newTask: SubTask = {
        id: crypto.randomUUID(),
        title: newSubTaskTitle,
        isCompleted: false
    };
    onChange([...subTasks, newTask]);
    setNewSubTaskTitle('');
  };

  const toggleSubTask = (id: string) => {
      onChange(subTasks.map(st => st.id === id ? { ...st, isCompleted: !st.isCompleted } : st));
  };

  const deleteSubTask = (id: string) => {
      onChange(subTasks.filter(st => st.id !== id));
  };

  const startEditing = (subTask: SubTask) => {
      setEditingId(subTask.id);
      setEditingTitle(subTask.title);
  };

  const saveEditing = () => {
      if (editingId && editingTitle.trim()) {
          onChange(subTasks.map(st => st.id === editingId ? { ...st, title: editingTitle.trim() } : st));
          setEditingId(null);
          setEditingTitle('');
      }
  };

  const cancelEditing = () => {
      setEditingId(null);
      setEditingTitle('');
  };

  const clearAllSubTasks = () => {
      if (subTasks.length > 0) {
          globalConfirm({
            title: 'Clear Subtasks?',
            message: 'Are you sure you want to remove all subtasks?',
            type: 'danger',
            confirmText: 'Clear All',
            onConfirm: () => onChange([])
          });
      }
  };

  const handleAIGenerate = async () => {
      if (!parentTaskTitle) {
          globalAlert({
            title: 'Missing Title',
            message: 'Please verify the main task has a title first.',
            type: 'warning'
          });
          return;
      }

      setIsAILoading(true);
      try {
          // Construct prompt including description if available
          let context = `Task Title: "${parentTaskTitle}"`;
          if (parentTaskDescription && parentTaskDescription.trim().length > 0) {
              context += `\n\nTask Description/Context:\n"${parentTaskDescription}"`;
          }
          
          if (userInstructions && userInstructions.trim().length > 0) {
              context += `\n\nUser Specific Instructions:\n"${userInstructions}"`;
          }

          const prompt = getSubtasksChecklistPrompt(context);

          const response = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-ollama-endpoint': ollamaEndpoint
            },
            body: JSON.stringify({ prompt, model: activeModel })
        });

          if (!response.ok) {
              const err = await response.json();
              throw new Error(err.error || "Failed to generate");
          }

          const data = await response.json();
          if (data.response) {
              const lines = data.response.split('\n').filter((l: string) => l.trim().length > 0);
              const newItems = lines.map((line: string) => ({
                  id: crypto.randomUUID(),
                  title: line.replace(/^[-*•\d\.]+\s+/, '').trim(), // Clean potential bullets
                  isCompleted: false
              }));
              
              onChange([...subTasks, ...newItems]);
              setShowAIContext(false);
              setUserInstructions('');
          }
      } catch (error: any) {
          console.error("AI Error:", error);
          if (onDisableAI) {
              onDisableAI();
              globalAlert({
                title: 'AI Error',
                message: 'AI Service disconnected. Auto-Split disabled.',
                type: 'danger'
              });
          } else {
              globalAlert({
                title: 'Generation Failed',
                message: 'Failed to generate subtasks.',
                type: 'danger'
              });
          }
      } finally {
          setIsAILoading(false);
      }
  };

  return (
    <div className="form-group">
        <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">Subtasks</label>
            <div className="flex gap-2">
                {subTasks.length > 0 && (
                    <button
                        type="button"
                        onClick={clearAllSubTasks}
                        className="flex items-center gap-1 text-xs px-2 py-0.5 bg-red-50 text-red-600 hover:bg-red-100 rounded transition-colors"
                        title="Remove all subtasks"
                    >
                        <Trash2 size={10} />
                        Clear
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => isAIEnabled && setShowAIContext(!showAIContext)}
                    disabled={!isAIEnabled || !parentTaskTitle}
                    className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors ${
                        !isAIEnabled
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                            : showAIContext 
                                ? 'bg-blue-200 text-blue-800' 
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                    title={isAIEnabled ? "AI Auto-Split subtasks" : "Enable AI to use Auto-Split"}
                >
                    AI Auto-Split
                </button>
            </div>
        </div>

        {isAIEnabled && showAIContext && (
            <div className="mb-2 p-2 bg-blue-50 border border-blue-100 rounded-lg animate-fade-in">
                <label className="block text-xs font-medium text-blue-800 mb-1">
                    Specific Instructions (Optional):
                </label>
                <textarea
                    value={userInstructions}
                    onChange={(e) => setUserInstructions(e.target.value)}
                    placeholder="e.g. 'Limit to 3 items', 'Focus on testing', 'Include a review step'..."
                    className="w-full text-xs p-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 min-h-[60px] resize-none mb-2"
                />
                <button
                    type="button"
                    onClick={handleAIGenerate}
                    disabled={isAILoading}
                    className="w-10 h-10 flex justify-center items-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70"
                    title="Generate Checklist"
                >
                    {isAILoading ? <Loader2 size={16} className="animate-spin"/> : <OllamaIcon size={16} />}
                </button>
            </div>
        )}

        <div className="subtask-container bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-2">
            <div className="flex gap-2 mb-3">
                <input 
                  type="text" 
                  value={newSubTaskTitle}
                  onChange={(e) => setNewSubTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSubTask(e)}
                  placeholder="Add a subtask..."
                  className="input-subtask flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                  type="button" 
                  onClick={addSubTask}
                  disabled={!newSubTaskTitle.trim()}
                  className="btn-add-subtask bg-blue-600 text-white p-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    <Plus size={18} />
                </button>
            </div>
            
            <div className="subtask-list space-y-1 max-h-40 overflow-y-auto">
                {subTasks.map(st => (
                    <div key={st.id} className="subtask-item flex items-center gap-2 group p-1 hover:bg-gray-100 rounded-lg">
                          {editingId === st.id ? (
                              <div className="flex-1 flex items-center gap-1">
                                  <input 
                                      type="text" 
                                      value={editingTitle}
                                      onChange={(e) => setEditingTitle(e.target.value)}
                                      onKeyDown={(e) => {
                                          if (e.key === 'Enter') saveEditing();
                                          if (e.key === 'Escape') cancelEditing();
                                      }}
                                      autoFocus
                                      className="flex-1 text-sm px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                  <button onClick={saveEditing} className="p-1 text-green-600 hover:bg-green-100 rounded">
                                      <Check size={14} />
                                  </button>
                                  <button onClick={cancelEditing} className="p-1 text-gray-500 hover:bg-gray-200 rounded">
                                      <X size={14} />
                                  </button>
                              </div>
                          ) : (
                              <>
                          <button type="button" onClick={() => toggleSubTask(st.id)} className="btn-toggle-subtask text-gray-400 hover:text-blue-600">
                              {st.isCompleted ? <CheckSquare size={16} className="text-blue-600"/> : <Square size={16} />}
                          </button>
                                <span 
                                    className={`flex-1 text-sm ${st.isCompleted ? 'line-through text-gray-400' : 'text-gray-700'} cursor-pointer`}
                                    onDoubleClick={() => startEditing(st)}
                                    title="Double click to edit"
                                >
                              {st.title}
                          </span>
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        type="button" 
                                        onClick={() => startEditing(st)} 
                                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                        title="Edit"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => deleteSubTask(st.id)} 
                                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                        title="Delete"
                                    >
                              <Trash2 size={14} />
                          </button>
                                </div>
                              </>
                          )}
                    </div>
                ))}
                {subTasks.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No subtasks yet.</p>}
            </div>
        </div>
    </div>
  );
};

