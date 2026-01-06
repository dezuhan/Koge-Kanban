import React, { useState } from 'react';
import { SubTask } from '../../types';
import { Plus, CheckSquare, Square, Trash2, Sparkles, Loader2, Edit2, Check, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface SubTaskListProps {
  subTasks: SubTask[];
  onChange: (newSubTasks: SubTask[]) => void;
  parentTaskTitle?: string; // Optional context for AI
  parentTaskDescription?: string; // Additional context for AI
  isAIEnabled?: boolean;
  onDisableAI?: () => void;
}

export const SubTaskList: React.FC<SubTaskListProps> = ({ subTasks, onChange, parentTaskTitle, parentTaskDescription, isAIEnabled = false, onDisableAI }) => {
  const { activeModel } = useApp(); // Access active model from context
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
      if (subTasks.length > 0 && confirm("Are you sure you want to remove all subtasks?")) {
          onChange([]);
      }
  };

  const handleAIGenerate = async () => {
      if (!parentTaskTitle) {
          alert("Please verify the main task has a title first.");
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

          const prompt = `Act as a Senior Project Manager. Analyze the following task title and description in detail.
          
          ${context}
          
          Based on this context, break down this task into a logical, step-by-step checklist of subtasks required to complete it.
          - If the description already lists steps, format them as subtasks.
          - If the description is vague, infer the necessary steps based on the title and context.
          
          Return ONLY the subtask titles, one per line. No numbering, no bullets, just plain text.`;

          const response = await fetch('http://localhost:3000/api/ai/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
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
              alert("AI Service disconnected. Auto-Split disabled.");
          } else {
              alert("Failed to generate subtasks.");
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
                {isAIEnabled && (
                    <button
                        type="button"
                        onClick={() => setShowAIContext(!showAIContext)}
                        disabled={!parentTaskTitle}
                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors disabled:opacity-50 ${showAIContext ? 'bg-purple-200 text-purple-800' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                    >
                        <Sparkles size={10} />
                        AI Auto-Split
                    </button>
                )}
            </div>
        </div>

        {isAIEnabled && showAIContext && (
            <div className="mb-2 p-2 bg-purple-50 border border-purple-100 rounded-lg animate-fade-in">
                <label className="block text-xs font-medium text-purple-800 mb-1">
                    Specific Instructions (Optional):
                </label>
                <textarea
                    value={userInstructions}
                    onChange={(e) => setUserInstructions(e.target.value)}
                    placeholder="e.g. 'Limit to 3 items', 'Focus on testing', 'Include a review step'..."
                    className="w-full text-xs p-2 border border-purple-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400 min-h-[60px] resize-none mb-2"
                />
                <button
                    type="button"
                    onClick={handleAIGenerate}
                    disabled={isAILoading}
                    className="w-full flex justify-center items-center gap-2 text-xs bg-purple-600 text-white py-1.5 rounded hover:bg-purple-700 transition-colors disabled:opacity-70"
                >
                    {isAILoading ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12} />}
                    Generate Checklist
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
                  className="input-subtask flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                  type="button" 
                  onClick={addSubTask}
                  disabled={!newSubTaskTitle.trim()}
                  className="btn-add-subtask bg-blue-600 text-white p-1.5 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                    <Plus size={18} />
                </button>
            </div>
            
            <div className="subtask-list space-y-1 max-h-40 overflow-y-auto">
                {subTasks.map(st => (
                    <div key={st.id} className="subtask-item flex items-center gap-2 group p-1 hover:bg-gray-100 rounded">
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

