/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>رمز التحقق الخاص بك</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>تأكيد إعادة المصادقة</Heading>
        <Text style={text}>استخدم الرمز التالي لتأكيد هويتك:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          سينتهي هذا الرمز قريباً. إذا لم تطلبه، يمكنك تجاهل هذه الرسالة بأمان.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Cairo', Arial, sans-serif" }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#103d33', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#3d4a45', lineHeight: '1.7', margin: '0 0 24px' }
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: '#c7b46c',
  letterSpacing: '6px',
  backgroundColor: '#f7f3e6',
  padding: '16px 24px',
  borderRadius: '12px',
  display: 'inline-block',
  margin: '0 0 30px',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0' }
