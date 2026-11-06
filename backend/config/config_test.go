package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
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

// --- hot reload -----------------------------------------------------------

func validConfigJSON(password, siteName string) string {
	return `{"password":"` + password + `","jwt_secret":"` + strings.Repeat("a", 64) + `","site_name":"` + siteName + `","announcement":"hi","api_site":{"a":{"api":"https://x","name":"A"}}}`
}

func TestReloadAppliesNewValuesInPlace(t *testing.T) {
	path := writeTempConfig(t, validConfigJSON("pass1", "Old"))
	t.Setenv("PASSWORD", "")
	t.Setenv("JWT_SECRET", "")
	t.Setenv("SITE_NAME", "")
	Load(path)

	before := Get() // readers keep a stable pointer
	if got := Password(); got != "pass1" {
		t.Fatalf("initial Password() = %q, want pass1", got)
	}

	if err := os.WriteFile(path, []byte(validConfigJSON("pass2", "New")), 0600); err != nil {
		t.Fatal(err)
	}
	if err := Reload(path); err != nil {
		t.Fatalf("Reload: %v", err)
	}

	if Get() != before {
		t.Fatal("Reload must mutate the existing *Config in place, not swap the pointer")
	}
	if got := Password(); got != "pass2" {
		t.Fatalf("Password() after reload = %q, want pass2", got)
	}
	if got := Snapshot().SiteName; got != "New" {
		t.Fatalf("SiteName after reload = %q, want New", got)
	}
	if len(Snapshot().APISite) != 1 {
		t.Fatalf("api_site after reload = %d entries, want 1", len(Snapshot().APISite))
	}
}

func TestReloadKeepsEnvPrecedence(t *testing.T) {
	path := writeTempConfig(t, validConfigJSON("filepass", "FileSite"))
	t.Setenv("PASSWORD", "envpass")
	t.Setenv("JWT_SECRET", "envsecretvalue")
	t.Setenv("SITE_NAME", "EnvSite")
	Load(path)

	// Even though the file changes, env must keep winning.
	if err := os.WriteFile(path, []byte(validConfigJSON("otherpass", "OtherSite")), 0600); err != nil {
		t.Fatal(err)
	}
	if err := Reload(path); err != nil {
		t.Fatalf("Reload: %v", err)
	}
	if got := Password(); got != "envpass" {
		t.Fatalf("Password() = %q, want envpass (env precedence lost)", got)
	}
	if got := JWTSecret(); got != "envsecretvalue" {
		t.Fatalf("JWTSecret() = %q, want envsecretvalue", got)
	}
	if got := Snapshot().SiteName; got != "EnvSite" {
		t.Fatalf("SiteName = %q, want EnvSite", got)
	}
}

func TestReloadRejectsInvalidAndKeepsPrevious(t *testing.T) {
	path := writeTempConfig(t, validConfigJSON("goodpass", "Good"))
	t.Setenv("PASSWORD", "")
	t.Setenv("JWT_SECRET", "")
	t.Setenv("SITE_NAME", "")
	Load(path)

	cases := []struct {
		name string
		data string
	}{
		{"malformed json", `{not json`},
		{"insecure default password", validConfigJSON(DefaultPassword, "Bad")},
		{"empty password", validConfigJSON("", "Bad")},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if err := os.WriteFile(path, []byte(tc.data), 0600); err != nil {
				t.Fatal(err)
			}
			if err := Reload(path); err == nil {
				t.Fatal("Reload should have rejected this config")
			}
			if got := Password(); got != "goodpass" {
				t.Fatalf("Password() = %q after rejected reload, want goodpass (previous config must be kept)", got)
			}
			if got := Snapshot().SiteName; got != "Good" {
				t.Fatalf("SiteName = %q after rejected reload, want Good", got)
			}
		})
	}
}

func TestReloadRejectsMissingFileAndDoesNotOverwrite(t *testing.T) {
	path := writeTempConfig(t, validConfigJSON("goodpass", "Good"))
	t.Setenv("PASSWORD", "")
	t.Setenv("JWT_SECRET", "")
	t.Setenv("SITE_NAME", "")
	Load(path)

	missing := filepath.Join(t.TempDir(), "gone.json")
	if err := Reload(missing); err == nil {
		t.Fatal("Reload of a missing file should fail")
	}
	if _, err := os.Stat(missing); !os.IsNotExist(err) {
		t.Fatal("Reload must never create/write the config file")
	}
	if got := Password(); got != "goodpass" {
		t.Fatalf("Password() = %q after failed reload, want goodpass", got)
	}
}

func TestReloadDoesNotRegenerateSecret(t *testing.T) {
	path := writeTempConfig(t, validConfigJSON("pass1", "Old"))
	t.Setenv("PASSWORD", "")
	t.Setenv("JWT_SECRET", "")
	t.Setenv("SITE_NAME", "")
	Load(path)
	original := JWTSecret()

	// A file whose jwt_secret is the insecure default must NOT be silently
	// "fixed up" on reload (that would invalidate every active session).
	broken := `{"password":"pass2","jwt_secret":"` + DefaultJWTSecret + `","site_name":"New"}`
	if err := os.WriteFile(path, []byte(broken), 0600); err != nil {
		t.Fatal(err)
	}
	if err := Reload(path); err == nil {
		t.Fatal("Reload should reject a config with the default jwt_secret")
	}
	if got := JWTSecret(); got != original {
		t.Fatalf("JWTSecret() changed after rejected reload: %q -> %q", original, got)
	}
}

func TestWatchIntervalParsing(t *testing.T) {
	cases := []struct {
		value   string
		want    time.Duration
		enabled bool
	}{
		{"", defaultWatchInterval, true},
		{"5", 5 * time.Second, true},
		{"2500ms", 2500 * time.Millisecond, true},
		{"0", 0, false},
		{"off", 0, false},
		{"FALSE", 0, false},
		{"1ms", minWatchInterval, true},          // clamped up
		{"999h", maxWatchInterval, true},         // clamped down
		{"nonsense", defaultWatchInterval, true}, // fallback
	}
	for _, tc := range cases {
		t.Run("value="+tc.value, func(t *testing.T) {
			t.Setenv(configWatchIntervalEnv, tc.value)
			got, enabled := WatchInterval()
			if got != tc.want || enabled != tc.enabled {
				t.Fatalf("WatchInterval(%q) = (%s, %v), want (%s, %v)", tc.value, got, enabled, tc.want, tc.enabled)
			}
		})
	}
}

func TestCurrentHashTracksContent(t *testing.T) {
	path := writeTempConfig(t, `{"a":1}`)
	h1 := currentHash(path)
	if h1 == "" {
		t.Fatal("currentHash of an existing file should not be empty")
	}
	if err := os.WriteFile(path, []byte(`{"a":2}`), 0600); err != nil {
		t.Fatal(err)
	}
	h2 := currentHash(path)
	if h1 == h2 {
		t.Fatal("currentHash must change when file content changes")
	}
	if got := currentHash(filepath.Join(t.TempDir(), "missing.json")); got != "" {
		t.Fatalf("currentHash of a missing file = %q, want empty", got)
	}
}
