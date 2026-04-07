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

  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildTempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getChatPreviewText(chat, currentUserId) {
  const text = chat.lastMessageText?.trim();

  if (!text) {
    return "Сообщений пока нет";
  }

  if (chat.lastMessageSenderId === currentUserId) {
    return `Вы: ${text}`;
  }

  if (chat.lastMessageSenderName) {
    return `${chat.lastMessageSenderName}: ${text}`;
  }

  return text;
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
        <p className="login-subtitle">Войдите, чтобы продолжить</p>

        <input
          className="text-input"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <input
          className="text-input"
          placeholder="Пароль"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
  const [chatReads, setChatReads] = useState({});
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
  const lastIncomingMessageIdRef = useRef(null);
  const profileCacheRef = useRef(new Map());
  const hasChatHistoryEntryRef = useRef(false);
  const sidebarMenuRef = useRef(null);

  const currentUserName = useMemo(() => {
    return profile?.name || user?.email || "Пользователь";
  }, [profile, user]);

  async function resolveSenderName(senderId) {
    if (!senderId || senderId === user?.uid) {
      return currentUserName;
    }

    if (profileCacheRef.current.has(senderId)) {
      return profileCacheRef.current.get(senderId);
    }

    const senderProfile = await getUserProfile(senderId);
    const senderName =
      senderProfile?.name || senderProfile?.email || "Пользователь";

    profileCacheRef.current.set(senderId, senderName);
    return senderName;
  }

  const visibleMessages = useMemo(() => {
    const confirmedClientIds = new Set(
      serverMessages.map((message) => message.clientMessageId).filter(Boolean)
    );

    const filteredPending = pendingMessages.filter(
      (message) =>
        message.chatId === activeChat?.id &&
        !confirmedClientIds.has(message.clientMessageId)
    );

    return [...serverMessages, ...filteredPending].sort(
      (left, right) => (left.createdAtMs || 0) - (right.createdAtMs || 0)
    );
  }, [activeChat, pendingMessages, serverMessages]);

  const chatsWithMeta = useMemo(() => {
    return chats.map((chat) => {
      const lastReadAt = Number(chatReads[chat.id] || 0);
      const lastMessageAt = Number(chat.lastMessageAt || 0);
      const isUnread =
        lastMessageAt > lastReadAt && chat.lastMessageSenderId !== user?.uid;

      return {
        ...chat,
        isUnread,
        previewText: getChatPreviewText(chat, user?.uid),
      };
    });
  }, [chatReads, chats, user?.uid]);

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
        console.error("OneSignal init error:", error);
      }
    }

    bootstrapOneSignal();
  }, []);

  useEffect(() => {
    const unsubscribe = observeAuth(async (nextUser) => {
      setUser(nextUser);
      setActiveChat(null);
      setChats([]);
      setChatReads({});
      setServerMessages([]);
      setPendingMessages([]);
      setText("");
      setLoadingChats(false);
      setIsSidebarMenuOpen(false);
      activeChatIdRef.current = null;
      lastIncomingMessageIdRef.current = null;
      profileCacheRef.current = new Map();
      hasChatHistoryEntryRef.current = false;

      if (!nextUser) {
        setProfile(null);

        try {
          await logoutOneSignal();
          const state = await getPushState();
          setPushState(state);
        } catch (error) {
          console.error("OneSignal logout error:", error);
        }

        return;
      }

      try {
        await loginOneSignal(nextUser.uid);
        const state = await getPushState();
        setPushState(state);
      } catch (error) {
        console.error("OneSignal login error:", error);
      }

      try {
        const currentUserProfile = await getUserProfile(nextUser.uid);
        setProfile(currentUserProfile);
        profileCacheRef.current.set(
          nextUser.uid,
          currentUserProfile?.name ||
            currentUserProfile?.email ||
            nextUser.email ||
            "Пользователь"
        );
      } catch (error) {
        console.error("Profile loading error:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (window.matchMedia(mobileQuery).matches && activeChatIdRef.current) {
        hasChatHistoryEntryRef.current = false;
        activeChatIdRef.current = null;
        setActiveChat(null);
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!isMobileView) {
      hasChatHistoryEntryRef.current = false;
      return;
    }

    if (activeChat?.id && !hasChatHistoryEntryRef.current) {
      window.history.pushState({ chatId: activeChat.id }, "");
      hasChatHistoryEntryRef.current = true;
      return;
    }

    if (!activeChat?.id) {
      hasChatHistoryEntryRef.current = false;
    }
  }, [activeChat?.id, isMobileView]);

  useEffect(() => {
    if (!isSidebarMenuOpen) {
      return;
    }

    const handlePointerDown = (event) => {
      if (!sidebarMenuRef.current?.contains(event.target)) {
        setIsSidebarMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isSidebarMenuOpen]);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    const unsubscribe = subscribeToChatReads(
      user.uid,
      (nextChatReads) => {
        setChatReads(nextChatReads);
      },
      (error) => {
        console.error("Chat read state error:", error);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    setLoadingChats(true);

    const unsubscribe = subscribeToUserChats(
      user.uid,
      async (rawChats) => {
        const preparedChats = await Promise.all(
          rawChats.map(async (chat) => {
            const displayTitle = await getChatDisplayTitle(chat, user.uid);
            const lastMessageSenderName = await resolveSenderName(
              chat.lastMessageSenderId
            );

            return {
              ...chat,
              displayTitle,
              lastMessageSenderName,
            };
          })
        );

        preparedChats.sort((left, right) => {
          const leftLastMessageAt = Number(left.lastMessageAt || 0);
          const rightLastMessageAt = Number(right.lastMessageAt || 0);

          if (leftLastMessageAt !== rightLastMessageAt) {
            return rightLastMessageAt - leftLastMessageAt;
          }

          if (left.type === "group" && right.type !== "group") return 1;
          if (left.type !== "group" && right.type === "group") return -1;
          return left.displayTitle.localeCompare(right.displayTitle, "ru");
        });

        setChats(preparedChats);
        setActiveChat((currentActiveChat) => {
          if (!currentActiveChat) {
            if (!window.matchMedia(mobileQuery).matches) {
              return preparedChats[0] || null;
            }

            return currentActiveChat;
          }

          return (
            preparedChats.find((chat) => chat.id === currentActiveChat.id) || null
          );
        });
        setLoadingChats(false);
      },
      (error) => {
        console.error("Chat loading error:", error);
        setLoadingChats(false);
      }
    );

    return () => unsubscribe();
  }, [currentUserName, mobileQuery, user?.uid]);

  useEffect(() => {
    const chatId = activeChat?.id || null;
    activeChatIdRef.current = chatId;
    lastIncomingMessageIdRef.current = null;

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

        const previousMessageId = lastIncomingMessageIdRef.current;
        const newestMessage =
          nextMessages.length > 0 ? nextMessages[nextMessages.length - 1] : null;

        if (newestMessage) {
          lastIncomingMessageIdRef.current = newestMessage.id;
        }

        setServerMessages(nextMessages);

        const confirmedClientIds = new Set(
          nextMessages.map((message) => message.clientMessageId).filter(Boolean)
        );

        setPendingMessages((previous) =>
          previous.filter(
            (message) => !confirmedClientIds.has(message.clientMessageId)
          )
        );

        setIsMessagesLoading(false);

        if (
          previousMessageId &&
          newestMessage &&
          newestMessage.id !== previousMessageId &&
          newestMessage.senderId !== user?.uid &&
          document.visibilityState !== "visible" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          const title =
            activeChat?.displayTitle || newestMessage.senderName || "Mini Chat";
          const options = {
            body: newestMessage.text,
            tag: `chat-${chatId}`,
            data: { chatId },
          };

          if ("serviceWorker" in navigator) {
            navigator.serviceWorker.ready
              .then((registration) => registration.showNotification(title, options))
              .catch((error) => {
                console.error("Service worker notification error:", error);
                new Notification(title, options);
              });
          } else {
            new Notification(title, options);
          }
        }
      },
      (error) => {
        if (activeChatIdRef.current !== chatId) {
          return;
        }

        console.error("Message loading error:", error);
        setIsMessagesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeChat?.displayTitle, activeChat?.id, user?.uid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages, activeChat?.id]);

  useEffect(() => {
    const lastVisibleMessage =
      visibleMessages.length > 0 ? visibleMessages[visibleMessages.length - 1] : null;

    if (!activeChat?.id || !user?.uid || !lastVisibleMessage) {
      return;
    }

    if (lastVisibleMessage.senderId === user.uid) {
      return;
    }

    const lastReadAt = Number(chatReads[activeChat.id] || 0);
    const lastMessageAt = Number(lastVisibleMessage.createdAtMs || 0);

    if (lastMessageAt <= lastReadAt) {
      return;
    }

    markChatAsRead(activeChat.id, user.uid, lastMessageAt).catch((error) => {
      console.error("Mark as read error:", error);
    });
  }, [activeChat?.id, chatReads, user?.uid, visibleMessages]);

  async function handleLogin() {
    try {
      setIsLoggingIn(true);
      await login(email, password);
      setEmail("");
      setPassword("");
    } catch (error) {
      console.error("Login error:", error);
      alert("Не удалось войти");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      setIsSidebarMenuOpen(false);
      await logout();
      await logoutOneSignal();
      const state = await getPushState();
      setPushState(state);
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  async function handleEnablePush() {
    try {
      setIsSidebarMenuOpen(false);
      setIsPushBusy(true);
      await requestPushPermission();

      if (user?.uid) {
        await loginOneSignal(user.uid);
      }

      const state = await getPushState();
      setPushState(state);
      alert(
        `Push status:\npermission=${state.permission}\noptedIn=${state.optedIn}\nexternalId=${state.externalId || "null"}`
      );
    } catch (error) {
      console.error("Push enable error:", error);
      alert("Не удалось включить уведомления");
    } finally {
      setIsPushBusy(false);
    }
  }

  async function handleRefreshPushState() {
    try {
      setIsSidebarMenuOpen(false);
      const state = await getPushState();
      setPushState(state);
      alert(
        `Push status:\npermission=${state.permission}\noptedIn=${state.optedIn}\nexternalId=${state.externalId || "null"}`
      );
    } catch (error) {
      console.error("Push state check error:", error);
    }
  }

  async function handleSendMessage() {
    const trimmed = text.trim();

    if (!activeChat || !trimmed || isSending) {
      return;
    }

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

    setPendingMessages((previous) => [...previous, optimisticMessage]);
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

      setPendingMessages((previous) =>
        previous.map((message) =>
          message.clientMessageId === clientMessageId
            ? { ...message, pending: false, failed: false }
            : message
        )
      );

      const recipientIds = (activeChat.members || []).filter(
        (memberId) => memberId !== user.uid
      );

      await sendPushNotification({
        chatId: activeChat.id,
        chatTitle: activeChat.displayTitle || "Чат",
        messageText: trimmed,
        senderId: user.uid,
        senderName: currentUserName,
        recipientIds,
      });
    } catch (error) {
      console.error("Send message error:", error);

      setPendingMessages((previous) =>
        previous.map((message) =>
          message.clientMessageId === clientMessageId
            ? { ...message, failed: true, pending: false }
            : message
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
    activeChatIdRef.current = chat.id;
    setActiveChat(chat);
  }

  function backToChatList() {
    if (isMobileView && hasChatHistoryEntryRef.current) {
      window.history.back();
      return;
    }

    activeChatIdRef.current = null;
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
      {showSidebar ? (
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-header-text">
              <div className="sidebar-title">Чаты</div>
              <div className="sidebar-user">{currentUserName}</div>
              <div className="sidebar-user">
                Push: {pushState.optedIn ? "включен" : "выключен"}
              </div>
            </div>

            <div className="sidebar-menu-wrap" ref={sidebarMenuRef}>
              <button
                className="icon-button"
                onClick={() => setIsSidebarMenuOpen((previous) => !previous)}
                aria-label="Открыть меню"
                aria-expanded={isSidebarMenuOpen}
              >
                ...
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
            ) : chatsWithMeta.length === 0 ? (
              <div className="empty-state">Чаты не найдены</div>
            ) : (
              chatsWithMeta.map((chat) => (
                <button
                  key={chat.id}
                  className={`chat-item ${
                    activeChat?.id === chat.id ? "chat-item-active" : ""
                  }`}
                  onClick={() => openChat(chat)}
                >
                  <div className="chat-item-top">
                    <div className="chat-item-title">{chat.displayTitle}</div>
                    {chat.isUnread ? <span className="unread-dot" /> : null}
                  </div>

                  <div className="chat-item-subtitle">
                    {chat.type === "group" ? "Общий чат" : "Личный чат"}
                  </div>

                  <div className="chat-item-preview">{chat.previewText}</div>
                </button>
              ))
            )}
          </div>
        </aside>
      ) : null}

      {showChatPanel ? (
        <main className="chat-panel">
          {activeChat ? (
            <>
              <div className="chat-header">
                {isMobileView ? (
                  <button className="back-button" onClick={backToChatList}>
                    ←
                  </button>
                ) : null}

                <div className="chat-header-info">
                  <div className="chat-header-title">{activeChat.displayTitle}</div>
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
                  visibleMessages.map((message) => {
                    const isMine = message.senderId === user.uid;

                    return (
                      <div
                        key={message.id}
                        className={`message-row ${
                          isMine ? "message-row-mine" : "message-row-other"
                        }`}
                      >
                        <div
                          className={`message-bubble ${
                            isMine
                              ? "message-bubble-mine"
                              : "message-bubble-other"
                          } ${message.failed ? "message-bubble-failed" : ""}`}
                        >
                          <div className="message-author">{message.senderName}</div>
                          <div className="message-text">{message.text}</div>
                          <div className="message-time">
                            {formatTime(message.createdAtMs)}
                            {message.pending ? " • отправка..." : ""}
                            {message.failed ? " • ошибка" : ""}
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
                  onChange={(event) => setText(event.target.value)}
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
            <div className="empty-chat-screen">Выберите чат слева</div>
          )}
        </main>
      ) : null}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
