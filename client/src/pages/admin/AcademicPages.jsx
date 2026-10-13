import CrudTable from '../../components/CrudTable';
import { useApiData } from '../../hooks/useApiData';

// The four academic-structure pages. Each is a CrudTable configured with its fields.
// Hierarchy: department → course → subject / semester

export function Departments() {
  return (
    <div>
      <h1>Departments</h1>
      <CrudTable endpoint="/departments" idKey="department_id" noun="department"
        fields={[{ name: 'department_name', label: 'Name', type: 'text' }]} />
    </div>
  );
}

export function Courses() {
  const { data: departments } = useApiData('/departments');
  return (
    <div>
      <h1>Courses</h1>
      <CrudTable endpoint="/courses" idKey="course_id" noun="course"
        fields={[
          { name: 'course_name', label: 'Name', type: 'text' },
          { name: 'department_id', label: 'Department', type: 'select',
            options: departments.map(d => ({ value: d.department_id, label: d.department_name })) }
        ]} />
    </div>
  );
}

export function Subjects() {
  const { data: courses } = useApiData('/courses');
  return (
    <div>
      <h1>Subjects</h1>
      <CrudTable endpoint="/subjects" idKey="subject_id" noun="subject"
        fields={[
          { name: 'subject_name', label: 'Name', type: 'text' },
          { name: 'course_id', label: 'Course', type: 'select',
            options: courses.map(c => ({ value: c.course_id, label: c.course_name })) }
        ]} />
    </div>
  );
}

export function Semesters() {
  const { data: courses } = useApiData('/courses');
  return (
    <div>
      <h1>Semesters</h1>
      <CrudTable endpoint="/semesters" idKey="semester_id" noun="semester"
        fields={[
          // Course first so the list is grouped by course
          { name: 'course_id', label: 'Course', type: 'select',
            options: courses.map(c => ({ value: c.course_id, label: c.course_name })) },
          { name: 'semester_number', label: 'Semester number', type: 'number', min: 1, max: 12 }
        ]} />
    </div>
  );
}
