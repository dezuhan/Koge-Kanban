import React, { useState, useEffect, useRef } from 'react';
import { Task, Priority, SubTask, Column } from '../types';
import { X, Sparkles, Loader2, Plus, Trash2, CheckSquare, Square, Calendar, Image as ImageIcon, Link as LinkIcon, Upload, User } from 'lucide-react';
import { generateTaskDetails } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id' | 'createdAt'> | Task) => void;
  initialTask?: Task | null;
  columns: Column[];
  defaultStatus?: string;
}

const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSave, initialTask, columns, defaultStatus }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<string>('');
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [category, setCategory] = useState('General');
  const [project, setProject] = useState('Main Project');
  const [assignee, setAssignee] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [dueDate, setDueDate] = useState<string>(''); 
  const [media, setMedia] = useState<string>('');
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  // Changed default to 'preview' as requested
  const [descTab, setDescTab] = useState<'write' | 'preview'>('preview');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setDescription(initialTask.description);
      setStatus(initialTask.status);
      setPriority(initialTask.priority);
      setCategory(initialTask.category);
      setProject(initialTask.project);
      setAssignee(initialTask.assignee || '');
      setIsCompleted(initialTask.isCompleted);
      setDueDate(initialTask.dueDate ? new Date(initialTask.dueDate).toISOString().split('T')[0] : '');
      setMedia(initialTask.media || '');
      setSubTasks(initialTask.subTasks || []);
      // If editing existing task, default to preview unless empty
      setDescTab(initialTask.description ? 'preview' : 'write');
    } else {
      resetForm();
    }
  }, [initialTask, isOpen, columns, defaultStatus]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStatus(defaultStatus || (columns.length > 0 ? columns[0].id : ''));
    setPriority(Priority.MEDIUM);
    setCategory('General');
    setProject('Main Project');
    setAssignee('');
    setIsCompleted(false);
    setDueDate('');
    setMedia('');
    setSubTasks([]);
    setNewSubTaskTitle('');
    setDescTab('preview');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const taskData = {
      ...(initialTask ? { id: initialTask.id, createdAt: initialTask.createdAt } : {}),
      title,
      description,
      status,
      priority,
      category,
      project,
      assignee,
      isCompleted,
      dueDate: dueDate ? new Date(dueDate).getTime() : null,
      media,
      subTasks,
    };
    onSave(taskData as Task);
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit for local storage safety
          alert("Image is too large for local storage (Max 2MB). Please use an external link.");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setMedia(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAiAssist = async () => {
    if (!title) return;
    setIsAiLoading(true);
    try {
      const suggestion = await generateTaskDetails(title, description);
      if (suggestion) {
        if (suggestion.description) setDescription(suggestion.description);
        if (suggestion.category) setCategory(suggestion.category);
        if (suggestion.priority) setPriority(suggestion.priority as Priority);
        if (suggestion.subTasks && Array.isArray(suggestion.subTasks)) {
           const newSubTasks = suggestion.subTasks.map((st: string) => ({
             id: crypto.randomUUID(),
             title: st,
             isCompleted: false
           }));
           setSubTasks(prev => [...prev, ...newSubTasks]);
        }
        setDescTab('preview'); // Switch to preview to show AI result
      }
    } catch (e) {
      alert("Failed to fetch AI suggestions. Check your API key.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const addSubTask = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newSubTaskTitle.trim()) return;
    const newTask: SubTask = {
        id: crypto.randomUUID(),
        title: newSubTaskTitle,
        isCompleted: false
    };
    setSubTasks([...subTasks, newTask]);
    setNewSubTaskTitle('');
  };

  const toggleSubTask = (id: string) => {
      setSubTasks(subTasks.map(st => st.id === id ? { ...st, isCompleted: !st.isCompleted } : st));
  };

  const deleteSubTask = (id: string) => {
      setSubTasks(subTasks.filter(st => st.id !== id));
  };

  if (!isOpen) return null;

  return (
    <div className="task-modal fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="task-modal-container bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="task-modal-header flex justify-between items-center p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
          <h2 className="text-xl font-bold text-gray-800">{initialTask ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="btn-close p-1 hover:bg-gray-100 rounded-full text-gray-500 transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="task-modal-form flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title & AI */}
          <div className="form-group">
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <div className="flex gap-2">
              <input
                required
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-title flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Fix login bug"
              />
              <button
                type="button"
                onClick={handleAiAssist}
                disabled={!title || isAiLoading}
                className="btn-ai-assist bg-purple-100 text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-200 transition disabled:opacity-50 flex items-center gap-1 min-w-[100px] justify-center"
                title="Auto-fill details and subtasks with AI"
              >
                {isAiLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                <span className="hidden sm:inline text-sm font-medium">AI Magic</span>
              </button>
            </div>
          </div>

          {/* Grid fields */}
          <div className="form-grid grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
              <input
                type="text"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="input-project w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-category w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
             <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
              <div className="relative">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    className="input-assignee w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. John Doe"
                  />
              </div>
            </div>

            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <div className="relative">
                  <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="input-due-date w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
              </div>
            </div>

            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="input-status w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>{col.title}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="input-priority w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.values(Priority).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Media Input */}
          <div className="form-group">
            <label className="block text-sm font-medium text-gray-700 mb-1">Media (Link or Image)</label>
            <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <LinkIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={media}
                            onChange={(e) => setMedia(e.target.value)}
                            placeholder="https://example.com/image.png"
                            className="input-media w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                    />
                    <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn-upload bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
                        title="Upload Image"
                    >
                        <Upload size={18} /> <span className="hidden sm:inline">Upload</span>
                    </button>
                </div>
                {media && (
                    <div className="media-preview relative mt-2 w-full h-32 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden flex items-center justify-center group">
                         {/* Simple check if it looks like an image, otherwise generic preview */}
                         {media.match(/\.(jpeg|jpg|gif|png|webp)|data:image/i) ? (
                             <img src={media} alt="Preview" className="h-full w-full object-contain" />
                         ) : (
                             <div className="text-gray-400 flex flex-col items-center gap-1">
                                 <ImageIcon size={24} />
                                 <span className="text-xs">Media Link Preview</span>
                             </div>
                         )}
                         <button 
                            type="button"
                            onClick={() => setMedia('')}
                            className="btn-remove-media absolute top-1 right-1 bg-white/80 p-1 rounded-full text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                         >
                             <Trash2 size={16} />
                         </button>
                    </div>
                )}
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <div className="desc-tabs flex bg-gray-100 rounded-lg p-0.5">
                    <button
                        type="button"
                        onClick={() => setDescTab('write')}
                        className={`tab-write text-xs px-3 py-1 rounded-md transition-all ${descTab === 'write' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Write
                    </button>
                    <button
                        type="button"
                        onClick={() => setDescTab('preview')}
                        className={`tab-preview text-xs px-3 py-1 rounded-md transition-all ${descTab === 'preview' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Preview
                    </button>
                </div>
            </div>
            
            {descTab === 'write' ? (
                <div className="relative">
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="input-desc w-full rounded-lg border border-gray-300 px-3 py-2 h-32 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                        placeholder="Task details... (Markdown supported)"
                    />
                    <div className="absolute bottom-2 right-2 text-[10px] text-gray-400 pointer-events-none select-none">
                        Markdown supported
                    </div>
                </div>
            ) : (
                <div className="desc-preview w-full rounded-lg border border-gray-200 px-4 py-3 h-32 overflow-y-auto bg-gray-50 prose prose-sm prose-blue max-w-none">
                     {description ? (
                         <ReactMarkdown>{description}</ReactMarkdown>
                     ) : (
                         <span className="text-gray-400 italic">No description provided.</span>
                     )}
                </div>
            )}
          </div>
          
          {/* Subtasks */}
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

          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
             <input 
                type="checkbox" 
                id="isCompleted" 
                checked={isCompleted} 
                onChange={(e) => setIsCompleted(e.target.checked)}
                className="checkbox-completed w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
             />
             <label htmlFor="isCompleted" className="text-sm text-gray-700">Mark main task as completed</label>
          </div>
        </form>
        
        <div className="task-modal-footer flex justify-end p-4 border-t border-gray-100 bg-gray-50 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-cancel px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="btn-save px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm"
            >
              {initialTask ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
      </div>
    </div>
  );
};

export default TaskModal;