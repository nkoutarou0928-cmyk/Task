import React, { useState } from 'react';
import { useSimulator } from '../context/SimulatorContext';
import type { Task } from '../types';
import { CircularProgressBar } from './CircularProgressBar';
import { 
  ChevronDown, 
  ChevronRight, 
  Clock, 
  Calendar, 
  Plus, 
  Trash2, 
  Edit3, 
  AlertTriangle,
  Users
} from 'lucide-react';

interface TaskNodeProps {
  task: Task;
  depth: number;
  onEdit: (task: Task) => void;
  onAddSubtask: (parent: Task) => void;
}

const TaskNode: React.FC<TaskNodeProps> = ({ task, depth, onEdit, onAddSubtask }) => {
  const { 
    tasks, 
    users, 
    simTime, 
    updateTaskProgress, 
    deleteTask, 
    teams 
  } = useSimulator();
  
  const [isExpanded, setIsExpanded] = useState(true);
  const [showProgressSlider, setShowProgressSlider] = useState(false);

  // Check if this task has children
  const children = tasks.filter((t) => t.parent_id === task.id);
  const isParent = children.length > 0;

  // Find assigned user and team
  const assignee = users.find((u) => u.id === task.assigned_user_id);
  const team = teams.find((t) => t.id === task.team_id);

  // Calculate remaining time
  const deadlineDate = new Date(task.deadline);
  const remainingMs = deadlineDate.getTime() - simTime.getTime();
  const remainingHours = remainingMs / (1000 * 60 * 60);

  // Determine priority score P
  // P = (estimated_minutes * (100 - progress)) / remaining_hours
  const remainingWorkMinutes = task.estimated_minutes * ((100 - task.progress_rate) / 100);
  const remainingWorkHours = remainingWorkMinutes / 60;
  
  const denominator = remainingHours <= 0 ? 0.05 : Math.max(0.05, remainingHours);
  const priorityScore = task.progress_rate >= 100 ? 0 : Math.round((task.estimated_minutes * (100 - task.progress_rate)) / denominator / 1000);

  // "Yabai" prediction condition
  // Remaining Time < Remaining Work * 1.5 AND task is not completed
  const isYabai = task.progress_rate < 100 && remainingHours < (remainingWorkHours * 1.5);

  // Deadline Badge Styling
  let badgeClass = 'badge-safe';
  let deadlineText = '';

  if (task.progress_rate >= 100) {
    badgeClass = 'badge-done';
    deadlineText = '完了';
  } else if (remainingHours <= 0) {
    badgeClass = 'badge-urgent';
    deadlineText = '期限切れ';
  } else if (remainingHours < 24) {
    badgeClass = 'badge-urgent';
    deadlineText = `残り ${Math.round(remainingHours)}時間`;
  } else if (remainingHours < 72) {
    badgeClass = 'badge-warning';
    deadlineText = `残り ${Math.round(remainingHours / 24)}日`;
  } else {
    badgeClass = 'badge-safe';
    deadlineText = `残り ${Math.round(remainingHours / 24)}日`;
  }

  // Handle simple checkbox click (0% or 100%)
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isParent) return;
    const newProgress = e.target.checked ? 100 : 0;
    updateTaskProgress(task.id, newProgress);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Task Row */}
      <div 
        className={`task-row-container ${isYabai ? 'yabai-glow' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          marginBottom: '8px',
          marginLeft: `${depth * 20}px`,
          transition: 'var(--transition-smooth)',
          boxShadow: isYabai ? 'var(--glow-red)' : 'none',
        }}
      >
        {/* Toggle Folder Collapse Button */}
        <div style={{ width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isParent ? (
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px'
              }}
            >
              {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
          ) : null}
        </div>

        {/* Checkbox (only for leaf tasks) */}
        {!isParent ? (
          <input 
            type="checkbox" 
            checked={task.progress_rate === 100}
            onChange={handleCheckboxChange}
            style={{
              width: '18px',
              height: '18px',
              marginRight: '12px',
              accentColor: 'var(--accent-blue)',
              cursor: 'pointer'
            }}
          />
        ) : (
          <div style={{ width: '18px', marginRight: '12px' }} />
        )}

        {/* Task Info Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span 
              style={{ 
                fontWeight: 600, 
                fontSize: '15px',
                color: task.progress_rate === 100 ? 'var(--text-muted)' : 'var(--text-primary)',
                textDecoration: task.progress_rate === 100 ? 'line-through' : 'none'
              }}
            >
              {task.title}
            </span>

            {/* Team indicator */}
            {team && (
              <span 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  fontSize: '11px',
                  color: 'var(--accent-blue)',
                  background: 'rgba(0, 240, 255, 0.08)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(0, 240, 255, 0.2)'
                }}
              >
                <Users size={10} />
                {team.team_name}
              </span>
            )}

            {/* Warning indicator */}
            {isYabai && (
              <span 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  fontSize: '11px',
                  color: 'var(--accent-red)',
                  fontWeight: 700,
                  animation: 'pulse 1.5s infinite'
                }}
              >
                <AlertTriangle size={12} />
                やばい！
              </span>
            )}
          </div>

          {/* Sub-info bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            {/* Workload */}
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} />
              {task.estimated_minutes}分
            </span>

            {/* Deadline Date */}
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={12} />
              {deadlineDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} 
              {' '}{deadlineDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>

            {/* Assignee Avatar */}
            {assignee && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span 
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: assignee.theme_color,
                    display: 'inline-block'
                  }}
                />
                {assignee.name}
              </span>
            )}
          </div>
        </div>

        {/* Priority & Progress controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Priority Score badge */}
          {task.progress_rate < 100 && (
            <div className="priority-score" title="流動的優先度スコア P">
              AI: {priorityScore}
            </div>
          )}

          {/* Deadline status badge */}
          <span className={`badge ${badgeClass}`}>{deadlineText}</span>

          {/* Progress Circular Bar / Slider Toggle */}
          <div 
            onClick={() => !isParent && setShowProgressSlider(!showProgressSlider)}
            style={{ cursor: !isParent ? 'pointer' : 'default' }}
            title={!isParent ? 'クリックして進捗率を調整' : '親タスクの自動計算された進捗率'}
          >
            <CircularProgressBar 
              progress={task.progress_rate} 
              size={42} 
              strokeWidth={4.5}
              color={isYabai ? 'var(--accent-red)' : 'var(--accent-blue)'}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {/* Add Subtask Button (only if depth < 2 to keep Max 3 levels) */}
            {depth < 2 && (
              <button 
                onClick={() => onAddSubtask(task)}
                className="action-btn"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  borderRadius: '6px',
                  padding: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'var(--transition-fast)'
                }}
                title="子タスクを追加"
              >
                <Plus size={14} />
              </button>
            )}
            
            {/* Edit Button */}
            <button 
              onClick={() => onEdit(task)}
              className="action-btn"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                borderRadius: '6px',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'var(--transition-fast)'
              }}
              title="編集"
            >
              <Edit3 size={14} />
            </button>

            {/* Delete Button */}
            <button 
              onClick={() => {
                if (window.confirm(`本当に『${task.title}』を削除しますか？`)) {
                  deleteTask(task.id);
                }
              }}
              className="action-btn-danger"
              style={{
                background: 'rgba(255, 51, 102, 0.08)',
                border: '1px solid rgba(255, 51, 102, 0.2)',
                color: 'var(--accent-red)',
                borderRadius: '6px',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'var(--transition-fast)'
              }}
              title="削除"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Inline Leaf Progress Slider */}
      {showProgressSlider && !isParent && (
        <div 
          style={{
            marginLeft: `${depth * 20 + 40}px`,
            background: 'var(--bg-card-hover)',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            border: '1px solid var(--border-color)'
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>進捗率:</span>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={task.progress_rate}
            onChange={(e) => updateTaskProgress(task.id, parseInt(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent-blue)', height: '4px', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 700, width: '40px', textAlign: 'right' }}>
            {task.progress_rate}%
          </span>
          <button 
            onClick={() => setShowProgressSlider(false)}
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            閉じる
          </button>
        </div>
      )}

      {/* Recursive Children Rendering */}
      {isParent && isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {children.map((child) => (
            <TaskNode 
              key={child.id} 
              task={child} 
              depth={depth + 1} 
              onEdit={onEdit} 
              onAddSubtask={onAddSubtask} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const TaskTree: React.FC = () => {
  const { tasks } = useSimulator();
  
  // Find top level root tasks
  const rootTasks = tasks.filter((t) => t.parent_id === null);

  // Modals management
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [addingSubtaskParent, setAddingSubtaskParent] = useState<Task | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {rootTasks.length === 0 ? (
        <div 
          style={{ 
            padding: '40px', 
            textAlign: 'center', 
            color: 'var(--text-secondary)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px' 
          }}
        >
          タスクがありません。「新規タスク」ボタンからタスクを追加してください。
        </div>
      ) : (
        rootTasks.map((task) => (
          <TaskNode 
            key={task.id} 
            task={task} 
            depth={0} 
            onEdit={setEditingTask} 
            onAddSubtask={setAddingSubtaskParent} 
          />
        ))
      )}

      {/* Task Edit Modal */}
      {editingTask && (
        <TaskFormModal 
          task={editingTask} 
          onClose={() => setEditingTask(null)} 
        />
      )}

      {/* Add Subtask Modal */}
      {addingSubtaskParent && (
        <TaskFormModal 
          parentId={addingSubtaskParent.id} 
          teamId={addingSubtaskParent.team_id}
          onClose={() => setAddingSubtaskParent(null)} 
        />
      )}
    </div>
  );
};

// Form Modal Component
export interface TaskFormModalProps {
  task?: Task;
  parentId?: string;
  teamId?: string | null;
  onClose: () => void;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({ task, parentId, teamId, onClose }) => {
  const { 
    users, 
    teams, 
    addTask, 
    updateTaskDetails 
  } = useSimulator();

  const isEditMode = !!task;

  // Form states
  const [title, setTitle] = useState(task ? task.title : '');
  const [estimatedMinutes, setEstimatedMinutes] = useState(task ? task.estimated_minutes : 60);
  const [deadline, setDeadline] = useState(() => {
    if (task) {
      // Convert ISO to local datetime-local input string
      const date = new Date(task.deadline);
      const tzOffset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    }
    // Default deadline: tomorrow at this time
    const defaultDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tzOffset = defaultDate.getTimezoneOffset() * 60000;
    return new Date(defaultDate.getTime() - tzOffset).toISOString().slice(0, 16);
  });
  const [assignedUserId, setAssignedUserId] = useState(task ? (task.assigned_user_id || '') : '');
  const [selectedTeamId, setSelectedTeamId] = useState(() => {
    if (task) return task.team_id || '';
    if (teamId) return teamId;
    return '';
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('タスクタイトルを入力してください。');
      return;
    }

    const taskData = {
      title,
      estimated_minutes: Number(estimatedMinutes),
      deadline: new Date(deadline).toISOString(),
      assigned_user_id: assignedUserId || null,
      team_id: selectedTeamId || null,
    };

    if (isEditMode && task) {
      updateTaskDetails(task.id, taskData);
    } else {
      addTask({
        ...taskData,
        parent_id: parentId || null,
        progress_rate: 0,
      });
    }
    onClose();
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '16px'
      }}
    >
      <div 
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '450px',
          background: 'var(--bg-panel-solid)',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
        }}
      >
        <h3 
          style={{ 
            fontFamily: 'var(--font-display)', 
            fontSize: '20px', 
            fontWeight: 700,
            marginBottom: '20px',
            color: 'var(--accent-blue)' 
          }}
        >
          {isEditMode ? 'タスクの詳細編集' : '新規タスクの追加'}
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">タスクタイトル</label>
            <input 
              type="text" 
              className="form-input" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 文献調査・資料集め"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">想定所要時間 (分)</label>
              <input 
                type="number" 
                className="form-input" 
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Math.max(1, Number(e.target.value)))}
                min="1"
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">所属チーム</label>
              <select 
                className="form-input"
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                disabled={!!parentId} // Subtasks inherit parent's team
              >
                <option value="">（個人タスク）</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.team_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">締切日時</label>
            <input 
              type="datetime-local" 
              className="form-input" 
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">担当ユーザー</label>
            <select 
              className="form-input"
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
            >
              <option value="">担当なし</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button 
              type="button" 
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border-color)',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              キャンセル
            </button>
            <button 
              type="submit" 
              style={{
                background: 'var(--accent-blue)',
                border: 'none',
                color: 'var(--bg-main)',
                padding: '8px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 700,
                boxShadow: 'var(--glow-blue)'
              }}
            >
              保存する
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
