package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	_ "modernc.org/sqlite"
)

type StatsResponse struct {
	Total      int     `json:"total"`
	Todo       int     `json:"todo"`
	InProgress int     `json:"in_progress"`
	Done       int     `json:"done"`
	DoneRate   float64 `json:"done_rate"`
}

type Report struct {
	GeneratedAt string        `json:"generated_at"`
	Stats       StatsResponse `json:"stats"`
}

func envOrDefault(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func parseIntOrDefault(raw string, fallback int) int {
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return value
}

func queryStats(db *sql.DB) (StatsResponse, error) {
	row := db.QueryRow(`
		SELECT
			COUNT(*) as total,
			SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
			SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
			SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
		FROM tasks
	`)

	var stats StatsResponse
	var todo, inProgress, done sql.NullInt64
	err := row.Scan(&stats.Total, &todo, &inProgress, &done)
	if err != nil {
		return stats, err
	}

	if todo.Valid {
		stats.Todo = int(todo.Int64)
	}
	if inProgress.Valid {
		stats.InProgress = int(inProgress.Int64)
	}
	if done.Valid {
		stats.Done = int(done.Int64)
	}
	if stats.Total > 0 {
		stats.DoneRate = float64(stats.Done) / float64(stats.Total)
	}

	return stats, nil
}

func writeReport(reportDir string, report Report) error {
	if err := os.MkdirAll(reportDir, 0o755); err != nil {
		return err
	}
	path := filepath.Join(reportDir, "latest_report.json")
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	return encoder.Encode(report)
}

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

func main() {
	port := envOrDefault("PORT", "5000")
	dbPath := envOrDefault("DB_PATH", "../backend/data/app.db")
	reportDir := envOrDefault("REPORT_DIR", "./reports")
	intervalSeconds := parseIntOrDefault(envOrDefault("JOB_INTERVAL_SECONDS", "60"), 60)

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatalf("failed to open db: %v", err)
	}
	defer db.Close()

	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS tasks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		title TEXT NOT NULL,
		description TEXT DEFAULT '',
		status TEXT DEFAULT 'todo',
		due_date TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
	if err != nil {
		log.Fatalf("failed to ensure tasks table: %v", err)
	}

	go func() {
		ticker := time.NewTicker(time.Duration(intervalSeconds) * time.Second)
		defer ticker.Stop()

		for {
			stats, statErr := queryStats(db)
			if statErr != nil {
				log.Printf("background stats error: %v", statErr)
				<-ticker.C
				continue
			}
			report := Report{
				GeneratedAt: time.Now().Format(time.RFC3339),
				Stats:       stats,
			}
			if reportErr := writeReport(reportDir, report); reportErr != nil {
				log.Printf("report write error: %v", reportErr)
			}
			<-ticker.C
		}
	}()

	http.HandleFunc("/health", corsMiddleware(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	}))

	http.HandleFunc("/stats", corsMiddleware(func(w http.ResponseWriter, _ *http.Request) {
		stats, statErr := queryStats(db)
		if statErr != nil {
			http.Error(w, `{"error":"failed to query stats"}`, http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(stats)
	}))

	http.HandleFunc("/report/daily", corsMiddleware(func(w http.ResponseWriter, _ *http.Request) {
		stats, statErr := queryStats(db)
		if statErr != nil {
			http.Error(w, `{"error":"failed to build report"}`, http.StatusInternalServerError)
			return
		}
		report := Report{
			GeneratedAt: time.Now().Format(time.RFC3339),
			Stats:       stats,
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(report)
	}))

	log.Printf("analytics service listening on http://localhost:%s", port)
	if serveErr := http.ListenAndServe(":"+port, nil); serveErr != nil {
		log.Fatalf("server error: %v", serveErr)
	}
}

