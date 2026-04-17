/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>تأكيد تغيير البريد الإلكتروني في {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>تأكيد تغيير البريد الإلكتروني</Heading>
        <Text style={text}>
          طلبت تغيير عنوان بريدك الإلكتروني في {siteName} من{' '}
          <Link href={`mailto:${email}`} style={link}>
            {email}
          </Link>{' '}
          إلى{' '}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          .
        </Text>
        <Text style={text}>اضغط على الزر أدناه لتأكيد هذا التغيير:</Text>
        <Button style={button} href={confirmationUrl}>
          تأكيد تغيير البريد
        </Button>
        <Text style={footer}>
          إذا لم تطلب هذا التغيير، يرجى تأمين حسابك فوراً.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Cairo', Arial, sans-serif" }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#103d33', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#3d4a45', lineHeight: '1.7', margin: '0 0 24px' }
const link = { color: '#8e6c3d', textDecoration: 'underline' }
const button = {
  backgroundColor: '#c7b46c',
  color: '#2b2711',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0' }
