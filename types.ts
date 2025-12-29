
export enum Priority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
}

export interface Column {
  id: string;
  title: string;
  color: string;
}

export interface SubTask {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string; 
  priority: Priority;
  category: string;
  project: string;
  isCompleted: boolean;
  createdAt: number;
  dueDate: number | null;
  media?: string; // URL or Base64 string
  assignee?: string;
  subTasks: SubTask[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  taskCount?: number; // Optional helper for UI
}

export type SortOption = 'date' | 'priority' | 'category' | 'status' | 'dueDate' | 'none';

export interface PriorityColor {
  bg: string;
  text: string;
}

export type PrioritySettings = Record<Priority, PriorityColor>;
