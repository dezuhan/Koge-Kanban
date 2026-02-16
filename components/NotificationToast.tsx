import React, { useState, useEffect } from 'react';
import { Bell, X, User, MessageSquare } from 'lucide-react';

export interface Notification {
    id: number;
    type: 'mention' | 'assignment' | 'general';
    message: string;
    created_at: number;
    is_read: boolean;
    metadata?: string;
}

interface NotificationToastProps {
    notification: Notification;
    onClose: (id: number) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Small delay to trigger animation
        const timer = setTimeout(() => setIsVisible(true), 100);

        // Auto close after 5 seconds
        const autoClose = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => onClose(notification.id), 300); // Wait for exit animation
        }, 5000);

        return () => {
            clearTimeout(timer);
            clearTimeout(autoClose);
        };
    }, [notification.id, onClose]);

    const getIcon = () => {
        switch (notification.type) {
            case 'mention': return <MessageSquare className="text-blue-500" size={18} />;
            case 'assignment': return <User className="text-purple-500" size={18} />;
            default: return <Bell className="text-amber-500" size={18} />;
        }
    };

    return (
        <div
            className={`fixed bottom-24 right-6 z-[1000] w-80 bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden transform transition-all duration-300 ease-out flex flex-col ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
                }`}
        >
            <div className="p-4 flex gap-3 pb-3">
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${notification.type === 'mention' ? 'bg-blue-50' :
                    notification.type === 'assignment' ? 'bg-purple-50' : 'bg-amber-50'
                    }`}>
                    {getIcon()}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {notification.type === 'mention' ? 'New Mention' :
                                notification.type === 'assignment' ? 'New Assignment' : 'Notification'}
                        </span>
                        <button
                            onClick={() => {
                                setIsVisible(false);
                                setTimeout(() => onClose(notification.id), 300);
                            }}
                            className="text-slate-300 hover:text-slate-500 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <p className="text-sm font-bold text-slate-700 leading-tight pr-2 mt-0.5">
                        {notification.message}
                    </p>
                </div>
            </div>
            <div className="h-1 w-full bg-slate-50 relative overflow-hidden">
                <div
                    className="absolute top-0 left-0 h-full bg-blue-500 animate-notification-progress"
                    style={{ animationDuration: '5s' }}
                ></div>
            </div>
        </div>
    );
};
