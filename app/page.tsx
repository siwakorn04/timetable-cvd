"use client"; // This directive marks the component as a Client Component, allowing React Hooks like useState and useEffect to be used.

import React, { useState, useEffect, useCallback } from 'react';

import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';


// --- Type Definitions for a more robust application with TypeScript ---

// Define the structure of an Employee object
interface Employee {
  id: string; // Unique ID for the employee
  name: string; // Employee's full name
  position: string; // Employee's position (e.g., 'แพทย์แผนไทย', 'ผู้ช่วยแพทย์')
  branch: string; // The branch the employee is assigned to, or 'พาร์ทไทม์' for part-time staff
  type: 'full-time' | 'part-time'; // Employee type: full-time or part-time
}

// All possible string values for a shift, including empty string
type BaseShiftString = 'เช้า' | 'บ่าย' | 'หยุด' | 'ลา' | 'ป่วย' | 'ปิด' | '';

// For part-time employees working a shift in a specific branch
interface WorkingShiftObject {
  type: 'เช้า' | 'บ่าย'; // The type of shift
  branch: string; // The branch where the part-timer is working on this day
}

// A ShiftEntry can be a simple string (for full-time, or part-time non-working shifts)
// OR it can be a WorkingShiftObject (for part-time working shifts)
type ShiftEntry = BaseShiftString | WorkingShiftObject;

// Type guard to check if a ShiftEntry is a WorkingShiftObject
// This helps TypeScript understand when it's an object vs a string
function isWorkingShiftObject(shift: ShiftEntry | undefined): shift is WorkingShiftObject {
  return typeof shift === 'object' && shift !== null && 'type' in shift && 'branch' in shift;
}

// Define the structure of the monthly schedule
// It's a record where keys are date strings (e.g., '2025-06-01')
// And values are another record where keys are employee IDs and values are ShiftEntry
interface MonthlySchedule {
  [dateKey: string]: {
    [employeeId: Employee['id']]: ShiftEntry;
  };
}

// Define the structure for the modal state
interface ModalState {
  isOpen: boolean; // Whether the modal is open
  title: string; // Title of the modal
  message: string; // Message content of the modal
  onConfirm: () => void; // Function to call when confirm button is clicked
  onCancel: () => void; // Function to call when cancel button is clicked
  showCancel: boolean; // Whether to show the cancel button
}

// --- Custom Modal Component for alerts/confirmations (replaces alert() and confirm())
const CustomModal: React.FC<ModalState> = ({ isOpen, title, message, onConfirm, onCancel, showCancel = false }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-auto">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          {showCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              ยกเลิก
            </button>
          )}
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            ตกลง
          </button>
        </div>
      </div>
    </div>
  );
};

// Icons (using inline SVG to avoid external dependencies like Lucide React for this demo)
const PlusIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const TrashIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const EditIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);

const SaveIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 =0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
    <polyline points="17 21 17 13 7 13 7 21"></polyline>
    <polyline points="7 3 7 8 15 8"></polyline>
  </svg>
);

const ChevronLeftIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);

const ChevronRightIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);

// --- Custom scrollbar for employee list ---
const scrollbarStyles = `
  .scrollbar-thin::-webkit-scrollbar {
    width: 8px;
  }
  .scrollbar-thin::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 10px;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: #999;
  }
`;


