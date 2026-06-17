import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database initialization
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["query"] });

const app = express();
const PORT = process.env.PORT || 8888;
const JWT_SECRET = "gradtask_secret_key";

// CORS config for React dev server (port 5173) compatibility
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global simulation variables
let timeOffsetHours = 0; // Simulated time offset
let fcmNotifications: any[] = [];

// JWT authentication middleware
const authenticateJWT = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) {
        return res.status(403).json({ error: "Invalid token" });
      }
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ error: "Missing authorization token" });
  }
};

// --- Progress Auto-Propagation Helper ---
async function rebuildAllParentProgress() {
  const allTasks = await prisma.task.findMany();
  // Find all parentIds
  const parentIds = Array.from(
    new Set(allTasks.map((t) => t.parent_id).filter((id): id is string => id !== null))
  );

  let changed = true;
  let iterations = 0;
  // Repeat up to 5 times to propagate up multi-level structures (Leaf -> Child -> Parent)
  while (changed && iterations < 5) {
    changed = false;
    const tasksState = await prisma.task.findMany();
    for (const parentId of parentIds) {
      const siblings = tasksState.filter((t) => t.parent_id === parentId);
      if (siblings.length > 0) {
        const avg = Math.round(siblings.reduce((sum, s) => sum + s.progress_rate, 0) / siblings.length);
        const parent = tasksState.find((t) => t.id === parentId);
        if (parent && parent.progress_rate !== avg) {
          await prisma.task.update({
            where: { id: parentId },
            data: { progress_rate: avg },
          });
          changed = true;
        }
      }
    }
    iterations++;
  }
}

// --- API ROUTES ---

// Simulated JWT Token issuance
app.post("/api/v1/auth/token", async (req, res) => {
  const { userId } = req.body;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  const token = jwt.sign({ id: user.id, name: user.name }, JWT_SECRET);
  res.json({ token, user });
});

// Fetch all users
app.get("/api/v1/users", async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

// Fetch all teams and their memberships
app.get("/api/v1/teams", async (req, res) => {
  const teams = await prisma.team.findMany();
  res.json(teams);
});

// Fetch all tasks with dynamic priority calculations
app.get("/api/v1/tasks", async (req, res) => {
  const tasks = await prisma.task.findMany({
    orderBy: { deadline: "asc" }
  });

  const now = new Date(Date.now() + timeOffsetHours * 60 * 60 * 1000);

  const enrichedTasks = tasks.map((t) => {
    const deadlineDate = new Date(t.deadline);
    const remainingMs = deadlineDate.getTime() - now.getTime();
    const remainingHours = remainingMs / (1000 * 60 * 60);
    const denominator = remainingHours <= 0 ? 0.05 : Math.max(0.05, remainingHours);

    const remainingWorkMinutes = t.estimated_minutes * ((100 - t.progress_rate) / 100);
    const remainingWorkHours = remainingWorkMinutes / 60;

    const priorityScore = t.progress_rate >= 100 ? 0 : Math.round(remainingWorkMinutes / denominator / 10);
    const isYabai = t.progress_rate < 100 && remainingHours < (remainingWorkHours * 1.5);

    return {
      ...t,
      priority_score: priorityScore,
      is_yabai: isYabai,
      remaining_hours: remainingHours,
    };
  });

  res.json(enrichedTasks);
});

// Create task
app.post("/api/v1/tasks", authenticateJWT, async (req: any, res) => {
  const { title, estimated_minutes, deadline, team_id, assigned_user_id, parent_id } = req.body;

  // Authorization check: if task belongs to a team, verify user is in that team
  if (team_id) {
    const membership = await prisma.teamMember.findUnique({
      where: { team_id_user_id: { team_id, user_id: req.user.id } },
    });
    if (!membership) {
      return res.status(403).json({ error: "Access denied: You are not a member of this team" });
    }
  }

  const task = await prisma.task.create({
    data: {
      title,
      estimated_minutes: Number(estimated_minutes),
      deadline: new Date(deadline),
      team_id: team_id || null,
      assigned_user_id: assigned_user_id || null,
      parent_id: parent_id || null,
      progress_rate: 0,
    },
  });

  await rebuildAllParentProgress();

  broadcast({
    type: "TASK_CREATED",
    taskId: task.id,
    updater: req.user.name,
    message: `${req.user.name}が新しいタスク『${title}』を作成しました。`,
  });

  res.json(task);
});

// Update task progress
app.post("/api/v1/tasks/:id/progress", authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  const { progress_rate } = req.body;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  // Team authorization check
  if (task.team_id) {
    const membership = await prisma.teamMember.findUnique({
      where: { team_id_user_id: { team_id: task.team_id, user_id: req.user.id } },
    });
    if (!membership) {
      return res.status(403).json({ error: "Access denied: You are not a member of this team" });
    }
  }

  // Update target task progress
  const updatedTask = await prisma.task.update({
    where: { id },
    data: { progress_rate: Number(progress_rate) },
  });

  // Run parent task updates bottom-up
  await rebuildAllParentProgress();

  // Send WebSocket broadcast
  broadcast({
    type: "TASK_UPDATED",
    taskId: id,
    updater: req.user.name,
    message: `${req.user.name}が『${task.title}』の進捗を ${progress_rate}% に更新しました。`,
  });

  res.json(updatedTask);
});

