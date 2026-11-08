import * as argon2 from 'argon2';
import { AcademicYearStatus, AssignmentStatus, EnrollmentStatus, ExamStatus, NotificationType, PrismaClient, SemesterStatus, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

const firstNames = ['Alex', 'Avery', 'Bailey', 'Casey', 'Cameron', 'Dara', 'Emery', 'Hayden', 'Jamie', 'Jordan'];
const lastNames = ['Anderson', 'Brown', 'Chen', 'Davis', 'Garcia', 'Khan', 'Lee', 'Martin', 'Nguyen', 'Patel'];
const demoSubjects = [
  { code: 'DEMO-MATH', name: 'Mathematics', teacherCode: 'DEMO-T001', firstName: 'Avery', lastName: 'Sok', qualification: 'B.Ed. Mathematics' },
  { code: 'DEMO-ENG', name: 'English Language', teacherCode: 'DEMO-T002', firstName: 'Jordan', lastName: 'Kim', qualification: 'B.A. English' },
  { code: 'DEMO-SCI', name: 'Integrated Science', teacherCode: 'DEMO-T003', firstName: 'Morgan', lastName: 'Lim', qualification: 'B.Sc. Science Education' },
  { code: 'DEMO-HIST', name: 'History', teacherCode: 'DEMO-T004', firstName: 'Riley', lastName: 'Chan', qualification: 'B.A. History' },
  { code: 'DEMO-GEO', name: 'Geography', teacherCode: 'DEMO-T005', firstName: 'Taylor', lastName: 'Prak', qualification: 'B.A. Geography' },
  { code: 'DEMO-ICT', name: 'Information Technology', teacherCode: 'DEMO-T006', firstName: 'Kai', lastName: 'Vann', qualification: 'B.Sc. Computer Science' },
  { code: 'DEMO-ART', name: 'Visual Arts', teacherCode: 'DEMO-T007', firstName: 'Noah', lastName: 'Keo', qualification: 'B.A. Fine Arts' },
  { code: 'DEMO-PE', name: 'Physical Education', teacherCode: 'DEMO-T008', firstName: 'Sam', lastName: 'Roth', qualification: 'B.Ed. Physical Education' },
] as const;

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The demo seed is disabled in production. Use production onboarding instead.');
  }
  const demoPassword = process.env.DEMO_SEED_PASSWORD ?? 'ChangeMe123!';
  const school = await prisma.school.findUnique({ where: { code: 'DEFAULT' } });
  if (!school) throw new Error('The DEFAULT school was not found. Run the standard seed first.');

  const academicYear = await prisma.academicYear.upsert({
    where: { schoolId_name: { schoolId: school.id, name: 'Demo 2026–2027' } },
    update: { startsOn: new Date('2026-09-01'), endsOn: new Date('2027-06-30'), status: AcademicYearStatus.ACTIVE },
    create: {
      schoolId: school.id,
      name: 'Demo 2026–2027',
      startsOn: new Date('2026-09-01'),
      endsOn: new Date('2027-06-30'),
      status: AcademicYearStatus.ACTIVE,
    },
  });

  await prisma.academicYear.updateMany({
    where: { schoolId: school.id, id: { not: academicYear.id }, status: AcademicYearStatus.ACTIVE },
    data: { status: AcademicYearStatus.CLOSED },
  });

  const grade = await prisma.grade.upsert({
    where: { schoolId_code: { schoolId: school.id, code: 'DEMO-G10' } },
    update: { name: 'Demo Grade 10', sequence: 10, deletedAt: null },
    create: { schoolId: school.id, code: 'DEMO-G10', name: 'Demo Grade 10', sequence: 10 },
  });

  const classSection = await prisma.classSection.upsert({
    where: { academicYearId_gradeId_name: { academicYearId: academicYear.id, gradeId: grade.id, name: 'Demo A' } },
    update: { capacity: 120, deletedAt: null },
    create: { schoolId: school.id, academicYearId: academicYear.id, gradeId: grade.id, name: 'Demo A', capacity: 120 },
  });

  const room = await prisma.room.upsert({
    where: { schoolId_code: { schoolId: school.id, code: 'DEMO-R101' } },
    update: { name: 'Demo Room 101', capacity: 120, deletedAt: null },
    create: { schoolId: school.id, code: 'DEMO-R101', name: 'Demo Room 101', capacity: 120 },
  });

  const semester = await prisma.semester.upsert({
    where: { academicYearId_sequence: { academicYearId: academicYear.id, sequence: 1 } },
    update: { name: 'Demo Semester 1', startsOn: new Date('2026-09-01'), endsOn: new Date('2027-01-15'), status: SemesterStatus.ACTIVE },
    create: {
      academicYearId: academicYear.id,
      name: 'Demo Semester 1',
      sequence: 1,
      startsOn: new Date('2026-09-01'),
      endsOn: new Date('2027-01-15'),
      status: SemesterStatus.ACTIVE,
    },
  });

  for (const subjectDefinition of demoSubjects) {
    const subject = await prisma.subject.upsert({
      where: { schoolId_code: { schoolId: school.id, code: subjectDefinition.code } },
      update: { name: subjectDefinition.name, description: `Demo subject: ${subjectDefinition.name}`, deletedAt: null },
      create: { schoolId: school.id, code: subjectDefinition.code, name: subjectDefinition.name, description: `Demo subject: ${subjectDefinition.name}` },
    });
    const staff = await prisma.staff.upsert({
      where: { schoolId_employeeCode: { schoolId: school.id, employeeCode: subjectDefinition.teacherCode } },
      update: {
        firstName: subjectDefinition.firstName,
        lastName: subjectDefinition.lastName,
        email: `${subjectDefinition.teacherCode.toLowerCase()}@example.test`,
        department: 'Demo Academic Department',
        deletedAt: null,
      },
      create: {
        schoolId: school.id,
        employeeCode: subjectDefinition.teacherCode,
        firstName: subjectDefinition.firstName,
        lastName: subjectDefinition.lastName,
        email: `${subjectDefinition.teacherCode.toLowerCase()}@example.test`,
        department: 'Demo Academic Department',
      },
    });
    const teacher = await prisma.teacher.upsert({
      where: { staffId: staff.id },
      update: { specialization: subjectDefinition.name, qualifications: subjectDefinition.qualification },
      create: { staffId: staff.id, specialization: subjectDefinition.name, qualifications: subjectDefinition.qualification },
    });
    await prisma.teachingAssignment.upsert({
      where: { classSectionId_subjectId_semesterId: { classSectionId: classSection.id, subjectId: subject.id, semesterId: semester.id } },
      update: { teacherId: teacher.id, deletedAt: null },
      create: { schoolId: school.id, classSectionId: classSection.id, subjectId: subject.id, teacherId: teacher.id, semesterId: semester.id },
    });
  }

  await prisma.timetableEntry.deleteMany({
    where: { teachingAssignment: { classSectionId: classSection.id, semesterId: semester.id } },
  });
  const teachingAssignments = await prisma.teachingAssignment.findMany({
    where: { classSectionId: classSection.id, semesterId: semester.id, deletedAt: null },
    include: { subject: true },
    orderBy: { subject: { code: 'asc' } },
  });
  const timetableSlots = [
    ['MONDAY', '08:00', '09:00'], ['MONDAY', '10:00', '11:00'],
    ['TUESDAY', '08:00', '09:00'], ['TUESDAY', '10:00', '11:00'],
    ['WEDNESDAY', '08:00', '09:00'], ['WEDNESDAY', '10:00', '11:00'],
    ['THURSDAY', '08:00', '09:00'], ['FRIDAY', '08:00', '09:00'],
  ] as const;
  for (const [index, assignment] of teachingAssignments.entries()) {
    const [dayOfWeek, startTime, endTime] = timetableSlots[index]!;
    await prisma.timetableEntry.create({
      data: {
        schoolId: school.id,
        teachingAssignmentId: assignment.id,
        roomId: room.id,
        dayOfWeek,
        startTime: new Date(`1970-01-01T${startTime}:00.000Z`),
        endTime: new Date(`1970-01-01T${endTime}:00.000Z`),
      },
    });
  }

  for (let index = 1; index <= 100; index += 1) {
    const padded = String(index).padStart(3, '0');
    const student = await prisma.student.upsert({
      where: { schoolId_studentCode: { schoolId: school.id, studentCode: `DEMO-2026-${padded}` } },
      update: {
        firstName: firstNames[(index - 1) % firstNames.length],
        lastName: `${lastNames[Math.floor((index - 1) / firstNames.length) % lastNames.length]} ${padded}`,
        dateOfBirth: new Date(Date.UTC(2009 + (index % 3), index % 12, (index % 27) + 1)),
        gender: index % 2 ? 'FEMALE' : 'MALE',
        email: `demo.student${padded}@example.test`,
        phone: `555-01${padded}`,
        address: 'Demo address — replace before live use',
        status: 'ACTIVE',
        deletedAt: null,
      },
      create: {
        schoolId: school.id,
        studentCode: `DEMO-2026-${padded}`,
        firstName: firstNames[(index - 1) % firstNames.length],
        lastName: `${lastNames[Math.floor((index - 1) / firstNames.length) % lastNames.length]} ${padded}`,
        dateOfBirth: new Date(Date.UTC(2009 + (index % 3), index % 12, (index % 27) + 1)),
        gender: index % 2 ? 'FEMALE' : 'MALE',
        email: `demo.student${padded}@example.test`,
        phone: `555-01${padded}`,
        address: 'Demo address — replace before live use',
      },
    });

    await prisma.enrollment.upsert({
      where: { studentId_academicYearId: { studentId: student.id, academicYearId: academicYear.id } },
      update: { classSectionId: classSection.id, status: EnrollmentStatus.ACTIVE, leftOn: null },
      create: {
        schoolId: school.id,
        studentId: student.id,
        academicYearId: academicYear.id,
        classSectionId: classSection.id,
        enrolledOn: new Date('2026-09-01'),
        status: EnrollmentStatus.ACTIVE,
      },
    });
  }

  const attendanceAssignment = teachingAssignments.find((assignment) => assignment.subject.code === 'DEMO-MATH');
  const admin = await prisma.user.findUnique({ where: { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@school.local' } });
  const demoStudents = await prisma.student.findMany({
    where: { schoolId: school.id, studentCode: { startsWith: 'DEMO-2026-' }, deletedAt: null },
    orderBy: { studentCode: 'asc' },
    select: { id: true, firstName: true, lastName: true, studentCode: true },
  });
  if (attendanceAssignment && admin && demoStudents.length === 100) {
    const attendanceDate = new Date('2026-10-27');
    const session = await prisma.attendanceSession.upsert({
      where: { teachingAssignmentId_attendanceDate: { teachingAssignmentId: attendanceAssignment.id, attendanceDate } },
      update: { takenByUserId: admin.id, notes: 'Demo attendance register' },
      create: { schoolId: school.id, teachingAssignmentId: attendanceAssignment.id, takenByUserId: admin.id, attendanceDate, notes: 'Demo attendance register' },
    });
    await prisma.attendanceRecord.deleteMany({ where: { sessionId: session.id } });
    await prisma.attendanceRecord.createMany({
      data: demoStudents.map((student, index) => ({
        sessionId: session.id,
        studentId: student.id,
        status: index < 90 ? 'PRESENT' : index < 95 ? 'LATE' : index < 98 ? 'SICK' : 'ABSENT',
      })),
    });

    const existingHomework = await prisma.assignment.findFirst({ where: { schoolId: school.id, teachingAssignmentId: attendanceAssignment.id, title: 'Demo Algebra Practice' } });
    const homework = existingHomework
      ? await prisma.assignment.update({ where: { id: existingHomework.id }, data: { description: 'Complete the algebra practice questions for the demo class.', dueAt: new Date('2026-11-03T16:00:00.000Z'), maxScore: 20, status: AssignmentStatus.PUBLISHED, publishedAt: new Date('2026-10-25T08:00:00.000Z'), deletedAt: null } })
      : await prisma.assignment.create({ data: { schoolId: school.id, teachingAssignmentId: attendanceAssignment.id, title: 'Demo Algebra Practice', description: 'Complete the algebra practice questions for the demo class.', dueAt: new Date('2026-11-03T16:00:00.000Z'), maxScore: 20, status: AssignmentStatus.PUBLISHED, publishedAt: new Date('2026-10-25T08:00:00.000Z') } });
    for (const [index, student] of demoStudents.slice(0, 10).entries()) {
      await prisma.assignmentSubmission.upsert({
        where: { assignmentId_studentId: { assignmentId: homework.id, studentId: student.id } },
        update: { content: 'Demo submission', submittedAt: new Date('2026-11-01T10:00:00.000Z'), status: 'GRADED', score: 12 + index, feedback: 'Demo feedback', gradedAt: new Date('2026-11-02T10:00:00.000Z') },
        create: { assignmentId: homework.id, studentId: student.id, content: 'Demo submission', submittedAt: new Date('2026-11-01T10:00:00.000Z'), status: 'GRADED', score: 12 + index, feedback: 'Demo feedback', gradedAt: new Date('2026-11-02T10:00:00.000Z') },
      });
    }

    const scales = [
      { letter: 'A', minimum: 85, maximum: 100, gradePoint: 4 },
      { letter: 'B', minimum: 70, maximum: 84.99, gradePoint: 3 },
      { letter: 'C', minimum: 55, maximum: 69.99, gradePoint: 2 },
      { letter: 'D', minimum: 50, maximum: 54.99, gradePoint: 1 },
      { letter: 'F', minimum: 0, maximum: 49.99, gradePoint: 0 },
    ];
    for (const scale of scales) await prisma.gradingScale.upsert({ where: { schoolId_letter: { schoolId: school.id, letter: scale.letter } }, update: scale, create: { schoolId: school.id, ...scale } });

    const existingExam = await prisma.exam.findFirst({ where: { schoolId: school.id, semesterId: semester.id, name: 'Demo Midterm Assessment' } });
    const exam = existingExam
      ? await prisma.exam.update({ where: { id: existingExam.id }, data: { type: 'MIDTERM', startsOn: new Date('2026-11-10'), status: ExamStatus.PUBLISHED, publishedAt: new Date('2026-11-17T08:00:00.000Z'), deletedAt: null } })
      : await prisma.exam.create({ data: { schoolId: school.id, semesterId: semester.id, name: 'Demo Midterm Assessment', type: 'MIDTERM', startsOn: new Date('2026-11-10'), status: ExamStatus.PUBLISHED, publishedAt: new Date('2026-11-17T08:00:00.000Z') } });
    const examSubjects = [] as { id: string; maximumScore: number; weight: number; teachingAssignment: { subject: { name: string } } }[];
    for (const [subjectIndex, assignment] of teachingAssignments.entries()) {
      const row = await prisma.examSubject.upsert({
        where: { examId_teachingAssignmentId: { examId: exam.id, teachingAssignmentId: assignment.id } },
        update: { maximumScore: 100, weight: 1, scheduledAt: new Date(`2026-11-${String(10 + subjectIndex).padStart(2, '0')}T08:00:00.000Z`) },
        create: { examId: exam.id, teachingAssignmentId: assignment.id, maximumScore: 100, weight: 1, scheduledAt: new Date(`2026-11-${String(10 + subjectIndex).padStart(2, '0')}T08:00:00.000Z`) },
        include: { teachingAssignment: { include: { subject: true } } },
      });
      examSubjects.push(row);
      await Promise.all(demoStudents.map((student, studentIndex) => {
        const score = 55 + ((studentIndex * 7 + subjectIndex * 5) % 46);
        return prisma.mark.upsert({ where: { examSubjectId_studentId: { examSubjectId: row.id, studentId: student.id } }, update: { score, remarks: 'Demo midterm mark' }, create: { examSubjectId: row.id, studentId: student.id, score, remarks: 'Demo midterm mark' } });
      }));
    }
    for (const [studentIndex, student] of demoStudents.entries()) {
      const subjectResults = examSubjects.map((subject, subjectIndex) => {
        const score = 55 + ((studentIndex * 7 + subjectIndex * 5) % 46);
        const scale = scales.find((item) => score >= item.minimum && score <= item.maximum)!;
        return { subject: subject.teachingAssignment.subject.name, exam: exam.name, score, maximumScore: 100, weight: subject.weight, percentage: score, letter: scale.letter, gradePoint: scale.gradePoint };
      });
      const average = subjectResults.reduce((sum, item) => sum + item.percentage, 0) / subjectResults.length;
      const gpa = subjectResults.reduce((sum, item) => sum + item.gradePoint, 0) / subjectResults.length;
      await prisma.reportCard.upsert({
        where: { studentId_semesterId: { studentId: student.id, semesterId: semester.id } },
        update: { average, gpa, status: 'PUBLISHED', publishedAt: new Date('2026-11-17T09:00:00.000Z'), generatedAt: new Date('2026-11-17T09:00:00.000Z'), payload: { student: { id: student.id, code: student.studentCode, name: `${student.firstName} ${student.lastName}`, currentClass: 'Demo Grade 10 Demo A' }, academicYear: academicYear.name, semester: semester.name, subjects: subjectResults, average, gpa, attendance: { total: 1, present: studentIndex < 95 ? 1 : 0, percentage: studentIndex < 95 ? 100 : 0 } } },
        create: { schoolId: school.id, studentId: student.id, semesterId: semester.id, average, gpa, status: 'PUBLISHED', publishedAt: new Date('2026-11-17T09:00:00.000Z'), generatedAt: new Date('2026-11-17T09:00:00.000Z'), payload: { student: { id: student.id, code: student.studentCode, name: `${student.firstName} ${student.lastName}`, currentClass: 'Demo Grade 10 Demo A' }, academicYear: academicYear.name, semester: semester.name, subjects: subjectResults, average, gpa, attendance: { total: 1, present: studentIndex < 95 ? 1 : 0, percentage: studentIndex < 95 ? 100 : 0 } } },
      });
    }
  }

  const passwordHash = await argon2.hash(demoPassword, { type: argon2.argon2id });
  const teacherUser = await prisma.user.upsert({ where: { email: 'teacher.demo@school.local' }, update: { passwordHash, status: UserStatus.ACTIVE }, create: { email: 'teacher.demo@school.local', passwordHash, firstName: 'Avery', lastName: 'Sok', status: UserStatus.ACTIVE, isEmailVerified: true } });
  const studentUser = await prisma.user.upsert({ where: { email: 'student.demo@school.local' }, update: { passwordHash, status: UserStatus.ACTIVE }, create: { email: 'student.demo@school.local', passwordHash, firstName: demoStudents[0]?.firstName ?? 'Demo', lastName: demoStudents[0]?.lastName ?? 'Student', status: UserStatus.ACTIVE, isEmailVerified: true } });
  const parentUser = await prisma.user.upsert({ where: { email: 'parent.demo@school.local' }, update: { passwordHash, status: UserStatus.ACTIVE }, create: { email: 'parent.demo@school.local', passwordHash, firstName: 'Demo', lastName: 'Parent', status: UserStatus.ACTIVE, isEmailVerified: true } });
  const teacherRole = await prisma.role.findUniqueOrThrow({ where: { code: 'TEACHER' } }); const studentRole = await prisma.role.findUniqueOrThrow({ where: { code: 'STUDENT' } }); const parentRole = await prisma.role.findUniqueOrThrow({ where: { code: 'PARENT' } });
  for (const [user, role] of [[teacherUser, teacherRole], [studentUser, studentRole], [parentUser, parentRole]] as const) { await prisma.userSchool.upsert({ where: { userId_schoolId: { userId: user.id, schoolId: school.id } }, update: { isDefault: true }, create: { userId: user.id, schoolId: school.id, isDefault: true } }); await prisma.userRole.upsert({ where: { userId_roleId_schoolId: { userId: user.id, roleId: role.id, schoolId: school.id } }, update: {}, create: { userId: user.id, roleId: role.id, schoolId: school.id } }); }
  await prisma.staff.update({ where: { schoolId_employeeCode: { schoolId: school.id, employeeCode: 'DEMO-T001' } }, data: { userId: teacherUser.id } });
  if (demoStudents[0]) {
    await prisma.student.update({ where: { id: demoStudents[0].id }, data: { userId: studentUser.id } });
    const parent = await prisma.parent.findFirst({ where: { schoolId: school.id, email: 'parent.demo@school.local' } }) ?? await prisma.parent.create({ data: { schoolId: school.id, firstName: 'Demo', lastName: 'Parent', email: 'parent.demo@school.local', userId: parentUser.id } });
    if (parent.userId !== parentUser.id) await prisma.parent.update({ where: { id: parent.id }, data: { userId: parentUser.id } });
    await prisma.studentParent.upsert({ where: { studentId_parentId: { studentId: demoStudents[0].id, parentId: parent.id } }, update: { relationship: 'MOTHER', isPrimaryContact: true, isLegalGuardian: true }, create: { studentId: demoStudents[0].id, parentId: parent.id, relationship: 'MOTHER', isPrimaryContact: true, isLegalGuardian: true } });
  }
  // Development-only accounts make the eight official roles testable through real JWT sessions.
  const [adminRole, principalRole, accountantRole, librarianRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } }),
    prisma.role.findUniqueOrThrow({ where: { code: 'PRINCIPAL' } }),
    prisma.role.findUniqueOrThrow({ where: { code: 'ACCOUNTANT' } }),
    prisma.role.findUniqueOrThrow({ where: { code: 'LIBRARIAN' } }),
  ]);
  const createTestUser = async (email: string, firstName: string, lastName: string, roleId: string) => {
    const account = await prisma.user.upsert({ where: { email }, update: { passwordHash, status: UserStatus.ACTIVE, firstName, lastName, isEmailVerified: true }, create: { email, passwordHash, firstName, lastName, status: UserStatus.ACTIVE, isEmailVerified: true } });
    await prisma.userSchool.upsert({ where: { userId_schoolId: { userId: account.id, schoolId: school.id } }, update: { isDefault: true }, create: { userId: account.id, schoolId: school.id, isDefault: true } });
    await prisma.userRole.upsert({ where: { userId_roleId_schoolId: { userId: account.id, roleId, schoolId: school.id } }, update: {}, create: { userId: account.id, roleId, schoolId: school.id } });
    return account;
  };
  const [, teacherBUser, studentBUser, parentBUser] = await Promise.all([
    createTestUser('admin.demo@school.local', 'Ada', 'Administrator', adminRole.id),
    createTestUser('teacher.b.demo@school.local', 'Jordan', 'Kim', teacherRole.id),
    createTestUser('student.b.demo@school.local', demoStudents[1]?.firstName ?? 'Demo', demoStudents[1]?.lastName ?? 'Student B', studentRole.id),
    createTestUser('parent.b.demo@school.local', 'Demo', 'Parent B', parentRole.id),
    createTestUser('principal.demo@school.local', 'Priya', 'Principal', principalRole.id),
    createTestUser('accountant.demo@school.local', 'Ari', 'Accountant', accountantRole.id),
    createTestUser('librarian.demo@school.local', 'Lee', 'Librarian', librarianRole.id),
  ]);
  await prisma.staff.update({ where: { schoolId_employeeCode: { schoolId: school.id, employeeCode: 'DEMO-T002' } }, data: { userId: teacherBUser.id } });
  if (demoStudents[1]) {
    await prisma.student.update({ where: { id: demoStudents[1].id }, data: { userId: studentBUser.id } });
    const parentB = await prisma.parent.findFirst({ where: { schoolId: school.id, email: 'parent.b.demo@school.local' } }) ?? await prisma.parent.create({ data: { schoolId: school.id, firstName: 'Demo', lastName: 'Parent B', email: 'parent.b.demo@school.local', userId: parentBUser.id } });
    if (parentB.userId !== parentBUser.id) await prisma.parent.update({ where: { id: parentB.id }, data: { userId: parentBUser.id } });
    await prisma.studentParent.upsert({ where: { studentId_parentId: { studentId: demoStudents[1].id, parentId: parentB.id } }, update: { relationship: 'FATHER', isPrimaryContact: true, isLegalGuardian: true }, create: { studentId: demoStudents[1].id, parentId: parentB.id, relationship: 'FATHER', isPrimaryContact: true, isLegalGuardian: true } });
  }
  const announcement = await prisma.announcement.findFirst({ where: { schoolId: school.id, title: 'Welcome to Demo Semester 1' } });
  const publishedAnnouncement = announcement ? await prisma.announcement.update({ where: { id: announcement.id }, data: { content: 'Demo academic operations are ready: attendance, assignments, examinations, report cards, and role portals.', audience: 'ALL', deletedAt: null } }) : await prisma.announcement.create({ data: { schoolId: school.id, title: 'Welcome to Demo Semester 1', content: 'Demo academic operations are ready: attendance, assignments, examinations, report cards, and role portals.', audience: 'ALL' } });
  for (const user of [teacherUser, studentUser, parentUser]) {
    const existingNotification = await prisma.notification.findFirst({ where: { userId: user.id, referenceType: 'ANNOUNCEMENT', referenceId: publishedAnnouncement.id } });
    if (!existingNotification) await prisma.notification.create({ data: { userId: user.id, title: publishedAnnouncement.title, message: publishedAnnouncement.content, type: NotificationType.ANNOUNCEMENT, referenceType: 'ANNOUNCEMENT', referenceId: publishedAnnouncement.id } });
  }

  console.log('Demo seed complete: 100 students, rooms, timetable, attendance, assignments, marks, GPA report cards, announcements, and teacher/student/parent demo portals.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
