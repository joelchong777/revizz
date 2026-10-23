'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Users,
  GraduationCap,
  Calendar,
  Search,
  Filter,
  Plus,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Edit3,
  Trash2,
  Clock,
  ShieldCheck,
  Award,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  X,
  Save,
  CheckCircle2,
  ArrowUpRight,
  BookOpen,
  UserCheck,
  Mail,
  HelpCircle,
  Download,
} from 'lucide-react';

export type LicenseStatus =
  | 'Active'
  | 'Trial'
  | 'Expiring Soon'
  | 'Expired'
  | 'Suspended'
  | 'Pending Activation';

export type AccountTier =
  | 'Standard Educator'
  | 'Department Pro'
  | 'Enterprise Campus'
  | 'Pilot'
  | 'Institution Unlimited';

export interface SchoolCohort {
  id: string;
  name: string;
  subjectCode: string;
  department: string;
  studentCount: number;
  assignedTeacher: string;
  term: string;
}

export interface SchoolEducator {
  id: string;
  name: string;
  email: string;
  department: string;
  role: 'Teacher (Read-Only Bank)' | 'App Admin (Full Edit)' | 'Department Head';
  status: 'Active' | 'Invited';
}

export interface SchoolLicense {
  id: string;
  name: string;
  contactEmail: string;
  departmentScope: string;
  licenseNumber: string;
  tier: AccountTier;
  studentSeatQuota: number;
  educatorSlotLimit: number;
  status: LicenseStatus;
  startDate: string;
  endDate: string;
  notes?: string;
  cohorts: SchoolCohort[];
  educators: SchoolEducator[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'revizz_admin_school_licenses_v1';

export function generateLicenseNumber(): string {
  const year = new Date().getFullYear();
  const randomCode = Math.floor(10000 + Math.random() * 90000);
  return `RVZ-${year}-${randomCode}`;
}

export function getDaysRemaining(endDateStr: string): number {
  if (!endDateStr) return 0;
  const target = new Date(endDateStr).getTime();
  const now = new Date().getTime();
  const diffMs = target - now;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getEffectiveStatus(license: SchoolLicense): LicenseStatus {
  if (license.status === 'Suspended') return 'Suspended';
  if (license.status === 'Pending Activation') return 'Pending Activation';
  const days = getDaysRemaining(license.endDate);
  if (days < 0) return 'Expired';
  if (days <= 30 && license.status !== 'Trial') return 'Expiring Soon';
  return license.status;
}

const INITIAL_SEEDED_LICENSES: SchoolLicense[] = [
  {
    id: 'lic-oakridge-01',
    name: 'Oakridge International College',
    contactEmail: 'admin@oakridgecollege.org',
    departmentScope: 'Senior Campus & Cambridge Centre',
    licenseNumber: 'RVZ-2026-88412',
    tier: 'Enterprise Campus',
    studentSeatQuota: 500,
    educatorSlotLimit: 25,
    status: 'Active',
    startDate: '2026-01-01',
    endDate: '2027-06-30',
    notes: 'Purchase Order #PO-2026-OKRDG. Includes Cambridge Physics & Economics syllabi.',
    cohorts: [
      {
        id: 'coh-oak-01',
        name: '12A Pure Mathematics',
        subjectCode: '0580',
        department: 'Mathematics',
        studentCount: 28,
        assignedTeacher: 'H. Sterling',
        term: '2026-2027 Session',
      },
      {
        id: 'coh-oak-02',
        name: '11B Physics Mechanics',
        subjectCode: '0625',
        department: 'Physics',
        studentCount: 24,
        assignedTeacher: 'E. Thorne',
        term: '2026-2027 Session',
      },
      {
        id: 'coh-oak-03',
        name: '10C Organic Chemistry',
        subjectCode: '0620',
        department: 'Chemistry',
        studentCount: 26,
        assignedTeacher: 'R. Kovacs',
        term: '2026-2027 Session',
      },
      {
        id: 'coh-oak-04',
        name: '12B Microeconomics',
        subjectCode: '0455',
        department: 'Economics',
        studentCount: 22,
        assignedTeacher: 'L. Chen',
        term: '2026-2027 Session',
      },
    ],
    educators: [
      {
        id: 'ed-oak-01',
        name: 'H. Sterling',
        email: 'h.sterling@oakridgecollege.org',
        department: 'Mathematics',
        role: 'Department Head',
        status: 'Active',
      },
      {
        id: 'ed-oak-02',
        name: 'E. Thorne',
        email: 'e.thorne@oakridgecollege.org',
        department: 'Physics',
        role: 'Teacher (Read-Only Bank)',
        status: 'Active',
      },
      {
        id: 'ed-oak-03',
        name: 'R. Kovacs',
        email: 'r.kovacs@oakridgecollege.org',
        department: 'Chemistry',
        role: 'Teacher (Read-Only Bank)',
        status: 'Active',
      },
      {
        id: 'ed-oak-04',
        name: 'L. Chen',
        email: 'l.chen@oakridgecollege.org',
        department: 'Economics',
        role: 'Teacher (Read-Only Bank)',
        status: 'Active',
      },
      {
        id: 'ed-oak-05',
        name: 'C. Bennett',
        email: 'c.bennett@oakridgecollege.org',
        department: 'Academic Affairs',
        role: 'App Admin (Full Edit)',
        status: 'Active',
      },
    ],
    createdAt: '2026-01-01T08:00:00Z',
    updatedAt: '2026-01-15T10:30:00Z',
  },
  {
    id: 'lic-westlake-02',
    name: 'Westlake Science Academy',
    contactEmail: 'headmaster@westlakescience.edu.sg',
    departmentScope: 'Secondary STEM Division',
    licenseNumber: 'RVZ-2026-31904',
    tier: 'Department Pro',
    studentSeatQuota: 300,
    educatorSlotLimit: 15,
    status: 'Active',
    startDate: '2026-01-10',
    endDate: '2026-12-31',
    notes: 'Contract Ref #SG-WSTLK-991. Accelerated science track.',
    cohorts: [
      {
        id: 'coh-wst-01',
        name: 'Sec 4 Accelerated Physics',
        subjectCode: '0625',
        department: 'Physics',
        studentCount: 30,
        assignedTeacher: 'K. Arisawa',
        term: '2026 Academic Year',
      },
      {
        id: 'coh-wst-02',
        name: 'Sec 3 Advanced Chemistry',
        subjectCode: '0620',
        department: 'Chemistry',
        studentCount: 28,
        assignedTeacher: 'P. Nair',
        term: '2026 Academic Year',
      },
      {
        id: 'coh-wst-03',
        name: 'Sec 4 Molecular Biology',
        subjectCode: '0610',
        department: 'Biology',
        studentCount: 26,
        assignedTeacher: 'J. Holloway',
        term: '2026 Academic Year',
      },
    ],
    educators: [
      {
        id: 'ed-wst-01',
        name: 'K. Arisawa',
        email: 'k.arisawa@westlakescience.edu.sg',
        department: 'Physics',
        role: 'Department Head',
        status: 'Active',
      },
      {
        id: 'ed-wst-02',
        name: 'P. Nair',
        email: 'p.nair@westlakescience.edu.sg',
        department: 'Chemistry',
        role: 'Teacher (Read-Only Bank)',
        status: 'Active',
      },
      {
        id: 'ed-wst-03',
        name: 'J. Holloway',
        email: 'j.holloway@westlakescience.edu.sg',
        department: 'Biology',
        role: 'Teacher (Read-Only Bank)',
        status: 'Active',
      },
    ],
    createdAt: '2026-01-10T09:15:00Z',
    updatedAt: '2026-02-01T14:20:00Z',
  },
  {
    id: 'lic-augustine-03',
    name: 'St. Augustine Collegiate',
    contactEmail: 'registry@staugustinecollegiate.ac.uk',
    departmentScope: 'Sixth Form College',
    licenseNumber: 'RVZ-2026-10492',
    tier: 'Standard Educator',
    studentSeatQuota: 150,
    educatorSlotLimit: 8,
    status: 'Expiring Soon',
    startDate: '2025-11-15',
    endDate: '2026-11-15',
    notes: 'Renewal discussions in progress with bursar office.',
    cohorts: [
      {
        id: 'coh-aug-01',
        name: 'Year 12 Economics Core',
        subjectCode: '0455',
        department: 'Economics',
        studentCount: 35,
        assignedTeacher: 'T. Al-Mansoor',
        term: 'Michaelmas Term 2026',
      },
      {
        id: 'coh-aug-02',
        name: 'Year 13 Applied Mechanics',
        subjectCode: '0625',
        department: 'Physics',
        studentCount: 28,
        assignedTeacher: 'F. Dubois',
        term: 'Michaelmas Term 2026',
      },
    ],
    educators: [
      {
        id: 'ed-aug-01',
        name: 'T. Al-Mansoor',
        email: 't.mansoor@staugustinecollegiate.ac.uk',
        department: 'Economics',
        role: 'App Admin (Full Edit)',
        status: 'Active',
      },
      {
        id: 'ed-aug-02',
        name: 'F. Dubois',
        email: 'f.dubois@staugustinecollegiate.ac.uk',
        department: 'Physics',
        role: 'Teacher (Read-Only Bank)',
        status: 'Active',
      },
    ],
    createdAt: '2025-11-15T11:00:00Z',
    updatedAt: '2026-03-01T08:00:00Z',
  },
  {
    id: 'lic-apex-04',
    name: 'Apex STEM Institute',
    contactEmail: 'director@apexsteminstitute.org',
    departmentScope: 'Regional Innovation Campus',
    licenseNumber: 'RVZ-2026-75199',
    tier: 'Institution Unlimited',
    studentSeatQuota: 1000,
    educatorSlotLimit: 50,
    status: 'Active',
    startDate: '2026-02-01',
    endDate: '2028-08-31',
    notes: 'Multi-year enterprise grant. Full Cambridge IGCSE bank access.',
    cohorts: [
      {
        id: 'coh-apx-01',
        name: 'Batch Alpha Robotics & Physics',
        subjectCode: '0625',
        department: 'Engineering',
        studentCount: 42,
        assignedTeacher: "B. O'Connor",
        term: 'Fall Cohort 2026',
      },
      {
        id: 'coh-apx-02',
        name: 'Batch Beta Quantitative Econ',
        subjectCode: '0455',
        department: 'Economics',
        studentCount: 38,
        assignedTeacher: 'N. Gupta',
        term: 'Fall Cohort 2026',
      },
    ],
    educators: [
      {
        id: 'ed-apx-01',
        name: "B. O'Connor",
        email: 'b.oconnor@apexsteminstitute.org',
        department: 'Engineering',
        role: 'Department Head',
        status: 'Active',
      },
      {
        id: 'ed-apx-02',
        name: 'N. Gupta',
        email: 'n.gupta@apexsteminstitute.org',
        department: 'Economics',
        role: 'Teacher (Read-Only Bank)',
        status: 'Active',
      },
      {
        id: 'ed-apx-03',
        name: 'S. Lindqvist',
        email: 's.lindqvist@apexsteminstitute.org',
        department: 'Technology',
        role: 'App Admin (Full Edit)',
        status: 'Active',
      },
    ],
    createdAt: '2026-02-01T12:00:00Z',
    updatedAt: '2026-02-15T16:00:00Z',
  },
];

export default function SchoolLicenseManager() {
  const [licenses, setLicenses] = useState<SchoolLicense[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [tierFilter, setTierFilter] = useState<string>('All');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal / Drill-down state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<SchoolLicense | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [schoolToEdit, setSchoolToEdit] = useState<SchoolLicense | null>(null);

  // New License Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formScope, setFormScope] = useState('All Campuses');
  const [formLicenseNum, setFormLicenseNum] = useState('');
  const [formTier, setFormTier] = useState<AccountTier>('Department Pro');
  const [formSeatQuota, setFormSeatQuota] = useState(300);
  const [formEducatorLimit, setFormEducatorLimit] = useState(15);
  const [formStatus, setFormStatus] = useState<LicenseStatus>('Active');
  const [formEndDate, setFormEndDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Drill-down Cohort Form State
  const [showAddCohort, setShowAddCohort] = useState(false);
  const [cohortName, setCohortName] = useState('');
  const [cohortSubject, setCohortSubject] = useState('0625 Physics');
  const [cohortDept, setCohortDept] = useState('Physics');
  const [cohortStudents, setCohortStudents] = useState(25);
  const [cohortTeacher, setCohortTeacher] = useState('');
  const [cohortTerm, setCohortTerm] = useState('2026-2027 Session');

  // Drill-down Educator Form State
  const [showAddEducator, setShowAddEducator] = useState(false);
  const [educatorName, setEducatorName] = useState('');
  const [educatorEmail, setEducatorEmail] = useState('');
  const [educatorDept, setEducatorDept] = useState('Physics');
  const [educatorRole, setEducatorRole] = useState<'Teacher (Read-Only Bank)' | 'App Admin (Full Edit)' | 'Department Head'>('Teacher (Read-Only Bank)');

  // Load from LocalStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLicenses(parsed);
          setIsLoaded(true);
          return;
        }
      }
      // If empty or invalid, seed with clean realistic data
      setLicenses(INITIAL_SEEDED_LICENSES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEEDED_LICENSES));
    } catch {
      setLicenses(INITIAL_SEEDED_LICENSES);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save to LocalStorage helper
  const persistLicenses = (updated: SchoolLicense[]) => {
    setLicenses(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save school licenses:', e);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const copyToClipboard = (text: string, id: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(id);
      showToast(`Copied license ${text} to clipboard!`);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  // Preset Date Formatter helper
  const addMonthsToDate = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
  };

  const openCreateModal = () => {
    setFormName('');
    setFormEmail('');
    setFormScope('All Campuses & Departments');
    setFormLicenseNum(generateLicenseNumber());
    setFormTier('Department Pro');
    setFormSeatQuota(350);
    setFormEducatorLimit(15);
    setFormStatus('Active');
    setFormEndDate(addMonthsToDate(12));
    setFormNotes('');
    setIsCreateModalOpen(true);
  };

  const handleCreateLicense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      showToast('School Name and Contact Email are required.');
      return;
    }

    const newLic: SchoolLicense = {
      id: `lic-${Date.now()}`,
      name: formName.trim(),
      contactEmail: formEmail.trim(),
      departmentScope: formScope.trim() || 'General Campus',
      licenseNumber: formLicenseNum.trim() || generateLicenseNumber(),
      tier: formTier,
      studentSeatQuota: Number(formSeatQuota) || 100,
      educatorSlotLimit: Number(formEducatorLimit) || 10,
      status: formStatus,
      startDate: new Date().toISOString().split('T')[0],
      endDate: formEndDate || addMonthsToDate(12),
      notes: formNotes.trim(),
      cohorts: [],
      educators: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextLicenses = [newLic, ...licenses];
    persistLicenses(nextLicenses);
    setIsCreateModalOpen(false);
    showToast(`✓ Issued new license for ${newLic.name}!`);
  };

  const openEditModal = (school: SchoolLicense) => {
    setSchoolToEdit(school);
    setFormName(school.name);
    setFormEmail(school.contactEmail);
    setFormScope(school.departmentScope);
    setFormLicenseNum(school.licenseNumber);
    setFormTier(school.tier);
    setFormSeatQuota(school.studentSeatQuota);
    setFormEducatorLimit(school.educatorSlotLimit);
    setFormStatus(school.status);
    setFormEndDate(school.endDate);
    setFormNotes(school.notes || '');
    setIsEditModalOpen(true);
  };

  const handleUpdateLicense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolToEdit) return;

    const updated = licenses.map((lic) => {
      if (lic.id === schoolToEdit.id) {
        return {
          ...lic,
          name: formName.trim(),
          contactEmail: formEmail.trim(),
          departmentScope: formScope.trim(),
          licenseNumber: formLicenseNum.trim(),
          tier: formTier,
          studentSeatQuota: Number(formSeatQuota) || 100,
          educatorSlotLimit: Number(formEducatorLimit) || 10,
          status: formStatus,
          endDate: formEndDate,
          notes: formNotes.trim(),
          updatedAt: new Date().toISOString(),
        };
      }
      return lic;
    });

    persistLicenses(updated);
    if (selectedSchool?.id === schoolToEdit.id) {
      const refreshed = updated.find((l) => l.id === schoolToEdit.id) || null;
      setSelectedSchool(refreshed);
    }
    setIsEditModalOpen(false);
    setSchoolToEdit(null);
    showToast(`✓ Saved settings for ${formName.trim()}`);
  };

