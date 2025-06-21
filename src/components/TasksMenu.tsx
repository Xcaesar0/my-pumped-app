import React from 'react';
import { Target, Gift, HelpCircle } from 'lucide-react';
import TelegramIcon from './icons/TelegramIcon';
import XIcon from './icons/XIcon';

interface Task {
  id: string;
  title: string;
  description: string;
  points: number;
  type: 'telegram' | 'x' | 'other';
  link: string;
}

const TasksMenu: React.FC = () => {
  const tasks: Task[] = [
    {
      id: 'join_telegram',
      title: 'Join Telegram',
      description: 'Join our official Telegram community',
      points: 50,
      type: 'telegram',
      link: 'https://t.me/your_telegram_group'
    },
    {
      id: 'follow_x',
      title: 'Follow @pumpeddotfun',
      description: 'Follow @pumpeddotfun on X (Twitter)',
      points: 50,
      type: 'x',
      link: 'https://x.com/pumpeddotfun'
    },
    {
      id: 'repost_launch',
      title: 'Repost Launch Post',
      description: 'Repost our latest launch announcement',
      points: 75,
      type: 'x',
      link: 'https://x.com/pumpeddotfun/status/your_launch_post_id'
    }
  ];

  const getTaskIcon = (type: 'telegram' | 'x' | 'other') => {
    switch (type) {
      case 'telegram':
        return <TelegramIcon className="w-5 h-5 text-blue-400" />;
      case 'x':
        return <XIcon className="w-5 h-5 text-white" />;
      default:
        return <HelpCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="rounded-2xl border border-gray-700/50 p-6" style={{ backgroundColor: '#171717' }}>
      <div className="flex items-center space-x-3 mb-6">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center" 
          style={{ background: 'linear-gradient(135deg, #52D593 0%, #4ade80 100%)' }}
        >
          <Target className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-xl font-bold text-white">Active Tasks</h2>
      </div>

      <div className="space-y-4">
        {tasks.map((task) => (
          <div 
            key={task.id}
            className="p-4 rounded-lg border border-gray-700/50 transition-all duration-300"
            style={{ backgroundColor: '#262626' }}
          >
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700/50 flex items-center justify-center mt-1">
                {getTaskIcon(task.type)}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-white">{task.title}</h3>
                <p className="text-sm text-gray-400">{task.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-yellow-400">{task.points} points</span>
                    <div className="flex items-center space-x-1 text-gray-400">
                      {getTaskIcon(task.type)}
                      <span className="text-xs">
                        {task.type === 'telegram' && 'Telegram'}
                        {task.type === 'x' && 'X (Twitter)'}
                        {task.type === 'other' && 'Task'}
                      </span>
                    </div>
                  </div>
                  <a
                    href={task.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 transition-colors duration-200 text-sm font-medium text-white"
                  >
                    Start
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TasksMenu;