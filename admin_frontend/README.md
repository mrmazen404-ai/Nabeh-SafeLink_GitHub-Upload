# Nabeh Admin Panel

واجهة الإدارة مستقلة عن واجهة المستخدم وتستعمل `/api/v1/admin` فقط. المرحلة الأولى تشمل Login و2FA وLogout ولوحة جلسة أولية.

```bash
cd admin_frontend
npm install
npm run dev
```

تعمل افتراضياً على `http://localhost:5174`، وتحوّل `/api` إلى Backend على `http://127.0.0.1:8080`.
