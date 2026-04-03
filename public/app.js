const state = {
  user: null,
  requests: [],
  equipment: [],
  technicians: [],
  assignments: [],
  statusHistory: []
};

const loginView = document.getElementById('loginView');
const appView = document.getElementById('appView');
const pageTitle = document.getElementById('pageTitle');
const requestsTitle = document.getElementById('requestsTitle');
const createCard = document.getElementById('createCard');
const welcomeText = document.getElementById('welcomeText');
const messageBox = document.getElementById('messageBox');
const equipmentSelect = document.getElementById('equipmentSelect');
const techniciansList = document.getElementById('techniciansList');
const equipmentList = document.getElementById('equipmentList');
const requestsTable = document.getElementById('requestsTable');
const requestsCount = document.getElementById('requestsCount');
const reportStatus = document.getElementById('reportStatus');
const reportAvg = document.getElementById('reportAvg');
const reportTop = document.getElementById('reportTop');

const loginForm = document.getElementById('loginForm');
const createForm = document.getElementById('createForm');
const filterForm = document.getElementById('filterForm');
const logoutBtn = document.getElementById('logoutBtn');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const reportFrom = document.getElementById('reportFrom');
const reportTo = document.getElementById('reportTo');

function showMessage(text, type = 'success') {
  messageBox.textContent = text;
  messageBox.className = `message ${type}`;
}

function hideMessage() {
  messageBox.className = 'message hidden';
  messageBox.textContent = '';
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Ошибка запроса');
  return data;
}

function getId(value) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return getId(value[0]);
  if (typeof value === 'object') return value.Id ?? value.id ?? value.ID ?? null;
  return Number(value) || value;
}

function linkValue(id) {
  return id ? [Number(id)] : [];
}

function readDate(value) {
  return value ? new Date(value) : null;
}

function formatDate(value) {
  const date = readDate(value);
  return date ? date.toLocaleString('ru-RU') : '—';
}

function dateOnly(value) {
  const date = readDate(value);
  if (!date) return '';
  return date.toISOString().slice(0, 10);
}

function isTechnicianUser() {
  return state.user?.role === 'technician';
}

function getCurrentTechnician() {
  return state.technicians.find((item) => Number(item.Id) === Number(state.user?.technicianId));
}

function statusClass(status) {
  if (status === 'Новая') return 'status-new';
  if (status === 'В работе') return 'status-work';
  if (status === 'Выполнена') return 'status-done';
  return 'status-reject';
}

function sameOrAfter(value, from) {
  if (!from) return true;
  return dateOnly(value) >= from;
}

function sameOrBefore(value, to) {
  if (!to) return true;
  return dateOnly(value) <= to;
}

function getEquipmentName(request) {
  const equipmentId = getId(request.equipment_id);
  const equipment = state.equipment.find((item) => Number(item.Id) === Number(equipmentId));
  return equipment ? equipment.name : '—';
}

function getTechnicianNameByRequest(requestId) {
  const openAssignment = [...state.assignments]
    .reverse()
    .find((item) => Number(getId(item.request_id)) === Number(requestId));

  if (!openAssignment) return '—';

  const technicianId = getId(openAssignment.technician_id);
  const technician = state.technicians.find((item) => Number(item.Id) === Number(technicianId));
  return technician ? technician.full_name : '—';
}

function getLastComment(requestId) {
  const assignment = [...state.assignments]
    .reverse()
    .find((item) => Number(getId(item.request_id)) === Number(requestId) && item.comment);

  return assignment?.comment || '—';
}

function getFilteredRequests() {
  const form = new FormData(filterForm);
  const status = form.get('status');
  const priority = form.get('priority');
  const dateFrom = form.get('dateFrom');
  const dateTo = form.get('dateTo');

  return [...state.requests]
    .filter((item) => !status || item.status === status)
    .filter((item) => !priority || item.priority === priority)
    .filter((item) => sameOrAfter(item.CreatedAt, dateFrom))
    .filter((item) => sameOrBefore(item.CreatedAt, dateTo))
    .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
}

function renderEquipmentOptions() {
  equipmentSelect.innerHTML = '<option value="">Выберите оборудование</option>' + state.equipment
    .map((item) => `<option value="${item.Id}">${item.name} (${item.location || 'без локации'})</option>`)
    .join('');
}

function renderReferences() {
  const technicianItems = state.technicians;

  techniciansList.innerHTML = '<div class="list">' + technicianItems.map((item) => `
    <div class="list-item">
      <strong>${item.full_name}</strong>
      <div class="note">Специализация: ${item.specialization || '—'}</div>
    </div>
  `).join('') + '</div>';

  equipmentList.innerHTML = '<div class="list">' + state.equipment.map((item) => `
    <div class="list-item">
      <strong>${item.name}</strong>
      <div class="note">Локация: ${item.location || '—'}</div>
      <div class="note">Тип: ${item.type || '—'}</div>
    </div>
  `).join('') + '</div>';
}

