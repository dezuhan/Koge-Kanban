import React, { useState } from 'react';
import { SubTask } from '../../types';
import { Plus, CheckSquare, Square, Trash2 } from 'lucide-react';

interface SubTaskListProps {
  subTasks: SubTask[];
  onChange: (newSubTasks: SubTask[]) => void;
}

export const SubTaskList: React.FC<SubTaskListProps> = ({ subTasks, onChange }) => {
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');

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

  return (
    <div className="form-group">
        <label className="block text-sm font-medium text-gray-700 mb-2">Subtasks</label>
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
                          <button type="button" onClick={() => toggleSubTask(st.id)} className="btn-toggle-subtask text-gray-400 hover:text-blue-600">
                              {st.isCompleted ? <CheckSquare size={16} className="text-blue-600"/> : <Square size={16} />}
                          </button>
                          <span className={`flex-1 text-sm ${st.isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                              {st.title}
                          </span>
                          <button type="button" onClick={() => deleteSubTask(st.id)} className="btn-delete-subtask text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 size={14} />
                          </button>
                    </div>
                ))}
                {subTasks.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No subtasks yet.</p>}
            </div>
        </div>
    </div>
  );
};

