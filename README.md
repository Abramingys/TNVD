# TN VED AI

Справочник ТН ВЭД ЕАЭС для Беларуси и России. Стек проекта — Next.js App Router, TypeScript и Supabase.

## Локальный запуск

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Откройте http://localhost:3000. В демо-режиме попробуйте `0901`, `0901 21 0000`, `кофе` и `обжаренные зерна`. Поиск работает на тестовом наборе. Для входа и кабинета требуется Supabase.

## Настройка Supabase

1. Создайте проект Supabase и выполните SQL из `supabase/migrations` в SQL Editor.
2. Запишите URL и publishable key из настроек проекта в `.env.local`. Установите `DEMO_MODE=false`.
3. В настройках Auth включите подтверждение email. В URL Configuration разрешите `http://localhost:3000/auth/callback`. Для публичного адреса замените localhost и настройте `APP_URL`.
4. Загрузите проверенную номенклатуру по [инструкции импорта](docs/import-guide.md).

Проверки — `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

[Архитектура](docs/architecture.md) · [База данных](docs/database.md) · [Источники](docs/data-sources.md) · [Статус](docs/roadmap.md)

## GitHub Pages

В настройках репозитория откройте **Settings → Pages → Build and deployment → Source → GitHub Actions**. Workflow публикует папку `pages/` при push в `main` и запускается вручную из вкладки Actions.

На GitHub Pages доступна статическая демоверсия с поиском и карточками. Для авторизации и поиска по импортированной номенклатуре запускайте серверное приложение Next.js с Supabase.
