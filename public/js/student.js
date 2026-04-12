// ── Student Dashboard JavaScript ──

let currentUser = null;

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
async function api(url) {
  const res = await fetch(url, { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}

// ── Grade Helper ──
function getGrade(marks) {
  if (marks >= 90) return { grade: 'A+', class: 'badge-success' };
  if (marks >= 80) return { grade: 'A', class: 'badge-success' };
  if (marks >= 70) return { grade: 'B', class: 'badge-info' };
  if (marks >= 60) return { grade: 'C', class: 'badge-warning' };
  if (marks >= 50) return { grade: 'D', class: 'badge-warning' };
  return { grade: 'F', class: 'badge-danger' };
}

// ── Attendance color ──
function getAttendanceClass(percentage) {
  if (percentage >= 75) return 'success';
  if (percentage >= 50) return 'warning';
  return 'danger';
}

// ── Auth Check ──
async function checkAuth() {
  try {
    const data = await api('/api/auth/me');
    currentUser = data.data.user;

    if (currentUser.role !== 'student') {
      window.location.href = '/faculty';
      return;
    }

    document.getElementById('user-name').textContent = currentUser.name;
    document.getElementById('user-avatar').textContent = currentUser.name.charAt(0).toUpperCase();

    loadDashboard();
    loadAttendance();
    loadMarks();
    loadSubjects();
  } catch (e) {
    window.location.href = '/';
  }
}

// ── Tab Navigation ──
document.querySelectorAll('.nav-item[data-tab]').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
    item.classList.add('active');

    document.querySelectorAll('.tab-content').forEach((t) => t.classList.remove('active'));
    document.getElementById(`tab-${item.dataset.tab}`).classList.add('active');

    document.getElementById('sidebar').classList.remove('open');
  });
});

document.getElementById('mobile-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ── Logout ──
document.getElementById('logout-btn').addEventListener('click', async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/';
  } catch (e) {
    showToast(e.message, 'error');
  }
});

// ═══════════════════════════════════════════
// DASHBOARD OVERVIEW
// ═══════════════════════════════════════════

async function loadDashboard() {
  try {
    const data = await api('/api/student/dashboard');
    const { student, overview, subjectAttendance, marks } = data.data;

    // Greeting
    document.getElementById('greeting').textContent = `Welcome, ${student.name}!`;
    document.getElementById('student-info').textContent =
      `${student.enrollment_no} • ${student.department || 'No department'}`;

    // Stats cards
    const attClass = getAttendanceClass(overview.overallAttendance);
    const avgGrade = getGrade(overview.averageMarks);

    document.getElementById('overview-stats').innerHTML = `
      <div class="stat-card accent">
        <div class="stat-icon">📚</div>
        <div class="stat-value">${overview.totalSubjects}</div>
        <div class="stat-label">Subjects</div>
      </div>
      <div class="stat-card ${attClass === 'success' ? 'success' : attClass === 'warning' ? 'warning' : ''}">
        <div class="stat-icon">📋</div>
        <div class="stat-value">${overview.overallAttendance}%</div>
        <div class="stat-label">Overall Attendance</div>
        <div class="progress-bar mt-1">
          <div class="progress-fill ${attClass}" style="width:${overview.overallAttendance}%"></div>
        </div>
      </div>
      <div class="stat-card info">
        <div class="stat-icon">📝</div>
        <div class="stat-value">${overview.averageMarks}</div>
        <div class="stat-label">Average Marks <span class="badge ${avgGrade.class}" style="margin-left:0.5rem;">${avgGrade.grade}</span></div>
      </div>
    `;

    // Attendance by subject table
    const attBody = document.getElementById('overview-attendance-body');
    if (subjectAttendance.length === 0) {
      attBody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:2rem;color:var(--text-muted);">No attendance records yet</td></tr>';
    } else {
      attBody.innerHTML = subjectAttendance
        .map((a) => {
          const cls = getAttendanceClass(a.percentage);
          return `
            <tr>
              <td><strong>${a.subject.name}</strong></td>
              <td>${a.present}</td>
              <td>${a.total}</td>
              <td>
                <div style="display:flex;align-items:center;gap:0.5rem;">
                  <div class="progress-bar" style="width:100px;">
                    <div class="progress-fill ${cls}" style="width:${a.percentage}%"></div>
                  </div>
                  <span>${a.percentage}%</span>
                </div>
              </td>
              <td><span class="badge badge-${cls === 'success' ? 'success' : cls === 'warning' ? 'warning' : 'danger'}">${a.percentage >= 75 ? 'Good' : a.percentage >= 50 ? 'Low' : 'Critical'}</span></td>
            </tr>
          `;
        })
        .join('');
    }

    // Marks overview table
    const marksBody = document.getElementById('overview-marks-body');
    if (marks.length === 0) {
      marksBody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:2rem;color:var(--text-muted);">No marks yet</td></tr>';
    } else {
      marksBody.innerHTML = marks
        .map((m) => {
          const g = getGrade(m.marks);
          return `
            <tr>
              <td><strong>${m.subject.name}</strong></td>
              <td><span class="badge badge-info">${m.subject.code}</span></td>
              <td><strong>${m.marks}</strong>/100</td>
              <td><span class="badge ${g.class}">${g.grade}</span></td>
            </tr>
          `;
        })
        .join('');
    }
  } catch (e) {
    showToast('Failed to load dashboard: ' + e.message, 'error');
  }
}

