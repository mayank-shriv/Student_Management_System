let currentUser = null;
let allStudents = [];
let allSubjects = [];

async function checkAuth() {
  try {
    const data = await apiRequest('/api/auth/me');
    currentUser = data.data.user;

    if (currentUser.role !== 'faculty') {
      window.location.href = '/student';
      return;
    }

    document.getElementById('user-name').textContent = currentUser.name;
    document.getElementById('user-avatar').textContent = currentUser.name.charAt(0).toUpperCase();

    await Promise.all([loadStudents(), loadSubjects()]);
  } catch (error) {
    window.location.href = '/';
  }
}

document.querySelectorAll('.nav-item[data-tab]').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((navItem) => navItem.classList.remove('active'));
    item.classList.add('active');

    document.querySelectorAll('.tab-content').forEach((tab) => tab.classList.remove('active'));
    const tabId = `tab-${item.dataset.tab}`;
    document.getElementById(tabId).classList.add('active');

    document.getElementById('sidebar').classList.remove('open');
  });
});

document.getElementById('mobile-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' }, false);
    window.location.href = '/';
  } catch (error) {
    showToast(error.message, 'error');
  }
});

async function loadStudents() {
  try {
    const data = await apiRequest('/api/faculty/students');
    allStudents = data.data.students;
    renderStudents();
  } catch (error) {
    showToast(`Failed to load students: ${error.message}`, 'error');
  }
}

function renderStudents() {
  const tbody = document.getElementById('students-table-body');
  const statsEl = document.getElementById('students-stats');

  statsEl.innerHTML = `
    <div class="stat-card accent">
      <div class="stat-icon">STU</div>
      <div class="stat-value">${allStudents.length}</div>
      <div class="stat-label">Total Students</div>
    </div>
  `;

  if (allStudents.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="4">
        <div class="empty-state">
          <div class="empty-icon">STU</div>
          <h3>No students registered yet</h3>
          <p>Students will appear here once they register</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = allStudents.map((student) => `
      <tr>
        <td><strong>${escapeHtml(student.user.name)}</strong></td>
        <td>${escapeHtml(student.user.email)}</td>
        <td><span class="badge badge-info">${escapeHtml(student.enrollment_no)}</span></td>
        <td>${escapeHtml(student.department || '-')}</td>
      </tr>
    `).join('');
}

async function loadSubjects() {
  try {
    const data = await apiRequest('/api/faculty/subjects');
    allSubjects = data.data.subjects;
    renderSubjects();
    populateSubjectDropdowns();
  } catch (error) {
    showToast(`Failed to load subjects: ${error.message}`, 'error');
  }
}

function renderSubjects() {
  const tbody = document.getElementById('subjects-table-body');

  if (allSubjects.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="4">
        <div class="empty-state">
          <div class="empty-icon">SUB</div>
          <h3>No subjects yet</h3>
          <p>Click "Add Subject" to create one</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = allSubjects.map((subject) => `
      <tr>
        <td><span class="badge badge-info">${escapeHtml(subject.code)}</span></td>
        <td><strong>${escapeHtml(subject.name)}</strong></td>
        <td>${subject.faculty ? escapeHtml(subject.faculty.name) : '-'}</td>
        <td>
          <button class="btn btn-danger btn-sm delete-subject-btn" data-id="${subject.id}">Delete</button>
        </td>
      </tr>
    `).join('');
}

function populateSubjectDropdowns() {
  const dropdowns = ['att-subject', 'att-view-subject', 'marks-subject', 'marks-view-subject'];
  dropdowns.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Select subject';
    el.appendChild(defaultOpt);
    allSubjects.forEach((subject) => {
      const opt = document.createElement('option');
      opt.value = subject.id;
      opt.textContent = `${subject.code} - ${subject.name}`;
      el.appendChild(opt);
    });
    el.value = current;
  });
}

document.getElementById('add-subject-btn').addEventListener('click', () => {
  document.getElementById('subject-modal').classList.add('active');
  document.getElementById('subject-name').value = '';
  document.getElementById('subject-code').value = '';
});

function closeSubjectModal() {
  document.getElementById('subject-modal').classList.remove('active');
}

document.getElementById('close-subject-modal').addEventListener('click', closeSubjectModal);
document.getElementById('cancel-subject-btn').addEventListener('click', closeSubjectModal);

