// Os testes de integração rodam em um banco PostgreSQL real e separado.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/central_marketing_test";
process.env.APP_URL = "http://localhost:3000";
delete process.env.RESEND_API_KEY;
