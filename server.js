require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const USERS = [
  { username: 'employee', password: '1234', role: 'employee', name: 'Сотрудник' },
  { username: 'admin', password: '1234', role: 'admin', name: 'Администратор' },
  { username: 'sergey', password: '1234', role: 'technician', name: 'Сергей Кузнецов', technicianId: 1 },
  { username: 'alexey', password: '1234', role: 'technician', name: 'Алексей Волков', technicianId: 2 }
];

const TABLES = {
  requests: process.env.NOCODB_REQUESTS_URL,
  equipment: process.env.NOCODB_EQUIPMENT_URL,
  technicians: process.env.NOCODB_TECHNICIANS_URL,
  assignments: process.env.NOCODB_ASSIGNMENTS_URL,
  status_history: process.env.NOCODB_STATUS_HISTORY_URL
};

app.use(express.json());
app.use(
  session({
    name: 'mrsid',
    secret: process.env.SESSION_SECRET || 'student-demo-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, maxAge: 1000 * 60 * 60 * 8 }
  })
);
app.use(express.static(path.join(__dirname, 'public')));

function getTableUrl(table) {
  const url = TABLES[table];
  if (!url) throw new Error(`Не задан URL для таблицы ${table}`);
  return url.replace(/\/$/, '');
}

function extractRows(data) {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.records)) {
    return data.records.map((item) => {
      if (item && typeof item === 'object' && item.fields && typeof item.fields === 'object') {
        return {
          Id: item.id ?? item.Id ?? item.fields.Id ?? item.fields.id ?? null,
          ...item.fields
        };
      }
      return item;
    });
  }

  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.list)) return data.data.list;

  return [];
}

function getId(value) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return getId(value[0]);
  if (typeof value === 'object') return value.Id ?? value.id ?? value.ID ?? null;
  return Number(value) || value;
}

async function nocodb(table, method = 'GET', body, recordId) {
  const url = recordId ? `${getTableUrl(table)}/${recordId}` : getTableUrl(table);
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.NOCODB_TOKEN}`
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error || `Ошибка NoCoDB (${response.status})`;
    throw new Error(message);
  }

  return data;
}

function auth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Сначала войдите в систему' });
  }
  next();
}

function canWrite(table) {
  return ['requests', 'assignments', 'status_history'].includes(table);
}

function getVisibleData(user, requests, assignments, statusHistory) {
  if (user.role !== 'technician' || !user.technicianId) {
    return { requests, assignments, statusHistory };
  }

  const myAssignments = assignments.filter(
    (item) => Number(getId(item.technician_id)) === Number(user.technicianId)
  );

  const myRequestIds = new Set(
    myAssignments.map((item) => Number(getId(item.request_id))).filter(Boolean)
  );

  return {
    requests: requests.filter((item) => myRequestIds.has(Number(item.Id))),
    assignments: myAssignments,
    statusHistory: statusHistory.filter((item) => myRequestIds.has(Number(getId(item.request_id))))
  };
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find((item) => item.username === username && item.password === password);

  if (!user) {
    return res.status(401).json({ message: 'Неверный логин или пароль' });
  }

  req.session.user = {
    username: user.username,
    role: user.role,
    name: user.name,
    technicianId: user.technicianId || null
  };

  res.json({ user: req.session.user });
});

app.post('/api/logout', auth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

app.get('/api/bootstrap', auth, async (req, res) => {
  try {
    const [requestsRaw, equipmentRaw, techniciansRaw, assignmentsRaw, historyRaw] = await Promise.all([
      nocodb('requests'),
      nocodb('equipment'),
      nocodb('technicians'),
      nocodb('assignments'),
      nocodb('status_history')
    ]);

    const requests = extractRows(requestsRaw);
    const equipment = extractRows(equipmentRaw);
    const technicians = extractRows(techniciansRaw);
    const assignments = extractRows(assignmentsRaw);
    const statusHistory = extractRows(historyRaw);
    const visible = getVisibleData(req.session.user, requests, assignments, statusHistory);

    res.json({
      user: req.session.user,
      requests: visible.requests,
      equipment,
      technicians,
      assignments: visible.assignments,
      statusHistory: visible.statusHistory
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/table/:table', auth, async (req, res) => {
  try {
    const data = await nocodb(req.params.table);
    res.json({ list: extractRows(data) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/table/:table', auth, async (req, res) => {
  try {
    if (!canWrite(req.params.table)) {
      return res.status(403).json({ message: 'Запись в эту таблицу запрещена' });
    }

    const data = await nocodb(req.params.table, 'POST', req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/table/:table/:id', auth, async (req, res) => {
  try {
    if (!['requests', 'assignments'].includes(req.params.table)) {
      return res.status(403).json({ message: 'Изменение этой таблицы запрещено' });
    }

    const data = await nocodb(req.params.table, 'PATCH', req.body, req.params.id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/table/:table/:id', auth, async (req, res) => {
  try {
    if (req.params.table !== 'requests') {
      return res.status(403).json({ message: 'Удаление из этой таблицы запрещено' });
    }

    const data = await nocodb(req.params.table, 'DELETE', null, req.params.id);
    res.json(data || { ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
