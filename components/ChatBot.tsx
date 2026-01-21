import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, Bot, User, Wand2, MessageSquare, History, PanelRightClose, CheckCircle2, AlertCircle, Layers, Folder, Hash, Bookmark, Zap, RefreshCw, Trash2 } from 'lucide-react';
import { OllamaIcon } from './OllamaIcon';
import ReactMarkdown from 'react-markdown';
import { useApp } from '../context/AppContext';
import { ChatMessage, Task, Priority } from '../types';
import { db } from '../services/db';
import { getChatbotSystemPrompt } from '../fine-tunning/chatbot/system-prompt';

interface PendingAction {
    action: 'create_task' | 'update_task' | 'delete_task';
    data: any;
    description: string;
}

interface PendingExecution {
    items: PendingAction[];
}

interface MentionSuggestion {
    type: 'board' | 'task' | 'tag';
    id: string;
    label: string;
    subLabel?: string;
}

const SUGGESTIONS = [
    { text: "Help me organize tasks today", icon: <OllamaIcon size={14} /> },
    { text: "Create 3 tasks for website project", icon: <Layers size={14} /> },
    { text: "Summarize my project status", icon: <History size={14} /> }
];

/**
 * ChatBot Component
 * A Gemini-style integrated sidebar AI assistant.
 */
