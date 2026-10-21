
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const FORMS_FILE = path.join(DATA_DIR, "forms.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(FORMS_FILE)) {
  fs.writeFileSync(FORMS_FILE, "[]");
}

function readForms() {
  return JSON.parse(fs.readFileSync(FORMS_FILE, "utf8"));
}

function saveForms(forms) {
  fs.writeFileSync(FORMS_FILE, JSON.stringify(forms, null, 2));
}

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/api/forms", (req, res) => {
  res.json(readForms());
});

app.post("/api/forms", (req, res) => {
  const { title, description, questions } = req.body;

  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.length > 120 ||
    !Array.isArray(questions) ||
    questions.length === 0 ||
    questions.length > 50
  ) {
    return res.status(400).json({ error: "Некорректные данные формы" });
  }

  const allowedTypes = ["text", "textarea", "email", "select"];

  const validQuestions = questions.every(q =>
    q &&
    typeof q.label === "string" &&
    q.label.trim().length > 0 &&
    q.label.length <= 200 &&
    allowedTypes.includes(q.type) &&
    typeof q.required === "boolean" &&
    (
      q.type !== "select" ||
      (
        Array.isArray(q.options) &&
        q.options.length > 0 &&
        q.options.length <= 30 &&
        q.options.every(o =>
          typeof o === "string" &&
          o.trim().length > 0 &&
          o.length <= 200
        )
      )
    )
  );

  if (!validQuestions) {
    return res.status(400).json({ error: "Некорректные вопросы" });
  }

  if (description !== undefined &&
      (typeof description !== "string" || description.length > 2000)) {
    return res.status(400).json({ error: "Некорректное описание" });
  }

  const form = {
    id: crypto.randomUUID(),
    title: title.trim(),
    description: (description || "").trim(),
    questions: questions.map(q => ({
      id: crypto.randomUUID(),
      label: q.label.trim(),
      type: q.type,
      required: q.required,
      options: q.type === "select" ? q.options.map(o => o.trim()) : []
    })),
    createdAt: new Date().toISOString()
  };

  const forms = readForms();
  forms.push(form);
  saveForms(forms);

  res.status(201).json({
    id: form.id,
    url: `/form/${form.id}`
  });
});

app.get("/api/forms/:id", (req, res) => {
  const form = readForms().find(f => f.id === req.params.id);

  if (!form) {
    return res.status(404).json({ error: "Форма не найдена" });
  }

  res.json(form);
});

app.get("/form/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "form.html"));
});


const RESPONSES_FILE = path.join(DATA_DIR, "responses.json");

if (!fs.existsSync(RESPONSES_FILE)) {
  fs.writeFileSync(RESPONSES_FILE, "[]");
}

function readResponses() {
  return JSON.parse(fs.readFileSync(RESPONSES_FILE, "utf8"));
}

function saveResponses(responses) {
  fs.writeFileSync(
    RESPONSES_FILE,
    JSON.stringify(responses, null, 2)
  );
}

// Студент отправляет ответы
app.post("/api/forms/:id/responses", (req, res) => {
  const form = readForms().find(f => f.id === req.params.id);

  if (!form) {
    return res.status(404).json({ error: "Форма не найдена" });
  }

  const answers = req.body?.answers;

  if (!Array.isArray(answers)) {
    return res.status(400).json({ error: "Некорректные ответы" });
  }

  const answerMap = new Map();

  for (const answer of answers) {
    if (
      !answer ||
      typeof answer.questionId !== "string" ||
      typeof answer.value !== "string" ||
      answerMap.has(answer.questionId)
    ) {
      return res.status(400).json({ error: "Некорректные ответы" });
    }

    answerMap.set(answer.questionId, answer.value.trim());
  }

  if (
    answers.length !== form.questions.length ||
    form.questions.some(q => !answerMap.has(q.id))
  ) {
    return res.status(400).json({ error: "Неполный набор ответов" });
  }

  for (const question of form.questions) {
    const value = answerMap.get(question.id);

    if (question.required && !value) {
      return res.status(400).json({
        error: `Заполните обязательное поле: ${question.label}`
      });
    }

    if (value.length > (question.type === "textarea" ? 5000 : 500)) {
      return res.status(400).json({ error: "Ответ слишком длинный" });
    }

    if (
      question.type === "email" &&
      value &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ) {
      return res.status(400).json({ error: "Некорректный email" });
    }

    if (
      question.type === "select" &&
      value &&
      !question.options.includes(value)
    ) {
      return res.status(400).json({ error: "Недопустимый вариант ответа" });
    }
  }

  const submission = {
    id: crypto.randomUUID(),
    formId: form.id,
    submittedAt: new Date().toISOString(),
    answers: form.questions.map(q => ({
      questionId: q.id,
      label: q.label,
      value: answerMap.get(q.id)
    }))
  };

  const responses = readResponses();
  responses.push(submission);
  saveResponses(responses);

  res.status(201).json({
    success: true,
    id: submission.id
  });
});

// Менеджер получает ответы на конкретную форму
app.get("/api/forms/:id/responses", (req, res) => {
  const form = readForms().find(f => f.id === req.params.id);

  if (!form) {
    return res.status(404).json({ error: "Форма не найдена" });
  }

  const responses = readResponses()
    .filter(r => r.formId === form.id)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  res.json(responses);
});


const ANALYTICS_FILE = path.join(DATA_DIR, "analytics.json");

if (!fs.existsSync(ANALYTICS_FILE)) {
  fs.writeFileSync(ANALYTICS_FILE, "{}");
}

function readAnalytics() {
  return JSON.parse(fs.readFileSync(ANALYTICS_FILE, "utf8"));
}

function saveAnalytics(data) {
  fs.writeFileSync(
    ANALYTICS_FILE,
    JSON.stringify(data, null, 2)
  );
}

// Записываем события просмотра и начала заполнения
app.post("/api/forms/:id/events", (req, res) => {
  const form = readForms().find(f => f.id === req.params.id);

  if (!form) {
    return res.status(404).json({ error: "Форма не найдена" });
  }

  const { event } = req.body || {};

  if (!["view", "start"].includes(event)) {
    return res.status(400).json({ error: "Недопустимое событие" });
  }

  const analytics = readAnalytics();

  if (!analytics[form.id]) {
    analytics[form.id] = { views: 0, starts: 0 };
  }

  if (event === "view") analytics[form.id].views++;
  if (event === "start") analytics[form.id].starts++;

  saveAnalytics(analytics);
  res.json({ success: true });
});

// Статистика конкретной формы
app.get("/api/forms/:id/stats", (req, res) => {
  const form = readForms().find(f => f.id === req.params.id);

  if (!form) {
    return res.status(404).json({ error: "Форма не найдена" });
  }

  const analytics = readAnalytics();
  const counters = analytics[form.id] || { views: 0, starts: 0 };

  const submissions = readResponses()
    .filter(r => r.formId === form.id).length;

  res.json({
    views: counters.views,
    starts: counters.starts,
    submissions,
    conversion: counters.views > 0
      ? Number((submissions / counters.views * 100).toFixed(1))
      : 0
  });
});


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
