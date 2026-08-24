package backup

import (
	"bytes"
	"testing"
)

func TestEncryptDecryptBackup(t *testing.T) {
	plainText := []byte(`{"uci_config":{"quecmanager":{"general":{"language":"en"}}}}`)
	password := "SecretPassword123!"

	encrypted, err := EncryptBackup(plainText, password)
	if err != nil {
		t.Fatalf("failed to encrypt backup: %v", err)
	}

	if bytes.Equal(encrypted, plainText) {
		t.Errorf("encrypted data should not match plaintext")
	}

	decrypted, err := DecryptBackup(encrypted, password)
	if err != nil {
		t.Fatalf("failed to decrypt backup: %v", err)
	}

	if !bytes.Equal(decrypted, plainText) {
		t.Errorf("decrypted output does not match original plaintext. Got: %s", string(decrypted))
	}

	// Test invalid password
	_, err = DecryptBackup(encrypted, "WrongPassword")
	if err == nil {
		t.Errorf("expected error when decrypting with wrong password, got nil")
	}
}
