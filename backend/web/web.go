package web

import (
	"embed"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
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
		urlPath := strings.TrimPrefix(r.URL.Path, "/")
		if urlPath == "" {
			fileServer.ServeHTTP(w, r)
			return
		}

		// Check if file exists in embedded subFS
		f, err := subFS.Open(urlPath)
		if err == nil {
			_ = f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// Try appending .html (Next.js static export path matching)
		htmlPath := urlPath + ".html"
		if fHtml, err := subFS.Open(htmlPath); err == nil {
			_ = fHtml.Close()
			r.URL.Path = "/" + htmlPath
			fileServer.ServeHTTP(w, r)
			return
		}

		// Try directory index.html
		indexPath := filepath.Join(urlPath, "index.html")
		if fIndex, err := subFS.Open(indexPath); err == nil {
			_ = fIndex.Close()
			r.URL.Path = "/" + indexPath
			fileServer.ServeHTTP(w, r)
			return
		}

		// Fallback to root index.html for SPA routes
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}

// FallbackFileExists checks if local static dir exists on disk (dev mode override)
func LocalDirExists(dir string) bool {
	info, err := os.Stat(dir)
	return err == nil && info.IsDir()
}
