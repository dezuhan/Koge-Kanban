import React, { useState, useEffect, useMemo } from 'react';
import { Project, Task, Priority } from '../types';
import { Folder, Plus, ArrowRight, Trash2, Calendar, Layout, Edit2, Github, Linkedin, Instagram, Coffee, AlertCircle, Clock, Zap, Target } from 'lucide-react';
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
    // Filter out completed tasks and sort by selected criteria
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

  const getPriorityBadgeStyle = (priority: Priority) => {
      switch(priority) {
          case Priority.HIGH: return 'text-red-600 bg-red-100/50 border-red-200';
          case Priority.MEDIUM: return 'text-amber-600 bg-amber-100/50 border-amber-200';
          default: return 'text-blue-600 bg-blue-100/50 border-blue-200';
      }
  };

  return (
    <div className="project-list-view max-w-6xl mx-auto p-8 min-h-screen flex flex-col">
      <div className="project-list-header flex justify-between items-center mb-10">
        <div>
           <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
             <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg shadow-blue-200">
                <Layout size={28} />
             </div>
             My Workspace
           </h1>
           <p className="text-gray-500 mt-2">Oversee all your boards and track urgent milestones.</p>
        </div>
        <button 
          onClick={onAddProject}
          className="btn-new-project bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition flex items-center gap-2 shadow-sm hover:shadow-lg font-semibold"
        >
          <Plus size={20} /> New Project
        </button>
      </div>

      {/* Attention Dashboard Section (Global Recent/Priority Tasks) */}
      {globalTasks.length > 0 && (
          <div className="dashboard-section mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                      <div className="bg-amber-500 text-white p-1 rounded-md">
                        <Zap size={18} fill="currentColor" />
                      </div>
                      <h2 className="text-lg font-bold text-gray-800">Priority Dashboard</h2>
                  </div>
                  
                  <div className="flex items-center bg-gray-100 p-1 rounded-xl">
                      <button 
                        onClick={() => setDashboardFilter('dueDate')}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dashboardFilter === 'dueDate' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        <Clock size={14} /> Due Date
                      </button>
                      <button 
                        onClick={() => setDashboardFilter('priority')}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dashboardFilter === 'priority' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        <Target size={14} /> Priority
                      </button>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {loadingTasks ? (
                      Array(4).fill(0).map((_, i) => (
                          <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse"></div>
                      ))
                  ) : sortedDashboardTasks.length > 0 ? (
                      sortedDashboardTasks.map(task => (
                          <div 
                            key={task.id} 
                            onClick={() => {
                                const proj = projects.find(p => p.name === task.project);
                                if (proj) onSelectProject(proj);
                            }}
                            className="group relative bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer overflow-hidden"
                          >
                              {/* Background Accent */}
                              <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50/30 rounded-full -mr-8 -mt-8 group-hover:bg-blue-100/40 transition-colors"></div>

                              <div className="flex flex-col h-full">
                                  {/* Project Badge */}
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 mb-3 uppercase tracking-wider">
                                      <Folder size={10} />
                                      {task.project}
                                  </div>

                                  <h3 className="text-sm font-bold text-gray-800 mb-4 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">
                                      {task.title}
                                  </h3>

                                  <div className="mt-auto flex items-center justify-between">
                                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase ${getPriorityBadgeStyle(task.priority)}`}>
                                          {task.priority}
                                      </div>

                                      {task.dueDate ? (
                                          <div className={`flex items-center gap-1 text-[10px] font-bold ${new Date(task.dueDate) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
                                              <Calendar size={10} />
                                              {new Date(task.dueDate).toLocaleDateString()}
                                          </div>
                                      ) : (
                                          <span className="text-[10px] text-gray-300 font-medium">No Date</span>
                                      )}
                                  </div>
                              </div>
                          </div>
                      ))
                  ) : (
                      <div className="col-span-full py-8 bg-gray-50/50 border-2 border-dashed border-gray-200 rounded-2xl text-center flex flex-col items-center gap-2">
                          <AlertCircle size={32} className="text-gray-300" />
                          <p className="text-sm text-gray-400 font-medium">No critical tasks found in any project.</p>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* Boards Section */}
      <div className="flex-1">
        <div className="section-title flex items-center gap-2 mb-6">
            <h2 className="text-lg font-bold text-gray-800">Your Projects</h2>
            <span className="bg-gray-200 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-bold">{projects.length}</span>
        </div>
        
        {projects.length === 0 ? (
          <div className="project-list-empty text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
             <Folder size={64} className="mx-auto text-gray-300 mb-4" />
             <h3 className="text-xl font-medium text-gray-500">No boards found</h3>
             <p className="text-gray-400 mb-6">Create a project to start organizing your work.</p>
             <button 
                onClick={onAddProject}
                className="btn-create-now text-blue-600 font-bold hover:underline"
             >
               Add Project Now
             </button>
          </div>
        ) : (
          <div className="project-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <div 
                key={project.id} 
                className="project-card group bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer flex flex-col h-52 relative overflow-hidden"
                onClick={() => onSelectProject(project)}
              >
                <div className="project-card-body p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                          <Folder size={24} />
                      </div>
                      <div className="project-actions flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onEditProject(project); }}
                            className="btn-edit-project p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit Project"
                          >
                              <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                            className="btn-delete-project p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="Delete Project"
                          >
                              <Trash2 size={16} />
                          </button>
                      </div>
                  </div>
                  <h3 className="project-name font-bold text-gray-800 text-xl mb-1 truncate">{project.name}</h3>
                  <p className="project-desc text-sm text-gray-500 line-clamp-2">{project.description || "No description provided."}</p>
                </div>
                
                <div className="project-card-footer px-6 py-4 border-t border-gray-50 flex justify-between items-center bg-gray-50/30">
                   <div className="project-date flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                      <Calendar size={12} />
                      <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
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

      {/* Social Media & Donate Footer */}
      <footer className="mt-16 pt-8 border-t border-gray-100">
         <div className="flex flex-col items-center gap-6 text-gray-500">
            <div className="flex items-center gap-6">
               <a 
                  href="https://instagram.com/dezuhan" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-pink-600 transition-colors transform hover:scale-125 duration-300" 
                  title="Instagram"
               >
                  <Instagram size={22} />
               </a>
               <a 
                  href="https://github.com/dezuhan" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-gray-900 transition-colors transform hover:scale-125 duration-300" 
                  title="GitHub"
               >
                  <Github size={22} />
               </a>
               <a 
                  href="https://linkedin.com/in/dzuhan" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-blue-700 transition-colors transform hover:scale-125 duration-300" 
                  title="LinkedIn"
               >
                  <Linkedin size={22} />
               </a>
               
               <div className="w-px h-6 bg-gray-200 mx-2"></div>

               <a 
                  href="https://ko-fi.com/dezuhan_" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-2 bg-[#FF5E5B] text-white px-5 py-2 rounded-full hover:bg-[#ff4642] transition-all shadow-md hover:shadow-xl font-bold text-sm transform hover:-translate-y-1" 
                  title="Support on Ko-fi"
               >
                  <Coffee size={18} fill="currentColor" />
                  <span>Donate</span>
               </a>
            </div>
            <div className="flex flex-col items-center gap-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                   KOGE KANBAN ENGINE
                </p>
                <p className="text-[10px] text-gray-300">
                   © {new Date().getFullYear()} Handcrafted by <span className="text-gray-400">Dezuhan</span>
                </p>
            </div>
         </div>
      </footer>
    </div>
  );
};

export default ProjectList;