  const handleDeleteLicense = (id: string, name: string) => {
    if (typeof window !== 'undefined' && !window.confirm(`Are you sure you want to delete the license for "${name}"? This will revoke all student cohorts and educator seats.`)) {
      return;
    }
    const filtered = licenses.filter((l) => l.id !== id);
    persistLicenses(filtered);
    if (selectedSchool?.id === id) {
      setSelectedSchool(null);
    }
    showToast(`Deleted license for ${name}`);
  };

  const handleRenewOneYear = (school: SchoolLicense) => {
    const curEnd = new Date(school.endDate);
    const validEnd = isNaN(curEnd.getTime()) ? new Date() : curEnd;
    validEnd.setFullYear(validEnd.getFullYear() + 1);
    const newEndStr = validEnd.toISOString().split('T')[0];

    const updated = licenses.map((l) => {
      if (l.id === school.id) {
        return {
          ...l,
          endDate: newEndStr,
          status: 'Active' as LicenseStatus,
          updatedAt: new Date().toISOString(),
        };
      }
      return l;
    });

    persistLicenses(updated);
    if (selectedSchool?.id === school.id) {
      const refreshed = updated.find((l) => l.id === school.id) || null;
      setSelectedSchool(refreshed);
    }
    showToast(`✓ License renewed for 1 year! Valid until ${newEndStr}`);
  };