function renderRequests() {
  const list = getFilteredRequests();
  requestsCount.textContent = `Показано: ${list.length}`;

  if (!list.length) {
    requestsTable.innerHTML = '<p class="note">По текущим фильтрам заявок нет.</p>';
    return;
  }

  requestsTable.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Заявка</th>
            <th>Оборудование</th>
            <th>Приоритет</th>
            <th>Статус</th>
            <th>Заявитель</th>
            <th>Техник</th>
            <th>Комментарий</th>
            <th>Дата создания</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((item) => `
            <tr>
              <td>${item.Id}</td>
              <td>
                <strong>${item.title}</strong>
                <div class="note">${item.description || '—'}</div>
              </td>
              <td>${getEquipmentName(item)}</td>
              <td>${item.priority}</td>
              <td><span class="badge ${statusClass(item.status)}">${item.status}</span></td>
              <td>${item.applicant_name || '—'}</td>
              <td>${getTechnicianNameByRequest(item.Id)}</td>
              <td>${getLastComment(item.Id)}</td>
              <td>${formatDate(item.CreatedAt)}</td>
              <td>
                <div class="actions">
                  ${item.status === 'Новая' ? `
                    <button class="small" onclick="editRequest(${item.Id})">Изменить</button>
                    <button class="small ghost" onclick="assignRequest(${item.Id})">Назначить</button>
                    <button class="small ghost" onclick="deleteRequest(${item.Id})">Удалить</button>
                  ` : ''}
                  ${item.status === 'В работе' ? `
                    <button class="small" onclick="closeRequest(${item.Id})">Выполнить</button>
                    <button class="small ghost" onclick="rejectRequest(${item.Id})">Отклонить</button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderReports() {
  const from = reportFrom.value;
  const to = reportTo.value;

  const byPeriod = state.requests
    .filter((item) => sameOrAfter(item.CreatedAt, from))
    .filter((item) => sameOrBefore(item.CreatedAt, to));

  const statusCount = ['Новая', 'В работе', 'Выполнена', 'Отклонена'].map((status) => ({
    status,
    count: byPeriod.filter((item) => item.status === status).length
  }));

  reportStatus.innerHTML = statusCount.map((item) => `
    <div class="report-row">
      <span>${item.status}</span>
      <strong>${item.count}</strong>
    </div>
  `).join('') || '<div class="note">Нет данных</div>';

  const completed = byPeriod.filter((request) => request.status === 'Выполнена').map((request) => {
    const assignment = [...state.assignments]
      .reverse()
      .find((item) => Number(getId(item.request_id)) === Number(request.Id) && item.closed_at);

    if (!assignment) return null;
    const start = readDate(request.CreatedAt);
    const end = readDate(assignment.closed_at);
    if (!start || !end) return null;
    return (end - start) / (1000 * 60 * 60);
  }).filter(Boolean);

  const average = completed.length
    ? `${(completed.reduce((sum, item) => sum + item, 0) / completed.length).toFixed(1)} ч.`
    : 'Нет завершённых заявок';

  reportAvg.innerHTML = `<div class="report-row"><span>Среднее время</span><strong>${average}</strong></div>`;

  const top = Object.entries(
    byPeriod.reduce((acc, item) => {
      const name = getEquipmentName(item);
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  reportTop.innerHTML = top.length
    ? top.map(([name, count]) => `
        <div class="report-row">
          <span>${name}</span>
          <strong>${count}</strong>
        </div>
      `).join('')
    : '<div class="note">Нет данных за выбранный период</div>';
}

function renderRoleView() {
  const currentTechnician = getCurrentTechnician();

  if (isTechnicianUser()) {
    pageTitle.textContent = 'Мои заявки';
    requestsTitle.textContent = 'Мои заявки';
    createCard.classList.add('hidden');
    welcomeText.textContent = currentTechnician
      ? `${state.user.name} (техник, ID ${currentTechnician.Id})`
      : `${state.user.name} (техник)`;
    return;
  }

  pageTitle.textContent = 'Система заявок на техобслуживание';
  requestsTitle.textContent = 'Список заявок';
  createCard.classList.remove('hidden');
  welcomeText.textContent = `${state.user.name} (${state.user.role})`;
}

function renderAll() {
  renderRoleView();
  renderEquipmentOptions();
  renderReferences();
  renderRequests();
  renderReports();
}

async function loadApp() {
  const data = await api('/api/bootstrap');
  state.user = data.user;
  state.requests = data.requests;
  state.equipment = data.equipment;
  state.technicians = data.technicians;
  state.assignments = data.assignments;
  state.statusHistory = data.statusHistory;
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  renderAll();
}

async function refreshData(successText) {
  await loadApp();
  if (successText) showMessage(successText, 'success');
}

async function createStatusHistory(requestId, oldStatus, newStatus) {
  await api('/api/table/status_history', {
    method: 'POST',
    body: JSON.stringify({
      request_id: linkValue(requestId),
      old_status: oldStatus || '',
      new_status: newStatus
    })
  });
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideMessage();

  const form = new FormData(loginForm);
  try {
    await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        username: form.get('username'),
        password: form.get('password')
      })
    });
    await loadApp();
  } catch (error) {
    showMessage(error.message, 'error');
  }
});

