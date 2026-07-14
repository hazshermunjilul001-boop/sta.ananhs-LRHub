/* =====================================================================
   SANHS SITE FEEDBACK WIDGET
   -----------------------------------------------------------------
   Drop this ONE line before </body> on any page to add the feedback
   button + form:

     <script src="feedback-widget.js"></script>

   No other HTML/CSS needed - this file injects everything itself.

   SETUP REQUIRED (one-time):
   1. Follow the Google Apps Script setup instructions provided
      alongside this file.
   2. Paste your deployed Web App URL into GAS_URL below.
   ===================================================================== */

(function () {
  // ─────────────────────────────────────────────────────────────
  // ⬇️ PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE ⬇️
  const GAS_URL = "https://script.google.com/a/macros/deped.gov.ph/s/AKfycbwpZE38d09eweldQMoa8gNX-NuEAi8dwoXaGY6odwFejHMxTOMctFt9HD72Hj1uewMJRw/exec";
  // ─────────────────────────────────────────────────────────────

  const SQD_QUESTIONS = [
    { id: "sqd0", label: "Overall, I'm happy with using this website.", dim: "Overall" },
    { id: "sqd1", label: "I was able to find what I was looking for quickly.", dim: "Speed" },
    { id: "sqd2", label: "The materials and information on this site are accurate and correct.", dim: "Accuracy" },
    { id: "sqd3", label: "This website is easy to use and navigate.", dim: "Ease of Use" },
    { id: "sqd4", label: "Instructions and labels on the site are clear and easy to understand.", dim: "Clarity" },
    { id: "sqd8", label: "I got the learning materials or resources I needed.", dim: "Helpfulness" }
  ];

  const SCALE_LABELS = ["Strongly Disagree", "Disagree", "Not Sure", "Agree", "Strongly Agree"];
  const SCALE_EMOJIS = ["😞", "🙁", "😐", "🙂", "😄"];

  /* ---------------- INJECT STYLES ---------------- */
  const style = document.createElement("style");
  style.textContent = `
    #fbw-launcher {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #003087;
      color: #fff;
      border: none;
      padding: 14px 20px;
      border-radius: 50px;
      font-family: 'Roboto', sans-serif;
      font-weight: bold;
      font-size: 0.95em;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.35);
      z-index: 9990;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: transform 0.15s ease, background 0.2s ease;
    }
    #fbw-launcher:hover { background: #0056d2; transform: translateY(-2px); }
    @media (max-width: 480px) {
      #fbw-launcher { padding: 12px 16px; font-size: 0.85em; bottom: 16px; right: 16px; }
    }

    #fbw-modal {
      display: none;
      position: fixed;
      z-index: 9997;
      inset: 0;
      background: rgba(0,0,0,0.75);
      overflow: auto;
      font-family: 'Roboto', sans-serif;
    }
    #fbw-modal.fbw-open { display: block; }
    #fbw-modal-content {
      margin: 4% auto;
      padding: 30px;
      width: 92%;
      max-width: 640px;
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.6);
      position: relative;
    }
    #fbw-close {
      position: absolute;
      top: 10px;
      right: 18px;
      font-size: 32px;
      font-weight: bold;
      color: #333;
      cursor: pointer;
      line-height: 1;
    }
    #fbw-close:hover { color: #003087; }
    #fbw-modal h2 {
      color: #003087;
      margin: 0 0 4px 0;
      font-size: 1.4em;
    }
    #fbw-modal .fbw-subtitle {
      color: #555;
      font-size: 0.9em;
      margin: 0 0 20px 0;
      line-height: 1.4;
    }
    .fbw-question {
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #eee;
    }
    .fbw-question label.fbw-qlabel {
      display: block;
      font-weight: bold;
      color: #222;
      margin-bottom: 2px;
      font-size: 0.95em;
    }
    .fbw-dim {
      display: block;
      color: #888;
      font-size: 0.8em;
      font-style: italic;
      margin-bottom: 10px;
    }
    .fbw-scale {
      display: flex;
      justify-content: space-between;
      gap: 4px;
    }
    .fbw-scale-item {
      flex: 1;
      text-align: center;
      cursor: pointer;
    }
    .fbw-scale-item input {
      display: block;
      margin: 0 auto 6px auto;
      width: 18px;
      height: 18px;
      cursor: pointer;
    }
    .fbw-emoji {
      display: block;
      font-size: 1.3em;
      margin-bottom: 4px;
    }
    .fbw-scale-item span {
      font-size: 0.68em;
      color: #666;
      line-height: 1.2;
      display: block;
    }
    #fbw-remarks {
      width: 100%;
      padding: 10px;
      border-radius: 6px;
      border: 1px solid #ccc;
      font-family: 'Roboto', sans-serif;
      font-size: 0.9em;
      resize: vertical;
      min-height: 60px;
      box-sizing: border-box;
    }
    #fbw-submit {
      background: #003087;
      color: #fff;
      border: none;
      padding: 12px 28px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 1em;
      cursor: pointer;
      margin-top: 10px;
      width: 100%;
    }
    #fbw-submit:hover { background: #0056d2; }
    #fbw-submit:disabled { background: #99a9c9; cursor: not-allowed; }
    #fbw-status {
      margin-top: 14px;
      font-size: 0.9em;
      text-align: center;
    }
    #fbw-status.fbw-error { color: #b00020; }
    #fbw-status.fbw-success { color: #1a7a1a; }
    #fbw-thankyou {
      text-align: center;
      padding: 30px 10px;
    }
    #fbw-thankyou h3 { color: #003087; margin-bottom: 8px; }
    @media (max-width: 480px) {
      #fbw-modal-content { margin: 8% auto; padding: 20px; width: 94%; }
      .fbw-scale-item span { font-size: 0.6em; }
    }
  `;
  document.head.appendChild(style);

  /* ---------------- BUILD QUESTION HTML ---------------- */
  function buildQuestionHTML(q) {
    let scaleHTML = "";
    for (let i = 1; i <= 5; i++) {
      scaleHTML += `
        <label class="fbw-scale-item">
          <span class="fbw-emoji">${SCALE_EMOJIS[i - 1]}</span>
          <input type="radio" name="${q.id}" value="${i}" required>
          <span>${SCALE_LABELS[i - 1]}</span>
        </label>`;
    }
    return `
      <div class="fbw-question">
        <label class="fbw-qlabel">${q.label}</label>
        <span class="fbw-dim">${q.dim}</span>
        <div class="fbw-scale">${scaleHTML}</div>
      </div>`;
  }

  const questionsHTML = SQD_QUESTIONS.map(buildQuestionHTML).join("");

  /* ---------------- INJECT MARKUP ---------------- */
  const launcher = document.createElement("button");
  launcher.id = "fbw-launcher";
  launcher.type = "button";
  launcher.innerHTML = "💬 What do you think?";
  document.body.appendChild(launcher);

  const modal = document.createElement("div");
  modal.id = "fbw-modal";
  modal.innerHTML = `
    <div id="fbw-modal-content">
      <span id="fbw-close">&times;</span>
      <div id="fbw-form-wrapper">
        <h2>Tell Us What You Think! 💭</h2>
        <p class="fbw-subtitle">Whether you're a student or a teacher, your feedback helps us make this site better for everyone. It only takes a minute, and your answers are anonymous.</p>
        <form id="fbw-form">
          ${questionsHTML}
          <div class="fbw-question" style="border-bottom:none;">
            <label class="fbw-qlabel" for="fbw-remarks">Anything else you'd like to share? (optional)</label>
            <textarea id="fbw-remarks" name="remarks" placeholder="Suggestions, problems you found, or anything you liked..."></textarea>
          </div>
          <button id="fbw-submit" type="submit">Submit Feedback</button>
          <div id="fbw-status"></div>
        </form>
      </div>
      <div id="fbw-thankyou" style="display:none;">
        <h3>Salamat po! 🙏</h3>
        <p>Your feedback has been sent. We appreciate you taking the time to help us improve.</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  /* ---------------- BEHAVIOR ---------------- */
  launcher.addEventListener("click", () => modal.classList.add("fbw-open"));
  modal.querySelector("#fbw-close").addEventListener("click", () => modal.classList.remove("fbw-open"));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("fbw-open"); });

  const form = modal.querySelector("#fbw-form");
  const statusEl = modal.querySelector("#fbw-status");
  const submitBtn = modal.querySelector("#fbw-submit");

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!GAS_URL || GAS_URL.indexOf("PASTE_YOUR") === 0) {
      statusEl.textContent = "Feedback form is not fully set up yet. Please contact the site administrator.";
      statusEl.className = "fbw-error";
      return;
    }

    const formData = new FormData(form);
    const payload = {
      page: document.title || location.pathname,
      url: location.href,
      timestamp: new Date().toISOString()
    };
    SQD_QUESTIONS.forEach(q => { payload[q.id] = formData.get(q.id); });
    payload.remarks = formData.get("remarks") || "";

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";
    statusEl.textContent = "";
    statusEl.className = "";

    fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (data.status !== "success") {
          throw new Error(data.message || "Unknown error from server");
        }
        modal.querySelector("#fbw-form-wrapper").style.display = "none";
        modal.querySelector("#fbw-thankyou").style.display = "block";
        setTimeout(() => {
          modal.classList.remove("fbw-open");
          // Reset for next time
          setTimeout(() => {
            form.reset();
            modal.querySelector("#fbw-form-wrapper").style.display = "block";
            modal.querySelector("#fbw-thankyou").style.display = "none";
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Feedback";
          }, 400);
        }, 2500);
      })
      .catch((err) => {
        statusEl.textContent = "Something went wrong sending your feedback (" + err.message + "). Please try again or tell your teacher.";
        statusEl.className = "fbw-error";
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Feedback";
      });
  });
})();