import React from 'react';
import { useSimulator } from '../context/SimulatorContext';
import type { Task } from '../types';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { CircularProgressBar } from './CircularProgressBar';
import { motion } from 'framer-motion';
import { 
  ArrowUpDown, 
  Clock, 
  Calendar, 
  AlertTriangle,
  HelpCircle,
  GripVertical,
  CheckCircle2
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { 
    tasks, 
    users, 
    simTime, 
    sortMode, 
    setSortMode, 
    setTasksOrder,
    updateTaskProgress
  } = useSimulator();

  // Filter tasks to show in the Dashboard: 
  // - Show only incomplete tasks or tasks with progress < 100
  // - Show all tasks so user can see what happens when they complete it
  const activeTasks = tasks.filter(t => t.progress_rate < 100);
  const completedTasks = tasks.filter(t => t.progress_rate === 100);

  // Helper to calculate Priority Score P
  const getPriorityInfo = (task: Task) => {
    const deadlineDate = new Date(task.deadline);
    const remainingMs = deadlineDate.getTime() - simTime.getTime();
    const remainingHours = remainingMs / (1000 * 60 * 60);
    const denominator = remainingHours <= 0 ? 0.05 : Math.max(0.05, remainingHours);
    
    const remainingWorkMinutes = task.estimated_minutes * ((100 - task.progress_rate) / 100);
    const remainingWorkHours = remainingWorkMinutes / 60;
    
    // P = remaining_work_minutes / remaining_hours / 100 (scaled for display)
    const score = Math.round(remainingWorkMinutes / denominator / 10);
    
    const isYabai = remainingHours < (remainingWorkHours * 1.5);
    
    return {
      score,
      remainingHours,
      remainingWorkMinutes,
      isYabai,
      formula: `(${task.estimated_minutes}分 × ${100 - task.progress_rate}%) / ${remainingHours <= 0 ? '0.05' : Math.max(0.05, remainingHours).toFixed(1)}時間`
    };
  };

  // Sort tasks based on selected mode
  const getSortedTasks = () => {
    if (sortMode === 'ai') {
      return [...activeTasks].sort((a, b) => {
        const scoreA = getPriorityInfo(a).score;
        const scoreB = getPriorityInfo(b).score;
        return scoreB - scoreA; // Descending order of priority
      });
    }
    // In manual mode, we respect the current array order from tasks state
    // but filter to only show active ones.
    return activeTasks;
  };

  const sortedActiveTasks = getSortedTasks();

  // Handle Drag End
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    // Switch to manual mode immediately on drag
    setSortMode('manual');

    const items = Array.from(sortedActiveTasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Merge reordered active tasks back with completed tasks and non-active ones
    const newTasksOrder: Task[] = [];
    
    // Map items order
    items.forEach((item) => {
      newTasksOrder.push(item);
    });

    // Add completed tasks back at the end
    completedTasks.forEach((item) => {
      newTasksOrder.push(item);
    });

    // Handle any tasks that were somehow missed (e.g. parent tasks that might not be in the list)
    tasks.forEach((t) => {
      if (!newTasksOrder.some(x => x.id === t.id)) {
        newTasksOrder.push(t);
      }
    });

    setTasksOrder(newTasksOrder);
  };

  // Get deadline badge styling with dynamic colors
  const getDeadlineBadge = (progress: number, remainingHours: number) => {
    let text = '';
    let color = '';

    if (progress >= 100) {
      text = '完了';
      color = '#00f5d4';
    } else if (remainingHours <= 0) {
      text = '期限切れ';
      color = '#FF4D4D';
    } else if (remainingHours < 24) {
      text = `残り ${Math.round(remainingHours)}時間`;
      color = '#FF4D4D';
    } else if (remainingHours < 72) {
      text = `残り ${Math.round(remainingHours / 24)}日`;
      color = '#FFC107';
    } else {
      text = `残り ${Math.round(remainingHours / 24)}日`;
      color = '#E0E0E0';
    }

    return {
      text,
      style: {
        backgroundColor: `${color}1a`, // 10% opacity
        color: color,
        border: `1px solid ${color}4d`, // 30% opacity
      },
      color
    };
  };

  // Handle Swipe Gesture Action
  const handleSwipeEnd = (info: any, task: Task) => {
    const swipeThreshold = 120;
    if (info.offset.x > swipeThreshold) {
      // Swiped right -> complete
      updateTaskProgress(task.id, 100);
    } else if (info.offset.x < -swipeThreshold) {
      // Swiped left -> lower priority to bottom
      setSortMode('manual');
      const otherTasks = tasks.filter(t => t.id !== task.id);
      setTasksOrder([...otherTasks, task]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Control bar */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '12px 16px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowUpDown size={16} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>並び替えモード:</span>
        </div>

        <div className="view-tabs">
          <button 
            className={`tab-btn ${sortMode === 'ai' ? 'active' : ''}`}
            onClick={() => setSortMode('ai')}
          >
            🤖 AI自動優先度順
          </button>
          <button 
            className={`tab-btn ${sortMode === 'manual' ? 'active' : ''}`}
            onClick={() => setSortMode('manual')}
          >
            🤝 手動ドラッグ＆ドロップ
          </button>
        </div>
      </div>

      {/* Main List */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="tasks-list" isDropDisabled={sortMode === 'ai'}>
          {(provided) => (
            <div 
              {...provided.droppableProps} 
              ref={provided.innerRef}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              {sortedActiveTasks.length === 0 ? (
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
                  未完了のタスクはありません！素晴らしい進捗です 🎉
                </div>
              ) : (
                sortedActiveTasks.map((task, index) => {
                  const { score, remainingHours, isYabai, formula } = getPriorityInfo(task);
                  const badge = getDeadlineBadge(task.progress_rate, remainingHours);
                  const assignee = users.find(u => u.id === task.assigned_user_id);
                  const hasChildren = tasks.some(t => t.parent_id === task.id);

                  return (
                    <Draggable 
                      key={task.id} 
                      draggableId={task.id} 
                      index={index}
                      isDragDisabled={sortMode === 'ai'}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          style={{
                            width: '100%',
                            position: 'relative',
                            overflow: 'hidden',
                            borderRadius: '12px',
                            marginBottom: '12px',
                            ...provided.draggableProps.style,
                          }}
                        >
                          {/* Swipe Background indicators */}
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: 0,
                            right: 0,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0 24px',
                            borderRadius: '12px',
                            background: 'linear-gradient(90deg, rgba(0,245,212,0.2) 0%, rgba(141,78,221,0.2) 100%)',
                            pointerEvents: 'none'
                          }}>
                            <span style={{ color: '#00f5d4', fontWeight: 800, fontSize: '13px' }}>👉 右スワイプで完了</span>
                            <span style={{ color: '#9d4edd', fontWeight: 800, fontSize: '13px' }}>優先度を下げる 左スワイプ 👈</span>
                          </div>

                          <motion.div
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.6}
                            onDragEnd={(_, info) => handleSwipeEnd(info, task)}
                            className={`task-card-outer rounded-2xl shadow-lg border border-gray-100 dark:border-zinc-800 bg-white dark:bg-[#1E1E1E] text-black dark:text-white transition-all duration-300 ${isYabai ? 'yabai-glow' : ''}`}
                            style={{
                              display: 'flex',
                              alignItems: 'stretch',
                              padding: 0,
                              boxShadow: isYabai 
                                ? 'var(--glow-red)' 
                                : snapshot.isDragging 
                                  ? 'var(--glow-blue)' 
                                  : 'none',
                              userSelect: 'none',
                              touchAction: 'none',
                              overflow: 'hidden'
                            }}
                          >
                            {/* Left vertical line (width: 4px) */}
                            <div 
                              style={{
                                width: '4px',
                                backgroundColor: (() => {
                                  if (task.progress_rate >= 100) return '#9CA3AF'; // Completed tasks: grey
                                  if (remainingHours <= 0) return '#FF4D4D'; // Expired: red
                                  if (remainingHours < 24) return '#FF4D4D'; // Red
                                  if (remainingHours < 72) return '#FFC107'; // Yellow
                                  return '#9CA3AF'; // Grey
                                })(),
                                flexShrink: 0,
                                alignSelf: 'stretch'
                              }}
                            />

                            {/* Inner Padding Wrapper */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '16px',
                                flex: 1,
                                gap: '12px',
                                width: '100%'
                              }}
                            >
                              {/* Drag Handle (Visible only in manual mode) */}
                              {sortMode === 'manual' && (
                                <div 
                                  {...provided.dragHandleProps} 
                                  style={{ 
                                    cursor: 'grab', 
                                    color: 'var(--text-muted)', 
                                    marginRight: '12px',
                                    display: 'flex',
                                    alignItems: 'center' 
                                  }}
                                >
                                  <GripVertical size={20} />
                                </div>
                              )}

                              {/* Left: Checkbox (hidden for parent tasks) */}
                              {!hasChildren && (
                                <button
                                  onClick={() => updateTaskProgress(task.id, 100)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                    marginRight: '16px',
                                    color: 'var(--text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'var(--transition-fast)'
                                  }}
                                  title="完了にする"
                                >
                                  <CheckCircle2 
                                    size={22} 
                                    style={{
                                      color: 'rgba(128,128,128,0.25)',
                                    }}
                                  />
                                </button>
                              )}

                              {/* Middle: Info */}
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontWeight: 700, fontSize: '16px' }} className="text-black dark:text-white">{task.title}</span>
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
                                      やばさ検知
                                    </span>
                                  )}
                                </div>

                                {/* Task meta */}
                                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={12} />
                                    想定: {task.estimated_minutes}分
                                  </span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Calendar size={12} />
                                    締切: {new Date(task.deadline).toLocaleDateString()} {new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {assignee && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <span 
                                        style={{
                                          width: '10px',
                                          height: '10px',
                                          borderRadius: '50%',
                                          backgroundColor: assignee.theme_color
                                        }}
                                      />
                                      {assignee.name}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right: Scores & Progress */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                {/* AI Score Badge with Formula Tooltip */}
                                <div 
                                  className="priority-score" 
                                  style={{ cursor: 'help', position: 'relative' }}
                                  title={`AI優先度スコア: ${score}\n式: P = ${formula}`}
                                >
                                  <span>AI優先度: {score}</span>
                                  <HelpCircle size={12} style={{ opacity: 0.6 }} />
                                </div>

                                {/* Deadline Status Badge */}
                                <span className="badge" style={badge.style}>{badge.text}</span>

                                {/* Progress bar */}
                                <CircularProgressBar 
                                  progress={task.progress_rate} 
                                  size={hasChildren ? 52 : 44} 
                                  strokeWidth={hasChildren ? 5 : 4} 
                                  color={badge.color}
                                />
                              </div>
                            </div>
                          </motion.div>
                      </div>
                    )}
                  </Draggable>
                  );
                })
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Completed Tasks section (Brief list) */}
      {completedTasks.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h4 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '10px', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
            完了済みのタスク ({completedTasks.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.6 }}>
            {completedTasks.map((task) => (
              <div 
                key={task.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 16px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  justifyContent: 'space-between'
                }}
              >
                <span style={{ textDecoration: 'line-through', color: 'var(--text-secondary)', fontSize: '14px' }}>
                  {task.title}
                </span>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {new Date(task.deadline).toLocaleDateString()} 完了
                  </span>
                  <button
                    onClick={() => updateTaskProgress(task.id, 0)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    未完了に戻す
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
