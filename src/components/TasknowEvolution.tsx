import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trash2, 
  Calendar as CalendarIcon, 
  List, 
  Zap, 
  Send, 
  ChevronDown, 
  ChevronRight, 
  Clock, 
  Calendar as DateIcon,
  RefreshCw,
  Bell,
  Plus,
  FolderPlus,
  Users
} from 'lucide-react';

// --- インターフェース定義 (正規化データモデル型) ---
export interface Task {
  id: string;
  roomId: string;      // 所属するシェアルームのID
  groupId: string;     // 所属するグループ(リスト)のID
  title: string;
  type: 'LARGE' | 'MEDIUM' | 'SMALL'; // 大（Goal）/ 中（Milestone）/ 小（To-Do）
  isCompleted: boolean;
  status: 'active' | 'pending_deletion'; // 30秒消滅タイマー用ステータス
  deletionTimerId: number | null;        // クリーンアップタイマーのID
  deadline: string;    // YYYY-MM-DD 形式 (入力必須)
  parentId: string | null;  // 親タスクのID
  childIds: string[];       // 傘下に付随する子タスクのID配列
}

export interface Group {
  id: string;
  roomId: string;
  name: string;
  emoji: string;
}

export interface ShareRoom {
  id: string;
  name: string;
  members: string[]; // 参加ユーザー名(アバター用)の配列
}

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning';
}

