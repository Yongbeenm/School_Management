import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SchoolAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async student(studentId: string, schoolId: string) {
    const student = await this.prisma.student.findFirst({ where: { id: studentId, schoolId, deletedAt: null } });
    if (!student) throw new NotFoundException('Student was not found');
    return student;
  }

  async parent(parentId: string, schoolId: string) {
    const parent = await this.prisma.parent.findFirst({ where: { id: parentId, schoolId, deletedAt: null } });
    if (!parent) throw new NotFoundException('Parent was not found');
    return parent;
  }

  async staff(staffId: string, schoolId: string) {
    const staff = await this.prisma.staff.findFirst({ where: { id: staffId, schoolId, deletedAt: null } });
    if (!staff) throw new NotFoundException('Staff member was not found');
    return staff;
  }

  async academicYear(academicYearId: string, schoolId: string) {
    const year = await this.prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId } });
    if (!year) throw new NotFoundException('Academic year was not found');
    return year;
  }

  async grade(gradeId: string, schoolId: string) {
    const grade = await this.prisma.grade.findFirst({ where: { id: gradeId, schoolId, deletedAt: null } });
    if (!grade) throw new NotFoundException('Grade was not found');
    return grade;
  }

  async classSection(classSectionId: string, schoolId: string) {
    const classSection = await this.prisma.classSection.findFirst({
      where: { id: classSectionId, schoolId, deletedAt: null },
    });
    if (!classSection) throw new NotFoundException('Class was not found');
    return classSection;
  }

  async subject(subjectId: string, schoolId: string) {
    const subject = await this.prisma.subject.findFirst({ where: { id: subjectId, schoolId, deletedAt: null } });
    if (!subject) throw new NotFoundException('Subject was not found');
    return subject;
  }
}
