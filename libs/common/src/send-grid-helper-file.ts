import { Resend } from 'resend';
import * as dotenv from 'dotenv';
import { EmailDto } from './dtos/email.dto';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async (EmailDto: EmailDto): Promise<boolean> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emailData: any = {
      from: EmailDto.emailFrom,
      to: EmailDto.emailTo,
      subject: EmailDto.emailSubject,
      text: EmailDto.emailText,
      html: EmailDto.emailHtml
    };

    // Add attachments if present (Resend format)
    if (EmailDto.emailAttachments && 0 < EmailDto.emailAttachments.length) {
      emailData.attachments = EmailDto.emailAttachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content // Resend accepts base64 string directly
      }));
    }

    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Resend email error:', error);
      return false;
    }

    // eslint-disable-next-line no-console
    console.log('✅ Email sent successfully via Resend:', data?.id);
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ Failed to send email via Resend:', error);
    return false;
  }
};
