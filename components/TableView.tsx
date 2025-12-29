import React from 'react';
import { Task, PrioritySettings, Column } from '../types';
import { Edit2, Trash2, CheckCircle2, Circle, Calendar, Image as ImageIcon, User } from 'lucide-react';

interface TableViewProps {
  tasks: Task[];
  columns: Column[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onToggleCheck: (id: string) => void;
  prioritySettings: PrioritySettings;
}

const TableView: React.FC<TableViewProps> = ({ tasks, columns, onEdit, onDelete, onToggleCheck, prioritySettings }) => {
  
  const getStatusStyle = (statusId: string) => {
    const col = columns.find(c => c.id === statusId);
    if (col) {
        return { backgroundColor: `${col.color}20`, color: col.color, borderColor: col.color }; // hex + 20 for opacity
    }
    return { backgroundColor: '#f3f4f6', color: '#374151', borderColor: '#d1d5db' };
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
    <div className="kanban-table-container overflow-hidden bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="overflow-x-auto">
        <table className="kanban-table w-full text-sm text-left text-gray-500">
          <thead className="kanban-table-head text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
            <tr>
              <th scope="col" className="px-6 py-4 w-12">Done</th>
              <th scope="col" className="px-6 py-4">Task Name</th>
              <th scope="col" className="px-6 py-4">Assignee</th>
              <th scope="col" className="px-6 py-4">Media</th>
              <th scope="col" className="px-6 py-4">Status</th>
              <th scope="col" className="px-6 py-4">Priority</th>
              <th scope="col" className="px-6 py-4">Due Date</th>
              <th scope="col" className="px-6 py-4">Category</th>
              <th scope="col" className="px-6 py-4">Project</th>
              <th scope="col" className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="kanban-table-body">
            {tasks.length === 0 ? (
                <tr>
                    <td colSpan={10} className="px-6 py-8 text-center text-gray-400">
                        No tasks found in this view.
                    </td>
                </tr>
            ) : (
                tasks.map((task) => {
                  const completedSubtasks = task.subTasks?.filter(st => st.isCompleted).length || 0;
                  const totalSubtasks = task.subTasks?.length || 0;
                  const priorityStyle = prioritySettings[task.priority];
                  const statusStyle = getStatusStyle(task.status);

                  return (
                    <tr key={task.id} className="kanban-table-row bg-white border-b hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
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
                         <td className="px-6 py-4">
                             {task.media ? (
                                 <a href={task.media} target="_blank" rel="noopener noreferrer" className="task-media-link text-blue-500 hover:text-blue-700 block">
                                     {task.media.match(/\.(jpeg|jpg|gif|png|webp)|data:image/i) ? (
                                         <div className="w-8 h-8 rounded overflow-hidden border border-gray-200">
                                            <img src={task.media} alt="Thumb" className="w-full h-full object-cover" />
                                         </div>
                                     ) : <ImageIcon size={20} />}
                                 </a>
                             ) : <span className="text-gray-300">-</span>}
                         </td>
                        <td className="px-6 py-4">
                            <span 
                                className="task-status px-2 py-1 rounded-full text-xs font-semibold border"
                                style={{
                                    backgroundColor: statusStyle.backgroundColor,
                                    color: statusStyle.color,
                                    borderColor: 'transparent'
                                }}
                            >
                                {getStatusLabel(task.status)}
                            </span>
                        </td>
                        <td className="px-6 py-4">
                            <span 
                                className="task-priority px-2 py-1 rounded-md text-xs font-semibold border"
                                style={{ 
                                    backgroundColor: priorityStyle.bg, 
                                    color: priorityStyle.text,
                                    borderColor: priorityStyle.bg 
                                }}
                            >
                                {task.priority}
                            </span>
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
                        <td className="px-6 py-4 text-right">
                            <div className="table-actions flex justify-end gap-2">
                                <button onClick={() => onEdit(task)} className="btn-edit-task p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition">
                                    <Edit2 size={16} />
                                </button>
                                <button onClick={() => onDelete(task.id)} className="btn-delete-task p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </td>
                    </tr>
                )})
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TableView;