import { useEffect, useMemo, useState } from "react";
import {
  createTask,
  deleteTask,
  getDailyReport,
  getStats,
  getTasks,
  login,
  register,
  updateTask
} from "./api";

const INITIAL_FORM = { email: "", password: "" };
const INITIAL_TASK = { title: "", description: "", status: "todo" };

export default function App() {
  const [authForm, setAuthForm] = useState(INITIAL_FORM);
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [tasks, setTasks] = useState([]);
  const [taskForm, setTaskForm] = useState(INITIAL_TASK);
  const [stats, setStats] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isLoggedIn = useMemo(() => Boolean(token), [token]);

  useEffect(() => {
    if (!token) return;
    void refreshTasks(token);
  }, [token]);

  useEffect(() => {
    void refreshAnalytics();
    const id = setInterval(() => {
      void refreshAnalytics();
    }, 15000);
    return () => clearInterval(id);
  }, []);

  async function refreshTasks(currentToken) {
    try {
      setLoading(true);
      const data = await getTasks(currentToken);
      setTasks(data);
      setError("");
    } catch {
      setError("Could not load tasks");
    } finally {
      setLoading(false);
    }
  }

  async function refreshAnalytics() {
    try {
      const [statsData, reportData] = await Promise.all([getStats(), getDailyReport()]);
      setStats(statsData);
      setReport(reportData);
    } catch {
      // Keep UI quiet if analytics backend is down.
    }
  }

  async function onAuthSubmit(event, mode) {
    event.preventDefault();
    try {
      setLoading(true);
      const response = mode === "login" ? await login(authForm) : await register(authForm);
      setToken(response.token);
      localStorage.setItem("token", response.token);
      setAuthForm(INITIAL_FORM);
      setError("");
    } catch {
      setError(mode === "login" ? "Login failed" : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function onCreateTask(event) {
    event.preventDefault();
    if (!taskForm.title.trim()) return;
    try {
      setLoading(true);
      const created = await createTask(token, taskForm);
      setTasks((prev) => [created, ...prev]);
      setTaskForm(INITIAL_TASK);
      setError("");
      await refreshAnalytics();
    } catch {
      setError("Failed to create task");
    } finally {
      setLoading(false);
    }
  }

  async function onUpdateStatus(id, status) {
    try {
      const updated = await updateTask(token, id, { status });
      setTasks((prev) => prev.map((task) => (task.id === id ? updated : task)));
      await refreshAnalytics();
    } catch {
      setError("Failed to update task");
    }
  }

  async function onDeleteTask(id) {
    try {
      await deleteTask(token, id);
      setTasks((prev) => prev.filter((task) => task.id !== id));
      await refreshAnalytics();
    } catch {
      setError("Failed to delete task");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setToken("");
    setTasks([]);
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>Task Manager + Analytics</h1>
        {isLoggedIn && (
          <button className="button ghost" onClick={logout}>
            Logout
          </button>
        )}
      </header>

      {error && <p className="error">{error}</p>}

      <section className="grid">
        <div className="card">
          {!isLoggedIn ? (
            <>
              <h2>Login / Register</h2>
              <form className="stack" onSubmit={(event) => onAuthSubmit(event, "login")}>
                <input
                  placeholder="Email"
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                />
                <input
                  placeholder="Password"
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                />
                <div className="row">
                  <button className="button" disabled={loading} type="submit">
                    Login
                  </button>
                  <button
                    className="button secondary"
                    disabled={loading}
                    type="button"
                    onClick={(event) => onAuthSubmit(event, "register")}
                  >
                    Register
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <h2>Create Task</h2>
              <form className="stack" onSubmit={onCreateTask}>
                <input
                  placeholder="Task title"
                  value={taskForm.title}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                />
                <textarea
                  placeholder="Description"
                  value={taskForm.description}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, description: event.target.value }))}
                />
                <select
                  value={taskForm.status}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, status: event.target.value }))}
                >
                  <option value="todo">Todo</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
                <button className="button" disabled={loading} type="submit">
                  Add Task
                </button>
              </form>
            </>
          )}
        </div>

        <div className="card">
          <h2>Analytics</h2>
          <div className="metrics">
            <p>Total: {stats?.total ?? "-"}</p>
            <p>Todo: {stats?.todo ?? "-"}</p>
            <p>In Progress: {stats?.in_progress ?? "-"}</p>
            <p>Done: {stats?.done ?? "-"}</p>
            <p>Done Rate: {stats ? `${(stats.done_rate * 100).toFixed(1)}%` : "-"}</p>
          </div>
          <p className="muted">Report Generated: {report?.generated_at ?? "-"}</p>
        </div>
      </section>

      {isLoggedIn && (
        <section className="card">
          <h2>Your Tasks</h2>
          {tasks.length === 0 && <p className="muted">No tasks yet</p>}
          <ul className="taskList">
            {tasks.map((task) => (
              <li key={task.id} className="taskItem">
                <div>
                  <h3>{task.title}</h3>
                  <p>{task.description || "No description"}</p>
                </div>
                <div className="row">
                  <select value={task.status} onChange={(event) => onUpdateStatus(task.id, event.target.value)}>
                    <option value="todo">Todo</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                  <button className="button danger" onClick={() => onDeleteTask(task.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

