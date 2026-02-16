import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { db } from '../services/db';
import { Bell, X, Trash2, Check, ExternalLink, MessageSquare, User } from 'lucide-react';

const timeAgo = (timestamp: number) => {
    const now = Date.now();
    const seconds = Math.floor((now - timestamp) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
};

const NotificationCenter: React.FC = () => {
    const { notifications, unreadCount, markNotificationRead, removeNotification, setNotifications } = useApp();
    const [isOpen, setIsOpen] = useState(false);

    const getParsedMetadata = (metadata: any) => {
        if (!metadata) return null;
        if (typeof metadata === 'object') return metadata;
        try {
            return JSON.parse(metadata);
        } catch (e) {
            return null;
        }
    };

    const getNotifIcon = (type: string) => {
        switch (type) {
            case 'mention': return <MessageSquare size={14} className="text-blue-500" />;
            case 'assignment': return <User size={14} className="text-purple-500" />;
            default: return <Bell size={14} className="text-amber-500" />;
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative w-12 h-12 flex items-center justify-center rounded-full transition-all border-2 shadow-xl shrink-0 group z-[80] ${isOpen
                    ? 'bg-blue-50 text-blue-600 border-blue-200 ring-4 ring-blue-500/10'
                    : 'bg-white text-gray-500 hover:text-blue-600 border-gray-100 hover:border-blue-100'
                    }`}
            >
                <Bell size={20} strokeWidth={isOpen ? 3 : 2} className="group-hover:scale-110 transition-transform" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-0.5 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full border-2 border-white shadow-md flex items-center justify-center min-w-[20px] h-[20px]">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-[60]"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute bottom-full right-0 mb-4 w-80 md:w-96 bg-white border border-gray-100 rounded-2xl shadow-[0_20px_70px_-10px_rgba(0,0,0,0.2)] z-[70] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out origin-bottom-right">
                        <div className="px-5 py-4 bg-slate-50/50 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider">
                                <Bell size={16} strokeWidth={3} className="text-blue-600" />
                                Notifications
                            </h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                            >
                                <X size={16} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="px-4 py-12 text-center">
                                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Bell size={24} className="text-gray-300" />
                                    </div>
                                    <p className="text-gray-500 text-sm">No notifications yet</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {notifications.map((notif) => {
                                        const metadata = getParsedMetadata(notif.metadata);
                                        return (
                                            <div
                                                key={notif.id}
                                                className={`px-4 py-4 flex gap-3 transition-colors relative group ${!notif.isRead ? 'bg-blue-50/40' : 'hover:bg-gray-50/50'}`}
                                            >
                                                {!notif.isRead && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />}

                                                <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${notif.type === 'mention' ? 'bg-blue-50' :
                                                    notif.type === 'assignment' ? 'bg-purple-50' : 'bg-amber-50'
                                                    }`}>
                                                    {getNotifIcon(notif.type)}
                                                </div>

                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                    <p className={`text-sm leading-tight mb-1 ${!notif.isRead ? 'text-gray-900 font-bold' : 'text-gray-600 font-medium'}`}>
                                                        {notif.message}
                                                    </p>
                                                    <div className="flex items-center gap-3 text-[10px] uppercase font-black tracking-widest text-gray-400">
                                                        <span>{timeAgo(notif.created_at)}</span>
                                                        {metadata?.projectId && (
                                                            <a
                                                                href={`/board/${metadata.projectId}${metadata.taskId ? `#task-${metadata.taskId}` : ''}`}
                                                                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
                                                                onClick={(e) => {
                                                                    // We might want to mark read automatically when clicking link
                                                                    if (!notif.isRead) markNotificationRead(notif.id);
                                                                }}
                                                            >
                                                                <ExternalLink size={10} />
                                                                OPEN TASK
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 shrink-0 self-center">
                                                    {!notif.isRead && (
                                                        <button
                                                            onClick={() => markNotificationRead(notif.id)}
                                                            className="p-1.5 bg-white border border-blue-100 hover:bg-blue-500 hover:text-white rounded-lg text-blue-600 transition-all shadow-sm flex items-center justify-center"
                                                            title="Mark as read"
                                                        >
                                                            <Check size={14} strokeWidth={3} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => removeNotification(notif.id)}
                                                        className="p-1.5 bg-white border border-gray-100 hover:bg-rose-500 hover:text-white rounded-lg text-gray-400 transition-all shadow-sm opacity-0 group-hover:opacity-100 flex items-center justify-center"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {notifications.length > 0 && (
                            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-center">
                                <button
                                    className="text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-rose-500 transition-colors"
                                    onClick={async () => {
                                        if (window.confirm("Clear all notifications?")) {
                                            try {
                                                await db.notifications.clearAll();
                                                setNotifications([]);
                                            } catch (e) {
                                                console.error("Failed to clear notifications", e);
                                            }
                                        }
                                    }}
                                >
                                    Clear all notifications
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationCenter;
