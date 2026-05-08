// ── Student Dashboard Logic ──
// Depends on common.js being loaded first.

let currentUser = null;

function getGrade(marks) {
  if (marks >= 90) return { grade: 'A+', class: 'badge-success' };
  if (marks >= 80) return { grade: 'A', class: 'badge-success' };
  if (marks >= 70) return { grade: 'B', class: 'badge-info' };
  if (marks >= 60) return { grade: 'C', class: 'badge-warning' };
  if (marks >= 50) return { grade: 'D', class: 'badge-warning' };
  return { grade: 'F', class: 'badge-danger' };
}

function getAttendanceClass(percentage) {
  if (percentage >= 75) return 'success';
  if (percentage >= 50) return 'warning';
  return 'danger';
}

async function checkAuth() {
  try {
    const data = await apiRequest('/api/auth/me');
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
  } catch (error) {
    window.location.href = '/';
  }
}

document.querySelectorAll('.nav-item[data-tab]').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((navItem) => navItem.classList.remove('active'));
    item.classList.add('active');

    document.querySelectorAll('.tab-content').forEach((tab) => tab.classList.remove('active'));
    document.getElementById(`tab-${item.dataset.tab}`).classList.add('active');

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

async function loadDashboard() {
  try {
    const data = await apiRequest('/api/student/dashboard');
    const { student, overview, subjectAttendance, marks } = data.data;

    document.getElementById('greeting').textContent = `Welcome, ${student.name}!`;
    document.getElementById('student-info').textContent = `${student.enrollment_no} - ${student.department || 'No department'}`;

    const attClass = getAttendanceClass(overview.overallAttendance);
    const avgGrade = getGrade(overview.averageMarks);

    document.getElementById('overview-stats').innerHTML = `
      <div class="stat-card accent">
        <div class="stat-icon">*</div>
        <div class="stat-value">${overview.totalSubjects}</div>
        <div class="stat-label">Subjects</div>
      </div>
      <div class="stat-card ${attClass === 'success' ? 'success' : attClass === 'warning' ? 'warning' : ''}">
        <div class="stat-icon">*</div>
        <div class="stat-value">${overview.overallAttendance}%</div>
        <div class="stat-label">Overall Attendance</div>
        <div class="progress-bar mt-1">
          <div class="progress-fill ${attClass}" style="width:${overview.overallAttendance}%"></div>
        </div>
      </div>
      <div class="stat-card info">
        <div class="stat-icon">*</div>
        <div class="stat-value">${overview.averageMarks}</div>
        <div class="stat-label">Average Marks <span class="badge ${avgGrade.class}" style="margin-left:0.5rem;">${avgGrade.grade}</span></div>
      </div>
    `;

    const attBody = document.getElementById('overview-attendance-body');
    if (subjectAttendance.length === 0) {
      attBody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:2rem;color:var(--text-muted);">No attendance records yet</td></tr>';
    } else {
      attBody.innerHTML = subjectAttendance.map((attendance) => {
        const cls = getAttendanceClass(attendance.percentage);
        return `
          <tr>
            <td><strong>${escapeHtml(attendance.subject.name)}</strong></td>
            <td>${attendance.present}</td>
            <td>${attendance.total}</td>
            <td>
              <div style="display:flex;align-items:center;gap:0.5rem;">
                <div class="progress-bar" style="width:100px;">
                  <div class="progress-fill ${cls}" style="width:${attendance.percentage}%"></div>
                </div>
                <span>${attendance.percentage}%</span>
              </div>
            </td>
            <td><span class="badge badge-${cls === 'success' ? 'success' : cls === 'warning' ? 'warning' : 'danger'}">${attendance.percentage >= 75 ? 'Good' : attendance.percentage >= 50 ? 'Low' : 'Critical'}</span></td>
          </tr>
        `;
      }).join('');
    }

    const marksBody = document.getElementById('overview-marks-body');
    if (marks.length === 0) {
      marksBody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:2rem;color:var(--text-muted);">No marks yet</td></tr>';
    } else {
      marksBody.innerHTML = marks.map((mark) => {
        const grade = getGrade(mark.marks);
        return `
          <tr>
            <td><strong>${escapeHtml(mark.subject.name)}</strong></td>
            <td><span class="badge badge-info">${escapeHtml(mark.subject.code)}</span></td>
            <td><strong>${mark.marks}</strong>/100</td>
            <td><span class="badge ${grade.class}">${grade.grade}</span></td>
          </tr>
        `;
      }).join('');
    }
  } catch (error) {
    showToast(`Failed to load dashboard: ${error.message}`, 'error');
  }
}

async function loadAttendance() {
  try {
    const data = await apiRequest('/api/student/attendance');
    const tbody = document.getElementById('attendance-detail-body');

    if (data.data.attendance.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:2rem;color:var(--text-muted);">No attendance records yet</td></tr>';
      return;
    }

    tbody.innerHTML = data.data.attendance.map((attendance) => `
      <tr>
        <td>${attendance.date}</td>
        <td><strong>${escapeHtml(attendance.subject.name)}</strong></td>
        <td><span class="badge badge-info">${escapeHtml(attendance.subject.code)}</span></td>
        <td><span class="badge ${attendance.status === 'present' ? 'badge-success' : 'badge-danger'}">${attendance.status}</span></td>
      </tr>
    `).join('');
  } catch (error) {
    showToast('Failed to load attendance', 'error');
  }
}

async function loadMarks() {
  try {
    const data = await apiRequest('/api/student/marks');
    const tbody = document.getElementById('marks-detail-body');

    if (data.data.marks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:2rem;color:var(--text-muted);">No marks yet</td></tr>';
      return;
    }

    tbody.innerHTML = data.data.marks.map((mark) => {
      const grade = getGrade(mark.marks);
      return `
        <tr>
          <td><strong>${escapeHtml(mark.subject.name)}</strong></td>
          <td><span class="badge badge-info">${escapeHtml(mark.subject.code)}</span></td>
          <td><strong>${mark.marks}</strong>/100</td>
          <td><span class="badge ${grade.class}">${grade.grade}</span></td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    showToast('Failed to load marks', 'error');
  }
}

async function loadSubjects() {
  try {
    const data = await apiRequest('/api/student/subjects');
    const tbody = document.getElementById('subjects-detail-body');

    if (data.data.subjects.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center" style="padding:2rem;color:var(--text-muted);">No subjects enrolled yet</td></tr>';
      return;
    }

    tbody.innerHTML = data.data.subjects.map((subject) => `
      <tr>
        <td><span class="badge badge-info">${escapeHtml(subject.code)}</span></td>
        <td><strong>${escapeHtml(subject.name)}</strong></td>
        <td>${subject.faculty ? escapeHtml(subject.faculty.name) : '-'}</td>
      </tr>
    `).join('');
  } catch (error) {
    showToast('Failed to load subjects', 'error');
  }
}

checkAuth();