  const handleResetData = () => {
    if (typeof window !== 'undefined' && !window.confirm('Reset all school licenses to default certified institutions?')) {
      return;
    }
    persistLicenses(INITIAL_SEEDED_LICENSES);
    setSelectedSchool(null);
    showToast('Reset school licenses to default seed data.');
  };

  // Cohort Management inside Drill-Down
  const handleAddCohortToSchool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool || !cohortName.trim()) return;

    const newCoh: SchoolCohort = {
      id: `coh-${Date.now()}`,
      name: cohortName.trim(),
      subjectCode: cohortSubject.split(' ')[0] || '0625',
      department: cohortDept,
      studentCount: Number(cohortStudents) || 0,
      assignedTeacher: cohortTeacher.trim() || 'Lead Instructor',
      term: cohortTerm.trim() || '2026-2027 Session',
    };

    const updatedSchool: SchoolLicense = {
      ...selectedSchool,
      cohorts: [...selectedSchool.cohorts, newCoh],
      updatedAt: new Date().toISOString(),
    };

    const nextList = licenses.map((l) => (l.id === selectedSchool.id ? updatedSchool : l));
    persistLicenses(nextList);
    setSelectedSchool(updatedSchool);
    setCohortName('');
    setShowAddCohort(false);
    showToast(`✓ Added cohort "${newCoh.name}" (+${newCoh.studentCount} seats)`);
  };

  const handleRemoveCohortFromSchool = (cohortId: string) => {
    if (!selectedSchool) return;
    const target = selectedSchool.cohorts.find((c) => c.id === cohortId);
    const nextCohorts = selectedSchool.cohorts.filter((c) => c.id !== cohortId);
    const updatedSchool: SchoolLicense = {
      ...selectedSchool,
      cohorts: nextCohorts,
      updatedAt: new Date().toISOString(),
    };

    const nextList = licenses.map((l) => (l.id === selectedSchool.id ? updatedSchool : l));
    persistLicenses(nextList);
    setSelectedSchool(updatedSchool);
    showToast(`Removed cohort "${target?.name || ''}"`);
  };

  // Educator Management inside Drill-Down
  const handleAddEducatorToSchool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool || !educatorName.trim() || !educatorEmail.trim()) return;

    const newEd: SchoolEducator = {
      id: `ed-${Date.now()}`,
      name: educatorName.trim(),
      email: educatorEmail.trim(),
      department: educatorDept.trim() || 'Science',
      role: educatorRole,
      status: 'Active',
    };

    const updatedSchool: SchoolLicense = {
      ...selectedSchool,
      educators: [...selectedSchool.educators, newEd],
      updatedAt: new Date().toISOString(),
    };

    const nextList = licenses.map((l) => (l.id === selectedSchool.id ? updatedSchool : l));
    persistLicenses(nextList);
    setSelectedSchool(updatedSchool);
    setEducatorName('');
    setEducatorEmail('');
    setShowAddEducator(false);
    showToast(`✓ Invited educator ${newEd.name}`);
  };

  const handleRemoveEducatorFromSchool = (educatorId: string) => {
    if (!selectedSchool) return;
    const target = selectedSchool.educators.find((e) => e.id === educatorId);
    const nextEds = selectedSchool.educators.filter((e) => e.id !== educatorId);
    const updatedSchool: SchoolLicense = {
      ...selectedSchool,
      educators: nextEds,
      updatedAt: new Date().toISOString(),
    };

    const nextList = licenses.map((l) => (l.id === selectedSchool.id ? updatedSchool : l));
    persistLicenses(nextList);
    setSelectedSchool(updatedSchool);
    showToast(`Revoked seat for ${target?.name || ''}`);
  };

  // KPI Computations
  const stats = useMemo(() => {
    const totalSchools = licenses.length;
    let totalUtilizedSeats = 0;
    let totalSeatQuota = 0;
    let totalEducators = 0;
    let totalEducatorSlots = 0;
    let activeCount = 0;
    let expiringCount = 0;
    let trialCount = 0;
    let expiredCount = 0;

    licenses.forEach((lic) => {
      const seatsInCohorts = lic.cohorts.reduce((sum, c) => sum + (c.studentCount || 0), 0);
      totalUtilizedSeats += seatsInCohorts;
      totalSeatQuota += lic.studentSeatQuota || 0;
      totalEducators += lic.educators.length;
      totalEducatorSlots += lic.educatorSlotLimit || 0;

      const eff = getEffectiveStatus(lic);
      if (eff === 'Active') activeCount++;
      else if (eff === 'Expiring Soon') expiringCount++;
      else if (eff === 'Trial') trialCount++;
      else if (eff === 'Expired') expiredCount++;
    });

    const seatPercent = totalSeatQuota > 0 ? Math.round((totalUtilizedSeats / totalSeatQuota) * 100) : 0;
    const educatorPercent = totalEducatorSlots > 0 ? Math.round((totalEducators / totalEducatorSlots) * 100) : 0;

    return {
      totalSchools,
      totalUtilizedSeats,
      totalSeatQuota,
      seatPercent,
      totalEducators,
      totalEducatorSlots,
      educatorPercent,
      activeCount,
      expiringCount,
      trialCount,
      expiredCount,
    };
  }, [licenses]);

  // Filtering
  const filteredLicenses = useMemo(() => {
    return licenses.filter((lic) => {
      const effStatus = getEffectiveStatus(lic);
      if (statusFilter !== 'All' && effStatus !== statusFilter) {
        return false;
      }
      if (tierFilter !== 'All' && lic.tier !== tierFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = lic.name.toLowerCase().includes(q);
        const matchesEmail = lic.contactEmail.toLowerCase().includes(q);
        const matchesNumber = lic.licenseNumber.toLowerCase().includes(q);
        const matchesScope = lic.departmentScope.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesNumber && !matchesScope) {
          return false;
        }
      }
      return true;
    });
  }, [licenses, statusFilter, tierFilter, searchTerm]);

  // Badge Color Mapper
  const getStatusBadge = (status: LicenseStatus) => {
    switch (status) {
      case 'Active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ccdbb2] border border-[#201e1d] text-[10px] font-black text-[#272e1b]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#272e1b]" />
            ACTIVE
          </span>
        );
      case 'Trial':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#d7e6fa] border border-[#201e1d] text-[10px] font-black text-[#1d3d63]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1d3d63]" />
            TRIAL
          </span>
        );
      case 'Expiring Soon':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fde68a] border border-[#201e1d] text-[10px] font-black text-[#78350f] animate-pulse">
            <Clock className="w-2.5 h-2.5" />
            EXPIRING SOON
          </span>
        );
      case 'Expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fecaca] border border-[#201e1d] text-[10px] font-black text-[#991b1b]">
            <AlertTriangle className="w-2.5 h-2.5" />
            EXPIRED
          </span>
        );
      case 'Suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e5e7eb] border border-[#201e1d] text-[10px] font-black text-[#374151]">
            SUSPENDED
          </span>
        );
      case 'Pending Activation':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e9d5ff] border border-[#201e1d] text-[10px] font-black text-[#581c87]">
            PENDING
          </span>
        );
    }
  };

  const getTierBadge = (tier: AccountTier) => {
    switch (tier) {
      case 'Institution Unlimited':
        return (
          <span className="px-2 py-0.5 rounded-md bg-[#fef08a] border border-[#201e1d] text-[10px] font-black text-[#713f12]">
            UNLIMITED
          </span>
        );
      case 'Enterprise Campus':
        return (
          <span className="px-2 py-0.5 rounded-md bg-[#ffe1d0] border border-[#201e1d] text-[10px] font-black text-[#7c2d12]">
            ENTERPRISE
          </span>
        );
      case 'Department Pro':
        return (
          <span className="px-2 py-0.5 rounded-md bg-[#ebddc5] border border-[#201e1d] text-[10px] font-black text-[#44382c]">
            DEPT PRO
          </span>
        );
      case 'Pilot':
        return (
          <span className="px-2 py-0.5 rounded-md bg-[#e0e7ff] border border-[#201e1d] text-[10px] font-black text-[#3730a3]">
            PILOT
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md bg-[#f3f4f6] border border-[#201e1d] text-[10px] font-black text-[#374151]">
            STANDARD
          </span>
        );
    }
  };

  if (!isLoaded) {
    return (
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-8 text-center text-[#201e1d] font-heading font-black">
        Loading Institutional Licenses...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#201e1d] text-[#f9f4ed] border-2 border-[#ccdbb2] px-4 py-2.5 rounded-xl shadow-offset-3 font-heading font-black text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-[#ccdbb2]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP KPI BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Schools */}
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-3 shadow-offset-3 space-y-1">
          <div className="flex items-center justify-between text-[#645c50]">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
              Licensed Schools
            </span>
            <Building2 className="w-4 h-4 text-[#201e1d]" />
          </div>
          <div className="text-2xl font-black font-heading text-[#201e1d]">
            {stats.totalSchools}
            <span className="text-xs font-bold text-[#645c50] ml-1.5">Campuses</span>
          </div>
          <div className="text-[11px] font-bold text-[#645c50] flex items-center justify-between">
            <span>{stats.activeCount} Active</span>
            {stats.expiringCount > 0 && (
              <span className="text-amber-700 font-black">⚠️ {stats.expiringCount} Expiring</span>
            )}
          </div>
        </div>

        {/* Card 2: Student Seat Utilization */}
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-3 shadow-offset-3 space-y-1.5">
          <div className="flex items-center justify-between text-[#645c50]">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
              Student Seats
            </span>
            <GraduationCap className="w-4 h-4 text-[#201e1d]" />
          </div>
          <div className="text-2xl font-black font-heading text-[#201e1d]">
            {stats.totalUtilizedSeats.toLocaleString()}
            <span className="text-xs font-bold text-[#645c50] ml-1">
              / {stats.totalSeatQuota.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-[#eee7db] rounded-full h-2 border border-[#201e1d] overflow-hidden">
            <div
              className="bg-[#201e1d] h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, stats.seatPercent)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold text-[#645c50]">
            <span>{Math.max(0, stats.totalSeatQuota - stats.totalUtilizedSeats).toLocaleString()} available</span>
            <span className="text-[#201e1d] font-black">{stats.seatPercent}% Used</span>
          </div>
        </div>

        {/* Card 3: Educator Slots */}
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-3 shadow-offset-3 space-y-1.5">
          <div className="flex items-center justify-between text-[#645c50]">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
              Educator Slots
            </span>
            <Users className="w-4 h-4 text-[#201e1d]" />
          </div>
          <div className="text-2xl font-black font-heading text-[#201e1d]">
            {stats.totalEducators}
            <span className="text-xs font-bold text-[#645c50] ml-1">
              / {stats.totalEducatorSlots}
            </span>
          </div>
          <div className="w-full bg-[#eee7db] rounded-full h-2 border border-[#201e1d] overflow-hidden">
            <div
              className="bg-[#ccdbb2] border-r border-[#201e1d] h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, stats.educatorPercent)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold text-[#645c50]">
            <span>{Math.max(0, stats.totalEducatorSlots - stats.totalEducators)} slots free</span>
            <span className="text-[#201e1d] font-black">{stats.educatorPercent}% Allocated</span>
          </div>
        </div>

        {/* Card 4: Quick Actions */}
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-3 shadow-offset-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#645c50]">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
              Licensing Controls
            </span>
            <ShieldCheck className="w-4 h-4 text-[#201e1d]" />
          </div>
          <div className="flex flex-col gap-1.5 my-1">
            <button
              type="button"
              onClick={openCreateModal}
              className="w-full py-1.5 px-3 rounded-xl bg-[#ccdbb2] text-[#272e1b] font-black font-heading text-xs border-2 border-[#201e1d] shadow-offset-1 hover:bg-[#b8c99d] transition-all cursor-pointer flex items-center justify-center gap-1.5 active:translate-y-0.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Issue New License</span>
            </button>
            <button
              type="button"
              onClick={handleResetData}
              className="w-full py-1 px-2 rounded-[6px] bg-[#eee7db] text-[#645c50] font-bold text-[10px] border border-[#201e1d] hover:bg-[#e4dcce] transition-colors flex items-center justify-center gap-1 cursor-pointer"
              title="Reset to default seeded colleges"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Sample Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* SEARCH & FILTER CONTROLS */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-3 shadow-offset-3 space-y-2.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#645c50]" />
            <input
              type="text"
              placeholder="Search by school name, license number, or contact email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border-2 border-[#201e1d] rounded-xl pl-9 pr-3 py-1.5 text-xs font-bold text-[#201e1d] placeholder:text-[#645c50]/70 focus:outline-none shadow-offset-1"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#645c50] hover:text-[#201e1d]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Issue Button */}
          <button
            type="button"
            onClick={openCreateModal}
            className="shrink-0 px-4 py-1.5 rounded-xl bg-[#ccdbb2] text-[#272e1b] font-black font-heading text-xs border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#b8c99d] transition-all cursor-pointer flex items-center gap-1.5 active:translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            <span>Issue New License</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#201e1d]/15">
          <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-[#645c50] mr-1">
            <Filter className="w-3 h-3" />
            <span>STATUS:</span>
          </div>
          {(['All', 'Active', 'Trial', 'Expiring Soon', 'Expired', 'Suspended'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-0.5 rounded-[4px] text-[10px] font-black border transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#201e1d] text-[#f9f4ed] border-[#201e1d] shadow-offset-1'
                  : 'bg-white text-[#201e1d] border-[#201e1d]/40 hover:bg-[#eee7db]'
              }`}
            >
              {st}
            </button>
          ))}

          <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-[#645c50] ml-2 mr-1">
            <span>TIER:</span>
          </div>
          {(['All', 'Standard Educator', 'Department Pro', 'Enterprise Campus', 'Institution Unlimited', 'Pilot'] as const).map((tr) => (
            <button
              key={tr}
              type="button"
              onClick={() => setTierFilter(tr)}
              className={`px-2 py-0.5 rounded-[4px] text-[10px] font-black border transition-all cursor-pointer ${
                tierFilter === tr
                  ? 'bg-[#201e1d] text-[#f9f4ed] border-[#201e1d] shadow-offset-1'
                  : 'bg-white text-[#201e1d] border-[#201e1d]/40 hover:bg-[#eee7db]'
              }`}
            >
              {tr === 'Institution Unlimited' ? 'Unlimited' : tr}
            </button>
          ))}
        </div>
      </div>

      {/* LICENSES LIST / TABLE */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-3 shadow-offset-3 space-y-3">
        <div className="flex items-center justify-between border-b-2 border-[#201e1d]/10 pb-2">
          <div>
            <h2 className="text-sm font-black text-[#201e1d] font-heading">
              Active Institutional License Accounts ({filteredLicenses.length})
            </h2>
            <p className="text-[11px] font-medium text-[#645c50]">
              Real-time student seat allocation, educator slot limits, and syllabus access keys.
            </p>
          </div>
        </div>

        {filteredLicenses.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-[#201e1d]/40 rounded-xl p-8 text-center space-y-2">
            <Building2 className="w-8 h-8 text-[#645c50] mx-auto" />
            <div className="font-heading font-black text-sm text-[#201e1d]">
              No matching school licenses found
            </div>
            <p className="text-xs text-[#645c50]">
              Try adjusting your search terms or filter pills, or issue a new license.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-2 px-3 py-1 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-[#272e1b] font-black text-xs shadow-offset-1 hover:bg-[#b8c99d]"
            >
              + Issue New License
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredLicenses.map((school) => {
              const effStatus = getEffectiveStatus(school);
              const seatsUsed = school.cohorts.reduce((sum, c) => sum + (c.studentCount || 0), 0);
              const seatPercent = school.studentSeatQuota > 0 ? Math.round((seatsUsed / school.studentSeatQuota) * 100) : 0;
              const edSlotsUsed = school.educators.length;
              const daysRemaining = getDaysRemaining(school.endDate);

              return (
                <div
                  key={school.id}
                  className="bg-white border-2 border-[#201e1d] rounded-xl p-3 shadow-offset-2 hover:shadow-offset-3 transition-all space-y-2.5"
                >
                  {/* Row Top: School Info + Status + Key + Tier */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#201e1d]/10 pb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-heading font-black text-sm text-[#201e1d] truncate">
                          {school.name}
                        </h3>
                        {getStatusBadge(effStatus)}
                        {getTierBadge(school.tier)}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[#645c50] font-medium mt-0.5 flex-wrap">
                        <span>{school.departmentScope}</span>
                        <span>•</span>
                        <span className="font-mono">{school.contactEmail}</span>
                      </div>
                    </div>

                    {/* License Key Box with 1-click copy */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5 bg-[#f9f4ed] border border-[#201e1d] rounded-[6px] px-2.5 py-1">
                        <span className="text-[10px] font-mono font-bold text-[#645c50]">KEY:</span>
                        <code className="text-xs font-mono font-black text-[#201e1d]">
                          {school.licenseNumber}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(school.licenseNumber, school.id)}
                          className="ml-1 p-0.5 rounded text-[#201e1d] hover:bg-[#ebddc5] transition-colors cursor-pointer"
                          title="Copy license number"
                        >
                          {copiedKey === school.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Row Middle: Metrics & Quotas Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                    {/* Metric A: Student Seat Utilization */}
                    <div className="bg-[#f9f4ed] border border-[#201e1d]/40 rounded-[6px] p-2 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-[#645c50]">
                        <span>STUDENT SEATS</span>
                        <span className="text-[#201e1d] font-black">{seatPercent}%</span>
                      </div>
                      <div className="flex items-baseline justify-between text-xs font-bold text-[#201e1d]">
                        <span>
                          <span className="font-black text-sm">{seatsUsed}</span> / {school.studentSeatQuota} Seats
                        </span>
                        <span className="text-[10px] text-[#645c50]">
                          {Math.max(0, school.studentSeatQuota - seatsUsed)} free
                        </span>
                      </div>
                      <div className="w-full bg-[#eee7db] rounded-full h-1.5 border border-[#201e1d]/40 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            seatPercent > 90 ? 'bg-amber-600' : 'bg-[#201e1d]'
                          }`}
                          style={{ width: `${Math.min(100, seatPercent)}%` }}
                        />
                      </div>
                    </div>

                    {/* Metric B: Educator Allocations */}
                    <div className="bg-[#f9f4ed] border border-[#201e1d]/40 rounded-[6px] p-2 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-[#645c50]">
                        <span>EDUCATOR SLOTS</span>
                        <span className="text-[#201e1d] font-black">
                          {edSlotsUsed} / {school.educatorSlotLimit}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-[#201e1d] flex items-center justify-between">
                        <span>{school.cohorts.length} Cohorts Active</span>
                        <span className="text-[10px] text-[#645c50]">
                          {Math.max(0, school.educatorSlotLimit - edSlotsUsed)} slots open
                        </span>
                      </div>
                      <div className="w-full bg-[#eee7db] rounded-full h-1.5 border border-[#201e1d]/40 overflow-hidden">
                        <div
                          className="bg-[#ccdbb2] border-r border-[#201e1d]/40 h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, school.educatorSlotLimit > 0 ? (edSlotsUsed / school.educatorSlotLimit) * 100 : 0)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Metric C: Validity & Renewal Countdown */}
                    <div className="bg-[#f9f4ed] border border-[#201e1d]/40 rounded-[6px] p-2 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono font-bold text-[#645c50]">VALID THROUGH</div>
                        <div className="text-xs font-black text-[#201e1d] font-heading truncate">
                          {school.endDate || 'Perpetual'}
                        </div>
                        <div className="text-[10px] font-medium text-[#645c50]">
                          {daysRemaining > 0 ? (
                            <span className={daysRemaining <= 30 ? 'text-amber-700 font-bold' : ''}>
                              {daysRemaining} days remaining
                            </span>
                          ) : (
                            <span className="text-red-700 font-bold">Expired</span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRenewOneYear(school)}
                          className="px-2 py-1 rounded-[6px] bg-[#ccdbb2] border border-[#201e1d] text-[#272e1b] font-black text-[10px] shadow-offset-1 hover:bg-[#b8c99d] transition-all cursor-pointer flex items-center gap-1 active:translate-y-0.5"
                          title="Extend license by 1 year"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>+1 Yr</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedSchool(school)}
                          className="px-2.5 py-1 rounded-[6px] bg-[#201e1d] text-[#f9f4ed] font-black text-xs shadow-offset-1 hover:bg-[#383431] transition-all cursor-pointer flex items-center gap-1 active:translate-y-0.5"
                        >
                          <span>Manage</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Notes snippet if present */}
                  {school.notes && (
                    <div className="text-[10px] text-[#645c50] bg-[#faf6f0] px-2 py-1 rounded border border-[#201e1d]/15 truncate">
                      <span className="font-bold text-[#201e1d]">Ref:</span> {school.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE NEW LICENSE DIALOG */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#201e1d]/70 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 max-w-xl w-full shadow-[8px_8px_0px_0px_#201e1d] space-y-4 my-8">
            <div className="flex items-center justify-between border-b-2 border-[#201e1d]/20 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-[#272e1b]" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-base text-[#201e1d]">
                    Issue New Organization License
                  </h3>
                  <p className="text-[11px] text-[#645c50] font-medium">
                    Provision student seats and Cambridge curriculum access for a new school.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="w-7 h-7 rounded-[6px] border-2 border-[#201e1d] bg-white flex items-center justify-center font-bold text-xs hover:bg-[#eee7db] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLicense} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                    School / Organization Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. St. Jude Academy"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                    Primary Admin / Contact Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="headmaster@school.org"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                    Campus / Department Scope
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Campus / Science Dept"
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value)}
                    className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                      License Number
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormLicenseNum(generateLicenseNumber())}
                      className="text-[10px] font-mono text-[#201e1d] underline hover:text-[#645c50] flex items-center gap-0.5 cursor-pointer"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      Regenerate
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formLicenseNum}
                    onChange={(e) => setFormLicenseNum(e.target.value)}
                    className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-mono font-black text-[#201e1d] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                    Account Tier
                  </label>
                  <select
                    value={formTier}
                    onChange={(e) => setFormTier(e.target.value as AccountTier)}
                    className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                  >
                    <option value="Standard Educator">Standard Educator</option>
                    <option value="Department Pro">Department Pro</option>
                    <option value="Enterprise Campus">Enterprise Campus</option>
                    <option value="Institution Unlimited">Institution Unlimited</option>
                    <option value="Pilot">Pilot</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                    Initial Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as LicenseStatus)}
                    className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Trial">Trial</option>
                    <option value="Pending Activation">Pending Activation</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                    Student Seat Quota
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={formSeatQuota}
                    onChange={(e) => setFormSeatQuota(Number(e.target.value) || 0)}
                    className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                    Educator Slot Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={formEducatorLimit}
                    onChange={(e) => setFormEducatorLimit(Number(e.target.value) || 0)}
                    className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                  />
                </div>
              </div>

              {/* End Date & Presets */}
              <div className="space-y-1 bg-[#ebddc5]/30 border border-[#201e1d]/20 rounded-xl p-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                    License Expiration Date
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#645c50] font-mono">Quick:</span>
                    <button
                      type="button"
                      onClick={() => setFormEndDate(addMonthsToDate(6))}
                      className="px-1.5 py-0.5 rounded bg-white border border-[#201e1d]/40 text-[10px] font-bold text-[#201e1d] hover:bg-[#ebddc5]"
                    >
                      +6 Mo
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormEndDate(addMonthsToDate(12))}
                      className="px-1.5 py-0.5 rounded bg-white border border-[#201e1d]/40 text-[10px] font-bold text-[#201e1d] hover:bg-[#ebddc5]"
                    >
                      +1 Yr
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormEndDate(addMonthsToDate(24))}
                      className="px-1.5 py-0.5 rounded bg-white border border-[#201e1d]/40 text-[10px] font-bold text-[#201e1d] hover:bg-[#ebddc5]"
                    >
                      +2 Yr
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  required
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                  Purchase Order / Reference Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. PO-77192, authorized by Dean of Science"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#201e1d]/15">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl border-2 border-[#201e1d] text-xs font-bold text-[#645c50] hover:bg-[#eee7db] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-[#272e1b] font-black font-heading text-xs shadow-offset-2 hover:bg-[#b8c99d] transition-all cursor-pointer active:translate-y-0.5 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Create & Issue License</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DRILL-DOWN SCHOOL MANAGEMENT VIEW */}
      {/* ========================================================================= */}
      {selectedSchool && (
        <div className="fixed inset-0 z-50 bg-[#201e1d]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl max-w-4xl w-full shadow-[8px_8px_0px_0px_#201e1d] flex flex-col max-h-[92vh] overflow-hidden my-4">
            {/* Header */}
            <div className="bg-[#ebddc5] border-b-2 border-[#201e1d] p-3.5 sm:p-4 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-heading font-black text-base sm:text-lg text-[#201e1d] truncate">
                    {selectedSchool.name}
                  </h2>
                  {getStatusBadge(getEffectiveStatus(selectedSchool))}
                  {getTierBadge(selectedSchool.tier)}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#645c50] font-medium flex-wrap mt-0.5">
                  <span>{selectedSchool.departmentScope}</span>
                  <span>•</span>
                  <span>{selectedSchool.contactEmail}</span>
                  <span>•</span>
                  <span className="font-mono font-bold">KEY: {selectedSchool.licenseNumber}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openEditModal(selectedSchool)}
                  className="px-2.5 py-1 rounded-xl bg-white border-2 border-[#201e1d] text-[#201e1d] font-black text-xs shadow-offset-1 hover:bg-[#eee7db] flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Settings</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSchool(null)}
                  className="w-7 h-7 rounded-xl border-2 border-[#201e1d] bg-white flex items-center justify-center font-bold text-xs hover:bg-[#eee7db] cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-3.5 sm:p-4 overflow-y-auto space-y-4">
              {/* Top 3 KPI mini-cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 1: Student Seats */}
                {(() => {
                  const used = selectedSchool.cohorts.reduce((sum, c) => sum + (c.studentCount || 0), 0);
                  const pct = selectedSchool.studentSeatQuota > 0 ? Math.round((used / selectedSchool.studentSeatQuota) * 100) : 0;
                  return (
                    <div className="bg-white border-2 border-[#201e1d] rounded-[6px] p-2.5 shadow-offset-2 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-[#645c50]">
                        <span>STUDENT SEATS</span>
                        <span className="text-[#201e1d] font-black">{pct}% Used</span>
                      </div>
                      <div className="text-lg font-black font-heading text-[#201e1d]">
                        {used} / {selectedSchool.studentSeatQuota}{' '}
                        <span className="text-xs font-bold text-[#645c50]">Seats</span>
                      </div>
                      <div className="w-full bg-[#eee7db] rounded-full h-1.5 border border-[#201e1d] overflow-hidden">
                        <div
                          className="bg-[#201e1d] h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-[#645c50] font-bold">
                        {Math.max(0, selectedSchool.studentSeatQuota - used)} seats remaining
                      </div>
                    </div>
                  );
                })()}

                {/* 2: Educator Slots */}
                <div className="bg-white border-2 border-[#201e1d] rounded-[6px] p-2.5 shadow-offset-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-[#645c50]">
                    <span>EDUCATOR SEATS</span>
                    <span className="text-[#201e1d] font-black">
                      {selectedSchool.educators.length} / {selectedSchool.educatorSlotLimit}
                    </span>
                  </div>
                  <div className="text-lg font-black font-heading text-[#201e1d]">
                    {selectedSchool.educators.length}{' '}
                    <span className="text-xs font-bold text-[#645c50]">Teachers Active</span>
                  </div>
                  <div className="w-full bg-[#eee7db] rounded-full h-1.5 border border-[#201e1d] overflow-hidden">
                    <div
                      className="bg-[#ccdbb2] border-r border-[#201e1d] h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, selectedSchool.educatorSlotLimit > 0 ? (selectedSchool.educators.length / selectedSchool.educatorSlotLimit) * 100 : 0)}%`,
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-[#645c50] font-bold">
                    {Math.max(0, selectedSchool.educatorSlotLimit - selectedSchool.educators.length)} slots open
                  </div>
                </div>

                {/* 3: Validity */}
                {(() => {
                  const days = getDaysRemaining(selectedSchool.endDate);
                  return (
                    <div className="bg-white border-2 border-[#201e1d] rounded-[6px] p-2.5 shadow-offset-2 space-y-1 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-[#645c50]">
                        <span>VALIDITY & RENEWAL</span>
                        <Clock className="w-3.5 h-3.5 text-[#201e1d]" />
                      </div>
                      <div className="text-base font-black font-heading text-[#201e1d]">
                        {selectedSchool.endDate}
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className={days <= 30 ? 'text-amber-700' : 'text-[#645c50]'}>
                          {days > 0 ? `${days} days left` : 'Expired'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRenewOneYear(selectedSchool)}
                          className="px-2 py-0.5 rounded bg-[#ccdbb2] border border-[#201e1d] text-[#272e1b] font-black text-[10px] hover:bg-[#b8c99d] cursor-pointer"
                        >
                          +1 Yr Extension
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Split Panels: Cohorts & Educators */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* PANEL A: Institutional Cohorts */}
                <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-3 shadow-offset-2 space-y-2.5 flex flex-col">
                  <div className="flex items-center justify-between border-b-2 border-[#201e1d]/10 pb-2">
                    <div>
                      <h3 className="font-heading font-black text-sm text-[#201e1d]">
                        Class Cohorts ({selectedSchool.cohorts.length})
                      </h3>
                      <p className="text-[10px] text-[#645c50] font-medium">
                        Student classes linked to Cambridge syllabus codes.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddCohort(!showAddCohort)}
                      className="px-2.5 py-1 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-[#272e1b] font-black text-xs shadow-offset-1 hover:bg-[#b8c99d] cursor-pointer active:translate-y-0.5"
                    >
                      {showAddCohort ? 'Cancel' : '+ New Cohort'}
                    </button>
                  </div>

                  {/* Add Cohort Form */}
                  {showAddCohort && (
                    <form onSubmit={handleAddCohortToSchool} className="bg-[#ebddc5]/40 border-2 border-[#201e1d] rounded-xl p-2.5 space-y-2">
                      <div className="font-heading font-black text-[10px] uppercase text-[#201e1d]">
                        Register New Class Cohort
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <label className="text-[9px] font-mono font-bold text-[#645c50]">Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 11A Physics"
                            value={cohortName}
                            onChange={(e) => setCohortName(e.target.value)}
                            className="w-full bg-white border border-[#201e1d] rounded-[6px] px-2 py-1 text-xs font-bold text-[#201e1d]"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] font-mono font-bold text-[#645c50]">Syllabus</label>
                          <select
                            value={cohortSubject}
                            onChange={(e) => {
                              setCohortSubject(e.target.value);
                              setCohortDept(e.target.value.includes('Physics') ? 'Physics' : e.target.value.includes('Economics') ? 'Economics' : 'Science');
                            }}
                            className="w-full bg-white border border-[#201e1d] rounded-[6px] px-2 py-1 text-xs font-bold text-[#201e1d]"
                          >
                            <option value="0625 Physics">0625 Physics</option>
                            <option value="0455 Economics">0455 Economics</option>
                            <option value="0620 Chemistry">0620 Chemistry</option>
                            <option value="0610 Biology">0610 Biology</option>
                            <option value="0580 Mathematics">0580 Mathematics</option>
                          </select>
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] font-mono font-bold text-[#645c50]">Students *</label>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={cohortStudents}
                            onChange={(e) => setCohortStudents(Number(e.target.value) || 0)}
                            className="w-full bg-white border border-[#201e1d] rounded-[6px] px-2 py-1 text-xs font-bold text-[#201e1d]"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] font-mono font-bold text-[#645c50]">Teacher</label>
                          <input
                            type="text"
                            placeholder="Instructor Name"
                            value={cohortTeacher}
                            onChange={(e) => setCohortTeacher(e.target.value)}
                            className="w-full bg-white border border-[#201e1d] rounded-[6px] px-2 py-1 text-xs font-bold text-[#201e1d]"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddCohort(false)}
                          className="px-2 py-0.5 rounded border border-[#201e1d] text-[10px] font-bold text-[#645c50]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-0.5 rounded bg-[#ccdbb2] border border-[#201e1d] text-[#272e1b] text-[10px] font-black"
                        >
                          Save Cohort
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Cohorts Table */}
                  <div className="overflow-auto max-h-[220px] rounded-xl border border-[#201e1d] bg-[#f9f4ed]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-[#ebddc5] border-b border-[#201e1d] font-heading font-black text-[10px] text-[#201e1d]">
                        <tr>
                          <th className="px-2 py-1.5">Cohort</th>
                          <th className="px-2 py-1.5">Syllabus</th>
                          <th className="px-2 py-1.5">Enrolled</th>
                          <th className="px-2 py-1.5">Teacher</th>
                          <th className="px-2 py-1.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#201e1d]/10">
                        {selectedSchool.cohorts.map((c) => (
                          <tr key={c.id} className="hover:bg-white transition-colors">
                            <td className="px-2 py-1.5 font-bold text-[#201e1d] truncate max-w-[120px]">
                              {c.name}
                            </td>
                            <td className="px-2 py-1.5">
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-[#201e1d]/30 font-bold">
                                {c.subjectCode}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 font-black text-[#201e1d]">
                              {c.studentCount}
                            </td>
                            <td className="px-2 py-1.5 text-[11px] text-[#645c50] truncate max-w-[100px]">
                              {c.assignedTeacher || '—'}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveCohortFromSchool(c.id)}
                                className="px-1.5 py-0.5 rounded bg-[#fde8e8] border border-[#201e1d] text-[#e0533c] text-[10px] font-bold hover:bg-[#fca5a5] cursor-pointer"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                        {selectedSchool.cohorts.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-2 py-4 text-center text-[11px] text-[#645c50] font-medium">
                              No cohorts configured. Click &quot;+ New Cohort&quot; to register classes.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* PANEL B: Licensed Educators */}
                <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-3 shadow-offset-2 space-y-2.5 flex flex-col">
                  <div className="flex items-center justify-between border-b-2 border-[#201e1d]/10 pb-2">
                    <div>
                      <h3 className="font-heading font-black text-sm text-[#201e1d]">
                        Licensed Educators ({selectedSchool.educators.length} / {selectedSchool.educatorSlotLimit})
                      </h3>
                      <p className="text-[10px] text-[#645c50] font-medium">
                        Instructors with access to question authoring and analytics.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddEducator(!showAddEducator)}
                      className="px-2.5 py-1 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] text-[#201e1d] font-black text-xs shadow-offset-1 hover:bg-[#ffc6a5] cursor-pointer active:translate-y-0.5"
                    >
                      {showAddEducator ? 'Cancel' : '+ Invite'}
                    </button>
                  </div>

                  {/* Add Educator Form */}
                  {showAddEducator && (
                    <form onSubmit={handleAddEducatorToSchool} className="bg-[#ebddc5]/40 border-2 border-[#201e1d] rounded-xl p-2.5 space-y-2">
                      <div className="font-heading font-black text-[10px] uppercase text-[#201e1d]">
                        Invite Licensed Educator
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <label className="text-[9px] font-mono font-bold text-[#645c50]">Full Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Dr. A. Sterling"
                            value={educatorName}
                            onChange={(e) => setEducatorName(e.target.value)}
                            className="w-full bg-white border border-[#201e1d] rounded-[6px] px-2 py-1 text-xs font-bold text-[#201e1d]"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] font-mono font-bold text-[#645c50]">Email *</label>
                          <input
                            type="email"
                            required
                            placeholder="teacher@school.org"
                            value={educatorEmail}
                            onChange={(e) => setEducatorEmail(e.target.value)}
                            className="w-full bg-white border border-[#201e1d] rounded-[6px] px-2 py-1 text-xs font-bold text-[#201e1d]"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] font-mono font-bold text-[#645c50]">Department</label>
                          <input
                            type="text"
                            placeholder="e.g. Science / Physics"
                            value={educatorDept}
                            onChange={(e) => setEducatorDept(e.target.value)}
                            className="w-full bg-white border border-[#201e1d] rounded-[6px] px-2 py-1 text-xs font-bold text-[#201e1d]"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] font-mono font-bold text-[#645c50]">Role</label>
                          <select
                            value={educatorRole}
                            onChange={(e) => setEducatorRole(e.target.value as any)}
                            className="w-full bg-white border border-[#201e1d] rounded-[6px] px-2 py-1 text-xs font-bold text-[#201e1d]"
                          >
                            <option value="Teacher (Read-Only Bank)">Teacher (Read-Only Bank)</option>
                            <option value="Department Head">Department Head</option>
                            <option value="App Admin (Full Edit)">App Admin (Full Edit)</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddEducator(false)}
                          className="px-2 py-0.5 rounded border border-[#201e1d] text-[10px] font-bold text-[#645c50]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-0.5 rounded bg-[#ffe1d0] border border-[#201e1d] text-[#201e1d] text-[10px] font-black"
                        >
                          Send Invitation
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Educators Table */}
                  <div className="overflow-auto max-h-[220px] rounded-xl border border-[#201e1d] bg-[#f9f4ed]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-[#ebddc5] border-b border-[#201e1d] font-heading font-black text-[10px] text-[#201e1d]">
                        <tr>
                          <th className="px-2 py-1.5">Educator</th>
                          <th className="px-2 py-1.5">Role</th>
                          <th className="px-2 py-1.5">Dept</th>
                          <th className="px-2 py-1.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#201e1d]/10">
                        {selectedSchool.educators.map((ed) => (
                          <tr key={ed.id} className="hover:bg-white transition-colors">
                            <td className="px-2 py-1.5 truncate max-w-[130px]">
                              <div className="font-bold text-[#201e1d] leading-tight truncate">{ed.name}</div>
                              <div className="text-[10px] text-[#645c50] font-mono leading-tight truncate">{ed.email}</div>
                            </td>
                            <td className="px-2 py-1.5">
                              <span className="text-[10px] font-bold text-[#201e1d] bg-white px-1.5 py-0.5 rounded border border-[#201e1d]/30 whitespace-nowrap">
                                {ed.role === 'App Admin (Full Edit)' ? 'Admin' : ed.role === 'Department Head' ? 'Dept Head' : 'Teacher'}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-[11px] text-[#645c50] truncate max-w-[80px]">
                              {ed.department}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveEducatorFromSchool(ed.id)}
                                className="px-1.5 py-0.5 rounded bg-[#fde8e8] border border-[#201e1d] text-[#e0533c] text-[10px] font-bold hover:bg-[#fca5a5] cursor-pointer"
                              >
                                Revoke
                              </button>
                            </td>
                          </tr>
                        ))}
                        {selectedSchool.educators.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-2 py-4 text-center text-[11px] text-[#645c50] font-medium">
                              No educators assigned. Click &quot;+ Invite&quot; to grant educator access.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Bottom Actions Bar */}
              <div className="flex items-center justify-between pt-2 border-t-2 border-[#201e1d]/15">
                <button
                  type="button"
                  onClick={() => handleDeleteLicense(selectedSchool.id, selectedSchool.name)}
                  className="px-3 py-1.5 rounded-xl bg-[#fde8e8] border-2 border-[#201e1d] text-[#e0533c] font-black text-xs shadow-offset-1 hover:bg-[#fca5a5] transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete License</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRenewOneYear(selectedSchool)}
                    className="px-3 py-1.5 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-[#272e1b] font-black text-xs shadow-offset-1 hover:bg-[#b8c99d] transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Renew License (+1 Year)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSchool(null)}
                    className="px-4 py-1.5 rounded-xl bg-[#201e1d] text-[#f9f4ed] font-black text-xs shadow-offset-1 hover:bg-[#383431] transition-all cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT SCHOOL SETTINGS DIALOG */}
      {/* ========================================================================= */}
      {isEditModalOpen && schoolToEdit && (
        <div className="fixed inset-0 z-50 bg-[#201e1d]/70 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 max-w-xl w-full shadow-[8px_8px_0px_0px_#201e1d] space-y-4 my-8">
            <div className="flex items-center justify-between border-b-2 border-[#201e1d]/20 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#ebddc5] border-2 border-[#201e1d] flex items-center justify-center">
                  <Edit3 className="w-4 h-4 text-[#201e1d]" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-base text-[#201e1d]">
                    Edit School License Settings
                  </h3>
                  <p className="text-[11px] text-[#645c50] font-medium">
                    Update student quota, tier, expiry, and contact info for {schoolToEdit.name}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-7 h-7 rounded-[6px] border-2 border-[#201e1d] bg-white flex items-center justify-center font-bold text-xs hover:bg-[#eee7db] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateLicense} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                    School Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                    Contact Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                    Campus Scope
                  </label>
                  <input
                    type="text"
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value)}
                    className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                    License Number
                  </label>
                  <input
                    type="text"
                    value={formLicenseNum}
                    onChange={(e) => setFormLicenseNum(e.target.value)}
                    className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-mono font-black text-[#201e1d] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                    Account Tier
                  </label>
                  <select
                    value={formTier}
                    onChange={(e) => setFormTier(e.target.value as AccountTier)}
                    className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                  >
                    <option value="Standard Educator">Standard Educator</option>
                    <option value="Department Pro">Department Pro</option>
                    <option value="Enterprise Campus">Enterprise Campus</option>
                    <option value="Institution Unlimited">Institution Unlimited</option>
                    <option value="Pilot">Pilot</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                    License Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as LicenseStatus)}
                    className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Trial">Trial</option>
                    <option value="Expiring Soon">Expiring Soon</option>
                    <option value="Expired">Expired</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Pending Activation">Pending Activation</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                    Student Seat Quota
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={formSeatQuota}
                    onChange={(e) => setFormSeatQuota(Number(e.target.value) || 0)}
                    className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                    Educator Slot Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={formEducatorLimit}
                    onChange={(e) => setFormEducatorLimit(Number(e.target.value) || 0)}
                    className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1 bg-[#ebddc5]/30 border border-[#201e1d]/20 rounded-xl p-2.5">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                  Expiration Date
                </label>
                <input
                  type="date"
                  required
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                  Reference Notes
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#201e1d]/15">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl border-2 border-[#201e1d] text-xs font-bold text-[#645c50] hover:bg-[#eee7db] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-[#272e1b] font-black font-heading text-xs shadow-offset-2 hover:bg-[#b8c99d] transition-all cursor-pointer active:translate-y-0.5 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
