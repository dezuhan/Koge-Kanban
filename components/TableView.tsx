import React from 'react';
import { Task, PrioritySettings, Column, Priority } from '../types';
import { Edit2, Trash2, CheckCircle2, Circle, Calendar, Image as ImageIcon, User, ChevronDown, Check, Share2 } from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';

interface TableViewProps {
  tasks: Task[];
  columns: Column[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onToggleCheck: (id: string) => void;
  onUpdateStatus: (taskId: string, newStatus: string) => void;
  onUpdatePriority: (taskId: string, newPriority: Priority) => void;
  prioritySettings: PrioritySettings;
  selectedTaskIds?: string[];
  onToggleTaskSelection?: (taskId: string) => void;
  onSetSelection?: (ids: string[]) => void;
  projectId?: string;
}

const TableView: React.FC<TableViewProps> = ({ 
    tasks, 
    columns, 
    onEdit, 
    onDelete, 
    onToggleCheck, 
    onUpdateStatus, 
    onUpdatePriority, 
    prioritySettings,
    selectedTaskIds = [],
    onToggleTaskSelection,
    onSetSelection,
    projectId
}) => {
  const [sharingTaskId, setSharingTaskId] = React.useState<string | null>(null);
  
  const allSelected = tasks.length > 0 && tasks.every(task => selectedTaskIds.includes(task.id));
  const someSelected = tasks.some(task => selectedTaskIds.includes(task.id)) && !allSelected;

  const handleSelectAllToggle = () => {
    if (onSetSelection) {
      if (allSelected) {
        onSetSelection(selectedTaskIds.filter(id => !tasks.some(t => t.id === id)));
      } else {
        const newSelection = Array.from(new Set([...selectedTaskIds, ...tasks.map(t => t.id)]));
        onSetSelection(newSelection);
      }
    }
  };

  const handleShare = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    if (!projectId) return;

    const url = `${window.location.origin}/board/${projectId}/task/${taskId}`;
    try {
        await navigator.clipboard.writeText(url);
        setSharingTaskId(taskId);
        setTimeout(() => setSharingTaskId(null), 2000);
    } catch (err) {
        console.error("Failed to copy link:", err);
    }
  };

  const getStatusLabel = (statusId: string) => {
    return columns.find(c => c.id === statusId)?.title || statusId;
  };

