import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Folder, Calendar, User, X, Clock, Target, ArrowRight } from 'lucide-react';
import { Task, Project, Priority } from '../types';
import { db } from '../services/db';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { projects, alert: globalAlert } = useApp();
  const [query, setQuery] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchAllTasks = async () => {
        setLoading(true);
        try {
          const allTasks = await db.getAllGlobalTasks();
          setTasks(allTasks || []);
        } catch (err) {
          console.error("Failed to fetch tasks for search", err);
        } finally {
          setLoading(false);
        }
      };
      fetchAllTasks();
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    
    // Smart keywords
    const isHigh = q.includes('p:high') || q.includes('priority:high');
    const isMedium = q.includes('p:medium') || q.includes('priority:medium');
    const isLow = q.includes('p:low') || q.includes('priority:low');
    
    const cleanQuery = q
        .replace(/p:(high|medium|low)/g, '')
        .replace(/priority:(high|medium|low)/g, '')
        .trim();

    return tasks.filter(task => {
        const matchesQuery = !cleanQuery || 
            task.title.toLowerCase().includes(cleanQuery) ||
            task.description.toLowerCase().includes(cleanQuery) ||
            task.project.toLowerCase().includes(cleanQuery) ||
            (task.category && task.category.toLowerCase().includes(cleanQuery)) ||
            (task.assignee && task.assignee.toLowerCase().includes(cleanQuery));
        
        let matchesPriority = true;
        if (isHigh) matchesPriority = task.priority === Priority.HIGH;
        if (isMedium) matchesPriority = task.priority === Priority.MEDIUM;
        if (isLow) matchesPriority = task.priority === Priority.LOW;

        return matchesQuery && matchesPriority;
    });
  }, [tasks, query]);

  const handleTaskClick = (task: Task) => {
    if (!projects) return;
    
    let proj = (task as any)._projectId 
        ? projects.find(p => p.id === (task as any)._projectId)
        : undefined;

    if (!proj) proj = projects.find(p => p.id === task.project || p.name === task.project);

    if (proj) {
        onClose();
        navigate(`/board/${proj.id}/task/${task.id}`);
    } else {
        globalAlert({
          title: 'Project Not Found',
          message: `Could not find project "${task.project}" for this task.`,
          type: 'danger'
        });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="bg-white w-full md:max-w-4xl lg:max-w-5xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in zoom-in-95 slide-in-from-top-4 duration-300 z-10 flex flex-col max-h-[85vh]">
        {/* Search Header */}
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <Search size={22} className="text-blue-500" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search tasks, descriptions, or projects... (try 'p:high')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-lg text-gray-800 placeholder:text-gray-400 font-medium"
          />
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
               <p className="text-sm font-medium">Indexing tasks...</p>
            </div>
          ) : query.trim() === '' ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
               <Clock size={48} className="mb-4 opacity-20" />
               <p className="text-sm font-medium">Type to search across all boards</p>
               <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold uppercase tracking-wider">p:high</span>
                  <span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold uppercase tracking-wider">assignee:me</span>
                  <span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold uppercase tracking-wider">category:feature</span>
               </div>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              <div className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                Found {results.length} tasks
              </div>
              {results.map(task => (
                <button
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className="w-full flex items-center justify-between p-3 hover:bg-blue-50 rounded-xl transition-all group text-left border border-transparent hover:border-blue-100"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-1.5 h-8 rounded-full shrink-0 ${
                      task.priority === Priority.HIGH ? 'bg-red-400' : 
                      task.priority === Priority.MEDIUM ? 'bg-amber-400' : 'bg-blue-400'
                    }`} />
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-800 text-sm group-hover:text-blue-600 truncate transition-colors">
                        {task.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 flex items-center gap-1">
                          <Folder size={10} /> {task.project}
                        </span>
                        <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                          {task.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-gray-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
               <Target size={48} className="mb-4 opacity-20" />
               <p className="text-sm font-medium">No results found for "{query}"</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold">
                 <span className="px-1.5 py-0.5 bg-white border border-gray-200 rounded shadow-sm">ESC</span>
                 <span>Close</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold">
                 <span className="px-1.5 py-0.5 bg-white border border-gray-200 rounded shadow-sm">↵</span>
                 <span>Select</span>
              </div>
           </div>
           <div className="text-[10px] font-black text-blue-600/50 tracking-widest uppercase">
              Smart Cross-Board Search
           </div>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;

