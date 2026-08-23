package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"qmanager-backend/pkg/api"
	"qmanager-backend/pkg/at"
	"qmanager-backend/pkg/daemon"
	"qmanager-backend/pkg/tlsgen"
	"qmanager-backend/web"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "80"
	}

	tlsPort := os.Getenv("TLS_PORT")
	if tlsPort == "" {
		tlsPort = "443"
	}

	webRoot := os.Getenv("WEB_ROOT")
	tlsEnabled := os.Getenv("TLS_ENABLED") != "false" // enabled by default unless explicitly disabled

	mux := http.NewServeMux()

	// Initialize AT Client
	atClient := at.NewClient("/dev/smd11")

	// Start Background Poller Daemon (runs continuously without spawning subshells)
	poller := daemon.NewPoller(atClient, 5*time.Second)
	poller.Start()
	log.Println("[Daemon] Background Status Poller started (5s interval)")

	// Register API Routes
	server := api.NewServer(atClient)
	server.RegisterRoutes(mux)

	// API Health Check
	mux.HandleFunc("/cgi-bin/quecmanager/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","arch":"%s","os":"%s"}`, runtime.GOARCH, runtime.GOOS)
	})

	// Static File Server: Embedded FS or Disk Fallback
	if webRoot != "" {
		log.Printf("[Web] Serving static assets from disk path: %s", webRoot)
		diskFS := http.Dir(webRoot)
		fileServer := http.FileServer(diskFS)
		mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			path := filepath.Join(webRoot, filepath.Clean(r.URL.Path))
			info, err := os.Stat(path)
			if err != nil && os.IsNotExist(err) {
				http.ServeFile(w, r, filepath.Join(webRoot, "index.html"))
				return
			}
			if err == nil && info.IsDir() {
				http.ServeFile(w, r, filepath.Join(path, "index.html"))
				return
			}
			fileServer.ServeHTTP(w, r)
		}))
	} else {
		log.Println("[Web] Serving static assets from embedded binary (embed.FS all:out)")
		mux.Handle("/", web.ServeEmbeddedWeb())
	}

	// Setup HTTPS TLS Certificates if enabled
	if tlsEnabled {
		certPath, keyPath, err := tlsgen.EnsureCertificates("")
		if err != nil {
			log.Printf("[TLS] Warning: Failed to initialize TLS certs: %v", err)
		} else {
			log.Printf("[TLS] HTTPS Enabled on port %s (cert: %s)", tlsPort, certPath)
			go func() {
				if err := http.ListenAndServeTLS(":"+tlsPort, certPath, keyPath, mux); err != nil {
					log.Printf("[TLS] HTTPS server stopped: %v", err)
				}
			}()
		}
	}

	log.Printf("QManager Go Backend listening on HTTP port %s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