// ═══════════════════════════════════════════
// DETAILED ATTENDANCE
// ═══════════════════════════════════════════

async function loadAttendance() {
  try {
    const data = await api('/api/student/attendance');
    const tbody = document.getElementById('attendance-detail-body');

    if (data.data.attendance.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:2rem;color:var(--text-muted);">No attendance records yet</td></tr>';
      return;
    }

    tbody.innerHTML = data.data.attendance
      .map((a) => `
        <tr>
          <td>${a.date}</td>
          <td><strong>${a.subject.name}</strong></td>
          <td><span class="badge badge-info">${a.subject.code}</span></td>
          <td><span class="badge ${a.status === 'present' ? 'badge-success' : 'badge-danger'}">${a.status}</span></td>
        </tr>
      `)
      .join('');
  } catch (e) {
    showToast('Failed to load attendance', 'error');
  }
}

// ═══════════════════════════════════════════
// DETAILED MARKS
// ═══════════════════════════════════════════

async function loadMarks() {
  try {
    const data = await api('/api/student/marks');
    const tbody = document.getElementById('marks-detail-body');

    if (data.data.marks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:2rem;color:var(--text-muted);">No marks yet</td></tr>';
      return;
    }

    tbody.innerHTML = data.data.marks
      .map((m) => {
        const g = getGrade(m.marks);
        return `
          <tr>
            <td><strong>${m.subject.name}</strong></td>
            <td><span class="badge badge-info">${m.subject.code}</span></td>
            <td><strong>${m.marks}</strong>/100</td>
            <td><span class="badge ${g.class}">${g.grade}</span></td>
          </tr>
        `;
      })
      .join('');
  } catch (e) {
    showToast('Failed to load marks', 'error');
  }
}

// ═══════════════════════════════════════════
// SUBJECTS
// ═══════════════════════════════════════════

async function loadSubjects() {
  try {
    const data = await api('/api/student/subjects');
    const tbody = document.getElementById('subjects-detail-body');

    if (data.data.subjects.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center" style="padding:2rem;color:var(--text-muted);">No subjects enrolled yet</td></tr>';
      return;
    }

    tbody.innerHTML = data.data.subjects
      .map((s) => `
        <tr>
          <td><span class="badge badge-info">${s.code}</span></td>
          <td><strong>${s.name}</strong></td>
          <td>${s.faculty?.name || '—'}</td>
        </tr>
      `)
      .join('');
  } catch (e) {
    showToast('Failed to load subjects', 'error');
  }
}

// ── Initialize ──
checkAuth();
