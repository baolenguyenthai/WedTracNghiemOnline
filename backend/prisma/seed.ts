import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = "Admin@12345";
  const studentPassword = "Student@12345";

  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: {
      name: "ADMIN"
    }
  });

  const userRole = await prisma.role.upsert({
    where: { name: "USER" },
    update: {},
    create: {
      name: "USER"
    }
  });

  const [admin, student] = await Promise.all([
    prisma.user.upsert({
      where: { username: "admin" },
      update: {},
      create: {
        username: "admin",
        passwordHash: adminPassword,
        fullName: "Quản trị viên",
        email: "admin@example.com",
        vaiTroId: adminRole.id,
        status: 1
      }
    }),
    prisma.user.upsert({
      where: { username: "student" },
      update: {},
      create: {
        username: "student",
        passwordHash: studentPassword,
        fullName: "Người học mẫu",
        email: "student@example.com",
        vaiTroId: userRole.id,
        status: 1
      }
    })
  ]);

  const gradeNames = ["Lớp 1", "Lớp 2", "Lớp 3", "Lớp 4", "Lớp 5", "Lớp 6", "Lớp 7", "Lớp 8", "Lớp 9", "Lớp 10", "Lớp 11", "Lớp 12"];
  const subjectNames = ["Toán", "Ngữ văn", "Tiếng Anh", "Vật lý", "Hóa học", "Sinh học", "Lịch sử", "Địa lý", "Tin học", "GDCD"];

  for (const name of gradeNames) {
    await prisma.grade.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  for (const name of subjectNames) {
    await prisma.subject.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  const grade10 = await prisma.grade.findUnique({ where: { name: "Lớp 10" } });
  const math = await prisma.subject.findUnique({ where: { name: "Toán" } });
  if (!grade10 || !math) {
    return;
  }

  const bank = await prisma.questionBank.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "Bộ câu hỏi toán cơ bản",
      description: "Bộ đề mẫu để kiểm thử web trắc nghiệm",
      gradeId: grade10.id,
      subjectId: math.id,
      creatorId: admin.id,
      status: "DA_DUYET",
      isPublic: true,
      defaultQuestionCount: 5,
      defaultDurationMinutes: 15
    }
  });

  const existingQuestions = await prisma.question.count({ where: { bankId: bank.id } });
  if (existingQuestions === 0) {
    const questions = [
      {
        content: "2 + 2 bằng bao nhiêu?",
        difficulty: "DE",
        answers: [
          { content: "3", isCorrect: false },
          { content: "4", isCorrect: true },
          { content: "5", isCorrect: false },
          { content: "6", isCorrect: false }
        ]
      },
      {
        content: "Giá trị của 3 x 5 là gì?",
        difficulty: "DE",
        answers: [
          { content: "8", isCorrect: false },
          { content: "10", isCorrect: false },
          { content: "15", isCorrect: true },
          { content: "20", isCorrect: false }
        ]
      },
      {
        content: "Số nào là số nguyên tố?",
        difficulty: "TB",
        answers: [
          { content: "21", isCorrect: false },
          { content: "27", isCorrect: false },
          { content: "29", isCorrect: true },
          { content: "35", isCorrect: false }
        ]
      }
    ];

    for (const q of questions) {
      const question = await prisma.question.create({
        data: {
          bankId: bank.id,
          content: q.content,
          difficulty: q.difficulty
        }
      });

      for (const answer of q.answers) {
        await prisma.answer.create({
          data: {
            questionId: question.id,
            content: answer.content,
            isCorrect: answer.isCorrect
          }
        });
      }
    }
  }

  await prisma.favoriteQuestion.upsert({
    where: { userId_questionId: { userId: student.id, questionId: 1 } },
    update: {},
    create: {
      userId: student.id,
      questionId: 1
    }
  }).catch(() => void 0);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
