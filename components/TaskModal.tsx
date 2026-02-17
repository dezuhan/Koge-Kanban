import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Task, Priority, SubTask, Column, Project } from '../types';
import { X, Calendar, User, Wand2, Loader2, RotateCcw, RotateCw, Edit2, Bold, Italic, List, Check, Heading, Strikethrough, Folder, Tag, Activity, AlertCircle, Share2 } from 'lucide-react';
import { OllamaIcon } from './OllamaIcon';
import ReactMarkdown from 'react-markdown';
import ConfirmModal from './ConfirmModal';
import { SubTaskList } from './task-modal/SubTaskList';
import { MediaUploader } from './task-modal/MediaUploader';
import { CustomDatePicker } from './CustomDatePicker';
import { SearchableSelect, SelectOption } from './SearchableSelect';
import { useApp } from '../context/AppContext';
import { getAutoFillPrompt, getDescriptionPrompt, getMarkdownFormatPrompt } from '../fine-tunning/task-modal/prompts';
import { db } from '../services/db';

interface TaskModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Function to close the modal */
  onClose: () => void;
  /** Function to handle saving the task (create or update) */
  onSave: (task: Omit<Task, 'id' | 'createdAt'> | Task) => void;
  /** The task object to edit (null if creating a new task) */
  initialTask?: Task | null;
  /** List of available columns for the status dropdown */
  columns: Column[];
  /** Default status ID for new tasks */
  defaultStatus?: string;
  /** Name of the current project context */
  currentProjectName?: string;
  /** Project ID for sharing link */
  projectId?: string;
  isReadOnly?: boolean;
}

/**
 * TaskModal Component
 * Modal for creating and editing tasks.
 * Supports:
 * - Rich text description
 * - Subtasks
 * - Media attachments
 * - Priority, Due Date, Assignee, etc.
 */
