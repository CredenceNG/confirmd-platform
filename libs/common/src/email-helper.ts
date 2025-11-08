import * as dotenv from 'dotenv';
import { EmailDto } from './dtos/email.dto';

dotenv.config();

// Dynamic import to handle missing resend dependency gracefully
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let resend: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Resend } = require('resend');
  resend = new Resend(process.env.RESEND_API_KEY);
  // eslint-disable-next-line no-console
  console.log('✅ Resend initialized successfully in live mode');
} catch (error) {
  // eslint-disable-next-line no-console
  console.log('⚠️ Resend package not found, email functionality may be limited');
}

export const sendEmail = async (EmailDto: EmailDto): Promise<boolean> => {
  try {
    /* eslint-disable no-console */
    console.log('📧 === RESEND EMAIL SENDING ===');
    console.log('📋 Email From:', EmailDto.emailFrom);
    console.log('📨 Email To:', EmailDto.emailTo);
    console.log('📝 Subject:', EmailDto.emailSubject);
    console.log('🔑 RESEND_API_KEY configured:', Boolean(process.env.RESEND_API_KEY));
    console.log('🔍 API Key prefix:', `${process.env.RESEND_API_KEY?.substring(0, 10)}...`);
    /* eslint-enable no-console */

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
      /* eslint-disable no-console */
      console.log(`📎 Adding ${emailData.attachments.length} attachment(s) to email`);
      /* eslint-enable no-console */
    }

    /* eslint-disable no-console */
    console.log('📤 Sending email via Resend API...');
    /* eslint-enable no-console */
    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      /* eslint-disable no-console */
      console.error('❌ Resend email error:', JSON.stringify(error, null, 2));
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error details:', error);
      /* eslint-enable no-console */
      return false;
    }

    /* eslint-disable no-console */
    console.log('✅ Email sent successfully via Resend!');
    console.log('✅ Email ID:', data?.id);
    console.log('✅ Response data:', JSON.stringify(data, null, 2));
    /* eslint-enable no-console */
    return true;
  } catch (error) {
    /* eslint-disable no-console */
    console.error('❌ Failed to send email via Resend - Exception caught:');
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Full error object:', JSON.stringify(error, null, 2));
    /* eslint-enable no-console */
    return false;
  }
};
