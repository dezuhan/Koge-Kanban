import React from 'react';
import { Task, Priority, PrioritySettings } from '../types';
import { Edit2, Trash2, CheckSquare, Square, Calendar, CheckCircle2, Image as ImageIcon, Copy, Check, Share2 } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onDuplicate: (task: Task) => void;
  onToggleCheck: (id: string) => void;
  prioritySettings: PrioritySettings;
  selectedTaskIds?: string[];
  onToggleTaskSelection?: (taskId: string) => void;
  // Drag props passed from parent
  attributes?: any;
  listeners?: any;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  isDragging?: boolean;
  projectId?: string;
}

export const TaskCard: React.FC<TaskCardProps> = ({ 
    task, 
    onEdit, 
    onDelete, 
    onDuplicate, 
    onToggleCheck, 
    prioritySettings,
    selectedTaskIds = [],
    onToggleTaskSelection,
    attributes,
    listeners,
    setNodeRef,
    style,
    isDragging,
    projectId
}) => {
  const [mediaError, setMediaError] = React.useState(false);
  const [isShared, setIsShared] = React.useState(false);
  const isSelected = selectedTaskIds.includes(task.id);

  React.useEffect(() => {
      setMediaError(false);
  }, [task.media]);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!projectId) return;

    const url = `${window.location.origin}/board/${projectId}/task/${task.id}`;
    try {
        await navigator.clipboard.writeText(url);
        setIsShared(true);
        setTimeout(() => setIsShared(false), 2000);
    } catch (err) {
        console.error("Failed to copy link:", err);
    }
  };

  const priorityStyle = prioritySettings[task.priority];
  const completedSubtasks = task.subTasks?.filter(st => st.isCompleted).length || 0;
  const totalSubtasks = task.subTasks?.length || 0;

  // Generate initials for avatar
  const getInitials = (name: string) => {
      return name
          .split(' ')
          .map(word => word[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`kanban-task-card relative bg-white p-3 rounded-lg shadow-sm border group hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${
          isSelected ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500/20' : 'border-gray-200'
      } ${isDragging ? 'ring-2 ring-blue-500 rotate-2 z-50' : ''}`}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onEdit(task)} // Click to edit
    >
      {/* Selection Checkbox (Top Left) */}
      <div 
        className={`absolute top-3 left-3 z-10 w-[22px] h-[22px] flex items-center justify-center rounded border transition-all pointer-events-auto ${
            isSelected 
                ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                : 'bg-white border-gray-300 text-transparent hover:border-blue-400 group-hover:border-gray-300 group-hover:text-gray-100'
        }`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
            e.stopPropagation();
            if (onToggleTaskSelection) onToggleTaskSelection(task.id);
        }}
      >
        <Check size={12} strokeWidth={4} />
      </div>

      {/* Media Preview */}
      {task.media && task.media.length > 0 && (
          <div className="kanban-task-media mb-2 -mx-3 -mt-3 rounded-t-lg overflow-hidden h-32 bg-gray-100 relative">
             {!mediaError ? (
                 <>
                 <img 
                    src={task.media[0]} 
                    alt={task.title} 
                    className="w-full h-full object-cover" 
                    onError={() => setMediaError(true)}
                 />
                 {task.media.length > 1 && (
                     <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold">
                         +{task.media.length - 1}
                     </div>
                 )}
                 </>
             ) : (
                 <div className="w-full h-full flex items-center justify-center text-gray-400">
                     <ImageIcon size={32} />
                 </div>
             )}
          </div>
      )}

      <div className={`kanban-task-header flex justify-between items-center mb-2 ${task.media && task.media.length > 0 ? 'mt-3' : 'mt-0'}`}>
        <span 
            className={`kanban-task-priority text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${task.media && task.media.length > 0 ? 'ml-0' : 'ml-7'}`}
            style={{ 
                backgroundColor: priorityStyle.bg, 
                color: priorityStyle.text,
                borderColor: priorityStyle.bg
            }}
        >
          {task.priority}
        </span>
        <div className="kanban-task-actions flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Prevent bubble up on these buttons so they don't trigger edit mode */}
          <button 
            onPointerDown={(e) => e.stopPropagation()} 
            onClick={handleShare} 
            className={`p-1 rounded transition-colors ${isShared ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
            title="Copy direct link"
          >
            {isShared ? <Check size={14} /> : <Share2 size={14} />}
          </button>
          <button 
            onPointerDown={(e) => e.stopPropagation()} 
            onClick={(e) => { e.stopPropagation(); onEdit(task); }} 
            className="btn-edit-task p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="Edit Task"
          >
            <Edit2 size={14} />
          </button>
          <button 
            onPointerDown={(e) => e.stopPropagation()} 
            onClick={(e) => { e.stopPropagation(); onDuplicate(task); }} 
            className="btn-duplicate-task p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
            title="Duplicate Task"
          >
            <Copy size={14} />
          </button>
          <button 
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} 
            className="btn-delete-task p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <h3 className={`kanban-task-title font-semibold text-gray-800 text-sm mb-1 ${task.isCompleted ? 'line-through text-gray-400' : ''}`}>
        {task.title}
      </h3>
      
      <p className="kanban-task-desc text-xs text-gray-500 line-clamp-2 mb-3 h-8">
        {task.description || "No description provided."}
      </p>

      {/* Meta info row */}
      <div className="kanban-task-meta flex items-center justify-between mb-2 text-xs text-gray-400">
         <div className="flex items-center gap-3">
            {task.dueDate && (
                <div className="task-due-date flex items-center gap-1">
                    <Calendar size={12} />
                    <span className={new Date(task.dueDate) < new Date() && !task.isCompleted ? "text-red-500 font-medium" : ""}>
                        {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                </div>
            )}
            {totalSubtasks > 0 && (
                <div className="task-subtasks flex items-center gap-1" title={`${completedSubtasks}/${totalSubtasks} subtasks completed`}>
                    <CheckCircle2 size={12} />
                    <span>{completedSubtasks}/{totalSubtasks}</span>
                </div>
            )}
         </div>

         {task.assignee && (
            <div className="task-assignee w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold border border-blue-200" title={`Assigned to: ${task.assignee}`}>
                {getInitials(task.assignee)}
            </div>
         )}
      </div>

      <div className="kanban-task-footer flex items-center justify-between mt-2 pt-2 border-t border-gray-50 text-xs text-gray-400">
        <div className="flex flex-col">
            <span className="task-category font-medium text-gray-500">{task.category}</span>
            <span className="task-project text-[10px]">{task.project}</span>
        </div>
        <button 
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onToggleCheck(task.id); }}
            className={`btn-toggle-check transition-colors ${task.isCompleted ? 'text-green-500' : 'text-gray-300 hover:text-gray-500'}`}
        >
            {task.isCompleted ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
      </div>
    </div>
  );
};
