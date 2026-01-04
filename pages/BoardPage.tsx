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
import { Plus, Layout, List, Search, Filter, Settings, ChevronLeft, Edit2, Loader2 } from 'lucide-react';
import introJs from 'intro.js';

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
  const { projects, setProjects, prioritySettings, setPrioritySettings } = useApp();
  
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
  
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState<string>('');
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);
  
  // Filters
  const [sortOption, setSortOption] = useState<SortOption>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');

  // 1. Resolve Project from URL
  useEffect(() => {
      const proj = projects.find(p => p.id === projectId);
      if (proj) {
          setCurrentProject(proj);
      } else if (projects.length > 0) {
          // Project not found
          navigate('/');
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
        } catch (err) {
            console.error("Failed to load project data", err);
        } finally {
            setBoardLoading(false);
        }
    };
    loadBoardData();
  }, [currentProject]);

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
    }
  }, [tasks, currentProject, boardLoading]);

  useEffect(() => {
    if (currentProject && !boardLoading) {
        db.saveColumns(currentProject.id, columns);
    }
  }, [columns, currentProject, boardLoading]);

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

  const handleTaskMove = (taskId: string, newStatus: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
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

    if (sortOption !== 'none') {
      result.sort((a, b) => {
        if (sortOption === 'date') return b.createdAt - a.createdAt;
        if (sortOption === 'priority') {
           const pMap = { [Priority.HIGH]: 3, [Priority.MEDIUM]: 2, [Priority.LOW]: 1 };
           return pMap[b.priority] - pMap[a.priority];
        }
        if (sortOption === 'category') return a.category.localeCompare(b.category);
        if (sortOption === 'status') return a.status.localeCompare(b.status);
        if (sortOption === 'dueDate') {
            return (a.dueDate || Infinity) - (b.dueDate || Infinity);
        }
        return 0;
      });
    }

    return result;
  }, [tasks, sortOption, searchQuery, viewMode, filterProject, filterCategory]);

  if (!currentProject) return null; // Or loader

  return (
    <>
      {/* Header */}
      <header className="app-header bg-white border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm z-10 gap-4">
        <div className="flex items-center gap-3">
            <button 
                onClick={() => navigate('/')}
                className="btn-back p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600 transition"
                title="Back to Projects"
            >
                <ChevronLeft size={24} />
            </button>
            <div className="flex flex-col group project-info">
                <div className="flex items-center gap-2">
                    <h1 className="project-title text-xl font-bold text-gray-800 leading-none">{currentProject.name}</h1>
                    <button 
                        className="btn-edit-project text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Edit Project Details"
                    >
                        <Edit2 size={16} />
                    </button>
                </div>
                <span className="project-desc text-xs text-gray-500 mt-1">{currentProject.description}</span>
            </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 app-actions">
            <div className="search-box relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Search tasks..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-search pl-9 pr-4 py-2 bg-gray-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
                />
            </div>
            
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

            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="btn-settings p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                title="Settings"
            >
                <Settings size={20} />
            </button>

            <button 
                onClick={handleNewTask}
                className="btn-new-task flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-sm hover:shadow-md"
            >
                <Plus size={18} />
                <span className="hidden sm:inline">New Task</span>
            </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="app-toolbar px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
         <div className="filters flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <div className="filter-sort flex items-center gap-2">
                <Filter size={16} />
                <span className="font-medium">Sort:</span>
                <select 
                    value={sortOption} 
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                    className="bg-white border border-gray-200 rounded px-2 py-1 outline-none text-gray-800 cursor-pointer focus:border-blue-500"
                >
                    <option value="none">Default</option>
                    <option value="date">Created Date</option>
                    <option value="dueDate">Due Date</option>
                    <option value="priority">Priority</option>
                    <option value="category">Category</option>
                    <option value="status">Status</option>
                </select>
            </div>

            <div className="separator h-4 w-px bg-gray-300 hidden sm:block"></div>

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
         </div>
         <div className="task-count text-sm text-gray-500 font-medium">
             {processedTasks.length} tasks
         </div>
      </div>

      {/* Content Area */}
      <main className="app-content flex-1 overflow-hidden px-6 pb-6 relative">
        {boardLoading && (
             <div className="loading-overlay absolute inset-0 bg-white/50 backdrop-blur-[1px] z-20 flex items-center justify-center">
                 <Loader2 className="animate-spin text-blue-600" size={32} />
             </div>
        )}
        {viewMode === 'board' ? (
            <BoardView 
                tasks={processedTasks} 
                columns={columns}
                onTaskMove={sortOption === 'none' && filterProject === 'All' && filterCategory === 'All' ? handleTaskMove : () => {}} 
                onEditTask={handleEditTask}
                onDeleteTask={confirmDeleteTask}
                onToggleCheck={handleToggleCheck}
                prioritySettings={prioritySettings}
                onAddColumn={handleAddColumn}
                onEditColumn={handleEditColumn}
                onDeleteColumn={handleDeleteColumn}
                onColumnMove={sortOption === 'none' && filterProject === 'All' && filterCategory === 'All' ? handleColumnMove : () => {}}
                onAddTask={handleAddTaskToColumn}
            />
        ) : (
            <TableView 
                tasks={processedTasks}
                columns={columns}
                onEdit={handleEditTask}
                onDelete={confirmDeleteTask}
                onToggleCheck={handleToggleCheck}
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
    </>
  );
};

export default BoardPage;

