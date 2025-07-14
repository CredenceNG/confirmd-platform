import { Resend } from "resend";
import * as dotenv from "dotenv";
import { EmailDto } from "./dtos/email.dto";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async (EmailDto: EmailDto): Promise<boolean> => {
  try {
    const emailData = {
      from: EmailDto.emailFrom,
      to: EmailDto.emailTo,
      subject: EmailDto.emailSubject,
      text: EmailDto.emailText,
      html: EmailDto.emailHtml,
      // Note: Resend has different attachment format than SendGrid
      // attachments: EmailDto.emailAttachments
    };

    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      console.error("❌ Resend email error:", error);
      return false;
    }

    console.log("✅ Email sent successfully via Resend:", data?.id);
    return true;
  } catch (error) {
    console.error("❌ Failed to send email via Resend:", error);
    return false;
  }
};
