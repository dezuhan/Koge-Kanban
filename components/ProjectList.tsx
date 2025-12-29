import React from 'react';
import { Project } from '../types';
import { Folder, Plus, ArrowRight, Trash2, Calendar, Layout, Edit2 } from 'lucide-react';

interface ProjectListProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onAddProject: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ projects, onSelectProject, onAddProject, onEditProject, onDeleteProject }) => {
  return (
    <div className="project-list-view max-w-6xl mx-auto p-8">
      <div className="project-list-header flex justify-between items-center mb-8">
        <div>
           <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
             <div className="bg-blue-600 p-2 rounded-lg text-white">
                <Layout size={28} />
             </div>
             My Projects
           </h1>
           <p className="text-gray-500 mt-2">Manage your kanban boards and workspaces.</p>
        </div>
        <button 
          onClick={onAddProject}
          className="btn-new-project bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 shadow-sm font-medium"
        >
          <Plus size={20} /> New Project
        </button>
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
  );
};

export default ProjectList;