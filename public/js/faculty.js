// ── Faculty Dashboard JavaScript ──

// ── Globals ──
let currentUser = null;
let allStudents = [];
let allSubjects = [];

// ── Toast ──
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── API Helper ──
async function api(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data.errors
      ? data.errors.map((e) => e.message || e.msg).join(', ')
      : data.message;
    throw new Error(msg || 'Something went wrong');
  }

  return data;
}

// ── Auth Check ──
async function checkAuth() {
  try {
    const data = await api('/api/auth/me');
    currentUser = data.data.user;

    if (currentUser.role !== 'faculty') {
      window.location.href = '/student';
      return;
    }

    document.getElementById('user-name').textContent = currentUser.name;
    document.getElementById('user-avatar').textContent = currentUser.name.charAt(0).toUpperCase();

    // Load initial data
    await Promise.all([loadStudents(), loadSubjects()]);
  } catch (e) {
    window.location.href = '/';
  }
}

// ── Tab Navigation ──
document.querySelectorAll('.nav-item[data-tab]').forEach((item) => {
  item.addEventListener('click', () => {
    // Update nav
    document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
    item.classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach((t) => t.classList.remove('active'));
    const tabId = `tab-${item.dataset.tab}`;
    document.getElementById(tabId).classList.add('active');

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
  });
});

// Mobile toggle
document.getElementById('mobile-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ── Logout ──
document.getElementById('logout-btn').addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  } catch (e) {
    showToast(e.message, 'error');
  }
});

// ═══════════════════════════════════════════
// STUDENTS
// ═══════════════════════════════════════════

async function loadStudents() {
  try {
    const data = await api('/api/faculty/students');
    allStudents = data.data.students;
    renderStudents();
  } catch (e) {
    showToast('Failed to load students: ' + e.message, 'error');
  }
}

function renderStudents() {
  const tbody = document.getElementById('students-table-body');
  const statsEl = document.getElementById('students-stats');

  // Stats
  statsEl.innerHTML = `
    <div class="stat-card accent">
      <div class="stat-icon">👨‍🎓</div>
      <div class="stat-value">${allStudents.length}</div>
      <div class="stat-label">Total Students</div>
    </div>
  `;

  if (allStudents.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="4">
        <div class="empty-state">
          <div class="empty-icon">👨‍🎓</div>
          <h3>No students registered yet</h3>
          <p>Students will appear here once they register</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = allStudents
    .map((s) => `
      <tr>
        <td><strong>${s.user.name}</strong></td>
        <td>${s.user.email}</td>
        <td><span class="badge badge-info">${s.enrollment_no}</span></td>
        <td>${s.department || '—'}</td>
      </tr>
    `)
    .join('');
}

// ═══════════════════════════════════════════
// SUBJECTS
// ═══════════════════════════════════════════

async function loadSubjects() {
  try {
    const data = await api('/api/faculty/subjects');
    allSubjects = data.data.subjects;
    renderSubjects();
    populateSubjectDropdowns();
  } catch (e) {
    showToast('Failed to load subjects: ' + e.message, 'error');
  }
}

function renderSubjects() {
  const tbody = document.getElementById('subjects-table-body');

  if (allSubjects.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="4">
        <div class="empty-state">
          <div class="empty-icon">📚</div>
          <h3>No subjects yet</h3>
          <p>Click "Add Subject" to create one</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = allSubjects
    .map((s) => `
      <tr>
        <td><span class="badge badge-info">${s.code}</span></td>
        <td><strong>${s.name}</strong></td>
        <td>${s.faculty ? s.faculty.name : '—'}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteSubject(${s.id})">Delete</button>
        </td>
      </tr>
    `)
    .join('');
}

function populateSubjectDropdowns() {
  const dropdowns = ['att-subject', 'att-view-subject', 'marks-subject', 'marks-view-subject'];
  dropdowns.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = '<option value="">Select subject</option>';
    allSubjects.forEach((s) => {
      el.innerHTML += `<option value="${s.id}">${s.code} — ${s.name}</option>`;
    });
    el.value = current;
  });
}

// Add Subject Modal
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
    await api('/api/faculty/subjects', {
      method: 'POST',
      body: JSON.stringify({ name, code }),
    });
    showToast('Subject created!', 'success');
    closeSubjectModal();
    await loadSubjects();
  } catch (e) {
    showToast(e.message, 'error');
  }
});

async function deleteSubject(id) {
  if (!confirm('Delete this subject? This will also remove related attendance and marks.')) return;

  try {
    await api(`/api/faculty/subjects/${id}`, { method: 'DELETE' });
    showToast('Subject deleted', 'success');
    await loadSubjects();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ═══════════════════════════════════════════
// ATTENDANCE
// ═══════════════════════════════════════════

// When subject is selected, load students for marking
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

  // Set default date to today
  const dateInput = document.getElementById('att-date');
  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  listEl.innerHTML = allStudents
    .map((s) => `
      <div class="attendance-row">
        <span class="student-name">${s.user.name} <span style="color:var(--text-muted);font-size:0.8rem;">(${s.enrollment_no})</span></span>
        <div class="attendance-toggle">
          <label>
            <input type="radio" name="att-${s.id}" value="present" checked>
            <span class="present-label">✓ Present</span>
          </label>
          <label>
            <input type="radio" name="att-${s.id}" value="absent">
            <span class="absent-label">✗ Absent</span>
          </label>
        </div>
      </div>
    `)
    .join('');

  submitBtn.disabled = false;
});

