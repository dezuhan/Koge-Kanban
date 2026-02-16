import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, PrioritySettings } from '../types';
import { TaskCard } from './TaskCard';

interface SortableTaskProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onDuplicate: (task: Task) => void;
  onToggleCheck: (id: string) => void;
  prioritySettings: PrioritySettings;
  selectedTaskIds?: string[];
  onToggleTaskSelection?: (taskId: string) => void;
  projectId?: string;
  isReadOnly?: boolean;
}

export const SortableTask: React.FC<SortableTaskProps> = (props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props.task.id,
    data: {
      type: 'Task',
      task: props.task,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <TaskCard
      {...props}
      setNodeRef={setNodeRef}
      style={style}
      attributes={attributes}
      listeners={listeners}
      isDragging={isDragging}
    />
  );
};
