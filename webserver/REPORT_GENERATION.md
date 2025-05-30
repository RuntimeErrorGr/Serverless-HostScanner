# Report Generation Feature

This document describes the report generation functionality implemented in the pentesting application.

## Overview

The application now supports generating reports in multiple formats (PDF, JSON, CSV) for completed scans. Reports are generated asynchronously using Celery tasks and stored in a persistent volume for later download or email delivery.

## Architecture

### Components

1. **Celery Task**: `generate_report_task` in `app/tasks.py` handles the actual report generation
2. **Templates**: Jinja2 templates in `app/templates/` for different report formats
3. **Persistent Storage**: Reports are stored in `/app/reports` mounted from a Kubernetes PV
4. **API Endpoints**: FastAPI routes for generating, downloading, and emailing reports
5. **Email Service**: SMTP-based email service for sending reports as attachments

### Report Formats

- **PDF**: Beautiful HTML-to-PDF reports with styling and charts
- **JSON**: Structured data export with all scan details
- **CSV**: Tabular format suitable for spreadsheet analysis

## API Usage

### Generate a Report

```http
POST /api/scans/{scan_uuid}/report
Content-Type: application/json

{
    "format": "pdf"  // or "json" or "csv"
}
```

Response:
```json
{
    "message": "Report generation started",
    "report_id": 123,
    "report_uuid": "uuid-here",
    "format": "pdf",
    "status": "pending"
}
```

### Check Report Status

```http
GET /api/reports/{report_uuid}
```

### Download Report

```http
GET /api/reports/{report_uuid}/download
```

### Send Report via Email

```http
POST /api/reports/{report_uuid}/email
Content-Type: application/json

{
    "to": "recipient@example.com",
    "subject": "Security Scan Report",
    "message": "Optional custom message"
}
```

Response:
```json
{
    "message": "Email sent successfully",
    "recipient": "recipient@example.com",
    "subject": "Security Scan Report"
}
```

## Database Schema

### Report Model

- `uuid`: Unique identifier
- `name`: Human-readable report name
- `type`: Enum (PDF, JSON, CSV)
- `status`: Enum (PENDING, GENERATED, FAILED)
- `url`: File path on disk
- `scan_id`: Foreign key to associated scan

## Deployment

### Kubernetes Configuration

The feature requires:

1. **Persistent Volume**: `reports-nfs-pv` (5Gi NFS storage)
2. **Persistent Volume Claim**: `reports-nfs-pvc`
3. **Volume Mounts**: Both webserver and Celery worker containers mount `/app/reports`

### Dependencies

Added to `pyproject.toml`:
- `jinja2`: Template engine
- `weasyprint`: HTML to PDF conversion
- `aiosmtplib`: Async SMTP client for email sending
- `email-validator`: Email validation

### Environment Variables

- `REPORTS_DIR`: Directory for storing reports (default: `/app/reports`)
- `SMTP_HOST`: SMTP server hostname
- `SMTP_PORT`: SMTP server port (default: 587)
- `SMTP_USER`: SMTP username
- `SMTP_PASSWORD`: SMTP password
- `SMTP_USE_TLS`: Enable TLS for SMTP (default: true)

## Templates

### report_base.html
- Main HTML template for PDF generation
- Responsive design with modern styling
- Includes scan metadata, findings summary, and detailed findings

### report_json.j2
- Structured JSON export
- Complete data including targets, findings, and metadata

### report_csv.j2
- Tabular CSV format
- One row per finding with all relevant details

## Error Handling

- Failed report generation updates status to `FAILED`
- Comprehensive logging for debugging
- Graceful handling of missing data

## Security Considerations

- Users can only generate/access reports for their own scans
- File access is validated through database ownership
- Reports are stored securely in the persistent volume
- Email addresses are validated before sending
- SMTP credentials are stored securely in Kubernetes secrets
- Email sending uses authenticated SMTP with TLS encryption

## Future Enhancements

- Report templates customization
- Scheduled report generation
- Report retention policies
- Additional format support (DOCX, XLSX)
- Bulk email sending for multiple reports
- Email delivery status tracking
- Custom email templates with HTML formatting 