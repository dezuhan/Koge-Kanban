import React, { useState, useEffect, useRef } from 'react';
import { Task, Priority, SubTask, Column } from '../types';
import { X, Calendar, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ConfirmModal from './ConfirmModal';
import { SubTaskList } from './task-modal/SubTaskList';
import { MediaUploader } from './task-modal/MediaUploader';

interface TaskModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Function to close the modal */
  onClose: () => void;
  /** Function to handle saving the task (create or update) */
  onSave: (task: Omit<Task, 'id' | 'createdAt'> | Task) => void;
  /** The task object to edit (null if creating a new task) */
  initialTask?: Task | null;
  /** List of available columns for the status dropdown */
  columns: Column[];
  /** Default status ID for new tasks */
  defaultStatus?: string;
  /** Name of the current project context */
  currentProjectName?: string; 
}

/**
 * TaskModal Component
 * Modal for creating and editing tasks.
 * Supports:
 * - Rich text description
 * - Subtasks
 * - Media attachments
 * - Priority, Due Date, Assignee, etc.
 */
const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSave, initialTask, columns, defaultStatus, currentProjectName }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<string>('');
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [category, setCategory] = useState('General');
    const [project, setProject] = useState(''); // Will be set in useEffect
    const [assignee, setAssignee] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [dueDate, setDueDate] = useState<string>(''); 
  const [media, setMedia] = useState<string>('');
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  
  // Changed default to 'preview' as requested
  const [descTab, setDescTab] = useState<'write' | 'preview'>('preview');
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Track changes to form fields to set isDirty
  useEffect(() => {
    if (!isOpen) {
        setIsDirty(false);
        return;
    }
    
    // Check if current state differs from initialTask or default values
    const checkDirty = () => {
        if (initialTask) {
            const isModified = 
                title !== initialTask.title ||
                description !== initialTask.description ||
                status !== initialTask.status ||
                priority !== initialTask.priority ||
                category !== initialTask.category ||
                project !== initialTask.project ||
                assignee !== (initialTask.assignee || '') ||
                isCompleted !== initialTask.isCompleted ||
                (dueDate ? new Date(dueDate).toISOString().split('T')[0] : '') !== (initialTask.dueDate ? new Date(initialTask.dueDate).toISOString().split('T')[0] : '') ||
                media !== (initialTask.media || '') ||
                JSON.stringify(subTasks) !== JSON.stringify(initialTask.subTasks || []);
            setIsDirty(isModified);
        } else {
            // New task - check if any field has content
            const hasContent = 
                title !== '' ||
                description !== '' ||
                (assignee !== '') ||
                (dueDate !== '') ||
                (media !== '') ||
                subTasks.length > 0;
            setIsDirty(hasContent);
        }
    };
    checkDirty();
  }, [title, description, status, priority, category, project, assignee, isCompleted, dueDate, media, subTasks, initialTask, isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        // If a modal is already open (like discard confirm), don't do anything here
        // or let the top-most modal handle it.
        // But since ConfirmModal is inside this component, we can manage it.
        if (showDiscardConfirm) {
            setShowDiscardConfirm(false); // Close confirm modal on ESC
            return;
        }

        if (isDirty) {
            setShowDiscardConfirm(true);
        } else {
            onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDirty, showDiscardConfirm, onClose]);

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
  }, [initialTask, isOpen, columns, defaultStatus, currentProjectName]);

  /**
   * Resets the form to default values for a new task.
   */
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStatus(defaultStatus || (columns.length > 0 ? columns[0].id : ''));
    setPriority(Priority.MEDIUM);
    setCategory('General');
    setProject(currentProjectName || 'Main Project');
    setAssignee('');
    setIsCompleted(false);
    setDueDate('');
    setMedia('');
    setSubTasks([]);
    setDescTab('preview');
  };

  /**
   * Handles form submission to save the task.
   * Compiles the task object and calls the onSave prop.
   * @param e Form event
   */
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

  /**
   * Handles request to close the modal.
   * Checks for unsaved changes and prompts confirmation if needed.
   */
  const handleCloseRequest = () => {
      if (isDirty) {
          setShowDiscardConfirm(true);
      } else {
          onClose();
      }
  };

  /**
   * Handles confirmation to discard changes.
   * Resets dirty state and closes the modal.
   */
  const handleConfirmDiscard = () => {
      setShowDiscardConfirm(false);
      setIsDirty(false); // Reset dirty state
      onClose();
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="task-modal fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={(e) => {
        // Close on backdrop click if not dirty, or ask confirmation
        if (e.target === e.currentTarget) {
            handleCloseRequest();
        }
    }}>
      <div className="task-modal-container bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="task-modal-header flex justify-between items-center p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
          <h2 className="text-xl font-bold text-gray-800">{initialTask ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={handleCloseRequest} className="btn-close p-1 hover:bg-gray-100 rounded-full text-gray-500 transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="task-modal-form flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title */}
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
          <MediaUploader media={media} onChange={setMedia} />

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
          <SubTaskList subTasks={subTasks} onChange={setSubTasks} />

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
              onClick={handleCloseRequest}
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
    
    <ConfirmModal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={handleConfirmDiscard}
        title="Discard Changes?"
        message="You have unsaved changes. Are you sure you want to discard them?"
    />
    </>
  );
};

export default TaskModal;