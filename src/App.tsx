import React, { useState, useEffect } from 'react';
import { SimulatorProvider, useSimulator } from './context/SimulatorContext';
import { DashboardView } from './components/DashboardView';
import { TaskTree, TaskFormModal } from './components/TaskTree';
import { Sidebar } from './components/Sidebar';
import { ToastContainer } from './components/ToastContainer';
import { Onboarding } from './components/Onboarding';
import { Plus, CheckSquare, ListTree, BookOpen, Sun, Moon, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AppInner: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tree'>('dashboard');
  const [showAddRootModal, setShowAddRootModal] = useState(false);
  const { currentUser, tasks, rebuildSchedule, setCurrentUser, users } = useSimulator();
  
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('tasknow_onboarding_completed');
  });

  const [devMode, setDevMode] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.setProperty('--bg-main', '#1F1A17');
      root.style.setProperty('--bg-card', '#2A231F');
      root.style.setProperty('--border-color', '#3E342F');
      root.style.setProperty('--text-primary', '#EAE3D8');
      root.style.setProperty('--text-secondary', '#B5A89E');
      root.style.setProperty('--text-muted', '#8A7E72');
    } else {
      root.classList.remove('dark');
      root.style.setProperty('--bg-main', '#FDFBF7');
      root.style.setProperty('--bg-card', '#FFFFFF');
      root.style.setProperty('--border-color', '#EAE3D8');
      root.style.setProperty('--text-primary', '#4A3E3D');
      root.style.setProperty('--text-secondary', '#8A7E72');
      root.style.setProperty('--text-muted', '#B5A89E');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Calculate overall progress for the active user (all assigned leaf tasks)
  const userTasks = tasks.filter(t => t.assigned_user_id === currentUser.id);
  const userLeafTasks = userTasks.filter(t => !tasks.some(child => child.parent_id === t.id));
  const completedUserLeafTasks = userLeafTasks.filter(t => t.progress_rate === 100);
  const overallProgress = userLeafTasks.length > 0
    ? Math.round((completedUserLeafTasks.length / userLeafTasks.length) * 100)
    : 0;

  const handleOnboardingComplete = (username: string, themeColor: string) => {
    localStorage.setItem('tasknow_onboarding_completed', 'true');
    const baseUser = users[0] || currentUser;
    const customized = {
      ...baseUser,
      name: username,
      theme_color: themeColor
    };
    setCurrentUser(customized);
    setShowOnboarding(false);
  };

  return (
    <div className="app-container bg-[#FDFBF7] dark:bg-[#1F1A17] text-[#4A3E3D] dark:text-[#EAE3D8] transition-colors duration-300">
      {showOnboarding && (
        <Onboarding onComplete={handleOnboardingComplete} />
      )}
      {/* Main Workspace (Left) */}
      <div className="main-content">
        <header className="dashboard-header flex justify-between items-center border-b pb-4 mb-6" style={{ borderColor: 'var(--border-color)' }}>
          <div>
            <h1 className="dashboard-title text-2xl font-extrabold flex items-center gap-2" style={{ background: 'none', WebkitTextFillColor: 'initial', color: 'var(--text-primary)' }}>
              <BookOpen size={28} style={{ color: 'var(--accent-blue)' }} />
              Tasknow
              <span 
                style={{ 
                  fontSize: '11px', 
                  background: 'rgba(139, 166, 169, 0.12)', 
                  border: '1px solid rgba(139, 166, 169, 0.3)', 
                  color: 'var(--accent-blue)', 
                  padding: '2px 8px', 
                  borderRadius: '9999px',
                  fontWeight: 600,
                  marginLeft: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                Cozy v1.0
              </span>
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              温かみのあるオーガニックなタスク管理システム
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* User mini stats */}
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                background: 'rgba(138, 126, 114, 0.05)',
                padding: '6px 12px',
                borderRadius: '9999px',
                border: '1px solid var(--border-color)',
                fontSize: '12px'
              }}
            >
              <div 
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: currentUser.theme_color
                }}
              />
              <span style={{ fontWeight: 600 }}>{currentUser.name}全体の達成度 </span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-blue)' }}>
                {overallProgress}%
              </span>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              style={{
                background: 'rgba(138, 126, 114, 0.08)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '8px',
                borderRadius: '9999px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'var(--transition-fast)'
              }}
              title={theme === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* Developer Mode Toggle */}
            <button
              onClick={() => setDevMode(!devMode)}
              style={{
                background: devMode ? 'rgba(139, 166, 169, 0.15)' : 'rgba(138, 126, 114, 0.08)',
                border: devMode ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
                color: devMode ? 'var(--accent-blue)' : 'var(--text-primary)',
                padding: '10px 16px',
                borderRadius: '9999px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'var(--transition-fast)'
              }}
              title="シミュレーター管理を表示"
            >
              <span>⚙️ 開発者モード</span>
              <span 
                style={{ 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  backgroundColor: devMode ? 'var(--accent-blue)' : 'transparent',
                  border: devMode ? 'none' : '1px solid var(--text-muted)',
                  display: 'inline-block'
                }} 
              />
            </button>

            {/* AI Reschedule Button */}
            <button 
              onClick={() => rebuildSchedule()}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 active:scale-95 transition-all text-white font-bold text-sm px-5 py-2.5 rounded-full shadow-md flex items-center gap-2 border-0 cursor-pointer"
              title="遅れをリセットして再計算"
            >
              <RefreshCw size={14} />
              AIにおまかせ調整 
            </button>

            {/* New Task Button */}
            <button 
              onClick={() => setShowAddRootModal(true)}
              style={{
                background: 'var(--accent-blue)',
                border: 'none',
                color: '#FFF',
                padding: '10px 18px',
                borderRadius: '9999px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(139, 166, 169, 0.15)',
                transition: 'var(--transition-fast)'
              }}
            >
              <Plus size={14} />
              タスクを追加 ＋
            </button>
          </div>
        </header>

        {/* View Selection Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div className="view-tabs">
            <button 
              className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <CheckSquare size={16} />
              統合ToDo (優先度順)
            </button>
            <button 
              className={`tab-btn ${activeTab === 'tree' ? 'active' : ''}`}
              onClick={() => setActiveTab('tree')}
            >
              <ListTree size={16} />
              タスク階層化ツリー
            </button>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            💡 AI優先度スコアは「作業量」と「残り時間」からリアルタイムに再計算されます。
          </div>
        </div>

        {/* Workspace views */}
        <div style={{ flex: 1 }}>
          {activeTab === 'dashboard' ? <DashboardView /> : <TaskTree />}
        </div>
      </div>

      {/* Simulator Sidebar (Right) - Animated Slide in */}
      <AnimatePresence>
        {devMode && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 360, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden', height: '100%', flexShrink: 0 }}
          >
            <div style={{ width: 360, height: '100%' }}>
              <Sidebar />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Alert popup overlay */}
      <ToastContainer />

      {/* Add Root Level Task Modal */}
      {showAddRootModal && (
        <TaskFormModal onClose={() => setShowAddRootModal(false)} />
      )}
    </div>
  );
};

function App() {
  return (
    <SimulatorProvider>
      <AppInner />
    </SimulatorProvider>
  );
}

export default App;
