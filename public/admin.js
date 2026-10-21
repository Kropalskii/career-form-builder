
const questions = [];

const $ = (id) => document.getElementById(id);

function createElement(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function addQuestion() {
  questions.push({
    id: crypto.randomUUID(),
    label: "",
    type: "text",
    required: false
  });
  renderQuestions();
}

function renderQuestions() {
  const container = $("questions");
  container.replaceChildren();

  questions.forEach((question, index) => {
    const card = createElement("div", undefined, "question-card");

    const top = createElement("div", undefined, "question-top");
    top.append(createElement("strong", `Вопрос ${index + 1}`));

    const remove = createElement("button", "Удалить", "remove-button");
    remove.type = "button";
    remove.onclick = () => {
      questions.splice(index, 1);
      renderQuestions();
    };
    top.append(remove);
    card.append(top);

    const label = createElement("label", "Текст вопроса");
    const input = createElement("input");
    input.placeholder = "Например: Ваше имя";
    input.maxLength = 200;
    input.value = question.label;
    input.oninput = () => {
      question.label = input.value;
      renderPreview();
    };
    card.append(label, input);

    const typeLabel = createElement("label", "Тип ответа");
    const select = createElement("select");

    const types = [
      ["text", "Короткий текст"],
      ["textarea", "Длинный текст"],
      ["email", "Email"],
      ["select", "Выбор из списка"]
    ];

    types.forEach(([value, title]) => {
      const option = createElement("option", title);
      option.value = value;
      select.append(option);
    });

    select.value = question.type;
    select.onchange = () => {
      question.type = select.value;
      renderQuestions();
    };
    card.append(typeLabel, select);

    if (question.type === "select") {
      const optionsLabel = createElement(
        "label", "Варианты ответа (каждый с новой строки)"
      );
      const optionsInput = createElement("textarea");
      optionsInput.rows = 3;
      optionsInput.placeholder = "Первый вариант\nВторой вариант";
      optionsInput.value = question.options || "";
      optionsInput.oninput = () => {
        question.options = optionsInput.value;
        renderPreview();
      };
      card.append(optionsLabel, optionsInput);
    }

    const requiredLabel = createElement(
      "label", undefined, "required-label"
    );
    const checkbox = createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = question.required;
    checkbox.onchange = () => {
      question.required = checkbox.checked;
      renderPreview();
    };
    requiredLabel.append(checkbox, document.createTextNode("Обязательный вопрос"));
    card.append(requiredLabel);

    container.append(card);
  });

  $("questionCount").textContent = `${questions.length} вопросов`;
  renderPreview();
}

function renderPreview() {
  const preview = $("preview");
  preview.replaceChildren();

  const title = $("formTitle").value.trim() || "Название формы";
  const description = $("formDescription").value.trim();

  preview.append(createElement("h3", title, "preview-title"));
  preview.append(
    createElement("p", description || "Описание формы", "preview-description")
  );

  questions.forEach((question) => {
    const field = createElement("div", undefined, "preview-field");
    const label = createElement(
      "label",
      (question.label || "Новый вопрос") +
        (question.required ? " *" : "")
    );
    field.append(label);

    let control;

    if (question.type === "textarea") {
      control = createElement("textarea");
      control.rows = 3;
    } else if (question.type === "select") {
      control = createElement("select");
      control.append(createElement("option", "Выберите вариант"));
      (question.options || "").split("\n")
        .map(value => value.trim())
        .filter(Boolean)
        .forEach(value => {
          const option = createElement("option", value);
          option.value = value;
          control.append(option);
        });
    } else {
      control = createElement("input");
      control.type = question.type;
    }

    control.disabled = true;
    field.append(control);
    preview.append(field);
  });
}

$("addQuestion").addEventListener("click", addQuestion);
$("formTitle").addEventListener("input", renderPreview);
$("formDescription").addEventListener("input", renderPreview);


$("publishForm").addEventListener("click", async () => {
  const title = $("formTitle").value.trim();
  const description = $("formDescription").value.trim();

  if (!title) {
    alert("Введите название формы.");
    return;
  }

  if (questions.length === 0 || questions.some(q => !q.label.trim())) {
    alert("Добавьте хотя бы один вопрос и заполните его название.");
    return;
  }

  const preparedQuestions = questions.map(q => ({
    label: q.label.trim(),
    type: q.type,
    required: q.required,
    options: q.type === "select"
      ? (q.options || "").split("\n").map(o => o.trim()).filter(Boolean)
      : []
  }));

  if (preparedQuestions.some(q => q.type === "select" && !q.options.length)) {
    alert("Добавьте варианты ответа для вопросов со списком.");
    return;
  }

  const button = $("publishForm");
  button.disabled = true;
  button.textContent = "Публикация...";

  try {
    const response = await fetch("/api/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        questions: preparedQuestions
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Ошибка публикации");
    }

    const url = new URL(result.url, window.location.origin).href;
    const container = $("publishResult");
    container.replaceChildren();

    const message = document.createElement("p");
    message.textContent = "Форма успешно опубликована!";

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = url;

    container.append(message, link);
    container.hidden = false;

  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Опубликовать форму";
  }
});


addQuestion();


async function loadForms() {
  const container = $("formsList");
  container.replaceChildren();

  try {
    const response = await fetch("/api/forms");

    if (!response.ok) {
      throw new Error("Не удалось загрузить формы");
    }

    const forms = await response.json();

    if (forms.length === 0) {
      container.append(
        createElement("p", "Пока нет опубликованных форм.", "subtitle")
      );
      return;
    }

    forms.reverse().forEach(form => {
      const item = createElement("div", undefined, "form-list-item");
      const info = createElement("div");

      info.append(createElement("h3", form.title));

      const date = new Date(form.createdAt).toLocaleDateString("ru-RU");
      info.append(createElement(
        "p",
        `${date} · ${form.questions.length} вопросов`
      ));

      const actions = createElement("div", undefined, "form-list-actions");

      const link = createElement("a", "Открыть форму", "small-button");
      link.href = `/form/${encodeURIComponent(form.id)}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      const responsesButton = createElement(
        "button", "Посмотреть ответы", "small-button"
      );
      responsesButton.type = "button";
      responsesButton.onclick = () => loadResponses(form);

      actions.append(link, responsesButton);
      item.append(info, actions);
      container.append(item);
    });

  } catch (error) {
    container.append(createElement("p", error.message, "subtitle"));
  }
}


async function loadStats(form) {
  const response = await fetch(
    `/api/forms/${encodeURIComponent(form.id)}/stats`
  );

  if (!response.ok) {
    throw new Error("Не удалось загрузить статистику");
  }

  const stats = await response.json();

  const container = $("responsesList");
  const panel = createElement("div", undefined, "stats-grid");

  const metrics = [
    ["Просмотры", stats.views],
    ["Начали заполнение", stats.starts],
    ["Отправили заявку", stats.submissions],
    ["Конверсия", `${stats.conversion}%`]
  ];

  metrics.forEach(([label, value]) => {
    const card = createElement("div", undefined, "stat-card");
    card.append(createElement("strong", String(value)));
    card.append(createElement("span", label));
    panel.append(card);
  });

  container.prepend(panel);
}


async function loadResponses(form) {
  const section = $("responsesSection");
  const container = $("responsesList");

  section.hidden = false;
  $("responsesTitle").textContent = `Ответы: ${form.title}`;
  $("responsesCount").textContent = "Загрузка...";
  container.replaceChildren();

  section.scrollIntoView({ behavior: "smooth" });

  try {
    const response = await fetch(
      `/api/forms/${encodeURIComponent(form.id)}/responses`
    );

    if (!response.ok) {
      throw new Error("Не удалось загрузить ответы");
    }

    const submissions = await response.json();

    await loadStats(form);

    $("responsesCount").textContent =
      `Всего заявок: ${submissions.length}`;

    if (submissions.length === 0) {
      container.append(
        createElement("p", "На эту форму пока никто не ответил.", "subtitle")
      );
      return;
    }

    submissions.forEach((submission, index) => {
      const card = createElement("div", undefined, "response-card");

      const date = new Date(submission.submittedAt)
        .toLocaleString("ru-RU");

      card.append(createElement(
        "h3", `Заявка №${submissions.length - index} · ${date}`
      ));

      submission.answers.forEach(answer => {
        const item = createElement("div", undefined, "answer-item");
        item.append(createElement("strong", answer.label));
        item.append(createElement("p", answer.value || "—"));
        card.append(item);
      });

      container.append(card);
    });

  } catch (error) {
    $("responsesCount").textContent = "";
    container.append(createElement("p", error.message, "subtitle"));
  }
}

$("refreshForms").addEventListener("click", loadForms);

$("closeResponses").addEventListener("click", () => {
  $("responsesSection").hidden = true;
});

loadForms();

