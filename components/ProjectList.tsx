import React, { useState, useEffect, useMemo } from 'react';
import { Project, Task, Priority } from '../types';
import { Folder, Plus, ArrowRight, Trash2, Calendar, Layout, Edit2, Github, Linkedin, Instagram, Coffee, AlertCircle, Clock, Zap } from 'lucide-react';
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
    let tasks = globalTasks.filter(t => !t.isCompleted);
    
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

    return tasks.slice(0, 4); // Only show top 4 critical tasks
  }, [globalTasks, dashboardFilter]);

  const getPriorityColor = (priority: Priority) => {
      switch(priority) {
          case Priority.HIGH: return 'text-red-600 bg-red-50 border-red-100';
          case Priority.MEDIUM: return 'text-amber-600 bg-amber-50 border-amber-100';
          default: return 'text-blue-600 bg-blue-50 border-blue-100';
      }
  };

  return (
    <div className="project-list-view max-w-6xl mx-auto p-8 min-h-screen flex flex-col">
      <div className="project-list-header flex justify-between items-center mb-10">
        <div>
           <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
             <div className="bg-blue-600 p-2 rounded-lg text-white">
                <Layout size={28} />
             </div>
             Workspace
           </h1>
           <p className="text-gray-500 mt-2">Manage your kanban boards and monitor critical tasks.</p>
        </div>
        <button 
          onClick={onAddProject}
          className="btn-new-project bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 shadow-sm font-medium"
        >
          <Plus size={20} /> New Project
        </button>
      </div>

      {/* Attention Dashboard Section */}
      {globalTasks.length > 0 && (
          <div className="dashboard-section mb-12 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/30">
                  <div className="flex items-center gap-2">
                      <div className="bg-amber-100 text-amber-600 p-1.5 rounded-lg">
                        <AlertCircle size={20} />
                      </div>
                      <h2 className="font-bold text-gray-800">Attention Needed</h2>
                  </div>
                  <div className="flex bg-gray-100 p-1 rounded-lg self-start">
                      <button 
                        onClick={() => setDashboardFilter('dueDate')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${dashboardFilter === 'dueDate' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        <Clock size={14} /> Due Date
                      </button>
                      <button 
                        onClick={() => setDashboardFilter('priority')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${dashboardFilter === 'priority' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        <Zap size={14} /> Priority
                      </button>
                  </div>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {loadingTasks ? (
                      Array(4).fill(0).map((_, i) => (
                          <div key={i} className="h-24 bg-gray-50 rounded-xl animate-pulse"></div>
                      ))
                  ) : sortedDashboardTasks.length > 0 ? (
                      sortedDashboardTasks.map(task => (
                          <div key={task.id} className="dashboard-task-card p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group relative cursor-default">
                              <div className="flex justify-between items-start mb-2">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${getPriorityColor(task.priority)}`}>
                                      {task.priority}
                                  </span>
                                  {task.dueDate && (
                                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                          <Clock size={10} /> {new Date(task.dueDate).toLocaleDateString()}
                                      </span>
                                  )}
                              </div>
                              <h3 className="text-sm font-bold text-gray-800 truncate mb-1 group-hover:text-blue-600 transition-colors">{task.title}</h3>
                              <div className="flex items-center justify-between mt-3">
                                  <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded font-medium truncate max-w-[100px]">
                                      {task.project}
                                  </span>
                                  <button 
                                    className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                        const proj = projects.find(p => p.name === task.project);
                                        if (proj) onSelectProject(proj);
                                    }}
                                    title="Go to project"
                                  >
                                    <ArrowRight size={14} />
                                  </button>
                              </div>
                          </div>
                      ))
                  ) : (
                      <div className="col-span-full py-4 text-center text-gray-400 text-sm">
                          No pending tasks found. Good job!
                      </div>
                  )}
              </div>
          </div>
      )}

      <div className="flex-1">
        <div className="section-title flex items-center gap-2 mb-6">
            <Folder className="text-gray-400" size={20} />
            <h2 className="text-lg font-bold text-gray-700">My Boards</h2>
        </div>
        
        {projects.length === 0 ? (
          <div className="project-list-empty text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
             <Folder size={64} className="mx-auto text-gray-300 mb-4" />
             <h3 className="text-xl font-medium text-gray-500">No projects yet</h3>
             <p className="text-gray-400 mb-6">Create your first project to get started.</p>
             <button 
                onClick={onAddProject}
                className="btn-create-now text-blue-600 font-medium hover:underline"
             >
               Create a project now
             </button>
          </div>
        ) : (
          <div className="project-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <div 
                key={project.id} 
                className="project-card group bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col h-48 relative"
                onClick={() => onSelectProject(project)}
              >
                <div className="project-card-body p-5 flex-1">
                  <div className="flex justify-between items-start mb-2">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                          <Folder size={20} />
                      </div>
                      <div className="project-actions flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onEditProject(project); }}
                            className="btn-edit-project p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit Project"
                          >
                              <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                            className="btn-delete-project p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="Delete Project"
                          >
                              <Trash2 size={16} />
                          </button>
                      </div>
                  </div>
                  <h3 className="project-name font-bold text-gray-800 text-lg mb-1 truncate">{project.name}</h3>
                  <p className="project-desc text-sm text-gray-500 line-clamp-2">{project.description || "No description"}</p>
                </div>
                
                <div className="project-card-footer px-5 py-4 border-t border-gray-50 flex justify-between items-center bg-gray-50/50 rounded-b-xl">
                   <div className="project-date flex items-center gap-1.5 text-xs text-gray-400">
                      <Calendar size={12} />
                      <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                   </div>
                   <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:translate-x-1 transition-transform">
                      Open Board <ArrowRight size={12} />
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Social Media & Donate Footer */}
      <footer className="mt-12 pt-8 border-t border-gray-100">
         <div className="flex flex-col items-center gap-5 text-gray-500">
            <div className="flex items-center gap-6">
               <a 
                  href="https://instagram.com/dezuhan" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-pink-600 transition-colors transform hover:scale-110" 
                  title="Instagram"
               >
                  <Instagram size={24} />
               </a>
               <a 
                  href="https://github.com/dezuhan" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-gray-900 transition-colors transform hover:scale-110" 
                  title="GitHub"
               >
                  <Github size={24} />
               </a>
               <a 
                  href="https://linkedin.com/in/dzuhan" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-blue-700 transition-colors transform hover:scale-110" 
                  title="LinkedIn"
               >
                  <Linkedin size={24} />
               </a>
               
               <div className="w-px h-6 bg-gray-300 mx-1"></div>

               <a 
                  href="https://ko-fi.com/dezuhan" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-2 bg-[#FF5E5B] text-white px-4 py-1.5 rounded-full hover:bg-[#ff4642] transition-all shadow-sm hover:shadow-md font-medium text-sm transform hover:-translate-y-0.5" 
                  title="Support on Ko-fi"
               >
                  <Coffee size={18} />
                  <span>Donate</span>
               </a>
            </div>
            <p className="text-xs text-gray-400">
               © {new Date().getFullYear()} Developed by <span className="font-semibold text-gray-500">Dezuhan</span>
            </p>
         </div>
      </footer>
    </div>
  );
};

export default ProjectList;