document.getElementById('submit-attendance-btn').addEventListener('click', async () => {
  const subjectId = document.getElementById('att-subject').value;
  const date = document.getElementById('att-date').value;

  if (!subjectId || !date) {
    showToast('Please select subject and date', 'warning');
    return;
  }

  const records = allStudents.map((s) => {
    const radio = document.querySelector(`input[name="att-${s.id}"]:checked`);
    return {
      student_id: s.id,
      status: radio ? radio.value : 'present',
    };
  });

  try {
    await api('/api/faculty/attendance', {
      method: 'POST',
      body: JSON.stringify({ subject_id: parseInt(subjectId), date, records }),
    });
    showToast('Attendance submitted!', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
});

// View Attendance Records
document.getElementById('load-attendance-btn').addEventListener('click', async () => {
  const subjectId = document.getElementById('att-view-subject').value;
  if (!subjectId) {
    showToast('Select a subject first', 'warning');
    return;
  }

  try {
    const data = await api(`/api/faculty/attendance/${subjectId}`);
    const tbody = document.getElementById('attendance-records-body');

    if (data.data.attendance.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:2rem; color:var(--text-muted);">No attendance records found</td></tr>';
      return;
    }

    tbody.innerHTML = data.data.attendance
      .map((a) => `
        <tr>
          <td>${a.student?.user?.name || '—'}</td>
          <td><span class="badge badge-info">${a.student?.enrollment_no || '—'}</span></td>
          <td>${a.date}</td>
          <td><span class="badge ${a.status === 'present' ? 'badge-success' : 'badge-danger'}">${a.status}</span></td>
        </tr>
      `)
      .join('');
  } catch (e) {
    showToast(e.message, 'error');
  }
});

// ═══════════════════════════════════════════
// MARKS
// ═══════════════════════════════════════════

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

  listEl.innerHTML = allStudents
    .map((s) => `
      <div class="attendance-row">
        <span class="student-name">${s.user.name} <span style="color:var(--text-muted);font-size:0.8rem;">(${s.enrollment_no})</span></span>
        <div>
          <input type="number" class="search-input" style="width:80px; text-align:center;" 
                 id="marks-input-${s.id}" min="0" max="100" placeholder="0-100">
        </div>
      </div>
    `)
    .join('');

  submitBtn.disabled = false;
});

document.getElementById('submit-marks-btn').addEventListener('click', async () => {
  const subjectId = document.getElementById('marks-subject').value;
  if (!subjectId) {
    showToast('Please select a subject', 'warning');
    return;
  }

  const records = [];
  allStudents.forEach((s) => {
    const input = document.getElementById(`marks-input-${s.id}`);
    if (input && input.value !== '') {
      records.push({
        student_id: s.id,
        marks: parseInt(input.value),
      });
    }
  });

  if (records.length === 0) {
    showToast('Please enter marks for at least one student', 'warning');
    return;
  }

  try {
    const data = await api('/api/faculty/marks', {
      method: 'POST',
      body: JSON.stringify({ subject_id: parseInt(subjectId), records }),
    });

    // Check for errors in individual records
    const errors = data.data.results.filter((r) => r.error);
    if (errors.length > 0) {
      errors.forEach((e) => showToast(`Student ${e.student_id}: ${e.error}`, 'warning'));
    }

    const successes = data.data.results.filter((r) => r.action === 'created');
    if (successes.length > 0) {
      showToast(`Marks added for ${successes.length} student(s)!`, 'success');
    }
  } catch (e) {
    showToast(e.message, 'error');
  }
});

// View Marks
document.getElementById('load-marks-btn').addEventListener('click', async () => {
  const subjectId = document.getElementById('marks-view-subject').value;
  if (!subjectId) {
    showToast('Select a subject first', 'warning');
    return;
  }

  try {
    const data = await api(`/api/faculty/marks/${subjectId}`);
    const tbody = document.getElementById('marks-records-body');

    if (data.data.marks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:2rem; color:var(--text-muted);">No marks records found</td></tr>';
      return;
    }

    tbody.innerHTML = data.data.marks
      .map((m) => `
        <tr>
          <td>${m.student?.user?.name || '—'}</td>
          <td><span class="badge badge-info">${m.student?.enrollment_no || '—'}</span></td>
          <td><strong>${m.marks}</strong>/100</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="openEditMarks(${m.id}, ${m.marks})">Edit</button>
          </td>
        </tr>
      `)
      .join('');
  } catch (e) {
    showToast(e.message, 'error');
  }
});

// Edit Marks Modal
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
  const marks = parseInt(document.getElementById('edit-marks-value').value);

  if (isNaN(marks) || marks < 0 || marks > 100) {
    showToast('Marks must be between 0 and 100', 'warning');
    return;
  }

  try {
    await api(`/api/faculty/marks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ marks }),
    });
    showToast('Marks updated!', 'success');
    closeEditMarksModal();

    // Reload marks view
    document.getElementById('load-marks-btn').click();
  } catch (e) {
    showToast(e.message, 'error');
  }
});

// ── Close modals on overlay click ──
document.querySelectorAll('.modal-overlay').forEach((overlay) => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
    }
  });
});

// ── Initialize ──
checkAuth();
