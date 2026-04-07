import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { login, logout, observeAuth } from "./auth";
import {
  getChatDisplayTitle,
  getUserProfile,
  markChatAsRead,
  subscribeToChatReads,
  subscribeToUserChats,
} from "./chat";
import { sendMessage, subscribeToMessages } from "./messages";
import {
  getPushState,
  initOneSignal,
  loginOneSignal,
  logoutOneSignal,
  requestPushPermission,
} from "./onesignal";
import { sendPushNotification } from "./notify";
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
  const [chatReads, setChatReads] = useState({});
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

  const [pushState, setPushState] = useState({
    permission: "default",
    optedIn: false,
    subscriptionId: null,
    externalId: null,
  });
  const [isPushBusy, setIsPushBusy] = useState(false);

  const [isSidebarMenuOpen, setIsSidebarMenuOpen] = useState(false);

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
    async function bootstrapOneSignal() {
      try {
        await initOneSignal();
        const state = await getPushState();
        setPushState(state);
      } catch (error) {
        console.error("Ошибка инициализации OneSignal:", error);
      }
    }

    bootstrapOneSignal();
  }, []);

  useEffect(() => {
    let unsubscribeChats = null;
    let unsubscribeReads = null;

    const unsubscribeAuth = observeAuth(async (u) => {
      setUser(u);
      setProfile(null);
      setChats([]);
      setChatReads({});
      setActiveChat(null);
      setServerMessages([]);
      setPendingMessages([]);
      setText("");
      setIsSidebarMenuOpen(false);

      if (unsubscribeChats) {
        unsubscribeChats();
        unsubscribeChats = null;
      }

      if (unsubscribeReads) {
        unsubscribeReads();
        unsubscribeReads = null;
      }

      if (!u) {
        try {
          await logoutOneSignal();
          const state = await getPushState();
          setPushState(state);
        } catch (error) {
          console.error("Ошибка logout OneSignal:", error);
        }

        return;
      }

      try {
        await loginOneSignal(u.uid);
        const state = await getPushState();
        setPushState(state);
      } catch (error) {
        console.error("Ошибка login OneSignal:", error);
      }

      try {
        const currentUserProfile = await getUserProfile(u.uid);
        setProfile(currentUserProfile);
      } catch (error) {
        console.error("Ошибка загрузки профиля:", error);
      }

      setLoadingChats(true);

      unsubscribeChats = subscribeToUserChats(
        u.uid,
        async (rawChats) => {
          try {
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
              const aTime = Number(a.lastMessageAt || 0);
              const bTime = Number(b.lastMessageAt || 0);

              if (bTime !== aTime) {
                return bTime - aTime;
              }

              if (a.type === "group" && b.type !== "group") return 1;
              if (a.type !== "group" && b.type === "group") return -1;

              return a.displayTitle.localeCompare(b.displayTitle, "ru");
            });

            setChats(preparedChats);

            setActiveChat((prev) => {
              if (!prev) {
                if (!window.matchMedia(mobileQuery).matches && preparedChats.length > 0) {
                  return preparedChats[0];
                }
                return prev;
              }

              const stillExists = preparedChats.find((chat) => chat.id === prev.id);
              return stillExists || null;
            });
          } catch (error) {
            console.error("Ошибка подготовки чатов:", error);
          } finally {
            setLoadingChats(false);
          }
        },
        (error) => {
          console.error("Ошибка подписки на чаты:", error);
          setLoadingChats(false);
        }
      );

      unsubscribeReads = subscribeToChatReads(
        u.uid,
        (readsMap) => {
          setChatReads(readsMap);
        },
        (error) => {
          console.error("Ошибка подписки на chatReads:", error);
        }
      );
    });

    return () => {
      unsubscribeAuth();

      if (unsubscribeChats) {
        unsubscribeChats();
      }

      if (unsubscribeReads) {
        unsubscribeReads();
      }
    };
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

  useEffect(() => {
    if (!isMobileView) {
      return;
    }

    const handlePopState = () => {
      setIsSidebarMenuOpen(false);

      if (activeChatIdRef.current) {
        setActiveChat(null);
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isMobileView]);

  useEffect(() => {
    if (!isMobileView || !activeChat) {
      return;
    }

    const currentState = window.history.state || {};

    if (!currentState.chatOpen) {
      window.history.pushState({ chatOpen: true }, "");
    }
  }, [activeChat, isMobileView]);

  useEffect(() => {
    async function syncReadState() {
      if (!user || !activeChat) return;

      const lastVisibleMessage = visibleMessages[visibleMessages.length - 1];
      const latestVisibleAt = Number(lastVisibleMessage?.createdAtMs || 0);
      const latestChatAt = Number(activeChat?.lastMessageAt || 0);
      const latestAt = Math.max(latestVisibleAt, latestChatAt);
      const currentReadAt = Number(chatReads[activeChat.id] || 0);

      if (latestAt > currentReadAt) {
        try {
          await markChatAsRead(activeChat.id, user.uid, latestAt);
          setChatReads((prev) => ({
            ...prev,
            [activeChat.id]: latestAt,
          }));
        } catch (error) {
          console.error("Ошибка markChatAsRead:", error);
        }
      }
    }

    syncReadState();
  }, [activeChat?.id, activeChat?.lastMessageAt, visibleMessages, user, chatReads]);

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
      await logoutOneSignal();
      const state = await getPushState();
      setPushState(state);
      setIsSidebarMenuOpen(false);
    } catch (error) {
      console.error("Ошибка выхода:", error);
    }
  }

  async function handleEnablePush() {
    try {
      setIsPushBusy(true);
      const state = await requestPushPermission();
      setPushState(state);
      alert(
        `Push status:\npermission=${state.permission}\noptedIn=${state.optedIn}\nexternalId=${state.externalId || "null"}`
      );
    } catch (error) {
      console.error("Ошибка включения push:", error);
      alert("Не удалось включить уведомления");
    } finally {
      setIsPushBusy(false);
    }
  }

  async function handleRefreshPushState() {
    try {
      const state = await getPushState();
      setPushState(state);
      alert(
        `Push status:\npermission=${state.permission}\noptedIn=${state.optedIn}\nexternalId=${state.externalId || "null"}`
      );
    } catch (error) {
      console.error("Ошибка проверки push:", error);
    }
  }

  async function handleSendMessage() {
    const trimmed = text.trim();

    if (!activeChat) return;
    if (!trimmed) return;
    if (isSending) return;

    const clientMessageId = buildTempId();
    const now = Date.now();

    const optimisticMessage = {
      id: clientMessageId,
      clientMessageId,
      chatId: activeChat.id,
      senderId: user.uid,
      senderName: currentUserName,
      text: trimmed,
      createdAtMs: now,
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

      if (activeChat) {
        setChats((prev) =>
          prev.map((chat) =>
            chat.id === activeChat.id
              ? {
                  ...chat,
                  lastMessageAt: now,
                  lastMessageSenderId: user.uid,
                  lastMessageText: trimmed,
                }
              : chat
          )
        );
      }

      const recipientIds = (activeChat.members || []).filter(
        (id) => id !== user.uid
      );

      if (recipientIds.length > 0) {
        await sendPushNotification({
          chatId: activeChat.id,
          chatTitle: activeChat.displayTitle || "Чат",
          messageText: trimmed,
          senderId: user.uid,
          senderName: currentUserName,
          recipientIds,
        });
      }
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
    setIsSidebarMenuOpen(false);
    setActiveChat(chat);
  }

  function backToChatList() {
    if (isMobileView) {
      if (window.history.state?.chatOpen) {
        window.history.back();
        return;
      }

      setActiveChat(null);
      return;
    }

    setActiveChat(null);
  }

  function getChatUnread(chat) {
    const lastMessageAt = Number(chat.lastMessageAt || 0);
    const lastReadAt = Number(chatReads[chat.id] || 0);
    const isOwnLastMessage = chat.lastMessageSenderId === user?.uid;

    return lastMessageAt > lastReadAt && !isOwnLastMessage;
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
              <div className="sidebar-user">
                Push: {pushState.optedIn ? "включен" : "выключен"}
              </div>
            </div>

            <div className="sidebar-menu-wrap">
              <button
                className="icon-button"
                onClick={() => setIsSidebarMenuOpen((prev) => !prev)}
                aria-label="Меню"
              >
                ⋮
              </button>

              {isSidebarMenuOpen ? (
                <div className="sidebar-menu">
                  <button
                    className="sidebar-menu-item"
                    onClick={handleEnablePush}
                    disabled={isPushBusy}
                  >
                    {isPushBusy ? "..." : "Включить push"}
                  </button>

                  <button
                    className="sidebar-menu-item"
                    onClick={handleRefreshPushState}
                  >
                    Проверить push
                  </button>

                  <button
                    className="sidebar-menu-item sidebar-menu-item-danger"
                    onClick={handleLogout}
                  >
                    Выйти
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="chat-list">
            {loadingChats ? (
              <div className="empty-state">Загрузка чатов...</div>
            ) : chats.length === 0 ? (
              <div className="empty-state">Чаты не найдены</div>
            ) : (
              chats.map((chat) => {
                const hasUnread = getChatUnread(chat);

                return (
                  <button
                    key={chat.id}
                    className={`chat-item ${
                      activeChat?.id === chat.id ? "chat-item-active" : ""
                    }`}
                    onClick={() => openChat(chat)}
                  >
                    <div className="chat-item-top">
                      <div className="chat-item-title">{chat.displayTitle}</div>
                      {hasUnread ? <span className="unread-dot" /> : null}
                    </div>

                    <div className="chat-item-subtitle">
                      {chat.type === "group" ? "Групповой чат" : "Личный чат"}
                    </div>

                    <div className="chat-item-preview">
                      {chat.lastMessageText || "Сообщений пока нет"}
                    </div>
                  </button>
                );
              })
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