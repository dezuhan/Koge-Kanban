import React, { useState, useEffect, useRef } from 'react';
import { Project } from '../types';
import { X, Check, Users, Search, Trash2, Mail, Loader2, Eye, Edit3, ChevronDown } from 'lucide-react';
import { db } from '../services/db';

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
  const [activeTab, setActiveTab] = useState<'details' | 'share'>('details');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');

  // Sharing state
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [selectedPermission, setSelectedPermission] = useState<'editor' | 'view'>('editor');
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialProject) {
      setName(initialProject.name);
      setDescription(initialProject.description);
      setSelectedColor(initialProject.color || 'blue');
      loadMembers();
    } else {
      setName('');
      setDescription('');
      setSelectedColor('blue');
      setActiveTab('details');
    }
  }, [initialProject, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setEditingMemberId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadMembers = async () => {
    if (initialProject) {
      try {
        const data = await db.sharing.getMembers(initialProject.id);
        setMembers(data);
      } catch (e) {
        console.error("Failed to load members", e);
      }
    }
  };

  const handleSearch = async (val: string) => {
    setUserSearch(val);
    if (val.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await db.users.search(val);
      setSearchResults(results);
    } catch (e) {
      console.error("Search failed", e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleShare = async (user: any) => {
    if (!initialProject) return;
    try {
      await db.sharing.shareProject(initialProject.id, user.id, selectedPermission);
      setUserSearch('');
      setSearchResults([]);
      loadMembers();
    } catch (e) {
      alert("Failed to share project");
    }
  };

  const handleUpdatePermission = async (userId: number, permissions: string) => {
    if (!initialProject) return;
    try {
      await db.sharing.updateMemberPermission(initialProject.id, userId, permissions);
      setEditingMemberId(null);
      loadMembers();
    } catch (e: any) {
      alert(e.message || "Failed to update permission");
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!initialProject) return;
    try {
      await db.sharing.removeMember(initialProject.id, userId);
      loadMembers();
    } catch (e) {
      alert("Failed to remove member");
    }
  };

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
    <div className="project-modal fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200">
      <div className={`project-modal-container bg-white md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-lg flex flex-col scale-in duration-300 ${activeTab === 'details' ? 'overflow-hidden' : ''}`}>
        <div className="project-modal-header p-4 border-b border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">{initialProject ? 'Project Settings' : 'New Project'}</h2>
            <button onClick={onClose} className="btn-close p-1 hover:bg-gray-100 rounded-full text-gray-500 transition">
              <X size={20} />
            </button>
          </div>

          {initialProject && (
            <div className="flex bg-gray-50 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('details')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'details' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Project Details
              </button>
              <button
                onClick={() => setActiveTab('share')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'share' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Users size={16} />
                Share Project
              </button>
            </div>
          )}
        </div>

        {activeTab === 'details' ? (
          <form onSubmit={handleSubmit} className="project-modal-form p-6 space-y-5">
            <div className="form-group">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Project Name</label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-name w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                placeholder="e.g., Q1 Marketing Plan"
              />
            </div>

            <div className="form-group">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-desc w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 h-24 resize-none transition-all"
                placeholder="What is this board for?"
              />
            </div>

            <div className="form-group">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Board Theme</label>
              <div className="flex flex-wrap gap-3 p-1">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setSelectedColor(color.value)}
                    className={`w-9 h-9 rounded-full ${color.class} flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm ${selectedColor === color.value ? 'ring-4 ring-blue-100 ring-offset-0 scale-110' : 'opacity-80 hover:opacity-100'
                      }`}
                    title={color.name}
                  >
                    {selectedColor === color.value && <Check size={18} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="project-modal-footer flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 active:translate-y-[1px]"
              >
                {initialProject ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Add Collaborator</label>
                <div className="relative">
                  <select
                    value={selectedPermission}
                    onChange={(e) => setSelectedPermission(e.target.value as any)}
                    className="appearance-none bg-gray-50 border border-gray-200 rounded-lg px-3 pr-8 py-1.5 text-[10px] font-black uppercase tracking-wider text-blue-600 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 cursor-pointer transition-all"
                  >
                    <option value="editor">Editor</option>
                    <option value="view">View Only</option>
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
                </div>
              </div>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                </div>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                  placeholder="Search by username or email..."
                />

                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in slide-in-from-top-2">
                    {searchResults.map(user => (
                      <button
                        key={user.id}
                        onClick={() => handleShare(user)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors group text-left"
                      >
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold group-hover:bg-blue-200">
                          {user.username[0].toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-bold text-gray-800">{user.username}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </div>
                        <div className="text-[10px] font-black text-blue-500 opacity-0 group-hover:opacity-100 uppercase">+ Add as {selectedPermission}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Project Members ({members.length})</label>
              <div className="max-h-[320px] overflow-y-auto space-y-2 custom-scrollbar pr-1 pb-24">
                {members.map((member, idx) => (
                  <div key={`${member.id}-${idx}`} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${member.isAdmin ? 'bg-blue-50/50 border-blue-100 ring-1 ring-blue-50' : 'bg-gray-50 border-gray-100 group'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 border rounded-full flex items-center justify-center font-bold text-xs ${member.isAdmin ? 'bg-white border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-600'}`}>
                        {member.username[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-bold text-gray-800">{member.username}</div>
                          {member.isAdmin && <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-black uppercase">Owner</span>}
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-1 font-medium">
                          <Mail size={10} /> {member.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {member.isAdmin ? (
                        <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-600">
                          Owner
                        </div>
                      ) : (
                        <div className="relative" ref={editingMemberId === member.id ? dropdownRef : null}>
                          <button
                            onClick={() => setEditingMemberId(editingMemberId === member.id ? null : member.id)}
                            className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${member.permissions === 'editor' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              }`}
                          >
                            {member.permissions === 'editor' ? <Edit3 size={10} /> : <Eye size={10} />}
                            {member.permissions === 'view' ? 'View Only' : 'Editor'}
                            <ChevronDown size={10} className={editingMemberId === member.id ? 'rotate-180 transition-transform' : 'transition-transform'} />
                          </button>

                          {editingMemberId === member.id && (
                            <div className="absolute top-full right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-[110] overflow-hidden min-w-[120px] animate-in slide-in-from-top-1">
                              <button
                                onClick={() => handleUpdatePermission(member.id, 'editor')}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-left hover:bg-blue-50 ${member.permissions === 'editor' ? 'text-blue-600' : 'text-gray-600'}`}
                              >
                                <Edit3 size={10} /> Editor {member.permissions === 'editor' && <Check size={10} className="ml-auto" />}
                              </button>
                              <button
                                onClick={() => handleUpdatePermission(member.id, 'view')}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-left hover:bg-blue-50 ${member.permissions === 'view' ? 'text-blue-600' : 'text-gray-600'}`}
                              >
                                <Eye size={10} /> View Only {member.permissions === 'view' && <Check size={10} className="ml-auto" />}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {!member.isAdmin && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={onClose}
                className="w-full py-3 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
              >
                Done Managing Members
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectModal;