# Mini Chat

Минималистичный веб-мессенджер, разработанный на React + Firebase с поддержкой реального времени, push-уведомлений и установки как PWA-приложение.

 

## Возможности

- авторизация пользователей (email/password)
- личные чаты
- групповой чат
- отправка и получение сообщений в реальном времени
- хранение истории сообщений
- непрочитанные сообщения (красная точка)
- push-уведомления
- адаптивный интерфейс (телефон / ПК)
- установка как приложение (PWA)

 

## Стек технологий

- React
- Vite
- Firebase Authentication
- Firebase Firestore
- Firebase Hosting
- OneSignal (push-уведомления)
- PWA (manifest + service worker)

 

## Как работает приложение

### Авторизация
Используется Firebase Authentication. Вход осуществляется по email и паролю.

### Чаты
Чаты хранятся в коллекции `chats` в Firestore.

Поддерживаются:
- личные чаты
- групповой чат

### Сообщения
Сообщения хранятся в коллекции `messages`.

Каждое сообщение содержит:
- chatId
- senderId
- senderName
- text
- clientMessageId
- localCreatedAt

### Непрочитанные сообщения
Используется коллекция `chatReads`.

Позволяет:
- отслеживать прочитанные чаты
- отображать красную точку у новых сообщений

### Уведомления
Реализованы через OneSignal.

- пользователь подписывается на push
- уведомления отправляются при новых сообщениях
- работает на телефоне и ПК

 

## Структура проекта

mini-chat/
├─ public/
│  ├─ manifest.webmanifest
│  ├─ OneSignalSDKWorker.js
│  ├─ icon-192.png
│  ├─ icon-512.png
│  └─ maskable-512.png
├─ src/
│  ├─ auth.js
│  ├─ chat.js
│  ├─ firebase.js
│  ├─ main.jsx
│  ├─ messages.js
│  ├─ notify.js
│  ├─ onesignal.js
│  └─ styles.css
├─ index.html
├─ package.json
└─ README.md

 

## Установка и запуск

### Установка зависимостей

npm install

### Запуск проекта

npm run dev

Открыть в браузере:
http://localhost:5173

 

## Сборка проекта

npm run build

 

## Деплой

Проект размещается через Firebase Hosting:

firebase login  
firebase init hosting  
firebase deploy

 

## Настройка проекта

### Firebase

В файле `src/firebase.js` необходимо указать:

- apiKey
- authDomain
- projectId
- storageBucket
- messagingSenderId
- appId

 

### OneSignal

В файлах:

`src/onesignal.js`:
- ONESIGNAL_APP_ID

`src/notify.js`:
- ONESIGNAL_APP_ID
- ONESIGNAL_API_KEY

 

## Структура базы данных Firestore

### users

{
  "name": "Дима",
  "email": "user@test.com"
}

 

### chats

{
  "type": "direct",
  "members": ["uid1", "uid2"]
}

или

{
  "type": "group",
  "title": "Общий чат",
  "members": ["uid1", "uid2", "uid3"]
}

 

### messages

{
  "chatId": "chat_id",
  "senderId": "uid1",
  "senderName": "Дима",
  "text": "Привет",
  "clientMessageId": "temp_id",
  "localCreatedAt": 1710000000000
}

 

### chatReads

{
  "chatId": "chat_id",
  "userId": "uid1",
  "lastReadAt": 1710000000000
}

 

## Firestore Rules

В проекте используются правила доступа, чтобы:

- пользователь видел только свои чаты
- пользователь читал только сообщения своих чатов
- пользователь мог создавать сообщения только в своих чатах
- пользователь мог обновлять только свои данные о прочтении

 

## Сайты и сервисы, которые использовались в проекте

### Firebase  
https://firebase.google.com/

Что делалось:
- создавался Firebase-проект
- включалась авторизация Email/Password
- создавалась база Firestore
- настраивались Firestore Rules
- выполнялся деплой через Firebase Hosting
- создавались пользователи и коллекции

 

### OneSignal  
https://onesignal.com/

Что делалось:
- создавался проект для push-уведомлений
- указывался URL сайта
- настраивались web push
- получались App ID и REST API Key
- подключались уведомления к приложению

 

### GitHub  
https://github.com/

Что делалось:
- хранение исходного кода
- управление версиями проекта
- публикация проекта

 

### Google Chrome  

Что делалось:
- тестирование приложения
- проверка PWA установки
- проверка push-уведомлений
- тестирование мобильной версии

 

## Итог

Проект представляет собой полноценный минимальный мессенджер с:

- реальным временем
- уведомлениями
- мобильной версией
- установкой как приложение

Разработан в учебных и практических целях.