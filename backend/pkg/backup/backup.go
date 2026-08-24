package backup

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"io"

	"golang.org/x/crypto/pbkdf2"
)

const (
	SaltSize   = 16
	NonceSize  = 12
	KeySize    = 32
	PBKDF2Iter = 10000
)

var (
	ErrInvalidPassword = errors.New("invalid password or corrupted backup archive")
	ErrShortData        = errors.New("backup data too short")
)

// EncryptBackup encrypts raw backup payload using AES-256-GCM derived via PBKDF2
func EncryptBackup(plainData []byte, password string) ([]byte, error) {
	if len(password) == 0 {
		return nil, errors.New("password cannot be empty")
	}

	salt := make([]byte, SaltSize)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return nil, err
	}

	key := pbkdf2.Key([]byte(password), salt, PBKDF2Iter, KeySize, sha256.New)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, NonceSize)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nil, nonce, plainData, nil)

	// Combine: salt + nonce + ciphertext
	finalData := make([]byte, 0, len(salt)+len(nonce)+len(ciphertext))
	finalData = append(finalData, salt...)
	finalData = append(finalData, nonce...)
	finalData = append(finalData, ciphertext...)

	return finalData, nil
}

// DecryptBackup decrypts an encrypted .qmbackup payload using PBKDF2 AES-256-GCM
func DecryptBackup(encryptedData []byte, password string) ([]byte, error) {
	if len(password) == 0 {
		return nil, errors.New("password cannot be empty")
	}

	minLen := SaltSize + NonceSize
	if len(encryptedData) <= minLen {
		return nil, ErrShortData
	}

	salt := encryptedData[:SaltSize]
	nonce := encryptedData[SaltSize : SaltSize+NonceSize]
	ciphertext := encryptedData[SaltSize+NonceSize:]

	key := pbkdf2.Key([]byte(password), salt, PBKDF2Iter, KeySize, sha256.New)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, ErrInvalidPassword
	}

	return plaintext, nil
}
