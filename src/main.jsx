import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { login, logout, observeAuth } from "./auth";
import { getChatDisplayTitle, getUserChats, getUserProfile } from "./chat";
import { sendMessage, subscribeToMessages } from "./messages";
import "./styles.css";

function formatTime(timestamp) {
  if (!timestamp) return "";

  const date = new Date(timestamp);

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildTempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function LoginScreen({
  email,
  password,
  setEmail,
  setPassword,
  onLogin,
  isLoggingIn,
}) {
  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Mini Chat</h1>
        <p className="login-subtitle">Вход для участников</p>

        <input
          className="text-input"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="text-input"
          placeholder="Пароль"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          className="primary-button"
          onClick={onLogin}
          disabled={isLoggingIn || !email.trim() || !password.trim()}
        >
          {isLoggingIn ? "Входим..." : "Войти"}
        </button>
      </div>
    </div>
  );
}

function App() {
  const mobileQuery = "(max-width: 768px)";

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);

  const [serverMessages, setServerMessages] = useState([]);
  const [pendingMessages, setPendingMessages] = useState([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);

  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [loadingChats, setLoadingChats] = useState(false);
  const [isMobileView, setIsMobileView] = useState(
    window.matchMedia(mobileQuery).matches
  );

  const bottomRef = useRef(null);
  const activeChatIdRef = useRef(null);

  const currentUserName = useMemo(() => {
    return profile?.name || user?.email || "Пользователь";
  }, [profile, user]);

  const visibleMessages = useMemo(() => {
    const confirmedClientIds = new Set(
      serverMessages.map((msg) => msg.clientMessageId).filter(Boolean)
    );

    const filteredPending = pendingMessages.filter(
      (msg) =>
        msg.chatId === activeChat?.id &&
        !confirmedClientIds.has(msg.clientMessageId)
    );

    return [...serverMessages, ...filteredPending].sort(
      (a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0)
    );
  }, [serverMessages, pendingMessages, activeChat]);

  useEffect(() => {
    const media = window.matchMedia(mobileQuery);

    const updateMobileView = () => {
      setIsMobileView(media.matches);
    };

    updateMobileView();

    if (media.addEventListener) {
      media.addEventListener("change", updateMobileView);

      return () => {
        media.removeEventListener("change", updateMobileView);
      };
    }

    media.addListener(updateMobileView);

    return () => {
      media.removeListener(updateMobileView);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = observeAuth(async (u) => {
      setUser(u);
      setActiveChat(null);
      setChats([]);
      setServerMessages([]);
      setPendingMessages([]);
      setText("");

      if (!u) {
        setProfile(null);
        return;
      }

      try {
        const currentUserProfile = await getUserProfile(u.uid);
        setProfile(currentUserProfile);

        setLoadingChats(true);

        const rawChats = await getUserChats(u.uid);

        const preparedChats = await Promise.all(
          rawChats.map(async (chat) => {
            const displayTitle = await getChatDisplayTitle(chat, u.uid);

            return {
              ...chat,
              displayTitle,
            };
          })
        );

        preparedChats.sort((a, b) => {
          if (a.type === "group" && b.type !== "group") return 1;
          if (a.type !== "group" && b.type === "group") return -1;
          return a.displayTitle.localeCompare(b.displayTitle, "ru");
        });

        setChats(preparedChats);

        if (!window.matchMedia(mobileQuery).matches && preparedChats.length > 0) {
          setActiveChat(preparedChats[0]);
        }
      } catch (error) {
        console.error("Ошибка загрузки данных:", error);
      } finally {
        setLoadingChats(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const chatId = activeChat?.id || null;
    activeChatIdRef.current = chatId;

    setServerMessages([]);
    setText("");

    if (!chatId) {
      setIsMessagesLoading(false);
      return;
    }

    setIsMessagesLoading(true);

    const unsubscribe = subscribeToMessages(
      chatId,
      (nextMessages) => {
        if (activeChatIdRef.current !== chatId) {
          return;
        }

        setServerMessages(nextMessages);

        const confirmedClientIds = new Set(
          nextMessages.map((msg) => msg.clientMessageId).filter(Boolean)
        );

        setPendingMessages((prev) =>
          prev.filter((msg) => !confirmedClientIds.has(msg.clientMessageId))
        );

        setIsMessagesLoading(false);
      },
      (error) => {
        if (activeChatIdRef.current !== chatId) {
          return;
        }

        console.error("Ошибка загрузки сообщений:", error);
        setIsMessagesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeChat?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages, activeChat?.id]);

  async function handleLogin() {
    try {
      setIsLoggingIn(true);
      await login(email, password);
      setEmail("");
      setPassword("");
    } catch (error) {
      console.error("Ошибка входа:", error);
      alert("Не удалось войти");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
      console.error("Ошибка выхода:", error);
    }
  }

  async function handleSendMessage() {
    const trimmed = text.trim();

    if (!activeChat) return;
    if (!trimmed) return;
    if (isSending) return;

    const clientMessageId = buildTempId();

    const optimisticMessage = {
      id: clientMessageId,
      clientMessageId,
      chatId: activeChat.id,
      senderId: user.uid,
      senderName: currentUserName,
      text: trimmed,
      createdAtMs: Date.now(),
      pending: true,
      failed: false,
    };

    setPendingMessages((prev) => [...prev, optimisticMessage]);
    setText("");
    setIsSending(true);

    try {
      await sendMessage({
        chatId: activeChat.id,
        senderId: user.uid,
        senderName: currentUserName,
        text: trimmed,
        clientMessageId,
      });

      setPendingMessages((prev) =>
        prev.map((msg) =>
          msg.clientMessageId === clientMessageId
            ? { ...msg, pending: false, failed: false }
            : msg
        )
      );
    } catch (error) {
      console.error("Ошибка отправки сообщения:", error);

      setPendingMessages((prev) =>
        prev.map((msg) =>
          msg.clientMessageId === clientMessageId
            ? { ...msg, failed: true, pending: false }
            : msg
        )
      );

      alert("Не удалось отправить сообщение");
    } finally {
      setIsSending(false);
    }
  }

  function handleInputKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  }

  function openChat(chat) {
    setActiveChat(chat);
  }

  function backToChatList() {
    setActiveChat(null);
  }

  if (!user) {
    return (
      <LoginScreen
        email={email}
        password={password}
        setEmail={setEmail}
        setPassword={setPassword}
        onLogin={handleLogin}
        isLoggingIn={isLoggingIn}
      />
    );
  }

  const showSidebar = !isMobileView || activeChat === null;
  const showChatPanel = !isMobileView || activeChat !== null;

  return (
    <div className="app-layout">
      {showSidebar && (
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-header-text">
              <div className="sidebar-title">Чаты</div>
              <div className="sidebar-user">{currentUserName}</div>
            </div>

            <button className="secondary-button" onClick={handleLogout}>
              Выйти
            </button>
          </div>

          <div className="chat-list">
            {loadingChats ? (
              <div className="empty-state">Загрузка чатов...</div>
            ) : chats.length === 0 ? (
              <div className="empty-state">Чаты не найдены</div>
            ) : (
              chats.map((chat) => (
                <button
                  key={chat.id}
                  className={`chat-item ${
                    activeChat?.id === chat.id ? "chat-item-active" : ""
                  }`}
                  onClick={() => openChat(chat)}
                >
                  <div className="chat-item-title">{chat.displayTitle}</div>
                  <div className="chat-item-subtitle">
                    {chat.type === "group" ? "Групповой чат" : "Личный чат"}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>
      )}

      {showChatPanel && (
        <main className="chat-panel">
          {activeChat ? (
            <>
              <div className="chat-header">
                {isMobileView && (
                  <button className="back-button" onClick={backToChatList}>
                    ←
                  </button>
                )}

                <div className="chat-header-info">
                  <div className="chat-header-title">
                    {activeChat.displayTitle}
                  </div>
                  <div className="chat-header-subtitle">
                    {activeChat.type === "group"
                      ? "Общий чат"
                      : "Личная переписка"}
                  </div>
                </div>
              </div>

              <div className="messages-area">
                {isMessagesLoading ? (
                  <div className="empty-state">Загрузка сообщений...</div>
                ) : visibleMessages.length === 0 ? (
                  <div className="empty-state">Сообщений пока нет</div>
                ) : (
                  visibleMessages.map((msg) => {
                    const isMine = msg.senderId === user.uid;

                    return (
                      <div
                        key={msg.id}
                        className={`message-row ${
                          isMine ? "message-row-mine" : "message-row-other"
                        }`}
                      >
                        <div
                          className={`message-bubble ${
                            isMine
                              ? "message-bubble-mine"
                              : "message-bubble-other"
                          } ${msg.failed ? "message-bubble-failed" : ""}`}
                        >
                          <div className="message-author">{msg.senderName}</div>

                          <div className="message-text">{msg.text}</div>

                          <div className="message-time">
                            {formatTime(msg.createdAtMs)}
                            {msg.pending ? " • отправка..." : ""}
                            {msg.failed ? " • ошибка" : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                <div ref={bottomRef} />
              </div>

              <div className="message-input-row">
                <textarea
                  className="text-input message-input textarea-input"
                  placeholder="Введите сообщение"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  rows={2}
                />

                <button
                  className="primary-button send-button"
                  onClick={handleSendMessage}
                  disabled={!text.trim() || isSending}
                >
                  {isSending ? "..." : "Отправить"}
                </button>
              </div>
            </>
          ) : (
            <div className="empty-chat-screen">Выбери чат слева</div>
          )}
        </main>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);