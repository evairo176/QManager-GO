package web

import (
	"bytes"
	"embed"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path"
	"strings"
)

//go:embed all:out
var webFS embed.FS

// GetFileSystem returns embedded static web files
func GetFileSystem() http.FileSystem {
	sub, err := fs.Sub(webFS, "out")
	if err != nil {
		return nil
	}
	return http.FS(sub)
}

// ServeEmbeddedWeb returns an http.Handler serving embedded static assets with SPA routing support
func ServeEmbeddedWeb() http.Handler {
	subFS, err := fs.Sub(webFS, "out")
	if err != nil {
		return http.NotFoundHandler()
	}
	fileServer := http.FileServer(http.FS(subFS))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/cgi-bin/quecmanager/") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"success":false,"error":"endpoint_not_found"}`))
			return
		}

		urlPath := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if urlPath == "" || urlPath == "." {
			fileServer.ServeHTTP(w, r)
			return
		}

		// Check if exact file exists in embedded subFS
		f, err := subFS.Open(urlPath)
		if err == nil {
			stat, statErr := f.Stat()
			if statErr == nil && !stat.IsDir() {
				_ = f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}
			_ = f.Close()
		}

		// Try appending .html (Next.js static export path matching)
		htmlPath := urlPath + ".html"
		if fHtml, err := subFS.Open(htmlPath); err == nil {
			defer fHtml.Close()
			if stat, err := fHtml.Stat(); err == nil && !stat.IsDir() {
				content, readErr := io.ReadAll(fHtml)
				if readErr == nil {
					w.Header().Set("Content-Type", "text/html; charset=utf-8")
					http.ServeContent(w, r, stat.Name(), stat.ModTime(), bytes.NewReader(content))
					return
				}
			}
		}

		// Try directory index.html
		indexPath := path.Join(urlPath, "index.html")
		if fIndex, err := subFS.Open(indexPath); err == nil {
			defer fIndex.Close()
			if stat, err := fIndex.Stat(); err == nil && !stat.IsDir() {
				content, readErr := io.ReadAll(fIndex)
				if readErr == nil {
					w.Header().Set("Content-Type", "text/html; charset=utf-8")
					http.ServeContent(w, r, stat.Name(), stat.ModTime(), bytes.NewReader(content))
					return
				}
			}
		}

		// Fallback to root index.html for SPA routes
		if fRoot, err := subFS.Open("index.html"); err == nil {
			defer fRoot.Close()
			if stat, err := fRoot.Stat(); err == nil {
				content, readErr := io.ReadAll(fRoot)
				if readErr == nil {
					w.Header().Set("Content-Type", "text/html; charset=utf-8")
					http.ServeContent(w, r, "index.html", stat.ModTime(), bytes.NewReader(content))
					return
				}
			}
		}

		fileServer.ServeHTTP(w, r)
	})
}

// LocalDirExists checks if local static dir exists on disk (dev mode override)
func LocalDirExists(dir string) bool {
	info, err := os.Stat(dir)
	return err == nil && info.IsDir()
}
