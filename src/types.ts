export interface User {
  id: string;
  name: string;
  email: string;
  theme_color: string; // CSS color for avatar
}

export interface Team {
  id: string;
  team_name: string;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
}

export interface Task {
  id: string;
  title: string;
  parentId: string | null;
  estimatedMinutes: number;
  progressRate: number; // 0 to 100
  deadline: string; // ISO string
  groupName: string; // Automatically classified group
  team_id: string | null;
  assigned_user_id: string | null;
  manual_order?: number; // Override order index for manual sorting
  priorityScore?: number;
  isYabai?: boolean;
  remainingHours?: number;
}

// Log of events representing backend/realtime events
export interface SimEvent {
  id: string;
  timestamp: string; // Time of simulation
  user: string; // Action by
  message: string;
  type: 'info' | 'success' | 'warning' | 'websocket' | 'notification';
}

// FCM-style notification queue
export interface FCMNotification {
  id: string;
  taskTitle: string;
  message: string;
  timestamp: string;
  read: boolean;
}
