import React, { useState } from 'react';
import { useSimulator } from '../context/SimulatorContext';
import { 
  Users, 
  Clock, 
  Play, 
  RefreshCw, 
  Send, 
  Bell, 
  Terminal, 
  ShieldCheck
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    users,
    tasks,
    currentUser,
    simTime,
    simEvents,
    notifications,
    setCurrentUser,
    advanceTime,
    triggerCronCheck,
    simulateTeammateAction,
    clearAllData
  } = useSimulator();

  // Teammate action selector states
  const [selectedTeammateId, setSelectedTeammateId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [progressValue, setProgressValue] = useState(100);

  // Filter users to get teammates (excluding active user)
  const teammates = users.filter((u) => u.id !== currentUser.id);

  // Get active team tasks for teammate simulation
  const teamTasks = tasks.filter((t) => t.team_id !== null && tasks.filter(child => child.parent_id === t.id).length === 0); // Leaf team tasks

  const handleSimulateAction = () => {
    if (!selectedTeammateId || !selectedTaskId) {
      alert('シミュレートするメンバーとタスクを選択してください。');
      return;
    }
    simulateTeammateAction(selectedTeammateId, selectedTaskId, progressValue);
  };

  return (
    <div 
      className="glass-panel"
      style={{
        width: '360px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 0,
        borderTop: 'none',
        borderBottom: 'none',
        borderRight: 'none',
        padding: '20px',
        overflowY: 'auto',
        background: 'var(--bg-panel)',
        borderLeft: '1px solid var(--border-color)',
        gap: '20px'
      }}
    >
      {/* Title Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ShieldCheck size={20} style={{ color: 'var(--accent-blue)' }} />
        <h2 
          style={{ 
            fontFamily: 'var(--font-display)', 
            fontSize: '18px', 
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '0.5px'
          }}
        >
          シミュレーター管理
        </h2>
      </div>

      {/* 1. 操作中のユーザー Card */}
      <div 
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 2px 8px rgba(138, 126, 114, 0.02)'
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          👤 操作中のユーザー (JWT認可)
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          {users.map((u) => {
            const isActive = u.id === currentUser.id;
            return (
              <button
                key={u.id}
                onClick={() => setCurrentUser(u)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '8px 4px',
                  borderRadius: '12px',
                  background: isActive ? 'var(--bg-card-hover)' : 'transparent',
                  border: isActive ? `1.5px solid ${u.theme_color}` : '1.5px solid var(--border-color)',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                }}
              >
                <span 
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: u.theme_color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 800,
                    marginBottom: '4px'
                  }}
                >
                  {u.name[0]}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {u.name.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. タイムトラベル Card */}
      <div 
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 2px 8px rgba(138, 126, 114, 0.02)'
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          ⏰ タイムトラベル (時間変動検証)
        </span>
        <div 
          style={{ 
            background: 'var(--bg-card-hover)', 
            padding: '10px 14px', 
            borderRadius: '16px', 
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} />
            現在の仮想時間
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, color: 'var(--accent-blue)' }}>
            {simTime.toLocaleDateString()} {simTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <button 
            onClick={() => advanceTime(1)}
            className="tab-btn"
            style={{ fontSize: '11px', padding: '6px', justifyContent: 'center', background: 'var(--bg-card-hover)', border: '1px solid var(--border-color)', borderRadius: '9999px' }}
          >
            +1時間
          </button>
          <button 
            onClick={() => advanceTime(6)}
            className="tab-btn"
            style={{ fontSize: '11px', padding: '6px', justifyContent: 'center', background: 'var(--bg-card-hover)', border: '1px solid var(--border-color)', borderRadius: '9999px' }}
          >
            +6時間
          </button>
          <button 
            onClick={() => advanceTime(12)}
            className="tab-btn"
            style={{ fontSize: '11px', padding: '6px', justifyContent: 'center', background: 'var(--bg-card-hover)', border: '1px solid var(--border-color)', borderRadius: '9999px' }}
          >
            +12時間
          </button>
          <button 
            onClick={() => advanceTime(24)}
            className="tab-btn"
            style={{ fontSize: '11px', padding: '6px', justifyContent: 'center', background: 'var(--bg-card-hover)', border: '1px solid var(--border-color)', borderRadius: '9999px' }}
          >
            +1日後
          </button>
        </div>

        <button 
          onClick={() => triggerCronCheck()}
          style={{
            background: 'var(--bg-card-hover)',
            border: '1px solid var(--border-color)',
            padding: '8px',
            borderRadius: '9999px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            color: 'var(--accent-blue)',
            marginTop: '4px'
          }}
        >
          <Play size={12} />
          FCM予測 Cron実行 (12時/20時)
        </button>
      </div>

      {/* 3. 他メンバーの進捗共有 Card */}
      <div 
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 2px 8px rgba(138, 126, 114, 0.02)'
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', letterSpacing: '0.5px' }}>
          <Users size={12} />
          他メンバーの進捗共有 (WebSocket)
        </span>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <select 
            className="form-input" 
            style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '9999px' }}
            value={selectedTeammateId}
            onChange={(e) => setSelectedTeammateId(e.target.value)}
          >
            <option value="">メンバーを選択...</option>
            {teammates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <select 
            className="form-input" 
            style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '9999px' }}
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
          >
            <option value="">共有タスクを選択...</option>
            {teamTasks.map(t => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <select 
              className="form-input" 
              style={{ padding: '6px 10px', fontSize: '12px', width: '50%', borderRadius: '9999px' }}
              value={progressValue}
              onChange={(e) => setProgressValue(Number(e.target.value))}
            >
              <option value={100}>100% (完了)</option>
              <option value={70}>70%</option>
              <option value={40}>40%</option>
              <option value={0}>0% (未着手)</option>
            </select>

            <button 
              onClick={handleSimulateAction}
              style={{
                flex: 1,
                background: 'var(--accent-blue)',
                border: 'none',
                color: '#FFF',
                padding: '8px',
                borderRadius: '9999px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <Send size={12} />
              WebSocket送信
            </button>
          </div>
        </div>
      </div>

      {/* 4. FCMプッシュ通知 Card */}
      <div 
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 2px 8px rgba(138, 126, 114, 0.02)',
          minHeight: '180px'
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px' }}>
          <Bell size={12} style={{ color: 'var(--accent-yellow)' }} />
          FCMプッシュ通知 (やばさ予測)
        </span>

        <div 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px', 
            overflowY: 'auto',
            maxHeight: '140px',
            background: 'var(--bg-card-hover)',
            padding: '8px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            flex: 1
          }}
        >
          {notifications.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
              プッシュ通知はありません
            </div>
          ) : (
            notifications.map((n) => (
              <div 
                key={n.id}
                style={{
                  background: 'rgba(230, 167, 154, 0.1)',
                  border: '1px solid rgba(230, 167, 154, 0.25)',
                  borderRadius: '12px',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 700, color: 'var(--accent-red)' }}>
                  <span>⚠️ 予測リマインダー</span>
                  <span>{n.timestamp}</span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-primary)', lineHeight: 1.3 }}>{n.message}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 5. リアルタイム通信・システムログ Card */}
      <div 
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 2px 8px rgba(138, 126, 114, 0.02)',
          height: '240px'
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px' }}>
          <Terminal size={12} />
          リアルタイム通信・システムログ
        </span>
        
        <div 
          style={{ 
            flex: 1,
            background: 'var(--bg-card-hover)', 
            fontFamily: 'monospace', 
            fontSize: '10.5px', 
            padding: '10px', 
            borderRadius: '12px', 
            border: '1px solid var(--border-color)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            color: 'var(--text-primary)'
          }}
        >
          {simEvents.map((evt) => {
            let color = 'var(--text-primary)';
            if (evt.type === 'websocket') color = 'var(--accent-blue)';
            if (evt.type === 'warning') color = 'var(--accent-yellow)';
            if (evt.type === 'notification') color = 'var(--accent-red)';
            if (evt.type === 'success') color = 'var(--accent-green)';

            return (
              <div key={evt.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>[{evt.timestamp}]</span>{' '}
                <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{evt.user}</span>:{' '}
                <span style={{ color }}>{evt.message}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={() => {
          if (window.confirm('シミュレーターデータを初期状態にリセットしますか？')) {
            clearAllData();
          }
        }}
        style={{
          background: 'rgba(230, 167, 154, 0.08)',
          border: '1px solid rgba(230, 167, 154, 0.2)',
          color: 'var(--accent-red)',
          padding: '8px',
          borderRadius: '9999px',
          cursor: 'pointer',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          marginTop: 'auto',
          flexShrink: 0
        }}
      >
        <RefreshCw size={12} />
        シミュレータデータ初期化
      </button>
    </div>
  );
};
