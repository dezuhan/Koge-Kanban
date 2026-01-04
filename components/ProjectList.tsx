import React, { useState, useEffect, useMemo } from 'react';
import { Project, Task, Priority } from '../types';
import { Folder, Plus, ArrowRight, Trash2, Calendar, Layout, Edit2, Github, Linkedin, Instagram, Coffee, AlertCircle, Clock, Zap, Target, List, Grid, User } from 'lucide-react';
import { db } from '../services/db';

interface ProjectListProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onAddProject: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ projects, onSelectProject, onAddProject, onEditProject, onDeleteProject }) => {
  const [globalTasks, setGlobalTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [dashboardFilter, setDashboardFilter] = useState<'dueDate' | 'priority'>('dueDate');
  const [dashboardView, setDashboardView] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const fetchGlobalTasks = async () => {
        setLoadingTasks(true);
        try {
            // Mengambil semua task dari database MariaDB melalui server
            const tasks = await db.getAllGlobalTasks();
            setGlobalTasks(tasks || []);
        } catch (err) {
            console.error("Failed to load global tasks", err);
        } finally {
            setLoadingTasks(false);
        }
    };
    fetchGlobalTasks();
  }, []);

  const sortedDashboardTasks = useMemo(() => {
    // FILTER: Hanya ambil task yang checkbox "Mark main task as completed" bernilai FALSE
    // Serta memastikan kita hanya mengambil task yang aktif (bukan completed)
    let tasks = globalTasks.filter(t => t.isCompleted === false);
    
    // Sorting logic
    if (dashboardFilter === 'dueDate') {
        tasks.sort((a, b) => {
            const dateA = a.dueDate || Infinity;
            const dateB = b.dueDate || Infinity;
            return dateA - dateB;
        });
    } else {
        const pMap = { [Priority.HIGH]: 3, [Priority.MEDIUM]: 2, [Priority.LOW]: 1 };
        tasks.sort((a, b) => pMap[b.priority] - pMap[a.priority]);
    }

    return tasks.slice(0, 8); // Menampilkan 8 task teratas
  }, [globalTasks, dashboardFilter]);

  const getPriorityStyle = (priority: Priority) => {
      switch(priority) {
          case Priority.HIGH: return 'text-red-600 bg-red-50 border-red-100';
          case Priority.MEDIUM: return 'text-amber-600 bg-amber-50 border-amber-100';
          default: return 'text-blue-600 bg-blue-50 border-blue-100';
      }
  };

  const getInitials = (name: string) => {
      if (!name) return '?';
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Helper untuk mencari project yang sesuai agar navigasi tidak error
  const navigateToTaskProject = (task: Task) => {
    // Cari berdasarkan ID project atau Nama project
    const project = projects.find(p => p.id === task.project || p.name === task.project);
    if (project) {
        onSelectProject(project);
    } else {
        console.warn("Project not found for task:", task.project);
    }
  };

  return (
    <div className="project-list-view max-w-6xl mx-auto p-8 min-h-screen flex flex-col">
      {/* SECTION 1: HEADER */}
      <div className="project-list-header flex justify-between items-center mb-10">
        <div>
           <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
             <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-100">
                <Layout size={28} />
             </div>
             My Projects
           </h1>
           <p className="text-gray-500 mt-1 font-medium">Manage your kanban boards and workspaces.</p>
        </div>
        <button 
          onClick={onAddProject}
          className="btn-new-project bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition flex items-center gap-2 shadow-md hover:shadow-xl font-bold"
        >
          <Plus size={20} /> New Project
        </button>
      </div>

      {/* SECTION 2: RECENT TASKS DASHBOARD */}
      <div className="dashboard-container mb-14 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="dashboard-header px-6 py-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/40">
            <div className="flex items-center gap-2.5">
                <div className="bg-blue-500 text-white p-1.5 rounded-lg shadow-sm">
                    <Clock size={20} />
                </div>
                <h2 className="font-extrabold text-gray-800 text-xl tracking-tight">Recent Tasks</h2>
            </div>

            <div className="dashboard-controls flex items-center gap-4">
                <div className="flex bg-gray-200/50 p-1 rounded-xl border border-gray-200/50">
                    <button 
                        onClick={() => setDashboardFilter('dueDate')}
                        className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${dashboardFilter === 'dueDate' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        By Date
                    </button>
                    <button 
                        onClick={() => setDashboardFilter('priority')}
                        className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${dashboardFilter === 'priority' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        By Priority
                    </button>
                </div>

                <div className="w-px h-8 bg-gray-200"></div>

                <div className="flex bg-gray-200/50 p-1 rounded-xl border border-gray-200/50">
                    <button 
                        onClick={() => setDashboardView('grid')}
                        className={`p-2 rounded-lg transition-all ${dashboardView === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        title="Board View"
                    >
                        <Grid size={18} />
                    </button>
                    <button 
                        onClick={() => setDashboardView('list')}
                        className={`p-2 rounded-lg transition-all ${dashboardView === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        title="List View"
                    >
                        <List size={18} />
                    </button>
                </div>
            </div>
        </div>

        <div className="dashboard-content p-6 min-h-[200px]">
            {loadingTasks ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-gray-400 font-medium">Scanning local projects...</span>
                </div>
            ) : sortedDashboardTasks.length > 0 ? (
                dashboardView === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {sortedDashboardTasks.map(task => (
                            <div 
                                key={task.id} 
                                onClick={() => navigateToTaskProject(task)}
                                className="group relative bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer flex flex-col h-full ring-1 ring-transparent hover:ring-blue-100"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg">
                                        <Folder size={12} fill="currentColor" className="opacity-40" />
                                        <span className="text-[10px] font-black uppercase tracking-tight truncate max-w-[100px]">
                                            {task.project}
                                        </span>
                                    </div>
                                    <div className="px-2 py-0.5 rounded text-[9px] font-black bg-slate-100 text-slate-500 border border-slate-200 uppercase">
                                        {task.status}
                                    </div>
                                </div>
                                
                                <h3 className="text-sm font-bold text-gray-800 mb-6 flex-1 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                                    {task.title}
                                </h3>

                                <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {task.assignee ? (
                                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shadow-sm" title={task.assignee}>
                                                {getInitials(task.assignee)}
                                            </div>
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-300 flex items-center justify-center border border-gray-200">
                                                <User size={12} />
                                            </div>
                                        )}
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${getPriorityStyle(task.priority)}`}>
                                            {task.priority}
                                        </span>
                                    </div>

                                    {task.dueDate && (
                                        <div className={`text-[10px] font-bold flex items-center gap-1 ${new Date(task.dueDate) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
                                            <Calendar size={12} />
                                            {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sortedDashboardTasks.map(task => (
                            <div 
                                key={task.id}
                                onClick={() => navigateToTaskProject(task)}
                                className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer group"
                            >
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className={`w-1.5 h-10 rounded-full ${task.priority === Priority.HIGH ? 'bg-red-500' : task.priority === Priority.MEDIUM ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-gray-800 text-sm truncate group-hover:text-blue-600 transition-colors">{task.title}</h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1 uppercase bg-blue-50 px-2 py-0.5 rounded-md">
                                                <Folder size={10} /> {task.project}
                                            </span>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter px-2 py-0.5 bg-gray-100 rounded-md border border-gray-200">
                                                {task.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 ml-4">
                                    {task.dueDate && (
                                        <div className={`flex items-center gap-1.5 text-xs font-bold ${new Date(task.dueDate) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
                                            <Clock size={14} />
                                            {new Date(task.dueDate).toLocaleDateString()}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3 w-32 justify-end">
                                        {task.assignee && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-gray-400 hidden sm:inline">{task.assignee}</span>
                                                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-md border-2 border-white">
                                                    {getInitials(task.assignee)}
                                                </div>
                                            </div>
                                        )}
                                        <div className="bg-gray-50 p-1.5 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">
                                            <ArrowRight size={18} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-slate-50/50 rounded-2xl border-2 border-dashed border-gray-100">
                    <Target size={48} className="mb-4 opacity-10" />
                    <p className="font-bold text-sm text-gray-400">All caught up! No active tasks found.</p>
                    <p className="text-[10px] mt-1 text-gray-300">Tasks marked as "Complete" are hidden from this view.</p>
                </div>
            )}
        </div>
      </div>

      {/* SECTION 3: BOARDS / PROJECTS */}
      <div className="flex-1">
        <div className="section-title flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
                <div className="bg-gray-800 text-white p-1 rounded-md">
                    <Folder size={18} />
                </div>
                <h2 className="text-2xl font-black text-gray-800 tracking-tight">Project Boards</h2>
                <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-black border border-blue-200">{projects.length}</span>
            </div>
        </div>
        
        {projects.length === 0 ? (
          <div className="project-list-empty text-center py-28 bg-white rounded-[2rem] border-2 border-dashed border-gray-200 shadow-sm">
             <Folder size={80} className="mx-auto text-gray-100 mb-6" />
             <h3 className="text-2xl font-bold text-gray-700 mb-2">Build your first board</h3>
             <p className="text-gray-400 mb-10 max-w-sm mx-auto font-medium">Create a new project to start organizing your workflow locally and securely.</p>
             <button 
                onClick={onAddProject}
                className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all transform hover:-translate-y-1"
             >
               + Create Project
             </button>
          </div>
        ) : (
          <div className="project-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map(project => (
              <div 
                key={project.id} 
                className="project-card group bg-white rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-2xl hover:border-blue-400 transition-all cursor-pointer flex flex-col h-56 relative overflow-hidden"
                onClick={() => onSelectProject(project)}
              >
                <div className="project-card-body p-7 flex-1">
                  <div className="flex justify-between items-start mb-5">
                      <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-sm group-hover:shadow-blue-200">
                          <Folder size={28} />
                      </div>
                      <div className="project-actions flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onEditProject(project); }}
                            className="btn-edit-project p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
                          >
                              <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                            className="btn-delete-project p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                          >
                              <Trash2 size={18} />
                          </button>
                      </div>
                  </div>
                  <h3 className="project-name font-black text-gray-800 text-xl mb-2 truncate leading-none">{project.name}</h3>
                  <p className="project-desc text-sm text-gray-500 font-medium line-clamp-2 leading-relaxed">{project.description || "Project localized in your system."}</p>
                </div>
                
                <div className="project-card-footer px-7 py-5 border-t border-gray-50 flex justify-between items-center bg-gray-50/20">
                   <div className="project-date flex items-center gap-2 text-[10px] text-gray-400 font-black uppercase tracking-wider">
                      <Calendar size={14} className="opacity-50" />
                      <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                   </div>
                   <div className="flex items-center gap-2 text-xs font-black text-blue-600 group-hover:translate-x-2 transition-transform uppercase tracking-tighter">
                      Open Workspace <ArrowRight size={16} />
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FOOTER SOSIAL MEDIA */}
      <footer className="mt-24 pt-12 border-t border-gray-100 pb-12">
         <div className="flex flex-col items-center gap-8 text-gray-400">
            <div className="flex items-center gap-8">
               <a href="https://instagram.com/dezuhan" target="_blank" className="hover:text-pink-600 transition-all transform hover:scale-125 duration-300"><Instagram size={24} /></a>
               <a href="https://github.com/dezuhan" target="_blank" className="hover:text-gray-900 transition-all transform hover:scale-125 duration-300"><Github size={24} /></a>
               <a href="https://linkedin.com/in/dzuhan" target="_blank" className="hover:text-blue-700 transition-all transform hover:scale-125 duration-300"><Linkedin size={24} /></a>
               <div className="w-px h-8 bg-gray-200 mx-2"></div>
               <a href="https://ko-fi.com/dezuhan" target="_blank" className="flex items-center gap-2 bg-[#FF5E5B] text-white px-6 py-2.5 rounded-full hover:bg-[#ff4642] transition-all shadow-lg hover:shadow-xl font-black text-sm transform hover:-translate-y-1">
                  <Coffee size={20} fill="currentColor" />
                  <span>Support Me</span>
               </a>
            </div>
            <div className="text-center flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-100 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Koge Kanban Engine v1.0</p>
                </div>
                <p className="text-[10px] font-medium text-gray-400">© {new Date().getFullYear()} Handcrafted with Passion by <span className="font-black text-gray-600 hover:text-blue-600 cursor-default">Dezuhan</span></p>
            </div>
         </div>
      </footer>
    </div>
  );
};

export default ProjectList;