package utils

import (
	"testing"
	"time"
)

func TestGenerateAndValidateToken(t *testing.T) {
	secret := "test-secret"
	tok, err := GenerateToken(secret, time.Hour)
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	claims, err := ValidateToken(tok, secret)
	if err != nil {
		t.Fatalf("validate: %v", err)
	}
	if claims.ExpiresAt == nil {
		t.Fatal("expected ExpiresAt to be set")
	}
}

func TestValidateTokenWrongSecret(t *testing.T) {
	tok, _ := GenerateToken("secret-a", time.Hour)
	if _, err := ValidateToken(tok, "secret-b"); err == nil {
		t.Fatal("expected error for wrong secret")
	}
}

func TestValidateTokenExpired(t *testing.T) {
	tok, _ := GenerateToken("secret", -time.Hour)
	if _, err := ValidateToken(tok, "secret"); err == nil {
		t.Fatal("expected error for expired token")
	}
}

func TestValidateTokenRejectsNonHMAC(t *testing.T) {
	// A token claiming the "none" algorithm must be rejected by the method check.
	noneToken := "eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjM0NTY3ODkwIn0."
	if _, err := ValidateToken(noneToken, "secret"); err == nil {
		t.Fatal("expected error for non-HMAC token")
	}
}