// Main App Component
const App: React.FC = () => {
  // Initial branches for the clinic (9 branches as per prompt + new ones)
  const initialBranches: string[] = [
    'บึงทับช้าง', 'บัวใหญ่', 'โนนสูง', 'ขามสะแกแสง', 'หนองไข่น้ำ',
    'พนมวันท์', 'วังน้ำเขียว', 'เคหะ', 'โนนไทย', // Replaced 'อโศก' with 'โนนไทย'
    'จักราช' // Added 'จักราช'
  ];

  // Positions available in the clinic
  const positions: string[] = ['แพทย์แผนไทย', 'ผู้ช่วยแพทย์', 'พนักงานนวด'];

  // State for employees (initially empty, no example employees)
  const [employees, setEmployees] = useState<Employee[]>([]);

  // State for branches
  const [branches, setBranches] = useState<string[]>(initialBranches);

  // State for monthly schedule (date -> employeeId -> { shiftType: 'เช้า'/'บ่าย'/'หยุด'/'ลา'/'ป่วย'/'ปิด', assignedBranch?: 'สาขาที่จัดเวร' (for part-timers working shifts) })
  // For full-time employees, shiftType is a string. For part-time working shifts, it's an object with type and branch.
  // For part-time non-working shifts ('หยุด', 'ลา', 'ป่วย', ''), it's a string.
  const [monthlySchedule, setMonthlySchedule] = useState<MonthlySchedule>({});

  // State for current month being displayed (e.g., new Date())
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // State for selected branch to view schedule
  const [selectedBranch, setSelectedBranch] = useState<string>(initialBranches[0]); // Default to the first branch

  // State for managing employee edit mode
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editedEmployee, setEditedEmployee] = useState<Employee>({ id: '', name: '', position: '', branch: '', type: 'full-time' });

  // State for new employee form
  const [newEmployee, setNewEmployee] = useState<Omit<Employee, 'id'>>({ name: '', position: '', branch: initialBranches[0], type: 'full-time' }); // Default to full-time, first branch

  // State for modal (for alerts/confirmations)
  const [modal, setModal] = useState<ModalState>({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {}, showCancel: false });

  // Day names for clinic day off selection, including 'ไม่มี'
  const dayNames: string[] = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'ไม่มี' ];
  // State for clinic-wide day off
  const [clinicDayOff, setClinicDayOff] = useState<string>('อาทิตย์'); // Default Sunday

  useEffect(() => {
    const loadScheduleFromFirestore = async () => {
      const querySnapshot = await getDocs(collection(db, 'schedules'));
      const schedules = querySnapshot.docs.map(doc => doc.data());

      if (schedules.length > 0) {
        const latest = schedules[0]; // ใช้เอกสารล่าสุดหรือเอกสารแรก
        setEmployees(Array.isArray(latest.employees) ? latest.employees : []);
        const scheduleMap = {} as MonthlySchedule;

        if (latest.schedule) {
          Object.entries(latest.schedule).forEach(([empId, days]: any) => {
            Object.entries(days).forEach(([day, shift]) => {
              const date = latest.date;
              if (!scheduleMap[date]) scheduleMap[date] = {};
              scheduleMap[date][empId] = shift as ShiftEntry;
            });
          });
        }

        setMonthlySchedule(scheduleMap);
      }
    };

    loadScheduleFromFirestore();
  }, []);


  // Get days in current month
  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };

  const currentYear: number = currentDate.getFullYear();
  const currentMonth: number = currentDate.getMonth(); // 0-indexed
  const daysInMonth: number = getDaysInMonth(currentYear, currentMonth);
  const daysArray: number[] = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Function to handle shift change
  const handleShiftChange = useCallback((employeeId: Employee['id'], day: number, value: string) => { // 'value' from select is always string
    const employee: Employee | undefined = employees.find(e => e.id === employeeId);
    if (!employee) return; // Should not happen

    const dateKey: string = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek: number = new Date(currentYear, currentMonth, day).getDay();
    const isClinicDayOffCell: boolean = dayNames[dayOfWeek] === clinicDayOff && clinicDayOff !== 'ไม่มี';

    setMonthlySchedule((prevSchedule: MonthlySchedule) => {
      const newSchedule: MonthlySchedule = { ...prevSchedule };
      if (!newSchedule[dateKey]) {
        newSchedule[dateKey] = {};
      }

      // Pre-check for Clinic Day Off
      if (isClinicDayOffCell) { // Only apply if a specific day off is set (not 'ไม่มี')
        if (value !== 'ปิด') { // Trying to set something other than 'ปิด' on a day off
          setModal({
            isOpen: true,
            title: 'วันหยุดคลินิก',
            message: `คลินิกปิดทำการในวัน${dayNames[dayOfWeek]} ไม่สามารถจัดเวรได้`,
            onConfirm: () => setModal({ ...modal, isOpen: false }),
            onCancel: () => {}, // No cancel for this message
            showCancel: false,
          });
          return prevSchedule; // Prevent update
        } else { // User selected 'ปิด'
          newSchedule[dateKey][employeeId] = 'ปิด';
          return newSchedule;
        }
      }

      // If not a clinic day off
      if (employee.type === 'part-time') {
        // Scenario 1: User is assigning a working shift ('เช้า' or 'บ่าย') to a part-timer.
        if (value === 'เช้า' || value === 'บ่าย') {
          // Check if this part-time employee is already assigned to a working shift in a DIFFERENT branch on this day
          let isWorkingElsewhere: boolean = false;
          for (const branch of branches) {
            if (branch === selectedBranch) continue; // Skip current branch

            const otherBranchDateKey: string = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const otherBranchShiftEntry: ShiftEntry | undefined = monthlySchedule[otherBranchDateKey]?.[employee.id];

            // Use the type guard here
            if (isWorkingShiftObject(otherBranchShiftEntry)) {
                isWorkingElsewhere = true;
                setModal({
                    isOpen: true,
                    title: 'ข้อจำกัดพนักงานพาร์ทไทม์',
                    message: `พนักงานพาร์ทไทม์คนนี้ถูกจัดเวรในสาขา "${otherBranchShiftEntry.branch}" อยู่แล้วในวันนี้ ไม่สามารถจัดเวรในสาขา "${selectedBranch}" ได้`,
                    onConfirm: () => setModal({ ...modal, isOpen: false }),
                    onCancel: () => {}, // No cancel for this message
                    showCancel: false,
                });
                return prevSchedule; // Block assignment
            }
          }

          if (!isWorkingElsewhere) {
            // Assign the working shift with branch context for the current selectedBranch
            newSchedule[dateKey][employeeId] = { type: value as 'เช้า' | 'บ่าย', branch: selectedBranch }; // Explicitly cast value
          }
        } else {
          // Scenario 2: User is assigning a non-working shift ('หยุด', 'ลา', 'ป่วย', '') or clearing the shift ('') to a part-timer.
          // These shifts are global and override any working shifts for the day.
          newSchedule[dateKey][employeeId] = value as BaseShiftString; // Explicitly cast to BaseShiftString
        }
      } else { // Full-time employee
        newSchedule[dateKey][employeeId] = value as BaseShiftString; // Explicitly cast to BaseShiftString
      }

      return newSchedule;
    });
  }, [currentYear, currentMonth, employees, selectedBranch, clinicDayOff, dayNames, branches, monthlySchedule, modal]);


  // Function to get shift value for a specific employee and day, considering part-time branch assignments
  const getShiftValue = useCallback((employeeId: Employee['id'], day: number): BaseShiftString => { // Function returns BaseShiftString for display
    const employee: Employee | undefined = employees.find(e => e.id === employeeId);
    if (!employee) return '';

    const dateKey: string = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek: number = new Date(currentYear, currentMonth, day).getDay();
    const isClinicDayOffCell: boolean = dayNames[dayOfWeek] === clinicDayOff && clinicDayOff !== 'ไม่มี';

    if (isClinicDayOffCell) {
      return 'ปิด';
    }

    const shiftEntry: ShiftEntry | undefined = monthlySchedule[dateKey]?.[employee.id];

    if (employee.type === 'full-time') {
      // For full-time, it's always a BaseShiftString. Use type guard to ensure it's string before returning.
      return (typeof shiftEntry === 'string' ? shiftEntry : '') as BaseShiftString;
    } else { // Part-time employee
      if (isWorkingShiftObject(shiftEntry)) { // Use the type guard
        if (shiftEntry.branch === selectedBranch) {
          return shiftEntry.type; // This will be 'เช้า' or 'บ่าย' which is part of BaseShiftString
        } else {
          // This part-timer is working in a DIFFERENT branch, so they appear available (empty) in this view
          return '';
        }
      } else { // It's a BaseShiftString ('หยุด', 'ลา', 'ป่วย', '')
        return (shiftEntry || '') as BaseShiftString;
      }
    }
  }, [currentYear, currentMonth, monthlySchedule, employees, selectedBranch, clinicDayOff, dayNames]);


  // Navigate month
  const changeMonth = (direction: number): void => {
    setCurrentDate(prevDate => {
      const newDate: Date = new Date(prevDate.getFullYear(), prevDate.getMonth() + direction, 1);
      return newDate;
    });
  };

  // Employee management functions
  const handleAddEmployee = (): void => {
    if (newEmployee.name.trim() && newEmployee.position.trim() && (newEmployee.type === 'part-time' || newEmployee.branch.trim())) {
      const idPrefix: string = newEmployee.type === 'full-time' ? 'emp' : 'pte';
      // Calculate a unique ID based on the type and existing count
      const newId: string = idPrefix + (employees.filter(e => e.type === newEmployee.type).length + 1);
      setEmployees([...employees, { id: newId, ...newEmployee, branch: newEmployee.type === 'part-time' ? 'พาร์ทไทม์' : newEmployee.branch }]);
      setNewEmployee({ name: '', position: '', branch: initialBranches[0], type: 'full-time' }); // Reset with default branch
    } else {
      setModal({
        isOpen: true,
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณากรอกชื่อ, ตำแหน่ง และสาขา (สำหรับ Full-time) หรือประเภทพนักงาน (สำหรับ Part-time)',
        onConfirm: () => setModal({ ...modal, isOpen: false }),
        onCancel: () => {}, // No cancel for this message
        showCancel: false,
      });
    }
  };

  const handleDeleteEmployee = (id: Employee['id']): void => {
    setModal({
      isOpen: true,
      title: 'ยืนยันการลบ',
      message: 'คุณแน่ใจหรือไม่ที่ต้องการลบพนักงานคนนี้? ตารางเวรที่เกี่ยวข้องอาจหายไป',
      showCancel: true,
      onConfirm: () => {
        setEmployees(employees.filter(emp => emp.id !== id));
        // Also clean up schedule for this employee
        setMonthlySchedule((prevSchedule: MonthlySchedule) => {
          const newSchedule: MonthlySchedule = { ...prevSchedule };
          Object.keys(newSchedule).forEach((dateKey: string) => {
            if (newSchedule[dateKey]) {
              delete newSchedule[dateKey][id];
              if (Object.keys(newSchedule[dateKey]).length === 0) {
                delete newSchedule[dateKey];
              }
            }
          });
          return newSchedule;
        });
        setModal({ ...modal, isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {}, showCancel: false });
      },
      onCancel: () => setModal({ ...modal, isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {}, showCancel: false }),
    });
  };

  const startEditEmployee = (employee: Employee): void => {
    setEditingEmployeeId(employee.id);
    setEditedEmployee({ ...employee });
  };

  const handleEditEmployeeChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setEditedEmployee(prev => ({ ...prev, [name]: value }));
  };

  const saveEditEmployee = (): void => {
    setEmployees(employees.map(emp =>
      emp.id === editingEmployeeId ? { ...editedEmployee, branch: editedEmployee.type === 'part-time' ? 'พาร์ทไทม์' : editedEmployee.branch } : emp
    ));
    setEditingEmployeeId(null);
  };

  // Helper to get background color for shifts
  const getShiftBgColor = (shiftType: BaseShiftString): string => { // Now accepts BaseShiftString for consistent display
    switch (shiftType) {
      case 'เช้า': return 'bg-blue-100 text-blue-800';
      case 'บ่าย': return 'bg-green-100 text-green-800';
      case 'หยุด': return 'bg-gray-200 text-gray-700';
      case 'ลา': return 'bg-yellow-200 text-yellow-800 font-semibold';
      case 'ป่วย': return 'bg-red-200 text-red-800 font-semibold';
      case 'ปิด': return 'bg-purple-200 text-purple-800 font-semibold'; // For clinic day off
      default: return 'bg-white text-gray-700';
    }
  };

  // Filter employees for the currently selected branch view
  const displayedEmployees: Employee[] = employees.filter(employee =>
    employee.type === 'part-time' || employee.branch === selectedBranch
  );

  // Calculate daily staff count for the *currently displayed* employees on 'เช้า'/'บ่าย' shifts
  const getDailyStaffCount = (day: number): number => {
    const dateKey: string = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    let count: number = 0;
    // Iterate over ALL employees to correctly check for part-timers working in other branches
    employees.forEach((employee: Employee) => {
      const shiftEntry: ShiftEntry | undefined = monthlySchedule[dateKey]?.[employee.id];

      const dayOfWeek: number = new Date(currentYear, currentMonth, day).getDay();
      const isClinicDayOffCell: boolean = dayNames[dayOfWeek] === clinicDayOff && clinicDayOff !== 'ไม่มี';
      if (isClinicDayOffCell) {
        return; // Clinic is closed, no staff counted for this day
      }

      if (employee.type === 'full-time') {
        // Only count if the full-time employee belongs to the selected branch
        if (employee.branch === selectedBranch) {
          // Use type guard for string literal comparison
          if (typeof shiftEntry === 'string' && (shiftEntry === 'เช้า' || shiftEntry === 'บ่าย')) {
            count++;
          }
        }
      } else { // Part-time employee
        // Only count if the part-timer is assigned to *this* selected branch for a working shift
        // Use type guard to ensure it's a WorkingShiftObject
        if (isWorkingShiftObject(shiftEntry) && shiftEntry.branch === selectedBranch && (shiftEntry.type === 'เช้า' || shiftEntry.type === 'บ่าย')) {
          count++;
        }
      }
    });
    return count;
  };

  return (
    <div className="font-sans min-h-screen bg-gray-50 flex flex-col p-4 md:p-8">
      <style>{scrollbarStyles}</style> {/* Apply custom scrollbar styles */}

      <h1 className="text-3xl md:text-4xl font-extrabold text-center text-gray-800 mb-8 mt-4">
        <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
          ระบบจัดตารางเวร
        </span> คลินิกชีวาดี
      </h1>

      <CustomModal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        onConfirm={modal.onConfirm}
        onCancel={modal.onCancel}
        showCancel={modal.showCancel}
      />

      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-7xl mx-auto">
        {/* Employee Management Panel */}
        <div className="w-full lg:w-1/3 bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="mr-2">🧑‍⚕️</span> การจัดการพนักงาน
          </h2>

          <div className="mb-8 border-b pb-6 border-gray-200">
            <h3 className="text-xl font-semibold text-gray-700 mb-4">เพิ่มพนักงานใหม่</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="ชื่อ-นามสกุล"
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={newEmployee.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEmployee({ ...newEmployee, name: e.target.value })}
              />
              <input
                type="text"
                placeholder="ตำแหน่ง (เช่น แพทย์แผนไทย, ผู้ช่วยแพทย์)"
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={newEmployee.position}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEmployee({ ...newEmployee, position: e.target.value })}
              />
              <select
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
                value={newEmployee.type}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewEmployee({ ...newEmployee, type: e.target.value as 'full-time' | 'part-time', branch: e.target.value === 'part-time' ? 'พาร์ทไทม์' : initialBranches[0] })}
              >
                <option value="full-time">Full-time (พนักงานประจำ)</option>
                <option value="part-time">Part-time (พนักงานสำรอง)</option>
              </select>
              {newEmployee.type === 'full-time' && (
                <select
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
                  value={newEmployee.branch}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewEmployee({ ...newEmployee, branch: e.target.value })}
                >
                  <option value="">เลือกสาขาประจำ</option>
                  {branches.map((branch: string) => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
              )}
              <button
                onClick={handleAddEmployee}
                className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
              >
                <PlusIcon /> <span className="ml-2">เพิ่มพนักงาน</span>
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-700 mb-4">รายชื่อพนักงาน ({employees.length} คน)</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin">
              {employees.length === 0 ? (
                <p className="text-gray-500 text-center py-4">ยังไม่มีพนักงาน</p>
              ) : (
                employees.map((employee: Employee) => (
                  <div
                    key={employee.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    {editingEmployeeId === employee.id ? (
                      <div className="flex flex-col flex-grow w-full space-y-2">
                        <input
                          type="text"
                          name="name"
                          value={editedEmployee.name}
                          onChange={handleEditEmployeeChange}
                          className="w-full p-2 border border-gray-300 rounded-md text-sm"
                        />
                        <input
                          type="text"
                          name="position"
                          value={editedEmployee.position}
                          onChange={handleEditEmployeeChange}
                          className="w-full p-2 border border-gray-300 rounded-md text-sm"
                        />
                        <select
                          name="type"
                          value={editedEmployee.type}
                          onChange={handleEditEmployeeChange}
                          className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white"
                        >
                          <option value="full-time">Full-time</option>
                          <option value="part-time">Part-time</option>
                        </select>
                        {editedEmployee.type === 'full-time' && (
                          <select
                            name="branch"
                            value={editedEmployee.branch}
                            onChange={handleEditEmployeeChange}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white"
                          >
                            {branches.map((branch: string) => (
                              <option key={branch} value={branch}>{branch}</option>
                            ))}
                          </select>
                        )}
                        <div className="flex space-x-2 mt-2">
                          <button
                            onClick={saveEditEmployee}
                            className="flex-grow flex items-center justify-center px-3 py-2 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors"
                          >
                            <SaveIcon /> <span className="ml-1">บันทึก</span>
                          </button>
                          <button
                            onClick={() => setEditingEmployeeId(null)}
                            className="flex-grow flex items-center justify-center px-3 py-2 bg-gray-400 text-white text-sm rounded-md hover:bg-gray-500 transition-colors"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-grow mb-2 sm:mb-0">
                        <p className="font-semibold text-gray-800">{employee.name}</p>
                        <p className="text-sm text-gray-600">{employee.position} (<span className="font-medium text-blue-600">{employee.type === 'full-time' ? 'ประจำ' : 'สำรอง'}</span>)</p>
                        {employee.type === 'full-time' && (
                           <p className="text-xs text-gray-500">
                             สาขา: <span className="font-medium text-gray-700">{employee.branch}</span>
                           </p>
                        )}
                      </div>
                    )}
                    <div className="flex space-x-2 ml-0 sm:ml-auto">
                      {editingEmployeeId !== employee.id && (
                        <>
                          <button
                            onClick={() => startEditEmployee(employee)}
                            className="p-2 bg-yellow-400 text-white rounded-md hover:bg-yellow-500 transition-colors"
                            aria-label="แก้ไข"
                          >
                            <EditIcon />
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(employee.id)}
                            className="p-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                            aria-label="ลบ"
                          >
                            <TrashIcon />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Monthly Schedule Panel */}
        <div className="w-full lg:w-2/3 bg-white p-6 rounded-xl shadow-lg border border-gray-100 flex flex-col">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="mr-2">🗓️</span> ตารางเวรประจำเดือน
          </h2>

          {/* Month & Branch & Clinic Day Off Navigation/Selection */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 px-4 gap-4">
            {/* Month Navigation */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => changeMonth(-1)}
                className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                aria-label="เดือนก่อนหน้า"
              >
                <ChevronLeftIcon />
              </button>
              <h3 className="text-xl md:text-2xl font-semibold text-gray-700">
                {currentDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
              </h3>
              <button
                onClick={() => changeMonth(1)}
                className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                aria-label="เดือนถัดไป"
              >
                <ChevronRightIcon />
              </button>
            </div>

            {/* Branch Selector */}
            <div className="flex items-center space-x-2">
              <label htmlFor="branch-select" className="text-gray-700 font-medium whitespace-nowrap">เลือกสาขา:</label>
              <select
                id="branch-select"
                value={selectedBranch}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedBranch(e.target.value)}
                className="p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {branches.map((branch: string) => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>

            {/* Clinic Day Off Selector */}
            <div className="flex items-center space-x-2">
              <label htmlFor="clinic-day-off" className="text-gray-700 font-medium whitespace-nowrap">วันหยุดคลินิก:</label>
              <select
                id="clinic-day-off"
                value={clinicDayOff}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setClinicDayOff(e.target.value)}
                className="p-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 bg-white"
              >
                {dayNames.map((day: string) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Schedule Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-20 w-40 min-w-[160px] border-r border-gray-200">
                    พนักงาน / วันที่
                  </th>
                  {daysArray.map((day: number) => {
                    const dayOfWeek: number = new Date(currentYear, currentMonth, day).getDay();
                    const isClinicDayOffColumn: boolean = dayNames[dayOfWeek] === clinicDayOff;
                    return (
                      <th
                        key={day}
                        className={`px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-100 ${isClinicDayOffColumn ? 'bg-purple-100 text-purple-800' : ''}`}
                      >
                        {day}
                      </th>
                    );
                  })}
                </tr>
                {/* Row for Daily Staff Count */}
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-100 z-20 w-40 min-w-[160px] border-r border-gray-200">
                    <span className="text-blue-700">พนักงานทำงาน / วัน</span>
                    <p className="text-[10px] text-gray-500 font-normal mt-1">(เป้าหมาย 3-4 คน)</p>
                  </th>
                  {daysArray.map((day: number) => {
                    const count: number = getDailyStaffCount(day);
                    const isCountAlert: boolean = count < 3 || count > 4; // Alert if not 3 or 4
                    const dayOfWeek: number = new Date(currentYear, currentMonth, day).getDay();
                    const isClinicDayOffColumn: boolean = dayNames[dayOfWeek] === clinicDayOff;
                    return (
                      <th
                        key={`count-${day}`}
                        className={`px-3 py-3 text-center text-sm font-bold ${isCountAlert && !isClinicDayOffColumn ? 'bg-red-100 text-red-700' : 'text-gray-800'} ${isClinicDayOffColumn ? 'bg-purple-100 text-purple-800' : ''} border-l border-gray-100`}
                      >
                        {isClinicDayOffColumn ? 'ปิด' : count}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={daysInMonth + 2} className="px-6 py-4 whitespace-nowrap text-center text-gray-500">
                      ไม่พบพนักงานในสาขาที่เลือก หรือกรุณาเพิ่มพนักงาน
                    </td>
                  </tr>
                ) : (
                  displayedEmployees.map((employee: Employee) => (
                    <tr key={employee.id}>
                      <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white z-10 w-40 min-w-[160px] border-r border-gray-200">
                        <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                        <div className="text-xs text-gray-500">{employee.position}</div>
                        <div className="text-xs text-blue-600">
                          {employee.type === 'full-time' ? `(${employee.branch})` : '(พาร์ทไทม์)'}
                        </div>
                      </td>
                      {daysArray.map((day: number) => {
                        const dayOfWeek: number = new Date(currentYear, currentMonth, day).getDay();
                        const isClinicDayOffCell: boolean = dayNames[dayOfWeek] === clinicDayOff;
                        const currentShift: BaseShiftString = getShiftValue(employee.id, day); // Now guaranteed to be BaseShiftString

                        // Determine the displayed value and disabled state for the select
                        const displayShiftValue: BaseShiftString = isClinicDayOffCell ? 'ปิด' : currentShift; // currentShift is already BaseShiftString
                        const isDisabled: boolean = isClinicDayOffCell;

                        // Apply background color to the cell itself
                        const cellBgColor: string = isClinicDayOffCell ? 'bg-purple-50' : getShiftBgColor(displayShiftValue);

                        return (
                          <td key={day} className={`px-2 py-1 text-center border-l border-gray-100 ${cellBgColor}`}>
                            <select
                              value={displayShiftValue}
                              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                if (!isDisabled) { // Only allow change if not clinic day off
                                  handleShiftChange(employee.id, day, e.target.value); // Passed value as string
                                }
                              }}
                              className={`w-full p-1 border border-transparent rounded-md text-xs focus:ring-blue-500 focus:border-blue-500 transition-colors ${getShiftBgColor(displayShiftValue)} bg-opacity-70`}
                              disabled={isDisabled}
                            >
                              {isDisabled ? (
                                <option value="ปิด">ปิด</option> // Only 'ปิด' option if clinic is off
                              ) : (
                                <>
                                  <option value="">-</option>
                                  <option value="เช้า">เช้า</option>
                                  <option value="บ่าย">บ่าย</option>
                                  <option value="หยุด">หยุด</option>
                                  <option value="ลา">ลา</option>
                                  <option value="ป่วย">ป่วย</option>
                                </>
                              )}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-gray-600 text-right pr-2">
            💡 เลือก 'ลา' หรือ 'ป่วย' เพื่อระบุการหยุดงานของพนักงาน | สถานะ 'ปิด' สำหรับวันหยุดคลินิก
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;