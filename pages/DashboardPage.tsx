import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectList from '../components/ProjectList';
import ProjectModal from '../components/ProjectModal';
import ConfirmModal from '../components/ConfirmModal';
import { Project, Column, Priority, Task } from '../types';
import { useApp } from '../context/AppContext';
import { db } from '../services/db';
import { dropProjectData } from '../utils/cleanup';

// Re-define TEMPLATE_COLUMNS locally or import if shared
const TEMPLATE_COLUMNS: Column[] = [
  { id: 'Draft', title: 'DRAFT', color: '#94a3b8' },
  { id: 'To Do', title: 'TO-DO', color: '#f59e0b' },
  { id: 'On Going', title: 'ON GOING', color: '#3b82f6' },
  { id: 'Complete', title: 'COMPLETE', color: '#22c55e' }
];

const DashboardPage: React.FC = () => {
  const { projects, setProjects } = useApp();
  const navigate = useNavigate();
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isDeleteProjectModalOpen, setIsDeleteProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  const handleProjectSelect = (project: Project, taskId?: string) => {
      // Navigate to project board
      // If taskId is present, append it to URL
      if (taskId) {
          navigate(`/board/${project.id}/task/${taskId}`);
      } else {
          navigate(`/board/${project.id}`);
      }
  };

  const handleAddProject = () => {
    setEditingProject(null);
    setIsProjectModalOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setIsProjectModalOpen(true);
  };

  const handleSaveProject = (projectData: Pick<Project, 'id' | 'name' | 'description'>) => {
    setProjects(prev => {
        const exists = prev.some(p => p.id === projectData.id);
        let updatedProjects;
        if (exists) {
            updatedProjects = prev.map(p => p.id === projectData.id ? { ...p, ...projectData } as Project : p);
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

  const handleDeleteProject = () => {
      if (!projectToDelete) return;
      dropProjectData(projectToDelete);
      setProjects(prev => prev.filter(p => p.id !== projectToDelete));
      setProjectToDelete(null);
      setIsDeleteProjectModalOpen(false);
  };

  return (
    <>
        <ProjectList 
            projects={projects}
            onSelectProject={handleProjectSelect}
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
};

export default DashboardPage;

