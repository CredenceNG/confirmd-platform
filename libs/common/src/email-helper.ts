import * as dotenv from 'dotenv';
import { EmailDto } from './dtos/email.dto';

dotenv.config();

// Dynamic import to handle missing resend dependency gracefully
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
    console.log('📧 === RESEND EMAIL SENDING ===');
    console.log('📋 Email From:', EmailDto.emailFrom);
    console.log('📨 Email To:', EmailDto.emailTo);
    console.log('📝 Subject:', EmailDto.emailSubject);
    console.log('🔑 RESEND_API_KEY configured:', Boolean(process.env.RESEND_API_KEY));
    console.log('🔍 API Key prefix:', `${process.env.RESEND_API_KEY?.substring(0, 10)}...`);

    const emailData = {
      from: EmailDto.emailFrom,
      to: EmailDto.emailTo,
      subject: EmailDto.emailSubject,
      text: EmailDto.emailText,
      html: EmailDto.emailHtml
      // Note: Resend has different attachment format than SendGrid
      // attachments: EmailDto.emailAttachments
    };

    console.log('📤 Sending email via Resend API...');
    const { data, error } = await resend.emails.send(emailData);
    
    if (error) {
      console.error('❌ Resend email error:', JSON.stringify(error, null, 2));
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error details:', error);
      return false;
    }
    
    console.log('✅ Email sent successfully via Resend!');
    console.log('✅ Email ID:', data?.id);
    console.log('✅ Response data:', JSON.stringify(data, null, 2));
    return true;

  } catch (error) {
    console.error('❌ Failed to send email via Resend - Exception caught:');
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Full error object:', JSON.stringify(error, null, 2));
    return false;
  }

};
