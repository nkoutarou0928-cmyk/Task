import React, { useState } from 'react';
import { useSimulator } from '../context/SimulatorContext';
import type { Task } from '../types';
import { CircularProgressBar } from './CircularProgressBar';
import { motion, AnimatePresence } from 'framer-motion';
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
  const children = tasks.filter((t) => t.parentId === task.id);
  const isParent = children.length > 0;

  // Find assigned user and team
  const assignee = users.find((u) => u.id === task.assigned_user_id);
  const team = teams.find((t) => t.id === task.team_id);

  // Calculate remaining time
  const deadlineDate = new Date(task.deadline);
  const remainingMs = deadlineDate.getTime() - simTime.getTime();
  const remainingHours = remainingMs / (1000 * 60 * 60);

  // Determine priority score P
  // P = (estimatedMinutes * (100 - progress)) / remaining_hours
  const remainingWorkMinutes = task.estimatedMinutes * ((100 - task.progressRate) / 100);
  const remainingWorkHours = remainingWorkMinutes / 60;
  
  const denominator = remainingHours <= 0 ? 0.05 : Math.max(0.05, remainingHours);
  const priorityScore = task.progressRate >= 100 ? 0 : Math.round((task.estimatedMinutes * (100 - task.progressRate)) / denominator / 1000);

  // "Yabai" prediction condition
  // Remaining Time < Remaining Work * 1.5 AND task is not completed
  const isYabai = task.progressRate < 100 && remainingHours < (remainingWorkHours * 1.5);

  // Deadline Badge & Dynamic Urgency Styling
  let deadlineText = '';

  if (task.progressRate >= 100) {
    deadlineText = '完了';
  } else if (remainingHours <= 0) {
    deadlineText = '期限切れ';
  } else if (remainingHours < 24) {
    deadlineText = `残り ${Math.round(remainingHours)}時間`;
  } else if (remainingHours < 72) {
    deadlineText = `残り ${Math.round(remainingHours / 24)}日`;
  } else {
    deadlineText = `残り ${Math.round(remainingHours / 24)}日`;
  }

  const getUrgencyColor = () => {
    if (task.progressRate >= 100) return '#00f5d4'; // Completed (Safe / Emerald Green)
    if (remainingHours < 24) return '#FF4D4D'; // Urgent (<24h / Red)
    if (remainingHours < 72) return '#FFC107'; // Impending (<72h / Yellow)
    return '#E0E0E0'; // Safe (>72h / Neutral Gray)
  };

  const urgencyColor = getUrgencyColor();
  const badgeStyle = {
    backgroundColor: `${urgencyColor}1a`, // 10% opacity
    color: urgencyColor,
    border: `1px solid ${urgencyColor}4d`, // 30% opacity
  };

  // Handle simple checkbox click (0% or 100%)
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isParent) return;
    const newProgress = e.target.checked ? 100 : 0;
    updateTaskProgress(task.id, newProgress);
  };

  // Left 4px vertical indicator color (Cozy Matte palette):
  const getUrgencyBorderColor = () => {
    if (task.progressRate >= 100) return '#B5C7A3'; // Sage Green
    if (remainingHours <= 0) return '#E6A79A'; // Terracotta
    if (remainingHours < 24) return '#E6A79A'; // Terracotta
    if (remainingHours < 72) return '#EED09D'; // Mustard
    return '#B5C7A3'; // Sage Green
  };

  const borderLeftColor = getUrgencyBorderColor();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Task Row Card */}
      <div 
        className="task-card-outer rounded-3xl shadow-sm border border-[#EAE3D8] dark:border-[#2D2D32] bg-white dark:bg-[#1E1E1E] text-[#4A3E3D] dark:text-[#FFFFFF]"
        style={{
          display: 'flex',
          alignItems: 'stretch',
          marginBottom: '10px',
          marginLeft: `${depth * 20}px`,
          position: 'relative',
          overflow: 'hidden',
          padding: 0
        }}
      >
        {/* Left vertical strip */}
        <div 
          style={{
            width: '4px',
            backgroundColor: borderLeftColor,
            flexShrink: 0,
            alignSelf: 'stretch'
          }}
        />

        {/* Content Wrapper */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            flex: 1,
            gap: '12px',
            width: '100%'
          }}
        >
          {/* Collapse/Expand Icon (Visible only if parent) */}
          <div style={{ width: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isParent && (
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </button>
            )}
          </div>

          {/* Simple Checkbox for Leaf Tasks */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {!isParent && (
              <input 
                type="checkbox" 
                checked={task.progressRate === 100}
                onChange={handleCheckboxChange}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                  accentColor: 'var(--accent-green)'
                }}
              />
            )}
          </div>

          {/* Task Info details */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span 
                style={{ 
                  fontWeight: 700, 
                  fontSize: '15px',
                  color: task.progressRate === 100 ? 'var(--text-muted)' : undefined,
                  textDecoration: task.progressRate === 100 ? 'line-through' : 'none'
                }}
              >
                {task.title}
              </span>

              {isYabai && (
                <span 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '3px',
                    color: 'var(--accent-red)', 
                    fontSize: '11px', 
                    fontWeight: 800 
                  }}
                >
                  <AlertTriangle size={12} />
                  遅延の可能性
                </span>
              )}
            </div>

            {/* Meta details */}
            <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={11} />
                {task.estimatedMinutes}分
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={11} />
                {new Date(task.deadline).toLocaleDateString()} {new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {assignee && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span 
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: assignee.theme_color
                    }}
                  />
                  {assignee.name}
                </span>
              )}
              {team && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.8 }}>
                  <Users size={11} />
                  {team.team_name}
                </span>
              )}
            </div>
          </div>

          {/* Right side controls & progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* AI Priority Score Badge (Normalized scaling) */}
            <div 
              className="priority-score"
              style={{ cursor: 'help' }}
              title={`AI優先度スコア: ${priorityScore}`}
            >
              <span>優先度: {priorityScore}</span>
            </div>

            {/* Status badge */}
            <span className="badge" style={badgeStyle}>{deadlineText}</span>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button 
                onClick={() => onAddSubtask(task)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="サブタスクを追加"
              >
                <Plus size={16} />
              </button>
              <button 
                onClick={() => onEdit(task)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="詳細編集"
              >
                <Edit3 size={16} />
              </button>
              <button 
                onClick={() => deleteTask(task.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="削除"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Manual Progress Slider Toggle */}
            {!isParent && (
              <button 
                onClick={() => setShowProgressSlider(!showProgressSlider)}
                style={{
                  background: showProgressSlider ? 'rgba(139, 166, 169, 0.15)' : 'rgba(0, 0, 0, 0.05)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  color: showProgressSlider ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                {task.progressRate}%
              </button>
            )}

            {/* Circle Progress Bar (Parent or Leaf) */}
            <CircularProgressBar 
              progress={task.progressRate} 
              size={isParent ? 38 : 32} 
              strokeWidth={isParent ? 5 : 4} 
              color={urgencyColor}
            />
          </div>
        </div>
      </div>

      {/* Manual progress slider popup drawer */}
      {showProgressSlider && !isParent && (
        <div 
          style={{
            marginLeft: `${depth * 20 + 24}px`,
            padding: '12px 16px',
            background: 'var(--bg-card-hover)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '350px'
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>手動進捗:</span>
          <input 
            type="range" 
            min="0" 
            max="100" 
            step="5"
            value={task.progressRate}
            onChange={(e) => updateTaskProgress(task.id, Number(e.target.value))}
            style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
          />
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: 700, width: '32px' }}>
            {task.progressRate}%
          </span>
          <button 
            onClick={() => setShowProgressSlider(false)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            閉じる
          </button>
        </div>
      )}

      {/* Children Nodes (Recursive call with Framer Motion Accordion slide-down/up) */}
      <AnimatePresence initial={false}>
        {isExpanded && isParent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            {children.map((child) => (
              <TaskNode 
                key={child.id} 
                task={child} 
                depth={depth + 1} 
                onEdit={onEdit}
                onAddSubtask={onAddSubtask}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface TaskTreeProps {
  selectedGroup: string;
}

export const TaskTree: React.FC<TaskTreeProps> = ({ selectedGroup }) => {
  const { tasks } = useSimulator();
  
  // Find top level root tasks filtered by groupName
  const rootTasks = tasks.filter((t) => t.parentId === null && t.groupName === selectedGroup);

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
          このグループのタスクはありません。「完了」したか、下の入力バーから新しいタスクを追加してください。
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
          selectedGroup={selectedGroup}
          onClose={() => setEditingTask(null)} 
        />
      )}

      {/* Add Subtask Modal */}
      {addingSubtaskParent && (
        <TaskFormModal 
          parentId={addingSubtaskParent.id} 
          teamId={addingSubtaskParent.team_id}
          selectedGroup={selectedGroup}
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
  selectedGroup?: string;
  onClose: () => void;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({ task, parentId, teamId, selectedGroup, onClose }) => {
  const { 
    users, 
    teams, 
    addTask, 
    updateTaskDetails 
  } = useSimulator();

  const isEditMode = !!task;

  // Form states
  const [title, setTitle] = useState(task ? task.title : '');
  const [estimatedMinutes, setEstimatedMinutes] = useState(task ? task.estimatedMinutes : 60);
  const [groupName, setGroupName] = useState(task ? task.groupName : (selectedGroup || '大学の講義 🌿'));
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

    const parsedDate = new Date(deadline);
    if (isNaN(parsedDate.getTime())) {
      alert('無効な締切日時です。正しい日時を入力してください。');
      return;
    }

    const taskData = {
      title,
      estimatedMinutes: Number(estimatedMinutes),
      deadline: parsedDate.toISOString(),
      assigned_user_id: assignedUserId || null,
      team_id: selectedTeamId || null,
      groupName,
    };

    if (isEditMode && task) {
      updateTaskDetails(task.id, taskData);
    } else {
      addTask({
        ...taskData,
        parentId: parentId || null,
        progressRate: 0,
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
          {isEditMode ? 'タスクを編集する' : '新しいタスクを追加する'}
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
              <label className="form-label">グループ分類</label>
              <select
                className="form-input"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value as any)}
              >
                <option value="大学の講義 🌿">大学の講義 🌿</option>
                <option value="就職活動 💼">就職活動 💼</option>
                <option value="サークル活動 📣">サークル活動 📣</option>
              </select>
            </div>
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
