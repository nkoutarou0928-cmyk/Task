import React, { useState, useEffect } from 'react';
import { SimulatorProvider, useSimulator } from './context/SimulatorContext';
import { DashboardView } from './components/DashboardView';
import { TaskTree, TaskFormModal } from './components/TaskTree';
import { Sidebar } from './components/Sidebar';
import { ToastContainer } from './components/ToastContainer';
import { Onboarding } from './components/Onboarding';
import { Plus, CheckSquare, ListTree, BookOpen, Sun, Moon, RefreshCw, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AppInner: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tree'>('dashboard');
  const [showAddRootModal, setShowAddRootModal] = useState(false);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<'大学の講義 🌿' | '就職活動 💼' | 'サークル活動 📣'>('大学の講義 🌿');
  const { currentUser, tasks, rebuildSchedule, setCurrentUser, users, addTask } = useSimulator();
  
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('tasknow_onboarding_completed');
  });

  const [devMode, setDevMode] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [inputText, setInputText] = useState("");
  const [slimeAnim, setSlimeAnim] = useState<{
    active: boolean;
    text: string;
    targetGroup: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.setProperty('--bg-main', '#121212');
      root.style.setProperty('--bg-card', '#1E1E1E');
      root.style.setProperty('--border-color', '#2D2D32');
      root.style.setProperty('--text-primary', '#FFFFFF');
      root.style.setProperty('--text-secondary', '#C7B7A3');
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
  const userLeafTasks = userTasks.filter(t => !tasks.some(child => child.parentId === t.id));
  const completedUserLeafTasks = userLeafTasks.filter(t => t.progressRate === 100);
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

  const triggerSlimeFlight = (taskTitle: string, targetGroup: string, onComplete: () => void) => {
    const inputEl = document.getElementById("bottom-input-bar");
    const badgeEl = document.getElementById(`group-badge-${targetGroup}`);
    
    if (inputEl && badgeEl) {
      const inputRect = inputEl.getBoundingClientRect();
      const badgeRect = badgeEl.getBoundingClientRect();
      
      const startX = inputRect.left + inputRect.width / 2;
      const startY = inputRect.top;
      const endX = badgeRect.left + badgeRect.width / 2;
      const endY = badgeRect.top + badgeRect.height / 2;
      
      setSlimeAnim({
        active: true,
        text: taskTitle,
        targetGroup,
        startX,
        startY,
        endX,
        endY
      });
      
      setTimeout(() => {
        const badgeBtn = document.getElementById(`group-badge-${targetGroup}`);
        if (badgeBtn) {
          badgeBtn.classList.add("slime-impact");
          setTimeout(() => badgeBtn.classList.remove("slime-impact"), 500);
        }
        onComplete();
        setSlimeAnim(null);
      }, 700);
    } else {
      onComplete();
    }
  };

  const handleBottomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    let targetGroup: '大学の講義 🌿' | '就職活動 💼' | 'サークル活動 📣' = '大学の講義 🌿';
    let estimatedMinutes = 60;
    let daysToAdd = 1;

    const lowerText = inputText.toLowerCase();
    if (lowerText.includes("就活") || lowerText.includes("es") || lowerText.includes("エントリー") || lowerText.includes("面接") || lowerText.includes("インターン")) {
      targetGroup = "就職活動 💼";
      estimatedMinutes = 120;
      daysToAdd = 2;
    } else if (lowerText.includes("サークル") || lowerText.includes("合宿") || lowerText.includes("チラシ") || lowerText.includes("部活") || lowerText.includes("歓迎") || lowerText.includes("チラシ")) {
      targetGroup = "サークル活動 📣";
      estimatedMinutes = 90;
      daysToAdd = 3;
    }

    const deadlineDate = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);
    const titleToCreate = inputText;

    triggerSlimeFlight(titleToCreate, targetGroup, () => {
      addTask({
        title: titleToCreate,
        estimatedMinutes,
        deadline: deadlineDate.toISOString(),
        groupName: targetGroup,
        parentId: null,
        progressRate: 0,
        team_id: null,
        assigned_user_id: currentUser.id || null
      });
    });
    setInputText("");
  };

  const groups: Array<'大学の講義 🌿' | '就職活動 💼' | 'サークル活動 📣'> = [
    '大学の講義 🌿',
    '就職活動 💼',
    'サークル活動 📣'
  ];

  return (
    <div className="app-container bg-[#FDFBF7] dark:bg-[#121212] text-[#4A3E3D] dark:text-[#FFFFFF] transition-colors duration-300">
      {showOnboarding && (
        <Onboarding onComplete={handleOnboardingComplete} />
      )}
      
      {/* Main Workspace (Left) */}
      <div className="main-content" style={{ paddingBottom: '140px' }}>
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
                  backgroundColor: currentUser.theme_color || '#B5C7A3'
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

            {/* New Task Detail Button */}
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
              title="詳細設定画面から追加"
            >
              <Plus size={14} />
              詳細追加
            </button>
          </div>
        </header>

        {/* Selected Group Capsule Badges Center-Top */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', margin: '10px 0 25px' }}>
          {groups.map((group) => {
            const isActive = selectedGroupFilter === group;
            return (
              <button
                key={group}
                id={`group-badge-${group}`}
                onClick={() => setSelectedGroupFilter(group)}
                style={{
                  padding: '10px 22px',
                  borderRadius: '9999px',
                  background: isActive ? 'var(--accent-green)' : 'var(--bg-card-hover)',
                  color: isActive ? '#4A3E3D' : 'var(--text-secondary)',
                  fontWeight: isActive ? 800 : 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 6px 16px rgba(181, 199, 163, 0.35)' : 'none',
                  border: isActive ? '1px solid var(--accent-green)' : '1px solid var(--border-color)',
                  transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
              >
                {group}
              </button>
            );
          })}
        </div>

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
          {activeTab === 'dashboard' ? (
            <DashboardView selectedGroup={selectedGroupFilter} />
          ) : (
            <TaskTree selectedGroup={selectedGroupFilter} />
          )}
        </div>
      </div>

      {/* Fixed Bottom Input Area */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: devMode ? 'calc(50% - 180px)' : '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '680px',
        padding: '16px 24px 24px',
        background: 'linear-gradient(0deg, var(--bg-main) 70%, transparent 100%)',
        zIndex: 100,
        pointerEvents: 'none'
      }}>
        <form 
          onSubmit={handleBottomSubmit}
          id="bottom-input-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            background: theme === 'light' ? '#F3EDE2' : '#2A2522',
            border: '1px solid var(--border-color)',
            borderRadius: '9999px',
            padding: '6px 12px 6px 20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            pointerEvents: 'auto',
            width: '100%',
            transition: 'var(--transition-smooth)'
          }}
        >
          <input 
            type="text"
            placeholder={`${selectedGroupFilter.slice(0, -2)}に関するタスクを入力... (自動振り分けされます)`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '14px',
              color: 'var(--text-primary)',
              padding: '8px 0'
            }}
          />
          <button
            type="submit"
            style={{
              background: 'var(--accent-green)',
              border: 'none',
              color: '#4A3E3D',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
              boxShadow: '0 2px 8px rgba(181, 199, 163, 0.3)'
            }}
            title="送信して自動分類"
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      {/* Parabolic Squishy Flying Slime Layer */}
      {slimeAnim && (
        <motion.div
          initial={{ 
            left: slimeAnim.startX, 
            top: slimeAnim.startY, 
            x: "-50%", 
            y: "-50%",
            scaleX: 1, 
            scaleY: 1, 
            opacity: 1 
          }}
          animate={{
            left: [slimeAnim.startX, (slimeAnim.startX + slimeAnim.endX) / 2, slimeAnim.endX],
            top: [slimeAnim.startY, Math.min(slimeAnim.startY, slimeAnim.endY) - 160, slimeAnim.endY],
            scaleX: [1, 0.6, 1.4, 0.4, 1],
            scaleY: [1, 1.8, 0.7, 1.6, 1],
            opacity: [1, 1, 1, 0.9, 0]
          }}
          transition={{
            duration: 0.7,
            ease: [0.25, 0.8, 0.25, 1],
            times: [0, 0.35, 0.7, 0.9, 1]
          }}
          style={{
            position: 'fixed',
            zIndex: 9999,
            background: 'var(--accent-green)',
            border: '2px solid rgba(255,255,255,0.4)',
            color: '#4A3E3D',
            padding: '8px 18px',
            borderRadius: '18px',
            fontSize: '12px',
            fontWeight: 'bold',
            boxShadow: '0 6px 16px rgba(181, 199, 163, 0.45)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none'
          }}
        >
          {slimeAnim.text}
        </motion.div>
      )}

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
