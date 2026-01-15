import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { db } from '../services/db';
import { Task, Column, Priority, SortOption, Project } from '../types';
import BoardView from '../components/BoardView';
import TableView from '../components/TableView';
import TaskModal from '../components/TaskModal';
import SettingsModal from '../components/SettingsModal';
import ConfirmModal from '../components/ConfirmModal';
import ColumnModal from '../components/ColumnModal';
import SummaryModal from '../components/SummaryModal';
import AISettingsModal from '../components/AISettingsModal';
import { Plus, Layout, List, Search, Filter, Settings, ChevronLeft, ChevronDown, Edit2, Loader2, Activity, ArrowUpDown, Calendar, AlertCircle, MessageSquare, Wand2, ToggleLeft, ToggleRight } from 'lucide-react';

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
  const { projects, setProjects, prioritySettings, setPrioritySettings, isAIEnabled, toggleAI, disableAI, activeModel, isChatOpen, setIsChatOpen, setCurrentContext, boardRefreshTrigger } = useApp();
  
  // Ref to block deep link effect during save operations to prevent modal reopening
  const isSavingRef = React.useRef(false);

  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [isTogglingAI, setIsTogglingAI] = useState(false);
    const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
    const { isAILoading } = useApp();
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');
  
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState<string>('');
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('none');

  // 1. Resolve Project from URL
  useEffect(() => {
      console.log(`[BoardPage] Resolving Project ID: ${projectId}`);
      console.log(`[BoardPage] Available Projects:`, projects);
      
      if (!projects) return;

      const proj = projects.find(p => p.id === projectId);
      
      if (proj) {
          console.log(`[BoardPage] Found Project:`, proj);
          setCurrentProject(proj);
      } else {
          console.log(`[BoardPage] Project NOT found.`);
          if (projects.length > 0) {
              console.warn(`[BoardPage] Redirecting to home because project list is populated but ID not found.`);
              navigate('/');
          } else {
             console.log(`[BoardPage] Waiting for projects to load...`);
          }
      }
  }, [projectId, projects, navigate]);

  // 2. Load Board Data
  useEffect(() => {
    if (!currentProject) return;

    const loadBoardData = async () => {
        setBoardLoading(true);
        try {
            const [pTasks, pColumns] = await Promise.all([
                db.getTasks(currentProject.id),
                db.getColumns(currentProject.id)
            ]);
            setTasks(pTasks || []);
            setColumns((pColumns && pColumns.length > 0) ? pColumns : TEMPLATE_COLUMNS);
            
            // Update Context for AI
            if (currentProject) {
                setCurrentContext({
                    projectId: currentProject.id,
                    projectName: currentProject.name,
                    tasks: pTasks || [],
                    columns: (pColumns && pColumns.length > 0) ? pColumns : TEMPLATE_COLUMNS
                });
            }
        } catch (err) {
            console.error("Failed to load project data", err);
        } finally {
            setBoardLoading(false);
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

  // Persist Tasks/Columns
  useEffect(() => {
    if (currentProject && !boardLoading) {
        db.saveTasks(currentProject.id, tasks);
        // Update Context Live
        setCurrentContext(prev => prev ? { ...prev, tasks } : null);
    }
  }, [tasks, currentProject, boardLoading, setCurrentContext]);

  useEffect(() => {
    if (currentProject && !boardLoading) {
        db.saveColumns(currentProject.id, columns);
        // Update Context Live
        setCurrentContext(prev => prev ? { ...prev, columns } : null);
    }
  }, [columns, currentProject, boardLoading, setCurrentContext]);

  // Computed lists
  const uniqueProjects = useMemo(() => ['All', ...new Set(tasks.map(t => t.project).filter(Boolean))], [tasks]);
  const uniqueCategories = useMemo(() => ['All', ...new Set(tasks.map(t => t.category).filter(Boolean))], [tasks]);

  // --- Handlers ---

  const handleSaveTask = (taskData: Omit<Task, 'id' | 'createdAt'> | Task) => {
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

  const handleDeleteTask = () => {
    if (taskToDelete) {
      setTasks(prev => prev.filter(t => t.id !== taskToDelete));
      setTaskToDelete(null);
      setIsDeleteModalOpen(false);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    // Update URL to reflect task being edited (Deep link)
    navigate(`/board/${projectId}/task/${task.id}`);
    setIsModalOpen(true);
  };

  const handleDuplicateTask = (task: Task) => {
    const duplicatedTask: Task = {
      ...task,
      id: crypto.randomUUID(),
      title: `Copy of ${task.title}`,
      createdAt: Date.now(),
      subTasks: task.subTasks ? task.subTasks.map(st => ({...st, id: crypto.randomUUID()})) : [],
      media: task.media ? [...task.media] : []
    };
    setTasks(prev => [...prev, duplicatedTask]);
  };

  const handleTaskMove = (taskId: string, newStatus: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const handleTaskReorder = (newTasks: Task[]) => {
      setTasks(newTasks);
  };

  const handleToggleCheck = (taskId: string) => {
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
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const handleUpdateTaskPriority = (taskId: string, newPriority: Priority) => {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority: newPriority } : t));
  };

  const handleUpdateProject = (updatedData: Pick<Project, 'id' | 'name' | 'description' | 'color'>) => {
      if (currentProject) {
          const updatedProject = { ...currentProject, ...updatedData };
          setCurrentProject(updatedProject);
          
          // Update in global list
          setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
          
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
    if (editingColumn) {
      setColumns(prev => prev.map(c => c.id === column.id ? column : c));
    } else {
      setColumns(prev => [...prev, column]);
    }
  };

  const handleDeleteColumn = (id: string) => {
    if (columns.length <= 1) {
      alert("You must have at least one column.");
      return;
    }
    if (confirm("Are you sure? Tasks in this column will be moved to the first available column.")) {
       const newColumns = columns.filter(c => c.id !== id);
       const fallbackStatus = newColumns[0].id;
       setTasks(prev => prev.map(t => t.status === id ? { ...t, status: fallbackStatus } : t));
       setColumns(newColumns);
    }
  };

  const handleColumnMove = (activeId: string, overId: string) => {
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

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.category.toLowerCase().includes(q) ||
        t.project.toLowerCase().includes(q)
      );
    }

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
  }, [tasks, searchQuery, viewMode, filterProject, filterCategory, sortBy]);

  // Determine if Drag and Drop should be enabled
  // We allow dragging even if sorted/filtered to enable moving tasks between columns.
  // Reordering within the same column is disabled/ignored if sorted/filtered.
  const isDragEnabled = true;

  // Determine if manual reordering (same column) is allowed
  const isManualSort = useMemo(() => {
      return sortBy === 'none' && !searchQuery && filterProject === 'All' && filterCategory === 'All';
  }, [sortBy, searchQuery, filterProject, filterCategory]);

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
                  'x-ollama-endpoint': (useApp as any)().ollamaEndpoint // Quick fix for scope
              },
              body: JSON.stringify({ prompt, model: activeModel })
          });

          if (!response.ok) throw new Error("Failed to generate summary");
          
          const data = await response.json();
          setSummaryContent(data.response);

      } catch (error) {
          console.error("Summary Error:", error);
          setSummaryContent("Failed to generate summary. AI service disconnected.");
          disableAI(); // Automatically disable AI features
          alert("AI Service Unreachable. AI features have been disabled.");
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
      <header className="app-header bg-white border-b border-gray-200 px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm z-10 gap-4 min-h-[73px]">
        <div className="flex items-center gap-3">
            <button 
                onClick={() => !isAILoading && navigate('/')}
                className={`btn-back p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600 transition ${isAILoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isAILoading ? "AI is processing..." : "Back to Projects"}
                disabled={isAILoading}
            >
                <ChevronLeft size={24} />
            </button>
            <div className="flex flex-col group project-info relative">
                <div className="flex items-center gap-2">
                    <button 
                        disabled={isAILoading}
                        onClick={() => !isAILoading && setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                        className={`flex items-center gap-2 text-left hover:bg-gray-100 px-2 py-1 -ml-2 rounded-lg transition-colors group/title ${isAILoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <h1 className="project-title text-xl font-bold text-gray-800 leading-none">
                            {currentProject.name}
                        </h1>
                        <ChevronDown 
                            size={18} 
                            className={`text-gray-400 group-hover/title:text-blue-500 transition-transform ${isProjectDropdownOpen ? 'rotate-180' : ''}`} 
                        />
                    </button>
                    <button 
                        onClick={() => setIsProjectModalOpen(true)}
                        className="btn-edit-project text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100"
                        title="Edit Project Details"
                    >
                        <Edit2 size={16} />
                    </button>
                </div>
                <span className="project-desc text-xs text-gray-500 mt-1">{currentProject.description}</span>

                {/* Project Switcher Dropdown */}
                {isProjectDropdownOpen && (
                    <>
                        <div 
                            className="fixed inset-0 z-20" 
                            onClick={() => setIsProjectDropdownOpen(false)}
                        />
                        <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1">
                                Switch Board
                            </div>
                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                {projects.map((proj) => (
                                    <button
                                        key={proj.id}
                                        disabled={isAILoading}
                                        onClick={() => {
                                            if (isAILoading) return;
                                            navigate(`/board/${proj.id}`);
                                            setIsProjectDropdownOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                                            proj.id === currentProject.id 
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
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-4 app-actions w-full md:w-auto justify-between md:justify-end">
            {/* Language Switcher Removed */}
            <div className="search-box relative w-full sm:w-auto order-last sm:order-none mt-2 sm:mt-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Search tasks..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-search pl-9 pr-4 py-2 bg-gray-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-64"
                />
            </div>
            
            <div className="flex items-center gap-2">
            <div className="view-switcher flex bg-gray-100 p-1 rounded-lg">
                <button 
                    onClick={() => setViewMode('board')}
                    className={`btn-view-board p-2 rounded-md transition-all ${viewMode === 'board' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Layout size={18} />
                </button>
                <button 
                    onClick={() => setViewMode('table')}
                    className={`btn-view-table p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <List size={18} />
                </button>
            </div>

                {/* AI Toggle Controls */}
                <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
                    <button 
                        onClick={async () => {
                            if (!isAIEnabled) {
                                setIsTogglingAI(true);
                                setIsAISettingsOpen(true);
                                setIsTogglingAI(false);
                                return; 
                            }
                            setIsTogglingAI(true);
                            await toggleAI();
                            setIsTogglingAI(false);
                        }}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all font-bold border text-xs ${
                            isAIEnabled 
                                ? 'bg-white text-blue-700 border-blue-200 shadow-sm' 
                                : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-200'
                        }`}
                        disabled={isTogglingAI}
                        title={isAIEnabled ? "Disable AI" : "Enable AI"}
                    >
                        {isTogglingAI ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                        <span className="hidden sm:inline">AI</span>
                        {isAIEnabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    </button>
                    <button
                        onClick={() => setIsAISettingsOpen(true)}
                        className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-white hover:shadow-sm transition-all"
                        title="AI Settings"
                    >
                        <Settings size={16} />
                    </button>
                </div>

                {isAIEnabled && (
                    <button 
                        onClick={openSummary}
                        className="btn-summary flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-3 py-2 rounded-lg text-sm font-medium transition"
                        title="AI Project Summary"
                    >
                        <Activity size={18} />
                        <span className="hidden sm:inline">Summary</span>
                    </button>
                )}

                {isAIEnabled && (
                    <button 
                        onClick={() => setIsChatOpen(!isChatOpen)}
                        className={`btn-chat flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition border ${
                            isChatOpen 
                                ? 'bg-blue-600 text-white border-blue-600' 
                                : 'bg-white text-blue-700 hover:bg-blue-50 border-blue-200'
                        }`}
                        title="AI Chatbot"
                    >
                        <MessageSquare size={18} />
                        <span className="hidden sm:inline">AI Chat</span>
                    </button>
                )}

            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="btn-settings p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                title="Settings"
            >
                <Settings size={20} />
            </button>

            <button 
                onClick={handleNewTask}
                    className="btn-new-task flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg font-medium transition shadow-sm hover:shadow-md text-sm md:text-base"
            >
                <Plus size={18} />
                <span className="hidden sm:inline">Add Task</span>
                    <span className="sm:hidden">Task</span>
            </button>
            </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="app-toolbar px-4 md:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
         <div className="filters flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <div className="filter-project flex items-center gap-2">
                <span className="font-medium">Sub-Project:</span>
                <select 
                    value={filterProject} 
                    onChange={(e) => setFilterProject(e.target.value)}
                    className="bg-white border border-gray-200 rounded px-2 py-1 outline-none text-gray-800 cursor-pointer focus:border-blue-500 max-w-[150px]"
                >
                    {uniqueProjects.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>

            <div className="filter-category flex items-center gap-2">
                <span className="font-medium">Category:</span>
                <select 
                    value={filterCategory} 
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="bg-white border border-gray-200 rounded px-2 py-1 outline-none text-gray-800 cursor-pointer focus:border-blue-500 max-w-[150px]"
                >
                    {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
            
            <div className="w-px h-6 bg-gray-300 mx-1 hidden sm:block"></div>

            <div className="sort-controls flex items-center gap-2">
                 <span className="font-medium">Sort:</span>
                 <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                    <button
                        onClick={() => setSortBy('none')}
                        className={`px-2 py-1 text-xs rounded transition-all ${sortBy === 'none' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                        title="Manual Order (Drag & Drop)"
                    >
                        Manual
                    </button>
                    <button
                        onClick={() => setSortBy('priority')}
                        className={`px-2 py-1 text-xs rounded transition-all flex items-center gap-1 ${sortBy === 'priority' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                        title="Sort by Priority"
                    >
                        <AlertCircle size={12} />
                        Priority
                    </button>
                    <button
                        onClick={() => setSortBy('dueDate')}
                        className={`px-2 py-1 text-xs rounded transition-all flex items-center gap-1 ${sortBy === 'dueDate' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                        title="Sort by Due Date"
                    >
                        <Calendar size={12} />
                        Date
                    </button>
                 </div>
            </div>
         </div>
         <div className="task-count text-sm text-gray-500 font-medium">
             {processedTasks.length} tasks
         </div>
      </div>

      {/* Content Area */}
      <main className="app-content flex-1 overflow-hidden px-4 md:px-6 pb-6 relative">
        {boardLoading && (
             <div className="loading-overlay absolute inset-0 bg-white/50 backdrop-blur-[1px] z-20 flex items-center justify-center">
                 <Loader2 className="animate-spin text-blue-600" size={32} />
             </div>
        )}
        {viewMode === 'board' ? (
            <BoardView 
                tasks={processedTasks} 
                columns={columns}
                onTaskMove={isDragEnabled ? handleTaskMove : () => {}} 
                onTaskReorder={isManualSort ? handleTaskReorder : undefined}
                onEditTask={handleEditTask}
                onDeleteTask={confirmDeleteTask}
                onDuplicateTask={handleDuplicateTask}
                onToggleCheck={handleToggleCheck}
                prioritySettings={prioritySettings}
                onAddColumn={handleAddColumn}
                onEditColumn={handleEditColumn}
                onDeleteColumn={handleDeleteColumn}
                onColumnMove={isDragEnabled ? handleColumnMove : () => {}}
                onAddTask={handleAddTaskToColumn}
                isDragEnabled={isDragEnabled}
            />
        ) : (
            <TableView 
                tasks={processedTasks}
                columns={columns}
                onEdit={handleEditTask}
                onDelete={confirmDeleteTask}
                onToggleCheck={handleToggleCheck}
                onUpdateStatus={handleUpdateTaskStatus}
                onUpdatePriority={handleUpdateTaskPriority}
                prioritySettings={prioritySettings}
            />
        )}
      </main>

      <TaskModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        onSave={handleSaveTask}
        initialTask={editingTask}
        columns={columns}
        defaultStatus={newTaskStatus}
        currentProjectName={currentProject.name}
      />
      
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={prioritySettings}
        onSave={setPrioritySettings}
        onReset={() => setPrioritySettings({
            [Priority.LOW]: { bg: '#dbeafe', text: '#1e40af' },    
            [Priority.MEDIUM]: { bg: '#fef3c7', text: '#92400e' }, 
            [Priority.HIGH]: { bg: '#fee2e2', text: '#991b1b' }, 
        })}
      />

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteTask}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
      />

      <ColumnModal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        onSave={handleSaveColumn}
        initialColumn={editingColumn}
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

      <AISettingsModal 
        isOpen={isAISettingsOpen}
        onClose={() => setIsAISettingsOpen(false)}
      />
    </>
  );
};

export default BoardPage;
