'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckSquare, FlaskConical, LogIn } from 'lucide-react';
import { Card, PageHeader } from '@/components/admin/page-header';

const accounts = [
  ['Super Admin', 'admin@school.local', 'Platform and school administration'],
  ['Admin', 'admin.demo@school.local', 'School operational administration'],
  ['Principal', 'principal.demo@school.local', 'Read/review and report-card approval'],
  ['Teacher A', 'teacher.demo@school.local', 'Mathematics class subject'],
  ['Teacher B', 'teacher.b.demo@school.local', 'English class subject'],
  ['Student A', 'student.demo@school.local', 'First demo learner'],
  ['Student B', 'student.b.demo@school.local', 'Second demo learner'],
  ['Parent A', 'parent.demo@school.local', 'Linked to Student A'],
  ['Parent B', 'parent.b.demo@school.local', 'Linked to Student B'],
  ['Accountant', 'accountant.demo@school.local', 'Finance-limited access'],
  ['Librarian', 'librarian.demo@school.local', 'Library-limited access'],
] as const;

const checks = [
  'Admin creates a student, guardian, enrollment, class subject, timetable entry, assignment, and exam.',
  'Teacher opens assigned timetable, takes attendance, creates an assignment, grades a submission, and enters marks.',
  'Student views own timetable, attendance, assignments, published results/GPA, report card, and submits work.',
  'Parent views only the linked child’s attendance, work, results, GPA, and report card.',
  'Principal reviews the admin dashboard and approves a published report card.',
  'Notifications show and can be marked read.',
] as const;

export default function DevelopmentTestAccountsPage() {
  const [complete, setComplete] = useState<Record<number, boolean>>({});
  if (process.env.NODE_ENV === 'production') return null;
  return <main className="min-h-screen bg-slate-50 p-5 md:p-8"><div className="mx-auto max-w-5xl"><PageHeader title="Development test accounts" description="Development-only real accounts for testing Version 2 through the browser. This route is removed from production builds." action={<Link className="inline-flex h-10 items-center rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800" href="/auth/login"><LogIn className="mr-2" size={16}/>Open login</Link>} /><Card><div className="flex items-start gap-3"><FlaskConical className="mt-0.5 text-teal-700" size={20}/><div><h2 className="font-semibold">Local demo seed required</h2><p className="mt-1 text-sm text-slate-600">Run <code>npm run seed:demo --workspace @school/database</code> locally. The password is set by <code>DEMO_SEED_PASSWORD</code>; the local development fallback is documented in the project’s development accounts guide.</p></div></div></Card><section className="mt-6 grid gap-5 lg:grid-cols-2">{accounts.map(([role, email, note]) => <Card key={email}><p className="text-xs font-bold tracking-wide text-teal-700">{role.toUpperCase()}</p><h2 className="mt-2 font-semibold text-slate-900">{email}</h2><p className="mt-2 text-sm text-slate-600">{note}</p></Card>)}</section><section className="mt-6"><Card><div className="flex items-center gap-2"><CheckSquare className="text-teal-700" size={20}/><h2 className="font-semibold">Browser test checklist</h2></div><div className="mt-4 grid gap-3">{checks.map((label, index) => <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700" key={label}><input checked={Boolean(complete[index])} className="mt-0.5" onChange={(event) => setComplete((current) => ({ ...current, [index]: event.target.checked }))} type="checkbox"/><span>{label}</span></label>)}</div></Card></section></div></main>;
}