// --- カスタムチェックボックスコンポーネント (丸型 & セージグリーン) ---
const TaskCheckbox: React.FC<{
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}> = ({ checked, onChange, disabled = false }) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange();
      }}
      disabled={disabled}
      className={`w-5 h-5 rounded-full border flex items-center justify-center cursor-pointer transition-all duration-300 ${
        checked 
          ? 'bg-[#B5C7A3] border-[#B5C7A3] text-[#3E3A35]' 
          : 'bg-transparent border-[#EAE3D8] hover:border-[#B5C7A3]'
      } ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      {checked && (
        <svg className="w-3.5 h-3.5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
};

export const TasknowEvolution: React.FC = () => {
  // --- 状態管理 (本番を見据えたフラット正規化ステート、初期状態は完全に空) ---
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [rooms, setRooms] = useState<ShareRoom[]>([]);
  
  const [activeRoomId, setActiveRoomId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');
  const [aiSortActive, setAiSortActive] = useState(false);
  const [simulatedTime] = useState<Date>(new Date());
  
  // ボトムインプット状態
  const [inputText, setInputText] = useState('');
  const [taskDeadline, setTaskDeadline] = useState<string>('');

  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  // 各種表示フラグ
  const [showAddGroupInput, setShowAddGroupInput] = useState(false);
  const [newGroupNameInput, setNewGroupNameInput] = useState('');
  
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [newRoomNameInput, setNewRoomNameInput] = useState('');

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteNameInput, setInviteNameInput] = useState('');

  const [showTemplatePopup, setShowTemplatePopup] = useState(false);

  // 2段階削除確認用のアクティブターゲット
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'group' | 'room';
    id: string; // 対象の識別子
    name: string; // 表示用の名前
  } | null>(null);

  // インラインの中・小タスク追加用テキスト入力バッファ
  const [newMediumInputs, setNewMediumInputs] = useState<Record<string, string>>({});
  const [newSmallInputs, setNewSmallInputs] = useState<Record<string, string>>({});

  // スライムアニメーション用
  const [slimeAnim, setSlimeAnim] = useState<{
    active: boolean;
    text: string;
    targetGroupId: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

  // トーストメッセージキュー
  const [toasts, setToasts] = useState<Toast[]>([]);

  // 同期シミュレーション状態
  const [syncing, setSyncing] = useState(false);

  // --- ヘルパー関数: 進捗率（%）の動的計算 ---
  const getTaskProgressRate = (taskId: string, currentTasks: Record<string, Task> = tasks): number => {
    const task = currentTasks[taskId];
    if (!task) return 0;
    if (task.type === 'SMALL') {
      return task.isCompleted ? 100 : 0;
    }
    
    const children = task.childIds.map(id => currentTasks[id]).filter(Boolean);
    if (children.length === 0) {
      return task.isCompleted ? 100 : 0;
    }
    
    if (task.type === 'MEDIUM') {
      const completedCount = children.filter(c => c.isCompleted).length;
      return Math.round((completedCount / children.length) * 100);
    }
    
    // LARGE: 平均の進捗率を計算
    const totalProgress = children.reduce((sum, child) => sum + getTaskProgressRate(child.id, currentTasks), 0);
    return Math.round(totalProgress / children.length);
  };

  // --- ヘルパー関数: 親ノードへの完了状態の伝播（Bottom-up） ---
  const propagateCompletionUpward = (taskId: string, allTasks: Record<string, Task>): Record<string, Task> => {
    const updated = { ...allTasks };
    
    const updateParent = (id: string | null) => {
      if (!id || !updated[id]) return;
      const parent = updated[id];
      const children = parent.childIds.map(cid => updated[cid]).filter(Boolean);
      
      if (children.length > 0) {
        if (parent.type === 'MEDIUM') {
          // すべての子ノードが完了していたら完了
          parent.isCompleted = children.every(c => c.isCompleted);
        } else if (parent.type === 'LARGE') {
          // 進捗率が100%なら完了
          const progress = getTaskProgressRate(parent.id, updated);
          parent.isCompleted = progress === 100;
        }
      }
      updateParent(parent.parentId);
    };
    
    const current = updated[taskId];
    if (current) {
      updateParent(current.parentId);
    }
    return updated;
  };

  // --- ヘルパー関数: 再帰的なノードの削除処理 ---
  const deleteRecursive = (taskId: string, allTasks: Record<string, Task>): Record<string, Task> => {
    let next = { ...allTasks };
    const task = next[taskId];
    if (!task) return next;
    
    // 全ての子ノードを再帰的に削除
    task.childIds.forEach(cid => {
      next = deleteRecursive(cid, next);
    });
    
    // アクティブなタイマーをキャンセル
    if (task.deletionTimerId) {
      window.clearTimeout(task.deletionTimerId);
    }
    
    // 親ノードの childIds 配列から自分を取り除く
    if (task.parentId && next[task.parentId]) {
      const parent = next[task.parentId];
      next[task.parentId] = {
        ...parent,
        childIds: parent.childIds.filter(id => id !== taskId)
      };
      // 子が減ったため、親の完了フラグを再計算
      next = propagateCompletionUpward(parent.id, next);
    }
    
    delete next[taskId];
    return next;
  };

  // --- 完了から30秒後の自動消滅タイマー監視ロジック ---
  useEffect(() => {
    // 状態を安全に監視して、Timeout をトリガー・キャンセルするFSM
    Object.values(tasks).forEach(task => {
      if (task.isCompleted && task.status === 'active') {
        // 新規完了タスク：タイマーを開始し、状態を pending_deletion に移行
        const timerId = window.setTimeout(() => {
          setTasks(current => {
            const next = { ...current };
            return deleteRecursive(task.id, next);
          });
          addToast('完了した項目が自動消滅しました 🧹', 'info');
        }, 30000); // 30秒後

        setTasks(current => {
          if (!current[task.id]) return current;
          return {
            ...current,
            [task.id]: {
              ...current[task.id],
              status: 'pending_deletion',
              deletionTimerId: timerId as any // number型キャスト
            }
          };
        });
      } else if (!task.isCompleted && task.status === 'pending_deletion') {
        // 未完了に戻されたタスク：タイマーをキャンセルし、active に戻す
        if (task.deletionTimerId) {
          window.clearTimeout(task.deletionTimerId);
        }
        setTasks(current => {
          if (!current[task.id]) return current;
          return {
            ...current,
            [task.id]: {
              ...current[task.id],
              status: 'active',
              deletionTimerId: null
            }
          };
        });
      }
    });

    return () => {
      // クリーンアップ
    };
  }, [tasks]);

  // トースト通知追加
  const addToast = (message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  // 小タスク完了トグル
  const handleSmallTaskToggle = (smallId: string) => {
    setTasks(prev => {
      const small = prev[smallId];
      if (!small) return prev;
      
      const nextCompleted = !small.isCompleted;
      let next = {
        ...prev,
        [smallId]: {
          ...small,
          isCompleted: nextCompleted
        }
      };
      
      next = propagateCompletionUpward(smallId, next);
      addToast(`『${small.title}』を${nextCompleted ? '完了（30秒後に消滅）' : '未完了'}にしました`, 'info');
      return next;
    });
  };

  // 中タスク（サブタスクを持たない場合のみインタラクティブ）の完了トグル
  const handleMediumTaskToggle = (mediumId: string) => {
    setTasks(prev => {
      const medium = prev[mediumId];
      if (!medium || medium.childIds.length > 0) return prev;
      
      const nextCompleted = !medium.isCompleted;
      let next = {
        ...prev,
        [mediumId]: {
          ...medium,
          isCompleted: nextCompleted
        }
      };
      
      next = propagateCompletionUpward(mediumId, next);
      addToast(`ステップ『${medium.title}』を${nextCompleted ? '完了（30秒後に消滅）' : '未完了'}にしました`, 'info');
      return next;
    });
  };

  // 大タスク（サブタスクを持たない場合のみインタラクティブ）の完了トグル
  const handleLargeTaskToggle = (largeId: string) => {
    setTasks(prev => {
      const large = prev[largeId];
      if (!large || large.childIds.length > 0) return prev;
      
      const nextCompleted = !large.isCompleted;
      let next = {
        ...prev,
        [largeId]: {
          ...large,
          isCompleted: nextCompleted
        }
      };
      
      next = propagateCompletionUpward(largeId, next);
      addToast(`タスク『${large.title}』を${nextCompleted ? '完了（30秒後に消滅）' : '未完了'}にしました`, 'info');
      return next;
    });
  };

  // アコーディオン展開トグル
  const toggleExpand = (id: string) => {
    setExpandedTasks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 優先順スコア計算
  const getPriorityScore = (task: Task) => {
    const deadlineStr = task.deadline || new Date().toISOString();
    const deadlineDate = new Date(deadlineStr);
    const remainingMs = deadlineDate.getTime() - simulatedTime.getTime();
    const remainingHours = Math.max(0.1, remainingMs / (1000 * 60 * 60));
    
    const estimated = 60; // 想定時間デフォルト60分
    const progress = getTaskProgressRate(task.id, tasks);
    const score = Math.round((estimated * (100 - progress)) / (remainingHours + 1));
    return score;
  };

  // 現在のルームのアクティブグループ一覧
  const activeGroups = groups.filter(g => g.roomId === activeRoomId);

  // 現在のルームと選択グループに適合するタスクの優先順ソート＆フィルタリング
  const getFilteredAndSortedTasks = () => {
    const filtered = Object.values(tasks).filter(
      t => t.roomId === activeRoomId && t.groupId === selectedGroupId && t.type === 'LARGE'
    );
    if (!aiSortActive) return filtered;
    
    return [...filtered].sort((a, b) => {
      return getPriorityScore(b) - getPriorityScore(a);
    });
  };

  // グループ別タスク件数の集計 (LARGE タスク件数)
  const getGroupTaskCount = (groupId: string) => {
    return Object.values(tasks).filter(
      t => t.roomId === activeRoomId && t.groupId === groupId && t.type === 'LARGE'
    ).length;
  };

  // スワイプによる削除
  const handleDeleteTask = (id: string, title: string) => {
    setTasks(prev => {
      let next = { ...prev };
      next = deleteRecursive(id, next);
      return next;
    });
    addToast(`『${title}』を削除しました`, 'warning');
  };

  // --- 動的な中・小タスクインライン追加 ---
  const handleAddMediumTask = (largeId: string, e: React.FormEvent) => {
    e.preventDefault();
    const inputTitle = newMediumInputs[largeId];
    if (!inputTitle || !inputTitle.trim()) return;

    const newMediumId = 'medium-' + Math.random().toString(36).substr(2, 9);
    
    setTasks(prev => {
      const parent = prev[largeId];
      if (!parent) return prev;

      const newMedium: Task = {
        id: newMediumId,
        roomId: parent.roomId,
        groupId: parent.groupId,
        title: inputTitle.trim(),
        type: 'MEDIUM',
        isCompleted: false,
        status: 'active',
        deletionTimerId: null,
        deadline: '',
        parentId: largeId,
        childIds: []
      };

      let next = {
        ...prev,
        [newMediumId]: newMedium,
        [largeId]: {
          ...parent,
          isCompleted: false, // 子ノード追加に伴い未完了へリセット
          childIds: [...parent.childIds, newMediumId]
        }
      };

      next = propagateCompletionUpward(largeId, next);
      return next;
    });

    setNewMediumInputs(prev => ({ ...prev, [largeId]: '' }));
    addToast(`ステップ『${inputTitle}』を追加しました`, 'success');
  };

  const handleAddSmallTask = (mediumId: string, e: React.FormEvent) => {
    e.preventDefault();
    const inputTitle = newSmallInputs[mediumId];
    if (!inputTitle || !inputTitle.trim()) return;

    const newSmallId = 'small-' + Math.random().toString(36).substr(2, 9);

    setTasks(prev => {
      const medium = prev[mediumId];
      if (!medium) return prev;

      const newSmall: Task = {
        id: newSmallId,
        roomId: medium.roomId,
        groupId: medium.groupId,
        title: inputTitle.trim(),
        type: 'SMALL',
        isCompleted: false,
        status: 'active',
        deletionTimerId: null,
        deadline: '',
        parentId: mediumId,
        childIds: []
      };

      let next = {
        ...prev,
        [newSmallId]: newSmall,
        [mediumId]: {
          ...medium,
          isCompleted: false, // 子ノード追加に伴い未完了へリセット
          childIds: [...medium.childIds, newSmallId]
        }
      };

      next = propagateCompletionUpward(mediumId, next);
      return next;
    });

    setNewSmallInputs(prev => ({ ...prev, [mediumId]: '' }));
    addToast(`作業項目『${inputTitle}』を追加しました`, 'success');
  };

  // --- 絵文字自動判別ヘルパー ---
  const parseGroupNameAndEmoji = (input: string): { name: string; emoji: string } => {
    const emojiRegex = /[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g;
    const match = input.match(emojiRegex);
    const emoji = match ? match[0] : '📁';
    const name = input.replace(emojiRegex, '').trim();
    return { name, emoji };
  };

  // --- 動的グループの追加・確認付き削除 ---
  const handleAddGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupNameInput.trim() || !activeRoomId) return;

    const formattedInput = newGroupNameInput.trim();
    const { name, emoji } = parseGroupNameAndEmoji(formattedInput);

    const isDuplicate = activeGroups.some(g => g.name.toLowerCase() === name.toLowerCase());
    if (isDuplicate) {
      addToast('同名のグループがすでに存在します。', 'warning');
      return;
    }

    const newGroup: Group = {
      id: 'group-' + Math.random().toString(36).substr(2, 9),
      roomId: activeRoomId,
      name,
      emoji
    };

    setGroups(prev => [...prev, newGroup]);
    setSelectedGroupId(newGroup.id);
    setNewGroupNameInput('');
    setShowAddGroupInput(false);
    addToast(`グループ『${newGroup.emoji} ${newGroup.name}』を作成しました！`, 'success');
  };

  const handleGroupDeleteClick = (group: Group, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget({ type: 'group', id: group.id, name: `${group.emoji} ${group.name}` });
  };

  const executeDeleteGroup = (groupIdToDelete: string) => {
    const targetGroup = groups.find(g => g.id === groupIdToDelete);
    if (!targetGroup) return;

    setGroups(prev => prev.filter(g => g.id !== groupIdToDelete));

    // 紐づくタスクをすべて削除
    setTasks(prev => {
      let next = { ...prev };
      Object.keys(prev).forEach(id => {
        if (prev[id].groupId === groupIdToDelete) {
          if (prev[id].deletionTimerId) {
            window.clearTimeout(prev[id].deletionTimerId);
          }
          delete next[id];
        }
      });
      return next;
    });

    if (selectedGroupId === groupIdToDelete) {
      const remaining = groups.filter(g => g.id !== groupIdToDelete && g.roomId === activeRoomId);
      setSelectedGroupId(remaining.length > 0 ? remaining[0].id : '');
    }
    addToast(`グループ『${targetGroup.emoji} ${targetGroup.name}』と紐づくタスクを削除しました`, 'warning');
  };

  // --- 動的シェアルームの追加・確認付き削除 ---
  const handleCreateRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomNameInput.trim()) return;

    const newId = 'room-' + Math.random().toString(36).substr(2, 9);
    const newRoom: ShareRoom = {
      id: newId,
      name: newRoomNameInput.trim() + ' 👥',
      members: ['自分 🙋‍♂️']
    };

    setRooms(prev => [...prev, newRoom]);
    setActiveRoomId(newId);
    setSelectedGroupId('');
    setNewRoomNameInput('');
    setShowCreateRoomModal(false);
    addToast(`シェアルーム『${newRoom.name}』を作成しました！`, 'success');
  };

  const handleRoomDeleteClick = (room: ShareRoom, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget({ type: 'room', id: room.id, name: room.name });
  };

  const executeDeleteRoom = (roomIdToDelete: string) => {
    setRooms(prev => prev.filter(r => r.id !== roomIdToDelete));
    
    // ルーム配下のグループを削除
    setGroups(prev => prev.filter(g => g.roomId !== roomIdToDelete));
    
    // ルーム配下のタスクを削除
    setTasks(prev => {
      let next = { ...prev };
      Object.keys(prev).forEach(id => {
        if (prev[id].roomId === roomIdToDelete) {
          if (prev[id].deletionTimerId) {
            window.clearTimeout(prev[id].deletionTimerId);
          }
          delete next[id];
        }
      });
      return next;
    });

    if (activeRoomId === roomIdToDelete) {
      const remaining = rooms.filter(r => r.id !== roomIdToDelete);
      if (remaining.length > 0) {
        setActiveRoomId(remaining[0].id);
        const nextGroups = groups.filter(g => g.roomId === remaining[0].id);
        setSelectedGroupId(nextGroups.length > 0 ? nextGroups[0].id : '');
      } else {
        setActiveRoomId('');
        setSelectedGroupId('');
      }
    }
    addToast(`ルームを削除しました`, 'warning');
  };

  // --- メンバー招待 ---
  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteNameInput.trim() || !activeRoomId) return;

    const newMember = inviteNameInput.trim();
    setRooms(prev => prev.map(r => {
      if (r.id !== activeRoomId) return r;
      return {
        ...r,
        members: [...r.members, newMember]
      };
    }));

    addToast(`『${newMember}』を招待しました！`, 'success');
    setInviteNameInput('');
    setShowInviteModal(false);
  };

  // --- よく使うタスクの「テンプレート（定型文）」機能 ---
  const handleApplyTemplate = (type: 'report' | 'test' | 'shift') => {
    if (!taskDeadline) {
      addToast('締切日を設定してください 📅', 'warning');
      return;
    }
    if (!selectedGroupId || !activeRoomId) {
      addToast('ルームとグループを先に作成してください', 'warning');
      return;
    }

    let largeTitle = '';
    let subMediumTitles: string[] = [];

    if (type === 'report') {
      largeTitle = 'レポート提出 📝';
      subMediumTitles = ['参考文献集め 📚', '構成案作成 🗒️', '執筆 ✍️'];
    } else if (type === 'test') {
      largeTitle = 'テスト対策 ✍️';
      subMediumTitles = ['過去問を解く 📐', 'ノートの復習 ✏️'];
    } else {
      largeTitle = 'バイト出勤 💰';
    }

    const newLargeId = 'large-' + Math.random().toString(36).substr(2, 9);

    const onComplete = () => {
      setTasks(prev => {
        let next = { ...prev };

        const newLarge: Task = {
          id: newLargeId,
          roomId: activeRoomId,
          groupId: selectedGroupId,
          title: largeTitle,
          type: 'LARGE',
          isCompleted: false,
          status: 'active',
          deletionTimerId: null,
          deadline: taskDeadline,
          parentId: null,
          childIds: []
        };

        next[newLargeId] = newLarge;

        const childIds: string[] = [];
        subMediumTitles.forEach(mTitle => {
          const mId = 'medium-' + Math.random().toString(36).substr(2, 9);
          const newMedium: Task = {
            id: mId,
            roomId: activeRoomId,
            groupId: selectedGroupId,
            title: mTitle,
            type: 'MEDIUM',
            isCompleted: false,
            status: 'active',
            deletionTimerId: null,
            deadline: '',
            parentId: newLargeId,
            childIds: []
          };
          next[mId] = newMedium;
          childIds.push(mId);
        });

        next[newLargeId].childIds = childIds;
        next = propagateCompletionUpward(newLargeId, next);
        return next;
      });

      setExpandedTasks(prev => ({ ...prev, [newLargeId]: true }));
      addToast(`テンプレート『${largeTitle}』を展開しました！`, 'success');
    };

    const inputEl = document.getElementById('slime-input-container');
    const badgeEl = document.getElementById(`badge-item-${selectedGroupId}`);

    if (inputEl && badgeEl) {
      const inputRect = inputEl.getBoundingClientRect();
      const badgeRect = badgeEl.getBoundingClientRect();

      const startX = inputRect.left + inputRect.width / 2;
      const startY = inputRect.top;
      const endX = badgeRect.left + badgeRect.width / 2;
      const endY = badgeRect.top + badgeRect.height / 2;

      setSlimeAnim({
        active: true,
        text: largeTitle,
        targetGroupId: selectedGroupId,
        startX,
        startY,
        endX,
        endY
      });

      setTimeout(() => {
        const targetBadge = document.getElementById(`badge-item-${selectedGroupId}`);
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

    setShowTemplatePopup(false);
  };

  // --- 1行入力送信 ➔ 放物線スライムジャンプ（簡易パース機能統合） ---
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    // 締切必須バリデーション
    if (!taskDeadline) {
      addToast('締切日を設定してください 📅', 'warning');
      return;
    }

    if (!selectedGroupId || !activeRoomId) {
      addToast('ルームとグループを先に作成してください', 'warning');
      return;
    }

    // 記号を使った「1行クイック階層入力」ショートカットのパース
    const cleanInput = inputText.trim();
    const segments = cleanInput.split('>').map(s => s.trim()).filter(Boolean);

    const largeTitle = segments[0] || '';
    const mediumTitle = segments[1] || '';
    const smallTitle = segments[2] || '';

    if (!largeTitle) return;

    let targetGroupId = selectedGroupId;

    // 自動分類ロジック
    const cleanText = largeTitle.toLowerCase();
    const matchedGroup = activeGroups.find(g => {
      const cleanGName = g.name.toLowerCase();
      return cleanGName && cleanText.includes(cleanGName);
    });

    if (matchedGroup) {
      targetGroupId = matchedGroup.id;
    } else {
      if (cleanText.includes('レポート') || cleanText.includes('講義') || cleanText.includes('テスト') || cleanText.includes('宿題') || cleanText.includes('ゼミ') || cleanText.includes('発表')) {
        const found = activeGroups.find(g => g.name.includes('講義') || g.name.includes('授業') || g.name.includes('テスト'));
        if (found) targetGroupId = found.id;
      } else if (cleanText.includes('ミーティング') || cleanText.includes('新歓') || cleanText.includes('イベント') || cleanText.includes('合宿') || cleanText.includes('部活') || cleanText.includes('サークル')) {
        const found = activeGroups.find(g => g.name.includes('サークル') || g.name.includes('部活'));
        if (found) targetGroupId = found.id;
      } else if (cleanText.includes('買い物') || cleanText.includes('バイト') || cleanText.includes('デート') || cleanText.includes('旅行') || cleanText.includes('カフェ')) {
        const found = activeGroups.find(g => g.name.includes('プライベート') || g.name.includes('個人') || g.name.includes('生活'));
        if (found) targetGroupId = found.id;
      }
    }

    const onComplete = () => {
      const newLargeId = 'large-' + Math.random().toString(36).substr(2, 9);
      const newMediumId = 'medium-' + Math.random().toString(36).substr(2, 9);
      const newSmallId = 'small-' + Math.random().toString(36).substr(2, 9);

      setTasks(prev => {
        let next = { ...prev };

        const newLarge: Task = {
          id: newLargeId,
          roomId: activeRoomId,
          groupId: targetGroupId,
          title: largeTitle,
          type: 'LARGE',
          isCompleted: false,
          status: 'active',
          deletionTimerId: null,
          deadline: taskDeadline,
          parentId: null,
          childIds: []
        };

        next[newLargeId] = newLarge;

        if (mediumTitle) {
          const newMedium: Task = {
            id: newMediumId,
            roomId: activeRoomId,
            groupId: targetGroupId,
            title: mediumTitle,
            type: 'MEDIUM',
            isCompleted: false,
            status: 'active',
            deletionTimerId: null,
            deadline: '',
            parentId: newLargeId,
            childIds: []
          };
          next[newMediumId] = newMedium;
          next[newLargeId].childIds = [newMediumId];

          if (smallTitle) {
            const newSmall: Task = {
              id: newSmallId,
              roomId: activeRoomId,
              groupId: targetGroupId,
              title: smallTitle,
              type: 'SMALL',
              isCompleted: false,
              status: 'active',
              deletionTimerId: null,
              deadline: '',
              parentId: newMediumId,
              childIds: []
            };
            next[newSmallId] = newSmall;
            next[newMediumId].childIds = [newSmallId];
          }
        }

        next = propagateCompletionUpward(newLargeId, next);
        return next;
      });

      setInputText('');
      setTaskDeadline('');
      setExpandedTasks(prev => ({ ...prev, [newLargeId]: true }));
      addToast(`タスク『${largeTitle}』を追加しました！`, 'success');
    };

    const inputEl = document.getElementById('slime-input-container');
    const badgeEl = document.getElementById(`badge-item-${targetGroupId}`);

    if (inputEl && badgeEl) {
      const inputRect = inputEl.getBoundingClientRect();
      const badgeRect = badgeEl.getBoundingClientRect();

      const startX = inputRect.left + inputRect.width / 2;
      const startY = inputRect.top;
      const endX = badgeRect.left + badgeRect.width / 2;
      const endY = badgeRect.top + badgeRect.height / 2;

      setSlimeAnim({
        active: true,
        text: largeTitle,
        targetGroupId,
        startX,
        startY,
        endX,
        endY
      });

      setTimeout(() => {
        const targetBadge = document.getElementById(`badge-item-${targetGroupId}`);
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

  // チームルーム同期デモ
  const triggerSyncDemo = () => {
    if (syncing) return;

    const roomTasks = Object.values(tasks).filter(t => t.roomId === activeRoomId);
    if (roomTasks.length === 0) {
      addToast('同期するタスクがありません。', 'warning');
      return;
    }

    // 未完了のSMALLタスクを見つける
    const pendingSmall = roomTasks.find(t => t.type === 'SMALL' && !t.isCompleted);
    if (!pendingSmall) {
      addToast('同期シミュレート用の未完了の作業項目（小タスク）が登録されていません。', 'warning');
      return;
    }

    setSyncing(true);
    addToast('シェアルームの共同タスク同期中...', 'info');

    setTimeout(() => {
      setTasks(prev => {
        if (!prev[pendingSmall.id]) return prev;
        let next = {
          ...prev,
          [pendingSmall.id]: {
            ...prev[pendingSmall.id],
            isCompleted: true
          }
        };
        next = propagateCompletionUpward(pendingSmall.id, next);
        return next;
      });

      addToast(`同期完了：『${pendingSmall.title}』が進捗に反映されました`, 'success');
      setSyncing(false);
    }, 2000);
  };

  // --- カレンダーグリッド ---
  const getDaysInMonth = () => {
    const year = 2026;
    const month = 6; // 7月 (0-indexed)
    const date = new Date(year, month, 1);
    const days: (number | null)[] = [];
    
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

  const getTasksForDay = (day: number) => {
    return Object.values(tasks).filter(t => {
      if (t.roomId !== activeRoomId || t.type !== 'LARGE') return false;
      if (!t.deadline) return false;
      const d = new Date(t.deadline);
      return d.getDate() === day && d.getMonth() === 6 && d.getFullYear() === 2026;
    });
  };

  const activeRoom = rooms.find(r => r.id === activeRoomId);
  const isSubmitDisabled = !inputText.trim() || !taskDeadline || !activeRoomId || !selectedGroupId;

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#3E3A35] font-sans pb-32 flex flex-col items-center">
      {/* --- ヘッダー --- */}
      <header className="w-full max-w-4xl px-6 py-6 flex justify-between items-center border-b border-[#EAE3D8]">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#3E3A35]">
            Tasknow
          </h1>
        </div>

        {/* シェアルーム切り替え・招待・削除機能 */}
        <div className="flex items-center gap-3 relative">
          
          {/* アバター山 (Avatar pile) */}
          {activeRoomId && activeRoom && (
            <div className="flex -space-x-1.5 overflow-hidden items-center mr-1">
              {activeRoom.members.map((member, idx) => (
                <div 
                  key={idx}
                  className="inline-block h-6 w-6 rounded-full ring-2 ring-[#FDFBF7] bg-[#B5C7A3] text-[9px] font-extrabold text-[#3E3A35] flex items-center justify-center cursor-help animate-fade-in"
                  title={member}
                  style={{ width: '25px', height: '25px' }}
                >
                  {member.slice(0, 1)}
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => setShowRoomDropdown(!showRoomDropdown)}
              className="flex items-center gap-2 bg-[#FFFFFF] border border-[#EAE3D8] hover:bg-[#FDFBF7] px-4 py-2 rounded-full text-xs font-semibold shadow-sm transition-all"
            >
              <Users size={13} className="text-[#8A7E72]" />
              <span>{activeRoom ? activeRoom.name : 'ルームを選択 👥'}</span>
              <ChevronDown size={12} className="text-[#8A7E72]" />
            </button>

            {/* ルームドロップダウンパネル */}
            {showRoomDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-[#FFFFFF] border border-[#EAE3D8] rounded-2xl shadow-lg p-2 z-[200]">
                <div className="text-[10px] text-[#8A7E72] font-bold px-3 py-1.5 border-b border-[#F3EDE2]">
                  シェアルームの選択
                </div>
                
                {rooms.length === 0 ? (
                  <div className="text-[10px] text-[#8A7E72] px-3 py-3 text-center">
                    ルームがありません。新規作成してください。
                  </div>
                ) : (
                  rooms.map(room => (
                    <div 
                      key={room.id}
                      className={`flex justify-between items-center rounded-xl px-2.5 py-1 ${
                        activeRoomId === room.id ? 'bg-[#B5C7A3] bg-opacity-20' : 'hover:bg-[#FDFBF7]'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setActiveRoomId(room.id);
                          const nextGroups = groups.filter(g => g.roomId === room.id);
                          setSelectedGroupId(nextGroups.length > 0 ? nextGroups[0].id : '');
                          setShowRoomDropdown(false);
                          addToast(`シェアルームを『${room.name}』に切り替えました`, 'info');
                        }}
                        className={`text-left py-1.5 text-xs flex-1 border-none bg-transparent cursor-pointer text-[#3E3A35] ${
                          activeRoomId === room.id ? 'font-bold' : ''
                        }`}
                      >
                        {room.name}
                      </button>
                      <button
                        onClick={(e) => handleRoomDeleteClick(room, e)}
                        className="text-[#E6A79A] hover:text-[#FF4D4D] p-1 border-none bg-transparent cursor-pointer"
                        title="ルームを削除"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
                
                <div className="border-t border-[#F3EDE2] mt-2 pt-2 flex flex-col gap-1">
                  <button
                    onClick={() => {
                      setShowCreateRoomModal(true);
                      setShowRoomDropdown(false);
                    }}
                    className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-extrabold text-[#8BA6A9] hover:bg-[#FDFBF7] flex items-center gap-1.5"
                  >
                    <Plus size={13} />
                    新規ルームを作成
                  </button>

                  {activeRoomId && (
                    <button
                      onClick={() => {
                        setShowInviteModal(true);
                        setShowRoomDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-extrabold text-[#E6A79A] hover:bg-[#FDFBF7] flex items-center gap-1.5"
                    >
                      <Plus size={13} />
                      メンバーを招待
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={triggerSyncDemo}
            disabled={syncing || !activeRoomId}
            className="flex items-center gap-1.5 bg-[#F3EDE2] hover:bg-[#EAE3D8] active:scale-95 transition-all text-xs font-bold px-4 py-2 rounded-full border border-[#EAE3D8] disabled:opacity-50 disabled:pointer-events-none"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            同期デモ
          </button>
        </div>
      </header>

      {/* --- メインコンテンツ --- */}
      <main className="w-full max-w-2xl px-6 mt-6 flex-1 flex flex-col">
        {/* リスト・カレンダー切り替え & 優先順ソートトグル */}
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

          {/* 優先順ソートトグル */}
          {activeTab === 'list' && (
            <button
              onClick={() => {
                setAiSortActive(!aiSortActive);
                addToast(`優先順ソートを${!aiSortActive ? 'ON' : 'OFF'}にしました`, 'info');
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                aiSortActive 
                  ? 'bg-[#B5C7A3] border-[#B5C7A3] text-[#3E3A35]' 
                  : 'bg-[#FFFFFF] border-[#EAE3D8] text-[#8A7E72]'
              }`}
            >
              <Zap size={14} />
              優先順: {aiSortActive ? 'ON' : 'OFF'}
            </button>
          )}
        </div>

        {/* --- グループフォルダ・カプセルバッジ (動的追加・削除) --- */}
        <div className="flex flex-wrap justify-center items-center gap-3 mb-6">
          {activeGroups.map(group => {
            const isActive = selectedGroupId === group.id;
            const count = getGroupTaskCount(group.id);
            return (
              <div
                key={group.id}
                id={`badge-item-${group.id}`}
                className={`flex items-center gap-1.5 border px-4 py-2 rounded-full text-sm transition-all duration-300 ${
                  isActive 
                    ? 'bg-[#B5C7A3] border-[#B5C7A3] text-[#3E3A35] font-extrabold shadow-sm scale-105' 
                    : 'bg-[#FFFFFF] border-[#EAE3D8] text-[#8A7E72] hover:bg-[#FDFBF7]'
                }`}
              >
                <button
                  onClick={() => setSelectedGroupId(group.id)}
                  className="border-none bg-transparent cursor-pointer font-inherit text-inherit flex items-center gap-1.5"
                >
                  <span>{group.emoji} {group.name}</span>
                  <span className="text-[10px] bg-[#3E3A35] text-[#FFFFFF] px-1.5 py-0.5 rounded-full">
                    {count}
                  </span>
                </button>
                
                {/* グループ削除確認を挟む */}
                <button
                  onClick={(e) => handleGroupDeleteClick(group, e)}
                  className="text-xs text-[#E6A79A] hover:text-[#FF4D4D] border-none bg-transparent cursor-pointer p-0.5 ml-0.5 flex items-center justify-center font-bold"
                  title="グループを削除"
                >
                  ×
                </button>
              </div>
            );
          })}

          {/* 動的グループ追加ボタン */}
          {activeRoomId && (
            <div className="relative">
              {!showAddGroupInput ? (
                <button
                  onClick={() => setShowAddGroupInput(true)}
                  className="flex items-center justify-center bg-[#F3EDE2] hover:bg-[#EAE3D8] text-[#3E3A35] w-9 h-9 rounded-full border border-[#EAE3D8] transition-all"
                  title="新しいグループを追加"
                >
                  <FolderPlus size={16} />
                </button>
              ) : (
                <form 
                  onSubmit={handleAddGroupSubmit}
                  className="flex items-center bg-[#FFFFFF] border border-[#EAE3D8] rounded-full p-1 shadow-sm gap-1 animate-fade-in"
                >
                  <input
                    type="text"
                    placeholder="グループ名 (例: 就活 👔)"
                    value={newGroupNameInput}
                    onChange={(e) => setNewGroupNameInput(e.target.value)}
                    className="px-3 py-1 outline-none text-xs bg-transparent border-none text-[#3E3A35] w-40"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="bg-[#B5C7A3] text-[#3E3A35] text-xs font-bold px-3 py-1 rounded-full border-none cursor-pointer"
                  >
                    追加
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddGroupInput(false)}
                    className="text-xs text-[#8A7E72] px-2"
                  >
                    閉
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* --- ビュー表示エリア --- */}
        <div className="flex-1">
          {(!activeRoomId || !selectedGroupId) ? (
            /* --- ルーム・グループが作成されていない時の案内 --- */
            <div className="p-12 text-center text-[#8A7E72] bg-[#FFFFFF] border border-[#EAE3D8] rounded-3xl shadow-sm flex flex-col items-center gap-3">
              <span className="text-4xl">👋</span>
              <h3 className="font-extrabold text-sm text-[#3E3A35]">まずはシェアルームを作成または選択してください</h3>
              <p className="text-xs max-w-sm leading-relaxed">
                画面右上から **「シェアルーム」** を作成し、上部の「＋」ボタンから **「グループ（リスト）」** を追加して、タスクの準備を始めましょう。
              </p>
            </div>
          ) : activeTab === 'list' ? (
            /* --- リストビュー (AnimatePresenceで自動消滅を心地よくアニメーション) --- */
            <div className="flex flex-col gap-4">
              <AnimatePresence initial={false}>
                {getFilteredAndSortedTasks().length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-12 text-center text-[#8A7E72] bg-[#FFFFFF] border border-[#EAE3D8] rounded-3xl"
                  >
                    タスクがありません。最下部の入力バーから追加してください。
                  </motion.div>
                ) : (
                  getFilteredAndSortedTasks().map(largeTask => {
                    const expanded = !!expandedTasks[largeTask.id];
                    const isLargeCompleted = largeTask.isCompleted;
                    const progress = getTaskProgressRate(largeTask.id, tasks);
                    const mediumTasks = largeTask.childIds.map(cid => tasks[cid]).filter(Boolean);

                    return (
                      <motion.div 
                        key={largeTask.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        className="relative overflow-hidden rounded-3xl"
                      >
                        {/* スワイプ削除インジケータ */}
                        <div className="absolute inset-0 bg-[#E6A79A] flex justify-end items-center pr-6 rounded-3xl pointer-events-none">
                          <span className="text-[#3E3A35] font-bold text-xs flex items-center gap-1">
                            <Trash2 size={14} /> 左スワイプで削除
                          </span>
                        </div>

                        {/* カード本体 */}
                        <motion.div
                          drag="x"
                          dragConstraints={{ right: 0, left: -140 }}
                          onDragEnd={(_, info) => {
                            if (info.offset.x < -100) {
                              handleDeleteTask(largeTask.id, largeTask.title);
                            }
                          }}
                          whileDrag={{ scale: 1.02, boxShadow: '0px 10px 25px rgba(62, 58, 53, 0.1)' }}
                          className="relative bg-[#FFFFFF] border border-[#EAE3D8] rounded-3xl p-5 flex flex-col gap-4 cursor-pointer select-none"
                        >
                          {/* 大タスクヘッダー */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              
                              {/* 完了チェックボックス (子タスクがある場合は選択不可) */}
                              <TaskCheckbox 
                                checked={isLargeCompleted}
                                onChange={() => handleLargeTaskToggle(largeTask.id)}
                                disabled={largeTask.childIds.length > 0}
                              />

                              {/* 展開トグル領域 */}
                              <div className="flex items-center gap-2 flex-1" onClick={() => toggleExpand(largeTask.id)}>
                                <div className="text-[#8A7E72]">
                                  {largeTask.childIds.length > 0 ? (
                                    expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />
                                  ) : (
                                    <div className="w-5" />
                                  )}
                                </div>

                                <div className="flex flex-col">
                                  <span className={`font-extrabold text-base transition-all duration-300 ${
                                    isLargeCompleted 
                                      ? 'line-through text-[#B5C7A3] opacity-50' 
                                      : 'text-[#3E3A35]'
                                  }`}>
                                    {largeTask.title}
                                  </span>
                                  <div className="flex items-center gap-3 text-[10px] text-[#8A7E72] mt-1.5 flex-wrap">
                                    <span className="flex items-center gap-0.5"><Clock size={11} />想定: 60分</span>
                                    <span className="flex items-center gap-0.5 text-[#8BA6A9] font-bold">
                                      <DateIcon size={11} />
                                      締切: {new Date(largeTask.deadline || '').toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* 進捗ゲージ */}
                            <div className="flex items-center gap-3">
                              <div className="relative w-12 h-12 flex items-center justify-center">
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
                                    strokeDashoffset={2 * Math.PI * 18 * (1 - progress / 100)}
                                    className="transition-all duration-500 ease-out"
                                  />
                                </svg>
                                <span className="absolute text-[10px] font-bold text-[#3E3A35]">{progress}%</span>
                              </div>
                            </div>
                          </div>

                          {/* 3階層アコーディオン */}
                          <AnimatePresence initial={false}>
                            {expanded && largeTask.childIds.length > 0 && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden border-t border-[#F3EDE2] pt-4 flex flex-col gap-4"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {mediumTasks.map(mediumTask => {
                                  const isMediumCompleted = mediumTask.isCompleted;
                                  const mediumProgress = getTaskProgressRate(mediumTask.id, tasks);
                                  const smallTasks = mediumTask.childIds.map(sid => tasks[sid]).filter(Boolean);

                                  return (
                                    <div key={mediumTask.id} className="bg-[#FDFBF7] p-4 rounded-2xl border border-[#EAE3D8] flex flex-col gap-3 animate-fade-in">
                                      <div className="flex justify-between items-center gap-2">
                                        <div className="flex items-center gap-2.5">
                                          <TaskCheckbox 
                                            checked={isMediumCompleted}
                                            onChange={() => handleMediumTaskToggle(mediumTask.id)}
                                            disabled={mediumTask.childIds.length > 0}
                                          />
                                          <span className={`text-xs font-bold transition-all duration-300 ${
                                            isMediumCompleted 
                                              ? 'line-through text-[#B5C7A3] opacity-50' 
                                              : 'text-[#3E3A35]'
                                          }`}>
                                            【中】{mediumTask.title}
                                          </span>
                                        </div>
                                        <span className="text-[10px] bg-[#EAE3D8] px-2 py-0.5 rounded-full font-bold">
                                          進捗: {mediumProgress}%
                                        </span>
                                      </div>

                                      {/* 中タスク進捗バー */}
                                      <div className="w-full bg-[#F3EDE2] h-1 rounded-full overflow-hidden">
                                        <div 
                                          className="bg-[#B5C7A3] h-full transition-all duration-500 ease-out" 
                                          style={{ width: `${mediumProgress}%` }}
                                        />
                                      </div>

                                      {/* 小タスク項目リスト */}
                                      <div className="flex flex-col gap-2 pl-2">
                                        <AnimatePresence initial={false}>
                                          {smallTasks.map(smallTask => (
                                            <motion.label 
                                              key={smallTask.id} 
                                              initial={{ opacity: 1, x: 0 }}
                                              exit={{ opacity: 0, x: -10 }}
                                              className="flex items-center gap-2.5 text-xs text-[#8A7E72] hover:text-[#3E3A35] transition-colors cursor-pointer"
                                            >
                                              <input 
                                                type="checkbox"
                                                checked={smallTask.isCompleted}
                                                onChange={() => handleSmallTaskToggle(smallTask.id)}
                                                className="w-4 h-4 cursor-pointer accent-[#B5C7A3]"
                                              />
                                              <span className={`transition-all duration-300 ${
                                                smallTask.isCompleted 
                                                  ? 'line-through text-[#B5C7A3] opacity-50' 
                                                  : 'text-[#3E3A35]'
                                              }`}>
                                                {smallTask.title}
                                              </span>
                                            </motion.label>
                                          ))}
                                        </AnimatePresence>
                                      </div>

                                      <form 
                                        onSubmit={(e) => handleAddSmallTask(mediumTask.id, e)}
                                        className="flex items-center gap-1.5 border-t border-[#F3EDE2] pt-2 mt-1"
                                      >
                                        <input 
                                          type="text" 
                                          placeholder="小タスク (作業項目) を追加..."
                                          value={newSmallInputs[mediumTask.id] || ''}
                                          onChange={(e) => setNewSmallInputs(prev => ({ ...prev, [mediumTask.id]: e.target.value }))}
                                          className="flex-1 bg-transparent border-none text-[11px] outline-none py-1 placeholder-[#B5A89E] text-[#3E3A35]"
                                        />
                                        <button 
                                          type="submit" 
                                          className="bg-transparent border-none text-[#8BA6A9] cursor-pointer"
                                          title="小タスクを追加"
                                        >
                                          <Plus size={14} />
                                        </button>
                                      </form>
                                    </div>
                                  );
                                })}

                                {/* 中タスクインライン追加 */}
                                <form 
                                  onSubmit={(e) => handleAddMediumTask(largeTask.id, e)}
                                  className="flex items-center gap-2 bg-[#FFFFFF] border border-[#EAE3D8] rounded-xl px-4 py-2"
                                >
                                  <input 
                                    type="text"
                                    placeholder="新しいステップ (中タスク) を追加..."
                                    value={newMediumInputs[largeTask.id] || ''}
                                    onChange={(e) => setNewMediumInputs(prev => ({ ...prev, [largeTask.id]: e.target.value }))}
                                    className="flex-1 bg-transparent border-none text-xs outline-none py-1 placeholder-[#B5A89E] text-[#3E3A35]"
                                  />
                                  <button 
                                    type="submit"
                                    className="bg-[#F3EDE2] hover:bg-[#EAE3D8] border border-[#EAE3D8] rounded-full w-6 h-6 flex items-center justify-center cursor-pointer text-[#3E3A35]"
                                  >
                                    <Plus size={13} />
                                  </button>
                                </form>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          ) : (
            /* --- カレンダービュー --- */
            <div className="bg-[#FFFFFF] border border-[#EAE3D8] rounded-3xl p-5 shadow-sm animate-fade-in">
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
                      className="p-2 border border-[#F3EDE2] rounded-xl hover:bg-[#FDFBF7] cursor-pointer flex flex-col items-center justify-between min-h-[55px]"
                      onClick={() => {
                        if (dueTasks.length > 0) {
                          addToast(`${day}日の締切タスク: 『${dueTasks.map(t => t.title).join('』、『')}』`, 'info');
                        } else {
                          addToast(`${day}日に締め切り設定されているタスクはありません`, 'info');
                        }
                      }}
                    >
                      <span className="font-semibold">{day}</span>
                      <div className="flex gap-0.5 justify-center mt-1 flex-wrap">
                        {dueTasks.map(t => (
                          <span 
                            key={t.id} 
                            className="w-1.5 h-1.5 rounded-full bg-[#B5C7A3]"
                            title={t.title}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- 固定最下部入力バー --- */}
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
          className="flex items-center bg-[#F3EDE2] border border-[#EAE3D8] rounded-full px-4 py-2 shadow-md pointer-events-auto w-full transition-all duration-300 hover:shadow-lg"
        >
          {/* ⚡ テンプレート選択ポップアップ */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTemplatePopup(!showTemplatePopup)}
              disabled={!activeRoomId || !selectedGroupId}
              className="flex items-center justify-center bg-[#FFFFFF] border border-[#EAE3D8] hover:border-[#B5C7A3] disabled:opacity-50 disabled:pointer-events-none rounded-full w-9 h-9 cursor-pointer transition-all mr-2 text-[#8A7E72]"
              title="定型タスクテンプレート ⚡"
            >
              <Zap size={14} />
            </button>
            
            {showTemplatePopup && (
              <div className="absolute bottom-12 left-0 w-64 bg-[#FFFFFF] border border-[#EAE3D8] rounded-2xl shadow-lg p-2.5 z-[200] pointer-events-auto animate-fade-in">
                <div className="text-[10px] text-[#8A7E72] font-bold px-3 py-1.5 border-b border-[#F3EDE2]">
                  定型タスクテンプレート
                </div>
                <div className="flex flex-col gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate('report')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#FDFBF7] text-[#3E3A35] flex flex-col gap-0.5 border-none bg-transparent cursor-pointer"
                  >
                    <span className="font-extrabold text-[#3E3A35]">【課題提出セット】</span>
                    <span className="text-[9px] text-[#8A7E72] leading-tight">レポート提出 ➔ 参考文献集め、構成案作成、執筆</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate('test')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#FDFBF7] text-[#3E3A35] flex flex-col gap-0.5 border-none bg-transparent cursor-pointer"
                  >
                    <span className="font-extrabold text-[#3E3A35]">【テスト対策セット】</span>
                    <span className="text-[9px] text-[#8A7E72] leading-tight">テスト対策 ➔ 過去問を解く、ノートの復習</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate('shift')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#FDFBF7] text-[#3E3A35] flex flex-col gap-0.5 border-none bg-transparent cursor-pointer"
                  >
                    <span className="font-extrabold text-[#3E3A35]">【バイト・シフト】</span>
                    <span className="text-[9px] text-[#8A7E72] leading-tight">バイト出勤</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* インライン締切指定ピッカー */}
          <div 
            className={`flex items-center gap-1.5 bg-[#FFFFFF] border rounded-full px-3 py-1.5 mr-2 text-[#8A7E72] transition-all ${
              !taskDeadline ? 'border-[#E6A79A] bg-[#FFF8F7]' : 'border-[#EAE3D8] hover:border-[#B5C7A3]'
            }`}
          >
            <DateIcon size={13} className={!taskDeadline ? 'text-[#E6A79A]' : 'text-[#8A7E72]'} />
            <input 
              type="date" 
              value={taskDeadline} 
              onChange={(e) => setTaskDeadline(e.target.value)} 
              className="bg-transparent border-none text-[10px] outline-none text-[#3E3A35] font-bold w-[95px] cursor-pointer"
              title="締切日を選択してください（必須）"
              disabled={!activeRoomId || !selectedGroupId}
              required
            />
          </div>

          <input 
            type="text"
            placeholder={
              (!activeRoomId || !selectedGroupId) 
                ? 'ルームとグループを先に作成してください'
                : 'タスクを入力...'
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={!activeRoomId || !selectedGroupId}
            className="flex-1 border-none bg-transparent outline-none text-sm text-[#3E3A35] placeholder-[#8A7E72] py-2 disabled:cursor-not-allowed"
          />

          {/* 送信ボタン */}
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className={`border-none w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 shadow-sm ${
              isSubmitDisabled 
                ? 'bg-[#EAE3D8] text-[#B5A89E] opacity-50 cursor-not-allowed pointer-events-none' 
                : 'bg-[#B5C7A3] text-[#3E3A35] hover:scale-105 active:scale-95'
            }`}
            title={isSubmitDisabled ? "作成状況またはタスク・締切設定を確認してください" : "送信して自動分類"}
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
            scaleX: [1, 0.6, 1.4, 0.4, 1],
            scaleY: [1, 1.8, 0.7, 1.6, 1],
            opacity: [1, 1, 1, 0.9, 0],
            rotate: [0, -8, 8, -4, 0]
          }}
          transition={{
            duration: 0.8,
            ease: [0.25, 0.8, 0.25, 1],
            times: [0, 0.35, 0.7, 0.9, 1]
          }}
          className="fixed z-[9999] bg-[#B5C7A3] border-2 border-[#FFFFFF] text-[#3E3A35] px-4 py-2 rounded-2xl text-xs font-extrabold shadow-md white-space-nowrap pointer-events-none flex items-center gap-1.5 animate-fade-in"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFFFFF] opacity-80 animate-ping"></span>
          {slimeAnim.text}
        </motion.div>
      )}

      {/* --- 新規シェアルーム作成モーダル --- */}
      {showCreateRoomModal && (
        <div className="fixed inset-0 bg-[#000000] bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
          <div className="bg-[#FFFFFF] border border-[#EAE3D8] rounded-3xl p-6 w-full max-w-sm shadow-xl animate-fade-in">
            <h3 className="text-sm font-extrabold text-[#3E3A35] mb-4">新規シェアルーム作成</h3>
            <form onSubmit={handleCreateRoomSubmit} className="flex flex-col gap-3">
              <input 
                type="text"
                placeholder="ルーム名 (例: アルバイト、サークル課題)"
                value={newRoomNameInput}
                onChange={(e) => setNewRoomNameInput(e.target.value)}
                className="bg-[#F3EDE2] border border-[#EAE3D8] rounded-xl px-4 py-2.5 text-xs outline-none text-[#3E3A35] w-full"
                autoFocus
                required
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateRoomModal(false);
                    setNewRoomNameInput('');
                  }}
                  className="px-4 py-2 rounded-xl text-xs bg-[#F3EDE2] hover:bg-[#EAE3D8] text-[#8A7E72] font-semibold transition-all"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs bg-[#B5C7A3] text-[#3E3A35] font-bold transition-all"
                >
                  作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 他ユーザー招待モーダル --- */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-[#000000] bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
          <div className="bg-[#FFFFFF] border border-[#EAE3D8] rounded-3xl p-6 w-full max-w-sm shadow-xl animate-fade-in">
            <h3 className="text-sm font-extrabold text-[#3E3A35] mb-4">メンバーを招待</h3>
            <form onSubmit={handleInviteSubmit} className="flex flex-col gap-3">
              <input 
                type="text"
                placeholder="招待するユーザー名 (例: アリス 👩)"
                value={inviteNameInput}
                onChange={(e) => setInviteNameInput(e.target.value)}
                className="bg-[#F3EDE2] border border-[#EAE3D8] rounded-xl px-4 py-2.5 text-xs outline-none text-[#3E3A35] w-full"
                autoFocus
                required
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteNameInput('');
                  }}
                  className="px-4 py-2 rounded-xl text-xs bg-[#F3EDE2] hover:bg-[#EAE3D8] text-[#8A7E72] font-semibold transition-all"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs bg-[#B5C7A3] text-[#3E3A35] font-bold transition-all"
                >
                  招待する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 2段階削除確認ダイアログ (ダブルチェック) --- */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-[#000000] bg-opacity-40 backdrop-blur-sm flex flex-col items-center justify-center z-[2000] p-4">
          <div className="bg-[#FFFFFF] border border-[#EAE3D8] rounded-3xl p-6 w-full max-w-sm shadow-xl animate-fade-in">
            <div className="flex items-center gap-2.5 text-[#E6A79A] mb-3">
              <Trash2 size={20} />
              <h3 className="text-sm font-extrabold text-[#3E3A35]">
                本当に削除しますか？
              </h3>
            </div>
            <p className="text-xs text-[#8A7E72] leading-relaxed mb-4">
              {deleteTarget.type === 'group' 
                ? `グループ『${deleteTarget.name}』を削除すると、このグループに属するすべてのタスクが同時に削除されます。この操作は元に戻せません。`
                : `ルーム『${deleteTarget.name}』を削除すると、このルームに登録されているすべてのタスク、招待したメンバー、グループ関係データが完全にクリアされます。この操作は元に戻せません。`
              }
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-xs bg-[#F3EDE2] hover:bg-[#EAE3D8] text-[#8A7E72] font-semibold transition-all"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteTarget.type === 'group') {
                    executeDeleteGroup(deleteTarget.id);
                  } else {
                    executeDeleteRoom(deleteTarget.id);
                  }
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 rounded-xl text-xs bg-[#E6A79A] text-[#3E3A35] font-bold hover:bg-opacity-95 transition-all"
              >
                本当に削除する ⚠️
              </button>
            </div>
          </div>
        </div>
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

      {/* --- アタッチ時のバウンスCSS --- */}
      <style>{`
        @keyframes bounce-animation {
          0% { transform: scale(1); }
          20% { transform: scale(1.2) rotate(-3deg); }
          45% { transform: scale(0.9) rotate(3deg); }
          70% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .slime-bounce-active {
          animation: bounce-animation 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .animate-fade-in {
          animation: fade-in 0.25s ease-out;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default TasknowEvolution;
