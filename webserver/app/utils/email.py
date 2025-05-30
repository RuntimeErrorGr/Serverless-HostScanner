import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path
from typing import Optional

from app.config import settings
from app.log import get_logger

log = get_logger(__name__)


class EmailService:
    """Service for sending emails with attachments"""
    
    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.smtp_use_tls = settings.SMTP_USE_TLS
    
    async def send_email_with_attachment(
        self,
        sender_email: str,
        sender_name: Optional[str],
        recipient_email: str,
        subject: str,
        body: str,
        attachment_path: str,
        attachment_name: Optional[str] = None
    ) -> bool:
        """
        Send an email with an attachment
        
        Args:
            sender_email: Email address of the sender
            sender_name: Display name of the sender (optional)
            recipient_email: Email address of the recipient
            subject: Email subject
            body: Email body (plain text)
            attachment_path: Path to the file to attach
            attachment_name: Name to use for the attachment (optional, uses filename if not provided)
            
        Returns:
            bool: True if email was sent successfully, False otherwise
        """
        try:
            # Create message
            msg = MIMEMultipart()
            
            # Set email headers
            if sender_name:
                msg['From'] = f"{sender_name} <{sender_email}>"
            else:
                msg['From'] = sender_email
            msg['To'] = recipient_email
            msg['Subject'] = subject
            
            # Add body to email
            msg.attach(MIMEText(body, 'plain'))
            
            # Add attachment if file exists
            if os.path.exists(attachment_path):
                with open(attachment_path, "rb") as attachment:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(attachment.read())
                
                # Encode file in ASCII characters to send by email
                encoders.encode_base64(part)
                
                # Add header as key/value pair to attachment part
                filename = attachment_name or Path(attachment_path).name
                part.add_header(
                    'Content-Disposition',
                    f'attachment; filename= {filename}',
                )
                
                # Attach the part to message
                msg.attach(part)
            else:
                log.warning(f"Attachment file not found: {attachment_path}")
                return False
            
            # Create SMTP session
            server = smtplib.SMTP(self.smtp_host, self.smtp_port)
            
            if self.smtp_use_tls:
                server.starttls()  # Enable security
            
            if self.smtp_user and self.smtp_password:
                server.login(self.smtp_user, self.smtp_password)
            
            # Send email
            text = msg.as_string()
            server.sendmail(sender_email, recipient_email, text)
            server.quit()
            
            log.info(f"Email sent successfully to {recipient_email}")
            return True
            
        except Exception as e:
            log.error(f"Failed to send email to {recipient_email}: {str(e)}")
            return False


# Global email service instance
email_service = EmailService() 