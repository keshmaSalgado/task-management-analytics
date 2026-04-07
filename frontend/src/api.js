const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const ANALYTICS_URL = import.meta.env.VITE_ANALYTICS_URL || "http://localhost:5000";

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function register(payload) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Register failed");
  return response.json();
}

export async function login(payload) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Login failed");
  return response.json();
}

export async function getTasks(token) {
  const response = await fetch(`${API_URL}/tasks`, { headers: authHeaders(token) });
  if (!response.ok) throw new Error("Failed to fetch tasks");
  return response.json();
}

export async function createTask(token, payload) {
  const response = await fetch(`${API_URL}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to create task");
  return response.json();
}

export async function updateTask(token, id, payload) {
  const response = await fetch(`${API_URL}/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to update task");
  return response.json();
}

export async function deleteTask(token, id) {
  const response = await fetch(`${API_URL}/tasks/${id}`, {
    method: "DELETE",
    headers: authHeaders(token)
  });
  if (!response.ok) throw new Error("Failed to delete task");
}

export async function getStats() {
  const response = await fetch(`${ANALYTICS_URL}/stats`);
  if (!response.ok) throw new Error("Failed to fetch stats");
  return response.json();
}

export async function getDailyReport() {
  const response = await fetch(`${ANALYTICS_URL}/report/daily`);
  if (!response.ok) throw new Error("Failed to fetch report");
  return response.json();
}

