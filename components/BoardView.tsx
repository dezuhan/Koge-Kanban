import React from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, defaultDropAnimationSideEffects, closestCorners } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, Column, PrioritySettings } from '../types';
import { TaskCard } from './TaskCard';
import { Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react';

interface BoardViewProps {
  tasks: Task[];
  columns: Column[];
  onTaskMove: (taskId: string, newStatus: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onToggleCheck: (id: string) => void;
  onAddColumn: () => void;
  onEditColumn: (column: Column) => void;
  onDeleteColumn: (id: string) => void;
  onColumnMove: (activeId: string, overId: string) => void;
  onAddTask: (columnId: string) => void;
  prioritySettings: PrioritySettings;
}

const SortableColumn = ({ 
    column, 
    tasks, 
    onEditTask, 
    onDeleteTask, 
    onToggleCheck, 
    prioritySettings,
    onEditColumn,
    onDeleteColumn,
    onAddTask
}: { 
    column: Column, 
    tasks: Task[], 
    onEditTask: any, 
    onDeleteTask: any, 
    onToggleCheck: any, 
    prioritySettings: PrioritySettings,
    onEditColumn: (c: Column) => void,
    onDeleteColumn: (id: string) => void,
    onAddTask: (id: string) => void
}) => {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'Column', column }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [showMenu, setShowMenu] = React.useState(false);

  // Calculate a very light background color based on the column color
  // Assuming hex, append '15' for approx 8% opacity or '20' for 12%
  const columnBgStyle = {
      backgroundColor: column.color + '15', 
      borderColor: column.color + '30'
  };

  return (
    <div 
        ref={setNodeRef} 
        style={{...style, ...columnBgStyle}}
        className={`kanban-column flex flex-col h-full min-w-[280px] w-80 rounded-xl transition-colors border`}
    >
      <div 
        className="kanban-column-header p-3 font-semibold text-gray-700 flex justify-between items-center border-b border-gray-200/50 group relative cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <div className="flex items-center gap-2 flex-1">
            <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: column.color }}></span>
            <span className="truncate max-w-[150px]" title={column.title}>{column.title}</span>
             <span className="bg-white/60 text-gray-600 text-xs px-2 py-0.5 rounded-full">
              {tasks.length}
            </span>
        </div>
        
        <div className="kanban-column-actions flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
             <button 
                onClick={(e) => { e.stopPropagation(); onAddTask(column.id); }}
                className="btn-add-task p-1 hover:bg-white/50 text-gray-500 hover:text-red-600 rounded transition"
                title="Add Task to this Column"
            >
                <Plus size={18} />
            </button>
            <div className="relative menu-container">
                <button 
                    onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                    className="btn-column-menu p-1 hover:bg-white/50 rounded text-gray-500 hover:text-gray-700 transition"
                >
                    <MoreHorizontal size={18} />
                </button>
                {showMenu && (
                    <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
                    <div className="column-menu-dropdown absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-100 z-20 w-32 py-1 flex flex-col cursor-default" onClick={(e) => e.stopPropagation()}>
                        <button 
                            onClick={() => { setShowMenu(false); onEditColumn(column); }}
                            className="btn-edit-column flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 text-left w-full"
                        >
                            <Edit size={14} /> Edit
                        </button>
                        <button 
                            onClick={() => { setShowMenu(false); onDeleteColumn(column.id); }}
                            className="btn-delete-column flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left w-full"
                        >
                            <Trash2 size={14} /> Delete
                        </button>
                    </div>
                    </>
                )}
            </div>
        </div>
      </div>
      <div className="kanban-column-body flex-1 p-2 space-y-3 overflow-y-auto">
        {tasks.map((task) => (
          <TaskCard 
            key={task.id} 
            task={task} 
            onEdit={onEditTask} 
            onDelete={onDeleteTask}
            onToggleCheck={onToggleCheck}
            prioritySettings={prioritySettings}
          />
        ))}
        {tasks.length === 0 && (
            <div className="kanban-column-empty h-24 border-2 border-dashed border-gray-300/30 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                Empty
            </div>
        )}
      </div>
    </div>
  );
};

const BoardView: React.FC<BoardViewProps> = ({ 
    tasks, 
    columns, 
    onTaskMove, 
    onEditTask, 
    onDeleteTask, 
    onToggleCheck, 
    onAddColumn, 
    onEditColumn, 
    onDeleteColumn, 
    onColumnMove, 
    onAddTask,
    prioritySettings 
}) => {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [activeItem, setActiveItem] = React.useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    if (event.active.data.current) {
        setActiveItem(event.active.data.current);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveItem(null);

    if (!over) return;

    const activeType = active.data.current?.type;
    
    // Handle Column Reorder
    if (activeType === 'Column' && active.id !== over.id) {
        onColumnMove(active.id as string, over.id as string);
        return;
    }

    // Handle Task Move
    if (activeType === 'Task') {
        let containerId = over.id as string;

        // If dropping on a column directly
        const isOverColumn = columns.some(c => c.id === containerId);
        
        if (!isOverColumn) {
             // If dropping on another task, find the task's status
             const overTask = tasks.find(t => t.id === containerId);
             if (overTask) {
                 containerId = overTask.status;
             }
        }

        // Verify we found a valid column ID
        if (columns.some(c => c.id === containerId) && containerId !== active.data.current?.task.status) {
            onTaskMove(active.id as string, containerId);
        }
    }
  };

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  return (
    <DndContext 
        sensors={sensors} 
        onDragStart={handleDragStart} 
        onDragEnd={handleDragEnd}
        collisionDetection={closestCorners}
    >
      <div className="kanban-board flex h-full gap-4 overflow-x-auto pb-4 items-start">
        <SortableContext items={columns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            {columns.map((column) => (
            <SortableColumn 
                key={column.id} 
                column={column} 
                tasks={tasks.filter((t) => t.status === column.id)}
                onEditTask={onEditTask}
                onDeleteTask={onDeleteTask}
                onToggleCheck={onToggleCheck}
                prioritySettings={prioritySettings}
                onEditColumn={onEditColumn}
                onDeleteColumn={onDeleteColumn}
                onAddTask={onAddTask}
            />
            ))}
        </SortableContext>
        
        {/* Add Column Button */}
        <button 
            onClick={onAddColumn}
            className="kanban-add-column-btn min-w-[50px] h-[50px] flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all group shrink-0"
            title="Add more table (column)"
        >
            <Plus size={24} className="transition-transform group-hover:scale-110" />
        </button>
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeId ? (
            activeItem?.type === 'Column' ? (
                <div className="flex flex-col h-[500px] w-80 rounded-xl bg-white shadow-xl opacity-90 border-2 border-blue-500 p-3">
                     <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: activeItem.column.color }}></span>
                        <span className="font-bold text-gray-800">{activeItem.column.title}</span>
                     </div>
                </div>
            ) : (
                <div className="transform rotate-3 cursor-grabbing">
                    <TaskCard 
                        task={activeItem?.task} 
                        onEdit={() => {}} 
                        onDelete={() => {}} 
                        onToggleCheck={() => {}} 
                        prioritySettings={prioritySettings}
                    />
                </div>
            )
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default BoardView;