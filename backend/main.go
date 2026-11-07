package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"warhutv/config"
	"warhutv/handlers"
	"warhutv/middleware"
)

// version is injected at build time, e.g.:
//
//	go build -ldflags "-X main.version=$(tr -d '[:space:]' < version)"
//
// The single source of truth is the repository `version` file. It falls back
// to that file when the binary was built without ldflags (e.g. `go run .`).
var version = "dev"

func main() {
	// Run in release mode so gin.Recovery returns a generic 500 instead of
	// leaking stack traces to clients.
	gin.SetMode(gin.ReleaseMode)

	configPath := flag.String("config", config.DefaultPath(), "配置文件路径（默认 data/config.json，可用 WARHUTV_CONFIG 覆盖）")
	printVersion := flag.Bool("version", false, "打印版本号后退出")
	flag.Parse()

	if *printVersion {
		log.Printf("WarHutTV %s", version)
		return
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	config.Load(*configPath)
	handlers.Version = version

	// Refuse to start with the baked-in insecure defaults. Operators MUST set
	// a real password / jwt_secret, either via PASSWORD / JWT_SECRET or in the
	// config file.
	if config.Password() == "" || config.Password() == config.DefaultPassword {
		log.Fatal("refusing to start: admin password is empty or equals the insecure default. Set PASSWORD or edit " + *configPath + ".")
	}
	if config.JWTSecret() == "" || config.JWTSecret() == config.DefaultJWTSecret {
		log.Fatal("refusing to start: JWT secret is empty or equals the insecure default. Set JWT_SECRET or edit " + *configPath + ".")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	// gin.New (not gin.Default): the built-in logger prints the raw query
	// string, which leaked search keywords into the server log. Recovery is
	// kept, and request logging goes through the structured middleware below.
	r := gin.New()
	r.Use(gin.Recovery(), middleware.RequestID(), middleware.RequestLogger())
	r.Use(middleware.SecurityHeaders())
	r.Use(middleware.CORSMiddleware())
	setTrustedProxies(r)

	api := r.Group("/api")
	{
		api.POST("/auth/login", handlers.Login)
		api.POST("/auth/logout", handlers.Logout)
		api.GET("/search/stream", middleware.SearchRateLimit(), handlers.SearchStream)
		api.GET("/config", handlers.GetConfig)
		api.GET("/version", handlers.GetVersion)
		api.GET("/healthz", handlers.Healthz)
	}

	auth := r.Group("/api")
	auth.Use(middleware.AuthMiddleware())
	{
		auth.GET("/auth/verify", handlers.Verify)

		auth.GET("/detail", handlers.Detail)
		auth.GET("/play", handlers.Play)

		auth.GET("/bangumi/calendar", handlers.BangumiCalendar)
		auth.GET("/sites/ping", handlers.PingSites)
		auth.GET("/douban/*path", handlers.DoubanProxy)
	}

	mountStaticAssets(r)

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		// WriteTimeout stays 0: /api/search/stream is a long-lived SSE
		// response and a deadline would cut it off mid-search.
		IdleTimeout: 120 * time.Second,
	}

	go func() {
		log.Printf("WarHutTV %s listening on :%s (config: %s)", version, port, *configPath)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-ctx.Done()
	stop()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
	log.Println("server stopped")
}

// setTrustedProxies limits which peers may spoof X-Forwarded-For. Without it
// gin trusts every proxy, so a client can rotate its apparent IP and bypass the
// login rate limiter. TRUSTED_PROXIES is a comma-separated list of IPs/CIDRs.
func setTrustedProxies(r *gin.Engine) {
	raw := strings.TrimSpace(os.Getenv("TRUSTED_PROXIES"))
	if raw == "" {
		raw = "127.0.0.1,::1"
	}
	var proxies []string
	for _, part := range strings.Split(raw, ",") {
		if proxy := strings.TrimSpace(part); proxy != "" {
			proxies = append(proxies, proxy)
		}
	}
	if err := r.SetTrustedProxies(proxies); err != nil {
		log.Printf("invalid TRUSTED_PROXIES %q: %v; disabling proxy header trust", raw, err)
		if fallbackErr := r.SetTrustedProxies(nil); fallbackErr != nil {
			log.Printf("failed to disable trusted proxies: %v", fallbackErr)
		}
	}
}
