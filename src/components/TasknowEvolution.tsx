import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  CheckSquare, 
  Calendar as CalendarIcon, 
  List, 
  Zap, 
  Users, 
  Send, 
  ChevronDown, 
  ChevronRight, 
  Clock, 
  Calendar as DateIcon,
  RefreshCw,
  Bell
} from 'lucide-react';

// --- インターフェース定義 ---
interface SmallTask {
  id: string;
  title: string;
  completed: boolean;
}

interface MediumTask {
  id: string;
  title: string;
  progressRate: number; // 下位の小タスクから自動計算
  subtasks: SmallTask[];
}

interface LargeTask {
  id: string;
  title: string;
  progressRate: number; // 下位の中タスクの平均値から自動計算
  estimatedMinutes: number;
  deadline: string; // ISO String
  groupName: '大学の講義 🌿' | 'サークル 📣' | 'プライベート ☕️';
  subtasks: MediumTask[];
}

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning';
}

export const TasknowEvolution: React.FC = () => {
  // --- モックデータ初期設定 (3階層タスク構造) ---
  const initialTasks: LargeTask[] = [
    {
      id: 'large-1',
      title: 'ゼミの共同発表資料作成',
      progressRate: 0,
      estimatedMinutes: 330,
      deadline: new Date(Date.now() + 28 * 60 * 60 * 1000).toISOString(), // 約28時間後
      groupName: '大学の講義 🌿',
      subtasks: [
        {
          id: 'medium-1-1',
          title: '文献調査・資料集め',
          progressRate: 0,
          subtasks: [
            { id: 'small-1-1-1', title: '先行研究の論文検索', completed: true },
            { id: 'small-1-1-2', title: '参考文献のPDF保存', completed: true }
          ]
        },
        {
          id: 'medium-1-2',
          title: 'スライド資料の執筆',
          progressRate: 0,
          subtasks: [
            { id: 'small-1-2-1', title: 'イントロダクション作成', completed: true },
            { id: 'small-1-2-2', title: '提案手法スライド執筆', completed: false },
            { id: 'small-1-2-3', title: '評価結果グラフ描画', completed: false }
          ]
        }
      ]
    },
    {
      id: 'large-2',
      title: '夏合宿の案内チラシ作成',
      progressRate: 0,
      estimatedMinutes: 180,
      deadline: new Date(Date.now() + 75 * 60 * 60 * 1000).toISOString(), // 約75時間後
      groupName: 'サークル 📣',
      subtasks: [
        {
          id: 'medium-2-1',
          title: 'デザイン原案作成',
          progressRate: 0,
          subtasks: [
            { id: 'small-2-1-1', title: 'ラフスケッチ作成', completed: false },
            { id: 'small-2-1-2', title: 'イラストレーターでの清書', completed: false }
          ]
        },
        {
          id: 'medium-2-2',
          title: '部室での配布準備',
          progressRate: 0,
          subtasks: [
            { id: 'small-2-2-1', title: 'チラシ印刷と製本', completed: false }
          ]
        }
      ]
    },
    {
      id: 'large-3',
      title: '就活エントリーシート提出',
      progressRate: 0,
      estimatedMinutes: 150,
      deadline: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(), // 約18時間後
      groupName: 'プライベート ☕️',
      subtasks: [
        {
          id: 'medium-3-1',
          title: '自己PRの作成',
          progressRate: 0,
          subtasks: [
            { id: 'small-3-1-1', title: 'エピソードの整理と箇条書き', completed: true },
            { id: 'small-3-1-2', title: '400文字での推敲・清書', completed: false }
          ]
        }
      ]
    }
  ];

  // --- 状態管理 ---
  const [tasks, setTasks] = useState<LargeTask[]>(() => 
    initialTasks.map(calculateProgress)
  );
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');
  const [selectedGroup, setSelectedGroup] = useState<'大学の講義 🌿' | 'サークル 📣' | 'プライベート ☕️'>('大学の講義 🌿');
  const [aiSortActive, setAiSortActive] = useState(false);
  const [simulatedTime, setSimulatedTime] = useState<Date>(new Date());
  const [inputText, setInputText] = useState('');
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({
    'large-1': true,
    'large-2': true,
    'large-3': true
  });
  
  // スライムアニメーション用
  const [slimeAnim, setSlimeAnim] = useState<{
    active: boolean;
    text: string;
    targetGroup: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

  // グループフォルダ内タスクカウンタ
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({
    '大学の講義 🌿': 1,
    'サークル 📣': 1,
    'プライベート ☕️': 1
  });

  // トーストメッセージキュー
  const [toasts, setToasts] = useState<Toast[]>([]);

  // 同期シミュレーション状態
  const [syncing, setSyncing] = useState(false);

  // --- ヘルパー関数 ---
  // 進捗率の自動再計算 (小 ➔ 中 ➔ 大の連動)
  function calculateProgress(largeTask: LargeTask): LargeTask {
    const updatedMediums = largeTask.subtasks.map(medium => {
      const total = medium.subtasks.length;
      const completed = medium.subtasks.filter(s => s.completed).length;
      const progressRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { ...medium, progressRate };
    });

    const totalMediumProgress = updatedMediums.reduce((sum, m) => sum + m.progressRate, 0);
    const progressRate = updatedMediums.length > 0 
      ? Math.round(totalMediumProgress / updatedMediums.length) 
      : 0;

    return { ...largeTask, progressRate, subtasks: updatedMediums };
  }

  // トースト通知追加
  const addToast = (message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  // 小タスク完了トグル
  const handleSmallTaskToggle = (largeId: string, mediumId: string, smallId: string) => {
    setTasks(prev => prev.map(large => {
      if (large.id !== largeId) return large;
      
      const updatedSubtasks = large.subtasks.map(medium => {
        if (medium.id !== mediumId) return medium;
        
        const updatedSmalls = medium.subtasks.map(small => {
          if (small.id !== smallId) return small;
          const nextState = !small.completed;
          addToast(`『${small.title}』を${nextState ? '完了' : '未完了'}にしました`, 'info');
          return { ...small, completed: nextState };
        });
        
        return { ...medium, subtasks: updatedSmalls };
      });

      return calculateProgress({ ...large, subtasks: updatedSubtasks });
    }));
  };

  // アコーディオン展開トグル
  const toggleExpand = (id: string) => {
    setExpandedTasks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // AI流動的優先度スコア計算式
  // P = (想定所要時間 * (100 - 現在の達成度)) / (締切までの残り時間 + 1)
  const getPriorityScore = (task: LargeTask) => {
    const deadlineDate = new Date(task.deadline);
    const remainingMs = deadlineDate.getTime() - simulatedTime.getTime();
    const remainingHours = Math.max(0.1, remainingMs / (1000 * 60 * 60));
    
    const score = Math.round((task.estimatedMinutes * (100 - task.progressRate)) / (remainingHours + 1));
    return score;
  };

  // タスクのソート＆フィルタリング
  const getFilteredAndSortedTasks = () => {
    const filtered = tasks.filter(t => t.groupName === selectedGroup);
    if (!aiSortActive) return filtered;
    
    return [...filtered].sort((a, b) => {
      return getPriorityScore(b) - getPriorityScore(a);
    });
  };

  // スワイプによる削除
  const handleDeleteTask = (id: string, title: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    addToast(`『${title}』を削除しました`, 'warning');
    setGroupCounts(prev => ({
      ...prev,
      [selectedGroup]: Math.max(0, prev[selectedGroup] - 1)
    }));
  };

  // 1行入力送信 ➔ スライム風船ジャンプ
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    // 簡易的な自然言語処理による自動分類
    let targetGroup: '大学の講義 🌿' | 'サークル 📣' | 'プライベート ☕' = '大学の講義 🌿';
    let estimatedMinutes = 60;
    let daysToAdd = 1;

    const text = inputText.toLowerCase();
    if (text.includes('サークル') || text.includes('合宿') || text.includes('部活') || text.includes('チラシ')) {
      targetGroup = 'サークル 📣';
      estimatedMinutes = 120;
      daysToAdd = 3;
    } else if (text.includes('プライベート') || text.includes('カフェ') || text.includes('バイト') || text.includes('遊び') || text.includes('es') || text.includes('就活')) {
      targetGroup = 'プライベート ☕️';
      estimatedMinutes = 90;
      daysToAdd = 2;
    }

    // 要素の座標を取得してジャンプアニメーションを設定
    const inputEl = document.getElementById('slime-input-container');
    const badgeEl = document.getElementById(`badge-item-${targetGroup}`);

    const onComplete = () => {
      const newTask: LargeTask = {
        id: 'large-' + Math.random().toString(36).substr(2, 9),
        title: inputText,
        progressRate: 0,
        estimatedMinutes,
        deadline: new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString(),
        groupName: targetGroup,
        subtasks: [
          {
            id: 'medium-new-' + Math.random().toString(36).substr(2, 9),
            title: '初期ステップ',
            progressRate: 0,
            subtasks: [
              { id: 'small-new-1', title: '詳細タスクを計画する', completed: false }
            ]
          }
        ]
      };
      
      setTasks(prev => [...prev, calculateProgress(newTask)]);
      setInputText('');
      setGroupCounts(prev => ({ ...prev, [targetGroup]: prev[targetGroup] + 1 }));
      addToast(`新規タスク『${inputText}』を作成しました！`, 'success');
    };

    if (inputEl && badgeEl) {
      const inputRect = inputEl.getBoundingClientRect();
      const badgeRect = badgeEl.getBoundingClientRect();

      const startX = inputRect.left + inputRect.width / 2;
      const startY = inputRect.top;
      const endX = badgeRect.left + badgeRect.width / 2;
      const endY = badgeRect.top + badgeRect.height / 2;

      setSlimeAnim({
        active: true,
        text: inputText,
        targetGroup,
        startX,
        startY,
        endX,
        endY
      });

      // スライム衝突時の触覚フィードバック演出
      setTimeout(() => {
        const targetBadge = document.getElementById(`badge-item-${targetGroup}`);
        if (targetBadge) {
          targetBadge.classList.add('slime-bounce-active');
          setTimeout(() => targetBadge.classList.remove('slime-bounce-active'), 500);
        }
        onComplete();
        setSlimeAnim(null);
      }, 800);
    } else {
      onComplete();
    }
  };

  // チームルーム同期デモ (Websocket風モック)
  const triggerSyncDemo = () => {
    if (syncing) return;
    setSyncing(true);
    addToast('シェアルームの共同タスク同期中...', 'info');

    setTimeout(() => {
      // ゼミの共同タスクの「提案手法スライド執筆」を遠隔でチェックするシミュレーション
      setTasks(prev => prev.map(large => {
        if (large.id !== 'large-1') return large;

        const updatedSubtasks = large.subtasks.map(medium => {
          if (medium.id !== 'medium-1-2') return medium;

          const updatedSmalls = medium.subtasks.map(small => {
            if (small.id === 'small-1-2-2') {
              return { ...small, completed: true }; // 遠隔同期で完了へ
            }
            return small;
          });

          return { ...medium, subtasks: updatedSmalls };
        });

        return calculateProgress({ ...large, subtasks: updatedSubtasks });
      }));

      addToast('Bさんが『提案手法スライド執筆』を完了しました！', 'success');
      setSyncing(false);
    }, 2000);
  };

  // --- カレンダービュー用データ構築 ---
  const getDaysInMonth = () => {
    // 2026年7月のカレンダーグリッド
    const year = 2026;
    const month = 6; // 7月 (0-indexed)
    const date = new Date(year, month, 1);
    const days: (number | null)[] = [];
    
    // 最初の日の曜日分空欄を埋める (1日は水曜日 ➔ 3つ空ける)
    const startDay = date.getDay();
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    while (date.getMonth() === month) {
      days.push(date.getDate());
      date.setDate(date.getDate() + 1);
    }

    return days;
  };

  const calendarDays = getDaysInMonth();
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  // カレンダー日付セルのタスク有無検知
  const getTasksForDay = (day: number) => {
    return tasks.filter(t => {
      const d = new Date(t.deadline);
      return d.getDate() === day && d.getMonth() === 6 && d.getFullYear() === 2026;
    });
  };

  return (
    <div className="min-height-screen bg-[#FDFBF7] text-[#3E3A35] font-sans pb-32 flex flex-col items-center">
      {/* --- ヘッダー --- */}
      <header className="w-full max-w-4xl px-6 py-6 flex justify-between items-center border-b border-[#EAE3D8]">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2 text-[#3E3A35]">
            Tasknow <span className="text-xs bg-[#B5C7A3] text-[#3E3A35] px-2 py-0.5 rounded-full font-bold">EVOLUTION</span>
          </h1>
          <p className="text-xs text-[#8A7E72] mt-1">Cozy & Minimalist Collective Workspace</p>
        </div>

        {/* シェアルームインジケーター ＆ 同期デモボタン */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#FFFFFF] border border-[#EAE3D8] px-4 py-2 rounded-full text-xs font-semibold shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B5C7A3] animate-pulse"></span>
            <span>経済学共同課題 👥</span>
          </div>

          <button
            onClick={triggerSyncDemo}
            disabled={syncing}
            className="flex items-center gap-1.5 bg-[#F3EDE2] hover:bg-[#EAE3D8] active:scale-95 transition-all text-xs font-bold px-4 py-2 rounded-full border border-[#EAE3D8]"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            遠隔同期デモ
          </button>
        </div>
      </header>

      {/* --- メインコンテンツ --- */}
      <main className="w-full max-w-2xl px-6 mt-6 flex-1 flex flex-col">
        {/* リスト・カレンダー切り替え & AIソートトグル */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex bg-[#F3EDE2] p-1 rounded-xl border border-[#EAE3D8]">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'list' ? 'bg-[#FFFFFF] text-[#3E3A35] shadow-sm' : 'text-[#8A7E72]'
              }`}
            >
              <List size={14} />
              リスト表示
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'calendar' ? 'bg-[#FFFFFF] text-[#3E3A35] shadow-sm' : 'text-[#8A7E72]'
              }`}
            >
              <CalendarIcon size={14} />
              カレンダー表示
            </button>
          </div>

          {/* AIソートトグルボタン */}
          {activeTab === 'list' && (
            <button
              onClick={() => {
                setAiSortActive(!aiSortActive);
                addToast(`AI動的ソートを${!aiSortActive ? 'ON' : 'OFF'}にしました`, 'info');
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                aiSortActive 
                  ? 'bg-[#B5C7A3] border-[#B5C7A3] text-[#3E3A35]' 
                  : 'bg-[#FFFFFF] border-[#EAE3D8] text-[#8A7E72]'
              }`}
            >
              <Zap size={14} />
              AI優先度ソート: {aiSortActive ? 'ON' : 'OFF'}
            </button>
          )}
        </div>

        {/* --- グループフォルダ・カプセルバッジ (アタッチメント先) --- */}
        <div className="flex justify-center gap-4 mb-6">
          {(['大学の講義 🌿', 'サークル 📣', 'プライベート ☕️'] as const).map(group => {
            const isActive = selectedGroup === group;
            return (
              <button
                key={group}
                id={`badge-item-${group}`}
                onClick={() => setSelectedGroup(group)}
                className={`relative flex items-center gap-2 border px-5 py-2.5 rounded-full text-sm transition-all duration-300 ${
                  isActive 
                    ? 'bg-[#B5C7A3] border-[#B5C7A3] text-[#3E3A35] font-extrabold shadow-sm scale-105' 
                    : 'bg-[#FFFFFF] border-[#EAE3D8] text-[#8A7E72] hover:bg-[#FDFBF7]'
                }`}
                style={{
                  transformOrigin: 'center'
                }}
              >
                <span>{group}</span>
                <span className="text-[10px] bg-[#3E3A35] text-[#FFFFFF] px-2 py-0.5 rounded-full">
                  {groupCounts[group]}
                </span>
              </button>
            );
          })}
        </div>

        {/* --- ビュー切替表示エリア --- */}
        <div className="flex-1">
          {activeTab === 'list' ? (
            /* --- リストビュー (タイムライン形式) --- */
            <div className="flex flex-col gap-4">
              <AnimatePresence initial={false}>
                {getFilteredAndSortedTasks().length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-12 text-center text-[#8A7E72] bg-[#FFFFFF] border border-[#EAE3D8] rounded-3xl"
                  >
                    このフォルダのタスクはすべて完了しました 🎉
                  </motion.div>
                ) : (
                  getFilteredAndSortedTasks().map(largeTask => {
                    const expanded = !!expandedTasks[largeTask.id];
                    return (
                      <div key={largeTask.id} className="relative overflow-hidden rounded-3xl">
                        {/* 左スワイプ削除のインジケータ背景 */}
                        <div className="absolute inset-0 bg-[#E6A79A] flex justify-end items-center pr-6 rounded-3xl pointer-events-none">
                          <span className="text-[#3E3A35] font-bold text-xs flex items-center gap-1">
                            <Trash2 size={14} /> 左スワイプで削除
                          </span>
                        </div>

                        {/* タスクカード本体 */}
                        <motion.div
                          drag="x"
                          dragConstraints={{ right: 0, left: -140 }}
                          onDragEnd={(_, info) => {
                            if (info.offset.x < -100) {
                              handleDeleteTask(largeTask.id, largeTask.title);
                            }
                          }}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          whileDrag={{ scale: 1.02, boxShadow: '0px 10px 25px rgba(62, 58, 53, 0.1)' }}
                          className="relative bg-[#FFFFFF] border border-[#EAE3D8] rounded-3xl p-5 flex flex-col gap-4 cursor-pointer select-none"
                        >
                          {/* 大タスク・ヘッダー部分 */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1" onClick={() => toggleExpand(largeTask.id)}>
                              <div className="text-[#8A7E72]">
                                {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                              </div>

                              <div className="flex flex-col">
                                <span className="font-extrabold text-[#3E3A35] text-base">{largeTask.title}</span>
                                <div className="flex items-center gap-3 text-[10px] text-[#8A7E72] mt-1.5">
                                  <span className="flex items-center gap-0.5"><Clock size={11} />想定: {largeTask.estimatedMinutes}分</span>
                                  <span className="flex items-center gap-0.5">
                                    <DateIcon size={11} />
                                    締切: {new Date(largeTask.deadline).toLocaleDateString()} {new Date(largeTask.deadline).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* 進捗円形バー ＆ AIソートスコア */}
                            <div className="flex items-center gap-3">
                              {aiSortActive && (
                                <div className="bg-[#F3EDE2] text-[#3E3A35] border border-[#EAE3D8] text-[10px] font-extrabold px-2 py-1 rounded-md">
                                  AI優先度: {getPriorityScore(largeTask)}
                                </div>
                              )}
                              <div className="relative w-12 h-12 flex items-center justify-center">
                                {/* SVGサークルプログレス */}
                                <svg className="w-12 h-12 transform -rotate-90">
                                  <circle cx="24" cy="24" r="18" stroke="#F3EDE2" strokeWidth="3" fill="transparent" />
                                  <circle 
                                    cx="24" 
                                    cy="24" 
                                    r="18" 
                                    stroke="#B5C7A3" 
                                    strokeWidth="3.5" 
                                    fill="transparent" 
                                    strokeDasharray={2 * Math.PI * 18}
                                    strokeDashoffset={2 * Math.PI * 18 * (1 - largeTask.progressRate / 100)}
                                    className="transition-all duration-500 ease-out"
                                  />
                                </svg>
                                <span className="absolute text-[10px] font-bold text-[#3E3A35]">{largeTask.progressRate}%</span>
                              </div>
                            </div>
                          </div>

                          {/* 3階層子タスクエリア (中タスク・小タスク) */}
                          <AnimatePresence initial={false}>
                            {expanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                className="overflow-hidden border-t border-[#F3EDE2] pt-4 flex flex-col gap-4"
                              >
                                {largeTask.subtasks.map(mediumTask => (
                                  <div key={mediumTask.id} className="bg-[#FDFBF7] p-4 rounded-2xl border border-[#EAE3D8] flex flex-col gap-3">
                                    {/* 中タスク項目ヘッダー */}
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs font-bold text-[#3E3A35]">【中】{mediumTask.title}</span>
                                      <span className="text-[10px] bg-[#EAE3D8] px-2 py-0.5 rounded-full font-bold">
                                        進捗: {mediumTask.progressRate}%
                                      </span>
                                    </div>

                                    {/* 中タスク専用の細身プログレスバー */}
                                    <div className="w-full bg-[#F3EDE2] h-1 rounded-full overflow-hidden">
                                      <div 
                                        className="bg-[#B5C7A3] h-full transition-all duration-500 ease-out" 
                                        style={{ width: `${mediumTask.progressRate}%` }}
                                      />
                                    </div>

                                    {/* 小タスク項目リスト */}
                                    <div className="flex flex-col gap-2 pl-2">
                                      {mediumTask.subtasks.map(smallTask => (
                                        <label 
                                          key={smallTask.id} 
                                          className="flex items-center gap-2.5 text-xs text-[#8A7E72] hover:text-[#3E3A35] transition-colors cursor-pointer"
                                        >
                                          <input 
                                            type="checkbox"
                                            checked={smallTask.completed}
                                            onChange={() => handleSmallTaskToggle(largeTask.id, mediumTask.id, smallTask.id)}
                                            className="w-4 h-4 cursor-pointer accent-[#B5C7A3]"
                                          />
                                          <span className={smallTask.completed ? 'line-through opacity-60' : ''}>
                                            {smallTask.title}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      </div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          ) : (
            /* --- カレンダービュー --- */
            <div className="bg-[#FFFFFF] border border-[#EAE3D8] rounded-3xl p-5 shadow-sm">
              <div className="text-center font-bold text-sm mb-4">2026年 7月</div>
              <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-[#8A7E72]">
                {weekDays.map(d => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-2 text-center text-xs">
                {calendarDays.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="p-2"></div>;
                  }
                  
                  const dueTasks = getTasksForDay(day);
                  return (
                    <div 
                      key={`day-${day}`} 
                      className="p-2 border border-[#F3EDE2] rounded-xl hover:bg-[#FDFBF7] cursor-pointer flex flex-col items-center justify-between min-h-[50px]"
                      onClick={() => {
                        if (dueTasks.length > 0) {
                          addToast(`${day}日の締切タスク: 『${dueTasks.map(t => t.title).join('』、『')}』`, 'info');
                        } else {
                          addToast(`${day}日に締め切り設定されているタスクはありません`, 'info');
                        }
                      }}
                    >
                      <span className="font-semibold">{day}</span>
                      {/* ドットの配置 */}
                      <div className="flex gap-0.5 justify-center mt-1">
                        {dueTasks.map(t => {
                          const dotColor = 
                            t.groupName === '大学の講義 🌿' ? 'bg-[#B5C7A3]' :
                            t.groupName === 'サークル 📣' ? 'bg-[#E6A79A]' : 'bg-[#EED09D]';
                          return (
                            <span 
                              key={t.id} 
                              className={`w-1.5 h-1.5 rounded-full ${dotColor}`}
                              title={t.title}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- 固定最下部入力バー (Gemini集中型) --- */}
      <div 
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '680px',
          padding: '16px 24px 24px',
          background: 'linear-gradient(0deg, #FDFBF7 70%, transparent 100%)',
          zIndex: 100,
          pointerEvents: 'none'
        }}
      >
        <form 
          onSubmit={handleFormSubmit}
          id="slime-input-container"
          className="flex items-center bg-[#F3EDE2] border border-[#EAE3D8] rounded-full px-5 py-2.5 shadow-md pointer-events-auto w-full transition-all duration-300 hover:shadow-lg"
        >
          <input 
            type="text"
            placeholder={`${selectedGroup.slice(0, -2)}に関するタスクを入力... (送信でスライム大ジャンプ！)`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 border-none bg-transparent outline-none text-sm text-[#3E3A35] placeholder-[#8A7E72] py-2"
          />
          <button
            type="submit"
            className="bg-[#B5C7A3] border-none text-[#3E3A35] w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
            title="送信して自動振り分け"
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      {/* --- 放物線フワフワスライムアニメーションレイヤー --- */}
      {slimeAnim && (
        <motion.div
          initial={{ 
            left: slimeAnim.startX, 
            top: slimeAnim.startY, 
            x: '-50%', 
            y: '-50%',
            scaleX: 1, 
            scaleY: 1, 
            opacity: 1 
          }}
          animate={{
            left: [slimeAnim.startX, (slimeAnim.startX + slimeAnim.endX) / 2, slimeAnim.endX],
            top: [slimeAnim.startY, Math.min(slimeAnim.startY, slimeAnim.endY) - 180, slimeAnim.endY],
            // 飛行中フワフワ揺れる/縦伸び/衝突時に横に潰れる
            scaleX: [1, 0.6, 1.4, 0.4, 1],
            scaleY: [1, 1.8, 0.7, 1.6, 1],
            opacity: [1, 1, 1, 0.9, 0],
            // ユラユラ揺れる風船モーション
            rotate: [0, -8, 8, -4, 0]
          }}
          transition={{
            duration: 0.8,
            ease: [0.25, 0.8, 0.25, 1],
            times: [0, 0.35, 0.7, 0.9, 1]
          }}
          className="fixed z-[9999] bg-[#B5C7A3] border-2 border-[#FFFFFF] text-[#3E3A35] px-4 py-2 rounded-2xl text-xs font-extrabold shadow-md white-space-nowrap pointer-events-none flex items-center gap-1.5"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFFFFF] opacity-80 animate-ping"></span>
          {slimeAnim.text}
        </motion.div>
      )}

      {/* --- トースト通知オーバーレイ --- */}
      <div className="fixed bottom-28 right-6 flex flex-col gap-2.5 z-[1000]">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 15, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`p-4 rounded-2xl shadow-lg border border-[#EAE3D8] text-xs font-bold flex items-center gap-2.5 min-w-[280px] max-w-sm ${
                t.type === 'success' ? 'bg-[#B5C7A3] text-[#3E3A35]' :
                t.type === 'warning' ? 'bg-[#E6A79A] text-[#3E3A35]' : 'bg-[#FFFFFF] text-[#3E3A35]'
              }`}
            >
              <Bell size={14} />
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* --- アニメーションCSSの定義 --- */}
      <style>{`
        @keyframes bounce-animation {
          0% { transform: scale(1); }
          20% { transform: scale(1.25) rotate(-3deg); }
          45% { transform: scale(0.9) rotate(3deg); }
          70% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        .slime-bounce-active {
          animation: bounce-animation 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
      `}</style>
    </div>
  );
};

export default TasknowEvolution;
