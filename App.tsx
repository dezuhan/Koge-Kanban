import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Layout, List, Search, Filter, Settings, Loader2, ChevronLeft, Edit2 } from 'lucide-react';
import { Task, Priority, SortOption, PrioritySettings, Column, Project } from './types';
import BoardView from './components/BoardView';
import TableView from './components/TableView';
import TaskModal from './components/TaskModal';
import SettingsModal from './components/SettingsModal';
import ConfirmModal from './components/ConfirmModal';
import ColumnModal from './components/ColumnModal';
import ProjectList from './components/ProjectList';
import ProjectModal from './components/ProjectModal';
import { db } from './services/db';
import { dropProjectData } from './utils/cleanup';
import introJs from 'intro.js';

// Required Template Columns
const TEMPLATE_COLUMNS: Column[] = [
  { id: 'Draft', title: 'DRAFT', color: '#94a3b8' },
  { id: 'To Do', title: 'TO-DO', color: '#f59e0b' },
  { id: 'On Going', title: 'ON GOING', color: '#3b82f6' },
  { id: 'Complete', title: 'COMPLETE', color: '#22c55e' }
];

const DEFAULT_PRIORITY_SETTINGS: PrioritySettings = {
  [Priority.LOW]: { bg: '#dbeafe', text: '#1e40af' },    
  [Priority.MEDIUM]: { bg: '#fef3c7', text: '#92400e' }, 
  [Priority.HIGH]: { bg: '#fee2e2', text: '#991b1b' },   
};

// --- SEED DATA FOR NEW USERS ---
const SEED_PROJECT_ID = 'intro-project-welcome';
const SEED_PROJECT: Project = {
    id: SEED_PROJECT_ID,
    name: 'Welcome to Koge Kanban 👋',
    description: 'A quick interactive tour. Click "Open Board" to start!',
    createdAt: Date.now()
};

const SEED_TASKS: Task[] = [
    {
        id: 'intro-task-1',
        title: '👋 Welcome! Read Me First',
        description: `## Welcome to Koge Kanban!\n\nThis is your new workspace. Here is a quick overview:\n\n*   **Projects**: Manage multiple workspaces.\n*   **Columns**: Categorize work (Draft, To-Do, etc.).\n*   **Privacy**: Your data is stored locally in your browser (or your own DB).\n\n**Tip**: Try clicking the **Table Icon** in the top right to see a list view.`,
        status: 'Draft',
        priority: Priority.LOW,
        category: 'Onboarding',
        project: 'Welcome',
        isCompleted: false,
        createdAt: Date.now(),
        dueDate: null,
        subTasks: []
    },
    {
        id: 'intro-task-2',
        title: '👈 Try Dragging This Card',
        description: `**Drag and Drop** is the core of Kanban.\n\n1. Click and hold this card.\n2. Drag it to the **ON GOING** column.\n3. Release it to update its status.`,
        status: 'To Do',
        priority: Priority.HIGH,
        category: 'Interaction',
        project: 'Welcome',
        isCompleted: false,
        createdAt: Date.now(),
        dueDate: Date.now() + 86400000, 
        subTasks: []
    },
    {
        id: 'intro-task-3',
        title: '✏️ Edit Task Details',
        description: `Click this card to open the **Edit Modal**.\n\nYou can add:\n*   Rich Text Descriptions (Markdown)\n*   Due Dates\n*   Assignees\n*   Subtasks`,
        status: 'To Do',
        priority: Priority.MEDIUM,
        category: 'Features',
        project: 'Welcome',
        isCompleted: false,
        createdAt: Date.now(),
        dueDate: null,
        subTasks: [
            { id: 'st-1', title: 'Open this task', isCompleted: true },
            { id: 'st-2', title: 'Add a subtask', isCompleted: false }
        ]
    },
    {
        id: 'intro-task-4',
        title: '👤 Assignees & Media',
        description: `You can assign tasks to people and attach images.\n\n*   **Assignee**: See the initials on the card?\n*   **Media**: You can paste image URLs or upload files.\n\nThis task is assigned to a new user.`,
        status: 'On Going',
        priority: Priority.MEDIUM,
        category: 'Features',
        project: 'Welcome',
        isCompleted: false,
        createdAt: Date.now(),
        dueDate: null,
        assignee: 'New User',
        media: 'https://images.unsplash.com/photo-1542626991-cbc4e32524cc?w=400&q=80',
        subTasks: []
    },
    {
        id: 'intro-task-5',
        title: '✅ Completed Task',
        description: `This task is marked as complete. You can toggle completion by clicking the checkbox on the card or in the modal.`,
        status: 'Complete',
        priority: Priority.LOW,
        category: 'General',
        project: 'Welcome',
        isCompleted: true,
        createdAt: Date.now(),
        dueDate: null,
        subTasks: []
    }
];

