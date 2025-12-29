import React from 'react';
import { Task, Priority, PrioritySettings } from '../types';
import { useDraggable } from '@dnd-kit/core';
import { Edit2, Trash2, CheckSquare, Square, Calendar, CheckCircle2, Image as ImageIcon } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onToggleCheck: (id: string) => void;
  prioritySettings: PrioritySettings;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit, onDelete, onToggleCheck, prioritySettings }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { type: 'Task', task },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;
  
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
      className={`kanban-task-card bg-white p-3 rounded-lg shadow-sm border border-gray-200 group hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50 ring-2 ring-blue-500 rotate-2' : ''}`}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onEdit(task)} // Click to edit
    >
      {/* Media Preview */}
      {task.media && (
          <div className="kanban-task-media mb-2 -mx-3 -mt-3 rounded-t-lg overflow-hidden h-32 bg-gray-100 relative">
             {task.media.match(/\.(jpeg|jpg|gif|png|webp)|data:image/i) ? (
                 <img src={task.media} alt={task.title} className="w-full h-full object-cover" />
             ) : (
                 <div className="w-full h-full flex items-center justify-center text-gray-400">
                     <ImageIcon size={32} />
                 </div>
             )}
          </div>
      )}

      <div className={`kanban-task-header flex justify-between items-start mb-2 ${task.media ? 'mt-3' : ''}`}>
        <span 
            className="kanban-task-priority text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide"
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
            onClick={(e) => { e.stopPropagation(); onEdit(task); }} 
            className="btn-edit-task p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
          >
            <Edit2 size={14} />
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