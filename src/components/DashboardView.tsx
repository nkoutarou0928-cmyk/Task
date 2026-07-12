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
  CheckCircle2,
  Trash2
} from 'lucide-react';

interface DashboardViewProps {
  selectedGroup: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ selectedGroup }) => {
  const { 
    tasks, 
    users, 
    simTime, 
    sortMode, 
    setSortMode, 
    setTasksOrder,
    updateTaskProgress,
    deleteTask
  } = useSimulator();

  // Filter tasks based on completed rate and group
  const activeTasks = tasks.filter(t => t.progressRate < 100 && t.groupName === selectedGroup);
  const completedTasks = tasks.filter(t => t.progressRate === 100 && t.groupName === selectedGroup);

  // Helper to calculate Priority Score P
  const getPriorityInfo = (task: Task) => {
    const deadlineDate = new Date(task.deadline);
    const remainingMs = deadlineDate.getTime() - simTime.getTime();
    const remainingHours = remainingMs / (1000 * 60 * 60);
    const denominator = remainingHours <= 0 ? 0.05 : Math.max(0.05, remainingHours);
    
    const remainingWorkMinutes = task.estimatedMinutes * ((100 - task.progressRate) / 100);
    const remainingWorkHours = remainingWorkMinutes / 60;
    
    // P = remaining_work_minutes / remaining_hours / 10 (scaled for display)
    const score = Math.round(remainingWorkMinutes / denominator / 10);
    
    const isYabai = remainingHours < (remainingWorkHours * 1.5);
    
    return {
      score,
      remainingHours,
      remainingWorkMinutes,
      isYabai,
      formula: `(${task.estimatedMinutes}分 × ${100 - task.progressRate}%) / ${remainingHours <= 0 ? '0.05' : Math.max(0.05, remainingHours).toFixed(1)}時間`
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
    return activeTasks;
  };

  const sortedActiveTasks = getSortedTasks();

  // Handle Drag End
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    setSortMode('manual');

    const items = Array.from(sortedActiveTasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Rebuild full tasks array order
    const newTasksOrder: Task[] = [];
    
    // Add active items in new order
    items.forEach((item) => {
      newTasksOrder.push(item);
    });

    // Add completed tasks back at the end
    completedTasks.forEach((item) => {
      newTasksOrder.push(item);
    });

    // Add any other tasks that belong to other groups to preserve order
    tasks.forEach((t) => {
      if (!newTasksOrder.some(added => added.id === t.id)) {
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
      color = '#B5C7A3'; // Sage Green
    } else if (remainingHours <= 0) {
      text = '期限切れ';
      color = '#E6A79A'; // Terracotta Red
    } else if (remainingHours < 24) {
      text = `残り ${Math.round(remainingHours)}時間`;
      color = '#E6A79A'; // Terracotta Red
    } else if (remainingHours < 72) {
      text = `残り ${Math.round(remainingHours / 24)}日`;
      color = '#EED09D'; // Mustard Yellow
    } else {
      text = `残り ${Math.round(remainingHours / 24)}日`;
      color = '#B5C7A3'; // Sage Green
    }

    return {
      text,
      style: {
        backgroundColor: `${color}22`,
        color: color,
        border: `1px solid ${color}4d`,
      },
      color
    };
  };

  // Handle Swipe Gesture Action
  const handleSwipeEnd = (info: any, task: Task) => {
    const swipeThreshold = 120;
    if (info.offset.x < -swipeThreshold) {
      // Swiped left -> delete task
      deleteTask(task.id);
    } else if (info.offset.x > swipeThreshold) {
      // Swiped right -> complete task to 100%
      updateTaskProgress(task.id, 100);
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
          background: 'var(--bg-card-hover)', 
          padding: '12px 20px', 
          borderRadius: '16px',
          border: '1px solid var(--border-color)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          <ArrowUpDown size={16} />
          <span>ソート設定:</span>
        </div>
        <div className="view-tabs" style={{ background: 'rgba(0,0,0,0.05)', border: 'none' }}>
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
            🤝 手動並び替え
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
                    borderRadius: '24px' 
                  }}
                >
                  このグループのタスクはありません！素晴らしい進捗です 🎉
                </div>
              ) : (
                sortedActiveTasks.map((task, index) => {
                  const { score, remainingHours, isYabai, formula } = getPriorityInfo(task);
                  const badge = getDeadlineBadge(task.progressRate, remainingHours);
                  const assignee = users.find(u => u.id === task.assigned_user_id);
                  const hasChildren = tasks.some(t => t.parentId === task.id);

                  return (
                    <Draggable 
                      key={task.id} 
                      draggableId={task.id} 
                      index={index}
                      isDragDisabled={sortMode === 'ai'}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          style={{
                            width: '100%',
                            position: 'relative',
                            overflow: 'hidden',
                            borderRadius: '24px',
                            marginBottom: '12px',
                            ...provided.draggableProps.style,
                          }}
                        >
                          {/* Swipe Underlay Indicators */}
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
                            borderRadius: '24px',
                            background: 'linear-gradient(90deg, rgba(181,199,163,0.2) 0%, rgba(230,167,154,0.2) 100%)',
                            pointerEvents: 'none'
                          }}>
                            <span style={{ color: 'var(--accent-green)', fontWeight: 800, fontSize: '13px' }}>👉 右スワイプで完了</span>
                            <span style={{ color: 'var(--accent-red)', fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Trash2 size={14} /> 削除する 左スワイプ 👈
                            </span>
                          </div>

                          <motion.div
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.6}
                            onDragEnd={(_, info) => handleSwipeEnd(info, task)}
                            className={`task-card-outer rounded-3xl shadow-sm border border-[#EAE3D8] dark:border-[#2D2D32] bg-white dark:bg-[#1E1E1E] text-[#4A3E3D] dark:text-[#FFFFFF] transition-all duration-300 ${isYabai ? 'yabai-glow' : ''}`}
                            style={{
                              display: 'flex',
                              alignItems: 'stretch',
                              padding: 0,
                              userSelect: 'none',
                              touchAction: 'none',
                              overflow: 'hidden'
                            }}
                          >
                            {/* Left indicator strip */}
                            <div 
                              style={{
                                width: '4px',
                                backgroundColor: (() => {
                                  if (task.progressRate >= 100) return '#B5C7A3';
                                  if (remainingHours <= 0) return '#E6A79A';
                                  if (remainingHours < 24) return '#E6A79A';
                                  if (remainingHours < 72) return '#EED09D';
                                  return '#B5C7A3';
                                })(),
                                flexShrink: 0,
                                alignSelf: 'stretch'
                              }}
                            />

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

                              {/* Left Checkbox (hidden for parent tasks) */}
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
                                      color: 'rgba(138,126,114,0.25)',
                                    }}
                                  />
                                </button>
                              )}

                              {/* Middle: Info */}
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontWeight: 700, fontSize: '16px' }}>{task.title}</span>
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
                                      期限が迫っています
                                    </span>
                                  )}
                                </div>

                                {/* Task meta */}
                                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={12} />
                                    想定: {task.estimatedMinutes}分
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
                                {/* AI Score Badge */}
                                <div 
                                  className="priority-score" 
                                  style={{ cursor: 'help', position: 'relative' }}
                                  title={`AI優先度スコア: ${score}\n式: P = ${formula}`}
                                >
                                  <span>優先度: {score}</span>
                                  <HelpCircle size={12} style={{ opacity: 0.6 }} />
                                </div>

                                {/* Deadline Status Badge */}
                                <span className="badge" style={badge.style}>{badge.text}</span>

                                {/* Progress bar */}
                                <CircularProgressBar 
                                  progress={task.progressRate} 
                                  size={hasChildren ? 52 : 44} 
                                  strokeWidth={hasChildren ? 7 : 6} 
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
                    締切: {new Date(task.deadline).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => updateTaskProgress(task.id, 0)}
                    style={{
                      background: 'rgba(0,0,0,0.05)',
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