const App: React.FC = () => {
  // App Level State
  const [appLoading, setAppLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  // Board Level State
  const [boardLoading, setBoardLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [prioritySettings, setPrioritySettings] = useState<PrioritySettings>(DEFAULT_PRIORITY_SETTINGS);

  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [isDeleteProjectModalOpen, setIsDeleteProjectModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState<string>('');
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  
  // Sorting & Filtering state
  const [sortOption, setSortOption] = useState<SortOption>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');

  // --- Initialization ---

  // Load Projects on Start
  useEffect(() => {
    const initApp = async () => {
        try {
            const [fetchedProjects, fetchedSettings] = await Promise.all([
                db.getProjects(),
                db.getSettings()
            ]);
            
            if (fetchedSettings) setPrioritySettings(fetchedSettings);

            if (fetchedProjects && fetchedProjects.length > 0) {
                setProjects(fetchedProjects);
            } else {
                // Initialize Seed Project if no projects exist (First time user)
                console.log("No projects found, initializing seed project...");
                const seedProjects = [SEED_PROJECT];
                setProjects(seedProjects);
                
                // Save Seed Data
                await Promise.all([
                    db.saveProjects(seedProjects),
                    db.saveColumns(SEED_PROJECT_ID, TEMPLATE_COLUMNS),
                    db.saveTasks(SEED_PROJECT_ID, SEED_TASKS)
                ]);
            }
        } catch (error) {
            console.error("App init failed", error);
        } finally {
            setAppLoading(false);
        }
    };
    initApp();
  }, []);

  // Save Projects List Persistence
  useEffect(() => {
    if (!appLoading) db.saveProjects(projects);
  }, [projects, appLoading]);

  // Save Settings Persistence
  useEffect(() => {
    if (!appLoading) db.saveSettings(prioritySettings);
  }, [prioritySettings, appLoading]);

  // Load Board Data when Project Changes
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
            // Fallback to template if columns are missing or empty
            setColumns((pColumns && pColumns.length > 0) ? pColumns : TEMPLATE_COLUMNS); 
        } catch (err) {
            console.error("Failed to load project data", err);
        } finally {
            setBoardLoading(false);
        }
    };
    loadBoardData();
  }, [currentProject]);

  // Trigger Onboarding Tour
  useEffect(() => {
    if (currentProject && !boardLoading && !appLoading && columns.length > 0) {
        // Check if tour has been shown
        const tourShown = localStorage.getItem('intro_tour_shown');
        
        // Only show tour if not shown AND we are inside a project (any project, but useful for the welcome one)
        if (!tourShown) {
            // Small delay to ensure DOM elements are rendered
            const timer = setTimeout(() => {
                introJs().setOptions({
                    steps: [
                        {
                            element: '.app-header',
                            intro: 'Welcome to your Kanban Board! This is your workspace command center.',
                            position: 'bottom'
                        },
                        {
                            element: '.btn-new-task',
                            intro: 'Click here to create a new task.',
                            position: 'left'
                        },
                        {
                            element: '.kanban-board',
                            intro: 'This is your board. Drag and drop tasks between columns to update their status.',
                            position: 'top'
                        },
                         {
                            element: '.kanban-add-column-btn',
                            intro: 'Need a custom workflow? Click here to add a new column.',
                            position: 'left'
                        },
                        {
                            element: '.view-switcher',
                            intro: 'Switch between the visual Board view and the detailed List view here.',
                            position: 'bottom'
                        },
                        {
                            element: '.btn-settings',
                            intro: 'Customize your priority colors and other settings here.',
                            position: 'bottom'
                        }
                    ],
                    showProgress: true,
                    showBullets: false,
                    exitOnOverlayClick: false
                }).onexit(() => {
                    localStorage.setItem('intro_tour_shown', 'true');
                }).start();
            }, 1000);
            
            return () => clearTimeout(timer);
        }
    }
  }, [currentProject, boardLoading, appLoading, columns.length]);

  // Persist Tasks/Columns only when a project is active
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


  // --- Project Management Handlers ---

  const handleSaveProject = (projectData: Pick<Project, 'id' | 'name' | 'description'>) => {
    setProjects(prev => {
        const exists = prev.some(p => p.id === projectData.id);
        let updatedProjects;
        if (exists) {
            updatedProjects = prev.map(p => p.id === projectData.id ? { ...p, ...projectData } as Project : p);
            // If editing current project, update it too
            if (currentProject && currentProject.id === projectData.id) {
                setCurrentProject({ ...currentProject, ...projectData } as Project);
            }
        } else {
            const newProject: Project = {
                ...projectData,
                createdAt: Date.now()
            } as Project;
            updatedProjects = [...prev, newProject];
            
            // Init data for new project with TEMPLATE_COLUMNS
             db.saveColumns(newProject.id, TEMPLATE_COLUMNS);
             db.saveTasks(newProject.id, []);
        }
        return updatedProjects;
    });
  };

  const handleAddProject = () => {
    setEditingProject(null);
    setIsProjectModalOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setIsProjectModalOpen(true);
  };

  const handleDeleteProject = () => {
      if (!projectToDelete) return;

      // Clean up DB resources: Drop data for tasks and columns associated with this project
      dropProjectData(projectToDelete);

      setProjects(prev => prev.filter(p => p.id !== projectToDelete));
      setProjectToDelete(null);
      setIsDeleteProjectModalOpen(false);
  };


  // --- Task Management Handlers ---

  // Computed lists
  const uniqueProjects = useMemo(() => ['All', ...new Set(tasks.map(t => t.project).filter(Boolean))], [tasks]);
  const uniqueCategories = useMemo(() => ['All', ...new Set(tasks.map(t => t.category).filter(Boolean))], [tasks]);

  const handleSaveTask = (taskData: Omit<Task, 'id' | 'createdAt'> | Task) => {
    if ('id' in taskData) {
      setTasks(prev => prev.map(t => t.id === taskData.id ? { ...taskData } as Task : t));
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
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
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
    setNewTaskStatus(''); // Reset default status
    setIsModalOpen(true);
  };

  const handleAddTaskToColumn = (columnId: string) => {
    setEditingTask(null);
    setNewTaskStatus(columnId); // Set specific default status
    setIsModalOpen(true);
  };

  // CRUD Columns
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
      // Edit existing
      setColumns(prev => prev.map(c => c.id === column.id ? column : c));
    } else {
      // Add new
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
       
       // Migrate tasks
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

  // Processing Data (Sort & Filter)
  const processedTasks = useMemo(() => {
    let result = [...tasks];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.category.toLowerCase().includes(q) ||
        t.project.toLowerCase().includes(q)
      );
    }

    // Filter Project (Internal field, not the App Level Project)
    if (filterProject !== 'All') {
        result = result.filter(t => t.project === filterProject);
    }

    // Filter Category
    if (filterCategory !== 'All') {
        result = result.filter(t => t.category === filterCategory);
    }

    // Sort
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

  // --- Render ---

  if (appLoading) {
      return (
          <div className="flex h-screen items-center justify-center bg-slate-50 loading-screen">
              <div className="flex flex-col items-center gap-4 text-blue-600">
                  <Loader2 size={48} className="animate-spin" />
                  <p className="font-medium text-lg">Loading...</p>
              </div>
          </div>
      );
  }

  // 1. View: Project List
  if (!currentProject) {
      return (
          <>
            <ProjectList 
                projects={projects}
                onSelectProject={setCurrentProject}
                onAddProject={handleAddProject}
                onEditProject={handleEditProject}
                onDeleteProject={(id) => { setProjectToDelete(id); setIsDeleteProjectModalOpen(true); }}
            />
            <ProjectModal
                isOpen={isProjectModalOpen}
                onClose={() => setIsProjectModalOpen(false)}
                onSave={handleSaveProject}
                initialProject={editingProject}
            />
            <ConfirmModal
                isOpen={isDeleteProjectModalOpen}
                onClose={() => setIsDeleteProjectModalOpen(false)}
                onConfirm={handleDeleteProject}
                title="Delete Project"
                message="Are you sure you want to delete this project? All tasks inside it will be permanently deleted (Dropped)."
            />
          </>
      );
  }

  // 2. View: Kanban Board
  return (
    <div className="app-root flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="app-header bg-white border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm z-10 gap-4">
        <div className="flex items-center gap-3">
            <button 
                onClick={() => setCurrentProject(null)}
                className="btn-back p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600 transition"
                title="Back to Projects"
            >
                <ChevronLeft size={24} />
            </button>
            <div className="flex flex-col group project-info">
                <div className="flex items-center gap-2">
                    <h1 className="project-title text-xl font-bold text-gray-800 leading-none">{currentProject.name}</h1>
                    <button 
                        onClick={() => handleEditProject(currentProject)}
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
            sortOption !== 'none' || filterProject !== 'All' || filterCategory !== 'All' ? (
                 <BoardView 
                    tasks={processedTasks} 
                    columns={columns}
                    onTaskMove={() => {}} 
                    onEditTask={handleEditTask}
                    onDeleteTask={confirmDeleteTask}
                    onToggleCheck={handleToggleCheck}
                    prioritySettings={prioritySettings}
                    onAddColumn={handleAddColumn}
                    onEditColumn={handleEditColumn}
                    onDeleteColumn={handleDeleteColumn}
                    onColumnMove={() => {}} 
                    onAddTask={handleAddTaskToColumn}
                 />
            ) : (
                <BoardView 
                    tasks={processedTasks} 
                    columns={columns}
                    onTaskMove={handleTaskMove}
                    onEditTask={handleEditTask}
                    onDeleteTask={confirmDeleteTask}
                    onToggleCheck={handleToggleCheck}
                    prioritySettings={prioritySettings}
                    onAddColumn={handleAddColumn}
                    onEditColumn={handleEditColumn}
                    onDeleteColumn={handleDeleteColumn}
                    onColumnMove={handleColumnMove}
                    onAddTask={handleAddTaskToColumn}
                />
            )
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

      {/* Modals */}
      <TaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSaveTask}
        initialTask={editingTask}
        columns={columns}
        defaultStatus={newTaskStatus}
      />
      
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSave={handleSaveProject}
        initialProject={editingProject}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={prioritySettings}
        onSave={setPrioritySettings}
        onReset={() => setPrioritySettings(DEFAULT_PRIORITY_SETTINGS)}
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
    </div>
  );
};

export default App;