const ChatBot: React.FC = () => {
    const { isAIEnabled, activeModel, isChatOpen, setIsChatOpen, currentContext, notifyBoardRefresh, projects, isAILoading, setIsAILoading, ollamaEndpoint, confirm: globalConfirm } = useApp();

    // All Hooks must be at the top level
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'assistant', content: 'Hello! I am your AI assistant. I can help you manage your tasks, create new ones, or summarize your progress. How can I help you today?' }
    ]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [pendingExecution, setPendingExecution] = useState<PendingExecution | null>(null);
    const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isChatOpen) {
            scrollToBottom();
        }
    }, [messages, isChatOpen, !!pendingExecution]);

    // Ref to track which project ID is currently loaded in state
    const loadedProjectIdRef = useRef<string | null>(null);

    // Load chat history when board changes
    useEffect(() => {
        const loadHistory = async () => {
            const contextId = currentContext?.projectId || 'global';

            // Prevent unnecessary reloads if already loaded
            if (loadedProjectIdRef.current === contextId) return;

            setIsHistoryLoading(true);
            const history = await db.getChatHistory(contextId);

            if (history && history.length > 0) {
                setMessages(history);
            } else {
                setMessages([
                    { role: 'assistant', content: 'Hello! I am your AI assistant. I can help you manage your tasks, create new ones, or summarize your progress. How can I help you today?' }
                ]);
            }

            if (pendingExecution) {
                setPendingExecution(null);
            }

            // Mark this context as loaded
            loadedProjectIdRef.current = contextId;
            setIsHistoryLoading(false);
        };

        loadHistory();
    }, [currentContext?.projectId]);

    // Save chat history whenever messages change
    useEffect(() => {
        const contextId = currentContext?.projectId || 'global';

        // CRITICAL: Only save if the messages in state belong to the current context ID
        // This prevents overwriting Board B's history with Board A's messages during transition
        if (messages.length > 0 && loadedProjectIdRef.current === contextId) {
            db.saveChatHistory(contextId, messages);
        }
    }, [messages, currentContext?.projectId]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }

        const lastAtIdx = inputValue.lastIndexOf('@');
        if (lastAtIdx !== -1 && (lastAtIdx === 0 || inputValue[lastAtIdx - 1] === ' ')) {
            const query = inputValue.slice(lastAtIdx + 1).toLowerCase();
            if (query.includes(' ')) {
                setShowSuggestions(false);
            } else {
                const filteredSuggestions: MentionSuggestion[] = [];

                // Add Execution Tags
                const execTags = [
                    { id: 'all', label: 'all', type: 'tag', subLabel: 'Target: All cards in current board' },
                    { id: 'create', label: 'create', type: 'tag', subLabel: 'Execute: Create new task' },
                    { id: 'update', label: 'update', type: 'tag', subLabel: 'Execute: Update existing task' },
                    { id: 'delete', label: 'delete', type: 'tag', subLabel: 'Execute: Delete task' },
                    { id: 'read', label: 'read', type: 'tag', subLabel: 'Info: Read task details' },
                ];

                execTags.forEach(t => {
                    if (t.label.includes(query)) {
                        filteredSuggestions.push(t as any);
                    }
                });

                projects?.forEach(p => {
                    if (p.name.toLowerCase().includes(query)) {
                        filteredSuggestions.push({ type: 'board', id: p.id, label: p.name });
                    }
                });
                if (currentContext) {
                    currentContext.tasks.forEach(t => {
                        if (t.title.toLowerCase().includes(query)) {
                            filteredSuggestions.push({
                                type: 'task',
                                id: t.id,
                                label: t.title,
                                subLabel: currentContext.projectName
                            });
                        }
                    });
                }
                if (filteredSuggestions.length > 0) {
                    setSuggestions(filteredSuggestions); // Remove .slice(0, 8) to show all
                    setShowSuggestions(true);
                    setSuggestionIndex(0);
                } else {
                    setShowSuggestions(false);
                }
            }
        } else {
            setShowSuggestions(false);
        }
    }, [inputValue, projects, currentContext]);

    // Event Handlers
    const insertSuggestion = (suggestion: MentionSuggestion) => {
        const lastAtIdx = inputValue.lastIndexOf('@');
        const beforeAt = inputValue.slice(0, lastAtIdx);
        const afterAt = inputValue.slice(lastAtIdx).split(' ')[0];
        const remaining = inputValue.slice(lastAtIdx + afterAt.length);

        let tag = '';
        if (suggestion.type === 'tag') {
            tag = `@${suggestion.label}`;
        } else if (suggestion.type === 'board') {
            tag = `@[${suggestion.label}]`;
        } else {
            tag = `@[${suggestion.subLabel}/${suggestion.label}#${suggestion.id}]`;
        }

        setInputValue(beforeAt + tag + ' ' + remaining);
        setShowSuggestions(false);
        textareaRef.current?.focus();
    };

    const handleSend = async (text: string = inputValue, retryIndex?: number) => {
        const trimmedText = text.trim();
        if (!trimmedText || isAILoading) return;

        let updatedMessages = [...messages];
        const userMessage: ChatMessage = { role: 'user', content: trimmedText };

        if (retryIndex !== undefined) {
            // If retrying, remove the previous failed attempt and subsequent messages
            updatedMessages = updatedMessages.slice(0, retryIndex);
        }

        const messagesPayload = updatedMessages
            .filter(msg => !msg.error && !msg.isSystemSummary) // Only send messages that didn't error and aren't success summaries
            .concat(userMessage)
            .map(msg => ({ role: msg.role, content: msg.content }));

        const projectsList = projects?.map(p => `- Board Name: "${p.name}" (ID: ${p.id})`).join('\n') || "No projects found.";

        // Scan for board mentions to fetch their data if on dashboard
        const boardMentions = trimmedText.match(/@\[(.*?)\]/g) || [];
        let referencedData = "";

        if (boardMentions.length > 0 && projects) {
            const boardDataPromises = boardMentions.map(async (mention) => {
                const fullTag = mention.match(/@\[(.*?)\]/)?.[1];
                if (!fullTag) return null;

                // Extract project name (handle @[Board] or @[Board/Task#ID])
                const projectName = fullTag.split('/')[0].split('#')[0];
                const project = projects.find(p => p.name.toLowerCase() === projectName.toLowerCase());
                if (!project) return null;

                // Skip if it's the current context (already included)
                if (currentContext && project.id === currentContext.projectId) return null;

                const tasks = await db.getTasks(project.id);
                return { name: project.name, id: project.id, tasks: tasks || [] };
            });

            const results = await Promise.all(boardDataPromises);
            referencedData = results
                .filter(Boolean)
                .map(res => `
DATA FOR BOARD: "${res?.name}" (INTERNAL_ID: ${res?.id})
Tasks in "${res?.name}":
${res?.tasks && res.tasks.length > 0
                        ? res.tasks.map(t => `- [INTERNAL_ID: ${t.id}] title: "${t.title}", status: "${t.status}", priority: "${t.priority}"`).join('\n')
                        : "(THIS BOARD IS CURRENTLY EMPTY - 0 TASKS FOUND. DO NOT INVENT TASKS.)"}
            `.trim())
                .join('\n\n');
        }

        let contextSummary = currentContext ? `
Board Name: "${currentContext.projectName}" (INTERNAL_ID: ${currentContext.projectId})
Available Columns: ${currentContext.columns.map(c => `"${c.title}"`).join(', ')}
Current Tasks in this Board:
${currentContext.tasks.length > 0
                ? currentContext.tasks.map(t => `- [INTERNAL_ID: ${t.id}] title: "${t.title}", status: "${t.status}", priority: "${t.priority}", category: "${t.category}"`).join('\n')
                : "(THIS BOARD IS CURRENTLY EMPTY - 0 TASKS FOUND. DO NOT INVENT TASKS.)"}
    `.trim() : "No specific board is currently being viewed. User is likely on the dashboard.";

        setMessages([...updatedMessages, userMessage]);
        setInputValue('');
        setIsAILoading(true);

        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-ollama-endpoint': ollamaEndpoint,
                    'Authorization': `Bearer ${localStorage.getItem('koge_auth_token')}`
                },
                body: JSON.stringify({
                    model: activeModel,
                    messages: [{ role: 'system', content: getChatbotSystemPrompt(contextSummary, projectsList, referencedData) }, ...messagesPayload]
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.message) {
                    setMessages(prev => [...prev, data.message]);
                    processAIResponse(data.message.content, trimmedText);
                }
            } else {
                throw new Error('Failed to respond');
            }
        } catch (error) {
            console.error(error);
            // Mark the last message as error
            setMessages(prev => {
                const newMessages = [...prev];
                const lastIndex = newMessages.length - 1;
                if (lastIndex >= 0) {
                    newMessages[lastIndex] = { ...newMessages[lastIndex], error: true };
                }
                return newMessages;
            });
        } finally {
            setIsAILoading(false);
        }
    };

    const processAIResponse = (content: string, userText: string) => {
        // Only process actions if the user explicitly used an execution tag
        const hasTag = /@(create|update|delete)\b/i.test(userText);
        if (!hasTag) return;

        // Helper to extract actions from parsed JSON
        const extractActions = (parsed: any): any[] => {
            if (Array.isArray(parsed)) return parsed;
            if (parsed.actions && Array.isArray(parsed.actions)) return parsed.actions;
            if (parsed.action) return [parsed];
            return [];
        };

        // Look for all JSON blocks in the content
        const jsonBlocks = content.match(/```json\s*([\s\S]*?)\s*```/g) || [];
        const allActions: any[] = [];

        if (jsonBlocks.length > 0) {
            jsonBlocks.forEach(block => {
                try {
                    const rawJson = block.replace(/```json\s*|\s*```/g, '');
                    const parsed = JSON.parse(rawJson);
                    allActions.push(...extractActions(parsed));
                } catch (e) {
                    console.error("Failed to parse AI JSON block:", e);
                }
            });
        } else {
            // Fallback for JSON without fences
            // Try to match anything that looks like a JSON object or array
            const jsonRegex = /({[\s\S]*"action"[\s\S]*})|({[\s\S]*"actions"[\s\S]*})|(\[[\s\S]*"action"[\s\S]*\])/;
            const fallbackMatch = content.match(jsonRegex);
            if (fallbackMatch) {
                try {
                    const parsed = JSON.parse(fallbackMatch[0]);
                    allActions.push(...extractActions(parsed));
                } catch (e) {
                    console.error("Failed to parse AI fallback JSON:", e);
                }
            }
        }

        if (allActions.length > 0) {
            // Filter for valid board actions
            const validActionTypes = ['create_task', 'update_task', 'delete_task'];
            const filteredActions = allActions.filter((a: any) => validActionTypes.includes(a.action));

            if (filteredActions.length > 0) {
                const items = filteredActions.map((a: any) => {
                    let desc = '';
                    if (a.action === 'create_task') desc = `Create task: "${a.data?.title || 'New Task'}"`;
                    else if (a.action === 'update_task') desc = `Update task: "${a.data?.title || a.data?.id || 'Task'}"`;
                    else if (a.action === 'delete_task') desc = `Delete task: "${a.data?.title || a.data?.id || 'Task'}"`;

                    return {
                        action: a.action,
                        data: a.data,
                        description: desc || `${a.action.replace('_', ' ')}`
                    };
                });
                setPendingExecution({ items });
            }
        }
    };

    const handleCancelAction = () => {
        setPendingExecution(null);
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: '❌ Operation execution cancelled.'
        }]);
    };

    const isExecutingRef = useRef(false);

    const handleConfirmAction = async () => {
        if (!pendingExecution || isAILoading || isExecutingRef.current) return;

        isExecutingRef.current = true;
        const items = [...pendingExecution.items];
        // Clear pending execution immediately to prevent double triggers
        setPendingExecution(null);
        setIsAILoading(true);

        const projectTasksCache: Record<string, Task[]> = {};
        const projectsToRefresh = new Set<string>();
        let successCount = 0;
        const summary: string[] = [];

        try {
            for (const item of items) {
                let pid = currentContext?.projectId;
                let pName = currentContext?.projectName || "Unknown";

                if (item.data.project && projects) {
                    const found = projects.find(p => p.name.toLowerCase() === item.data.project.toLowerCase() || p.id === item.data.project);
                    if (found) { pid = found.id; pName = found.name; }
                }

                if (!pid) continue;
                projectsToRefresh.add(pid);

                if (!projectTasksCache[pid]) {
                    projectTasksCache[pid] = (pid === currentContext?.projectId) ? [...currentContext.tasks] : await db.getTasks(pid) || [];
                }

                const tasks = projectTasksCache[pid];
                if (item.action === 'create_task') {
                    const newTask: Task = { id: crypto.randomUUID(), title: item.data.title || "New", description: item.data.description || "", status: item.data.status || "Draft", priority: item.data.priority || Priority.MEDIUM, category: item.data.category || "General", project: pName, isCompleted: false, createdAt: Date.now(), dueDate: item.data.dueDate ? new Date(item.data.dueDate).getTime() : null, subTasks: [] };
                    tasks.push(newTask);
                    summary.push(`Created **${newTask.title}** in **${pName}**`);
                    successCount++;
                } else if (item.action === 'update_task') {
                    const targetId = item.data.id || item.data.taskId || item.data.task_id;
                    const idx = tasks.findIndex(t => t.id === targetId);
                    if (idx !== -1) {
                        tasks[idx] = { ...tasks[idx], ...item.data, project: pName };
                        summary.push(`Updated **${tasks[idx].title}**`);
                        successCount++;
                    }
                } else if (item.action === 'delete_task') {
                    const targetId = item.data.id || item.data.taskId || item.data.task_id;
                    const targetTitle = item.data.title;
                    const originalLen = projectTasksCache[pid].length;

                    // Try deleting by ID first
                    if (targetId) {
                        projectTasksCache[pid] = projectTasksCache[pid].filter(t => t.id !== targetId);
                    }

                    // Fallback: If title is provided and nothing was deleted, try deleting by title
                    if (projectTasksCache[pid].length === originalLen && targetTitle) {
                        projectTasksCache[pid] = projectTasksCache[pid].filter(t => t.title.toLowerCase() !== targetTitle.toLowerCase());
                    }

                    if (projectTasksCache[pid].length < originalLen) {
                        const deletedCount = originalLen - projectTasksCache[pid].length;
                        summary.push(`Permanently removed **${deletedCount}** card(s) from **${pName}**`);
                        successCount++;
                    } else {
                        summary.push(`*Failed*: Could not find card "${targetId || targetTitle}" to delete in **${pName}**`);
                    }
                }
            }

            // Batch save all affected projects
            for (const pid of Array.from(projectsToRefresh)) {
                if (projectTasksCache[pid]) {
                    await db.saveTasks(pid, projectTasksCache[pid]);
                }
            }

            if (successCount > 0) notifyBoardRefresh();

            // Generate concise summary
            let finalMessage = `✅ **Successfully executed ${successCount} actions.**`;
            if (successCount > 0 && items.length > 0) {
                const firstItem = items[0];
                const pName = items[0].data.project || currentContext?.projectName || "project";

                // Group by action type
                const actionTypes = Array.from(new Set(items.map(i => i.action)));

                if (actionTypes.length === 1) {
                    const action = actionTypes[0];
                    if (action === 'create_task') {
                        const titles = Array.from(new Set(items.map(i => i.data.title)));
                        const titleDesc = (titles.length === 1 && titles[0]) ? ` with title "**${titles[0]}**"` : "";
                        finalMessage = `✅ **Successfully created ${successCount} new tasks${titleDesc}.** All tasks have been added to **${pName}**.`;
                    } else if (action === 'delete_task') {
                        finalMessage = `✅ **Permanently removed ${successCount} cards** from **${pName}**.`;
                    } else if (action === 'update_task') {
                        finalMessage = `✅ **Updated ${successCount} tasks** in **${pName}**.`;
                    }
                }
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: finalMessage,
                isSystemSummary: true
            }]);
        } catch (e) {
            console.error("Execution failed:", e);
            setMessages(prev => [...prev, { role: 'assistant', content: "❌ Sorry, I encountered an error while executing the actions." }]);
        } finally {
            setIsAILoading(false);
            isExecutingRef.current = false;
        }
    };

    const handleClearChat = async () => {
        globalConfirm({
            title: 'Clear Chat History?',
            message: 'Are you sure you want to clear the chat history for this board?',
            type: 'danger',
            confirmText: 'Clear',
            onConfirm: async () => {
                const contextId = currentContext?.projectId || 'global';

                // Reset in state
                setMessages([
                    { role: 'assistant', content: 'Hello! I am your AI assistant. How can I help you today?' }
                ]);

                // Clear in database
                await db.saveChatHistory(contextId, []);

                if (pendingExecution) {
                    setPendingExecution(null);
                }
            }
        });
    };

    if (!isAIEnabled && !isChatOpen) return null;

    return (
        <div className={`h-full bg-white border-l border-gray-200 flex flex-col transition-all duration-300 ease-in-out overflow-hidden shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] 
      ${isChatOpen
                ? 'fixed inset-0 w-full z-[100] md:relative md:inset-auto md:w-[380px] lg:w-[420px] opacity-100'
                : 'w-0 opacity-0 border-none pointer-events-none md:w-0'
            }`}>
            <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-10 min-h-[73px] shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-white shadow-sm overflow-hidden pt-1.5 px-1 pb-0">
                        <OllamaIcon size={22} />
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h2 className="font-bold text-gray-800 text-[15px] leading-tight">AI Assistant</h2>
                            {isAIEnabled && activeModel && (
                                <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-black uppercase tracking-tighter truncate max-w-[120px]">
                                    {activeModel}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className={`w-2 h-2 rounded-full ${isAIEnabled ? 'bg-green-500 animate-pulse' : 'bg-green-500'}`}></div>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate max-w-[200px]">
                                {!isAIEnabled ? 'Engine Disabled' : (currentContext ? `Synced with ${currentContext.projectName}` : 'Ollama Online')}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {isAIEnabled && (
                        <button
                            onClick={handleClearChat}
                            className="p-2 hover:bg-red-50 rounded-full text-gray-400 hover:text-red-500 transition-colors"
                            title="Clear chat history"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                    <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"><PanelRightClose size={20} /></button>
                </div>
            </div>

            {!isAIEnabled ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
                        <AlertCircle size={32} />
                    </div>
                    <h3 className="font-bold text-gray-700 mb-2">AI Engine Disabled</h3>
                    <p className="text-sm text-gray-500 leading-relaxed mb-6">
                        Enable the AI Engine from the top toolbar or settings to use the assistant.
                    </p>
                    <button
                        onClick={() => setIsChatOpen(false)}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        Close Assistant
                    </button>
                </div>
            ) : (
                <>
                    <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-gray-200">
                        {isHistoryLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                <Loader2 size={32} className="text-blue-500 animate-spin" />
                                <p className="text-xs text-gray-400 font-medium tracking-widest uppercase">Syncing context...</p>
                            </div>
                        ) : (
                            <>
                                {messages.length <= 1 && (
                                    <div className="py-8 flex flex-col items-center text-center animate-in fade-in zoom-in duration-500">
                                        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4"><Bot size={32} /></div>
                                        <h3 className="font-bold text-gray-800 text-lg mb-2">Welcome to AI Chat</h3>
                                        <p className="text-sm text-gray-500 px-6 leading-relaxed">I am your AI assistant. Tag boards with @ or ask me to create tasks.</p>
                                    </div>
                                )}

                                {messages.filter(m => !m.hidden).map((msg, idx) => {
                                    const isOnlyJSON = msg.role === 'assistant' &&
                                        ((msg.content.trim().startsWith('```json') && msg.content.trim().endsWith('```')) || (msg.content.trim().startsWith('{') && msg.content.trim().endsWith('}'))) &&
                                        (msg.content.includes('"action"') || msg.content.includes('"actions"'));

                                    if (isOnlyJSON) return null;

                                    // Process @ mentions into markdown links for custom rendering, hiding the #ID part from display
                                    const processedContent = msg.content
                                        .replace(/@\[(.*?)(?:#(.*?))?\]/g, '[$1](#mention)')
                                        .replace(/@(create|update|delete|read|all)\b/g, '[@$1](#exec-tag)');

                                    return (
                                        <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                            <div className={`flex items-center gap-2 mb-1.5 px-1 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                                <div className={`w-6 h-6 rounded flex items-center justify-center bg-blue-50 text-blue-600`}>{msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}</div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                                            </div>
                                            <div className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm transition-all relative ${msg.role === 'user'
                                                ? (msg.error ? 'bg-red-500 text-white rounded-tr-none shadow-red-100' : 'bg-blue-600 text-white rounded-tr-none shadow-blue-100 shadow-md')
                                                : 'bg-gray-50 text-gray-800 border border-gray-200 rounded-tl-none hover:border-gray-300'
                                                }`}>
                                                {msg.error && msg.role === 'user' && (
                                                    <button
                                                        onClick={() => handleSend(msg.content, idx)}
                                                        className="absolute -left-10 top-1/2 -translate-y-1/2 p-2 bg-white border border-red-200 text-red-500 rounded-full hover:bg-red-50 transition-all shadow-sm group/retry"
                                                        title="Retry sending"
                                                    >
                                                        <RefreshCw size={14} className="group-hover/retry:rotate-180 transition-transform duration-500" />
                                                    </button>
                                                )}
                                                <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert text-white' : 'prose-slate'}`}>
                                                    <ReactMarkdown
                                                        components={{
                                                            a({ node, href, children, ...props }: any) {
                                                                if (href === '#mention') {
                                                                    const label = String(children);
                                                                    const isTask = label.includes('/');
                                                                    return (
                                                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold mx-0.5 align-middle shadow-sm ${isTask ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-indigo-100 text-indigo-800 border border-indigo-200'}`}>
                                                                            {isTask ? <Hash size={10} /> : <Bookmark size={10} />}
                                                                            {label}
                                                                        </span>
                                                                    );
                                                                }
                                                                if (href === '#exec-tag') {
                                                                    return (
                                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold mx-0.5 align-middle shadow-sm bg-amber-100 text-amber-800 border border-amber-200">
                                                                            <Zap size={10} />
                                                                            {children}
                                                                        </span>
                                                                    );
                                                                }
                                                                return <a href={href} {...props}>{children}</a>;
                                                            },
                                                            pre: ({ children }) => {
                                                                const content = String((children as any)?.props?.children || '');
                                                                if (content.includes('"action"') || content.includes('"actions"')) return null;
                                                                return <pre className="bg-gray-900 text-white p-3 rounded-lg my-2 overflow-x-auto">{children}</pre>;
                                                            }
                                                        }}
                                                    >
                                                        {processedContent}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        )}

                        {isAILoading && (
                            <div className="flex flex-col items-start animate-pulse">
                                <div className="flex items-center gap-2 mb-1.5 px-1"><div className="w-6 h-6 rounded flex items-center justify-center bg-blue-50 text-blue-600"><Bot size={12} /></div><span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Assistant is typing...</span></div>
                                <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-none px-4 py-4 flex items-center gap-3 w-fit shadow-sm"><div className="flex gap-1"><div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-100"></div><div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-200"></div></div></div>
                            </div>
                        )}

                        {pendingExecution && (
                            <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="w-full max-w-[95%] bg-white border border-blue-200 rounded-lg shadow-lg p-4 mb-4">
                                    <div className="flex items-center gap-2 mb-3 text-blue-700 pb-0">
                                        <img src="/media/ollama.svg" alt="" className="h-8" />
                                        <span className="font-bold text-sm">Action Preview ({pendingExecution.items.length})</span>
                                    </div>
                                    <div className="space-y-2 mb-4 max-h-[250px] overflow-y-auto px-1">
                                        {pendingExecution.items.map((item, i) => (
                                            <div key={i} className="bg-gray-50 border border-gray-200 rounded-md p-2.5 relative overflow-hidden">
                                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.action === 'create_task' ? 'bg-green-500' : item.action === 'update_task' ? 'bg-blue-500' : 'bg-red-500'}`} />
                                                <div className="text-xs font-bold text-gray-800 truncate">{item.data.title || item.description}</div>
                                                <div className="text-[10px] text-gray-400 flex justify-between mt-1"><span>{item.action}</span><span className="font-bold text-blue-500">{item.data.project || 'Current'}</span></div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-2 justify-end pt-2 border-t border-gray-50">
                                        <button onClick={handleCancelAction} className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-md">Cancel</button>
                                        <button onClick={handleConfirmAction} className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-1.5 shadow-md"><CheckCircle2 size={14} /> Confirm</button>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-4 bg-white border-t border-gray-200 relative">
                        <form
                            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                            className="flex flex-col bg-gray-50 border border-gray-200 rounded-lg focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500/50 transition-all shadow-sm overflow-hidden"
                        >
                            <textarea
                                ref={textareaRef}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (showSuggestions) {
                                        if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestionIndex(prev => (prev + 1) % suggestions.length); }
                                        else if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length); }
                                        else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertSuggestion(suggestions[suggestionIndex]); }
                                        else if (e.key === 'Escape') setShowSuggestions(false);
                                    } else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                                }}
                                placeholder="Ask something or request a task..."
                                className="w-full bg-transparent border-none px-4 pt-4 pb-2 text-sm focus:ring-0 outline-none resize-none placeholder:text-gray-400"
                                style={{ minHeight: '60px', maxHeight: '200px' }}
                                rows={1}
                                disabled={isAILoading}
                            />

                            <div className="flex items-center justify-between px-3 pb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5">
                                        <Zap size={10} className="text-amber-500" />
                                        Type <kbd className="bg-gray-200/50 px-1 rounded border border-gray-200 text-gray-500 font-mono">@</kbd>
                                    </span>
                                </div>

                                <button
                                    type="submit"
                                    disabled={!inputValue.trim() || isAILoading}
                                    className={`p-2 rounded transition-all duration-200 flex items-center gap-2 ${!inputValue.trim() || isAILoading
                                        ? 'bg-transparent text-gray-300'
                                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-95'
                                        }`}
                                    title="Send Message"
                                >
                                    {isAILoading ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <>
                                            <span className="text-xs font-bold px-1 hidden md:inline">Send</span>
                                            <Send size={18} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>

                        {showSuggestions && (
                            <div ref={suggestionsRef} className="absolute bottom-[calc(100%-0.5rem)] left-4 right-4 bg-white border border-gray-200 rounded-2xl shadow-2xl mb-2 overflow-hidden z-[100] animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 bg-gray-50/50">Mentions</div>
                                <div className="max-h-[300px] overflow-y-auto py-1 custom-scrollbar">
                                    {suggestions.map((s, i) => (
                                        <button key={`${s.type}-${s.id}`} onClick={() => insertSuggestion(s)} className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${i === suggestionIndex ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-600'}`}>
                                            <div className={`w-5 h-5 rounded flex items-center justify-center ${s.type === 'board' ? 'bg-indigo-50 text-indigo-600' :
                                                s.type === 'tag' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                                                }`}>
                                                {s.type === 'board' ? <Bookmark size={10} /> :
                                                    s.type === 'tag' ? <Zap size={10} /> : <Hash size={10} />}
                                            </div>
                                            <div className="flex flex-col min-w-0"><span className="text-xs font-bold truncate">{s.type === 'tag' ? `@${s.label}` : s.label}</span>{s.subLabel && <span className="text-[9px] text-gray-400 truncate">{s.subLabel}</span>}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <p className="text-[9px] text-gray-400 text-center mt-3 px-4 leading-tight">
                            AI can make mistakes. Please verify important information.
                        </p>
                    </div>
                </>
            )}
        </div>
    );
};

export default ChatBot;
