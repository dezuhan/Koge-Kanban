import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import { X, Check } from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Pick<Project, 'id' | 'name' | 'description' | 'color'>) => void;
  initialProject?: Project | null;
}

const COLORS = [
  { name: 'Blue', value: 'blue', class: 'bg-blue-500' },
  { name: 'Red', value: 'red', class: 'bg-red-500' },
  { name: 'Green', value: 'green', class: 'bg-green-500' },
  { name: 'Amber', value: 'amber', class: 'bg-amber-500' },
  { name: 'Purple', value: 'purple', class: 'bg-purple-500' },
  { name: 'Pink', value: 'pink', class: 'bg-pink-500' },
  { name: 'Indigo', value: 'indigo', class: 'bg-indigo-500' },
  { name: 'Cyan', value: 'cyan', class: 'bg-cyan-500' },
  { name: 'Teal', value: 'teal', class: 'bg-teal-500' },
  { name: 'Orange', value: 'orange', class: 'bg-orange-500' },
  { name: 'Dark', value: 'dark', class: 'bg-gray-800' },
];

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onSave, initialProject }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');

  useEffect(() => {
    if (initialProject) {
      setName(initialProject.name);
      setDescription(initialProject.description);
      setSelectedColor(initialProject.color || 'blue');
    } else {
      setName('');
      setDescription('');
      setSelectedColor('blue');
    }
  }, [initialProject, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: initialProject ? initialProject.id : crypto.randomUUID(),
      name,
      description,
      color: selectedColor,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="project-modal fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
      <div className="project-modal-container bg-white md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
        <div className="project-modal-header flex justify-between items-center p-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">{initialProject ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} className="btn-close p-1 hover:bg-gray-100 rounded-full text-gray-500 transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="project-modal-form flex-1 overflow-y-auto p-6 space-y-4">
          <div className="form-group">
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-name w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Website Redesign"
            />
          </div>

          <div className="form-group">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-desc w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
              placeholder="Brief description of the project..."
            />
          </div>

          <div className="form-group">
            <label className="block text-sm font-medium text-gray-700 mb-2">Project Color</label>
            <div className="flex flex-wrap gap-3">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  className={`w-8 h-8 rounded-full ${color.class} flex items-center justify-center transition-transform hover:scale-110 ${
                    selectedColor === color.value ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : ''
                  }`}
                  title={color.name}
                >
                  {selectedColor === color.value && <Check size={14} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="project-modal-footer flex justify-end pt-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-cancel px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-save px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;