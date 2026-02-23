import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { db } from '../services/db';
import { Task, Column, Priority, SortOption, Project } from '../types';
import BoardView from '../components/BoardView';
import TableView from '../components/TableView';
import TaskModal from '../components/TaskModal';
import ConfirmModal from '../components/ConfirmModal';
import ColumnModal from '../components/ColumnModal';
import SummaryModal from '../components/SummaryModal';
import { SearchableSelect } from '../components/SearchableSelect';
import { Plus, Layout, List, Filter, Settings, ChevronLeft, ChevronDown, Edit2, Loader2, Activity, ArrowUpDown, Calendar, AlertCircle, MessageSquare, Wand2, ToggleLeft, ToggleRight, Sparkles, Trash2, Folder, Tag, SlidersHorizontal, Search } from 'lucide-react';
import { OllamaIcon } from '../components/OllamaIcon';

import ProjectModal from '../components/ProjectModal';
import { getProjectSummaryPrompt } from '../fine-tunning/summary/report-prompt';

// Required Template Columns
const TEMPLATE_COLUMNS: Column[] = [
  { id: 'Draft', title: 'DRAFT', color: '#94a3b8' },
  { id: 'To Do', title: 'TO-DO', color: '#f59e0b' },
  { id: 'On Going', title: 'ON GOING', color: '#3b82f6' },
  { id: 'Complete', title: 'COMPLETE', color: '#22c55e' }
];

