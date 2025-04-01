---
name: New EMM - AE QRCode
about: Create a report to request a new EMM
title: ''
labels: ''
assignees: ''

---

**EMM Name (Required)**
Name of the EMM used to be added for QR Code Enrollments

**EMM Provisioning Details (Optional)**
Please populate as many as possible:

 - PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME
 - PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION
 - PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM
 - PROVISIONING_ADMIN_EXTRAS_BUNDLE - note please provide sample JSON without any PI (see example below)

```
 {
  "tenantId": "your-tenant-id",
  "AllowModifyUserId": "Allow",
  }
```