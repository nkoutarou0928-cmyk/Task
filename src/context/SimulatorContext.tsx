import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { User, Team, TeamMember, Task, SimEvent, FCMNotification } from '../types';

interface SimulatorContextType {
  users: User[];
  teams: Team[];
  teamMembers: TeamMember[];
  tasks: Task[];
  currentUser: User;
  simTime: Date;
  simEvents: SimEvent[];
  notifications: FCMNotification[];
  sortMode: 'ai' | 'manual';
  setSortMode: (mode: 'ai' | 'manual') => void;
  setCurrentUser: (user: User) => void;
  updateTaskProgress: (taskId: string, progress: number, updaterUser?: User) => void;
  updateTaskDetails: (taskId: string, updates: Partial<Task>) => void;
  addTask: (task: Omit<Task, 'id'>) => void;
  deleteTask: (taskId: string) => void;
  advanceTime: (hours: number) => void;
  triggerCronCheck: () => void;
  simulateTeammateAction: (teammateId: string, taskId: string, newProgress: number) => void;
  clearAllData: () => void;
  setTasksOrder: (orderedTasks: Task[]) => void;
  addToast: (message: string, type: 'info' | 'success' | 'warning') => void;
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning';
}

const SimulatorContext = createContext<SimulatorContextType | undefined>(undefined);

// Base URLs for API and WebSockets
const API_BASE = window.location.port === '5173' ? 'http://localhost:8888' : window.location.origin;
const WS_BASE = window.location.port === '5173' ? 'ws://localhost:8888' : window.location.origin.replace(/^http/, 'ws');