const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTask,
  columns,
  defaultStatus,
  currentProjectName,
  projectId: propProjectId,
  isReadOnly = false
}) => {
  const { isAIEnabled, activeModel, ollamaEndpoint, alert: globalAlert, prioritySettings } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<string>('');
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [category, setCategory] = useState('General');
  const [project, setProject] = useState(''); // Will be set in useEffect
  const [assignee, setAssignee] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [dueDate, setDueDate] = useState<string>('');
  const [media, setMedia] = useState<string[]>([]);
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);

  const [showAIContext, setShowAIContext] = useState(false);
  const [userInstructions, setUserInstructions] = useState('');
  const [aiThinking, setAiThinking] = useState<string | null>(null);

  const [isShared, setIsShared] = useState(false);
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [allOtherUsers, setAllOtherUsers] = useState<any[]>([]);
  const [showShareConfirm, setShowShareConfirm] = useState(false);
  const [pendingUserToShare, setPendingUserToShare] = useState<any>(null);
  const [sharePermission, setSharePermission] = useState<'editor' | 'view'>('editor');
  const [isSharing, setIsSharing] = useState(false);

  // Undo/Redo history for description
  const [descHistory, setDescHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // View vs Edit Mode
  const [isEditingDesc, setIsEditingDesc] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);

  const { projects, setProjects } = useApp();

  // Real-time unique values from DB
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<string[]>([]);

  const fetchGlobalOptions = async () => {
    const allTasks = await db.getAllGlobalTasks();
    const projectsData = await db.getProjects();

    if (allTasks) {
      const cats = Array.from(new Set(allTasks.map(t => t.category).filter(Boolean)));
      const assigns = Array.from(new Set(allTasks.map(t => t.assignee).filter(Boolean)));
      setCategoryOptions(cats);
      setAssigneeOptions(assigns);
    }

    if (projectsData) {
      setProjectOptions(projectsData.map(p => p.name));
    }

    // Fetch members if projectId exists
    if (propProjectId) {
      try {
        const members = await db.sharing.getMembers(propProjectId);
        setProjectMembers(members);

        // Also fetch a sample of other users to categorize (In a real app, this would be a search)
        // For now, let's just get a few non-members
        const searchResults = await db.users.search(''); // Base search
        const membersIds = members.map((m: any) => m.id);
        setAllOtherUsers(searchResults.filter((u: any) => !membersIds.includes(u.id)));
      } catch (e) {
        console.error("Failed to fetch members or users", e);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchGlobalOptions();
    }
  }, [isOpen]);

  const handleCreateProject = async (name: string) => {
    if (!projects) return;

    const newProject: Project = {
      id: crypto.randomUUID(),
      name,
      description: `Automatically created project for "${name}"`,
      createdAt: Date.now(),
      color: 'blue'
    } as Project;

    // Save to DB
    const updatedProjects = [...projects, newProject];
    await db.saveProjects(updatedProjects);

    // Update state
    setProjects(updatedProjects);

    // Update local options
    setProjectOptions(prev => [...prev, name]);

    // Initialize data for new project
    const TEMPLATE_COLUMNS = [
      { id: 'Draft', title: 'DRAFT', color: '#94a3b8' },
      { id: 'To Do', title: 'TO-DO', color: '#f59e0b' },
      { id: 'On Going', title: 'ON GOING', color: '#3b82f6' },
      { id: 'Complete', title: 'COMPLETE', color: '#22c55e' }
    ];
    await db.saveColumns(newProject.id, TEMPLATE_COLUMNS);
    await db.saveTasks(newProject.id, []);
  };

  const handleAssigneeSelect = (val: string) => {
    if (isReadOnly) return;

    // Check if this is a known user ID or just a string
    const member = projectMembers.find(m => m.username === val || m.id.toString() === val);
    const otherUser = allOtherUsers.find(u => u.username === val || u.id.toString() === val);

    if (member) {
      setAssignee(member.username);
      setAssigneeId(member.id);
    } else if (otherUser) {
      // Check if current user is owner of the project
      const currentProject = projects?.find(p => p.id === propProjectId);
      const isOwner = currentProject?.permissions === 'owner' || !currentProject?.isShared;

      if (isOwner) {
        setPendingUserToShare(otherUser);
        setShowShareConfirm(true);
      } else {
        globalAlert({
          title: 'Permission Denied',
          message: 'Only the project owner can invite new collaborators.',
          type: 'warning'
        });
      }
    } else {
      // It's a manual string entry (legacy)
      setAssignee(val);
      setAssigneeId(null);
    }
  };

  const confirmShareAndAssign = async (permission: 'editor' | 'view') => {
    if (!pendingUserToShare || !propProjectId) return;
    setIsSharing(true);
    try {
      await db.sharing.shareProject(propProjectId, pendingUserToShare.id, permission);

      // Update local members list
      const newMember = { ...pendingUserToShare, permissions: permission };
      setProjectMembers(prev => [...prev, newMember]);
      setAllOtherUsers(prev => prev.filter(u => u.id !== pendingUserToShare.id));

      setAssignee(pendingUserToShare.username);
      setAssigneeId(pendingUserToShare.id);

      globalAlert({
        title: 'Project Shared',
        message: `Project shared with ${pendingUserToShare.username}.`,
        type: 'info'
      });
    } catch (e) {
      console.error("Failed to share project", e);
      globalAlert({
        title: 'Error',
        message: 'Failed to share project with this user.',
        type: 'danger'
      });
    } finally {
      setIsSharing(false);
      setShowShareConfirm(false);
      setPendingUserToShare(null);
    }
  };

  const assigneeOptionsMapped: SelectOption[] = [
    ...projectMembers.map(m => {
      let color = '#6b7280'; // gray (viewer/default)
      if (m.permissions === 'owner') color = '#7c3aed'; // purple
      else if (m.permissions === 'editor') color = '#2563eb'; // blue

      return {
        label: m.username,
        value: m.username,
        group: 'Collaborators',
        subLabel: m.email || '',
        rightLabel: m.permissions || 'Member',
        rightLabelColor: color
      };
    }),
    ...allOtherUsers.map(u => ({
      label: u.username,
      value: u.username,
      group: 'Other Users',
      subLabel: u.email
    }))
  ];

  // Track changes to form fields to set isDirty
  useEffect(() => {
    if (!isOpen) {
      setIsDirty(false);
      return;
    }

    // Check if current state differs from initialTask or default values
    const checkDirty = () => {
      if (initialTask) {
        const isModified =
          title !== initialTask.title ||
          description !== initialTask.description ||
          status !== initialTask.status ||
          priority !== initialTask.priority ||
          category !== initialTask.category ||
          project !== initialTask.project ||
          assignee !== (initialTask.assignee || '') ||
          isCompleted !== initialTask.isCompleted ||
          (dueDate ? new Date(dueDate).toISOString().split('T')[0] : '') !== (initialTask.dueDate ? new Date(initialTask.dueDate).toISOString().split('T')[0] : '') ||
          JSON.stringify(media) !== JSON.stringify(initialTask.media || []) ||
          JSON.stringify(subTasks) !== JSON.stringify(initialTask.subTasks || []);
        setIsDirty(isModified);
      } else {
        // New task - check if any field has content
        const hasContent =
          title !== '' ||
          description !== '' ||
          (assignee !== '') ||
          (dueDate !== '') ||
          (media.length > 0) ||
          subTasks.length > 0;
        setIsDirty(hasContent);
      }
    };
    checkDirty();
  }, [title, description, status, priority, category, project, assignee, isCompleted, dueDate, media, subTasks, initialTask, isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        // If a modal is already open (like discard confirm), don't do anything here
        // or let the top-most modal handle it.
        // But since ConfirmModal is inside this component, we can manage it.
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false); // Close confirm modal on ESC
          return;
        }

        if (isDirty && !isReadOnly) { // Only prompt for discard if not read-only
          setShowDiscardConfirm(true);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDirty, showDiscardConfirm, onClose, isReadOnly]);

  const prevIsOpen = useRef(false);

  useEffect(() => {
    // Only run initialization when opening the modal (false -> true transition)
    // or when the specific task ID changes while open (switching tasks)
    const isOpening = isOpen && !prevIsOpen.current;

    // Check if task ID changed while already open
    const isSwitchingTask = isOpen && prevIsOpen.current && initialTask && (initialTask.id !== (prevIsOpen.current as any)?.id);

    if (isOpening || isSwitchingTask) {
      if (initialTask) {
        setTitle(initialTask.title);
        setDescription(initialTask.description);
        setStatus(initialTask.status);
        setPriority(initialTask.priority);
        setCategory(initialTask.category);
        setProject(initialTask.project);
        setAssignee(initialTask.assignee || '');
        setIsCompleted(initialTask.isCompleted);
        setDueDate(initialTask.dueDate ? new Date(initialTask.dueDate).toISOString().split('T')[0] : '');

        let initMedia: string[] = [];
        if (initialTask.media) {
          if (Array.isArray(initialTask.media)) {
            initMedia = initialTask.media;
          } else if (typeof initialTask.media === 'string') {
            initMedia = [initialTask.media];
          }
        }
        setMedia(initMedia);

        setSubTasks(initialTask.subTasks || []);

        setIsEditingDesc(!initialTask.description || isReadOnly); // If readOnly, always show preview

        if (initialTask.description) {
          setDescHistory([initialTask.description]);
          setHistoryIndex(0);
        }
      } else {
        resetForm();
      }
    }

    prevIsOpen.current = isOpen;
  }, [initialTask, isOpen, columns, defaultStatus, currentProjectName, isReadOnly]);

  const handleShare = async () => {
    if (!initialTask || !propProjectId) return;

    const url = `${window.location.origin}/board/${propProjectId}/task/${initialTask.id}`;

    try {
      await navigator.clipboard.writeText(url);
      setIsShared(true);
      setTimeout(() => setIsShared(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
      globalAlert({
        title: 'Share Failed',
        message: 'Could not copy link to clipboard.',
        type: 'danger'
      });
    }
  };

  /**
   * Resets the form to default values for a new task.
   */
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStatus(defaultStatus || (columns.length > 0 ? columns[0].id : ''));
    setPriority(Priority.MEDIUM);
    setCategory('General');
    setProject(currentProjectName || 'Main Project');
    setAssignee('');
    setIsCompleted(false);
    setDueDate('');
    setMedia([]);
    setSubTasks([]);
    setIsEditingDesc(true); // New tasks start in edit mode
    setDescHistory([]);
    setHistoryIndex(-1);
  };

  /**
   * Handles form submission to save the task.
   * Compiles the task object and calls the onSave prop.
   * @param e Form event
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return; // Prevent saving if read-only
    const taskData = {
      ...(initialTask ? { id: initialTask.id, createdAt: initialTask.createdAt } : {}),
      title,
      description,
      status,
      priority,
      category,
      project,
      assignee,
      isCompleted,
      dueDate: dueDate ? new Date(dueDate).getTime() : null,
      media,
      subTasks,
    };
    onSave(taskData as Task);
    onClose();
  };

  /**
   * Handles request to close the modal.
   * Checks for unsaved changes and prompts confirmation if needed.
   */
  const handleCloseRequest = () => {
    if (isDirty && !isReadOnly) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  /**
   * Handles confirmation to discard changes.
   * Resets dirty state and closes the modal.
   */
  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    setIsDirty(false); // Reset dirty state
    onClose();
  };

  // Helper to update description and push to history
  const updateDescriptionWithHistory = (newDesc: string) => {
    if (isReadOnly) return;
    const current = descHistory[historyIndex] || '';
    if (newDesc !== current) {
      const newHistory = descHistory.slice(0, historyIndex + 1);
      newHistory.push(newDesc);
      setDescHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setDescription(newDesc);
    }
  };

  const handleUndo = () => {
    if (isReadOnly) return;
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setDescription(descHistory[newIndex]);
    }
  };

  const handleRedo = () => {
    if (isReadOnly) return;
    if (historyIndex < descHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setDescription(descHistory[newIndex]);
    }
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    setDescription(e.target.value);
  };

  const handleDescriptionBlur = () => {
    if (isReadOnly) return;
    // Push to history on blur to avoid too many updates while typing
    updateDescriptionWithHistory(description);
  };

  // Helper to insert markdown at cursor position
  const insertMarkdown = useCallback((symbol: string, mode: 'wrap' | 'block' = 'wrap') => {
    if (isReadOnly) return;
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    let newText = '';
    let newCursorPos = 0;

    if (mode === 'wrap') {
      const selectedText = text.substring(start, end);
      const before = text.substring(0, start);
      const after = text.substring(end);
      newText = `${before}${symbol}${selectedText}${symbol}${after}`;
      newCursorPos = end + (symbol.length * 2);

      // If no selection, put cursor inside symbols
      if (start === end) {
        newCursorPos = start + symbol.length;
      }
    } else if (mode === 'block') {
      // Find start of current line
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const before = text.substring(0, lineStart);
      const after = text.substring(lineStart);
      newText = `${before}${symbol} ${after}`;
      newCursorPos = start + symbol.length + 1;
    }

    setDescription(newText);

    // Need to defer cursor setting to after render
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    });

    // Update history immediately for formatting actions
    updateDescriptionWithHistory(newText);
  }, [description, descHistory, historyIndex, isReadOnly]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          insertMarkdown('**');
          break;
        case 'i':
          e.preventDefault();
          insertMarkdown('*');
          break;
        // Strikethrough (Ctrl+Shift+X or similar often used, let's use Ctrl+S or Ctrl+X? Ctrl+S is save. Let's use Ctrl+Shift+S)
        case 's':
          if (e.shiftKey) {
            e.preventDefault();
            insertMarkdown('~~');
          }
          break;
      }
    }
  };

  const handleAutoFill = async () => {
    if (isReadOnly) return;
    if (!title) {
      globalAlert({
        title: 'Missing Title',
        message: 'Please enter a title first so the AI can understand what needs to be filled.',
        type: 'warning'
      });
      return;
    }

    setIsAILoading(true);
    setAiThinking(null);
    try {
      const prompt = getAutoFillPrompt(title, description);

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ollama-endpoint': ollamaEndpoint,
          'Authorization': `Bearer ${localStorage.getItem('koge_auth_token')}`
        },
        body: JSON.stringify({ prompt, model: activeModel })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate");
      }

      const data = await response.json();
      if (data.response) {
        let cleanResponse = data.response;

        // Extract thinking process if available
        const thinkMatch = cleanResponse.match(/<think>([\s\S]*?)<\/think>/);
        if (thinkMatch) {
          setAiThinking(thinkMatch[1].trim());
          cleanResponse = cleanResponse.replace(/<think>[\s\S]*?<\/think>/, '').trim();
        }

        // Extract JSON from markdown code block
        const jsonMatch = cleanResponse.match(/```json\n([\s\S]*?)\n```/) ||
          cleanResponse.match(/```([\s\S]*?)```/) ||
          [null, cleanResponse];

        const jsonStr = jsonMatch[1].trim();
        const result = JSON.parse(jsonStr);

        // Update fields
        if (result.description) updateDescriptionWithHistory(result.description);
        if (result.category) setCategory(result.category);
        if (result.project) {
          // Check if project exists, if not, create it
          if (!projectOptions.includes(result.project)) {
            await handleCreateProject(result.project);
          }
          setProject(result.project);
        }
        if (result.assignee) setAssignee(result.assignee);
        if (result.priority) {
          const p = result.priority.charAt(0).toUpperCase() + result.priority.slice(1).toLowerCase();
          if (Object.values(Priority).includes(p as Priority)) {
            setPriority(p as Priority);
          }
        }
        if (result.dueDate) setDueDate(result.dueDate);
        if (result.subTasks && Array.isArray(result.subTasks)) {
          const newSubtasks = result.subTasks.map((st: any) => ({
            id: crypto.randomUUID(),
            title: st.title || st.name || st,
            isCompleted: false
          }));
          setSubTasks(prev => [...prev, ...newSubtasks]);
        }

        setIsEditingDesc(true);
      }
    } catch (error: any) {
      console.error("Auto-Fill Error:", error);
      globalAlert({
        title: 'Auto-Fill Failed',
        message: `Auto-Fill failed: ${error.message}`,
        type: 'danger'
      });
    } finally {
      setIsAILoading(false);
    }
  };

  const handleReformatMarkdown = async () => {
    if (isReadOnly) return;
    if (!description) {
      globalAlert({
        title: 'Missing Content',
        message: 'Please enter some text to format first.',
        type: 'warning'
      });
      return;
    }

    setIsAILoading(true);
    setAiThinking(null);
    try {
      const prompt = getMarkdownFormatPrompt(description);

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ollama-endpoint': ollamaEndpoint,
          'Authorization': `Bearer ${localStorage.getItem('koge_auth_token')}`
        },
        body: JSON.stringify({ prompt, model: activeModel })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate");
      }

      const data = await response.json();
      if (data.response) {
        let newContent = data.response;

        // Extract thinking process if available
        const thinkMatch = newContent.match(/<think>([\s\S]*?)<\/think>/);
        if (thinkMatch) {
          setAiThinking(thinkMatch[1].trim());
          newContent = newContent.replace(/<think>[\s\S]*?<\/think>/, '').trim();
        }

        updateDescriptionWithHistory(newContent);
        setIsEditingDesc(true);
        setShowAIContext(false);
        setUserInstructions('');
      }
    } catch (error: any) {
      console.error("AI Error:", error);
      globalAlert({
        title: 'AI Error',
        message: 'The AI Service is currently unreachable. Please check your connection.',
        type: 'danger'
      });
    } finally {
      setIsAILoading(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (isReadOnly) return;
    if (!title) {
      globalAlert({
        title: 'Missing Title',
        message: 'Please enter a title first to give the AI some context.',
        type: 'warning'
      });
      return;
    }

    setIsAILoading(true);
    setAiThinking(null);
    try {
      // Construct a prompt based on title and existing description
      const prompt = getDescriptionPrompt(title, description, userInstructions);

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ollama-endpoint': ollamaEndpoint,
          'Authorization': `Bearer ${localStorage.getItem('koge_auth_token')}`
        },
        body: JSON.stringify({ prompt, model: activeModel })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate");
      }

      const data = await response.json();
      if (data.response) {
        let newContent = data.response;

        // Extract thinking process if available
        const thinkMatch = newContent.match(/<think>([\s\S]*?)<\/think>/);
        if (thinkMatch) {
          setAiThinking(thinkMatch[1].trim());
          newContent = newContent.replace(/<think>[\s\S]*?<\/think>/, '').trim();
        }

        // Push old description to history before replacing if it's not empty and different
        updateDescriptionWithHistory(newContent);

        setIsEditingDesc(true); // Switch to edit mode to show result
        setShowAIContext(false);
        setUserInstructions('');
      }
    } catch (error: any) {
      console.error("AI Error:", error);
      globalAlert({
        title: 'AI Error',
        message: 'The AI Service is currently unreachable. Please check your connection.',
        type: 'danger'
      });
    } finally {
      setIsAILoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="task-modal fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4" onClick={(e) => {
        // Close on backdrop click if not dirty, or ask confirmation
        if (e.target === e.currentTarget) {
          handleCloseRequest();
        }
      }}>
        <div className="task-modal-container bg-white md:rounded-lg shadow-2xl w-full h-full md:h-auto md:max-w-2xl overflow-hidden md:max-h-[90vh] flex flex-col">
          <div className="task-modal-header flex justify-between items-center p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-800">{initialTask ? 'Edit Task' : 'New Task'}</h2>
              {initialTask && propProjectId && (
                <button
                  type="button"
                  onClick={handleShare}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isShared
                    ? 'bg-green-50 text-green-600 border border-green-100'
                    : 'bg-gray-50 text-gray-500 hover:text-blue-600 border border-gray-100 hover:border-blue-100 hover:bg-blue-50/30'
                    }`}
                  title="Copy direct link to this task"
                >
                  {isShared ? <Check size={14} /> : <Share2 size={14} />}
                  <span>{isShared ? 'Link Copied!' : 'Share'}</span>
                </button>
              )}
            </div>
            <button onClick={handleCloseRequest} className="btn-close p-1 hover:bg-gray-100 rounded-full text-gray-500 transition">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="task-modal-form flex-1 overflow-y-auto p-6 space-y-6">
            {/* Title */}
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <div className="flex gap-2">
                <textarea
                  readOnly={isReadOnly}
                  id="task-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`task-title-input w-full p-3 bg-gray-50/50 border border-gray-100 rounded-xl text-lg font-bold focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300 resize-none ${isReadOnly ? 'cursor-default' : ''}`}
                  placeholder="Task title..."
                  rows={1}
                />
                <button
                  type="button"
                  onClick={handleAutoFill}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all shadow-sm ${isAIEnabled && !isReadOnly
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                    }`}
                  disabled={isAILoading || !isAIEnabled || isReadOnly || !title}
                  title={isAIEnabled ? "Auto-fill details with AI" : "Enable AI to use Auto-Fill"}
                >
                  {isAILoading && <Loader2 size={16} className="animate-spin" />}
                  <span className="text-sm font-medium">Auto-Fill</span>
                </button>
              </div>
            </div>

            {/* Grid fields */}
            <div className="form-grid grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <SearchableSelect
                  label="Project"
                  value={project}
                  onChange={setProject}
                  options={projectOptions}
                  placeholder="Select project..."
                  icon={<Folder size={18} />}
                  onCreateOption={handleCreateProject}
                  disabled={isReadOnly}
                />
              </div>
              <div className="form-group">
                <SearchableSelect
                  label="Category"
                  value={category}
                  onChange={setCategory}
                  options={categoryOptions}
                  placeholder="Select category..."
                  icon={<Tag size={18} />}
                  onCreateOption={(val) => setCategoryOptions(prev => [...prev, val])}
                  disabled={isReadOnly}
                />
              </div>

              <div className="form-group">
                <SearchableSelect
                  label="Assign To"
                  value={assignee}
                  onChange={handleAssigneeSelect}
                  options={assigneeOptionsMapped}
                  placeholder="Select assignee..."
                  icon={<User size={18} />}
                  onCreateOption={(val) => setAssignee(val)}
                  disabled={isReadOnly}
                />
              </div>

              <div className="form-group">
                <CustomDatePicker
                  label="Due Date"
                  value={dueDate}
                  onChange={setDueDate}
                  disabled={isReadOnly}
                />
              </div>

              <div className="form-group">
                <SearchableSelect
                  label="Status"
                  value={columns.find(c => c.id === status)?.title || ''}
                  onChange={(val) => {
                    const col = columns.find(c => c.title === val);
                    if (col) setStatus(col.id);
                  }}
                  options={columns.map(c => c.title)}
                  optionStyles={columns.reduce((acc, col) => ({
                    ...acc,
                    [col.title]: { bg: `${col.color}20`, text: col.color }
                  }), {})}
                  placeholder="Select status..."
                  icon={<Activity size={18} className="text-gray-400" />}
                  disabled={isReadOnly}
                />
              </div>
              <div className="form-group">
                <SearchableSelect
                  label="Priority"
                  value={priority}
                  onChange={(val) => setPriority(val as Priority)}
                  options={Object.values(Priority)}
                  optionStyles={prioritySettings}
                  placeholder="Select priority..."
                  icon={<AlertCircle size={18} className="text-gray-400" />}
                  showSearch={false}
                  disabled={isReadOnly}
                />
              </div>
            </div>

            {/* Media Input */}
            <MediaUploader media={media} onChange={setMedia} isReadOnly={isReadOnly} />

            {/* Description */}
            <div className="form-group">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => isAIEnabled && setShowAIContext(!showAIContext)}
                    className={`flex items-center gap-1 text-xs px-3 py-1 rounded-lg transition-colors ${!isAIEnabled || isReadOnly
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                      : showAIContext
                        ? 'bg-blue-200 text-blue-800'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    title={isAIEnabled ? "Generate description with AI" : "Enable AI to use Assist"}
                    disabled={!isAIEnabled || isReadOnly}
                  >
                    AI Assist
                  </button>

                  {/* View/Edit Toggle Button */}
                  {!isEditingDesc && description && !isReadOnly && (
                    <button
                      type="button"
                      onClick={() => setIsEditingDesc(true)}
                      className="flex items-center gap-1 text-xs px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Edit2 size={12} /> Edit Content
                    </button>
                  )}
                </div>
              </div>

              {isAIEnabled && showAIContext && !isReadOnly && (
                <div className="mb-2 p-2 bg-blue-50 border border-blue-100 rounded-lg animate-fade-in">
                  {aiThinking && (
                    <div className="mb-2 p-2 bg-white/80 border border-blue-100 rounded-lg text-[10px] text-gray-600 max-h-32 overflow-y-auto">
                      <strong className="block text-blue-700 mb-1">AI Thought Process:</strong>
                      <div className="whitespace-pre-wrap font-mono">{aiThinking}</div>
                    </div>
                  )}
                  <label className="block text-xs font-medium text-blue-800 mb-1">
                    AI Instructions / Context:
                  </label>
                  <textarea
                    value={userInstructions}
                    onChange={(e) => setUserInstructions(e.target.value)}
                    placeholder="e.g., 'Make it formal', 'Focus on technical details', 'Summarize briefly'..."
                    className="w-full text-xs p-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 min-h-[60px] resize-none mb-2"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleReformatMarkdown}
                      disabled={isAILoading}
                      className="flex-1 flex justify-center items-center gap-2 text-xs bg-gray-100 text-gray-700 py-1.5 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-70 border border-gray-200"
                      title="Format text to Markdown without changing words"
                    >
                      {isAILoading ? <Loader2 size={12} className="animate-spin" /> : <OllamaIcon size={12} />}
                      Format Only
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateDescription}
                      disabled={isAILoading}
                      className="w-10 h-10 flex justify-center items-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70"
                      title="Generate Description"
                    >
                      {isAILoading ? <Loader2 size={16} className="animate-spin" /> : <OllamaIcon size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Display AI Thinking if available and AI context is closed (e.g. after generation) */}
              {isAIEnabled && !showAIContext && aiThinking && (
                <div className="mb-2 p-2 bg-blue-50 border border-blue-100 rounded-lg animate-fade-in text-xs">
                  <div className="flex justify-between items-center mb-1 cursor-pointer" onClick={() => setAiThinking(null)} title="Dismiss">
                    <strong className="text-blue-700">AI Thought Process:</strong>
                    <X size={12} className="text-blue-400 hover:text-blue-700" />
                  </div>
                  <div className="p-2 bg-white/80 border border-blue-100 rounded-lg text-gray-600 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-[10px]">
                    {aiThinking}
                  </div>
                </div>
              )}

              {isEditingDesc && !isReadOnly ? (
                <div className="relative border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
                  {/* Toolbar */}
                  <div className="flex items-center gap-1 p-1 bg-gray-50 border-b border-gray-200 overflow-x-auto">
                    <button type="button" onClick={() => insertMarkdown('**')} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600" title="Bold (Ctrl+B)" disabled={isReadOnly}>
                      <Bold size={14} />
                    </button>
                    <button type="button" onClick={() => insertMarkdown('*')} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600" title="Italic (Ctrl+I)" disabled={isReadOnly}>
                      <Italic size={14} />
                    </button>
                    <button type="button" onClick={() => insertMarkdown('~~')} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600" title="Strikethrough (Ctrl+Shift+S)" disabled={isReadOnly}>
                      <Strikethrough size={14} />
                    </button>
                    <div className="w-px h-4 bg-gray-300 mx-1"></div>
                    <button type="button" onClick={() => insertMarkdown('#', 'block')} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600" title="Heading 1" disabled={isReadOnly}>
                      <Heading size={14} />
                    </button>
                    <button type="button" onClick={() => insertMarkdown('-', 'block')} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600" title="List Item" disabled={isReadOnly}>
                      <List size={14} />
                    </button>
                    <div className="w-px h-4 bg-gray-300 mx-1"></div>
                    <button type="button" onClick={handleUndo} disabled={historyIndex <= 0 || isReadOnly} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 disabled:opacity-30">
                      <RotateCcw size={14} />
                    </button>
                    <button type="button" onClick={handleRedo} disabled={historyIndex >= descHistory.length - 1 || isReadOnly} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 disabled:opacity-30">
                      <RotateCw size={14} />
                    </button>
                    <div className="flex-1"></div>
                    <button
                      type="button"
                      onClick={() => setIsEditingDesc(false)}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg font-bold hover:bg-blue-200 flex items-center gap-1"
                      disabled={isReadOnly}
                    >
                      <Check size={12} /> Done
                    </button>
                  </div>

                  <textarea
                    ref={textareaRef}
                    value={description}
                    onChange={handleDescriptionChange}
                    onBlur={handleDescriptionBlur}
                    onKeyDown={handleKeyDown}
                    className="input-desc w-full px-3 py-2 h-[450px] outline-none resize-none font-mono text-sm bg-transparent"
                    placeholder="Task details... (Markdown shortcuts enabled: **bold**, *italic*)"
                    readOnly={isReadOnly}
                  />

                  {/* AI Loading Overlay */}
                  {isAILoading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center z-10 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2 text-blue-600 font-medium mb-2 bg-white px-4 py-2 rounded-full shadow-sm border border-blue-100">
                        <Loader2 size={20} className="animate-spin" />
                        <span>AI is refining your content...</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="desc-preview w-full rounded-lg border border-gray-100 px-4 py-3 h-[500px] overflow-y-auto bg-gray-50/50 prose prose-sm prose-blue max-w-none transition-all relative group"
                >
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => setIsEditingDesc(true)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white p-1.5 rounded-lg shadow-sm border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-200 cursor-pointer"
                      title="Edit Description"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                  {description ? (
                    <ReactMarkdown>{description}</ReactMarkdown>
                  ) : (
                    <span className="text-gray-400 italic">No description provided. Click the edit icon to add.</span>
                  )}
                </div>
              )}
            </div>

            {/* Subtasks */}
            <SubTaskList
              subTasks={subTasks}
              onChange={setSubTasks}
              parentTaskTitle={title}
              parentTaskDescription={description}
              isAIEnabled={isAIEnabled}
              isReadOnly={isReadOnly}
            />

            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <input
                type="checkbox"
                id="isCompleted"
                checked={isCompleted}
                onChange={(e) => setIsCompleted(e.target.checked)}
                className="checkbox-completed w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                disabled={isReadOnly}
              />
              <label htmlFor="isCompleted" className="text-sm text-gray-700">Mark main task as completed</label>
            </div>
          </form>

          <div className="task-modal-footer flex justify-end p-4 border-t border-gray-100 bg-gray-50 gap-2">
            <button
              type="button"
              onClick={handleCloseRequest}
              className="btn-cancel px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              {isReadOnly ? 'Close' : 'Cancel'}
            </button>
            {!isReadOnly && (
              <button
                onClick={handleSubmit}
                className="btn-save px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm"
              >
                {initialTask ? 'Save Changes' : 'Create Task'}
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={handleConfirmDiscard}
        title="Discard Changes?"
        message="You have unsaved changes. Are you sure you want to discard them?"
        confirmText="Discard"
        type="danger"
      />

      {showShareConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-2 py-4">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                    <User size={32} />
                  </div>
                  <div className="text-center">
                    <p className="text-gray-900 font-bold">@{pendingUserToShare?.username}</p>
                    <p className="text-xs text-gray-500">{pendingUserToShare?.email}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 text-center">
                  This user is not a collaborator yet.<br />Grant them access to this project?
                </p>
                <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">Select Access Level</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSharePermission('view'); }}
                      className={`flex-1 py-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${sharePermission === 'view' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <span className="font-bold text-sm">Viewer</span>
                      <span className="text-[10px] text-gray-500">Read only</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSharePermission('editor'); }}
                      className={`flex-1 py-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${sharePermission === 'editor' ? 'border-purple-600 bg-purple-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <span className="font-bold text-sm">Editor</span>
                      <span className="text-[10px] text-gray-500">Can edit</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-center mt-6">
                <button
                  onClick={() => { setShowShareConfirm(false); setPendingUserToShare(null); }}
                  className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmShareAndAssign(sharePermission)}
                  className="flex-1 px-4 py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition font-bold shadow-sm text-sm"
                >
                  {isSharing ? "Sharing..." : "Invite & Assign"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TaskModal;