document.getElementById('save-subject-btn').addEventListener('click', async () => {
  const name = document.getElementById('subject-name').value.trim();
  const code = document.getElementById('subject-code').value.trim();

  if (!name || !code) {
    showToast('Please fill all fields', 'warning');
    return;
  }

  try {
    await apiRequest('/api/faculty/subjects', {
      method: 'POST',
      body: JSON.stringify({ name, code }),
    });
    showToast('Subject created!', 'success');
    closeSubjectModal();
    await loadSubjects();
  } catch (error) {
    showToast(error.message, 'error');
  }
});

async function deleteSubject(id) {
  if (!confirm('Delete this subject? This will also remove related attendance and marks.')) return;

  try {
    await apiRequest(`/api/faculty/subjects/${id}`, { method: 'DELETE' });
    showToast('Subject deleted', 'success');
    await loadSubjects();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

document.getElementById('att-subject').addEventListener('change', () => {
  const subjectId = document.getElementById('att-subject').value;
  const listEl = document.getElementById('attendance-list');
  const submitBtn = document.getElementById('submit-attendance-btn');

  if (!subjectId) {
    listEl.innerHTML = '<div class="empty-state"><p>Select a subject to load students</p></div>';
    submitBtn.disabled = true;
    return;
  }

  if (allStudents.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><p>No students registered</p></div>';
    submitBtn.disabled = true;
    return;
  }

  const dateInput = document.getElementById('att-date');
  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  listEl.innerHTML = allStudents.map((student) => `
      <div class="attendance-row">
        <span class="student-name">${escapeHtml(student.user.name)} <span style="color:var(--text-muted);font-size:0.8rem;">(${escapeHtml(student.enrollment_no)})</span></span>
        <div class="attendance-toggle">
          <label>
            <input type="radio" name="att-${student.id}" value="present" checked>
            <span class="present-label">P Present</span>
          </label>
          <label>
            <input type="radio" name="att-${student.id}" value="absent">
            <span class="absent-label">A Absent</span>
          </label>
        </div>
      </div>
    `).join('');

  submitBtn.disabled = false;
});

document.getElementById('submit-attendance-btn').addEventListener('click', async () => {
  const subjectId = document.getElementById('att-subject').value;
  const date = document.getElementById('att-date').value;

  if (!subjectId || !date) {
    showToast('Please select subject and date', 'warning');
    return;
  }

  const records = allStudents.map((student) => {
    const radio = document.querySelector(`input[name="att-${student.id}"]:checked`);
    return {
      student_id: student.id,
      status: radio ? radio.value : 'present',
    };
  });

  try {
    await apiRequest('/api/faculty/attendance', {
      method: 'POST',
      body: JSON.stringify({ subject_id: parseInt(subjectId, 10), date, records }),
    });
    showToast('Attendance submitted!', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

document.getElementById('load-attendance-btn').addEventListener('click', async () => {
  const subjectId = document.getElementById('att-view-subject').value;
  if (!subjectId) {
    showToast('Select a subject first', 'warning');
    return;
  }

  try {
    const data = await apiRequest(`/api/faculty/attendance/${subjectId}`);
    const tbody = document.getElementById('attendance-records-body');

    if (data.data.attendance.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:2rem; color:var(--text-muted);">No attendance records found</td></tr>';
      return;
    }

    tbody.innerHTML = data.data.attendance.map((attendance) => `
        <tr>
          <td>${escapeHtml(attendance.student?.user?.name || '-')}</td>
          <td><span class="badge badge-info">${escapeHtml(attendance.student?.enrollment_no || '-')}</span></td>
          <td>${attendance.date}</td>
          <td><span class="badge ${attendance.status === 'present' ? 'badge-success' : 'badge-danger'}">${attendance.status}</span></td>
        </tr>
      `).join('');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

document.getElementById('marks-subject').addEventListener('change', () => {
  const subjectId = document.getElementById('marks-subject').value;
  const listEl = document.getElementById('marks-list');
  const submitBtn = document.getElementById('submit-marks-btn');

  if (!subjectId) {
    listEl.innerHTML = '<div class="empty-state"><p>Select a subject to load students</p></div>';
    submitBtn.disabled = true;
    return;
  }

  if (allStudents.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><p>No students registered</p></div>';
    submitBtn.disabled = true;
    return;
  }

  listEl.innerHTML = allStudents.map((student) => `
      <div class="attendance-row">
        <span class="student-name">${escapeHtml(student.user.name)} <span style="color:var(--text-muted);font-size:0.8rem;">(${escapeHtml(student.enrollment_no)})</span></span>
        <div>
          <input type="number" class="search-input" style="width:80px; text-align:center;"
                 id="marks-input-${student.id}" min="0" max="100" placeholder="0-100">
        </div>
      </div>
    `).join('');

  submitBtn.disabled = false;
});

document.getElementById('submit-marks-btn').addEventListener('click', async () => {
  const subjectId = document.getElementById('marks-subject').value;
  if (!subjectId) {
    showToast('Please select a subject', 'warning');
    return;
  }

  const records = [];
  allStudents.forEach((student) => {
    const input = document.getElementById(`marks-input-${student.id}`);
    if (input && input.value !== '') {
      records.push({
        student_id: student.id,
        marks: parseInt(input.value, 10),
      });
    }
  });

  if (records.length === 0) {
    showToast('Please enter marks for at least one student', 'warning');
    return;
  }

  try {
    const data = await apiRequest('/api/faculty/marks', {
      method: 'POST',
      body: JSON.stringify({ subject_id: parseInt(subjectId, 10), records }),
    });

    const errors = data.data.results.filter((result) => result.error);
    if (errors.length > 0) {
      errors.forEach((result) => showToast(`Student ${result.student_id}: ${result.error}`, 'warning'));
    }

    const successes = data.data.results.filter((result) => result.action === 'created');
    if (successes.length > 0) {
      showToast(`Marks added for ${successes.length} student(s)!`, 'success');
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
});

document.getElementById('load-marks-btn').addEventListener('click', async () => {
  const subjectId = document.getElementById('marks-view-subject').value;
  if (!subjectId) {
    showToast('Select a subject first', 'warning');
    return;
  }

  try {
    const data = await apiRequest(`/api/faculty/marks/${subjectId}`);
    const tbody = document.getElementById('marks-records-body');

    if (data.data.marks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:2rem; color:var(--text-muted);">No marks records found</td></tr>';
      return;
    }

    tbody.innerHTML = data.data.marks.map((mark) => `
        <tr>
          <td>${escapeHtml(mark.student?.user?.name || '-')}</td>
          <td><span class="badge badge-info">${escapeHtml(mark.student?.enrollment_no || '-')}</span></td>
          <td><strong>${mark.marks}</strong>/100</td>
          <td>
            <button class="btn btn-secondary btn-sm edit-marks-btn" data-id="${mark.id}" data-marks="${mark.marks}">Edit</button>
          </td>
        </tr>
      `).join('');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

function openEditMarks(id, currentMarks) {
  document.getElementById('edit-marks-modal').classList.add('active');
  document.getElementById('edit-mark-id').value = id;
  document.getElementById('edit-marks-value').value = currentMarks;
}

function closeEditMarksModal() {
  document.getElementById('edit-marks-modal').classList.remove('active');
}

document.getElementById('close-edit-marks-modal').addEventListener('click', closeEditMarksModal);
document.getElementById('cancel-edit-marks-btn').addEventListener('click', closeEditMarksModal);

document.getElementById('save-edit-marks-btn').addEventListener('click', async () => {
  const id = document.getElementById('edit-mark-id').value;
  const marks = parseInt(document.getElementById('edit-marks-value').value, 10);

  if (isNaN(marks) || marks < 0 || marks > 100) {
    showToast('Marks must be between 0 and 100', 'warning');
    return;
  }

  try {
    await apiRequest(`/api/faculty/marks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ marks }),
    });
    showToast('Marks updated!', 'success');
    closeEditMarksModal();
    document.getElementById('load-marks-btn').click();
  } catch (error) {
    showToast(error.message, 'error');
  }
});

document.querySelectorAll('.modal-overlay').forEach((overlay) => {
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      overlay.classList.remove('active');
    }
  });
});

document.addEventListener('click', (e) => {
  const deleteBtn = e.target.closest('.delete-subject-btn');
  if (deleteBtn) {
    deleteSubject(parseInt(deleteBtn.dataset.id, 10));
    return;
  }

  const editBtn = e.target.closest('.edit-marks-btn');
  if (editBtn) {
    openEditMarks(parseInt(editBtn.dataset.id, 10), parseInt(editBtn.dataset.marks, 10));
    return;
  }
});

checkAuth();