export const SimulatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentUser, setCurrentUser] = useState<User>({ id: '', name: '', email: '', theme_color: '' });
  const [simTime, setSimTime] = useState<Date>(new Date());
  const [simEvents, setSimEvents] = useState<SimEvent[]>([]);
  const [notifications, setNotifications] = useState<FCMNotification[]>([]);
  const [sortMode, setSortMode] = useState<'ai' | 'manual'>('ai');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  const tokenRef = useRef<string | null>(localStorage.getItem('jwt_token'));
  const wsRef = useRef<WebSocket | null>(null);

  // Sync sortMode
  useEffect(() => {
    const saved = localStorage.getItem('sim_sort_mode');
    if (saved === 'ai' || saved === 'manual') setSortMode(saved);
  }, []);

  const changeSortMode = (mode: 'ai' | 'manual') => {
    setSortMode(mode);
    localStorage.setItem('sim_sort_mode', mode);
  };

  // Toast notifications helper
  const addToast = (message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Log simulation events locally in the terminal-style panel
  const addLocalEvent = (user: string, message: string, type: 'info' | 'success' | 'warning' | 'websocket' | 'notification') => {
    const newEvent: SimEvent = {
      id: 'evt-' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      user,
      message,
      type,
    };
    setSimEvents((prev) => [newEvent, ...prev.slice(0, 49)]);
  };

  // Fetch initial data
  const loadData = async () => {
    try {
      // 1. Fetch Users
      const usersRes = await fetch(`${API_BASE}/api/v1/users`);
      const usersData: User[] = await usersRes.json();
      setUsers(usersData);

      // 2. Fetch Teams
      const teamsRes = await fetch(`${API_BASE}/api/v1/teams`);
      const teamsData: Team[] = await teamsRes.json();
      setTeams(teamsData);

      // 3. Fetch Simulator State
      const stateRes = await fetch(`${API_BASE}/api/v1/simulator/state`);
      const stateData = await stateRes.json();
      setSimTime(new Date(stateData.simTime));
      setNotifications(stateData.fcmNotifications);

      // 4. Set default User if not selected
      const savedUser = localStorage.getItem('sim_current_user');
      let initialUser = savedUser ? JSON.parse(savedUser) : null;
      
      if (!initialUser || !usersData.some(u => u.id === initialUser.id)) {
        initialUser = usersData[0] || { id: 'user-alice', name: 'A君 (Alice)', email: 'alice@univ.ac.jp', theme_color: '#ff4d6d' };
      }
      
      setCurrentUser(initialUser);
      localStorage.setItem('sim_current_user', JSON.stringify(initialUser));

      // 5. Get JWT token
      await acquireToken(initialUser.id);

      // 6. Fetch Tasks
      await fetchTasks();
    } catch (e) {
      console.error("Error loading application initial seed:", e);
      addLocalEvent("エラー", "サーバーとの通信に失敗しました。Expressが起動しているか確認してください。", "warning");
    }
  };

  // Fetch tasks helper
  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/tasks`);
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Acquire JWT token from backend
  const acquireToken = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      tokenRef.current = data.token;
      localStorage.setItem('jwt_token', data.token);
    } catch (e) {
      console.error("Token acquisition error:", e);
    }
  };

  // Initialize data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Connect to WebSockets
  useEffect(() => {
    const connectWS = () => {
      const ws = new WebSocket(WS_BASE);
      wsRef.current = ws;

      ws.onopen = () => {
        addLocalEvent("WebSocket", "サーバーとの接続が確立されました。", "info");
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'CONNECTION_SUCCESS':
            break;
          case 'TASK_CREATED':
            addLocalEvent(data.updater, data.message, "success");
            addToast(data.message, "success");
            await fetchTasks();
            break;
          case 'TASK_UPDATED':
            // If the updater is current user, we already logged it in actions.
            // If it's a teammate, display websocket type log and toast
            if (data.updater !== currentUser.name) {
              addLocalEvent(data.updater, `WS同期: ${data.message}`, "websocket");
              addToast(data.message, "info");
            }
            await fetchTasks();
            break;
          case 'TASK_DETAILS_UPDATED':
            addLocalEvent(data.updater, data.message, "info");
            addToast(data.message, "info");
            await fetchTasks();
            break;
          case 'TASK_DELETED':
            addLocalEvent(data.updater, data.message, "warning");
            addToast(data.message, "warning");
            await fetchTasks();
            break;
          case 'TIME_TRAVELED':
            addLocalEvent("システム", data.message, "info");
            setSimTime(new Date(data.newTime));
            await fetchTasks();
            break;
          case 'FCM_WARNING':
            addLocalEvent("FCMバッチ処理", data.message, "notification");
            addToast(data.message, "warning");
            setNotifications(prev => [data.notification, ...prev]);
            break;
          case 'RESET':
            addLocalEvent("システム", data.message, "info");
            addToast(data.message, "info");
            setNotifications([]);
            setSortMode('ai');
            await fetchTasks();
            break;
        }
      };

      ws.onclose = () => {
        addLocalEvent("WebSocket", "サーバーとの接続が切れました。再接続を試みます...", "warning");
        setTimeout(connectWS, 3000); // Reconnect in 3s
      };

      ws.onerror = (err) => {
        console.error("WS error:", err);
      };
    };

    connectWS();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [currentUser]);

  // Switch Current User
  const handleSetCurrentUser = async (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('sim_current_user', JSON.stringify(user));
    addLocalEvent("システム", `操作ユーザーを『${user.name}』に切り替えました。JWT認可トークンをロード中。`, "info");
    await acquireToken(user.id);
  };

  // Update Task Progress
  const updateTaskProgress = async (taskId: string, progress: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/tasks/${taskId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenRef.current}`
        },
        body: JSON.stringify({ progress_rate: progress })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "API error");
      }

      const updated = await res.json();
      addLocalEvent(currentUser.name, `タスク『${updated.title}』の進捗を ${progress}% に更新しました。`, "success");
      addToast(`進捗を更新しました (${progress}%)`, "success");
      await fetchTasks();
    } catch (e: any) {
      console.error(e);
      addToast(`エラー: ${e.message}`, "warning");
      addLocalEvent("APIエラー", `進捗更新に失敗しました: ${e.message}`, "warning");
    }
  };

  // Update Task Details
  const updateTaskDetails = async (taskId: string, updates: Partial<Task>) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenRef.current}`
        },
        body: JSON.stringify(updates)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "API error");
      }

      await fetchTasks();
    } catch (e: any) {
      console.error(e);
      addToast(`詳細更新失敗: ${e.message}`, "warning");
    }
  };

  // Add Task
  const addTask = async (taskDetails: Omit<Task, 'id'>) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenRef.current}`
        },
        body: JSON.stringify(taskDetails)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "API error");
      }

      await fetchTasks();
    } catch (e: any) {
      console.error(e);
      addToast(`タスク作成失敗: ${e.message}`, "warning");
    }
  };

  // Delete Task
  const deleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${tokenRef.current}`
        }
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "API error");
      }

      await fetchTasks();
    } catch (e: any) {
      console.error(e);
      addToast(`削除失敗: ${e.message}`, "warning");
    }
  };

  // Time Travel
  const advanceTime = async (hours: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/simulator/time-travel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours })
      });
      const data = await res.json();
      setSimTime(new Date(data.newTime));
      await fetchTasks();
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger Cron prediction check manually
  const triggerCronCheck = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/simulator/cron-check`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.triggered && data.triggered.length > 0) {
        // Handled via WS trigger broadcast, but fetch tasks just in case
        await fetchTasks();
      } else {
        addLocalEvent("FCMバッチ処理", "Cronジョブが手動実行されました。危険判定のタスクはありません。", "info");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Simulate teammate action
  // To simulate Bob making changes, we fetch Bob's token, make the REST post, and Alice receives it via WebSocket!
  const simulateTeammateAction = async (teammateId: string, taskId: string, newProgress: number) => {
    try {
      const teammate = users.find(u => u.id === teammateId);
      if (!teammate) return;

      // 1. Fetch token for teammate
      const authRes = await fetch(`${API_BASE}/api/v1/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: teammateId })
      });
      const authData = await authRes.json();
      const teammateToken = authData.token;

      // 2. Perform progress post using teammate token
      const res = await fetch(`${API_BASE}/api/v1/tasks/${taskId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${teammateToken}`
        },
        body: JSON.stringify({ progress_rate: newProgress })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Teammate simulation API error");
      }

      addLocalEvent("シミュレータ", `他メンバー『${teammate.name}』の進捗変更をWebSocketネットワーク上に送信しました。`, "info");
      await fetchTasks();
    } catch (e: any) {
      console.error(e);
      addToast(`シミュレーション失敗: ${e.message}`, "warning");
    }
  };

  // Reset database and simulation variables
  const clearAllData = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/simulator/reset`, { method: 'POST' });
      if (res.ok) {
        await loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Set order (Drag and drop list rearrange)
  const setTasksOrder = (orderedTasks: Task[]) => {
    setTasks(orderedTasks);
  };

  // Seed model lists locally for templates
  const teamMembers: TeamMember[] = []; // Inferred implicitly

  return (
    <SimulatorContext.Provider
      value={{
        users,
        teams,
        teamMembers,
        tasks,
        currentUser,
        simTime,
        simEvents,
        notifications,
        sortMode,
        setSortMode: changeSortMode,
        setCurrentUser: handleSetCurrentUser,
        updateTaskProgress,
        updateTaskDetails,
        addTask,
        deleteTask,
        advanceTime,
        triggerCronCheck,
        simulateTeammateAction,
        clearAllData,
        setTasksOrder,
        addToast,
        toasts,
        removeToast,
      }}
    >
      {children}
    </SimulatorContext.Provider>
  );
};

export const useSimulator = () => {
  const context = useContext(SimulatorContext);
  if (context === undefined) {
    throw new Error('useSimulator must be used within a SimulatorProvider');
  }
  return context;
};