// Complete task (Helper API)
app.post("/api/v1/tasks/:id/complete", authenticateJWT, async (req: any, res) => {
  const { id } = req.params;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  if (task.team_id) {
    const membership = await prisma.teamMember.findUnique({
      where: { team_id_user_id: { team_id: task.team_id, user_id: req.user.id } },
    });
    if (!membership) {
      return res.status(403).json({ error: "Access denied" });
    }
  }

  const updatedTask = await prisma.task.update({
    where: { id },
    data: { progress_rate: 100 },
  });

  await rebuildAllParentProgress();

  broadcast({
    type: "TASK_UPDATED",
    taskId: id,
    updater: req.user.name,
    message: `${req.user.name}が『${task.title}』を完了しました！`,
  });

  res.json(updatedTask);
});

// Update general task details
app.put("/api/v1/tasks/:id", authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  const { title, estimated_minutes, deadline, assigned_user_id, team_id } = req.body;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  const updatedTask = await prisma.task.update({
    where: { id },
    data: {
      title,
      estimated_minutes: Number(estimated_minutes),
      deadline: new Date(deadline),
      assigned_user_id: assigned_user_id || null,
      team_id: team_id || null,
    },
  });

  await rebuildAllParentProgress();

  broadcast({
    type: "TASK_DETAILS_UPDATED",
    taskId: id,
    updater: req.user.name,
    message: `${req.user.name}が『${title}』の詳細情報を更新しました。`,
  });

  res.json(updatedTask);
});

// Delete task
app.delete("/api/v1/tasks/:id", authenticateJWT, async (req: any, res) => {
  const { id } = req.params;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  await prisma.task.delete({ where: { id } });
  await rebuildAllParentProgress();

  broadcast({
    type: "TASK_DELETED",
    taskId: id,
    updater: req.user.name,
    message: `${req.user.name}が『${task.title}』を削除しました。`,
  });

  res.json({ success: true });
});

// --- SIMULATOR CONTROLS ---

// Time Travel endpoint
app.post("/api/v1/simulator/time-travel", async (req, res) => {
  const { hours } = req.body;
  timeOffsetHours += Number(hours);

  const now = new Date(Date.now() + timeOffsetHours * 60 * 60 * 1000);

  broadcast({
    type: "TIME_TRAVELED",
    hours,
    newTime: now.toISOString(),
    message: `仮想時間を ${hours} 時間進めました。`,
  });

  // Run Cron prediction job check on time travel
  const triggeredNotifications = await runPredictionJob(now);

  res.json({ 
    success: true, 
    timeOffsetHours, 
    newTime: now.toISOString(),
    triggeredNotifications
  });
});

// Fetch simulator variables
app.get("/api/v1/simulator/state", async (req, res) => {
  const now = new Date(Date.now() + timeOffsetHours * 60 * 60 * 1000);
  res.json({
    timeOffsetHours,
    simTime: now.toISOString(),
    fcmNotifications
  });
});

