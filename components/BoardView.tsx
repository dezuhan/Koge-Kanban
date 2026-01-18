import React from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, defaultDropAnimationSideEffects, closestCorners, DragOverEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, Column, PrioritySettings } from '../types';
import { TaskCard } from './TaskCard';
import { SortableTask } from './SortableTask';
import { Plus, MoreHorizontal, Edit, Trash2, Check, ChevronLeft, ChevronRight } from 'lucide-react';

interface BoardViewProps {
  tasks: Task[];
  columns: Column[];
  onTaskMove: (taskId: string, newStatus: string) => void;
  onTaskReorder?: (newTasks: Task[]) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onDuplicateTask: (task: Task) => void;
  onToggleCheck: (id: string) => void;
  onAddColumn: () => void;
  onEditColumn: (column: Column) => void;
  onDeleteColumn: (id: string) => void;
  onColumnMove: (activeId: string, overId: string) => void;
  onAddTask: (columnId: string) => void;
  prioritySettings: PrioritySettings;
  isDragEnabled?: boolean;
  selectedTaskIds?: string[];
  onToggleTaskSelection?: (taskId: string) => void;
  onSetSelection?: (ids: string[]) => void;
  projectId?: string;
}

type ActiveDragItem = 
  | { type: 'Column'; column: Column }
  | { type: 'Task'; task: Task };

