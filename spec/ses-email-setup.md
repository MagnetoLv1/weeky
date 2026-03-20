# AWS SES 이메일 수신 설정

> 도메인 `montents.com`으로 수신된 이메일을 Gmail(`lomi525.sub@gmail.com`)로 포워딩하는 구성

---

## 전체 아키텍처

```
발신자 → montents.com (Route53 MX)
           → SES 수신 (ap-northeast-2)
               → S3 저장 (montents-ses-emails/emails/)
                   → Lambda (ses-email-forwarder)
                       → Gmail (lomi525.sub@gmail.com)
```

---

## AWS 리소스

| 리소스 | 이름 / 값 |
|--------|-----------|
| AWS 프로필 | `lomi525` |
| 리전 | `ap-northeast-2` |
| SES 도메인 | `montents.com` |
| 포워딩 대상 | `lomi525.sub@gmail.com` |
| S3 버킷 | `montents-ses-emails` |
| S3 이메일 경로 | `emails/{messageId}` |
| Lambda 함수 | `ses-email-forwarder` |
| Lambda IAM Role | `ses-email-forwarder-role` |
| SES 수신 규칙 세트 | `montents-ruleset` |
| SES 수신 규칙 | `forward-to-gmail` |

---

## Route53 DNS 레코드

| 타입 | 이름 | 값 |
|------|------|----|
| MX | `montents.com` | `10 inbound-smtp.ap-northeast-2.amazonaws.com` |
| TXT | `montents.com` | `v=spf1 include:amazonses.com ~all` |
| CNAME | `ps2egdxetjkvs2zf5lwleczmiu2eunmd._domainkey` | `ps2egdxetjkvs2zf5lwleczmiu2eunmd.dkim.amazonses.com` |
| CNAME | `gqgdjiqkg45slf4pxkbzguzkreq33xzt._domainkey` | `gqgdjiqkg45slf4pxkbzguzkreq33xzt.dkim.amazonses.com` |
| CNAME | `z4nml6b4xabmsa6hjf6ckymrlh4rua2x._domainkey` | `z4nml6b4xabmsa6hjf6ckymrlh4rua2x.dkim.amazonses.com` |

---

## Lambda 함수 동작

**파일:** `ses-email-forwarder` (Node.js 22.x, `index.mjs`)

**처리 흐름:**
1. SES 수신 이벤트에서 `messageId`, 발신자, 수신 주소 추출
2. S3에서 원본 이메일 raw 데이터 읽기
3. 헤더 수정:
   - `Return-Path` → `no-reply@montents.com` (SES 발신자 검증용)
   - `From` → `"원본발신자" <no-reply@montents.com>`
   - `Reply-To` → 원본 발신자 (답장 시 원래 발신자에게 전달)
   - `To` → `lomi525.sub@gmail.com`
   - `Subject` → `[to: 수신주소] 원래제목`
4. SES `SendRawEmail`로 Gmail에 발송 (`Source: no-reply@montents.com` 명시)

**IAM 권한:**
- `s3:GetObject`, `s3:ListBucket` — 이메일 원문 읽기
- `ses:SendRawEmail` — Gmail로 포워딩 발송
- `AWSLambdaBasicExecutionRole` — CloudWatch 로그

---

## SES 설정 상태

- [x] 도메인 인증 (`montents.com`) — `VerificationStatus: Success`
- [x] Gmail 인증 (`lomi525.sub@gmail.com`) — `VerificationStatus: Success`
- [x] DKIM 설정 완료 (ap-northeast-2 토큰 3개)
- [x] SPF 레코드 등록
- [x] 프로덕션 액세스 승인 (샌드박스 해제) — 일 최대 50,000건

---

## 요금

| 항목 | 요금 |
|------|------|
| 이메일 수신 | $0.10 / 1,000건 (첫 1,000건/월 무료) |
| 이메일 발송 | $0.10 / 1,000건 |
| Lambda | 월 100만건 무료 (사실상 무료) |
| S3 | 거의 무시 가능 |

> 개인 포워딩 용도 기준 **월 $1 미만** 예상

---

## 향후 설정 예정

- [ ] Gmail에서 `*@montents.com` 주소로 발송 (SMTP 설정)
