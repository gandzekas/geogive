#!/bin/bash
# generate-signing-key.sh
# Generates a Java KeyStore (.jks) for signing the GeoGive TWA release build.
#
# USAGE:
#   chmod +x generate-signing-key.sh
#   ./generate-signing-key.sh
#
# IMPORTANT:
#   - Store the .jks file in a safe location (NOT in version control)
#   - Remember the store password, key password, and alias
#   - You need this same key for all future updates to the Play Store
#   - If you lose the key, you cannot update your app on the Play Store

set -euo pipefail

KEYSTORE_FILE="geogive-release-key.jks"
KEY_ALIAS="geogive"
KEY_SIZE=2048
VALIDITY_DAYS=10000  # ~27 years

echo "========================================="
echo "  GeoGive Signing Key Generator"
echo "========================================="
echo ""
echo "This will create: ${KEYSTORE_FILE}"
echo "Key alias:        ${KEY_ALIAS}"
echo "Key algorithm:    RSA ${KEY_SIZE}-bit"
echo "Validity:         ${VALIDITY_DAYS} days"
echo ""

# Prompt for passwords (hidden input)
read -s -p "Enter STORE password (min 6 chars): " STORE_PASSWORD
echo ""
read -s -p "Enter KEY password (min 6 chars): " KEY_PASSWORD
echo ""

# Prompt for certificate details
echo ""
echo "Certificate information (press Enter for defaults):"
read -p "Common Name [GeoGive]: " CN
CN=${CN:-"GeoGive"}
read -p "Organizational Unit [Mobile]: " OU
OU=${OU:-"Mobile"}
read -p "Organization [GeoGive Inc]: " O
O=${O:-"GeoGive Inc"}
read -p "City [San Francisco]: " L
L=${L:-"San Francisco"}
read -p "State [California]: " ST
ST=${ST:-"California"}
read -p "Country Code [US]: " C
C=${C:-"US"}

DN="CN=${CN}, OU=${OU}, O=${O}, L=${L}, ST=${ST}, C=${C}"

echo ""
echo "Generating signing key..."
echo ""

keytool -genkeypair \
  -keystore "${KEYSTORE_FILE}" \
  -alias "${KEY_ALIAS}" \
  -keyalg RSA \
  -keysize ${KEY_SIZE} \
  -validity ${VALIDITY_DAYS} \
  -storepass "${STORE_PASSWORD}" \
  -keypass "${KEY_PASSWORD}" \
  -dname "${DN}"

echo ""
echo "✅ Signing key generated: ${KEYSTORE_FILE}"
echo ""

# Display the SHA-256 fingerprint
echo "SHA-256 Certificate Fingerprint:"
keytool -list \
  -v \
  -keystore "${KEYSTORE_FILE}" \
  -alias "${KEY_ALIAS}" \
  -storepass "${STORE_PASSWORD}" \
  | grep "SHA256:"

echo ""
echo "========================================="
echo "  NEXT STEPS"
echo "========================================="
echo ""
echo "1. Add to .gitignore:"
echo "   echo '${KEYSTORE_FILE}' >> .gitignore"
echo ""
echo "2. Get the SHA-256 fingerprint for assetlinks.json:"
echo "   keytool -list -v -keystore ${KEYSTORE_FILE} -alias ${KEY_ALIAS} -storepass 'YOUR_PASSWORD' | grep SHA256:"
echo ""
echo "3. Create gradle-local.properties with signing config:"
echo "   cat > gradle-local.properties << EOF"
echo "   storeFile=${KEYSTORE_FILE}"
echo "   storePassword=${STORE_PASSWORD}"
echo "   keyAlias=${KEY_ALIAS}"
echo "   keyPassword=${KEY_PASSWORD}"
echo "   EOF"
echo ""
echo "4. Add gradle-local.properties to .gitignore:"
echo "   echo 'gradle-local.properties' >> .gitignore"
echo ""
echo "⚠️  WARNING: Keep ${KEYSTORE_FILE} and passwords safe!"
echo "   If lost, you CANNOT update your app on the Play Store."
echo ""
