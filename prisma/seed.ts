import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Cleaning database...");
  await prisma.task.deleteMany({});
  await prisma.teamMember.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.user.deleteMany({});

  console.log("Seeding users...");
  const alice = await prisma.user.create({
    data: {
      id: "user-alice",
      name: "A君 (Alice)",
      email: "alice@univ.ac.jp",
      theme_color: "#ff4d6d",
    },
  });

  const bob = await prisma.user.create({
    data: {
      id: "user-bob",
      name: "Bさん (Bob)",
      email: "bob@univ.ac.jp",
      theme_color: "#06d6a0",
    },
  });

  const charlie = await prisma.user.create({
    data: {
      id: "user-charlie",
      name: "C君 (Charlie)",
      email: "charlie@univ.ac.jp",
      theme_color: "#7209b7",
    },
  });

  console.log("Seeding teams...");
  const teamSeminar = await prisma.team.create({
    data: {
      id: "team-seminar",
      team_name: "ゼミ共同発表課題",
    },
  });

  const teamCircle = await prisma.team.create({
    data: {
      id: "team-circle",
      team_name: "サークル広報局",
    },
  });

  console.log("Seeding team memberships...");
  await prisma.teamMember.createMany({
    data: [
      { team_id: teamSeminar.id, user_id: alice.id },
      { team_id: teamSeminar.id, user_id: bob.id },
      { team_id: teamSeminar.id, user_id: charlie.id },
      { team_id: teamCircle.id, user_id: alice.id },
      { team_id: teamCircle.id, user_id: bob.id },
    ],
  });

  console.log("Seeding tasks...");
  const baseTime = new Date();
  const oneDay = 24 * 60 * 60 * 1000;

  // --- Team Seminar Task Hierarchy ---
  // Level 1: Parent
  const seminarParent = await prisma.task.create({
    data: {
      id: "task-seminar-parent",
      title: "ゼミの共同発表資料作成",
      estimated_minutes: 330,
      progress_rate: 40,
      deadline: new Date(baseTime.getTime() + 2 * oneDay),
      team_id: teamSeminar.id,
    },
  });

  // Level 2: Children
  await prisma.task.create({
    data: {
      id: "task-seminar-child-docs",
      title: "文献調査・資料集め",
      parent_id: seminarParent.id,
      estimated_minutes: 120,
      progress_rate: 100,
      deadline: new Date(baseTime.getTime() + 1 * oneDay),
      team_id: teamSeminar.id,
      assigned_user_id: alice.id,
    },
  });

  await prisma.task.create({
    data: {
      id: "task-seminar-child-resume",
      title: "レジュメの印刷と製本",
      parent_id: seminarParent.id,
      estimated_minutes: 30,
      progress_rate: 0,
      deadline: new Date(baseTime.getTime() + 1.8 * oneDay),
      team_id: teamSeminar.id,
      assigned_user_id: bob.id,
    },
  });

  const seminarChildSlide = await prisma.task.create({
    data: {
      id: "task-seminar-child-slide",
      title: "スライド資料の執筆",
      parent_id: seminarParent.id,
      estimated_minutes: 180,
      progress_rate: 20,
      deadline: new Date(baseTime.getTime() + 2 * oneDay),
      team_id: teamSeminar.id,
    },
  });

  // Level 3: Subtasks for slide writing
  await prisma.task.create({
    data: {
      id: "task-seminar-sub-intro",
      title: "前半部分（イントロ・課題定義）",
      parent_id: seminarChildSlide.id,
      estimated_minutes: 90,
      progress_rate: 40,
      deadline: new Date(baseTime.getTime() + 1.5 * oneDay),
      team_id: teamSeminar.id,
      assigned_user_id: charlie.id,
    },
  });

  await prisma.task.create({
    data: {
      id: "task-seminar-sub-body",
      title: "後半部分（提案手法・評価）",
      parent_id: seminarChildSlide.id,
      estimated_minutes: 90,
      progress_rate: 0,
      deadline: new Date(baseTime.getTime() + 2 * oneDay),
      team_id: teamSeminar.id,
      assigned_user_id: charlie.id,
    },
  });

  // --- Personal Tasks for Alice ---
  const jobParent = await prisma.task.create({
    data: {
      id: "task-job-parent",
      title: "就活エントリーシート提出 (大手IT企業)",
      estimated_minutes: 150,
      progress_rate: 20,
      deadline: new Date(baseTime.getTime() + 0.8 * oneDay),
      assigned_user_id: alice.id,
    },
  });

  await prisma.task.create({
    data: {
      id: "task-job-draft",
      title: "自己PR의 添削依頼",
      parent_id: jobParent.id,
      estimated_minutes: 60,
      progress_rate: 50,
      deadline: new Date(baseTime.getTime() + 0.4 * oneDay),
      assigned_user_id: alice.id,
    },
  });

  await prisma.task.create({
    data: {
      id: "task-job-reason",
      title: "志望動機の推敲",
      parent_id: jobParent.id,
      estimated_minutes: 90,
      progress_rate: 0,
      deadline: new Date(baseTime.getTime() + 0.8 * oneDay),
      assigned_user_id: alice.id,
    },
  });

  // --- Circle Tasks ---
  const circleParent = await prisma.task.create({
    data: {
      id: "task-circle-parent",
      title: "夏合宿の案内チラシ作成",
      estimated_minutes: 180,
      progress_rate: 60,
      deadline: new Date(baseTime.getTime() + 5 * oneDay),
      team_id: teamCircle.id,
    },
  });

  await prisma.task.create({
    data: {
      id: "task-circle-design",
      title: "デザイン原案作成",
      parent_id: circleParent.id,
      estimated_minutes: 120,
      progress_rate: 90,
      deadline: new Date(baseTime.getTime() + 3 * oneDay),
      team_id: teamCircle.id,
      assigned_user_id: bob.id,
    },
  });

  await prisma.task.create({
    data: {
      id: "task-circle-print",
      title: "部室での配布と掲示",
      parent_id: circleParent.id,
      estimated_minutes: 60,
      progress_rate: 0,
      deadline: new Date(baseTime.getTime() + 5 * oneDay),
      team_id: teamCircle.id,
      assigned_user_id: alice.id,
    },
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