const BoardPage: React.FC = () => {
  const { projectId, taskId } = useParams();
  const navigate = useNavigate();
  const {
    projects,
    setProjects,
    prioritySettings,
    setPrioritySettings,
    isAIEnabled,
    toggleAI,
    disableAI,
    activeModel,
    isChatOpen,
    setIsChatOpen,
    isSearchOpen,
    setIsSearchOpen,
    setCurrentContext,
    boardRefreshTrigger,
    ollamaEndpoint,
    isOllamaOnline,
    confirm: globalConfirm,
    alert: globalAlert
  } = useApp();

  // Ref to block deep link effect during save operations to prevent modal reopening
  const isSavingRef = React.useRef(false);
  // Track last loaded project to enable silent refreshes
  const lastLoadedProjectId = useRef<string | null>(null);

  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');

  // Track state for changes
  const lastSavedTasks = useRef<string>('');
  const lastSavedColumns = useRef<string>('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isTogglingAI, setIsTogglingAI] = useState(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);

  const { isAILoading } = useApp();
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState<string>('');
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);

  // Multi-select state
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const isMultiSelectActive = selectedTaskIds.length > 0;

  // Filters
  const [filterProject, setFilterProject] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('none');

  // 1. Resolve Project from URL
  useEffect(() => {
    console.log(`[BoardPage] Resolving Project ID: ${projectId}`);
    console.log(`[BoardPage] Available Projects:`, projects);

    if (!projects || projects === null) return;

    const proj = projects.find(p => p.id === projectId);

    if (proj) {
      console.log(`[BoardPage] Found Project:`, proj);
      setCurrentProject(proj);
      // Reset filters when project changes
      setFilterProject('All');
      setFilterCategory('All');
      setSortBy('none');
    } else {

      console.log(`[BoardPage] Project NOT found.`);
      if (projects && projects.length > 0) {
        console.warn(`[BoardPage] Redirecting to home because project list is populated but ID not found.`);
        navigate('/');
      } else {
        console.log(`[BoardPage] Waiting for projects to load...`);
      }
    }
  }, [projectId, projects, navigate]);

  // Real-time: Join project room
  useEffect(() => {
    if (currentProject) {
      db.joinProject(currentProject.id);
    }
  }, [currentProject]);

  // 2. Load Board Data
  useEffect(() => {
    if (!currentProject) return;

    const loadBoardData = async () => {
      const isInitialProjectLoad = lastLoadedProjectId.current !== currentProject.id;

      if (isInitialProjectLoad) {
        setBoardLoading(true);
      }

      try {
        const [pTasks, pColumns] = await Promise.all([
          db.getTasks(currentProject.id),
          db.getColumns(currentProject.id)
        ]);
        setTasks(prev => {
          const next = pTasks || [];
          lastSavedTasks.current = JSON.stringify(next);
          return next;
        });
        setColumns(prev => {
          const next = (pColumns && pColumns.length > 0) ? pColumns : TEMPLATE_COLUMNS;
          lastSavedColumns.current = JSON.stringify(next);
          return next;
        });

        // Update Context for AI
        if (currentProject) {
          setCurrentContext({
            projectId: currentProject.id,
            projectName: currentProject.name,
            tasks: pTasks || [],
            columns: (pColumns && pColumns.length > 0) ? pColumns : TEMPLATE_COLUMNS
          });
        }

        lastLoadedProjectId.current = currentProject.id;
      } catch (err) {
        console.error("Failed to load project data", err);
      } finally {
        if (isInitialProjectLoad) {
          setBoardLoading(false);
        }
      }
    };
    loadBoardData();
  }, [currentProject, boardRefreshTrigger]);

  // 3. Handle Deep Linking for Task (Open Modal)
  useEffect(() => {
    // If we are currently saving, skip this effect to prevent race condition re-opening
    if (isSavingRef.current) return;

    if (taskId && tasks.length > 0 && !isModalOpen) {
      const targetTask = tasks.find(t => t.id === taskId);
      if (targetTask) {
        setEditingTask(targetTask);
        setIsModalOpen(true);
      }
    }
  }, [taskId, tasks]);

  // Close modal handler (clears URL param)
  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Navigate back to board root without task ID
    navigate(`/board/${projectId}`);
  };


  const isReadOnly = useMemo(() => {
    return currentProject?.isShared && currentProject.permissions === 'view';
  }, [currentProject]);

  // Persist Tasks/Columns
  useEffect(() => {
    if (currentProject && !boardLoading && !isReadOnly) {
      const tasksStr = JSON.stringify(tasks);
      if (tasksStr !== lastSavedTasks.current) {
        db.saveTasks(currentProject.id, tasks);
        lastSavedTasks.current = tasksStr;
      }
      // Update Context Live
      setCurrentContext(prev => prev ? { ...prev, tasks } : null);
    }
  }, [tasks, currentProject, boardLoading, setCurrentContext, isReadOnly]);

  useEffect(() => {
    if (currentProject && !boardLoading && !isReadOnly) {
      const columnsStr = JSON.stringify(columns);
      if (columnsStr !== lastSavedColumns.current) {
        db.saveColumns(currentProject.id, columns);
        lastSavedColumns.current = columnsStr;
      }
      // Update Context Live
      setCurrentContext(prev => prev ? { ...prev, columns } : null);
    }
  }, [columns, currentProject, boardLoading, setCurrentContext, isReadOnly]);

  // Update refs when data is freshly loaded from DB
  useEffect(() => {
    if (!boardLoading && currentProject) {
      lastSavedTasks.current = JSON.stringify(tasks);
      lastSavedColumns.current = JSON.stringify(columns);
    }
  }, [boardLoading, currentProject]);

  // Computed lists
  const uniqueProjects = useMemo(() => ['All', ...new Set(tasks.map(t => t.project).filter(Boolean))], [tasks]);
  const uniqueCategories = useMemo(() => ['All', ...new Set(tasks.map(t => t.category).filter(Boolean))], [tasks]);

  // --- Handlers ---

  const handleSaveTask = (taskData: Omit<Task, 'id' | 'createdAt'> | Task) => {
    if (isReadOnly) return;
    if ('id' in taskData) {
      // Set saving flag to true to block deep link effect
      isSavingRef.current = true;
      setTasks(prev => prev.map(t => t.id === taskData.id ? { ...taskData } as Task : t));

      // Reset flag after a delay to allow navigation to complete
      setTimeout(() => {
        isSavingRef.current = false;
      }, 100);
    } else {
      const newTask: Task = {
        ...taskData,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      } as Task;
      setTasks(prev => [...prev, newTask]);
    }
  };

  const confirmDeleteTask = (id: string) => {
    setTaskToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteTask = async () => {
    if (isReadOnly) return;
    if (taskToDelete && projectId) {
      const taskObj = tasks.find(t => t.id === taskToDelete);
      if (taskObj) {
        await db.trash.addItem(`task:${projectId}:${taskToDelete}`, { ...taskObj, _projectId: projectId });
      }
      setTasks(prev => prev.filter(t => t.id !== taskToDelete));
      setTaskToDelete(null);
      setIsDeleteModalOpen(false);
    }
  };

  const handleDeleteSelectedTasks = () => {
    if (selectedTaskIds.length === 0) return;
    setIsBulkDeleteModalOpen(true);
  };

  const handleConfirmBulkDelete = async () => {
    if (isReadOnly) return;
    if (projectId) {
      const tasksToTrash = tasks.filter(t => selectedTaskIds.includes(t.id));
      await Promise.all(tasksToTrash.map(t =>
        db.trash.addItem(`task:${projectId}:${t.id}`, { ...t, _projectId: projectId })
      ));
    }
    setTasks(prev => prev.filter(t => !selectedTaskIds.includes(t.id)));
    setSelectedTaskIds([]);
    setIsBulkDeleteModalOpen(false);
  };

  const handleToggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleClearSelection = () => {
    setSelectedTaskIds([]);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    // Update URL to reflect task being edited (Deep link)
    navigate(`/board/${projectId}/task/${task.id}`);
    setIsModalOpen(true);
  };

  const handleDuplicateTask = (task: Task) => {
    if (isReadOnly) return;
    const duplicatedTask: Task = {
      ...task,
      id: crypto.randomUUID(),
      title: `Copy of ${task.title}`,
      createdAt: Date.now(),
      subTasks: task.subTasks ? task.subTasks.map(st => ({ ...st, id: crypto.randomUUID() })) : [],
      media: task.media ? [...task.media] : []
    };
    setTasks(prev => [...prev, duplicatedTask]);
  };

  const handleTaskMove = (taskId: string, newStatus: string) => {
    if (isReadOnly) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const handleTaskReorder = (newTasks: Task[]) => {
    if (isReadOnly) return;
    setTasks(newTasks);
  };

  const handleToggleCheck = (taskId: string) => {
    if (isReadOnly) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t));
  };

  const handleNewTask = () => {
    setEditingTask(null);
    setNewTaskStatus('');
    setIsModalOpen(true);
  };

  const handleAddTaskToColumn = (columnId: string) => {
    setEditingTask(null);
    setNewTaskStatus(columnId);
    setIsModalOpen(true);
  };

  const handleUpdateTaskStatus = (taskId: string, newStatus: string) => {
    if (isReadOnly) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const handleUpdateTaskPriority = (taskId: string, newPriority: Priority) => {
    if (isReadOnly) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority: newPriority } : t));
  };

  const handleUpdateProject = (updatedData: Pick<Project, 'id' | 'name' | 'description' | 'color'>) => {
    if (isReadOnly) return;
    if (currentProject && projects) {
      const updatedProject = { ...currentProject, ...updatedData };
      setCurrentProject(updatedProject);

      // Update in global list
      setProjects(prev => prev ? prev.map(p => p.id === updatedProject.id ? updatedProject : p) : null);

      // Persist to DB immediately
      db.saveProjects(projects.map(p => p.id === updatedProject.id ? updatedProject : p));
    }
  };

  // Column Handlers
  const handleAddColumn = () => {
    setEditingColumn(null);
    setIsColumnModalOpen(true);
  };

  const handleEditColumn = (column: Column) => {
    setEditingColumn(column);
    setIsColumnModalOpen(true);
  };

  const handleSaveColumn = (column: Column) => {
    if (isReadOnly) return;
    if (editingColumn) {
      setColumns(prev => prev.map(c => c.id === column.id ? column : c));
    } else {
      setColumns(prev => [...prev, column]);
    }
  };

  const handleDeleteColumn = (id: string) => {
    if (isReadOnly) return;
    if (columns.length <= 1) {
      globalAlert({
        title: 'Cannot Delete',
        message: 'You must have at least one column.',
        type: 'warning'
      });
      return;
    }

    globalConfirm({
      title: 'Delete Column?',
      message: 'Are you sure? This column and all tasks inside it will be moved to the Trash Bin.',
      type: 'danger',
      confirmText: 'Delete Column',
      onConfirm: async () => {
        const columnObj = columns.find(c => c.id === id);
        if (columnObj && projectId) {
          // Identify tasks in this column
          const columnTasks = tasks.filter(t => t.status === id);

          // Create a bundle for the trash
          const bundle = {
            column: columnObj,
            tasks: columnTasks,
            _projectId: projectId
          };

          await db.trash.addItem(`column_bundle_${projectId}:${id}`, bundle);

          // Remove the column and persist
          const newColumns = columns.filter(c => c.id !== id);
          setColumns(newColumns);
          await db.saveColumns(projectId, newColumns);

          // Remove the tasks from current view and persist
          const newTasks = tasks.filter(t => t.status !== id);
          setTasks(newTasks);
          await db.saveTasks(projectId, newTasks);
        }
      }
    });
  };

  const handleColumnMove = (activeId: string, overId: string) => {
    if (isReadOnly) return;
    setColumns(prev => {
      const oldIndex = prev.findIndex(c => c.id === activeId);
      const newIndex = prev.findIndex(c => c.id === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newCols = [...prev];
        const [moved] = newCols.splice(oldIndex, 1);
        newCols.splice(newIndex, 0, moved);
        return newCols;
      }
      return prev;
    });
  };

  // Filter & Sort Logic
  const processedTasks = useMemo(() => {
    let result = [...tasks];

    if (filterProject !== 'All') {
      result = result.filter(t => t.project === filterProject);
    }

    if (filterCategory !== 'All') {
      result = result.filter(t => t.category === filterCategory);
    }

    // Apply Sorting
    if (sortBy === 'priority') {
      const priorityOrder = { [Priority.HIGH]: 0, [Priority.MEDIUM]: 1, [Priority.LOW]: 2 };
      result.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    } else if (sortBy === 'dueDate') {
      // Tasks with due dates come first, sorted by date. Tasks without due dates come last.
      result.sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });
    }

    return result;
  }, [tasks, viewMode, filterProject, filterCategory, sortBy]);

  // Determine if Drag and Drop should be enabled
  // We allow dragging even if sorted/filtered to enable moving tasks between columns.
  // Reordering within the same column is disabled/ignored if sorted/filtered.
  const isDragEnabled = true;

  // Determine if manual reordering (same column) is allowed
  const isManualSort = useMemo(() => {
    return sortBy === 'none';
  }, [sortBy]);

  // --- Summary Logic ---
  const handleGenerateSummary = async () => {
    if (!tasks || tasks.length === 0) {
      setSummaryContent("No tasks available to analyze.");
      return;
    }

    setSummaryLoading(true);
    try {
      // 1. Gather Statistics
      const totalTasks = tasks.length;
      const byStatus = columns.reduce((acc, col) => {
        acc[col.title] = tasks.filter(t => t.status === col.id).length;
        return acc;
      }, {} as Record<string, number>);

      const byPriority = {
        High: tasks.filter(t => t.priority === Priority.HIGH).length,
        Medium: tasks.filter(t => t.priority === Priority.MEDIUM).length,
        Low: tasks.filter(t => t.priority === Priority.LOW).length,
      };

      const highPriorityPending = tasks.filter(t =>
        t.priority === Priority.HIGH && !t.isCompleted && t.status !== 'Complete'
      ).length;

      const overdueTasks = tasks.filter(t =>
        t.dueDate && t.dueDate < Date.now() && !t.isCompleted
      ).length;

      // 2. Construct Prompt
      const prompt = getProjectSummaryPrompt(
        currentProject?.name || 'Unknown Project',
        totalTasks,
        byStatus,
        byPriority,
        highPriorityPending,
        overdueTasks
      );

      // 3. Call AI
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ollama-endpoint': ollamaEndpoint,
          'Authorization': `Bearer ${localStorage.getItem('koge_auth_token')}`
        },
        body: JSON.stringify({ prompt, model: activeModel })
      });

      if (!response.ok) throw new Error("Failed to generate summary");

      const data = await response.json();
      setSummaryContent(data.response);

    } catch (error) {
      console.error("Summary Error:", error);
      setSummaryContent("Failed to generate summary. AI service disconnected.");
      globalAlert({
        title: 'AI Service Unreachable',
        message: 'Could not connect to the AI Service. Please check your connection or service status.',
        type: 'danger'
      });
    } finally {
      setSummaryLoading(false);
    }
  };

  const openSummary = () => {
    setIsSummaryModalOpen(true);
    if (!summaryContent) {
      handleGenerateSummary();
    }
  };

  useEffect(() => {
    // Cleanup context when leaving board
    return () => setCurrentContext(null);
  }, [setCurrentContext]);

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <h2 className="text-xl font-bold text-gray-800">Loading Project...</h2>
        <p className="text-gray-500 mt-2">If this takes too long, the project might not exist.</p>
        <button
          disabled={isAILoading}
          onClick={() => !isAILoading && navigate('/')}
          className={`mt-6 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 ${isAILoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="app-header bg-white border-b border-gray-200 z-30 shadow-sm relative">
        {/* Top Row: Navigation, Project Info & Add Task */}
        <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
            <button
              onClick={() => !isAILoading && navigate('/')}
              className="btn-back w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600 transition shrink-0"
              disabled={isAILoading}
            >
              <ChevronLeft size={24} />
            </button>
            <div className="flex flex-col min-w-0 group relative">
              <div className="flex items-center gap-1">
                <button
                  disabled={isAILoading}
                  onClick={() => !isAILoading && setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                  className="flex items-center gap-1 md:gap-2 text-left hover:bg-gray-50 px-1.5 py-0.5 -ml-1.5 rounded-lg transition-colors group/title min-w-0"
                >
                  <h1 className="project-title text-base md:text-xl font-bold text-gray-800 leading-tight truncate">
                    {currentProject.name}
                  </h1>
                  <ChevronDown
                    size={14}
                    className={`text-gray-400 group-hover/title:text-blue-500 transition-transform flex-shrink-0 ${isProjectDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                <button
                  onClick={() => setIsProjectModalOpen(true)}
                  className="btn-edit-project text-gray-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-gray-100 shrink-0"
                >
                  <Edit2 size={12} />
                </button>
              </div>
              <span className="project-desc text-[10px] md:text-xs text-gray-400 truncate md:block hidden">
                {currentProject.description}
              </span>

              {/* Project Switcher Dropdown */}
              {isProjectDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsProjectDropdownOpen(false)}
                  />
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-30 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1">
                      Switch Board
                    </div>
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                      {projects?.map((proj) => (
                        <button
                          key={proj.id}
                          disabled={isAILoading}
                          onClick={() => {
                            if (isAILoading) return;
                            navigate(`/board/${proj.id}`);
                            setIsProjectDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${proj.id === currentProject.id
                            ? 'bg-blue-50 text-blue-700 font-bold'
                            : 'text-gray-600 hover:bg-gray-50'
                            } ${isAILoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className={`w-2 h-2 rounded-full ${proj.id === currentProject.id ? 'bg-blue-500' : 'bg-gray-300'}`} />
                          <span className="truncate">{proj.name}</span>
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-gray-50 mt-1 pt-1">
                      <button
                        disabled={isAILoading}
                        onClick={() => {
                          if (isAILoading) return;
                          navigate('/');
                          setIsProjectDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors ${isAILoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Layout size={14} />
                        <span>All Boards Dashboard</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Desktop Search Bar (Memenuhi Halaman) */}
            <div
              onClick={() => setIsSearchOpen(true)}
              className="hidden lg:flex items-center flex-1 mx-8 bg-gray-50 border border-gray-200 rounded-xl px-4 h-11 cursor-pointer hover:bg-white hover:border-blue-300 transition-all group shadow-sm"
            >
              <Search size={18} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
              <span className="ml-3 text-sm text-gray-400 font-medium">Search tasks, projects, or use AI...</span>
              <div className="ml-auto flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                <kbd className="bg-white border border-gray-200 px-2 py-1 rounded text-[10px] font-mono text-gray-500 shadow-sm font-bold">Ctrl</kbd>
                <kbd className="bg-white border border-gray-200 px-2 py-1 rounded text-[10px] font-mono text-gray-500 shadow-sm font-bold">K</kbd>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isReadOnly && (
              <button
                onClick={handleNewTask}
                className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white h-10 px-3 md:px-5 rounded-lg font-bold transition shadow-md shadow-blue-500/20 hover:shadow-lg active:scale-95 group"
              >
                <Plus size={20} />
                <span className="hidden md:inline ml-1.5">Add Task</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Row: View Switcher & Tools */}
        <div className="px-4 md:px-6 pb-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            <div className="view-switcher flex bg-gray-100 p-1 rounded-lg shrink-0 h-10 items-center">
              <button
                onClick={() => setViewMode('board')}
                className={`h-full px-2 md:px-3 rounded-md transition-all flex items-center justify-center ${viewMode === 'board' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Layout size={16} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`h-full px-2 md:px-3 rounded-md transition-all flex items-center justify-center ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <List size={16} />
              </button>
            </div>

            <div className="h-6 w-px bg-gray-200 hidden sm:block shrink-0"></div>

            <button
              onClick={async () => {
                setIsTogglingAI(true);
                await toggleAI();
                setIsTogglingAI(false);
              }}
              className={`flex items-center gap-1.5 px-3 md:px-4 h-10 rounded-lg transition-all font-bold text-xs shrink-0 border ${isAIEnabled
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                : !isOllamaOnline
                  ? 'bg-gray-50 text-gray-400 border-gray-200 grayscale opacity-70'
                  : 'bg-white text-gray-400 border border-gray-200 hover:border-gray-300'
                }`}
              disabled={isTogglingAI}
              title={!isOllamaOnline ? "Ollama is Offline (ollama serve)" : isAIEnabled ? "Disable AI Engine" : "Enable AI Engine"}
            >
              {isTogglingAI ? (
                <Loader2 size={14} className="animate-spin" />
              ) : !isOllamaOnline ? (
                <div className="relative">
                  <Sparkles size={14} />
                  <div className="absolute -top-1 -right-0.5 w-1.5 h-1.5 bg-rose-500 rounded-full border border-white" />
                </div>
              ) : (
                <Sparkles size={14} />
              )}
              <span>AI</span>
              {isAIEnabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            </button>

            <button
              onClick={() => setIsSearchOpen(true)}
              className="lg:hidden w-10 h-10 flex items-center justify-center text-gray-500 hover:text-blue-600 bg-white border border-gray-200 hover:border-blue-100 hover:bg-blue-50/30 rounded-lg transition-all shrink-0"
              title="Smart Search (Ctrl+K)"
            >
              <Search size={18} />
            </button>

            {/* Notification Center moved to floating FAB */}

            <button
              onClick={() => navigate('/settings')}
              className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-blue-600 bg-white border border-gray-200 hover:border-blue-100 hover:bg-blue-50/30 rounded-lg transition-all shrink-0"
              title="Settings"
            >
              <Settings size={18} />
            </button>

            {/* <button
              onClick={() => navigate('/trash')}
              className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-rose-600 bg-white border border-gray-200 hover:border-rose-100 hover:bg-rose-50/30 rounded-lg transition-all shrink-0 invisible"
              title="Trash Bin"
            >
              <Trash2 size={18} />
            </button> */}

            <button
              onClick={() => isAIEnabled && setIsChatOpen(!isChatOpen)}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all border shrink-0 ${!isAIEnabled
                ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed opacity-50'
                : isChatOpen
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                  : 'bg-white text-gray-500 hover:text-blue-600 border-gray-200 hover:border-blue-100 hover:bg-blue-50/30'
                }`}
              disabled={!isAIEnabled}
            >
              <MessageSquare size={18} />
            </button>

            <button
              onClick={openSummary}
              disabled={!isAIEnabled}
              className={`btn-summary flex items-center justify-center px-3 md:px-4 h-10 rounded-lg transition border shrink-0 ${isAIEnabled
                ? 'bg-white text-blue-700 hover:bg-blue-50 border-blue-200 shadow-sm'
                : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed opacity-60'
                }`}
            >
              <Activity size={18} />
              <span className="hidden lg:inline ml-2 text-xs font-bold">Summary</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="app-toolbar px-4 md:px-6 py-2 md:py-3 flex items-center justify-between gap-4 sticky top-0 bg-slate-50/80 backdrop-blur-md z-[25] border-b border-gray-100">
        <div className="filters flex items-center gap-3 md:gap-6 text-sm text-gray-600 flex-1 min-w-0 pb-1 md:pb-0">

          {/* Project Filter */}
          <div className="filter-project min-w-[140px] md:min-w-[160px] shrink-0">
            <SearchableSelect
              value={filterProject}
              onChange={setFilterProject}
              options={uniqueProjects}
              placeholder="Project..."
              icon={<Folder size={14} className="text-gray-400" />}
            />
          </div>

          {/* Category Filter */}
          <div className="filter-category min-w-[140px] md:min-w-[160px] shrink-0">
            <SearchableSelect
              value={filterCategory}
              onChange={setFilterCategory}
              options={uniqueCategories}
              placeholder="Category..."
              icon={<Tag size={14} className="text-gray-400" />}
            />
          </div>

          <div className="w-px h-4 bg-gray-200 mx-1 hidden sm:block shrink-0"></div>

          {/* Sort Control */}
          <div className="sort-controls min-w-[140px] md:min-w-[160px] shrink-0">
            <SearchableSelect
              value={sortBy === 'none' ? 'All' : sortBy === 'priority' ? 'Priority' : 'Due Date'}
              onChange={(val) => setSortBy(val === 'All' ? 'none' : val === 'Priority' ? 'priority' : 'dueDate')}
              options={['All', 'Priority', 'Due Date']}
              placeholder="Sort by..."
              icon={<SlidersHorizontal size={14} className="text-gray-400" />}
            />
          </div>
        </div>
        <div className="task-count text-[10px] md:text-sm text-gray-400 font-black uppercase tracking-widest bg-gray-100/50 px-2 py-1 rounded-lg shrink-0 hidden lg:block">
          {processedTasks.length} tasks
        </div>
      </div>

      {/* Content Area */}
      <main className="app-content flex-1 overflow-hidden px-4 md:px-6 pb-6 relative flex flex-col">
        {boardLoading && (
          <div className="loading-overlay absolute inset-0 bg-white/50 backdrop-blur-[1px] z-20 flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        )}
        <div className="flex-1 min-h-0 flex flex-col">
          {viewMode === 'board' ? (
            <BoardView
              tasks={processedTasks}
              columns={columns}
              onTaskMove={isDragEnabled && !isReadOnly ? handleTaskMove : () => { }}
              onTaskReorder={isManualSort && !isReadOnly ? handleTaskReorder : undefined}
              onEditTask={handleEditTask}
              onDeleteTask={isReadOnly ? undefined : confirmDeleteTask}
              onDuplicateTask={isReadOnly ? undefined : handleDuplicateTask}
              onToggleCheck={handleToggleCheck}
              prioritySettings={prioritySettings}
              onAddColumn={isReadOnly ? undefined : handleAddColumn}
              onEditColumn={handleEditColumn}
              onDeleteColumn={isReadOnly ? undefined : handleDeleteColumn}
              onColumnMove={isDragEnabled && !isReadOnly ? handleColumnMove : () => { }}
              onAddTask={isReadOnly ? undefined : handleAddTaskToColumn}
              isDragEnabled={isDragEnabled && !isReadOnly}
              selectedTaskIds={selectedTaskIds}
              onToggleTaskSelection={handleToggleTaskSelection}
              onSetSelection={setSelectedTaskIds}
              projectId={currentProject.id}
              isReadOnly={isReadOnly}
            />
          ) : (
            <TableView
              tasks={processedTasks}
              columns={columns}
              onEdit={handleEditTask}
              onDelete={isReadOnly ? undefined : confirmDeleteTask}
              onToggleCheck={handleToggleCheck}
              onUpdateStatus={isReadOnly ? undefined : handleUpdateTaskStatus}
              onUpdatePriority={isReadOnly ? undefined : handleUpdateTaskPriority}
              prioritySettings={prioritySettings}
              selectedTaskIds={selectedTaskIds}
              onToggleTaskSelection={handleToggleTaskSelection}
              onSetSelection={setSelectedTaskIds}
              projectId={currentProject.id}
              isReadOnly={isReadOnly}
            />
          )}
        </div>
      </main>

      <TaskModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveTask}
        initialTask={editingTask}
        columns={columns}
        defaultStatus={newTaskStatus}
        currentProjectName={currentProject.name}
        projectId={currentProject.id}
        isReadOnly={isReadOnly}
      />

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteTask}
        title="Delete Task"
        message="Are you sure you want to delete this task? It will be moved to the Trash Bin."
      />

      <ColumnModal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        onSave={handleSaveColumn}
        initialColumn={editingColumn}
        isReadOnly={isReadOnly}
      />

      <SummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        loading={summaryLoading}
        content={summaryContent}
        onRefresh={handleGenerateSummary}
        projectName={currentProject.name}
      />

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSave={handleUpdateProject}
        initialProject={currentProject}
      />

      {/* Floating Multi-select Overlay (Image 1 style) */}
      {isMultiSelectActive && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 duration-300">
          <div className="bg-white/90 backdrop-blur-md rounded-lg shadow-2xl border border-gray-200/50 p-2 pl-4 flex items-center gap-6 ring-1 ring-black/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-200 animate-in zoom-in duration-500">
                {selectedTaskIds.length}
              </div>
              <span className="text-[10px] font-black text-blue-600 tracking-[0.15em]">SELECTED</span>
            </div>

            <div className="h-8 w-px bg-gray-200/50"></div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleClearSelection}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-blue-600 hover:bg-blue-50 bg-gray-50/50 border border-gray-100 rounded transition-all"
              >
                Deselect
              </button>
              <button
                onClick={handleDeleteSelectedTasks}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-black transition-all shadow-lg shadow-red-100 hover:shadow-red-200 active:scale-95"
              >
                <Trash2 size={14} strokeWidth={2.5} />
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation (Image 2 style) */}
      <ConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleConfirmBulkDelete}
        title="Bulk Delete Tasks"
        message={`Are you sure you want to delete ${selectedTaskIds.length} selected tasks? They will be moved to the Trash Bin.`}
      />
    </>
  );
};

export default BoardPage;