logoutBtn.addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  location.reload();
});

createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideMessage();

  const form = new FormData(createForm);
  try {
    const created = await api('/api/table/requests', {
      method: 'POST',
      body: JSON.stringify({
        title: form.get('title'),
        description: form.get('description'),
        equipment_id: linkValue(form.get('equipment_id')),
        priority: form.get('priority'),
        status: 'Новая',
        applicant_name: form.get('applicant_name')
      })
    });

    await createStatusHistory(created.Id || created.id, '', 'Новая');
    createForm.reset();
    await refreshData('Заявка создана');
  } catch (error) {
    showMessage(error.message, 'error');
  }
});

filterForm.addEventListener('input', renderRequests);
resetFiltersBtn.addEventListener('click', () => {
  filterForm.reset();
  renderRequests();
});
reportFrom.addEventListener('input', renderReports);
reportTo.addEventListener('input', renderReports);

window.editRequest = async function editRequest(id) {
  const request = state.requests.find((item) => Number(item.Id) === Number(id));
  if (!request || request.status !== 'Новая') return showMessage('Редактировать можно только новую заявку', 'error');

  const title = prompt('Новый заголовок:', request.title);
  if (title === null) return;
  const description = prompt('Новое описание:', request.description || '');
  if (description === null) return;

  try {
    await api(`/api/table/requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, description })
    });
    await refreshData('Заявка изменена');
  } catch (error) {
    showMessage(error.message, 'error');
  }
};

window.deleteRequest = async function deleteRequest(id) {
  const request = state.requests.find((item) => Number(item.Id) === Number(id));
  if (!request || request.status !== 'Новая') return showMessage('Удалять можно только новую заявку', 'error');
  if (!confirm(`Удалить заявку #${id}?`)) return;

  try {
    await api(`/api/table/requests/${id}`, { method: 'DELETE' });
    await refreshData('Заявка удалена');
  } catch (error) {
    showMessage(error.message, 'error');
  }
};

window.assignRequest = async function assignRequest(id) {
  const request = state.requests.find((item) => Number(item.Id) === Number(id));
  if (!request || request.status !== 'Новая') return showMessage('Назначать техника можно только для новой заявки', 'error');

  const list = state.technicians.map((item) => `${item.Id} — ${item.full_name}`).join('\n');
  const technicianId = prompt(`Введите ID техника:\n${list}`);
  if (!technicianId) return;

  try {
    await api('/api/table/assignments', {
      method: 'POST',
      body: JSON.stringify({
        request_id: linkValue(id),
        technician_id: linkValue(technicianId),
        comment: ''
      })
    });

    await api(`/api/table/requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'В работе' })
    });

    await createStatusHistory(id, 'Новая', 'В работе');
    await refreshData('Техник назначен');
  } catch (error) {
    showMessage(error.message, 'error');
  }
};

async function finishRequest(id, newStatus) {
  const request = state.requests.find((item) => Number(item.Id) === Number(id));
  if (!request || request.status !== 'В работе') return showMessage('Эта операция доступна только для заявок в работе', 'error');

  const comment = prompt(
    newStatus === 'Выполнена' ? 'Что было сделано?' : 'Почему заявка отклонена?',
    ''
  );
  if (comment === null) return;

  const assignment = [...state.assignments]
    .reverse()
    .find((item) => Number(getId(item.request_id)) === Number(id) && !item.closed_at);

  try {
    await api(`/api/table/requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus })
    });

    if (assignment) {
      await api(`/api/table/assignments/${assignment.Id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          closed_at: new Date().toISOString(),
          comment
        })
      });
    }

    await createStatusHistory(id, 'В работе', newStatus);
    await refreshData(newStatus === 'Выполнена' ? 'Заявка закрыта' : 'Заявка отклонена');
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

window.closeRequest = function closeRequest(id) {
  finishRequest(id, 'Выполнена');
};

window.rejectRequest = function rejectRequest(id) {
  finishRequest(id, 'Отклонена');
};

(async function init() {
  try {
    const me = await api('/api/me');
    if (me.user) {
      await loadApp();
    }
  } catch (error) {
    showMessage(error.message, 'error');
  }
})();
