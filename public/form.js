
const formId = window.location.pathname.split("/").pop();
let currentForm = null;

async function loadForm() {
  try {
    const response = await fetch(`/api/forms/${encodeURIComponent(formId)}`);

    if (!response.ok) {
      throw new Error("Форма не найдена");
    }

    currentForm = await response.json();

    document.getElementById("studentFormTitle").textContent =
      currentForm.title;

    document.getElementById("studentFormDescription").textContent =
      currentForm.description || "";

    const container = document.getElementById("studentQuestions");

    currentForm.questions.forEach((question, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "preview-field";

      const label = document.createElement("label");
      label.textContent =
        `${index + 1}. ${question.label}${question.required ? " *" : ""}`;

      let input;

      if (question.type === "textarea") {
        input = document.createElement("textarea");
        input.rows = 4;
      } else if (question.type === "select") {
        input = document.createElement("select");

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Выберите вариант";
        input.append(placeholder);

        question.options.forEach(value => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = value;
          input.append(option);
        });
      } else {
        input = document.createElement("input");
        input.type = question.type;
      }

      input.name = question.id;
      input.id = `question-${index}`;
      input.required = question.required;
      input.maxLength = question.type === "textarea" ? 5000 : 500;
      label.htmlFor = input.id;

      wrapper.append(label, input);
      container.append(wrapper);
    });

    document.getElementById("loading").hidden = true;
    document.getElementById("formContent").hidden = false;

  } catch (error) {
    document.getElementById("loading").hidden = true;

    const errorElement = document.getElementById("formError");
    errorElement.textContent = error.message;
    errorElement.hidden = false;
  }
}

document.getElementById("studentForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const answers = currentForm.questions.map(question => {
      const input = document.getElementsByName(question.id)[0];

      return {
        questionId: question.id,
        value: input.value.trim()
      };
    });

    const button = document.getElementById("submitButton");
    button.disabled = true;
    button.textContent = "Отправка...";

    try {
      const response = await fetch(
        `/api/forms/${encodeURIComponent(formId)}/responses`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Ошибка отправки");
      }

      document.getElementById("formContent").hidden = true;
      document.getElementById("successMessage").hidden = false;

    } catch (error) {
      alert(error.message);
    } finally {
      button.disabled = false;
      button.textContent = "Отправить заявку";
    }
  }
);


async function trackEvent(event) {
  try {
    await fetch(`/api/forms/${encodeURIComponent(formId)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event })
    });
  } catch (error) {
    console.warn("Не удалось записать событие:", error);
  }
}

let hasStarted = false;

document.getElementById("studentForm").addEventListener("input", () => {
  if (hasStarted) return;
  hasStarted = true;
  trackEvent("start");
});

loadForm().then(() => {
  if (currentForm) {
    trackEvent("view");
  }
});