  const getInitials = (name: string) => {
      return name
          .split(' ')
          .map(word => word[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
  };

  return (
    <div className="kanban-table-container flex-1 min-h-0 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="kanban-table w-full text-sm text-left text-gray-500 border-separate border-spacing-0">
          <thead className="kanban-table-head text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-20 shadow-sm">
            <tr>
              <th scope="col" className="px-6 py-4 w-10 border-b border-gray-200 bg-gray-50">
                  <div 
                      onClick={handleSelectAllToggle}
                      className={`w-5 h-5 rounded border transition-all flex items-center justify-center cursor-pointer ${
                          allSelected 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                              : someSelected
                                  ? 'bg-blue-100 border-blue-400 text-blue-600'
                                  : 'bg-white border-gray-300 text-transparent hover:border-blue-400'
                      }`}
                      title={allSelected ? "Deselect all" : "Select all visible tasks"}
                  >
                      {allSelected ? (
                          <Check size={14} strokeWidth={4} />
                      ) : someSelected ? (
                          <div className="w-2 h-0.5 bg-blue-600 rounded-sm" />
                      ) : (
                          <Check size={14} strokeWidth={4} />
                      )}
                  </div>
              </th>
              <th scope="col" className="px-6 py-4 w-12 text-center border-b border-gray-200 bg-gray-50">Done</th>
              <th scope="col" className="px-6 py-4 border-b border-gray-200 bg-gray-50">Task Name</th>
              <th scope="col" className="px-6 py-4 border-b border-gray-200 bg-gray-50">Assignee</th>
              <th scope="col" className="px-6 py-4 border-b border-gray-200 bg-gray-50">Media</th>
              <th scope="col" className="px-6 py-4 border-b border-gray-200 bg-gray-50">Status</th>
              <th scope="col" className="px-6 py-4 border-b border-gray-200 bg-gray-50">Priority</th>
              <th scope="col" className="px-6 py-4 border-b border-gray-200 bg-gray-50">Due Date</th>
              <th scope="col" className="px-6 py-4 border-b border-gray-200 bg-gray-50">Category</th>
              <th scope="col" className="px-6 py-4 border-b border-gray-200 bg-gray-50">Project</th>
              <th scope="col" className="px-6 py-4 text-right border-b border-gray-200 bg-gray-50">Actions</th>
            </tr>
          </thead>
          <tbody className="kanban-table-body">
            {tasks.length === 0 ? (
                <tr>
                    <td colSpan={11} className="px-6 py-8 text-center text-gray-400">
                        No tasks found in this view.
                    </td>
                </tr>
            ) : (
                tasks.map((task) => {
                  const completedSubtasks = task.subTasks?.filter(st => st.isCompleted).length || 0;
                  const totalSubtasks = task.subTasks?.length || 0;
                  const isSelected = selectedTaskIds.includes(task.id);

                  return (
                    <tr 
                        key={task.id} 
                        onClick={() => onEdit(task)}
                        className={`kanban-table-row border-b transition-colors cursor-pointer group ${
                            isSelected ? 'bg-blue-50/50' : 'bg-white hover:bg-gray-50'
                        }`}
                    >
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <div 
                                onClick={() => onToggleTaskSelection && onToggleTaskSelection(task.id)}
                                className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${
                                    isSelected 
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                                        : 'bg-white border-gray-300 text-transparent hover:border-blue-400'
                                }`}
                            >
                                <Check size={14} strokeWidth={4} />
                            </div>
                        </td>
                        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => onToggleCheck(task.id)} className="btn-toggle-check text-gray-400 hover:text-green-600 transition">
                            {task.isCompleted ? <CheckCircle2 className="text-green-600" size={20} /> : <Circle size={20} />}
                        </button>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">
                            <div className={`task-title ${task.isCompleted ? "line-through text-gray-400" : ""}`}>{task.title}</div>
                            {totalSubtasks > 0 && (
                                <div className="task-subtasks text-xs text-blue-500 flex items-center gap-1 mt-0.5">
                                    <CheckCircle2 size={10} /> {completedSubtasks}/{totalSubtasks} subtasks
                                </div>
                            )}
                            <div className="task-desc text-xs text-gray-400 truncate max-w-[200px] mt-0.5">{task.description}</div>
                        </td>
                         <td className="px-6 py-4">
                             {task.assignee ? (
                                 <div className="flex items-center gap-2">
                                     <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold border border-blue-200">
                                         {getInitials(task.assignee)}
                                     </div>
                                     <span className="truncate max-w-[100px]">{task.assignee}</span>
                                 </div>
                             ) : <span className="text-gray-300">-</span>}
                         </td>
                         <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                             {task.media && task.media.length > 0 ? (
                                 <a href={task.media[0]} target="_blank" rel="noopener noreferrer" className="task-media-link text-blue-500 hover:text-blue-700 block relative">
                                     {task.media[0].match(/\.(jpeg|jpg|gif|png|webp)|data:image/i) ? (
                                         <div className="w-8 h-8 rounded overflow-hidden border border-gray-200">
                                            <img src={task.media[0]} alt="Thumb" className="w-full h-full object-cover" />
                                            {task.media.length > 1 && (
                                                <div className="absolute -bottom-1 -right-1 bg-black/70 text-white text-[8px] px-1 rounded-sm font-bold">
                                                    +{task.media.length - 1}
                                                </div>
                                            )}
                                         </div>
                                     ) : <ImageIcon size={20} />}
                                 </a>
                             ) : <span className="text-gray-300">-</span>}
                         </td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <div className="w-[140px]">
                                <SearchableSelect
                                    value={getStatusLabel(task.status)}
                                    onChange={(val) => {
                                        const col = columns.find(c => c.title === val);
                                        if (col) onUpdateStatus(task.id, col.id);
                                    }}
                                    options={columns.map(c => c.title)}
                                    optionStyles={columns.reduce((acc, col) => ({ 
                                      ...acc, 
                                      [col.title]: { bg: `${col.color}20`, text: col.color } 
                                    }), {})}
                                    size="sm"
                                    showSearch={false}
                                    className="!border-none"
                                />
                            </div>
                        </td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <div className="w-[120px]">
                                <SearchableSelect
                                    value={task.priority}
                                    onChange={(val) => onUpdatePriority(task.id, val as Priority)}
                                    options={Object.values(Priority)}
                                    optionStyles={prioritySettings}
                                    size="sm"
                                    showSearch={false}
                                />
                            </div>
                        </td>
                         <td className="px-6 py-4">
                            {task.dueDate ? (
                                <div className="task-due-date flex items-center gap-2">
                                    <Calendar size={14} className="text-gray-400" />
                                    <span className={new Date(task.dueDate) < new Date() && !task.isCompleted ? 'text-red-500 font-medium' : ''}>
                                        {new Date(task.dueDate).toLocaleDateString()}
                                    </span>
                                </div>
                            ) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-6 py-4">{task.category}</td>
                        <td className="px-6 py-4">{task.project}</td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="table-actions flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={(e) => handleShare(e, task.id)} 
                                    className={`p-1.5 rounded-lg transition-colors ${sharingTaskId === task.id ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:bg-blue-100 hover:text-blue-600'}`}
                                    title="Copy link"
                                >
                                    {sharingTaskId === task.id ? <Check size={16} /> : <Share2 size={16} />}
                                </button>
                                <button onClick={() => onEdit(task)} className="btn-edit-task p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition">
                                    <Edit2 size={16} />
                                </button>
                                <button onClick={() => onDelete(task.id)} className="btn-delete-task p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </td>
                    </tr>
                  )
                })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TableView;