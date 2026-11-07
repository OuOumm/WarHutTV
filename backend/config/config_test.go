package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCloneAPISiteIsIndependent(t *testing.T) {
	src := map[string]SiteConfig{"a": {API: "https://x", Name: "A"}}
	dst := cloneAPISite(src)
	dst["a"] = SiteConfig{API: "https://y", Name: "B"}

	if src["a"].API == dst["a"].API {
		t.Fatal("clone must be independent of the source map")
	}
}

func TestCloneAPISiteNilSafe(t *testing.T) {
	if cloneAPISite(nil) == nil {
		t.Fatal("cloning nil should yield a non-nil empty map")
	}
}

func writeTempConfig(t *testing.T, contents string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "config.json")
	if err := os.WriteFile(path, []byte(contents), 0600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestLoadEnvironmentOverridesFile(t *testing.T) {
	path := writeTempConfig(t, `{"password":"filepass","jwt_secret":"file-secret-value","api_site":{}}`)
	t.Setenv("PASSWORD", "envpass")
	t.Setenv("JWT_SECRET", "env-secret-value")
	t.Setenv("SITE_NAME", "EnvSite")

	Load(path)

	if got := Password(); got != "envpass" {
		t.Fatalf("Password() = %q, want envpass", got)
	}
	if got := JWTSecret(); got != "env-secret-value" {
		t.Fatalf("JWTSecret() = %q, want env-secret-value", got)
	}
	if got := Snapshot().SiteName; got != "EnvSite" {
		t.Fatalf("SiteName = %q, want EnvSite", got)
	}
}

func TestSaveKeepsFileSecretsWhenEnvOverrides(t *testing.T) {
	path := writeTempConfig(t, `{"password":"filepass","jwt_secret":"file-secret-value","api_site":{}}`)
	t.Setenv("PASSWORD", "envpass")
	t.Setenv("JWT_SECRET", "env-secret-value")

	Load(path)
	if err := Get().Save(path); err != nil {
		t.Fatalf("Save: %v", err)
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var written ConfigSnapshot
	if err := json.Unmarshal(raw, &written); err != nil {
		t.Fatal(err)
	}
	if written.Password != "filepass" {
		t.Errorf("persisted password = %q, want filepass (env must not be written)", written.Password)
	}
	if written.JWTSecret != "file-secret-value" {
		t.Errorf("persisted jwt_secret = %q, want file-secret-value (env must not be written)", written.JWTSecret)
	}
	if strings.Contains(string(raw), "env-secret-value") {
		t.Error("environment secret leaked into the config file")
	}
}

func TestLoadCreatesMissingConfigWithGeneratedSecret(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "config.json")
	t.Setenv("PASSWORD", "envpass")
	t.Setenv("JWT_SECRET", "")

	Load(path)

	if got := JWTSecret(); len(got) != 64 {
		t.Fatalf("generated JWTSecret length = %d, want 64", len(got))
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("config file was not created: %v", err)
	}
}

func TestDefaultPathUsesEnv(t *testing.T) {
	t.Setenv("WARHUTV_CONFIG", "/tmp/custom.json")
	if got := DefaultPath(); got != "/tmp/custom.json" {
		t.Fatalf("DefaultPath() = %q, want /tmp/custom.json", got)
	}
	t.Setenv("WARHUTV_CONFIG", "")
	if got := DefaultPath(); got != defaultConfigPath {
		t.Fatalf("DefaultPath() = %q, want %q", got, defaultConfigPath)
	}
}

// The config is read once at startup and is immutable afterwards. Editing the
// file at runtime must NOT change what Get()/Password()/Snapshot() return —
// hot reload was removed deliberately (see project-review §10.10), so a config
// change requires a restart. This test pins that behavior.
func TestConfigIsImmutableAfterLoad(t *testing.T) {
	path := writeTempConfig(t, `{"password":"startpass","jwt_secret":"`+strings.Repeat("a", 64)+`","site_name":"Start","api_site":{}}`)
	t.Setenv("PASSWORD", "")
	t.Setenv("JWT_SECRET", "")
	t.Setenv("SITE_NAME", "")

	Load(path)
	before := Get()

	if got := Password(); got != "startpass" {
		t.Fatalf("initial Password() = %q, want startpass", got)
	}

	// Simulate an operator editing data/config.json while the process runs.
	if err := os.WriteFile(path, []byte(`{"password":"changed","jwt_secret":"`+strings.Repeat("b", 64)+`","site_name":"Changed","api_site":{}}`), 0600); err != nil {
		t.Fatal(err)
	}

	if Get() != before {
		t.Fatal("Get() must return the same config pointer; config is immutable after startup")
	}
	if got := Password(); got != "startpass" {
		t.Fatalf("Password() = %q after editing the file, want startpass (no hot reload)", got)
	}
	if got := Snapshot().SiteName; got != "Start" {
		t.Fatalf("SiteName = %q after editing the file, want Start (no hot reload)", got)
	}
}
