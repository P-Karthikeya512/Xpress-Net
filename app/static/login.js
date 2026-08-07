document.addEventListener("DOMContentLoaded", () => {
  if (getToken()) {
    window.location.href = "/static/dashboard.html";
    return;
  }

  const loginTab = document.getElementById("login-tab");
  const registerTab = document.getElementById("register-tab");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const messageBox = document.getElementById("auth-message");

  const loginSubmit = document.getElementById("login-submit");
  const registerSubmit = document.getElementById("register-submit");

  const showMessage = (type, text) => {
    messageBox.className = "mt-6 rounded-xl border px-4 py-3 text-sm";
    messageBox.classList.remove("hidden");
    if (type === "success") {
      messageBox.classList.add("border-emerald-200", "bg-emerald-50", "text-emerald-700");
    } else {
      messageBox.classList.add("border-red-200", "bg-red-50", "text-red-700");
    }
    messageBox.textContent = text;
  };

  const hideMessage = () => {
    messageBox.classList.add("hidden");
    messageBox.textContent = "";
  };

  const setActiveTab = (tab) => {
    const isLogin = tab === "login";
    loginTab.classList.toggle("active", isLogin);
    registerTab.classList.toggle("active", !isLogin);
    loginForm.classList.toggle("hidden", !isLogin);
    registerForm.classList.toggle("hidden", isLogin);
    hideMessage();
  };

  loginTab?.addEventListener("click", () => setActiveTab("login"));
  registerTab?.addEventListener("click", () => setActiveTab("register"));

  document.querySelectorAll(".toggle-eye").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
    });
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideMessage();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    if (!email || !password) {
      showMessage("error", "Please fill in both fields.");
      return;
    }

    loginSubmit.disabled = true;
    loginSubmit.textContent = "Logging in…";

    try {
      const body = new URLSearchParams();
      body.append("username", email);
      body.append("password", password);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail || "Login failed.");
      }

      const data = await response.json();
      setTokens(data.access_token, data.refresh_token);
      setEmail(email);

      window.location.href = "/static/dashboard.html";
    } catch (err) {
      showMessage("error", err.message || "Something went wrong.");
    } finally {
      loginSubmit.disabled = false;
      loginSubmit.textContent = "Login";
    }
  });

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideMessage();

    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    if (!email || !password || !confirmPassword) {
      showMessage("error", "Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("error", "Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      showMessage("error", "Password should be at least 6 characters long.");
      return;
    }

    registerSubmit.disabled = true;
    registerSubmit.textContent = "Creating account…";

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail || "Registration failed.");
      }

      showMessage("success", "Account created successfully. You can log in now.");
      setActiveTab("login");
      loginForm.reset();
      registerForm.reset();
      document.getElementById("login-email").value = email;
    } catch (err) {
      showMessage("error", err.message || "Something went wrong.");
    } finally {
      registerSubmit.disabled = false;
      registerSubmit.textContent = "Create account";
    }
  });
});
