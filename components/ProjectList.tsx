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
    // Filter: Hanya ambil task yang BELUM selesai dan TIDAK berstatus 'Complete'
    // Kita asumsikan status 'Complete' adalah ID standar untuk kolom selesai
    let tasks = globalTasks.filter(t => !t.isCompleted && t.status !== 'Complete');
    
    if (dashboardFilter === 'dueDate') {
        tasks.sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate - b.dueDate;
        });
    } else {
        const pMap = { [Priority.HIGH]: 3, [Priority.MEDIUM]: 2, [Priority.LOW]: 1 };
        tasks.sort((a, b) => pMap[b.priority] - pMap[a.priority]);
    }

    return tasks.slice(0, 8); // Tampilkan 8 task terpenting
  }, [globalTasks, dashboardFilter]);

  const getPriorityColor = (priority: Priority) => {
      switch(priority) {
          case Priority.HIGH: return 'text-red-600 bg-red-50 border-red-100';
          case Priority.MEDIUM: return 'text-amber-600 bg-amber-50 border-amber-100';
          default: return 'text-blue-600 bg-blue-50 border-blue-100';
      }
  };

  const getInitials = (name: string) => {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="project-list-view max-w-6xl mx-auto p-8 min-h-screen flex flex-col">
      {/* Top Header */}
      <div className="project-list-header flex justify-between items-center mb-8">
        <div>
           <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
             <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
                <Layout size={28} />
             </div>
             My Projects
           </h1>
           <p className="text-gray-500 mt-1">Manage your kanban boards and workspaces.</p>
        </div>
        <button 
          onClick={onAddProject}
          className="btn-new-project bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition flex items-center gap-2 shadow-md hover:shadow-xl font-bold"
        >
          <Plus size={20} /> New Project
        </button>
      </div>

      {/* RECENT TASKS DASHBOARD (Based on Sketch) */}
      <div className="dashboard-container mb-12 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="dashboard-header p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
            <div className="flex items-center gap-2">
                <div className="bg-blue-100 text-blue-600 p-1.5 rounded-lg">
                    <Clock size={20} />
                </div>
                <h2 className="font-bold text-gray-800 text-lg">Recent Tasks</h2>
            </div>

            <div className="dashboard-controls flex items-center gap-4">
                {/* Filter Selector */}
                <div className="flex bg-gray-200/60 p-1 rounded-xl">
                    <button 
                        onClick={() => setDashboardFilter('dueDate')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dashboardFilter === 'dueDate' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        By Date
                    </button>
                    <button 
                        onClick={() => setDashboardFilter('priority')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dashboardFilter === 'priority' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        By Priority
                    </button>
                </div>

                <div className="w-px h-6 bg-gray-200"></div>

                {/* View Mode Switcher */}
                <div className="flex bg-gray-200/60 p-1 rounded-xl">
                    <button 
                        onClick={() => setDashboardView('grid')}
                        className={`p-1.5 rounded-lg transition-all ${dashboardView === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        title="Board View"
                    >
                        <Grid size={18} />
                    </button>
                    <button 
                        onClick={() => setDashboardView('list')}
                        className={`p-1.5 rounded-lg transition-all ${dashboardView === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        title="List View"
                    >
                        <List size={18} />
                    </button>
                </div>
            </div>
        </div>

        <div className="dashboard-content p-6">
            {loadingTasks ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : sortedDashboardTasks.length > 0 ? (
                dashboardView === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {sortedDashboardTasks.map(task => (
                            <div 
                                key={task.id} 
                                onClick={() => {
                                    const proj = projects.find(p => p.name === task.project);
                                    if (proj) onSelectProject(proj);
                                }}
                                className="group bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer flex flex-col h-full"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1">
                                        <Folder size={10} /> {task.project}
                                    </span>
                                    <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                        {task.status}
                                    </div>
                                </div>
                                
                                <h3 className="text-sm font-bold text-gray-800 mb-4 flex-1 line-clamp-2 group-hover:text-blue-600 transition-colors">
                                    {task.title}
                                </h3>

                                <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {task.assignee ? (
                                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold border border-blue-200" title={task.assignee}>
                                                {getInitials(task.assignee)}
                                            </div>
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center border border-gray-200">
                                                <User size={10} />
                                            </div>
                                        )}
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getPriorityColor(task.priority)}`}>
                                            {task.priority}
                                        </span>
                                    </div>

                                    {task.dueDate && (
                                        <div className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                            <Calendar size={10} />
                                            {new Date(task.dueDate).toLocaleDateString()}
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
                                onClick={() => {
                                    const proj = projects.find(p => p.name === task.project);
                                    if (proj) onSelectProject(proj);
                                }}
                                className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:shadow-md hover:border-blue-100 transition-all cursor-pointer group"
                            >
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className={`w-2 h-10 rounded-full ${task.priority === Priority.HIGH ? 'bg-red-400' : task.priority === Priority.MEDIUM ? 'bg-amber-400' : 'bg-blue-400'}`}></div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-gray-800 text-sm truncate group-hover:text-blue-600 transition-colors">{task.title}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                                                <Folder size={10} /> {task.project}
                                            </span>
                                            <span className="text-[10px] text-gray-300">•</span>
                                            <span className="text-[10px] font-medium text-gray-400">{task.status}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 ml-4">
                                    {task.dueDate && (
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                                            <Calendar size={14} />
                                            {new Date(task.dueDate).toLocaleDateString()}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 w-24 justify-end">
                                        {task.assignee && (
                                            <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold border border-blue-100">
                                                {getInitials(task.assignee)}
                                            </div>
                                        )}
                                        <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <Target size={48} className="mb-4 opacity-20" />
                    <p className="font-medium">
                        {globalTasks.length === 0 ? "No tasks found in database." : "No pending tasks to display."}
                    </p>
                    <p className="text-xs mt-2 text-gray-300">Total Tasks: {globalTasks.length}</p>
                </div>
            )}
        </div>
      </div>

      {/* BOARDS / PROJECTS SECTION */}
      <div className="flex-1">
        <div className="section-title flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-800">My Boards</h2>
                <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full font-bold">{projects.length}</span>
            </div>
        </div>
        
        {projects.length === 0 ? (
          <div className="project-list-empty text-center py-24 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
             <Folder size={64} className="mx-auto text-gray-300 mb-4" />
             <h3 className="text-xl font-bold text-gray-500">No Projects Found</h3>
             <p className="text-gray-400 mb-8 max-w-xs mx-auto">Create a new project to start organizing your tasks locally and privately.</p>
             <button 
                onClick={onAddProject}
                className="btn-create-now text-blue-600 font-bold hover:text-blue-800 transition-colors"
             >
               + Create your first project
             </button>
          </div>
        ) : (
          <div className="project-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <div 
                key={project.id} 
                className="project-card group bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer flex flex-col h-[15rem] relative overflow-hidden"
                onClick={() => onSelectProject(project)}
              >
                <div className="project-card-body p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm">
                          <Folder size={24} />
                      </div>
                      <div className="project-actions flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onEditProject(project); }}
                            className="btn-edit-project p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          >
                              <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                            className="btn-delete-project p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                          >
                              <Trash2 size={16} />
                          </button>
                      </div>
                  </div>
                  <h3 className="project-name font-bold text-gray-800 text-xl mb-1 truncate">{project.name}</h3>
                  <p className="project-desc text-sm text-gray-500 line-clamp-2">{project.description || "Manage your local tasks securely."}</p>
                </div>
                
                <div className="project-card-footer px-6 py-4 border-t border-gray-50 flex justify-between items-center bg-gray-50/30">
                   <div className="project-date flex items-center gap-1.5 text-xs text-gray-400 font-bold">
                      <Calendar size={12} />
                      <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                   </div>
                   <div className="flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                      Open Board <ArrowRight size={14} />
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className="mt-20 pt-10 border-t border-gray-100">
         <div className="flex flex-col items-center gap-6 text-gray-400">
            <div className="flex items-center gap-6">
               <a href="https://instagram.com/dezuhan" target="_blank" className="hover:text-pink-600 transition-all transform hover:scale-125"><Instagram size={22} /></a>
               <a href="https://github.com/dezuhan" target="_blank" className="hover:text-gray-900 transition-all transform hover:scale-125"><Github size={22} /></a>
               <a href="https://linkedin.com/in/dzuhan" target="_blank" className="hover:text-blue-700 transition-all transform hover:scale-125"><Linkedin size={22} /></a>
               <div className="w-px h-6 bg-gray-200 mx-2"></div>
               <a href="https://ko-fi.com/dezuhan" target="_blank" className="flex items-center gap-2 bg-[#FF5E5B] text-white px-5 py-2 rounded-full hover:bg-[#ff4642] transition-all shadow-md hover:shadow-xl font-bold text-sm transform hover:-translate-y-1">
                  <Coffee size={18} fill="currentColor" />
                  <span>Donate</span>
               </a>
            </div>
            <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">KOGE KANBAN ENGINE</p>
                <p className="text-[10px]">© {new Date().getFullYear()} Handcrafted with Love by <span className="font-bold text-gray-600">Dezuhan</span></p>
            </div>
         </div>
      </footer>
    </div>
  );
};

export default ProjectList;