// Manual Cron Job prediction trigger
app.post("/api/v1/simulator/cron-check", async (req, res) => {
  const now = new Date(Date.now() + timeOffsetHours * 60 * 60 * 1000);
  const triggered = await runPredictionJob(now);
  res.json({ success: true, triggered });
});

// Fetch FCM notifications log
app.get("/api/v1/simulator/notifications", (req, res) => {
  res.json(fcmNotifications);
});

// Reset simulation variables & DB seed
app.post("/api/v1/simulator/reset", async (req, res) => {
  timeOffsetHours = 0;
  fcmNotifications = [];
  
  // Re-seed DB
  // Execute seed logic manually
  await prisma.task.deleteMany({});
  await prisma.teamMember.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.user.deleteMany({});
  
  const alice = await prisma.user.create({
    data: { id: "user-alice", name: "A君 (Alice)", email: "alice@univ.ac.jp", theme_color: "#ff4d6d" },
  });
  const bob = await prisma.user.create({
    data: { id: "user-bob", name: "Bさん (Bob)", email: "bob@univ.ac.jp", theme_color: "#06d6a0" },
  });
  const charlie = await prisma.user.create({
    data: { id: "user-charlie", name: "C君 (Charlie)", email: "charlie@univ.ac.jp", theme_color: "#7209b7" },
  });
  const teamSeminar = await prisma.team.create({
    data: { id: "team-seminar", team_name: "ゼミ共同発表課題" },
  });
  const teamCircle = await prisma.team.create({
    data: { id: "team-circle", team_name: "サークル広報局" },
  });
  await prisma.teamMember.createMany({
    data: [
      { team_id: teamSeminar.id, user_id: alice.id },
      { team_id: teamSeminar.id, user_id: bob.id },
      { team_id: teamSeminar.id, user_id: charlie.id },
      { team_id: teamCircle.id, user_id: alice.id },
      { team_id: teamCircle.id, user_id: bob.id },
    ],
  });
  
  const baseTime = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  
  const seminarParent = await prisma.task.create({
    data: { id: "task-seminar-parent", title: "ゼミの共同発表資料作成", estimated_minutes: 330, progress_rate: 40, deadline: new Date(baseTime.getTime() + 2 * oneDay), team_id: teamSeminar.id },
  });
  await prisma.task.create({
    data: { id: "task-seminar-child-docs", title: "文献調査・資料集め", parent_id: seminarParent.id, estimated_minutes: 120, progress_rate: 100, deadline: new Date(baseTime.getTime() + 1 * oneDay), team_id: teamSeminar.id, assigned_user_id: alice.id },
  });
  await prisma.task.create({
    data: { id: "task-seminar-child-resume", title: "レジュメの印刷と製本", parent_id: seminarParent.id, estimated_minutes: 30, progress_rate: 0, deadline: new Date(baseTime.getTime() + 1.8 * oneDay), team_id: teamSeminar.id, assigned_user_id: bob.id },
  });
  const seminarChildSlide = await prisma.task.create({
    data: { id: "task-seminar-child-slide", title: "スライド資料の執筆", parent_id: seminarParent.id, estimated_minutes: 180, progress_rate: 20, deadline: new Date(baseTime.getTime() + 2 * oneDay), team_id: teamSeminar.id },
  });
  await prisma.task.create({
    data: { id: "task-seminar-sub-intro", title: "前半部分（イントロ・課題定義）", parent_id: seminarChildSlide.id, estimated_minutes: 90, progress_rate: 40, deadline: new Date(baseTime.getTime() + 1.5 * oneDay), team_id: teamSeminar.id, assigned_user_id: charlie.id },
  });
  await prisma.task.create({
    data: { id: "task-seminar-sub-body", title: "後半部分（提案手法・評価）", parent_id: seminarChildSlide.id, estimated_minutes: 90, progress_rate: 0, deadline: new Date(baseTime.getTime() + 2 * oneDay), team_id: teamSeminar.id, assigned_user_id: charlie.id },
  });

  const jobParent = await prisma.task.create({
    data: { id: "task-job-parent", title: "就活エントリーシート提出 (大手IT企業)", estimated_minutes: 150, progress_rate: 20, deadline: new Date(baseTime.getTime() + 0.8 * oneDay), assigned_user_id: alice.id },
  });
  await prisma.task.create({
    data: { id: "task-job-draft", title: "自己PRの添削依頼", parent_id: jobParent.id, estimated_minutes: 60, progress_rate: 50, deadline: new Date(baseTime.getTime() + 0.4 * oneDay), assigned_user_id: alice.id },
  });
  await prisma.task.create({
    data: { id: "task-job-reason", title: "志望動機の推敲", parent_id: jobParent.id, estimated_minutes: 90, progress_rate: 0, deadline: new Date(baseTime.getTime() + 0.8 * oneDay), assigned_user_id: alice.id },
  });
  const circleParent = await prisma.task.create({
    data: { id: "task-circle-parent", title: "夏合宿の案内チラシ作成", estimated_minutes: 180, progress_rate: 60, deadline: new Date(baseTime.getTime() + 5 * oneDay), team_id: teamCircle.id },
  });
  await prisma.task.create({
    data: { id: "task-circle-design", title: "デザイン原案作成", parent_id: circleParent.id, estimated_minutes: 120, progress_rate: 90, deadline: new Date(baseTime.getTime() + 3 * oneDay), team_id: teamCircle.id, assigned_user_id: bob.id },
  });
  await prisma.task.create({
    data: { id: "task-circle-print", title: "部室での配布と掲示", parent_id: circleParent.id, estimated_minutes: 60, progress_rate: 0, deadline: new Date(baseTime.getTime() + 5 * oneDay), team_id: teamCircle.id, assigned_user_id: alice.id },
  });

  broadcast({
    type: "RESET",
    message: "シミュレーターを初期設定にリセットしました。",
  });

  res.json({ success: true });
});