const SortableColumn = ({ 
    column, 
    tasks, 
    onEditTask, 
    onDeleteTask, 
    onDuplicateTask,
    onToggleCheck, 
    prioritySettings,
    onEditColumn,
    onDeleteColumn,
    onAddTask,
    selectedTaskIds = [],
    onToggleTaskSelection,
    onSetSelection,
    activeId,
    index,
    isFirst,
    isLast,
    onMoveLeft,
    onMoveRight,
    projectId
}: { 
    column: Column, 
    tasks: Task[], 
    onEditTask: (task: Task) => void, 
    onDeleteTask: (id: string) => void, 
    onDuplicateTask: (task: Task) => void,
    onToggleCheck: (id: string) => void, 
    prioritySettings: PrioritySettings,
    onEditColumn: (c: Column) => void,
    onDeleteColumn: (id: string) => void,
    onAddTask: (id: string) => void,
    selectedTaskIds?: string[],
    onToggleTaskSelection?: (taskId: string) => void,
    onSetSelection?: (ids: string[]) => void,
    activeId: string | null,
    index: number,
    isFirst: boolean,
    isLast: boolean,
    onMoveLeft: () => void,
    onMoveRight: () => void,
    projectId?: string
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

  const columnBgStyle = {
      backgroundColor: column.color + '15', 
      borderColor: column.color + '30'
  };

  // Select all logic
  const columnTaskIds = tasks.map(t => t.id);
  const allSelected = columnTaskIds.length > 0 && columnTaskIds.every(id => selectedTaskIds.includes(id));
  const someSelected = columnTaskIds.some(id => selectedTaskIds.includes(id)) && !allSelected;

  const handleSelectAll = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onSetSelection) return;

      if (allSelected) {
          // Deselect all in this column
          onSetSelection(selectedTaskIds.filter(id => !columnTaskIds.includes(id)));
      } else {
          // Select all in this column + keep existing from other columns
          const otherSelected = selectedTaskIds.filter(id => !columnTaskIds.includes(id));
          onSetSelection([...otherSelected, ...columnTaskIds]);
      }
  };

  return (
    <div 
        ref={setNodeRef} 
        style={{...style, ...columnBgStyle}}
        className={`kanban-column flex flex-col h-full min-w-[280px] w-80 rounded-lg transition-colors border`}
    >
      <div 
        className="kanban-column-header p-3 font-semibold text-gray-700 flex justify-between items-center border-b border-gray-200/50 group relative cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <div className="flex items-center gap-2 flex-1">
            {/* Select All Checkbox */}
            <div 
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleSelectAll}
                className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${
                    allSelected 
                        ? 'bg-blue-600 border-blue-600 text-white' 
                        : someSelected 
                            ? 'bg-blue-50 border-blue-400 text-blue-600'
                            : 'bg-white border-gray-300 text-transparent hover:border-blue-400'
                }`}
                title={allSelected ? "Deselect All" : "Select All in Column"}
            >
                {allSelected ? <Check size={10} strokeWidth={4} /> : someSelected ? <div className="w-2 h-0.5 bg-blue-600 rounded-full" /> : null}
            </div>

            <span className="w-3 h-3 rounded-full shadow-sm ml-1" style={{ backgroundColor: column.color }}></span>
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
                        
                        <div className="h-px bg-gray-100 my-1" />
                        
                        <button 
                            disabled={isFirst}
                            onClick={() => { setShowMenu(false); onMoveLeft(); }}
                            className={`flex items-center gap-2 px-3 py-2 text-sm text-left w-full ${isFirst ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <ChevronLeft size={14} /> Move Left
                        </button>
                        <button 
                            disabled={isLast}
                            onClick={() => { setShowMenu(false); onMoveRight(); }}
                            className={`flex items-center gap-2 px-3 py-2 text-sm text-left w-full ${isLast ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <ChevronRight size={14} /> Move Right
                        </button>

                        <div className="h-px bg-gray-100 my-1" />

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
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => {
                // Multi-drag smoothing: Hide other selected tasks while dragging one of them
                const isPartOfMultiDrag = selectedTaskIds?.includes(task.id) && 
                                         selectedTaskIds?.includes(activeId as string) && 
                                         task.id !== activeId;
                
                return (
                    <div 
                        key={task.id} 
                        style={{ 
                            opacity: isPartOfMultiDrag ? 0 : 1, 
                            transform: isPartOfMultiDrag ? 'scale(0.8) translateY(-10px)' : 'scale(1) translateY(0)',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            pointerEvents: isPartOfMultiDrag ? 'none' : 'auto'
                        }}
                    >
                        <SortableTask 
                            task={task} 
                            onEdit={onEditTask} 
                            onDelete={onDeleteTask}
                            onDuplicate={onDuplicateTask}
                            onToggleCheck={onToggleCheck}
                            prioritySettings={prioritySettings}
                            selectedTaskIds={selectedTaskIds}
                            onToggleTaskSelection={onToggleTaskSelection}
                            projectId={projectId}
                        />
                    </div>
                );
            })}
        </SortableContext>
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
    onDuplicateTask,
    onToggleCheck, 
    onAddColumn, 
    onEditColumn,
    onDeleteColumn,
    onColumnMove,
    onAddTask,
    prioritySettings,
    isDragEnabled = true,
    onTaskReorder,
    selectedTaskIds = [],
    onToggleTaskSelection,
    onSetSelection,
    projectId
}) => {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [activeItem, setActiveItem] = React.useState<ActiveDragItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (!isDragEnabled) return;
    setActiveId(event.active.id as string);
    if (event.active.data.current) {
        setActiveItem(event.active.data.current as ActiveDragItem);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === 'Task';
    const isOverTask = over.data.current?.type === 'Task';

    if (!isActiveTask) return;

    // Moving task over another task
    if (isActiveTask && isOverTask) {
        const activeTask = active.data.current!.task as Task;
        const overTask = over.data.current!.task as Task;

        if (activeTask.status !== overTask.status) {
             // Handle multi-drag: If active task is selected, move all selected tasks
             if (selectedTaskIds.includes(activeTask.id)) {
                 selectedTaskIds.forEach(id => {
                     const task = tasks.find(t => t.id === id);
                     if (task && task.status !== overTask.status) {
                         onTaskMove(id, overTask.status);
                     }
                 });
             } else {
                 onTaskMove(activeTask.id, overTask.status);
             }
        }
    }

    // Moving task over a column
    const isOverColumn = over.data.current?.type === 'Column';
    if (isActiveTask && isOverColumn) {
        const activeTask = active.data.current!.task as Task;
        const columnId = overId as string;
        if (activeTask.status !== columnId) {
            if (selectedTaskIds.includes(activeTask.id)) {
                selectedTaskIds.forEach(id => {
                    const task = tasks.find(t => t.id === id);
                    if (task && task.status !== columnId) {
                        onTaskMove(id, columnId);
                    }
                });
            } else {
                onTaskMove(activeTask.id, columnId);
            }
        }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveItem(null);

    if (!over) return;

    const activeType = active.data.current?.type;
    
    if (activeType === 'Column' && active.id !== over.id) {
        onColumnMove(active.id as string, over.id as string);
        return;
    }

    if (activeType === 'Task') {
        const activeTask = active.data.current!.task as Task;
        const overId = over.id as string;
        const isMultiDragging = selectedTaskIds.includes(activeTask.id);
        
        const isOverColumn = columns.some(c => c.id === overId);
        if (isOverColumn) {
             if (isMultiDragging) {
                 selectedTaskIds.forEach(id => {
                     if (tasks.find(t => t.id === id)?.status !== overId) {
                         onTaskMove(id, overId);
                     }
                 });
             } else if (activeTask.status !== overId) {
                 onTaskMove(activeTask.id, overId);
             }
             return;
        }

        const overTask = tasks.find(t => t.id === overId);
        if (overTask) {
            if (activeTask.status !== overTask.status) {
                if (isMultiDragging) {
                    selectedTaskIds.forEach(id => {
                        if (tasks.find(t => t.id === id)?.status !== overTask.status) {
                            onTaskMove(id, overTask.status);
                        }
                    });
                } else {
                    onTaskMove(activeTask.id, overTask.status);
                }
            } else {
                // Reorder in same column
                if (onTaskReorder && active.id !== over.id) {
                    if (isMultiDragging) {
                        const otherSelectedIds = selectedTaskIds.filter(id => id !== activeTask.id);
                        const filteredTasks = tasks.filter(t => !otherSelectedIds.includes(t.id));
                        
                        const oldIndex = filteredTasks.findIndex((t) => t.id === active.id);
                        const newIndex = filteredTasks.findIndex((t) => t.id === over.id);
                        
                        if (oldIndex !== -1 && newIndex !== -1) {
                             const movedTasks = arrayMove(filteredTasks, oldIndex, newIndex);
                             const activeIdx = movedTasks.findIndex(t => t.id === activeTask.id);
                             const finalTasks = [...movedTasks];
                             const otherTasks = tasks.filter(t => otherSelectedIds.includes(t.id));
                             finalTasks.splice(activeIdx + 1, 0, ...otherTasks);
                             onTaskReorder(finalTasks);
                        }
                    } else {
                        const oldIndex = tasks.findIndex((t) => t.id === active.id);
                        const newIndex = tasks.findIndex((t) => t.id === over.id);
                        if (oldIndex !== -1 && newIndex !== -1) {
                             const newTasks = arrayMove(tasks, oldIndex, newIndex);
                             onTaskReorder(newTasks);
                        }
                    }
                }
            }
        }
    }
  };

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '1',
        },
      },
    }),
  };

  const isMultiDragging = activeItem?.type === 'Task' && selectedTaskIds.includes(activeItem.task.id) && selectedTaskIds.length > 1;

  return (
    <DndContext 
        sensors={sensors} 
        onDragStart={handleDragStart} 
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        collisionDetection={closestCorners}
    >
      <div className="kanban-board flex-1 min-h-0 flex gap-4 overflow-x-auto pb-4 items-start">
        <SortableContext items={columns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            {columns.map((column, idx) => (
            <SortableColumn 
                key={column.id} 
                column={column} 
                tasks={tasks.filter((t) => t.status === column.id)}
                onEditTask={onEditTask}
                onDeleteTask={onDeleteTask}
                onDuplicateTask={onDuplicateTask}
                onToggleCheck={onToggleCheck}
                prioritySettings={prioritySettings}
                onEditColumn={onEditColumn}
                onDeleteColumn={onDeleteColumn}
                onAddTask={onAddTask}
                selectedTaskIds={selectedTaskIds}
                onToggleTaskSelection={onToggleTaskSelection}
                onSetSelection={onSetSelection}
                activeId={activeId}
                index={idx}
                isFirst={idx === 0}
                isLast={idx === columns.length - 1}
                onMoveLeft={() => idx > 0 && onColumnMove(column.id, columns[idx - 1].id)}
                onMoveRight={() => idx < columns.length - 1 && onColumnMove(column.id, columns[idx + 1].id)}
                projectId={projectId}
            />
            ))}
        </SortableContext>
        
        <button 
            onClick={onAddColumn}
            className="kanban-add-column-btn min-w-[50px] h-[50px] flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all group shrink-0"
            title="Add more table (column)"
        >
            <Plus size={24} className="transition-transform group-hover:scale-110" />
        </button>
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeId && activeItem ? (
            activeItem.type === 'Column' ? (
                <div className="flex flex-col h-[500px] w-80 rounded-lg bg-white shadow-xl opacity-90 border-2 border-blue-500 p-3">
                     <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: activeItem.column.color }}></span>
                        <span className="font-bold text-gray-800">{activeItem.column.title}</span>
                     </div>
                </div>
            ) : (
                <div className="relative transform rotate-2 cursor-grabbing transition-transform duration-200">
                    {isMultiDragging && (
                        <>
                            {/* Visual Stack effect */}
                            <div className="absolute inset-0 bg-white border border-gray-200 rounded-lg shadow-md -translate-x-2 -translate-y-2 rotate-[-4deg] opacity-40 z-[-2]"></div>
                            <div className="absolute inset-0 bg-white border border-gray-200 rounded-lg shadow-md -translate-x-1 -translate-y-1 rotate-[-2deg] opacity-70 z-[-1]"></div>
                            
                            {/* Multi-drag Badge (Image 4 style) */}
                            <div className="absolute -top-4 -right-4 bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-in zoom-in duration-300 z-10">
                                <span className="text-lg font-black">{selectedTaskIds.length}</span>
                            </div>
                        </>
                    )}
                    <TaskCard 
                        task={activeItem.task} 
                        onEdit={() => {}} 
                        onDelete={() => {}} 
                        onDuplicate={() => {}}
                        onToggleCheck={() => {}} 
                        prioritySettings={prioritySettings}
                        selectedTaskIds={selectedTaskIds}
                        onToggleTaskSelection={onToggleTaskSelection}
                        projectId={projectId}
                    />
                </div>
            )
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default BoardView;