// --- FCM Predictive Warning Cron Core ---
async function runPredictionJob(currentTime: Date) {
  const currentTasks = await prisma.task.findMany();
  const triggered: any[] = [];

  for (const task of currentTasks) {
    // Only check leaf tasks
    const hasChildren = currentTasks.some((t) => t.parent_id === task.id);
    if (hasChildren || task.progress_rate >= 100) continue;

    const diffMs = new Date(task.deadline).getTime() - currentTime.getTime();
    const remainingHours = diffMs / (1000 * 60 * 60);

    const remainingMinutes = task.estimated_minutes * ((100 - task.progress_rate) / 100);
    const remainingWorkHours = remainingMinutes / 60;

    // Remaining Time < Remaining Work * 1.5
    const isYabai = remainingHours < remainingWorkHours * 1.5;

    if (isYabai && remainingHours > -48) {
      // Check if alert already exists in history
      const alreadyTriggered = fcmNotifications.some(
        (n) => n.taskTitle === task.title && !n.read
      );
      if (alreadyTriggered) continue;

      const message = `このままだと間に合いません！今すぐ『${task.title}』を始めましょう`;
      const notif = {
        id: "notif-" + Math.random().toString(36).substr(2, 9),
        taskTitle: task.title,
        message,
        timestamp: currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        read: false,
      };

      fcmNotifications.unshift(notif);
      triggered.push(notif);

      broadcast({
        type: "FCM_WARNING",
        notification: notif,
        message: `⚠️ FCM予測リマインダー: ${message}`
      });
    }
  }

  return triggered;
}

// Serve static React app built folder in production mode
app.use(express.static(path.join(__dirname, "dist")));

// Fallback to index.html for SPA Client routing (React Router)
app.use((req, res, next) => {
  // If request is for an API route, skip and return 404
  if (req.url.startsWith("/api/")) {
    return next();
  }
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// --- START SERVER & INTEGRATE WEBSOCKETS ---
const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });
const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  
  ws.send(JSON.stringify({
    type: "CONNECTION_SUCCESS",
    message: "WebSocket connection established with backend."
  }));

  ws.on("close", () => {
    clients.delete(ws);
  });
});

function broadcast(data: any) {
  const message = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}
